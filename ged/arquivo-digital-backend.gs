/**
 * Arquivo Digital — serviço Google Apps Script 1.4.1.
 * Configure API_TOKEN, ROOT_PERMANENTE, ROOT_FORMANDOS,
 * SHEET_PERMANENTE e SHEET_FORMANDOS nas Propriedades do script.
 * Não publique chaves ou configurações privadas no repositório.
 */
const CONFIG = Object.freeze({
  VERSION: '1.4.1',
  API_TOKEN: PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '',
  ROOT_FOLDERS: Object.freeze({
    PERMANENTE: PropertiesService.getScriptProperties().getProperty('ROOT_PERMANENTE') || '',
    FORMANDOS: PropertiesService.getScriptProperties().getProperty('ROOT_FORMANDOS') || ''
  }),
  SPREADSHEETS: Object.freeze({
    PERMANENTE: PropertiesService.getScriptProperties().getProperty('SHEET_PERMANENTE') || '',
    FORMANDOS: PropertiesService.getScriptProperties().getProperty('SHEET_FORMANDOS') || ''
  }),
  LINK_HEADER: 'PASTA DIGITAL', LINK_TEXT: '📁 Pasta Digital', MAX_BASE64_CHARS: 12 * 1024 * 1024
});
const BACKEND_VERSION = '1.4.1';
const INDEX_TTL_SECONDS = 900;

function doGet() { return json_({ok:true,service:'Arquivo Digital',version:BACKEND_VERSION}); }
function doPost(e) {
  try {
    const payload=JSON.parse(e && e.postData && e.postData.contents || '{}');
    authorize_(payload);
    const handlers={ping:()=>({ok:true,message:'Arquivo Digital conectado.',version:BACKEND_VERSION,capabilities:['studentIndex','idempotentUpload','parallelFolders','studentRegistration','studentChanges']}),getStudentChanges:getStudentChangesAction_,listBoxes:listBoxesAction_,registerStudent:registerStudentAction_,verifyStudent:verifyStudentAction_,searchStudents:searchStudentsAction_,getStudentIndex:getStudentIndexAction_,ensureStudentFolder:ensureStudentFolderAction_,uploadDocument:uploadDocumentAction_,listStudentDocuments:listStudentDocumentsAction_};
    if(!Object.prototype.hasOwnProperty.call(handlers,payload.action))throw new Error('Ação não reconhecida.');
    return json_(handlers[payload.action](payload));
  }catch(error){console.error(error.message);return json_({ok:false,error:error.message || String(error),code:error.code || 'ERROR',retryable:error.code==='BUSY'});}
}
function authorize_(payload){if(!CONFIG.API_TOKEN || !payload || payload.token!==CONFIG.API_TOKEN)throw new Error('Chave de acesso inválida.');}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function normalize_(v){return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
function normalizeBirth_(value){
  if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,Session.getScriptTimeZone(),'dd/MM/yyyy');
  const text=String(value || '').trim();let m=text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=y>=30?1900:2000;return String(Number(m[1])).padStart(2,'0')+'/'+String(Number(m[2])).padStart(2,'0')+'/'+y;}
  m=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);return m?m[3].padStart(2,'0')+'/'+m[2].padStart(2,'0')+'/'+m[1]:text;
}
function sanitizeFileName_(text){return String(text || '').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim();}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function root_(value){const r=String(value || '').trim().toUpperCase();if(!Object.prototype.hasOwnProperty.call(CONFIG.SPREADSHEETS,r)||!CONFIG.SPREADSHEETS[r]||!CONFIG.ROOT_FOLDERS[r])throw new Error('Arquivo não configurado: '+r);return r;}
function busy_(){const e=new Error('Outro envio está finalizando nesta pasta. Aguarde alguns segundos e reenvie os pendentes.');e.code='BUSY';return e;}
function withScriptLock_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw busy_();try{return fn();}finally{lock.releaseLock();}}

// The script mutex protects only lease metadata; different folders upload in parallel.
// Lease duration exceeds an ordinary Apps Script execution and is not backed by evictable cache.
function withFolderLease_(folderId,fn){
  const key='ad:lease:'+hash_(folderId), owner=Utilities.getUuid(), props=PropertiesService.getScriptProperties();
  withScriptLock_(()=>{const raw=props.getProperty(key);const current=raw?JSON.parse(raw):null;if(current&&current.expires>Date.now())throw busy_();props.setProperty(key,JSON.stringify({owner,expires:Date.now()+15*60*1000}));});
  try{return fn();}finally{withScriptLock_(()=>{const raw=props.getProperty(key);if(raw&&JSON.parse(raw).owner===owner)props.deleteProperty(key);});}
}

function detectColumnsForSearch_(sheet){
  const rows=Math.min(30,sheet.getLastRow()),cols=Math.min(40,sheet.getLastColumn());
  if(!rows||!cols)return {headerRow:0,nameCol:0,birthCol:0,folderCol:0};
  const values=sheet.getRange(1,1,rows,cols).getDisplayValues();
  return detectColumnsFromValues_(values);
}
function detectColumnsFromValues_(values){
  const cols=values[0]?values[0].length:0;
  for(let r=0;r<Math.min(30,values.length);r++){
    const headers=values[r].slice(0,40).map(normalize_);
    const name=headers.findIndex(t=>/^(ALUNO|ALUNOS|NOME|NOME DO ALUNO|NOME DOS ALUNOS)(\s*[-–—].*)?$/.test(t));
    if(name<0)continue;
    return {headerRow:r+1,nameCol:name+1,birthCol:headers.findIndex(t=>/DATA.*NASC|NASCIMENTO/.test(t))+1,folderCol:headers.findIndex(t=>/PASTA.*DIGITAL|LINK.*PASTA|ARQUIVO.*DIGITAL/.test(t))+1};
  }
  // Legacy lists can be searched with their existing B/C layout; writes require an actual header.
  return {headerRow:0,nameCol:cols>=2?2:1,birthCol:cols>=3?3:0,folderCol:0};
}
function extractFolderUrl_(rich,formula,displayed){
  if(rich){const direct=rich.getLinkUrl();if(direct)return direct;for(const run of rich.getRuns()){const link=run.getLinkUrl();if(link)return link;}}
  const match=String(formula || '').match(/HYPERLINK\(\s*"([^"]+)"/i);if(match)return match[1];
  return /^https:\/\//i.test(String(displayed || ''))?String(displayed):'';
}

function readSheetRecords_(sheet,root){
  const allValues=sheet.getDataRange().getDisplayValues();
  const schema=detectColumnsFromValues_(allValues);if(!schema.nameCol)return [];
  const start=schema.headerRow+1,count=allValues.length-schema.headerRow;if(count<=0)return [];
  const values=allValues.slice(schema.headerRow),sheetName=sheet.getName(),sheetId=sheet.getSheetId();
  let rich=[],formulas=[];
  if(schema.folderCol){const range=sheet.getRange(start,schema.folderCol,count,1);rich=range.getRichTextValues();formulas=range.getFormulas();}
  return values.map((row,i)=>({root,sheetId,sheet:sheetName,row:start+i,name:String(row[schema.nameCol-1] || '').trim(),birth:normalizeBirth_(schema.birthCol?row[schema.birthCol-1]:''),folderUrl:schema.folderCol?extractFolderUrl_(rich[i]&&rich[i][0],formulas[i]&&formulas[i][0],row[schema.folderCol-1]):'',nameCol:schema.nameCol,birthCol:schema.birthCol,folderCol:schema.folderCol})).filter(r=>r.name.length>=3&&!/^(ALUNO|ALUNOS|NOME|TOTAL)$/.test(normalize_(r.name)));
}

// Immutable compressed chunks avoid CacheService's per-entry size limit and torn snapshots.
function indexEpoch_(root){return PropertiesService.getScriptProperties().getProperty('ad:index:v3:epoch:'+root)||'0';}
function invalidateIndex_(root,sheetId){
  const props=PropertiesService.getScriptProperties(),before=indexEpoch_(root),next=Utilities.getUuid();
  let events=[];try{events=JSON.parse(props.getProperty('ad:changes:'+root)||'[]');}catch(_){}
  events.push({from:before,to:next,sheetId:sheetId||null});
  props.setProperty('ad:changes:'+root,JSON.stringify(events.slice(-40)));
  props.setProperty('ad:index:v3:epoch:'+root,next);
  if(sheetId)CacheService.getScriptCache().remove('ad:sheet:v3:'+root+':'+sheetId);
}
function readCachedSheets_(root,sheets,force){
  const cache=CacheService.getScriptCache();
  const keys=sheets.map(sheet=>'ad:sheet:v3:'+root+':'+sheet.getSheetId());
  const cached=force?{}:cache.getAll(keys),records=[];
  for(let i=0;i<sheets.length;i++){
    let rows=null;
    if(cached[keys[i]]){try{const saved=JSON.parse(cached[keys[i]]);if(saved.expiresAt>Date.now())rows=saved.records;}catch(_){}}
    if(!rows){
      rows=normalize_(sheets[i].getName())==='INICIO'?[]:readSheetRecords_(sheets[i],root);
      const serialized=JSON.stringify({records:rows,expiresAt:Date.now()+INDEX_TTL_SECONDS*1000});
      if(serialized.length<30000){try{cache.put(keys[i],serialized,INDEX_TTL_SECONDS);}catch(_){}}
    }
    records.push(...rows);
  }
  return records;
}
function cachedIndex_(root){
  const cache=CacheService.getScriptCache(),epoch=indexEpoch_(root),prefix='ad:index:v3:'+root+':'+epoch;
  try{
    const raw=cache.get(prefix);if(!raw)return null;const manifest=JSON.parse(raw);
    const keys=Array.from({length:manifest.parts},(_,i)=>manifest.chunkPrefix+':'+i);const chunks=cache.getAll(keys);
    if(keys.some(k=>!chunks[k]))return null;
    const text=Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(keys.map(k=>chunks[k]).join('')),'application/x-gzip')).getDataAsString();
    const data=JSON.parse(text);
    if(data.expiresAt<=Date.now()||indexEpoch_(root)!==epoch)return null;
    return data;
  }catch(error){console.warn('Falha ao recuperar índice: '+error.message);return null;}
}
function studentIndex_(root,force,progress){
  if(!force){const cached=cachedIndex_(root);if(cached)return cached;}
  const epoch=indexEpoch_(root),ss=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[root]);let records=[];
  const sheets=ss.getSheets();
  for(let offset=0;offset<sheets.length;offset+=20){
    records=records.concat(readCachedSheets_(root,sheets.slice(offset,offset+20),force));
    if(progress)console.log(JSON.stringify({root,sheetsRead:Math.min(offset+20,sheets.length),totalSheets:sheets.length,records:records.length}));
  }
  if(indexEpoch_(root)!==epoch)throw busy_();
  const createdAt=Date.now();const index={records,version:Utilities.getUuid(),createdAt,expiresAt:createdAt+INDEX_TTL_SECONDS*1000,epoch};
  const packed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(index),'application/json')).getBytes());
  const cache=CacheService.getScriptCache(),prefix='ad:index:v3:'+root+':'+epoch,chunkPrefix=prefix+':'+index.version,parts={};
  for(let i=0;i<packed.length;i+=80000)parts[chunkPrefix+':'+i/80000]=packed.slice(i,i+80000);
  try {cache.putAll(parts,INDEX_TTL_SECONDS);cache.put(prefix,JSON.stringify({chunkPrefix,parts:Object.keys(parts).length}),INDEX_TTL_SECONDS);}catch(error){console.warn('Índice não coube no cache: '+error.message);}
  return index;
}
function searchStudentsAction_(payload){
  const started=Date.now(),root=root_(payload.root),query=normalize_(payload.query),birth=normalizeBirth_(payload.birth);
  if(query.length<3)throw new Error('Informe ao menos 3 caracteres do nome.');
  const index=studentIndex_(root,Boolean(payload.forceRefresh));const words=query.split(/\s+/),terms=words.filter(w=>w.length>=3&&!/^(DAS|DOS|DEL|DELLA)$/.test(w)).sort((a,b)=>b.length-a.length).slice(0,3);
  const max=Math.max(1,Math.min(200,Number(payload.maxResults)||100));
  const records=index.records.filter(r=>words.length===1?normalize_(r.name).includes(query):terms.some(t=>normalize_(r.name).includes(t)));
  records.sort((a,b)=>Number(normalize_(b.name)===query)-Number(normalize_(a.name)===query)||Number(Boolean(birth&&b.birth===birth))-Number(Boolean(birth&&a.birth===birth))||a.name.localeCompare(b.name,'pt-BR')||a.sheet.localeCompare(b.sheet,'pt-BR',{numeric:true})||a.row-b.row);
  return {ok:true,root,query:payload.query,results:records.slice(0,max),total:records.length,truncated:records.length>max,indexVersion:index.version,elapsedMs:Date.now()-started};
}
function getStudentIndexAction_(payload){
  const root=root_(payload.root);const offset=Number(payload.offset||0);
  if(!Number.isInteger(offset)||offset<0)throw new Error('Página de índice inválida.');

  if(offset===0&&!payload.forceRefresh){
    const ready=cachedIndex_(root);
    if(ready)return {ok:true,root,epoch:ready.epoch,version:ready.version,createdAt:ready.createdAt,expiresAt:ready.expiresAt,total:ready.records.length,results:ready.records,nextOffset:null};
  }
  const epoch=indexEpoch_(root),sheets=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[root]).getSheets();
  const version=hash_(epoch+':'+sheets.map(s=>s.getSheetId()).join(','));
  if(offset&&payload.version!==version){const e=new Error('O índice mudou. Reinicie a sincronização.');e.code='INDEX_CHANGED';throw e;}
  const end=Math.min(offset+20,sheets.length);
  const results=readCachedSheets_(root,sheets.slice(offset,end),Boolean(payload.forceRefresh));
  if(indexEpoch_(root)!==epoch)throw busy_();
  const createdAt=offset?Number(payload.createdAt):Date.now();
  if(!Number.isFinite(createdAt)||createdAt>Date.now()||Date.now()-createdAt>INDEX_TTL_SECONDS*1000)throw new Error('Sincronização expirada. Reinicie.');

  return {ok:true,root,epoch,version,createdAt,expiresAt:createdAt+INDEX_TTL_SECONDS*1000,total:null,totalSheets:sheets.length,results,nextOffset:end<sheets.length?end:null};
}

// Incremental reads replace whole changed sheets, preserving row moves and removals.
function getStudentChangesAction_(payload){
  const root=root_(payload.root),epoch=indexEpoch_(root),since=String(payload.epoch||'');
  if(since===epoch)return {ok:true,epoch,sheets:[]};
  let events=[];try{events=JSON.parse(PropertiesService.getScriptProperties().getProperty('ad:changes:'+root)||'[]');}catch(_){}
  const start=events.findIndex(e=>e.from===since);
  if(start<0)return {ok:true,reset:true,epoch};
  const changes=events.slice(start);let cursor=since;
  for(const event of changes){if(event.from!==cursor||!event.sheetId)return {ok:true,reset:true,epoch};cursor=event.to;}
  const ids=[...new Set(changes.map(e=>e.sheetId))];
  if(cursor!==epoch||ids.length>8)return {ok:true,reset:true,epoch};
  const all=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[root]).getSheets();
  const sheets=ids.map(id=>{const sheet=all.find(s=>s.getSheetId()===id);return {sheetId:id,records:sheet?readSheetRecords_(sheet,root):[]};});
  if(indexEpoch_(root)!==epoch)throw busy_();
  return {ok:true,epoch,sheets};
}

function validateStudent_(value){
  const s=value||{},root=root_(s.root),name=String(s.name||'').trim();if(!name)throw new Error('Nome do aluno não informado.');
  return {root,name,code:String(s.code||'').trim(),birth:normalizeBirth_(s.birth),physicalSheet:String(s.physicalSheet||'').trim(),physicalRow:Number(s.physicalRow||0),existingFolderUrl:String(s.existingFolderUrl||'').trim()};
}
function resolveStudentRow_(sheet,student,columns){
  if(!columns.headerRow||!columns.nameCol)throw new Error('Cabeçalho da aba não identificado. Nenhuma célula foi alterada.');
  const count=sheet.getLastRow()-columns.headerRow;if(count<=0)throw new Error('Aba sem alunos.');
  const values=sheet.getRange(columns.headerRow+1,1,count,Math.max(columns.nameCol,columns.birthCol)).getDisplayValues();
  const matches=[];
  for(let i=0;i<values.length;i++){
    if(normalize_(values[i][columns.nameCol-1])!==normalize_(student.name))continue;
    if(student.birth&&(!columns.birthCol||normalizeBirth_(values[i][columns.birthCol-1])!==student.birth))continue;
    matches.push(i+columns.headerRow+1);
  }
  if(matches.length!==1)throw new Error(matches.length?'Há homônimos nesta aba; confirme os dados do aluno.':'O aluno não corresponde à aba/data informada. Pesquise novamente.');
  return matches[0];
}
function studentFolderName_(s){return sanitizeFileName_(s.name).replace(/_/g,' ').trim()+' - '+(s.birth?s.birth.replace(/\//g,'-'):'SEM-DATA');}
function folderFromUrl_(url){const m=String(url||'').match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/);if(!m)return null;try{return DriveApp.getFolderById(m[1]);}catch(_){return null;}}
function assertFolderIsArchiveChild_(folder,root){const parents=folder.getParents();while(parents.hasNext()){if(parents.next().getId()===CONFIG.ROOT_FOLDERS[root])return;}throw new Error('A pasta não pertence ao arquivo selecionado.');}
function folderByName_(student){const matches=DriveApp.getFolderById(CONFIG.ROOT_FOLDERS[student.root]).getFoldersByName(studentFolderName_(student));if(!matches.hasNext())return null;const folder=matches.next();if(matches.hasNext())throw new Error('Há pastas duplicadas para este aluno. Confira o vínculo na planilha.');return folder;}
function locationForStudent_(student){
  if(!student.physicalSheet)throw new Error('Selecione um aluno cadastrado na planilha antes de enviar documentos.');
  const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[student.root]).getSheetByName(student.physicalSheet);if(!sheet)throw new Error('Aba do aluno não encontrada.');
  const columns=detectColumnsForSearch_(sheet),row=resolveStudentRow_(sheet,student,columns);
  let folder=null;
  if(columns.folderCol){const cell=sheet.getRange(row,columns.folderCol);folder=folderFromUrl_(extractFolderUrl_(cell.getRichTextValue(),cell.getFormula(),cell.getDisplayValue()));}
  if(folder)assertFolderIsArchiveChild_(folder,student.root);
  return {sheet,columns,row,folder};
}
function ensureStudentFolderAction_(payload){
  const student=validateStudent_(payload.student);
  // Only preparation/linking is serialized. File bytes are handled under per-folder leases.
  return withScriptLock_(()=>{
    const loc=locationForStudent_(student);
    return prepareStudentFolder_(student,loc);
  });
}
function prepareStudentFolder_(student,loc){
    const folder=loc.folder||folderByName_(student)||DriveApp.getFolderById(CONFIG.ROOT_FOLDERS[student.root]).createFolder(studentFolderName_(student));
    let folderCol=loc.columns.folderCol;
    if(!loc.folder||loc.folder.getId()!==folder.getId()){
      if(!folderCol){folderCol=loc.sheet.getLastColumn()+1;if(folderCol>loc.sheet.getMaxColumns())loc.sheet.insertColumnsAfter(loc.sheet.getMaxColumns(),folderCol-loc.sheet.getMaxColumns());loc.sheet.getRange(loc.columns.headerRow,folderCol).setValue(CONFIG.LINK_HEADER);}
      loc.sheet.getRange(loc.row,folderCol).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(CONFIG.LINK_TEXT).setLinkUrl(folder.getUrl()).build());
      SpreadsheetApp.flush();invalidateIndex_(student.root,loc.sheet.getSheetId());
    }
    return {ok:true,folderId:folder.getId(),folderUrl:folder.getUrl(),folderName:folder.getName(),physicalRow:loc.row,folderCol,warning:''};
}
function findStudentFolder_(student){const loc=locationForStudent_(student);return loc&&loc.folder||folderByName_(student);}
function documentInfo_(file,type){return {id:file.getId(),name:file.getName(),type:type||inferTypeFromFilename_(file.getName()),url:file.getUrl(),previewUrl:'https://drive.google.com/file/d/'+file.getId()+'/preview',size:file.getSize()};}
function uploadDocumentAction_(payload){
  const student=validateStudent_(payload.student),folderId=String(payload.folderId||'').trim();if(!folderId)throw new Error('Pasta não informada.');
  const folder=DriveApp.getFolderById(folderId);assertFolderIsArchiveChild_(folder,student.root);
  const expected=findStudentFolder_(student);if(!expected||expected.getId()!==folderId)throw new Error('A pasta não corresponde ao aluno atual. Pesquise novamente.');
  const doc=payload.document||{},base64=String(doc.base64||'').replace(/^data:[^;]+;base64,/,'');
  if(!base64||base64.length>CONFIG.MAX_BASE64_CHARS)throw new Error('Arquivo vazio ou acima do limite do serviço.');
  if(doc.mimeType&&doc.mimeType!=='application/pdf')throw new Error('Somente PDF é permitido.');
  const bytes=Utilities.base64Decode(base64);if(bytes.length<5||String.fromCharCode.apply(null,bytes.slice(0,5))!=='%PDF-')throw new Error('Conteúdo PDF inválido.');
  const digest=hash_(bytes);if(doc.sha256&&doc.sha256!==digest)throw new Error('A integridade do arquivo não confere.');
  const requested=sanitizeFileName_(doc.filename||'documento.pdf');
  const filename=requested.replace(/\.pdf$/i,'')+' ['+digest.slice(0,16)+'].pdf';
  return withFolderLease_(folderId,()=>{
    const existing=folder.getFilesByName(filename);
    while(existing.hasNext()){
      const file=existing.next();if(file.isTrashed())continue;
      if(hash_(file.getBlob().getBytes())===digest)return {ok:true,duplicate:true,message:'Documento já recebido; nenhum arquivo duplicado.',document:documentInfo_(file,doc.docName)};
      throw new Error('Conflito de identificação de arquivo. Nenhum documento foi substituído.');
    }
    const file=folder.createFile(Utilities.newBlob(bytes,'application/pdf',filename));
    try{file.setDescription(JSON.stringify({sistema:'Arquivo Digital',tipo:String(doc.docName||doc.docKey||''),sha256:digest,requestId:String(payload.requestId||''),criadoEm:new Date().toISOString()}));}catch(error){console.warn(error.message);}
    return {ok:true,message:'Documento recebido.',document:documentInfo_(file,doc.docName)};
  });
}
function listStudentDocumentsAction_(payload){
  const student=validateStudent_(payload.student),folder=findStudentFolder_(student);if(!folder)return {ok:true,documents:[],folderUrl:''};
  const documents=[],files=folder.getFiles();while(files.hasNext()){const file=files.next();if(file.isTrashed()||file.getMimeType()!=='application/pdf')continue;documents.push({...documentInfo_(file),createdAt:file.getDateCreated().toISOString(),updatedAt:file.getLastUpdated().toISOString()});}
  documents.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));return {ok:true,folderId:folder.getId(),folderUrl:folder.getUrl(),folderName:folder.getName(),documents};
}
function inferTypeFromFilename_(name){const text=normalize_(name);for(const [pattern,type] of [[/HISTOR/,'Histórico Escolar'],[/FICHA INDIVIDUAL/,'Ficha Individual'],[/MATRIC/,'Ficha de Matrícula'],[/ATESTADO/,'Atestado Médico'],[/CERTIFIC|DIPLOMA/,'Certificado / Diploma'],[/SUS/,'Cartão SUS'],[/PAED/,'Documentos PAEDE'],[/TERMO/,'Termo de Compromisso']])if(pattern.test(text))return type;return 'Documento';}

function studentInitial_(name){const letter=normalize_(name).charAt(0);if(!/^[A-Z]$/.test(letter))throw new Error('O nome deve começar com uma letra de A a Z.');return letter;}
function boxParts_(name){const m=normalize_(name).match(/^([A-Z])(\d+)$/);return m?{letter:m[1],number:Number(m[2])}:null;}
function nextBoxName_(sheets,letter){return letter+(Math.max(0,...sheets.map(s=>boxParts_(s.getName())).filter(p=>p&&p.letter===letter).map(p=>p.number))+1);}
function listBoxesAction_(payload){
  const root=root_(payload.root),letter=studentInitial_(payload.name),ss=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[root]),sheets=ss.getSheets();
  const boxes=sheets.filter(s=>{const p=boxParts_(s.getName());return p&&p.letter===letter;}).map(sheet=>{
    const schema=detectColumnsForSearch_(sheet);
    return {name:sheet.getName(),sheetId:sheet.getSheetId(),count:readSheetRecords_(sheet,root).length,writable:Boolean(schema.headerRow&&schema.nameCol&&schema.birthCol)};
  }).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true}));
  return {ok:true,root,letter,boxes,nextBox:nextBoxName_(sheets,letter)};
}
function registeredRecord_(student,loc){return {root:student.root,sheetId:loc.sheet.getSheetId(),sheet:loc.sheet.getName(),row:loc.row,name:student.name,birth:student.birth,folderUrl:loc.folder?loc.folder.getUrl():'',nameCol:loc.columns.nameCol,birthCol:loc.columns.birthCol,folderCol:loc.columns.folderCol};}
function verifyStudentAction_(payload){
  const student=validateStudent_(payload.student),loc=locationForStudent_(student);
  return {ok:true,student:registeredRecord_(student,loc)};
}
function validateRegistration_(value){
  const student=validateStudent_(value);student.name=student.name.replace(/\s+/g,' ').trim();studentInitial_(student.name);
  if(student.name.length<3||student.name.length>150)throw new Error('Informe o nome completo do aluno.');
  const m=student.birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)throw new Error('Informe a data de nascimento completa.');
  const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]),date=new Date(year,month-1,day);
  if(year<1900||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date>Date.now())throw new Error('Data de nascimento inválida.');
  return student;
}
function registrationMatches_(ss,student){
  // Fresh rows, under the same lock as insertion. Do not rely on a cached index here.
  const letter=studentInitial_(student.name),matches=[];
  for(const sheet of ss.getSheets()){
    const parts=boxParts_(sheet.getName());if(normalize_(sheet.getName())==='INICIO'||(parts&&parts.letter!==letter))continue;
    for(const row of readSheetRecords_(sheet,student.root)){
      if(normalize_(row.name)!==normalize_(student.name))continue;
      if(!row.birth)throw new Error('Já existe aluno com este nome sem nascimento. Confira o cadastro existente antes de inserir.');
      if(row.birth===student.birth)matches.push(row);
    }
  }
  return matches;
}
function archiveBoxInsertionIndex_(sheets,name){
  const target=boxParts_(name);
  if(!target)throw new Error('Nome de caixa inválido.');
  const compare=(a,b)=>a.letter.localeCompare(b.letter)||a.number-b.number;
  const boxes=sheets.map((sheet,index)=>({parts:boxParts_(sheet.getName()),index})).filter(box=>box.parts).sort((a,b)=>compare(a.parts,b.parts));
  // Inserir depois da caixa anterior sem mover as abas que já existem.
  const previous=boxes.filter(box=>compare(box.parts,target)<0).pop();
  if(previous)return previous.index+1;
  const next=boxes.find(box=>compare(box.parts,target)>0);
  return next?next.index:sheets.length;
}
function createArchiveBox_(ss,root,name){
  const sheet=ss.insertSheet(name,archiveBoxInsertionIndex_(ss.getSheets(),name));
  sheet.getRange(1,1,1,5).merge().setValue('CAIXA '+name+' — '+(root==='PERMANENTE'?'ARQUIVO PERMANENTE':'FORMANDOS'));
  sheet.getRange(2,1,1,5).setValues([['Nº','Nome','Data de nascimento','Pasta Digital','Observações']]);
  sheet.getRange(1,1,2,5).setFontWeight('bold').setFontFamily('Arial').setFontColor('#ffffff').setBackground('#1f3352').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeights(1,2,34);sheet.setFrozenRows(2);sheet.setColumnWidth(1,55);sheet.setColumnWidth(2,350);sheet.setColumnWidth(3,155);sheet.setColumnWidth(4,150);sheet.setColumnWidth(5,230);
  return sheet;
}
function registerStudentAction_(payload){
  const student=validateRegistration_(payload.student),letter=studentInitial_(student.name);
  return withScriptLock_(()=>{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEETS[student.root]),matches=registrationMatches_(ss,student);
    if(matches.length>1)throw new Error('Há cadastros duplicados deste aluno. Confira as caixas antes de enviar.');
    let sheet,duplicate=matches.length===1;
    if(duplicate){student.physicalSheet=matches[0].sheet;student.name=matches[0].name;}
    else{
      const desired=String(payload.sheet||'').trim(),parts=boxParts_(desired);
      if(!parts||parts.letter!==letter)throw new Error('Escolha uma caixa da letra '+letter+'.');
      if(payload.createBox===true){
        if(desired!==nextBoxName_(ss.getSheets(),letter))throw new Error('A lista de caixas mudou. Atualize e escolha a nova caixa novamente.');
        sheet=createArchiveBox_(ss,student.root,desired);
      }else sheet=ss.getSheetByName(desired);
      if(!sheet)throw new Error('Caixa não encontrada.');
      const columns=detectColumnsForSearch_(sheet);
      if(!columns.headerRow||!columns.nameCol||!columns.birthCol)throw new Error('Cabeçalho da caixa não identificado. Nenhum aluno foi inserido.');
      const row=sheet.getLastRow()+1,width=Math.max(sheet.getLastColumn(),columns.nameCol,columns.birthCol);
      if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
      const values=Array(width).fill('');values[columns.nameCol-1]=student.name;values[columns.birthCol-1]=student.birth;
      const firstHeader=normalize_(sheet.getRange(columns.headerRow,1).getDisplayValue());
      if(/^(N[º°O.]?|NUMERO)$/.test(firstHeader)&&columns.nameCol!==1){
        const numbers=sheet.getRange(columns.headerRow+1,1,Math.max(1,row-columns.headerRow-1),1).getDisplayValues().map(r=>Number(r[0])).filter(Number.isFinite);
        values[0]=Math.max(0,...numbers)+1;
      }
      sheet.getRange(row,columns.birthCol).setNumberFormat('@');
      sheet.getRange(row,1,1,width).setValues([values]);SpreadsheetApp.flush();
      invalidateIndex_(student.root,sheet.getSheetId());student.physicalSheet=sheet.getName();
    }
    const loc=locationForStudent_(student);let warning='';
    try{prepareStudentFolder_(student,loc);}catch(error){warning='Aluno cadastrado; a pasta será preparada ao reenviar: '+error.message;}
    const finalLoc=locationForStudent_(student);
    return {ok:true,duplicate,student:registeredRecord_(student,finalLoc),warning};
  });
}

/** Manual read-only smoke check: reports only counts and timings, never names or keys. */
function diagnosticarAtualizacaoIncremental() {
  for(const root of ['PERMANENTE','FORMANDOS']){
    const epoch=indexEpoch_(root),started=Date.now(),result=getStudentChangesAction_({root,epoch});
    if(!result.ok||result.reset||result.sheets.length)throw new Error('Falha na verificação incremental.');
    console.log(JSON.stringify({version:BACKEND_VERSION,root,unchanged:true,sheetsRead:0,elapsedMs:Date.now()-started}));
  }
}

function diagnosticarCadastroArquivoDigital() {
  for(const root of ['PERMANENTE','FORMANDOS']){
    const started=Date.now(),result=listBoxesAction_({root,name:'Z'});
    if(result.boxes.some(box=>!box.writable||!box.name.startsWith('Z')))throw new Error('Cabeçalho ou filtro de caixa inválido.');
    console.log(JSON.stringify({version:BACKEND_VERSION,root,letter:result.letter,boxes:result.boxes.length,nextBox:result.nextBox,elapsedMs:Date.now()-started}));
  }
}

function diagnosticarArquivoDigital() {
  for (const root of ['PERMANENTE','FORMANDOS']) {
    const started=Date.now();const first=studentIndex_(root,true,true);const readMs=Date.now()-started;
    const cachedAt=Date.now();const second=studentIndex_(root,false);
    if(first.version!==second.version)throw new Error('O índice de '+root+' não foi recuperado integralmente do cache.');
    console.log(JSON.stringify({version:BACKEND_VERSION,root,students:first.records.length,initialReadMs:readMs,cachedReadMs:Date.now()-cachedAt,cacheVerified:true}));
  }
}

function diagnosticarCacheArquivoDigital() {
  const sample=JSON.stringify({ok:true,teste:'acentuação'});
  const packed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(sample,'application/json')).getBytes());
  const restored=Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(packed),'application/x-gzip')).getDataAsString();
  if(restored!==sample)throw new Error('Falha na compressão.');
  const started=Date.now();const existing=cachedIndex_('PERMANENTE');
  console.log(JSON.stringify({gzipVerified:true,existingIndex:!!existing,records:existing?existing.records.length:0,readMs:Date.now()-started}));
  for(const root of ['PERMANENTE','FORMANDOS']){
    const at=Date.now();const page=getStudentIndexAction_({root,offset:0});
    const cachedAt=Date.now();const again=getStudentIndexAction_({root,offset:0});
    console.log(JSON.stringify({root,totalSheets:page.totalSheets,firstPageRecords:page.results.length,firstPageMs:cachedAt-at,cachedPageMs:Date.now()-cachedAt,stable:page.version===again.version}));
  }
}
