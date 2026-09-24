const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/';
class Elemento {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.textContent = ''; }
  appendChild(child) { this.children.push(child); }
  addEventListener(event, fn) { this.events[event] = fn; }
  setAttribute() {}
}
function menu(respond) {
  let s = fs.readFileSync(path.join(__dirname, 'menu-ferramentas.user.js'), 'utf8');
  s = s.replace('    // Cria o painel assim que o <html> existir.', `
    refs = { aviso: { textContent: '', dataset: {}, classList: { add() {} } },
             contador: {}, atualizarBase: {} };
    globalThis.testing = { compararVersoes, validarURLAtualizacao, verificarAtualizacoes,
        verificarAtualizacaoDaFerramenta, abrirAtualizacao, statusAtualizacoes,
        ferramentas, refs, ATUALIZACAO_BASE, validarCatalogo, carregarCatalogo,
        ferramentaDetectada, renderizarCatalogo,
        estadoCatalogo: () => ({ estado: catalogoEstado, itens: catalogo }) };
    return;
    // Cria o painel assim que o <html> existir.`);
  const opened = [];
  const window = { addEventListener() {}, open: (...args) => opened.push(args) };
  window.top = window.self = window;
  const context = { window, URL, console: { debug() {} }, setTimeout() {}, clearTimeout() {},
    document: { createElement: tag => new Elemento(tag) },
    requestAnimationFrame() {}, GM_info: { script: { version: '2.6.0' } },
    GM_xmlhttpRequest: respond };
  vm.runInNewContext(s, context);
  return { ...context.testing, opened };
}
test('todos os scripts mantêm identidade e URLs instaláveis', () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.user.js'));
  assert.equal(files.length, 12);
  const identities = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    new vm.Script(text, { filename: file });
    assert.match(text, /^\/\/ @version\s+\d+\.\d+\.\d+$/m);
    for (const tag of ['updateURL', 'downloadURL']) {
      assert.equal(text.match(new RegExp('^// @' + tag + '\\s+(\\S+)', 'm'))[1], root + file);
    }
    const identity = text.match(/^\/\/ @name\s+(.+)$/m)[1] + text.match(/^\/\/ @namespace\s+(.+)$/m)[1];
    assert.ok(!identities.has(identity));
    identities.add(identity);
    if (file !== 'menu-ferramentas.user.js' && text.includes("'sigeduca:ferramentas:registrar'")) {
      assert.match(text, /detail: \{ \.\.\.\w+, \.\.\.ATUALIZACAO_SCRIPT \}/);
    }
    assert.doesNotMatch(text, /https:\/\/script\.google\.com\/macros\/s\/[\w-]+/);
    assert.doesNotMatch(text, /https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/);
  }
});
test('comparação numérica, igualdade e versões locais mais recentes', () => {
  const m = menu(() => {});
  assert.ok(m.compararVersoes('2.10.0', '2.9.9') > 0);
  assert.equal(m.compararVersoes('2.6.0', '2.6'), 0);
  assert.ok(m.compararVersoes('2.5.9', '2.6.0') < 0);
});
test('consulta inclui o próprio menu e mostra atualização do menu', async () => {
  const urls = [];
  const m = menu(o => { urls.push(o.url); o.onload({ status: 200, responseText: '// @version 2.7.0' }); });
  await m.verificarAtualizacoes(true);
  assert.deepEqual(urls, [root + 'menu-ferramentas.user.js']);
  assert.equal(m.refs.atualizarBase.hidden, false);
  assert.match(m.refs.atualizarBase.textContent, /2.7.0/);
  assert.match(m.refs.aviso.textContent, /1 atualização disponível/);
  m.abrirAtualizacao(m.ATUALIZACAO_BASE);
  assert.equal(m.opened[0][0], root + 'menu-ferramentas.user.js');
});
test('mesma versão não é atualização', async () => {
  const m = menu(o => o.onload({ status: 200, responseText: '// @version 2.6.0' }));
  await m.verificarAtualizacoes(true);
  assert.equal(m.refs.atualizarBase.hidden, true);
  assert.equal(m.statusAtualizacoes.get('__menu_base__').estado, 'atualizado');
});
test('HTTP, timeout e conteúdo inválido não viram mensagem de sucesso', async () => {
  for (const reply of [o => o.onload({ status: 404 }), o => o.ontimeout(), o => o.onerror(),
    o => o.onload({ status: 200, responseText: '<html>Erro</html>' })]) {
    const m = menu(reply);
    await m.verificarAtualizacoes(true);
    assert.equal(m.statusAtualizacoes.get('__menu_base__').estado, 'erro');
    assert.equal(m.refs.aviso.dataset.tipo, 'erro');
    assert.doesNotMatch(m.refs.aviso.textContent, /estão atualizados/);
  }
});
test('módulo atualizado é detectado e módulo antigo sem URL é informado', async () => {
  const m = menu(o => o.onload({ status: 200, responseText: '// @version ' +
    (o.url.endsWith('menu-ferramentas.user.js') ? '2.6.0' : '3.0.2') }));
  m.ferramentas.set('modulo', { id: 'modulo', titulo: 'Módulo', versao: '3.0.1', updateUrl: root + 'requerimentos.user.js' });
  m.ferramentas.set('antigo', { id: 'antigo' });
  await m.verificarAtualizacoes(true);
  assert.equal(m.statusAtualizacoes.get('modulo').estado, 'disponivel');
  assert.match(m.refs.aviso.textContent, /reinstaladas pelo catálogo/);
});
test('não consulta nem abre endereços fora do repositório autorizado', async () => {
  let requested = false;
  const m = menu(() => { requested = true; });
  for (const url of ['https://example.com/a.user.js', 'javascript:alert(1)',
    'https://raw.githubusercontent.com/other/repo/main/a.user.js',
    'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/../secret.user.js']) {
    assert.equal(m.validarURLAtualizacao(url), '');
    await m.verificarAtualizacaoDaFerramenta({ id: 'bad', versao: '1.0.0', updateUrl: url });
    m.abrirAtualizacao({ updateUrl: url });
  }
  assert.equal(requested, false);
  assert.equal(m.opened.length, 0);
});

const catalogoPublicado = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogo.json'), 'utf8'));
test('catálogo cobre todas as ferramentas, com arquivos existentes e instalação restrita ao repositório', () => {
  const m = menu(() => {});
  const itens = m.validarCatalogo(catalogoPublicado);
  assert.equal(itens.length, 11);
  for (const item of itens) {
    assert.ok(item.installUrl.startsWith(root));
    assert.ok(fs.existsSync(path.join(__dirname, new URL(item.installUrl).pathname.split('/').pop())));
  }
  assert.equal(new Set(itens.map(item => item.installUrl)).size, 11);
});
test('catálogo rejeita URL externa, travessia de pasta, formato inválido e IDs duplicados', () => {
  const m = menu(() => {});
  for (const arquivo of ['https://example.com/a.user.js', '../a.user.js', 'a.js', 'a.user.js?x=1']) {
    assert.throws(() => m.validarCatalogo({ formato: 1, ferramentas: [{ ...catalogoPublicado.ferramentas[0], arquivo }] }));
  }
  assert.throws(() => m.validarCatalogo({ formato: 2, ferramentas: [] }));
  assert.throws(() => m.validarCatalogo({ formato: 1, ferramentas: [catalogoPublicado.ferramentas[0], catalogoPublicado.ferramentas[0]] }));
});
test('novidade aparece pela atualização do catálogo sem modificar o menu; clique não marca instalação', async () => {
  let resposta = structuredClone(catalogoPublicado);
  let chamadas = 0;
  const m = menu(o => { chamadas++; o.onload({ status: 200, responseText: JSON.stringify(resposta) }); });
  await m.carregarCatalogo();
  assert.equal(m.estadoCatalogo().itens.length, 11);
  await m.carregarCatalogo();
  assert.equal(chamadas, 1);
  resposta.ferramentas.push({ id: 'nova', titulo: 'Nova ferramenta', descricao: 'Teste', arquivo: 'nova.user.js', registros: ['nova'] });
  await m.carregarCatalogo(true);
  const item = m.estadoCatalogo().itens.at(-1);
  assert.equal(item.id, 'nova');
  assert.equal(m.ferramentaDetectada(item), false);
  m.abrirAtualizacao(item);
  assert.equal(m.opened[0][0], root + 'nova.user.js');
  assert.equal(m.ferramentaDetectada(item), false);
  m.ferramentas.set('nova', { id: 'nova' });
  assert.equal(m.ferramentaDetectada(item), true);
});
test('falha de catálogo mantém ferramentas instaladas e permite tentar novamente', async () => {
  let falha = false;
  const m = menu(o => falha ? o.onerror() : o.onload({ status: 200, responseText: JSON.stringify(catalogoPublicado) }));
  m.ferramentas.set('requerimentos', { id: 'requerimentos' });
  await m.carregarCatalogo();
  falha = true;
  await m.carregarCatalogo(true);
  assert.equal(m.estadoCatalogo().estado, 'erro');
  assert.equal(m.estadoCatalogo().itens.length, 11);
  assert.ok(m.ferramentas.has('requerimentos'));
  falha = false;
  await m.carregarCatalogo(true);
  assert.equal(m.estadoCatalogo().estado, 'pronto');
});
test('primeira instalação exibe a central e botões que abrem o script correto', async () => {
  const m = menu(o => o.onload({ status: 200, responseText: JSON.stringify(catalogoPublicado) }));
  await m.carregarCatalogo();
  m.refs.conteudo = new Elemento('main');
  m.renderizarCatalogo();
  const todos = [];
  function percorrer(el) { todos.push(el); el.children.forEach(percorrer); }
  percorrer(m.refs.conteudo);
  assert.ok(todos.some(el => el.textContent === 'Central de ferramentas'));
  const botoes = todos.filter(el => el.tag === 'button');
  assert.equal(botoes.length, 11);
  botoes[0].events.click();
  assert.equal(m.opened[0][0], root + 'requerimentos.user.js');
  assert.equal(m.ferramentas.size, 0);
});
