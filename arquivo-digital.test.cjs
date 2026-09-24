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
  const exposed = source.replace(/\}\)\(\);\s*$/, `globalThis.testing={configureLocalModelCache,normalizeDriveEndpoint,driveHttpError,gmPostJson,parseDriveResponse,createRequestId,sha256Hex,fileSha256,classifyWithLocalAi,classifyText,normalizeLoose,isDestinationDone,summarizeDestinations,cachedStudentSearch,searchCacheKey,clearSearchCache,pageNeedsReview,state,el,acceptAiSuggestions,rememberEdit,SEARCH_CACHE_TTL,refreshSelectedStudent,combineDocumentEvidence,formatBirthDigits,isValidBirth,refreshSearchControls};})();`);
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
 const t=fixture(()=>({ok:true,results:[{name:'MARIA SILVA',row:1},{name:'MARIA SILVA',row:2}]}));
 t.state.selectedStudentMatch={name:'MARIA SILVA',root:'PERMANENTE'};
 await assert.rejects(t.refreshSelectedStudent(),/homônimos/);
 assert.equal(t.calls(),1);
});
test('índice local pesquisa nomes novos sem rede e ignora índice expirado',async()=>{
 const t=fixture();const key=await t.searchCacheKey();
 t.values.set(key+':index:PERMANENTE',{expiresAt:Date.now()+10000,createdAt:Date.now(),records:[{name:'MARIA SILVA'},{name:'JOSE TESTE'}]});
 const q={root:'PERMANENTE',query:'Maria',birth:'',maxResults:150};
 const response=await t.cachedStudentSearch(q);assert.equal(t.calls(),0);assert.equal(JSON.parse(response.responseText).results[0].name,'MARIA SILVA');
 t.values.get(key+':index:PERMANENTE').expiresAt=Date.now()-1;await t.cachedStudentSearch(q);assert.equal(t.calls(),1);
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
test('IA discordante ou indisponível exige revisão e não aplica automaticamente',()=>{
 const t=fixture();const rule={key:'ged_historico',confidence:.99,hits:[]};const text='Histórico escolar estudos realizados com carga horária e resultado final';
 assert.equal(t.combineDocumentEvidence(rule,null,text).autoApply,false);
 assert.equal(t.combineDocumentEvidence(rule,{key:'ged_certidao',score:.9,margin:.4},text).autoApply,false);
 assert.equal(t.combineDocumentEvidence(rule,{key:'ged_historico',score:.7,margin:.2},text).autoApply,true);
 assert.equal(t.combineDocumentEvidence(rule,{key:'ged_historico',score:.7,margin:.01},text).autoApply,false);
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
test('HTTP: requisição de IA chega ao worker sem randomUUID',async()=>{
 let request;
 class FakeWorker{postMessage(data){request=data;this.onmessage({data:{id:data.id,result:{key:'ged_historico'}}});}}
 const t=fixture(undefined,{crypto:httpCrypto,Blob,Worker:FakeWorker});
 assert.equal((await t.classifyWithLocalAi('Histórico escolar')).key,'ged_historico');
 assert.match(request.id,/^[0-9a-f-]{36}$/);URL.revokeObjectURL(t.state.aiWorkerUrl);
});

test('falhas do Drive não exibem HTML e a requisição dispensa cookies Google',async()=>{
 let request;const t=fixture(undefined,{GM_xmlhttpRequest:opts=>{request=opts;opts.onload({status:404,responseText:'<!DOCTYPE html><script>enorme</script>'.repeat(500)});}});
 await assert.rejects(t.gmPostJson('https://script.google.com/macros/s/test/exec',{action:'ping',token:'test'}),error=>error.message.includes('404')&&error.message.length<200&&!error.message.includes('<'));
 assert.equal(request.anonymous,true);assert.equal(JSON.parse(request.data).token,'test');
 assert.throws(()=>t.parseDriveResponse({responseText:'<html>erro</html>'}),error=>!error.message.includes('<html>'));
 assert.equal(t.normalizeDriveEndpoint('https://script.google.com/macros/u/1/s/test/exec?authuser=1'),'https://script.google.com/macros/s/test/exec');
 assert.throws(()=>t.normalizeDriveEndpoint('https://script.google.com/home/projects/test/edit'),/exec/);
});
test('IA sem Cache API nem IndexedDB continua sem forçar cache incompatível',async()=>{
 const t=fixture(),env={useBrowserCache:true};await t.configureLocalModelCache(env);
 assert.equal(env.useBrowserCache,false);assert.equal(env.useCustomCache,false);
});
test('IA usa Cache API quando disponível e não força cache se abertura for negada',async()=>{
 const env={};await fixture(undefined,{caches:{open:async()=>({})}}).configureLocalModelCache(env);assert.equal(env.useBrowserCache,true);
 await fixture(undefined,{caches:{open:async()=>{throw Error('SecurityError');}}}).configureLocalModelCache(env);
 assert.equal(env.useBrowserCache,false);assert.equal(env.useCustomCache,false);
});
test('IA em HTTP persiste modelo no IndexedDB e tolera falta de espaço',async()=>{
 const records=new Map();let writesFail=false;
 const db={close(){},createObjectStore(){},transaction(){
  const tx={objectStore:()=>({
   get(key){const req={result:records.get(key)};queueMicrotask(()=>tx.oncomplete());return req;},
   put(value,key){const req={};queueMicrotask(()=>{if(writesFail){tx.error=Error('QuotaExceededError');tx.onabort();}else{records.set(key,value);tx.oncomplete();}});return req;}
  })};return tx;
 }};
 const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
 const t=fixture(undefined,{indexedDB,Response}),env={};await t.configureLocalModelCache(env);
 assert.equal(env.useBrowserCache,false);assert.equal(env.useCustomCache,true);
 assert.equal(await env.customCache.match('missing'),undefined);
 await env.customCache.put('model',new Response('modelo de teste',{headers:{'content-type':'application/octet-stream'}}));
 assert.equal(await (await env.customCache.match('model')).text(),'modelo de teste');
 const next={};await t.configureLocalModelCache(next);assert.equal(await (await next.customCache.match('model')).text(),'modelo de teste');
 writesFail=true;await env.customCache.put('other',new Response('sem espaço'));assert.equal(await env.customCache.match('other'),undefined);
});
