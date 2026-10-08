// ==UserScript==
// @name         SIGEDUCA — Exportador de Contratos em Lote
// @namespace    sigeduca.contratos.lote
// @version      3.0.0
// @description  Exportação de contratos por servidor, integrada ao menu GPE, com consulta automática e seleção de tipos de processo.
// @match        *://sigeduca.seduc.mt.gov.br/grh/*
// @noframes
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/exportador-contratos.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/exportador-contratos.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// ==/UserScript==

(function () {
  'use strict';
  if (window !== window.top || window.__SIGEDUCA_CONTRATOS__) return;
  window.__SIGEDUCA_CONTRATOS__ = true;
  const updateURL = 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/exportador-contratos.user.js';
  const ATUALIZACAO_SCRIPT = {
    versao: typeof GM_info === 'object' ? GM_info.script.version : '3.0.0', updateUrl: updateURL, installUrl: updateURL
  };
  const ferramenta = {
    id: 'gpe-exportador-contratos', titulo: 'Exportador de Contratos',
    descricao: 'Contratos, retificações e distratos organizados por servidor.',
    url: 'hwmgrhfechamentoquadro.aspx#exportador-contratos', grupo: 'Gestão de Pessoas', grupoOrdem: 10, ordem: 20
  };
  const register = () => window.dispatchEvent(new CustomEvent('sigeduca:ferramentas:registrar', { detail: { ...ferramenta, ...ATUALIZACAO_SCRIPT } }));
  for (const event of ['sigeduca:ferramentas:solicitar-registro', 'sigeduca:ferramentas:base-pronta']) window.addEventListener(event, register);
  register(); setTimeout(register, 100);
  if (!/\/grh\/hwmgrhfechamentoquadro\.aspx$/i.test(location.pathname)) return;
  if (location.hash === '#sigeduca-original') {
    window.addEventListener('hashchange', () => location.reload());
    return;
  }
  const nativeForm = document.getElementById('MAINFORM') || document.querySelector('form');
  if (!nativeForm) return;
  const LIMIT = 45000;
  const resourceCache = new Map();
  let resourceWarnings = new Set(), attempts = 0;
  const serverGroups = new Map();
  let savedFiles = 0, failureCount = 0;
  let saveFailure = '', running = false, stop = false, report = [], zip, inZip = 0, total = 0;
  let worker, workerURL, scope, currentCapture = null, emissionFrame, preparing = null;
  let availableTypes = [], typeNodes = new Map();
  const seen = new Set(), filenames = new Map();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const norm = s => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const safe = s => clean(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 150) || 'SEM_NOME';
  const text = (root, sel) => clean(root.querySelector(sel)?.textContent);
  const panel = document.createElement('section'); panel.id = 'sce-panel';
  panel.innerHTML = `<header class="sce-header"><div><span class="sce-eyebrow">GPE · GESTÃO DE PESSOAS</span><h1>Exportador de Contratos</h1><p>Documentos da escola, organizados por servidor.</p></div><button type="button" id="sce-original">Página original</button></header>
    <div class="sce-layout"><aside><section class="sce-card"><h2>Preparar exportação</h2><p>Um arquivo HTML por servidor, com seus processos em ordem, dentro de um único ZIP.</p>
      <label class="sce-option"><input type="checkbox" id="sce-group" checked><span><strong>Agrupar por servidor</strong><small>Reúne os documentos pelo código do servidor.</small></span></label>
      <label class="sce-option"><input type="checkbox" id="sce-extra" checked><span><strong>Retificações e distratos</strong><small>Inclui os documentos disponíveis além do contrato.</small></span></label>
      <label class="sce-option"><input type="checkbox" id="sce-csv" checked><span><strong>Relatório da exportação</strong><small>CSV com tipo, processo, servidor e resultado.</small></span></label>
      <button type="button" id="sce-all" class="sce-primary" disabled>Exportar documentos</button><button type="button" id="sce-test" disabled>Testar 1 documento</button>
      <p class="sce-help">O teste baixa somente um documento. Para imprimir os HTMLs, abra no navegador e use Ctrl+P.</p></section>
      <section class="sce-card"><span class="sce-eyebrow">ORIGEM DOS DOCUMENTOS</span><p id="sce-context">Preparando a emissão da escola…</p><button type="button" id="sce-retry" hidden>Tentar abrir emissão novamente</button></section></aside>
    <main><section class="sce-card"><div class="sce-section-title"><h2>Tipos de processo</h2><span id="sce-type-count" class="sce-tag">Carregando</span></div><p>Selecione os tipos que deseja consultar. Os nomes são os mesmos da emissão do SIGEDUCA.</p><div id="sce-types"></div></section>
      <section class="sce-card"><div class="sce-section-title"><h2>Andamento</h2><button type="button" id="sce-stop" disabled>Parar e salvar parcial</button></div>
        <div class="sce-stats"><div><b id="sce-doc-count">0</b><span>documentos coletados</span></div><div><b id="sce-file-count">0</b><span>arquivos gerados</span></div><div><b id="sce-error-count">0</b><span>falhas</span></div></div>
        <div class="sce-current"><span id="sce-current-type">Aguardando emissão</span><strong id="sce-server">Nenhum servidor em processamento</strong></div>
        <p id="sce-status" role="status" aria-live="polite">Abrindo a consulta automaticamente…</p><details><summary>Detalhes da execução</summary><ol id="sce-log"></ol></details>
      </section></main></div>`;
  const style = document.createElement('style');
  style.textContent = `
    body.sce-active{margin:0!important;background:#f5f6f8!important;opacity:1!important}
    body.sce-active .sce-native{position:fixed!important;left:-18000px!important;top:0!important;width:1200px!important;height:1000px!important;overflow:auto!important;pointer-events:none!important}
    #sce-panel{max-width:1480px;margin:auto;padding:30px 40px 60px 66px;color:#342126;font:14px Arial,sans-serif;text-align:left}
    #sce-panel *{box-sizing:border-box}#sce-panel [hidden]{display:none!important}
    #sce-panel h1{font-size:29px;margin:6px 0 8px}#sce-panel h2{font-size:18px;margin:0 0 16px}#sce-panel p{color:#80676b;line-height:1.6;margin:8px 0 18px}
    #sce-panel .sce-eyebrow{font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#9e242b}#sce-panel .sce-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:26px}
    #sce-panel .sce-layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:24px}#sce-panel .sce-card{background:white;border:1px solid #e6d9dc;border-radius:14px;padding:24px;margin-bottom:20px;box-shadow:0 5px 20px #34212604;min-width:0}
    #sce-panel button{border:1px solid #e6d9dc;border-radius:8px;padding:11px 16px;font:600 13px Arial;background:#fff;color:#63313a;cursor:pointer;min-height:40px}#sce-panel button:hover:not(:disabled){background:#faecee}#sce-panel button:disabled{opacity:.5;cursor:default}#sce-panel button:focus-visible,#sce-panel input:focus-visible{outline:3px solid #bc6970;outline-offset:3px}
    #sce-panel .sce-primary{background:#9e242b;color:white;border-color:#9e242b}#sce-panel .sce-primary:hover:not(:disabled){background:#7e1e24}#sce-all,#sce-test{width:100%;margin-top:10px}
    #sce-panel .sce-option{display:flex;align-items:start;gap:10px;margin:20px 0;cursor:pointer;line-height:1.4}#sce-panel input[type=checkbox]{accent-color:#9e242b;width:17px;height:17px;flex-shrink:0;margin:1px 0}#sce-panel small{display:block;color:#80676b;font-size:12px;margin-top:5px}#sce-panel .sce-help{font-size:12px;margin:18px 0 0}
    #sce-panel .sce-section-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px}#sce-panel .sce-tag{font-size:11px;font-weight:bold;color:#9e242b;background:#faecee;padding:7px 9px;border-radius:6px;white-space:nowrap}
    #sce-panel .sce-type{display:flex;align-items:center;gap:12px;padding:15px 0;border-top:1px solid #eee6e8;cursor:pointer}#sce-panel .sce-type span{flex:1;line-height:1.4}#sce-panel .sce-type small{margin:0;text-align:right;max-width:45%}#sce-panel .sce-type[data-state=active]{color:#9e242b;font-weight:bold}#sce-panel .sce-type[data-state=error] small{color:#a11d29}#sce-panel .sce-type[data-state=done] small{color:#28704e}
    #sce-panel .sce-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:12px 0 24px}#sce-panel .sce-stats div{background:#faf7f8;border-radius:10px;padding:18px}#sce-panel .sce-stats b{display:block;font-size:27px;color:#9e242b}#sce-panel .sce-stats span{display:block;font-size:12px;color:#80676b;margin-top:6px}
    #sce-panel .sce-current{border-left:3px solid #9e242b;padding:3px 0 3px 14px;margin-bottom:18px}#sce-panel .sce-current span{display:block;font-size:12px;color:#80676b;margin-bottom:7px}#sce-panel .sce-current strong{font-size:17px}#sce-panel #sce-status{color:#63313a;overflow-wrap:anywhere}#sce-panel summary{cursor:pointer;color:#80676b;font-size:12px}#sce-log{max-height:220px;overflow:auto;font-size:12px;line-height:1.7;padding-left:22px;overflow-wrap:anywhere}
    @media(max-width:850px){#sce-panel{padding:24px 18px 40px 42px}#sce-panel .sce-layout{grid-template-columns:1fr}#sce-panel .sce-header{align-items:start}#sce-panel h1{font-size:24px}#sce-panel .sce-stats{gap:6px}#sce-panel .sce-stats div{padding:12px}}
  `;
  document.head.append(style); document.body.append(panel);
  nativeForm.classList.add('sce-native'); nativeForm.setAttribute('aria-hidden', 'true'); document.body.classList.add('sce-active');
  const $ = s => panel.querySelector(s);
  function refreshStats() {
    $('#sce-doc-count').textContent = total; $('#sce-file-count').textContent = savedFiles;
    $('#sce-error-count').textContent = failureCount;
  }
  function log(s) {
    console.info('[SIGEDUCA Contratos]', s); $('#sce-status').textContent = s;
    const item = document.createElement('li'); item.textContent = s; $('#sce-log').append(item);
    while ($('#sce-log').children.length > 100) $('#sce-log').firstChild.remove();
    refreshStats();
  }
  function showServer(name = '') { $('#sce-server').textContent = name || 'Nenhum servidor em processamento'; }
  function typeStatus(value, label, state = '') {
    const row = typeNodes.get(value); if (!row) return;
    row.dataset.state = state; row.querySelector('small').textContent = label;
  }
  function setBusy(busy) {
    for (const el of panel.querySelectorAll('input, #sce-all, #sce-test, #sce-original, #sce-retry')) el.disabled = busy;
    $('#sce-stop').disabled = !running;
    if (!busy) $('#sce-all').disabled = $('#sce-test').disabled = !availableTypes.length;
  }
  $('#sce-stop').onclick = () => { stop = true; $('#sce-stop').disabled = true; log('Parando após a operação atual e salvando o lote parcial…'); };
  $('#sce-test').onclick = () => run(true);
  $('#sce-all').onclick = () => run(false);
  $('#sce-original').onclick = () => { location.hash = 'sigeduca-original'; location.reload(); };
  $('#sce-retry').onclick = () => prepareEmission();
  window.addEventListener('beforeunload', event => { if (running) { event.preventDefault(); event.returnValue = ''; } });
  function confirmButton() {
    return [...nativeForm.querySelectorAll('input[type=button],input[type=submit],input[type=image],button,a')]
      .find(el => visible(el) && [el.value, el.textContent, el.title, el.alt, el.name, el.id].some(value => /^(?:b)?confirmar$/.test(norm(value))));
  }
  async function ensureEmission() {
    const existing = findEmission(); if (existing) return existing;
    const guardKey = 'sigeduca:contratos:confirmando';
    // Evita confirmar repetidamente caso o evento nativo recarregue a página.
    try {
      const previous = Number(sessionStorage.getItem(guardKey));
      sessionStorage.removeItem(guardKey);
      if (previous && Date.now() - previous < LIMIT) throw Error('A página foi recarregada pelo Confirmar. Confira a escola e tente abrir a emissão novamente.');
    } catch (error) { if (error.message.startsWith('A página foi')) throw error; }
    const start = Date.now(); let button;
    while (!(button = confirmButton()) && Date.now() - start < 10000) await sleep(200);
    if (!button) throw Error('Botão Confirmar não encontrado. Abra Página original e confira a escola e o período.');
    log('Abrindo a emissão pelo botão Confirmar…');
    // O Confirmar nativo mantém os parâmetros e validações da escola. Redireciona
    // apenas a abertura da emissão para um frame; outros destinos ficam intactos.
    const originalOpen = window.open;
    window.open = function (value, ...args) {
      let url; try { url = new URL(String(value), location.href); } catch (_) {}
      if (url?.origin === location.origin && /\/hwmgrhemissaocontratos\.aspx$/i.test(url.pathname)) {
        emissionFrame?.remove(); emissionFrame = frameCreate(); emissionFrame.dataset.sceWorker = '';
        emissionFrame.src = url.href; return emissionFrame.contentWindow;
      }
      return originalOpen.call(this, value, ...args);
    };
    try {
      try { sessionStorage.setItem(guardKey, String(Date.now())); } catch (_) {}
      button.click();
      const clickedAt = Date.now();
      while (Date.now() - clickedAt < LIMIT) {
        const emission = findEmission(); if (emission) return emission;
        const errors = [...nativeForm.querySelectorAll('[id$=gxErrorViewer]')].filter(visible).map(e => clean(e.textContent)).filter(Boolean).join(' ');
        if (errors) throw Error(errors);
        await sleep(200);
      }
      throw Error('A emissão não abriu em 45 segundos. Confira a sessão, a escola e o período na Página original.');
    } finally { window.open = originalOpen; try { sessionStorage.removeItem(guardKey); } catch (_) {} }
  }
  async function prepareEmission() {
    if (preparing) return preparing;
    preparing = (async () => {
      setBusy(true); $('#sce-retry').hidden = true;
      try {
        const emission = await ensureEmission();
        workerURL = emission.location.href;
        const s = state(emission.document), params = new URL(workerURL).search.slice(1).split(',');
        scope = String(s.vGERLOTCOD || s.vGRHLOTCOD || (/^\d+$/.test(params[1] || '') ? params[1] : ''));
        if (!scope) throw Error('Não foi possível identificar a lotação da emissão. Confira a escola na Página original.');
        availableTypes = [...emission.document.querySelector('#vGRHTPOPRCIDFILTRO').options]
          .filter(o => !o.disabled && o.value && o.value !== '0').map(o => ({ value: o.value, label: clean(o.textContent) }));
        if (!availableTypes.length) throw Error('Nenhum tipo de processo disponível na emissão.');
        $('#sce-types').replaceChildren(); typeNodes.clear();
        for (const type of availableTypes) {
          const row = document.createElement('label'); row.className = 'sce-type';
          const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.value = type.value;
          const name = document.createElement('span'); name.textContent = type.label;
          const status = document.createElement('small'); status.textContent = 'Aguardando';
          row.append(checkbox, name, status); $('#sce-types').append(row); typeNodes.set(type.value, row);
        }
        $('#sce-type-count').textContent = availableTypes.length + ' disponíveis';
        $('#sce-context').textContent = 'Lotação ' + scope + ' · Emissão do SIGEDUCA';
        $('#sce-current-type').textContent = 'Pronto para consultar';
        log('Emissão aberta. Selecione os tipos de processo e inicie a exportação.');
      } catch (error) {
        availableTypes = []; $('#sce-type-count').textContent = 'Indisponível'; $('#sce-context').textContent = 'A emissão precisa de atenção.';
        log(error.message); $('#sce-retry').hidden = false;
      } finally { setBusy(false); }
    })();
    try { await preparing; } finally { preparing = null; }
  }

  function frames(w, out = []) {
    try { out.push(w); for (const f of w.document.querySelectorAll('iframe,frame')) frames(f.contentWindow, out); } catch (_) {}
    return out;
  }
  function findEmission() {
    return frames(window.top).find(w => { try { return w.document.querySelector('#vGRHTPOPRCIDFILTRO') && !w.frameElement?.dataset.sceWorker; } catch (_) { return false; } });
  }
  function state(doc) {
    try { return JSON.parse(doc.querySelector('input[name="GXState"]')?.value || '{}'); } catch (_) { return {}; }
  }
  function frameCreate() {
    const f = document.createElement('iframe'); f.dataset.sceWorker = '1';
    f.title = 'Consulta de contratos em segundo plano'; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
    // Fora da área visível, mas renderizável. display:none produz páginas vazias.
    f.style.cssText = 'position:fixed;left:-16000px;top:0;width:1200px;height:1000px;border:0;pointer-events:none';
    document.body.append(f); return f;
  }
  async function loadFrame(f, url) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { f.onload = null; reject(Error('Tempo esgotado ao abrir a emissão.')); }, LIMIT);
      f.onload = () => { clearTimeout(timer); f.onload = null; resolve(); };
      f.src = url;
    });
    await sleep(350);
    const d = f.contentDocument;
    if (!d?.querySelector('#vGRHTPOPRCIDFILTRO')) throw Error('A emissão não carregou. Confira a sessão e a escola.');
  }
  function visible(el) {
    return !!el && !el.disabled && !el.hasAttribute('disabled') && el.ownerDocument.defaultView.getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
  }
  function queryButton(d) {
    const items = [...d.querySelectorAll('input[type=button],input[type=submit],input[type=image],button,a,img')];
    return items.find(e => visible(e) && /consultar|pesquisar/.test(norm([e.value, e.title, e.alt, e.textContent, e.name, e.id].join(' '))));
  }
  // Exige atividade observável: não considera a grade antiga como resposta da consulta.
  async function actionSettled(w, action) {
    const d = w.document;
    let pending = 0, activity = false, last = Date.now();
    const proto = w.XMLHttpRequest.prototype, original = proto.send;
    proto.send = function (...args) {
      pending++; activity = true; last = Date.now();
      this.addEventListener('loadend', () => { pending--; last = Date.now(); }, { once: true });
      try { return original.apply(this, args); } catch (e) { pending--; throw e; }
    };
    const ob = new w.MutationObserver(() => { activity = true; last = Date.now(); });
    ob.observe(d.body, { childList: true, subtree: true, characterData: true });
    const start = Date.now();
    try {
      action();
      while (Date.now() - start < LIMIT) {
        await sleep(200);
        if (w.document !== d) {
          if (w.document.readyState === 'complete') { await sleep(600); return; }
        } else if (activity && !pending && Date.now() - last > 900) return;
      }
      throw Error('A consulta não confirmou atualização da grade em 45 segundos.');
    } finally { ob.disconnect(); proto.send = original; }
  }
  async function chooseType(value) {
    // Reinicia a consulta para não misturar páginas, filtros e linhas do tipo anterior.
    await loadFrame(worker, workerURL);
    const w = worker.contentWindow, d = w.document, select = d.querySelector('#vGRHTPOPRCIDFILTRO');
    select.value = value;
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    select.dispatchEvent(new w.Event('blur', { bubbles: true }));
    await sleep(1200);
    const b = queryButton(worker.contentDocument);
    if (!b) throw Error('Botão Consultar/Pesquisar não identificado na emissão.');
    await actionSettled(worker.contentWindow, () => b.click());
    const errorText = [...worker.contentDocument.querySelectorAll('[id$=gxErrorViewer]')].map(e => clean(e.textContent)).filter(Boolean).join(' ');
    if (errorText) throw Error('Mensagem do sistema: ' + errorText);
    if (!worker.contentDocument.querySelector('#vGRHTPOPRCIDFILTRO')) throw Error('Sessão expirada ou página de emissão indisponível.');
    if (worker.contentDocument.querySelector('#vGRHTPOPRCIDFILTRO').value !== value) throw Error('O tipo selecionado não foi mantido após a consulta.');
    checkType(value);
  }
  function checkType(value) {
    const rows = getRows();
    for (const r of rows) {
      const type = text(r, '[id^="span_vCODTIPOPROCESSO_"]');
      const lot = text(r, '[id^="span_vGRHLOTCOD_"]');
      if (type && type !== value) throw Error('A grade contém outro tipo de processo; exportação deste tipo interrompida.');
      if (scope && lot && lot !== scope) throw Error('Lotação da linha difere da escola selecionada.');
    }
  }
  function getRows() { return [...new Set([...worker.contentDocument.querySelectorAll('[id^="span_vPROCESSO_"]')].map(e => e.closest('tr')).filter(Boolean))]; }
  function signature() { return getRows().map(r => text(r, '[id^="span_vPROCESSO_"]') + ':' + text(r, '[id^="span_vGRHCNTPTOSRVCOD_"]')).join('|'); }
  function nextButton() {
    const d = worker.contentDocument;
    const controls = [...d.querySelectorAll('a,button,input[type=button],input[type=image],img')];
    return controls.find(e => visible(e) && /^(proxima( pagina)?|seguinte|next( page)?|avancar|>)$/.test(norm(e.title || e.alt || e.value || e.textContent))) ||
      controls.find(e => visible(e) && /(?:^|[_-])(next|proxima)(?:$|[_-])/i.test(e.id));
  }
  function captureURL(button) {
    return new Promise((resolve, reject) => {
      const restores = [], timers = [];
      let done = false;
      function end(error, url) {
        if (done) return; done = true;
        timers.forEach(clearTimeout); restores.reverse().forEach(f => f()); currentCapture = null;
        error ? reject(error) : resolve(url);
      }
      function receive(value) {
        if (!value || String(value) === 'about:blank') return;
        try {
          const u = new URL(String(value), worker.contentWindow.location.href);
          if (u.origin !== location.origin || !/^\/grh\//i.test(u.pathname)) throw Error('Destino de impressão inesperado.');
          if (!/\.aspx$/i.test(u.pathname)) throw Error('O botão não retornou uma página de documento.');
          end(null, u.href);
        } catch (e) { end(e); }
      }
      const loc = { assign: receive, replace: receive, toString: () => 'about:blank' };
      Object.defineProperty(loc, 'href', { get: () => 'about:blank', set: receive });
      const stub = { closed: false, focus() {}, blur() {}, close() {}, print() {}, document: { write() {}, close() {} } };
      Object.defineProperty(stub, 'location', { get: () => loc, set: receive });
      for (const w of new Set([worker.contentWindow, window, window.top])) {
        const original = w.open;
        w.open = value => { receive(value); return stub; };
        restores.push(() => { w.open = original; });
      }
      const handler = e => {
        const a = e.target.closest?.('a[href]');
        if (a && a.target && a.target !== '_self' && !/^javascript:/i.test(a.href)) { e.preventDefault(); receive(a.href); }
      };
      worker.contentDocument.addEventListener('click', handler, true);
      restores.push(() => worker.contentDocument?.removeEventListener('click', handler, true));
      timers.push(setTimeout(() => end(Error('Não foi possível capturar a URL do botão de impressão.')), LIMIT));
      currentCapture = () => end(Error('Captura encerrada.'));
      try { button.click(); } catch (e) { end(e); }
    });
  }
  async function fetchHTML(url) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), LIMIT);
    try {
      const r = await fetch(url, { credentials: 'same-origin', signal: ctrl.signal });
      if (!r.ok) throw Error('HTTP ' + r.status + ' ao obter documento.');
      // O navegador interpreta a estrutura original como na impressão do sistema.
      const html = await r.text();
      const d = new DOMParser().parseFromString(html, 'text/html');
      const root = d.querySelector('#HTML');
      if (!root || clean(root.textContent).length < 150) throw Error('Documento vazio, sessão expirada ou formato diferente de #HTML.');
      return { d, root };
    } finally { clearTimeout(timer); }
  }
  async function resource(url, asText = false) {
    const u = new URL(url, workerURL);
    if (u.protocol === 'data:') return u.href;
    if (u.origin !== location.origin) throw Error('Recurso de outro domínio: ' + u.hostname);
    const key = (asText ? 'css:' : 'data:') + u.href;
    if (!resourceCache.has(key)) resourceCache.set(key, (async () => {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), LIMIT);
      try {
        const r = await fetch(u.href, { credentials: 'same-origin', signal: ctrl.signal });
        if (!r.ok) throw Error('Recurso indisponível (HTTP ' + r.status + '): ' + u.pathname);
        if (asText) return await r.text();
        const blob = await r.blob();
        if (/text\/html/i.test(blob.type)) throw Error('Uma imagem/fonte retornou uma página HTML. Confira a sessão.');
        return await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(Error('Falha ao incorporar recurso.')); reader.readAsDataURL(blob);
        });
      } finally { clearTimeout(timer); }
    })());
    return await resourceCache.get(key); // Cacheia também falhas: não repete o mesmo 404 em cada contrato.
  }
  async function replaceAsync(value, regex, fn) {
    let out = '', last = 0;
    for (const m of value.matchAll(regex)) { out += value.slice(last, m.index) + await fn(m); last = m.index + m[0].length; }
    return out + value.slice(last);
  }
  async function inlineCSS(css, base, depth = 0) {
    if (depth > 6) throw Error('Importação circular de CSS.');
    css = await replaceAsync(css, /@import\s+(?:url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([^;]*);/gi, async m => {
      const u = new URL(m[1] || m[2], base).href;
      try {
        const inner = await inlineCSS(await resource(u, true), u, depth + 1);
        return m[3].trim() ? '@media ' + m[3].trim() + '{' + inner + '}' : inner;
      } catch (e) {
        resourceWarnings.add(e.message);
        return '@import url(\"' + u + '\") ' + m[3].trim() + ';';
      }
    });
    css = await replaceAsync(css, /url\(\s*(['"]?)(.*?)\1\s*\)/gi, async m => {
      const raw = m[2].trim();
      if (!raw || /^(data:|#)/i.test(raw)) return m[0];
      const u = new URL(raw, base).href;
      try { return 'url(\"' + await resource(u) + '\")'; }
      catch (e) { resourceWarnings.add(e.message); return 'url(\"' + u + '\")'; }
    });
    return css.replace(/@charset\s+[^;]+;/gi, '');
  }
  async function makeHTML(url, process, title) {
    resourceWarnings = new Set();
    const { d, root } = await fetchHTML(url);
    if (!root.textContent.includes(process)) throw Error('Documento retornado de outro processo.');
    const st = state(d);
    if (scope && st.vGERLOTCOD && String(st.vGERLOTCOD) !== scope) throw Error('Documento de outra lotação.');
    const hasWatermark = /marcadaguaoficial\.png/i.test(d.documentElement.innerHTML);
    // Preserva MAINFORM, #HTML, classes, tabelas e seus cabeçalhos/rodapés.
    // Remove apenas código executável, campos de sessão e controles interativos.
    d.querySelectorAll('script,input,button,iframe,object,embed,base,meta[http-equiv],link:not([rel="stylesheet"])').forEach(e => e.remove());
    for (const el of d.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (el.tagName === 'FORM') { el.removeAttribute('action'); el.removeAttribute('method'); }
      if (el.tagName === 'A') el.removeAttribute('href');
    }
    for (const el of [...d.querySelectorAll('style,link[rel="stylesheet"]')]) {
      if (el.tagName === 'LINK') {
        const u = new URL(el.getAttribute('href'), url).href;
        const style = d.createElement('style');
        if (el.media) style.media = el.media;
        try {
          style.textContent = await inlineCSS(await resource(u, true), u);
          el.replaceWith(style);
        } catch (e) { resourceWarnings.add(e.message); el.setAttribute('href', u); }
      } else el.textContent = await inlineCSS(el.textContent, url);
    }
    if (hasWatermark && d.getElementById('MAINFORM')) d.getElementById('MAINFORM').style.backgroundImage = 'url("' + new URL('imagem/marcadaguaoficial.png', url).href + '")';
    for (const el of d.querySelectorAll('[style]')) el.setAttribute('style', await inlineCSS(el.getAttribute('style'), url));
    for (const el of d.querySelectorAll('[src],[background]')) {
      for (const attr of ['src', 'background']) if (el.hasAttribute(attr)) {
        const u = new URL(el.getAttribute(attr), url).href;
        try { el.setAttribute(attr, await resource(u)); }
        catch (e) { resourceWarnings.add(e.message); el.setAttribute(attr, u); }
      }
      el.removeAttribute('srcset'); el.removeAttribute('loading');
    }
    d.body.style.opacity = '1';
    d.body.style.removeProperty('-moz-opacity');
    const style = d.createElement('style');
    style.textContent = 'html,body{opacity:1!important;}';
    d.head.append(style);
    const charset = d.createElement('meta'); charset.setAttribute('charset', 'utf-8'); d.head.prepend(charset);
    // Permite apenas recursos incorporados e do domínio original; bloqueia scripts.
    const csp = d.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy';
    csp.content = "default-src 'none'; img-src data: " + location.origin + "; font-src data: " + location.origin + "; style-src 'unsafe-inline' data: " + location.origin + "; form-action 'none'; base-uri 'none'";
    d.head.prepend(csp);
    d.title = title;
    // Mantém o modo de renderização do original, inclusive HTML sem DOCTYPE.
    const doctype = d.doctype ? new XMLSerializer().serializeToString(d.doctype) + '\n' : '';
    return doctype + d.documentElement.outerHTML;
  }
  function compareDocuments(a, b) {
    const processA = BigInt(String(a.process).replace(/\D/g, '') || '0');
    const processB = BigInt(String(b.process).replace(/\D/g, '') || '0');
    if (processA !== processB) return processA < processB ? -1 : 1;
    const order = { 'Contrato': 0, 'Retificação': 1, 'Distrato': 2 };
    return (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.index - b.index;
  }
  function combineServerHTML(group) {
    const docs = [...group.docs].sort(compareDocuments);
    const out = new DOMParser().parseFromString(docs[0].html, 'text/html');
    out.title = group.name + ' - Processos';
    out.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(e => e.remove());
    out.body.replaceChildren();
    out.body.removeAttribute('style'); out.body.style.opacity = '1';
    const root = out.createElement('div'); root.id = 'HTML'; out.body.append(root);
    docs.forEach((entry, index) => {
      const source = new DOMParser().parseFromString(entry.html, 'text/html');
      // IDs únicos por documento: estilos por ID não atingem outro contrato.
      const ids = new Map();
      for (const el of source.body.querySelectorAll('[id]')) {
        const original = el.id, renamed = 'sce_doc_' + index + '_' + original;
        ids.set(original, renamed); el.id = renamed;
      }
      for (const el of source.body.querySelectorAll('[for]')) if (ids.has(el.htmlFor)) el.htmlFor = ids.get(el.htmlFor);
      for (const style of source.querySelectorAll('style')) {
        const node = out.createElement('style');
        if (style.media) node.media = style.media;
        node.textContent = style.textContent.replace(/#([A-Za-z_][\w-]*)/g, (match, id) => ids.has(id) ? '#' + ids.get(id) : match);
        out.head.append(node);
      }
      for (const link of source.querySelectorAll('link[rel="stylesheet"]')) {
        if (![...out.head.querySelectorAll('link')].some(e => e.href === link.href)) out.head.append(out.importNode(link, true));
      }
      const section = out.createElement('div');
      section.className = source.body.className;
      if (source.body.getAttribute('style')) section.setAttribute('style', source.body.getAttribute('style'));
      section.dataset.processo = entry.process; section.dataset.documento = entry.kind; section.dataset.tipoProcesso = entry.type;
      section.setAttribute('aria-label', entry.type + ' - ' + entry.kind + ' - ' + entry.process);
      section.append(...[...source.body.childNodes].map(n => out.importNode(n, true)));
      root.append(section);
      if (index < docs.length - 1) {
        const br = out.createElement('div'); br.style.cssText = 'page-break-after:always;break-after:page;height:0;margin:0;padding:0;border:0';
        root.append(br);
      }
    });
    const doctype = out.doctype ? new XMLSerializer().serializeToString(out.doctype) + '\n' : '';
    return doctype + out.documentElement.outerHTML;
  }
  async function saveServerGroups(test) {
    // Ao parar a coleta, ainda salva os grupos já coletados.
    $('#sce-stop').disabled = true;
    const names = new Map();
    for (const group of serverGroups.values()) {
      try {
        showServer(group.name);
        log('Montando arquivo de ' + group.name + ' (' + group.docs.length + ' documentos)…');
        const html = combineServerHTML(group);
        resourceWarnings = new Set();
        const blob = new Blob([html], {type:'text/html;charset=utf-8'});
        let basename = safe(group.name) + ' - Servidor ' + safe(group.serverCode) + ' - Processos';
        const key = basename.toLocaleLowerCase('pt-BR');
        if (names.has(key)) basename += ' - Servidor ' + safe(group.serverCode);
        names.set(key, true);
        const filename = basename + '.html';
        if (test) download(blob, filename); else { zip.file('Por servidor/' + filename, blob); inZip++; }
        savedFiles++;
        record('', group.name, '', 'Agrupado', 'GERADO', filename + ' — ' + group.docs.length + ' documentos');
        for (const warning of resourceWarnings) record('', group.name, '', 'Agrupado', 'AVISO DE RECURSO', warning);
        group.docs.length = 0; // Libera HTMLs individuais após preparar o arquivo.
      } catch (e) {
        record('', group.name, '', 'Agrupado', 'FALHA', e.message);
        log('Falha ao agrupar ' + group.name + ': ' + e.message);
      }
    }
    serverGroups.clear();
  }
  function download(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  async function flush() {
    if (!inZip) return;
    showServer();
    log(`Compactando ZIP único (${inZip} arquivos)…`);
    const b = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }, info => { $('#sce-status').textContent = 'Preparando ZIP · ' + Math.floor(info.percent) + '%'; });
    download(b, `Contratos_${safe(scope || 'escola')}_${stamp()}.zip`);
    zip = new JSZip(); inZip = 0;
  }
  function record(type, name, process, kind, status, detail) {
    report.push({ tipo: type, nome: name, processo: process, documento: kind, resultado: status, detalhe: detail });
    if (/FALHA|INTERROMPIDO/.test(status)) failureCount++;
  }
  function csv() {
    const keys = ['tipo', 'nome', 'processo', 'documento', 'resultado', 'detalhe'];
    const q = s => '"' + String(s ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    return '\ufeff' + [keys, ...report.map(r => keys.map(k => r[k]))].map(r => r.map(q).join(';')).join('\r\n');
  }
  async function run(test) {
    if (running) return;
    if (preparing) return;
    if (!availableTypes.length || !workerURL || !scope) { await prepareEmission(); return; }
    const types = availableTypes.filter(type => typeNodes.get(type.value)?.querySelector('input').checked);
    if (!types.length) { log('Selecione pelo menos um tipo de processo.'); return; }
    if (typeof JSZip === 'undefined') { log('A biblioteca ZIP não carregou. Reinstale o script e confira a conexão.'); return; }
    showServer();
    const extras = $('#sce-extra').checked;
    const emitCSV = $('#sce-csv').checked, groupByServer = $('#sce-group').checked;
    attempts = 0; savedFiles = 0; failureCount = 0; serverGroups.clear(); resourceCache.clear();
    running = true; stop = false; saveFailure = ''; report = []; total = 0; inZip = 0; zip = new JSZip(); seen.clear(); filenames.clear();
    setBusy(true); $('#sce-log').replaceChildren();
    for (const type of availableTypes) typeStatus(type.value, types.includes(type) ? 'Aguardando' : 'Não selecionado');
    worker = frameCreate();
    try {
      for (const type of types) {
        if (stop || (test && attempts)) break;
        showServer();
        $('#sce-current-type').textContent = type.label;
        typeStatus(type.value, 'Consultando…', 'active');
        const before = total, reportStart = report.length;
        log('Consultando: ' + type.label);
        try {
          await chooseType(type.value);
          const pageSeen = new Set(); let pageNo = 0;
          while (!stop && !(test && attempts)) {
            checkType(type.value);
            const sig = signature();
            if (pageSeen.has(sig)) throw Error('Paginação repetiu a mesma grade. Verifique se há páginas não exportadas.');
            pageSeen.add(sig); pageNo++;
            const rows = getRows();
            typeStatus(type.value, 'Página ' + pageNo + ' · ' + rows.length + ' processos', 'active');
            if (!rows.length) record(type.label, '', '', '', 'SEM REGISTROS', 'Consulta concluída sem linhas.');
            for (const row of rows) {
              if (stop || (test && attempts)) break;
              const process = text(row, '[id^="span_vPROCESSO_"]'), name = text(row, '[id^="span_vNOMESERVIDOR2_"]');
              if (!process || !name) { record(type.label, name, process, '', 'FALHA', 'Nome/processo ausente na linha.'); continue; }
              const kinds = [['Contrato', 'vBITIMPRIMIR_'], ...(extras ? [['Retificação', 'vRETIFICADO_'], ['Distrato', 'vDISTRATO_']] : [])];
              for (const [kind, prefix] of kinds) {
                if (stop || (test && attempts)) break;
                const b = row.querySelector('[id^="' + prefix + '"]');
                if (!visible(b)) { if (kind === 'Contrato') record(type.label, name, process, kind, 'INDISPONÍVEL', 'Botão de impressão oculto ou desabilitado.'); continue; }
                showServer(name);
                log(`${total + 1}: ${name} — ${kind}`);
                try {
                  attempts++;
                  const url = await captureURL(b);
                  const key = kind + '|' + url;
                  if (seen.has(key)) { record(type.label, name, process, kind, 'DUPLICADO', 'Mesmo endereço já convertido nesta execução.'); continue; }
                  const html = await makeHTML(url, process, kind + ' - ' + safe(name) + ' - ' + safe(process));
                  if (groupByServer) {
                    const serverCode = text(row, '[id^="span_vGRHSRVCOD_"]');
                    const identity = serverCode ? 'servidor:' + serverCode : '';
                    if (!identity) throw Error('Código do servidor ausente: agrupamento não realizado para evitar unir pessoas diferentes.');
                    if (!serverGroups.has(identity)) serverGroups.set(identity, { name, serverCode, docs: [] });
                    serverGroups.get(identity).docs.push({ html, process, kind, type: type.label, index: total });
                    record(type.label, name, process, kind, 'COLETADO PARA AGRUPAR', 'Servidor ' + serverCode);
                  } else {
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    const base = kind + ' - ' + safe(name) + ' - ' + safe(process);
                    const path = safe(type.label) + '/' + base;
                    const n = (filenames.get(path) || 0) + 1; filenames.set(path, n);
                    const filename = base + (n > 1 ? ' - versão ' + n : '') + '.html';
                    if (test) download(blob, filename); else { zip.file(safe(type.label) + '/' + filename, blob); inZip++; }
                    savedFiles++;
                    record(type.label, name, process, kind, 'GERADO', filename);
                  }
                  seen.add(key); total++; refreshStats();
                  for (const warning of resourceWarnings) record(type.label, name, process, kind, 'AVISO DE RECURSO', warning + ' — endereço original mantido no HTML.');
                  if (resourceWarnings.size) log('Documento processado com ' + resourceWarnings.size + ' aviso(s): ' + [...resourceWarnings].join(' | '));
                  await sleep(150);
                } catch (e) { record(type.label, name, process, kind, 'FALHA', e.message); log('Falha: ' + e.message); }
              }
            }
            if (stop || (test && attempts)) break;
            const next = nextButton();
            if (!next) break;
            if (pageNo >= 500) throw Error('Limite de paginação atingido.');
            await actionSettled(worker.contentWindow, () => next.click());
          }
          const partial = stop || (test && attempts);
          const failed = report.slice(reportStart).some(r => /FALHA/.test(r.resultado));
          record(type.label, '', '', '', partial ? 'CONSULTA PARCIAL' : 'CONSULTADO', pageNo + ' página(s) visitada(s).' + (partial ? ' Consulta não percorrida integralmente.' : ''));
          typeStatus(type.value, (partial ? 'Parcial · ' : failed ? 'Com falhas · ' : 'Concluído · ') + (total - before) + ' documentos', failed ? 'error' : partial ? '' : 'done');
        } catch (e) { record(type.label, '', '', '', 'FALHA DE CONSULTA', e.message); typeStatus(type.value, 'Falha na consulta', 'error'); log(e.message); }
      }
    } catch (e) { record('', '', '', '', 'INTERROMPIDO', e.message); }
    finally {
      try { if (groupByServer) await saveServerGroups(test); await flush(); }
      catch (e) { saveFailure = ' FALHA AO SALVAR: ' + e.message; record('', '', '', '', 'FALHA AO SALVAR', e.message); }
      if (emitCSV) {
        try { download(new Blob([csv()], { type: 'text/csv;charset=utf-8' }), 'Relatorio_exportacao_' + stamp() + '.csv'); }
        catch (e) { saveFailure += ' FALHA NO CSV: ' + e.message; }
      }
      currentCapture?.(); worker?.remove(); running = false; showServer();
      setBusy(false); resourceCache.clear();
      for (const type of types) { const node = typeNodes.get(type.value); if (node.querySelector('small').textContent === 'Aguardando') typeStatus(type.value, 'Não consultado'); }
      $('#sce-current-type').textContent = stop ? 'Exportação interrompida' : 'Exportação finalizada';
      const warnings = report.filter(r => r.resultado === 'AVISO DE RECURSO').length;
      const failures = report.filter(r => /FALHA|INTERROMPIDO/.test(r.resultado)).length;
      log(`${stop ? 'Interrompido' : 'Finalizado'}: ${total} documento(s) processado(s), ${savedFiles} arquivo(s) HTML gerado(s), ${failures} falha(s), ${warnings} aviso(s). Confira os downloads.${emitCSV ? ' Relatório CSV solicitado.' : ' Relatório CSV desativado.'}${saveFailure}${test ? ' Abra o HTML no Chrome e confira com Ctrl+P.' : ''}`);
    }
  }
  prepareEmission();
})();
