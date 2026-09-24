const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'ged/termos-compromisso.user.js'),'utf8');
function contexto() {
 const win={addEventListener(){},dispatchEvent(){}}; win.top=win.self=win;
 const context={window:win,location:{pathname:'/ged/outra.aspx',hash:''},setTimeout(){},
  CustomEvent:class{constructor(type,data){this.type=type;Object.assign(this,data);}},
  document:{getElementById:id=>id==='tcEmissao'?{value:'2026-09-24'}:null},URL,console};
 vm.runInNewContext(source.replace('\niniciar();','\nglobalThis.api={lerData,idadeCompleta,tipoImagem,validarEmissao,gerarTermo,extrairCadastro,DOCUMENTOS,TEMPLATES};\niniciar();'),context);
 return context.api;
}
const dados={aluno:'Aluno Exemplo de Teste',cpfAluno:'000.000.000-00',nascimento:'2010-05-10',responsavel:'Responsável Exemplo',
 cpfResponsavel:'000.000.000-00',rgResponsavel:'RG EXEMPLO',mae:'Mãe Exemplo',pai:'Pai Exemplo',endereco:'Rua de Exemplo, 100',
 municipio:'Cáceres',municipioCabecalho:'Cáceres',telefonesResponsavel:['(00) 00000-0000'],emailResponsavel:'exemplo@example.com',
 escola:'Escola Estadual Onze de Março',anoLetivo:'2026',turma:'1º ANO A',turno:'Matutino',prazo:'2026-10-15',emissao:'2026-09-24',
 dre:'Diretoria Regional de Educação - DRE - Cáceres-MT',assinante:'responsavel',documentos:[0,3,10]};
const escola={enderecoEscola:'Rua de Exemplo, 100',telefoneEscola:'(00) 0000-0000',emailEscola:'escola@example.com'};
test('18 anos completos: véspera, aniversário, depois e formatos BR/ISO',()=>{
 const a=contexto();
 assert.equal(a.idadeCompleta('25/09/2008','2026-09-24'),17);
 assert.equal(a.tipoImagem('2008-09-24','2026-09-24'),'imgMajor');
 assert.equal(a.tipoImagem('2008-09-25','2026-09-24'),'imgMinor');
 assert.equal(a.idadeCompleta('2008-09-23','2026-09-24'),18);
});
test('não presume idade em datas vazias, impossíveis ou futuras; trata ano bissexto',()=>{
 const a=contexto();
 for(const n of ['','31/02/2010','29/02/2010','2027-01-01','0000-00-00','10/20/2008']) {
  assert.equal(a.idadeCompleta(n,'2026-09-24'),null);
  assert.throws(()=>a.tipoImagem(n,'2026-09-24'));
 }
 assert.equal(a.idadeCompleta('2008-02-29','2026-02-28'),17);
 assert.equal(a.idadeCompleta('2008-02-29','2026-03-01'),18);
});
test('cadastro é extraído tanto de campos quanto spans da tela de consulta',()=>{
 const a=contexto();
 const doc={getElementById:id=>({'span_CTLGERPESNOM':{textContent:'Aluno Teste'},'span_CTLGERPESDTANASC':{textContent:'24/09/2008'},
  CTLGERPESCPF:{value:'00000000000'}}[id]||null)};
 const d=a.extrairCadastro(doc);
 assert.equal(d.nascimento,'2008-09-24');assert.equal(d.aluno,'Aluno Teste');assert.equal(d.cpfAluno,'000.000.000-00');
 assert.throws(()=>a.extrairCadastro({getElementById:()=>null}));
});
test('seleção automática gera o conteúdo correto; termo militar não faz parte do script',()=>{
 const a=contexto();
 assert.match(a.gerarTermo('imagem',dados),/ESTUDANTE MENOR DE IDADE/);
 assert.match(a.gerarTermo('imagem',{...dados,nascimento:'2000-01-01'}),/ESTUDANTE MAIOR DE IDADE/);
 assert.doesNotMatch(source,/cienciaMilitar|buildCienciaMilitarTerm|testAlunoCode/);
 assert.equal(Object.keys(a.TEMPLATES).length,5);
});
test('modelo de documentos mantém 12 itens e imprime apenas os selecionados marcados',()=>{
 const a=contexto(), html=a.gerarTermo('documentos',dados);
 assert.equal(a.DOCUMENTOS.length,12);
 assert.equal((html.match(/\[X\]/g)||[]).length,3);
 assert.equal((html.match(/\[ \]/g)||[]).length,9);
 assert.match(html,/755\/2025/); assert.match(html,/006805-012\/2022/); assert.match(html,/15\/10\/2026/);
 assert.match(html,/Assinatura do\(a\) aluno\(a\) ou responsável/);
 assert.equal((a.gerarTermo('documentos',{...dados,documentos:Array.from({length:12},(_,i)=>i)}).match(/\[X\]/g)||[]).length,12);
});
test('exige seleção, prazo válido, dados do signatário e matrícula',()=>{
 const a=contexto();
 for(const patch of [{documentos:[]},{documentos:[12]},{prazo:''},{prazo:'2026-09-23'},{turma:''},{cpfResponsavel:''},{assinante:'aluno'}]) {
  assert.throws(()=>a.gerarTermo('documentos',{...dados,...patch}));
 }
 assert.doesNotThrow(()=>a.gerarTermo('documentos',{...dados,nascimento:'2000-01-01',assinante:'aluno'}));
 assert.throws(()=>a.gerarTermo('familyMinor',{...dados,nascimento:'2000-01-01'}));
});
test('todos os modelos substituem variáveis e escapam dados do cadastro',()=>{
 const a=contexto();
 for(const tipo of ['data','imagem','familyMinor','authMatricula','documentos']) {
  const html=a.gerarTermo(tipo,{...dados,aluno:'Aluno <img src=x onerror=alert(1)>'},escola);
  assert.doesNotMatch(html,/<<[A-Z_]+>>/);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img src=x/);
  assert.doesNotMatch(html,/src="https?:/);
 }
});
if(process.env.GERAR_PREVIAS==='1') {
 const out=path.resolve(__dirname,'../qa-termos');fs.mkdirSync(out,{recursive:true});
 const a=contexto();
 for(const tipo of ['data','imagem','familyMinor','authMatricula','documentos']) fs.writeFileSync(path.join(out,tipo+'.html'),a.gerarTermo(tipo,{...dados,documentos:Array.from({length:12},(_,i)=>i)},escola));
 fs.writeFileSync(path.join(out,'imagem-maior.html'),a.gerarTermo('imagem',{...dados,nascimento:'2000-01-01'},escola));
}
