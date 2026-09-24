const { test }=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'ged/arquivo-digital-backend.gs'),'utf8');
function fixture(){
 const props=new Map([['API_TOKEN','test'],['ROOT_PERMANENTE','root-p'],['ROOT_FORMANDOS','root-f'],['SHEET_PERMANENTE','sheet-p'],['SHEET_FORMANDOS','sheet-f']]);let locked=false;
 const c={console,Date,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(typeof v==='string'?v:Buffer.from(v)).digest()],getUuid:()=>crypto.randomUUID(),base64Decode:v=>[...Buffer.from(v,'base64')],newBlob:(bytes,mime,name)=>({bytes,mime,name})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>locked=false})}};
 vm.createContext(c);vm.runInContext(source,c);return {c,props,locked:()=>locked};
}
test('pastas diferentes podem executar upload ao mesmo tempo',()=>{
 const {c,props,locked}=fixture();const result=c.withFolderLease_('aluno-A',()=>{
  assert.equal(locked(),false);return c.withFolderLease_('aluno-B',()=>42);
 });assert.equal(result,42);assert.equal([...props.keys()].filter(k=>k.startsWith('ad:lease:')).length,0);
});
test('mesma pasta recusa concorrência e libera a reserva após erro',()=>{
 const {c,props}=fixture();assert.throws(()=>c.withFolderLease_('aluno-A',()=>{assert.throws(()=>c.withFolderLease_('aluno-A',()=>{}),e=>e.code==='BUSY');throw Error('falha');}),/falha/);
 assert.equal([...props.keys()].filter(k=>k.startsWith('ad:lease:')).length,0);
 assert.equal(c.withFolderLease_('aluno-A',()=>true),true);
});
test('reserva abandonada expira e pode ser retomada',()=>{
 const {c,props}=fixture();props.set('ad:lease:'+c.hash_('aluno-A'),JSON.stringify({owner:'old',expires:Date.now()-1}));assert.equal(c.withFolderLease_('aluno-A',()=>true),true);
});
function sheet(rows){return {getLastRow:()=>rows.length,getRange:(r,c,n=1,m=1)=>({getDisplayValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m))})};}
test('linha antiga é resolvida pelo nome e nascimento atuais',()=>{
 const {c}=fixture();const sh=sheet([['NOME','NASCIMENTO'],['OUTRO','01/01/2000'],['ALUNO TESTE','02/02/2001']]);assert.equal(c.resolveStudentRow_(sh,{name:'Aluno Teste',birth:'02/02/2001',physicalRow:2},{headerRow:1,nameCol:1,birthCol:2}),3);
});
test('data diferente, homônimos ou ausência de cabeçalho bloqueiam escrita',()=>{
 const {c}=fixture();const sh=sheet([['NOME','NASCIMENTO'],['ALUNO','01/01/2000'],['ALUNO','01/01/2000']]);
 assert.throws(()=>c.resolveStudentRow_(sh,{name:'ALUNO',birth:'02/01/2000'},{headerRow:1,nameCol:1,birthCol:2}),/não corresponde/);
 assert.throws(()=>c.resolveStudentRow_(sh,{name:'ALUNO',birth:'01/01/2000'},{headerRow:1,nameCol:1,birthCol:2}),/homônimos/);
 assert.throws(()=>c.resolveStudentRow_(sh,{name:'ALUNO',physicalRow:2},{headerRow:0,nameCol:0,birthCol:0}),/Cabeçalho/);
});
test('busca ordena nome/data exatos antes de limitar os resultados',()=>{
 const {c}=fixture();c.studentIndex_=()=>({version:'test',records:[{name:'MARIA OUTRA',birth:'01/01/2000',sheet:'1',row:2},{name:'MARIA SILVA',birth:'02/02/2001',sheet:'2',row:2}]});
 const result=c.searchStudentsAction_({root:'PERMANENTE',query:'MARIA SILVA',birth:'02/02/2001',maxResults:1});assert.equal(result.results[0].name,'MARIA SILVA');assert.equal(result.truncated,true);
});
test('upload repetido confirma arquivo existente e não cria duplicata',()=>{
 const {c}=fixture();const files=[];const iterator=items=>{let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};};
 const folder={getId:()=> 'folder-A',getFilesByName:name=>iterator(files.filter(f=>f.getName()===name)),createFile:blob=>{const f={getId:()=>String(files.length+1),getName:()=>blob.name,getUrl:()=> 'https://example.test/file',getSize:()=>blob.bytes.length,getBlob:()=>({getBytes:()=>blob.bytes}),setDescription(){},isTrashed:()=>false};files.push(f);return f;}};
 c.DriveApp={getFolderById:()=>folder};c.assertFolderIsArchiveChild_=()=>{};c.findStudentFolder_=()=>folder;
 const payload={folderId:'folder-A',student:{root:'PERMANENTE',name:'TESTE'},document:{filename:'arquivo.pdf',mimeType:'application/pdf',base64:Buffer.from('%PDF-test').toString('base64')}};
 assert.equal(c.uploadDocumentAction_(payload).ok,true);assert.equal(c.uploadDocumentAction_(payload).duplicate,true);assert.equal(files.length,1);
});
test('upload não aceita pasta de outro aluno ou conteúdo inválido',()=>{
 const {c}=fixture();c.DriveApp={getFolderById:()=>({})};c.assertFolderIsArchiveChild_=()=>{};c.findStudentFolder_=()=>({getId:()=> 'different'});
 assert.throws(()=>c.uploadDocumentAction_({folderId:'folder-A',student:{root:'PERMANENTE',name:'TESTE'},document:{}}),/não corresponde/);
 c.findStudentFolder_=()=>({getId:()=> 'folder-A'});
 assert.throws(()=>c.uploadDocumentAction_({folderId:'folder-A',student:{root:'PERMANENTE',name:'TESTE'},document:{base64:Buffer.from('not a PDF').toString('base64')}}),/PDF inválido/);
});
test('índice lê abas uma vez, usa cache completo e invalida após mudança',()=>{
 const {c}=fixture();const zlib=require('node:zlib');const cache=new Map();let reads=0;
 const blob=value=>({getBytes:()=>[...Buffer.from(value)],getDataAsString:()=>Buffer.from(value).toString()});
 c.Utilities.newBlob=value=>blob(value);c.Utilities.gzip=b=>blob(zlib.gzipSync(Buffer.from(b.getBytes())));c.Utilities.ungzip=b=>blob(zlib.gunzipSync(Buffer.from(b.getBytes())));c.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
 c.CacheService={getScriptCache:()=>({get:k=>cache.get(k),remove:k=>cache.delete(k),getAll:keys=>Object.fromEntries(keys.map(k=>[k,cache.get(k)])),put:(k,v)=>cache.set(k,v),putAll:obj=>Object.entries(obj).forEach(([k,v])=>cache.set(k,v))})};
 c.SpreadsheetApp={openById:()=>({getSheets:()=>[{getSheetId:()=>1,getName:()=> 'CAIXA 1',getDataRange:()=>({getDisplayValues:()=>{reads++;return [['NOME','NASCIMENTO'],['ALUNO TESTE','01/01/2000']];}})}]})};
 const first=c.studentIndex_('PERMANENTE',false);assert.equal(first.records.length,1);assert.equal(first.records[0].row,2);
 const second=c.studentIndex_('PERMANENTE',false);assert.equal(second.version,first.version);assert.equal(reads,1);
 c.invalidateIndex_('PERMANENTE',1);const third=c.studentIndex_('PERMANENTE',false);assert.notEqual(third.version,first.version);assert.equal(reads,2);
 const manifest=[...cache.entries()].find(([k,v])=>k.endsWith(':0')&&v.includes('chunkPrefix'));if(manifest){const key=JSON.parse(manifest[1]).chunkPrefix+':0';cache.delete(key);}
});
test('paginação não mistura versões diferentes do índice',()=>{
 const {c}=fixture();c.SpreadsheetApp={openById:()=>({getSheets:()=>[{getSheetId:()=>1}]})};
 assert.throws(()=>c.getStudentIndexAction_({root:'PERMANENTE',offset:1000,version:'old'}),e=>e.code==='INDEX_CHANGED');
});

function registrationFixture(){
 const f=fixture(),{c}=f;let nextId=1;const sheets=[];
 function add(name,rows=[['CAIXA '+name],['Nº','Nome','Data de nascimento','Pasta Digital','Observações']]){
  const id=nextId++;let maxRows=1000;
  const sh={rows,getName:()=>name,getSheetId:()=>id,getLastRow:()=>rows.length,getLastColumn:()=>Math.max(5,...rows.map(r=>r.length)),getMaxRows:()=>maxRows,getMaxColumns:()=>26,insertRowsAfter:(_,n)=>maxRows+=n};
  sh.getRange=(r,col,n=1,width=1)=>{
   const range={getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>String(rows[r+i-1]?.[col+j-1]??''))),getDisplayValue:()=>String(rows[r-1]?.[col-1]??''),getFormula:()=>'',getFormulas:()=>Array.from({length:n},()=>['']),getRichTextValue:()=>null,getRichTextValues:()=>Array.from({length:n},()=>[null]),setValues:values=>{values.forEach((v,i)=>{rows[r+i-1]||=[];v.forEach((x,j)=>rows[r+i-1][col+j-1]=x);});return range;},setValue:value=>range.setValues([[value]])};
   for(const method of ['merge','setNumberFormat','setFontWeight','setBackground','setFontFamily','setFontColor','setHorizontalAlignment','setVerticalAlignment','setWrap'])range[method]=()=>range;
   return range;
  };
  sh.getDataRange=()=>sh.getRange(1,1,rows.length,sh.getLastColumn());
  for(const method of ['setFrozenRows','setColumnWidth','setRowHeights'])sh[method]=()=>sh;
  sheets.push(sh);return sh;
 }
 const ss={getSheets:()=>sheets,getSheetByName:name=>sheets.find(s=>s.getName()===name),insertSheet:name=>add(name,[])};
 c.SpreadsheetApp={openById:()=>ss,flush(){}};c.invalidateIndex_=()=>{};
 c.prepareStudentFolder_=(student,loc)=>{loc.sheet.rows[loc.row-1][3]='https://drive.google.com/drive/folders/folder-'+loc.sheet.getName();};
 c.folderFromUrl_=url=>url?{getId:()=>url.split('/').pop(),getUrl:()=>url}:null;c.assertFolderIsArchiveChild_=()=>{};
 return {...f,add,sheets,ss};
}
test('serviço recusa pasta e envio sem aluno localizado na planilha',()=>{
 const {c}=fixture();c.DriveApp={getFolderById:()=>({})};c.assertFolderIsArchiveChild_=()=>{};
 assert.throws(()=>c.ensureStudentFolderAction_({student:{root:'PERMANENTE',name:'TESTE'}}),/Selecione um aluno cadastrado/);
 assert.throws(()=>c.uploadDocumentAction_({student:{root:'PERMANENTE',name:'TESTE'},folderId:'folder'}),/Selecione um aluno cadastrado/);
});
test('caixas filtram inicial com acento e propõem próxima numeração sem limite físico',()=>{
 const {c,add}=registrationFixture();add('A1');add('A3');add('M1');add('MAGISTÉRIO A-1');
 const result=c.listBoxesAction_({root:'PERMANENTE',name:'Álvaro Teste'});
 assert.equal(result.letter,'A');assert.equal(result.nextBox,'A4');assert.deepEqual(Array.from(result.boxes,b=>b.name),['A1','A3']);
});
test('cadastro insere aluno, prepara vínculo e repetição não duplica',()=>{
 const {c,add,sheets}=registrationFixture();const box=add('A1');
 const payload={student:{root:'PERMANENTE',name:'ÁLVARO TESTE',birth:'25/03/2010'},sheet:'A1'};
 const first=c.registerStudentAction_(payload);assert.equal(first.student.row,3);assert.match(first.student.folderUrl,/folders/);assert.equal(box.rows[2][1],'ÁLVARO TESTE');
 assert.equal(c.registerStudentAction_(payload).duplicate,true);assert.equal(box.rows.length,3);assert.equal(sheets.length,1);
});
test('nova caixa segue cabeçalho e não é recriada quando resposta é repetida',()=>{
 const {c,add,sheets}=registrationFixture();add('M1');
 const payload={student:{root:'PERMANENTE',name:'MARIA TESTE',birth:'01/01/2000'},sheet:'M2',createBox:true};
 const first=c.registerStudentAction_(payload);assert.equal(first.student.sheet,'M2');assert.equal(sheets[1].rows[1][4],'Observações');
 assert.equal(c.registerStudentAction_(payload).duplicate,true);assert.equal(sheets.length,2);
 assert.throws(()=>c.registerStudentAction_({...payload,student:{...payload.student,name:'MARTA TESTE'}}),/lista de caixas mudou/);
});
test('cadastro bloqueia letra errada e data inválida sem inserir linhas',()=>{
 const {c,add}=registrationFixture();const box=add('M1');
 assert.throws(()=>c.registerStudentAction_({student:{root:'PERMANENTE',name:'ALUNO',birth:'01/01/2000'},sheet:'M1'}),/letra A/);
 assert.throws(()=>c.registerStudentAction_({student:{root:'PERMANENTE',name:'ALUNO',birth:'31/02/2000'},sheet:'M1'}),/Data de nascimento/);assert.equal(box.rows.length,2);
});
test('falha de pasta conserva cadastro e permite concluir no reenvio',()=>{
 const {c,add}=registrationFixture();const box=add('A1'),prepare=c.prepareStudentFolder_;c.prepareStudentFolder_=()=>{throw Error('Drive indisponível');};
 const payload={student:{root:'PERMANENTE',name:'ALUNO TESTE',birth:'01/01/2000'},sheet:'A1'};
 assert.match(c.registerStudentAction_(payload).warning,/cadastrado/);c.prepareStudentFolder_=prepare;
 const second=c.registerStudentAction_(payload);assert.equal(second.duplicate,true);assert.match(second.student.folderUrl,/folders/);assert.equal(box.rows.length,3);
});

test('incremental lê somente a caixa alterada e não lê Sheets se versão é igual',()=>{
 const {c}=fixture();let reads=0;c.CacheService={getScriptCache:()=>({remove(){}})};
 c.SpreadsheetApp={openById:()=>({getSheets:()=>[{getSheetId:()=>1},{getSheetId:()=>2}]})};c.readSheetRecords_=s=>{reads++;return [{sheetId:s.getSheetId(),name:'TESTE'}];};
 const old=c.indexEpoch_('PERMANENTE');c.invalidateIndex_('PERMANENTE',2);const result=c.getStudentChangesAction_({root:'PERMANENTE',epoch:old});assert.equal(result.sheets.length,1);assert.equal(result.sheets[0].sheetId,2);assert.equal(reads,1);
 c.SpreadsheetApp.openById=()=>{throw Error('Não deve ler Sheets');};assert.equal(c.getStudentChangesAction_({root:'PERMANENTE',epoch:result.epoch}).sheets.length,0);
});
test('histórico incremental perdido ou alteração durante leitura exige recuperação segura',()=>{
 const {c}=fixture();c.CacheService={getScriptCache:()=>({remove(){}})};const old=c.indexEpoch_('PERMANENTE');
 for(let i=0;i<41;i++)c.invalidateIndex_('PERMANENTE',1);
 assert.equal(c.getStudentChangesAction_({root:'PERMANENTE',epoch:old}).reset,true);
 const before=c.indexEpoch_('PERMANENTE');c.invalidateIndex_('PERMANENTE',1);
 c.SpreadsheetApp={openById:()=>({getSheets:()=>[{getSheetId:()=>1}]})};c.readSheetRecords_=()=>{c.invalidateIndex_('PERMANENTE',1);return [];};
 assert.throws(()=>c.getStudentChangesAction_({root:'PERMANENTE',epoch:before}),e=>e.code==='BUSY');
});
