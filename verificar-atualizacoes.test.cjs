const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/';
function menu(respond) {
  let s = fs.readFileSync(path.join(__dirname, 'menu-ferramentas.user.js'), 'utf8');
  s = s.replace('    // Cria o painel assim que o <html> existir.', `
    refs = { aviso: { textContent: '', dataset: {}, classList: { add() {} } },
             contador: {}, atualizarBase: {} };
    globalThis.testing = { compararVersoes, validarURLAtualizacao, verificarAtualizacoes,
        verificarAtualizacaoDaFerramenta, abrirAtualizacao, statusAtualizacoes,
        ferramentas, refs, ATUALIZACAO_BASE };
    return;
    // Cria o painel assim que o <html> existir.`);
  const opened = [];
  const window = { addEventListener() {}, open: (...args) => opened.push(args) };
  window.top = window.self = window;
  const context = { window, URL, console: { debug() {} }, setTimeout() {}, clearTimeout() {},
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
