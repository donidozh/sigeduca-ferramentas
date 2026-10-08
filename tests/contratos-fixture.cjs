// Reprodução local e sintética. Não acessa o SIGEDUCA nem usa dados de sessão.
// node tests/contratos-fixture.cjs -> abrir http://127.0.0.1:8794/grh/hwmgrhfechamentoquadro.aspx
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const scriptPath = path.join(__dirname, '../gpe/exportador-contratos.user.js');
const initial = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Contratos · teste local</title><body>
<form id="MAINFORM"><h1>Emissão de contratos</h1><input type="button" name="BCONFIRMAR" value="Confirmar" onclick="window.confirmClicks++;window.open('/grh/hwmgrhemissaocontratos.aspx?2026,99')"></form>
<script>window.confirmClicks=0;window.downloads=[];window.zips=[];window.registrations=[];
addEventListener('sigeduca:ferramentas:registrar',e=>registrations.push(e.detail));
window.JSZip=class{constructor(){this.files={};}file(n,b){this.files[n]=b;}async generateAsync(opts,progress){window.zips.push(this.files);progress({percent:100});return new Blob(['ZIP simulado']);}};
window.captureDownload=(blob,name)=>downloads.push({blob,name});</script>
<script src="/tool.js"></script>
<div style="margin:0 40px 24px 66px;padding:20px;border:1px dashed #999;background:white"><button id="qa-run" type="button">Executar testes locais</button><pre id="qa-result">Simulação: escola 99 · dados fictícios · ZIP substituído por coletor em memória</pre></div>
<script src="/qa.js"></script></body></html>`;
const emission = `<!doctype html><html><meta charset="utf-8"><body>
<input name="GXState" type="hidden" value='{"vGERLOTCOD":"99"}'>
<select id="vGRHTPOPRCIDFILTRO"><option value="0">Selecione</option><option value="1">Contrato Administrativo</option><option value="2">Aulas em Substituição</option><option value="3">Tipo sem registros</option></select>
<button type="button" onclick="pageNo=1;setTimeout(draw,20)">Consultar</button><div id="query-result"></div><table id="grid"></table><button id="NEXT" type="button" title="Próxima" onclick="pageNo++;setTimeout(draw,20)" disabled>Próxima</button>
<script>
let pageNo=1;
function draw(){
const type=document.getElementById('vGRHTPOPRCIDFILTRO').value;
const rows=type==='1'?(pageNo===1?[['20','7'],['10','8']]:[['30','7']]):type==='2'?[['40','7']]:[];
const mismatch=parent.qaMismatch;
document.getElementById('query-result').textContent='Consulta concluída: '+rows.length+' linhas';
document.getElementById('grid').innerHTML=rows.map(([process,code],i)=>'<tr><td><span id="span_vPROCESSO_'+i+'">'+process+'</span></td><td><span id="span_vNOMESERVIDOR2_'+i+'">SERVIDOR EXEMPLO</span></td><td><span id="span_vGRHSRVCOD_'+i+'">'+code+'</span><span id="span_vCODTIPOPROCESSO_'+i+'">'+(mismatch?'999':type)+'</span><span id="span_vGRHLOTCOD_'+i+'">99</span><span id="span_vGRHCNTPTOSRVCOD_'+i+'">'+code+'</span></td>'+['vBITIMPRIMIR_','vRETIFICADO_','vDISTRATO_'].map((prefix,k)=>'<td><button id="'+prefix+i+'" data-process="'+process+'" data-kind="'+k+'">Imprimir</button></td>').join('')+'</tr>').join('');
for(const button of document.querySelectorAll('[data-process]'))button.onclick=()=>window.open('/grh/documento.aspx?process='+button.dataset.process+'&kind='+button.dataset.kind);
document.getElementById('NEXT').disabled=type!=='1'||pageNo>=2;
}
</script></body></html>`;
const qa = `const pause=ms=>new Promise(r=>setTimeout(r,ms));
const out=document.getElementById('qa-result');
function assert(ok,label){if(!ok)throw Error(label);out.textContent+='\\nOK: '+label;}
async function idle(){const end=Date.now()+45000;while(document.getElementById('sce-all').disabled){if(Date.now()>end)throw Error('Timeout');await pause(100);}}
document.getElementById('qa-run').onclick=async function(){this.disabled=true;out.textContent='Testando…';try{
await idle();assert(confirmClicks===1,'Confirmar acionado uma vez automaticamente');assert(registrations.some(x=>x.id==='gpe-exportador-contratos'),'Registro no menu GPE');assert(document.getElementById('sce-group').checked,'Agrupamento por servidor é padrão');assert(document.querySelectorAll('#sce-types input').length===3,'Tipos lidos da emissão');
document.getElementById('sce-all').click();await idle();
assert(document.getElementById('sce-doc-count').textContent==='12','12 documentos incluindo retificações, distratos e segunda página');
assert(document.getElementById('sce-error-count').textContent==='0','Exportação completa sem falhas');
assert(zips.length===1&&Object.keys(zips[0]).length===2,'ZIP único e servidores homônimos separados pelo código');
const file=Object.entries(zips[0]).find(([name])=>name.includes('Servidor 7'))[1];const html=await file.text();const doc=new DOMParser().parseFromString(html,'text/html');
assert(doc.querySelectorAll('[data-processo]').length===9,'Servidor 7 reúne nove documentos de dois tipos');
assert([...doc.querySelectorAll('[data-processo]')].map(x=>x.dataset.processo).join(',')==='20,20,20,30,30,30,40,40,40','Ordenação por processo');
assert(html.includes('Aulas em Substituição')&&html.includes('Contrato Administrativo'),'Tipos preservados no HTML agrupado');
assert(!doc.querySelector('script,input,button,iframe'),'HTML exportado sem código executável e campos de sessão');
assert(document.querySelectorAll('.sce-type[data-state=done]').length===3,'Tipos com status concluído, incluindo consulta vazia');
const csv=await downloads.find(x=>x.name.endsWith('.csv')).blob.text();assert(csv.includes('SEM REGISTROS')&&csv.includes('Aulas em Substituição'),'CSV inclui tipo e consulta sem registros');
assert(!document.querySelector('iframe[data-sce-worker="1"]'),'Frame de processamento removido ao terminar');
downloads=[];document.getElementById('sce-test').click();await idle();assert(document.getElementById('sce-doc-count').textContent==='1','Teste coleta somente um documento');assert(downloads.some(x=>x.name.endsWith('.html'))&&!downloads.some(x=>x.name.endsWith('.zip')),'Teste baixa HTML diretamente');assert(document.querySelector('#sce-types small').textContent.includes('Parcial'),'Teste não marca o tipo como integralmente consultado');
document.getElementById('sce-group').checked=false;document.getElementById('sce-extra').checked=false;document.getElementById('sce-csv').checked=false;
for(const el of document.querySelectorAll('#sce-types input'))el.checked=el.value==='2';downloads=[];document.getElementById('sce-all').click();await idle();assert(Object.keys(zips.at(-1))[0].startsWith('Aulas em Substituição/'),'Exportação individual por tipo selecionado');assert(document.getElementById('sce-doc-count').textContent==='1'&&!downloads.some(x=>x.name.endsWith('.csv')),'Opções de extras e CSV respeitadas');
window.qaMismatch=true;document.getElementById('sce-all').click();await idle();assert(document.getElementById('sce-doc-count').textContent==='0'&&document.getElementById('sce-error-count').textContent==='1','Grade com tipo errado bloqueada');window.qaMismatch=false;
document.getElementById('sce-group').checked=true;for(const el of document.querySelectorAll('#sce-types input'))el.checked=true;
document.getElementById('sce-all').click();const end=Date.now()+15000;while(document.getElementById('sce-doc-count').textContent==='0'){if(Date.now()>end)throw Error('Timeout coleta parcial');await pause(100);}document.getElementById('sce-stop').click();await idle();assert(document.getElementById('sce-status').textContent.startsWith('Interrompido:'),'Parar salva lote parcial e informa interrupção');
assert(Object.keys(zips.at(-1)).length>0,'Lote parcial contém arquivos');assert(confirmClicks===1,'Nenhuma confirmação nativa duplicada durante as execuções');
out.textContent+='\\nTODOS OS TESTES PASSARAM';
}catch(error){out.textContent+='\\nFALHA: '+error.message;}finally{this.disabled=false;}};`;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Content-Type', /\.js$/.test(url.pathname) ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  if (url.pathname === '/tool.js') {
    let script = fs.readFileSync(scriptPath, 'utf8');
    script = script.replace(/  function download\(blob, name\) \{[\s\S]*?\n  \}/, '  function download(blob, name) { window.captureDownload(blob, name); }');
    res.end(script);
  } else if (url.pathname === '/qa.js') res.end(qa);
  else if (url.pathname.endsWith('hwmgrhemissaocontratos.aspx')) res.end(emission);
  else if (url.pathname.endsWith('documento.aspx')) res.end(`<!doctype html><html><head><meta charset="utf-8"><style>#HTML{font:14px Arial}</style></head><body><form id="MAINFORM"><input name="GXState" type="hidden" value='{"vGERLOTCOD":"99"}'><div id="HTML"><h1>Processo ${Number(url.searchParams.get('process'))}</h1><p>${'Documento de exemplo fictício para validar a exportação. '.repeat(8)}</p></div><script>throw Error('Documento não deve executar scripts');</script></form></body></html>`);
  else res.end(initial);
}).listen(8794, '127.0.0.1', () => console.log('Fixture em http://127.0.0.1:8794/grh/hwmgrhfechamentoquadro.aspx'));
