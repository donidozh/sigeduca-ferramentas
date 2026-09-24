const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, 'ged/arquivo-digital-aluno.user.js'), 'utf8');

function fixture(respond = () => ({ ok: true, results: [] }), overrides={}) {
  const values = new Map([['adig01:driveEndpoint','https://script.google.com/macros/s/test-only/exec'],['adig01:driveToken','test-only']]);
  let calls = 0;
  const window = { addEventListener(){},dispatchEvent(){} }; window.top=window.self=window;
  const context = { window, document:{title:'Test'},location:{pathname:'/',hash:''},queueMicrotask(){},setTimeout(){},clearTimeout(){},console,TextEncoder,crypto:webcrypto,performance,URL,CustomEvent:class{},CSS:{escape:x=>x},GM_getValue:(k,d)=>values.has(k)?values.get(k):d,GM_setValue:(k,v)=>values.set(k,v),GM_xmlhttpRequest: opts=>{calls++; Promise.resolve(respond(JSON.parse(opts.data))).then(data=>opts.onload({status:200,responseText:JSON.stringify(data)}));} };
  Object.assign(context,overrides);
  const exposed = source.replace(/\}\)\(\);\s*$/, `globalThis.testing={syncStudentIndex,loadConsultDocuments,selectWorkspaceTab,cacheRegisteredStudent,refreshStudentIndex,downloadStudentIndex,queueIndexRefresh,hasRegisteredSelection,duplicatePageModel,makeDocumentOptions,detectDocumentTitle,normalizeDriveEndpoint,driveHttpError,gmPostJson,parseDriveResponse,createRequestId,sha256Hex,fileSha256,classifyText,normalizeLoose,isDestinationDone,summarizeDestinations,cachedStudentSearch,searchCacheKey,clearSearchCache,pageNeedsReview,state,el,acceptAiSuggestions,rememberEdit,SEARCH_CACHE_TTL,refreshSelectedStudent,documentOcrSuggestion,formatBirthDigits,isValidBirth,refreshSearchControls};})();`);
  vm.runInNewContext(exposed,context);
  return {...context.testing,values,calls:()=>calls};
}

test('classificação: palavras curtas não correspondem a trechos de outras palavras',()=>{
 const t=fixture(); const r=t.classifyText('documento de organização de arquivos para a secretaria escolar');
 assert.ok(!r.hits.includes('rg'));
});
test('classificação: normalização não conta duas vezes a mesma expressão',()=>{
 const t=fixture(); const r=t.classifyText('CERTIDÃO DE NASCIMENTO registro civil nascimento');
 assert.equal(new Set(r.hits.map(t.normalizeLoose)).size,r.hits.length);
 assert.equal(r.key,'ged_certidao');
});
test('classificação: histórico reconhecido e pouco texto encaminhado para revisão',()=>{
 const t=fixture();assert.equal(t.classifyText('HISTÓRICO ESCOLAR estudos realizados carga horária').key,'ged_historico');
 assert.equal(t.pageNeedsReview({manual:false,aiSuggestion:t.classifyText('123')}),true);
 assert.equal(t.pageNeedsReview({manual:true}),false);
});
test('resumo separa sucesso, já cadastrado, falha e resposta desconhecida',()=>{
 const t=fixture();const r=t.summarizeDestinations([{gedId:1,statusGed:'✓ GED',statusDrive:'? Drive'},{gedId:2,statusGed:'↷ Já cadastrado',statusDrive:'✗ Drive'},{gedId:null,statusDrive:'✓ Drive'}],{useGed:true,useDrive:true});
 assert.equal(r.sent,2);assert.equal(r.existing,1);assert.equal(r.failed,1);assert.equal(r.pending,1);
 assert.equal(t.isDestinationDone('? Drive'),false);
});
test('cache evita nova chamada, força atualização e separa arquivo/data/credencial',async()=>{
 const t=fixture();const q={action:'searchStudents',root:'PERMANENTE',query:'José',birth:'',maxResults:150};
 await t.cachedStudentSearch(q);const cached=await t.cachedStudentSearch({...q,query:'JOSE'});
 assert.equal(t.calls(),1);assert.equal(cached.fromCache,true);
 await t.cachedStudentSearch(q,true);assert.equal(t.calls(),2);
 await t.cachedStudentSearch({...q,root:'FORMANDOS'});assert.equal(t.calls(),3);
 await t.cachedStudentSearch({...q,birth:'01/01/2000'});assert.equal(t.calls(),4);
 t.values.set('adig01:driveToken','another-user');await t.cachedStudentSearch(q);assert.equal(t.calls(),5);
 await t.clearSearchCache();await t.cachedStudentSearch(q);assert.equal(t.calls(),6);
});
test('cache expirado e erros não viram resultados válidos',async()=>{
 const t=fixture(()=>({ok:false,error:'temporário'}));const q={root:'PERMANENTE',query:'Teste',birth:'',maxResults:150};
 await t.cachedStudentSearch(q);await t.cachedStudentSearch(q);assert.equal(t.calls(),2);
 const key=await t.searchCacheKey();t.values.set(key,[{key:JSON.stringify(['PERMANENTE','TESTE','',150]),time:Date.now()-t.SEARCH_CACHE_TTL-1,data:{ok:true,results:[]}}]);
 await t.cachedStudentSearch(q);assert.equal(t.calls(),3);
});
test('consultas simultâneas idênticas compartilham uma chamada',async()=>{
 let resolve;const t=fixture(()=>new Promise(r=>resolve=r));const q={root:'PERMANENTE',query:'Maria',maxResults:150};
 const first=t.cachedStudentSearch(q),second=t.cachedStudentSearch(q);
 while(!resolve)await new Promise(r=>setImmediate(r));resolve({ok:true,results:[]});
 await Promise.all([first,second]);assert.equal(t.calls(),1);
});
test('atualização de localização recusa homônimos sem escrever no Drive',async()=>{
 const t=fixture(()=>({ok:false,error:'Há homônimos nesta aba.'}));
 t.state.selectedStudentMatch={name:'MARIA SILVA',root:'PERMANENTE',sheet:'M1',row:3};
 t.el.studentName={value:'MARIA SILVA'};t.el.studentBirth={value:''};t.el.archiveRoot={value:'PERMANENTE'};
 await assert.rejects(t.refreshSelectedStudent(),/homônimos/);
 assert.equal(t.calls(),1);
});
test('índice local continua pesquisável após expirar o prazo de conferência',async()=>{
 const t=fixture();const key=await t.searchCacheKey();
 t.values.set(key+':index:PERMANENTE',{expiresAt:Date.now()+10000,createdAt:Date.now(),records:[{name:'MARIA SILVA'},{name:'JOSE TESTE'}]});
 const q={root:'PERMANENTE',query:'Maria',birth:'',maxResults:150};
 const response=await t.cachedStudentSearch(q);assert.equal(t.calls(),0);assert.equal(JSON.parse(response.responseText).results[0].name,'MARIA SILVA');
 t.values.get(key+':index:PERMANENTE').expiresAt=Date.now()-1;await t.cachedStudentSearch(q);assert.equal(t.calls(),0);
});
test('PDF único corresponde a um download mesmo agrupando vários tipos',()=>{
 const t=fixture();const summary=t.summarizeDestinations([{statusLocal:'✓ Download solicitado'},{statusLocal:'✓ Download solicitado'}],{useLocal:true});assert.equal(summary.downloads,1);
});
test('data recebe máscara e valida dias, ano bissexto e data incompleta',()=>{
 const t=fixture();assert.equal(t.formatBirthDigits('25032010'),'25/03/2010');assert.equal(t.formatBirthDigits('a25/b03/2010xyz'),'25/03/2010');
 assert.equal(t.isValidBirth('31/02/2010'),false);assert.equal(t.isValidBirth('29/02/2024'),true);assert.equal(t.isValidBirth('29/02/2023'),false);assert.equal(t.isValidBirth('25/03/20'),false);
});
test('consulta e sincronização bloqueiam arquivo e identidade até terminar',()=>{
 const t=fixture();for(const name of ['archiveRoot','studentName','studentBirth','studentCode','searchStudentBtn'])t.el[name]={disabled:false};
 for(const flag of ['searchBusy','syncingIndex','processing']){
  t.state[flag]=true;t.refreshSearchControls();assert.ok(Object.values(t.el).every(control=>control.disabled));
  t.state[flag]=false;t.refreshSearchControls();assert.ok(Object.values(t.el).every(control=>!control.disabled));
 }
});
test('OCR exige revisão de palavras-chave sem título ou estrutura inequívoca',()=>{
 const t=fixture();const result=t.documentOcrSuggestion({key:'ged_historico',confidence:.99,hits:[]},'disciplinas notas');
 assert.equal(result.autoApply,false);assert.equal(result.engine,'ocr');
 assert.equal(t.documentOcrSuggestion(t.classifyText('HISTÓRICO ESCOLAR'),'HISTÓRICO ESCOLAR').autoApply,true);
});

test('campos característicos reconhecem documentos sem depender do título',()=>{
 const t=fixture();
 const samples=[
  ['ged_certidao','Registro civil das pessoas naturais. Nome. Nascimento. Filiação. Avós. Oficial registrador.'],
  ['ged_vacina','BCG Hepatite B Pentavalente Poliomielite. Dose data lote assinatura do vacinador.'],
  ['ged_sangue','Laboratório. Material sangue total. ABO resultado O. Rh positivo.'],
  ['ged_energia','Unidade consumidora. Consumo 182 kWh. Vencimento da fatura.'],
  ['ged_oftalmo','Acuidade visual. Olho direito 20/20. Olho esquerdo 20/20.'],
  ['arquivo_cartao_sus','Sistema Único de Saúde. CNS 700 0000 0000 0000. Nome.']
 ];
 for(const [key,text] of samples){const rule=t.classifyText(text);assert.equal(rule.key,key);assert.equal(t.documentOcrSuggestion(rule,text).autoApply,true);}
 const mixed=t.classifyText(samples[1][1]+' '+samples[2][1]);assert.equal(mixed.multipleDocuments,true);assert.equal(t.documentOcrSuggestion(mixed,'').autoApply,false);
 assert.notEqual(t.classifyText('Responsável. Nome do aluno. Data de nascimento. Telefone.').structureMatch,true);
 const personal=t.documentOcrSuggestion({key:'ged_rgcpf',confidence:.99},'Registro geral do cidadão com CPF e data de nascimento');assert.equal(personal.autoApply,false);assert.match(personal.reason,/responsável/);
});

const httpCrypto={getRandomValues:array=>webcrypto.getRandomValues(array)};
test('HTTP: IDs válidos e únicos sem randomUUID',()=>{
 const t=fixture(undefined,{crypto:httpCrypto});const ids=Array.from({length:1000},()=>t.createRequestId());
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
});
test('HTTP: SHA-256 sem subtle coincide com implementação nativa, inclusive limites de blocos',async()=>{
 const t=fixture(undefined,{crypto:httpCrypto});
 for(const input of [Buffer.from(''),Buffer.from('abc'),Buffer.from('Certidão — João'),...Array.from([55,56,63,64,65,127,128,1000000],n=>Buffer.alloc(n,97))]){
  assert.equal(await t.sha256Hex(input),createHash('sha256').update(input).digest('hex'));
 }
 const data=Buffer.from('%PDF-1.7 teste de arquivo');
 assert.equal(await t.fileSha256({arrayBuffer:async()=>Uint8Array.from(data).buffer}),createHash('sha256').update(data).digest('hex'));
});
test('HTTP: consulta e índice reutilizam o mesmo cache sem depender de digest',async()=>{
 const t=fixture(undefined,{crypto:httpCrypto}),secure=fixture();
 assert.equal(await t.searchCacheKey(),await secure.searchCacheKey());
 const query={root:'PERMANENTE',query:'Maria',maxResults:150};
 await t.cachedStudentSearch(query);await t.cachedStudentSearch(query);assert.equal(t.calls(),1);
 const key=await t.searchCacheKey();
 t.values.set(key+':index:FORMANDOS',{createdAt:Date.now(),expiresAt:Date.now()+10000,records:[{name:'JOSE TESTE'}]});
 const response=await t.cachedStudentSearch({root:'FORMANDOS',query:'Jose',maxResults:150});
 assert.equal(JSON.parse(response.responseText).results[0].name,'JOSE TESTE');assert.equal(t.calls(),1);
});
test('falhas do Drive não exibem HTML e a requisição dispensa cookies Google',async()=>{
 let request;const t=fixture(undefined,{GM_xmlhttpRequest:opts=>{request=opts;opts.onload({status:404,responseText:'<!DOCTYPE html><script>enorme</script>'.repeat(500)});}});
 await assert.rejects(t.gmPostJson('https://script.google.com/macros/s/test/exec',{action:'ping',token:'test'}),error=>error.message.includes('404')&&error.message.length<200&&!error.message.includes('<'));
 assert.equal(request.anonymous,true);assert.equal(JSON.parse(request.data).token,'test');
 assert.throws(()=>t.parseDriveResponse({responseText:'<html>erro</html>'}),error=>!error.message.includes('<html>'));
 assert.equal(t.normalizeDriveEndpoint('https://script.google.com/macros/u/1/s/test/exec?authuser=1'),'https://script.google.com/macros/s/test/exec');
 assert.throws(()=>t.normalizeDriveEndpoint('https://script.google.com/home/projects/test/edit'),/exec/);
});
test('seleção exige caixa e identidade atual, sem aceitar só nome digitado',()=>{
 const t=fixture();t.el.studentName={value:'ALUNO TESTE'};t.el.studentBirth={value:'01/01/2000'};t.el.archiveRoot={value:'PERMANENTE'};
 assert.equal(t.hasRegisteredSelection(),false);
 t.state.selectedStudentMatch={name:'ALUNO TESTE',birth:'01/01/2000',root:'PERMANENTE',sheet:'A1',row:3};assert.equal(t.hasRegisteredSelection(),true);
 t.el.archiveRoot.value='FORMANDOS';assert.equal(t.hasRegisteredSelection(),false);t.el.archiveRoot.value='PERMANENTE';t.el.studentName.value='OUTRO ALUNO';assert.equal(t.hasRegisteredSelection(),false);
});
test('duplicação mantém origem e rotação, com identidade e classificação independentes',()=>{
 const t=fixture();t.state.pageModels=[{id:'first',originalPage:2,rotation:90,docKey:'ged_rgcpf',manual:true}];
 const copy=t.duplicatePageModel('first');assert.equal(copy.originalPage,2);assert.equal(copy.rotation,90);assert.notEqual(copy.id,'first');assert.equal(copy.docKey,'ignore');
 copy.docKey='ged_responsavel';copy.rotation=180;assert.equal(t.state.pageModels[0].docKey,'ged_rgcpf');assert.equal(t.state.pageModels[0].rotation,90);
});
test('lista única apresenta nomes específicos e mantém os códigos dos documentos',()=>{
 const html=fixture().makeDocumentOptions('ged_vacina');assert.ok(!html.includes('optgroup'));
 for(const name of ['RG/CPF Responsável','RG/CPF Aluno','Cartão de Vacina','Certidão de Nascimento','Tipo Sanguíneo'])assert.ok(html.includes(name));assert.match(html,/value="ged_vacina"[^>]*selected/);
});
test('OCR reconhece títulos curtos e folha com dois tipos exige revisão',()=>{
 const t=fixture();for(const [text,key] of [['CERTIDÃO DE NASCIMENTO','ged_certidao'],['CARTÃO DE VACINA','ged_vacina'],['TIPAGEM SANGUÍNEA','ged_sangue'],['HISTÓRICO ESCOLAR','ged_historico']]){
  const result=t.documentOcrSuggestion(t.classifyText(text),text);assert.equal(result.key,key);assert.equal(result.autoApply,true);
 }
 const both='CERTIDÃO DE NASCIMENTO e CARTÃO DE VACINA';const result=t.documentOcrSuggestion(t.classifyText(both),both);assert.equal(result.autoApply,false);assert.match(result.reason,/duplique/);
});

test('novos tipos: declaração vacinal é distinta de cartão e NIS avulso exige revisão',()=>{
 const t=fixture();const html=t.makeDocumentOptions();
 for(const name of ['NIS/CadÚnico','Declaração Vacinal','Atestados Médicos'])assert.ok(html.includes(name));
 for(const [text,key] of [['COMPROVANTE DO CADASTRO ÚNICO','arquivo_nis'],['DECLARAÇÃO VACINAL','arquivo_declaracao_vacinal'],['Declaração de situação vacinal BCG Hepatite Pentavalente dose lote','arquivo_declaracao_vacinal'],['ATESTADOS MÉDICOS','arquivo_atestado_medico'],['ATESTADO MÉDICO','arquivo_atestado_medico'],['CARTÃO DE VACINA','ged_vacina']]){
  const r=t.documentOcrSuggestion(t.classifyText(text),text);assert.equal(r.key,key);assert.equal(r.autoApply,true);
 }
 const text='Nome do aluno. NIS 12345678901';assert.equal(t.documentOcrSuggestion(t.classifyText(text),text).autoApply,false);
 assert.ok(!source.includes('huggingface'));assert.ok(!source.includes('classifyWithLocalAi'));
});

test('cadastro preserva índice, insere só o aluno e não avança o cursor de outros computadores',async()=>{
 const t=fixture(),key=await t.searchCacheKey(),id=key+':index:PERMANENTE';
 t.values.set(id,{createdAt:1,epoch:'old',records:[{sheet:'A1',row:3,name:'ANA'},{sheet:'B1',row:3,name:'BETO'}]});
 const student={root:'PERMANENTE',sheetId:1,sheet:'A1',row:4,name:'ALICE'};await t.cacheRegisteredStudent(student);await t.cacheRegisteredStudent(student);
 assert.equal(t.values.get(id).records.length,3);assert.equal(t.values.get(id).epoch,'old');assert.equal(t.calls(),0);
});

test('atualização incremental substitui só caixas alteradas, incluindo remoções',async()=>{
 const t=fixture(p=>{assert.equal(p.action,'getStudentChanges');assert.equal(p.epoch,'old');return {ok:true,epoch:'new',sheets:[{sheetId:1,records:[{sheetId:1,sheet:'A1',row:3,name:'ALICE'}]}]};});
 t.state.changesSupported=true;const key=await t.searchCacheKey(),id=key+':index:PERMANENTE';
 t.values.set(id,{createdAt:1,fullSyncedAt:Date.now(),epoch:'old',records:[{sheetId:1,name:'ANA'},{sheetId:2,name:'BETO'}]});
 const updated=await t.refreshStudentIndex('PERMANENTE');assert.deepEqual(Array.from(updated.records,r=>r.name),['BETO','ALICE']);assert.equal(updated.epoch,'new');assert.equal(t.calls(),1);
});

test('sem alterações não baixa planilhas; falha preserva cache anterior',async()=>{
 let fail=false;const t=fixture(()=>fail?{ok:false,error:'offline'}:{ok:true,epoch:'same',sheets:[]});t.state.changesSupported=true;
 const key=await t.searchCacheKey(),id=key+':index:PERMANENTE';t.values.set(id,{createdAt:1,epoch:'same',fullSyncedAt:Date.now(),records:[{name:'ANA',sheetId:1}]});
 await t.refreshStudentIndex('PERMANENTE');fail=true;await assert.rejects(t.refreshStudentIndex('PERMANENTE'),/offline/);assert.equal(t.values.get(id).records[0].name,'ANA');
 t.state.backendReady=new Promise(()=>{});const result=await t.cachedStudentSearch({root:'PERMANENTE',query:'ANA'});assert.equal(JSON.parse(result.responseText).results.length,1);
});

test('sincronização em andamento não sobrescreve cadastro recém incluído',async()=>{
 let release,started;const startedPromise=new Promise(r=>started=r);const t=fixture(()=>{started();return new Promise(r=>release=r);});t.state.changesSupported=true;
 const key=await t.searchCacheKey(),id=key+':index:PERMANENTE';t.values.set(id,{createdAt:1,epoch:'old',fullSyncedAt:Date.now(),records:[]});
 const pending=t.refreshStudentIndex('PERMANENTE');await startedPromise;await t.cacheRegisteredStudent({root:'PERMANENTE',sheet:'A1',row:3,name:'ANA'});
 release({ok:true,epoch:'new',sheets:[]});await assert.rejects(pending,/Cadastro atualizado/);assert.equal(t.values.get(id).records[0].name,'ANA');
});

test('conferência periódica completa é atômica e não reativa índice incompleto',async()=>{
 let page=0,fail=true;const t=fixture(p=>{assert.equal(p.action,'getStudentIndex');assert.equal(p.forceRefresh,true);page++;if(p.offset)return fail?{ok:false,error:'interrompida'}:{ok:true,version:'v',epoch:'new',results:[{name:'B'}],nextOffset:null,total:null,createdAt:Date.now(),expiresAt:Date.now()+900000};return {ok:true,version:'v',epoch:'new',results:[{name:'A'}],nextOffset:20,total:null,createdAt:Date.now(),expiresAt:Date.now()+900000};});t.state.changesSupported=true;t.el.archiveRoot={value:'PERMANENTE'};
 const key=await t.searchCacheKey(),id=key+':index:PERMANENTE';t.values.set(id,{createdAt:1,epoch:'old',fullSyncedAt:1,records:[{name:'OLD'}]});
 await assert.rejects(t.refreshStudentIndex('PERMANENTE'),/interrompida/);assert.equal(t.values.get(id).records[0].name,'OLD');
 fail=false;const updated=await t.refreshStudentIndex('PERMANENTE');assert.equal(updated.records.length,2);assert.equal(updated.epoch,'new');assert.equal(page,4);
});


test('reconstrução manual força leitura do arquivo escolhido nas configurações',async()=>{
 const requests=[];const t=fixture(p=>{requests.push(p);return p.action==='ping'?{ok:true,capabilities:['studentIndex']}:{ok:true,version:'new',epoch:'new',results:[{name:'NOVA'}],nextOffset:null,total:1,createdAt:Date.now(),expiresAt:Date.now()+900000};});
 t.el.archiveRoot={value:'PERMANENTE'};t.el.indexRoot={value:'FORMANDOS'};t.el.cacheStatus={};
 const id=(await t.searchCacheKey())+':index:FORMANDOS';t.values.set(id,{records:[{name:'ANTIGA'}],createdAt:1,fullSyncedAt:Date.now(),epoch:'old'});
 const button={textContent:'Reconstruir índice completo'};await t.syncStudentIndex(button);
 assert.equal(requests[1].root,'FORMANDOS');assert.equal(requests[1].forceRefresh,true);assert.equal(t.values.get(id).records[0].name,'NOVA');assert.equal(t.el.archiveRoot.value,'PERMANENTE');assert.equal(button.disabled,false);assert.equal(t.el.indexRoot.disabled,false);
});

test('consulta atrasada não mostra documentos nem altera a pasta de outra pessoa',async()=>{
 let release,started;const ready=new Promise(r=>started=r);const t=fixture(()=>{started();return new Promise(r=>release=r);});
 const first={name:'ANA',folderUrl:'https://drive.google.com/drive/folders/a',root:'PERMANENTE'};
 const next={name:'BEATRIZ',folderUrl:'https://drive.google.com/drive/folders/b',root:'PERMANENTE'};
 t.state.selectedStudentMatch=first;t.el.consultDocuments={innerHTML:'PASTA NOVA'};
 const pending=t.loadConsultDocuments();await ready;t.state.selectedStudentMatch=next;
 release({ok:true,folderUrl:first.folderUrl,documents:[{id:'old',name:'Documento da Ana'}]});await pending;
 assert.equal(next.folderUrl,'https://drive.google.com/drive/folders/b');assert.equal(t.el.consultDocuments.innerHTML,'PASTA NOVA');assert.equal(t.state.consultationDocuments.length,0);
});

test('trocar abas preserva páginas e seleção e mantém um único painel ativo',()=>{
 const t=fixture();t.el.workspaceTabs=Object.fromEntries(['consulta','incluir','internos','config','ajuda'].map(k=>[k,{button:{setAttribute(){}},panel:{}}]));t.el.workspaceIdentity={};t.el.workspaceSidebar={};
 const pages=[{id:'page',docKey:'ged_certidao'}],person={name:'ANA'};t.state.pageModels=pages;t.state.selectedStudentMatch=person;t.state.workspacePreloaded=true;
 for(const key of Object.keys(t.el.workspaceTabs)){assert.equal(t.selectWorkspaceTab(key),true);assert.equal(Object.values(t.el.workspaceTabs).filter(x=>!x.panel.hidden).length,1);assert.equal(t.state.pageModels,pages);assert.equal(t.state.selectedStudentMatch,person);}
 t.state.processing=true;assert.equal(t.selectWorkspaceTab('consulta'),false);assert.equal(t.state.workspaceTab,'ajuda');
});
