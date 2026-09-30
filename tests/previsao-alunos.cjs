// Regressões sem dados pessoais. Executar: node tests/previsao-alunos.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../ged/acoes-lote-turmas.user.js'), 'utf8');
const start = script.indexOf('    const norm =', script.indexOf('const previsaoLote'));
const end = script.indexOf('    let root, resultados=', start);
assert.ok(start > 0 && end > start);
const { analisarPdf } = new Function(script.slice(start, end) + ';return {analisarPdf};')();
const item = (str, x, y) => ({str, transform:[1,0,0,1,x,y]});
const turma = {nome:'7º ANO TESTE',turno:'VESPERTINO',url:'https://sigeduca.seduc.mt.gov.br/ged/arrprevisaoalunosturma.aspx?2027,11606,X,1,1,123,TESTE,0,0,0'};
const topo = () => [item('Previsão de Alunos na Turma',370,530),item('11606 - ESCOLA TESTE',375,515)];
const inicio = (nome=turma.nome, etapa='ENSINO FUNDAMENTAL') => [...topo(),item(`Série/Ano/Fase: ${etapa} > REGULAR Turma: ${nome} Sala: 001 Turno: VESPERTINO`,25,485),...[
    ['Seq.',26],['Cód. Aluno',48],['Nome',93],['Data Nasc.',363],['Idade',411],['Aluno PAED?',447],['Tipo de Solicitação',499]
].map(([t,x])=>item(t,x,465))];
const aluno = (seq,y,paed='NÃO') => [item(String(seq),33,y),item(String(1000000+seq),57,y),item('ALUNO TESTE '+seq,93,y),item('01/01/2014',365,y),item('12 anos',411,y),item(paed,460,y),item('Rematrícula',500,y)];
const total = (n,y=120) => item('Qtde Total de Alunos: '+n,85,y);
let r=analisarPdf([[...inicio(),...aluno(1,449,'SIM')],[...topo(),...aluno(2,490),total(2)]],turma);
assert.deepEqual([r.total,r.paed,r.naoPaed,r.capacidade,r.vagas],[2,1,1,30,28]);
r=analisarPdf([[...inicio(),...aluno(1,449)],[...topo(),total(1)]],turma);
assert.equal(r.total,1); // Segunda página somente com totais.
r=analisarPdf([[...inicio(),...aluno(1,449),total(1)],[...topo(),item('Total de Aluno - Rematricula com',25,490),item('matrícula confirmada:',85,475)]],turma);
assert.equal(r.alunos[0].nome,'ALUNO TESTE 1'); // Rodapé não integra o nome.
const mensagem = item('Não há aluno(s) matriculado(s) na Série/Ano/Fase.',260,447);
r=analisarPdf([[...inicio(),mensagem]],turma);
assert.deepEqual([r.total,r.paed,r.vagas],[0,0,30]);
const ept={...turma,nome:'1º EPT TESTE'};
r=analisarPdf([[...inicio(ept.nome,'ENSINO MÉDIO > ENSINO PROFISSIONAL TÉCNICO'),mensagem]],ept);
assert.equal(r.vagas,35);
const medio={...turma,nome:'1º ANO TESTE'};
const alunos=Array.from({length:36},(_,i)=>aluno(i+1,449-i*8)).flat();
r=analisarPdf([[...inicio(medio.nome,'ENSINO MÉDIO'),...alunos,total(36,100)]],medio);
assert.deepEqual([r.vagas,r.excedentes,r.capacidade],[0,1,35]);
assert.throws(()=>analisarPdf([[...inicio()]],turma),/rodapé/);
assert.throws(()=>analisarPdf([[...topo(),...aluno(1,490),total(1)]],turma),/Cabeçalho inicial/);
assert.throws(()=>analisarPdf([[...inicio(),...aluno(1,449),total(2)]],turma),/divergente/);
assert.throws(()=>analisarPdf([[...inicio(),...aluno(1,449),mensagem]],turma),/mistura/);
assert.throws(()=>analisarPdf([[...inicio(),...aluno(1,449),...aluno(1,435),total(2)]],turma),/repetidos/);
r=analisarPdf([[...inicio(),...aluno(1,449,'?'),total(1)]],turma);
assert.equal(r.indefinidos,1);assert.equal(r.naoPaed,0);
console.log('Previsão: continuação sem cabeçalho, rodapés, vazios, PAED, capacidade e arquivos incompletos: OK.');
