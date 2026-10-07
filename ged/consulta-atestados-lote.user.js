// ==UserScript==
// @name         SIGEDUCA - Consulta de Atestados em Lote
// @namespace    sigeduca.consulta.atestados
// @version      2.0.4
// @description  Painel de consulta por código do aluno, detalhes em segundo plano, paginação e relatórios HTML/PDF/CSV.
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @require      https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-atestados-lote.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-atestados-lote.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @noframes
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window.self) return;
    const HASH_FERRAMENTA = '#consulta-atestados-lote';
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '2.0.4',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-atestados-lote.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-atestados-lote.user.js'
    });
    const FERRAMENTA = Object.freeze({
        id: 'consulta-atestados-lote',
        titulo: 'Consulta de Atestados em Lote',
        url: 'hwmgedatestado.aspx' + HASH_FERRAMENTA,
        descricao: 'Consulta atestados por código do aluno, com relatórios PDF, HTML e CSV.',
        ordem: 35,
        grupo: ''
    });
    function registrarNoMenuFerramentas() {
        window.dispatchEvent(new CustomEvent('sigeduca:ferramentas:registrar', {
            detail: { ...FERRAMENTA, ...ATUALIZACAO_SCRIPT }
        }));
    }
    window.addEventListener('sigeduca:ferramentas:solicitar-registro', registrarNoMenuFerramentas);
    window.addEventListener('sigeduca:ferramentas:base-pronta', registrarNoMenuFerramentas);
    registrarNoMenuFerramentas();
    setTimeout(registrarNoMenuFerramentas, 100);

    const rotaAtiva = () => /\/ged\/hwmgedatestado\.aspx$/i.test(window.location.pathname) &&
        window.location.hash.toLowerCase() === HASH_FERRAMENTA;
    const ativaAoCarregar = rotaAtiva();
    // Trocar entre a página original e a ferramenta reinicia a tela GeneXus.
    window.addEventListener('hashchange', () => {
        if (rotaAtiva() !== ativaAoCarregar) window.location.reload();
    });
    if (!ativaAoCarregar || window.__ATESTADOS_LOTE_V2__) return;
    window.__ATESTADOS_LOTE_V2__ = true;
    const ID = 'tm-atestados-lote-v2';
    const $ = id => document.getElementById(id);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
        c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const normCode = v => clean(v).replace(/^0+(?=\d)/, '');
    const now = () => new Date().toLocaleString('pt-BR');
    const queries = [];
    let running = false, stop = false, nativeVisible = false, nativeTable = null;
    let context = null;
    const TYPES = {1: 'Médico', 2: 'Reservista Militar', 3: 'Outros'};
    const panel = document.createElement('section');
    panel.id = ID;
    const q = name => panel.querySelector('[data-ui="' + name + '"]');

    function value(doc, id) {
        const el = doc.getElementById(id) || doc.getElementById('span_' + id);
        if (!el) return '';
        if (el.tagName === 'SELECT') return clean(el.selectedOptions[0]?.textContent);
        return clean('value' in el ? el.value : el.textContent);
    }
    function required(doc, id) {
        if (!doc.getElementById(id) && !doc.getElementById('span_' + id)) {
            throw new Error('Detalhes incompletos: campo ' + id + ' ausente.');
        }
        return value(doc, id);
    }
    function captureContext() {
        return {
            school: value(document, 'MPW0010TLOTACAO') || 'Escola não informada',
            city: value(document, 'MPW0010TCIDADE'),
            year: value(document, 'MPW0010TANOLETIVO'),
            source: location.origin + location.pathname
        };
    }

    const style = document.createElement('style');
    style.textContent =
        'body.Form{background:#edf2f7!important}' +
        '#TABLE1_MPAGE{width:min(1180px,98vw)!important}' +
        '[data-atestado-hidden="1"]{display:none!important}' +
        '#' + ID + '{display:block!important;max-width:1140px;margin:20px auto;' +
        'color:#172b45;background:#fff;border:1px solid #d6e1eb;border-radius:16px;' +
        'box-shadow:0 12px 36px #16345114;overflow:hidden;font:14px/1.5 Arial,sans-serif;text-align:left}' +
        '#' + ID + ' *{box-sizing:border-box}' +
        '#' + ID + ' header{padding:25px 28px;background:#123451;color:white}' +
        '#' + ID + ' h1{font-size:25px;margin:3px 0 6px;color:white}' +
        '#' + ID + ' header p{margin:0;color:#caddf0}' +
        '#' + ID + ' .eyebrow{letter-spacing:2px;font-size:11px;color:#8ed8d1}' +
        '#' + ID + ' .body{padding:24px}' +
        '#' + ID + ' .top{display:grid;grid-template-columns:1.25fr 1fr;gap:24px}' +
        '#' + ID + ' label{display:block;font-weight:700;margin-bottom:7px}' +
        '#' + ID + ' textarea{width:100%;min-height:180px;border:1px solid #b9cad8;' +
        'border-radius:9px;padding:12px;font:14px/1.5 Consolas,monospace}' +
        '#' + ID + ' .hint{font-size:12px;color:#63768a;margin:6px 0 12px}' +
        '#' + ID + ' .stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '#' + ID + ' .stat{padding:15px;border:1px solid #e0e8ef;border-radius:10px;background:#f7fafc}' +
        '#' + ID + ' .stat b{display:block;font-size:28px;color:#126e76}' +
        '#' + ID + ' .stat span{font-size:12px;color:#53697d}' +
        '#' + ID + ' button{padding:10px 14px;border:1px solid #bdcddc;border-radius:8px;' +
        'background:#fff;color:#173650;font-weight:700;cursor:pointer;margin:3px}' +
        '#' + ID + ' button.primary{background:#087e83;color:white;border-color:#087e83}' +
        '#' + ID + ' button:disabled{opacity:.45;cursor:default}' +
        '#' + ID + ' .status{background:#edf5fa;padding:12px;border-radius:8px;margin:16px 0 8px}' +
        '#' + ID + ' progress{width:100%;height:9px;accent-color:#087e83}' +
        '#' + ID + ' .toolbar{margin:15px 0;display:flex;flex-wrap:wrap;gap:4px}' +
        '#' + ID + ' .scroll{max-height:440px;overflow:auto}' +
        '#' + ID + ' table{width:100%;border-collapse:collapse;font-size:12px}' +
        '#' + ID + ' th{background:#edf3f8;position:sticky;top:0}' +
        '#' + ID + ' th,#' + ID + ' td{padding:10px;border-bottom:1px solid #e1e8ef;text-align:left}' +
        '#' + ID + ' .error{color:#9b3b20}' +
        '@media(max-width:760px){#' + ID + ' .top{grid-template-columns:1fr}#' + ID + '{margin:10px}}';
    document.head.appendChild(style);
    panel.innerHTML =
        '<header><div class="eyebrow">SIGEDUCA / SECRETARIA ESCOLAR</div>' +
        '<h1>Consulta de Atestados em Lote</h1>' +
        '<p data-ui="context"></p></header><div class="body"><div class="top"><div>' +
        '<label for="atl-codes">Códigos dos alunos — um por linha</label>' +
        '<textarea id="atl-codes" data-ui="list" spellcheck="false" placeholder="Cole os códigos dos alunos"></textarea>' +
        '<p class="hint">Use o código do aluno no SIGEDUCA. A consulta desta tela não aceita nome ou CPF.' +
        ' Os detalhes e todas as páginas serão lidos em sequência.</p></div>' +
        '<div><div class="stats" data-ui="stats"></div>' +
        '<p class="hint">Os resultados ficam nesta aba até recarregar ou limpar. Exporte antes de sair.</p></div></div>' +
        '<div class="toolbar"><button type="button" class="primary" data-ui="start">Iniciar consultas</button>' +
        '<button type="button" data-ui="stop" disabled>Parar</button>' +
        '<button type="button" data-ui="native">Mostrar tela original</button>' +
        '<button type="button" data-ui="clear">Limpar resultados</button></div>' +
        '<div class="status" role="status" data-ui="status">Pronto para consultar.</div>' +
        '<progress data-ui="progress" value="0" max="1"></progress>' +
        '<div class="toolbar"><button type="button" data-ui="pdf">Abrir PDF</button>' +
        '<button type="button" data-ui="html">Abrir relatório HTML</button>' +
        '<button type="button" data-ui="csv">Exportar CSV</button></div>' +
        '<div class="scroll" data-ui="results"></div></div>';

    function status(message) { q('status').textContent = message; }
    function records() { return queries.flatMap(item => item.records); }
    function buttons() {
        q('start').disabled = running;
        q('stop').disabled = !running || stop;
        ['list','clear','native'].forEach(name => { q(name).disabled = running; });
        ['pdf','html','csv'].forEach(name => { q(name).disabled = running || !queries.length; });
    }
    function render() {
        const stats = [
            [queries.length, 'alunos consultados'],
            [records().length, 'atestados encontrados'],
            [queries.filter(x => x.state === 'SEM ATESTADOS').length, 'consultas sem atestados'],
            [queries.filter(x => ['PARCIAL','ERRO','INTERROMPIDA'].includes(x.state)).length, 'consultas com pendência']
        ];
        q('stats').innerHTML = stats.map(x =>
            '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('');
        q('results').innerHTML = queries.length
            ? '<table><thead><tr><th>Código aluno</th><th>Aluno</th><th>Atestados</th><th>Situação</th><th>Observação</th></tr></thead><tbody>' +
              queries.map(x => '<tr><td>' + esc(x.code) + '</td><td>' + esc(x.name || '—') +
              '</td><td>' + x.records.length + '</td><td>' + esc(x.state) +
              '</td><td>' + esc(x.note) + '</td></tr>').join('') + '</tbody></table>'
            : '<p class="hint">Os resultados aparecerão aqui.</p>';
        buttons();
    }
    function morph() {
        const campo = $('vGEDALUCOD');
        const table = $('TABLE4');
        if (!campo || !table || !table.contains(campo)) return false;
        nativeTable = table;
        if (!panel.isConnected) table.parentNode.insertBefore(panel, table);
        const hidden = nativeVisible ? '0' : '1';
        if (table.dataset.atestadoHidden !== hidden) table.dataset.atestadoHidden = hidden;
        document.title = 'Consulta de Atestados em Lote - SIGEDUCA';
        q('context').textContent = [context.school, context.city, context.year && 'Ano letivo ' + context.year]
            .filter(Boolean).join(' · ');
        return true;
    }

    function isNoRecordsNotice(message) {
        const normalized = clean(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        return /^(?:ATENCAO\s*[:!.-]?\s*)?NAO FORAM ENCONTRADOS REGISTROS PARA O FILTRO INFORMADO[!.\s]*$/.test(normalized);
    }
    function responseHasNoRecords(body) {
        // GeneXus pode enviar a mensagem em JSON, inclusive com acentos escapados.
        function contains(value, depth = 0) {
            if (depth > 12 || value == null) return false;
            if (typeof value === 'string') {
                const text = new DOMParser().parseFromString(value, 'text/html').body.textContent;
                return isNoRecordsNotice(text);
            }
            if (typeof value === 'object') return Object.values(value).some(v => contains(v, depth + 1));
            return false;
        }
        try { return contains(JSON.parse(body)); }
        catch (_) { return contains(body); }
    }

    // Uma mensagem de consulta vazia é resultado válido, mesmo se a grid anterior permanecer na tela.
    function waitGrid(action) {
        return new Promise((resolve, reject) => {
            const proto = XMLHttpRequest.prototype;
            const oldOpen = proto.open, oldSend = proto.send;
            const targets = new WeakSet();
            let pending = 0, seen = false, confirmed = false, changed = false;
            let responded = false, noRecords = false, messageChanged = false;
            let last = Date.now(), failure = '', done = false;
            const started = Date.now();
            const observer = new MutationObserver(mutations => {
                const grid = $('GriddetalhesContainerDiv');
                const viewer = $('gxErrorViewer');
                const touches = (m, el) => el && (m.target === el || el.contains(m.target) ||
                    [...m.addedNodes].some(node => node === el || node.contains?.(el)));
                if (mutations.some(m => touches(m, grid))) {
                    changed = true; last = Date.now();
                }
                if (mutations.some(m => touches(m, viewer))) {
                    messageChanged = true; last = Date.now();
                }
            });
            function open(method, url, ...rest) {
                try {
                    const u = new URL(String(url), location.href);
                    if (u.origin === location.origin &&
                        /\/hwmgedatestado\.aspx$/i.test(u.pathname)) targets.add(this);
                } catch (_) {}
                return oldOpen.call(this, method, url, ...rest);
            }
            function send(...args) {
                if (targets.has(this)) {
                    seen = true; pending++;
                    this.addEventListener('loadend', () => {
                        pending--; last = Date.now();
                        if (this.status < 200 || this.status >= 300) {
                            failure = 'A consulta falhou (HTTP ' + this.status + ').';
                        } else {
                            responded = true;
                            let body = '';
                            try { body = this.responseText || ''; } catch (_) {}
                            if (/Griddetalhes/i.test(body)) confirmed = true;
                            if (responseHasNoRecords(body)) noRecords = true;
                        }
                    }, {once:true});
                }
                return oldSend.apply(this, args);
            }
            function finish(error, empty = false) {
                if (done) return;
                done = true;
                clearInterval(timer);
                observer.disconnect();
                if (proto.open === open) proto.open = oldOpen;
                if (proto.send === send) proto.send = oldSend;
                error ? reject(new Error(error)) : resolve({empty});
            }
            proto.open = open; proto.send = send;
            observer.observe(document.body, {childList:true, subtree:true, characterData:true});
            const timer = setInterval(() => {
                if (pending === 0 && Date.now() - last > 800) {
                    if (failure) return finish(failure);
                    const message = clean($('gxErrorViewer')?.textContent);
                    const emptyNotice = isNoRecordsNotice(message);
                    if ((responded || changed || messageChanged) && message && !emptyNotice) return finish(message);
                    if (noRecords || (emptyNotice && messageChanged && (responded || !seen))) {
                        return finish(null, true);
                    }
                    if ((seen && confirmed) || (!seen && changed)) return finish();
                    if (responded) return finish('Resposta sem a tabela de atestados. Confira a sessão e a tela original.');
                }
                if (Date.now() - started > 30000) {
                    finish('Não foi possível confirmar a atualização da consulta em 30 segundos. Lote interrompido.');
                }
            }, 120);
            try { action(); } catch (error) { finish(error.message); }
        });
    }

    function gridRows() {
        const grid = $('GriddetalhesContainerDiv');
        if (!grid) throw new Error('Tabela de atestados não localizada.');
        const codes = [...grid.querySelectorAll('[id]')]
            .filter(el => /^(?:span_)?vGEDATECOD_\d+$/i.test(el.id));
        if (!codes.length && grid.querySelector('[id^="vALTERAR_"],[id^="span_vGEDALUNOM_"]')) {
            throw new Error('Há linhas na tabela, mas seus códigos não foram reconhecidos. Confira a tela original.');
        }
        const seen = new Set();
        return codes.map(el => {
            const suffix = el.id.match(/_(\d+)$/)[1];
            const code = normCode('value' in el ? el.value : el.textContent);
            if (!/^\d+$/.test(code) || code === '0') {
                throw new Error('Código de atestado inválido na tabela.');
            }
            if (seen.has(code)) return null;
            seen.add(code);
            const tipo = value(document, 'vGEDATETIPO_' + suffix);
            return {
                id: code, name: value(document, 'vGEDALUNOM_' + suffix),
                start: value(document, 'vGEDATEPERINI_' + suffix),
                end: value(document, 'vGEDATEPERFIN_' + suffix),
                type: TYPES[tipo] || tipo,
                status: 'PENDENTE', error: '', observedAt: now()
            };
        }).filter(Boolean);
    }

    async function details(row, expectedStudent) {
        // URL confirmada no action do formulário de detalhes fornecido pelo usuário.
        // Somente GET. O HTML é analisado sem executar scripts ou enviar o formulário.
        const url = new URL('ttgedatestado.aspx?' + row.id + ',HWMGedAtestado,UPD', location.href);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 25000);
        let response, html;
        try {
            response = await fetch(url.href, {
                method:'GET', credentials:'same-origin', cache:'no-store', signal:abort.signal
            });
            html = await response.text();
        } catch (error) {
            throw new Error(error.name === 'AbortError' ? 'Tempo de leitura dos detalhes excedido.' : error.message);
        } finally { clearTimeout(timer); }
        if (!response.ok) throw new Error('Falha nos detalhes (HTTP ' + response.status + ').');
        const finalURL = new URL(response.url || url.href);
        if (finalURL.origin !== location.origin ||
            !/\/ttgedatestado\.aspx$/i.test(finalURL.pathname)) {
            throw new Error('Sessão expirada ou redirecionamento ao abrir os detalhes.');
        }
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const id = normCode(required(doc, 'GEDATECOD'));
        const student = normCode(required(doc, 'GEDALUCOD'));
        if (id !== row.id || student !== normCode(expectedStudent)) {
            throw new Error('O código do atestado ou do aluno não corresponde à consulta. Confira a tela original.');
        }
        const data = {
            student, name: required(doc, 'GEDALUNOM'),
            type: TYPES[doc.getElementById('GEDATETIPO')?.value] || required(doc, 'GEDATETIPO'),
            start: required(doc, 'GEDATEPERINI'), end: required(doc, 'GEDATEPERFIN'),
            days: required(doc, 'GEDATEDIASLET'),
            observation: (doc.getElementById('GEDATEOBS')?.value || '').trim(),
            createdAt: value(doc, 'GEDATEINCEM'), createdBy: value(doc, 'GEDATEINCPOR'),
            changedAt: value(doc, 'GEDATEALTEM'), changedBy: value(doc, 'GEDATEALTPOR'),
            militaryNumber: value(doc, 'GERPESNMRCRTMIL'),
            militaryBranch: value(doc, 'GERPESMINCRTMIL'),
            militaryState: value(doc, 'GERPESUFCRTMIL'),
            militaryCategory: value(doc, 'GERPESCATCRTMIL'),
            status:'OK', error:''
        };
        required(doc, 'GEDATEOBS');
        return data;
    }

    function pageInfo() {
        const select = $('vPAG');
        const numbers = select ? [...select.options].map(o => Number(o.value)).filter(n => n > 0) : [];
        return {current:Number(select?.value || 1), max:Math.max(1, ...numbers)};
    }
    function nextAvailable() {
        const el = $('TPROXIMO');
        return !!el?.querySelector('a') && el.style.display !== 'none';
    }
    async function identifyEmptyStudent(item) {
        item.state = 'SEM ATESTADOS';
        item.note = 'Não possui atestados nesta consulta e ano letivo.';
        // Mesma tela de leitura usada pelo módulo Extrair Dados Pessoais.
        const url = new URL('hwtmgedaluno.aspx?' + item.code + ',,HWMConAluno,DSP,1,0', location.href);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 25000);
        try {
            const response = await fetch(url.href, {
                method:'GET', credentials:'same-origin', cache:'no-store', signal:abort.signal
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const finalURL = new URL(response.url || url.href);
            if (finalURL.origin !== location.origin ||
                !/\/hwtmgedaluno\.aspx$/i.test(finalURL.pathname) ||
                normCode(finalURL.search.slice(1).split(',')[0]) !== normCode(item.code)) {
                throw new Error('Sessão expirada ou redirecionamento na identificação do aluno.');
            }
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const name = value(doc, 'CTLGERPESNOM');
            if (!name) throw new Error('Nome do aluno não retornado pelo cadastro.');
            item.name = name;
        } catch (error) {
            item.note += ' Nome não localizado: ' + (error.name === 'AbortError' ? 'tempo de consulta excedido.' : error.message);
        } finally { clearTimeout(timer); }
    }

    async function consult(item) {
        const field = $('vGEDALUCOD');
        const button = document.querySelector('input[name="BCONSULTAR"]');
        if (!field || !button) throw new Error('Campos nativos não encontrados. Recarregue a página.');
        field.value = item.code;
        ['input','change','blur'].forEach(type => field.dispatchEvent(new Event(type, {bubbles:true})));
        await sleep(400);
        if (stop) return;
        const result = await waitGrid(() => button.click());
        if (stop) return;
        if (result.empty) {
            await identifyEmptyStudent(item);
            return;
        }
        if (pageInfo().current !== 1) {
            const select = $('vPAG');
            if (!window.gx?.evt?.execEvt || !select) throw new Error('Não foi possível retornar à primeira página.');
            await waitGrid(() => {
                select.value = '1';
                window.gx.evt.execEvt('EVPAG.CLICK.', select);
            });
            if (pageInfo().current !== 1) throw new Error('A consulta não retornou à primeira página.');
        }
        const visited = new Set();
        const collected = new Set();
        for (let page = 0; page < 1000 && !stop; page++) {
            const rows = gridRows();
            const signature = rows.map(r => r.id).join(',');
            if (signature && visited.has(signature)) throw new Error('A paginação repetiu uma página; coleta parcial.');
            visited.add(signature);
            for (const row of rows) {
                if (collected.has(row.id)) continue;
                collected.add(row.id);
                item.records.push(row);
                if (!item.name) item.name = row.name;
                if (stop) continue;
                status('Aluno ' + item.code + ' · página ' + pageInfo().current +
                    ' · lendo atestado ' + row.id + ' em segundo plano…');
                try {
                    Object.assign(row, await details(row, item.code));
                    item.name = row.name || item.name;
                } catch (error) {
                    row.status = 'FALHA NOS DETALHES';
                    row.error = error.message;
                    throw error;
                }
                render();
                await sleep(250);
            }
            if (stop) return;
            const info = pageInfo();
            if (info.current >= info.max && !nextAvailable()) {
                if (item.records.length) {
                    item.state = 'CONCLUÍDA';
                    item.note = 'Todas as páginas e detalhes lidos.';
                } else { await identifyEmptyStudent(item); }
                return;
            }
            const next = $('TPROXIMO')?.querySelector('a');
            if (!next) throw new Error('Há mais páginas, mas o botão Próximo não foi localizado.');
            if (!rows.length) throw new Error('Página vazia com indicação de próxima página; confira a consulta.');
            await waitGrid(() => next.click());
            if (pageInfo().current <= info.current) {
                throw new Error('Não foi possível confirmar o avanço da página.');
            }
        }
        if (!stop) throw new Error('Limite de 1.000 páginas atingido; coleta parcial.');
    }

    async function start() {
        if (running) return;
        const input = q('list').value.split(/\r?\n/).map(clean).filter(Boolean);
        if (!input.length) return status('Informe pelo menos um código de aluno.');
        const invalid = input.find(code => !/^\d{1,18}$/.test(code) || /^0+$/.test(code));
        if (invalid) return status('Código inválido: ' + invalid + '. Use somente o código numérico do aluno, um por linha.');
        const codes = [...new Set(input.map(normCode))];
        const currentContext = captureContext();
        if (queries.length && JSON.stringify(context) !== JSON.stringify(currentContext)) {
            return status('A escola ou o ano mudou. Exporte e limpe os resultados antes de iniciar outro contexto.');
        }
        context = currentContext;
        // Reconsultar um código substitui seu resultado anterior.
        codes.forEach(code => {
            const index = queries.findIndex(x => x.code === code);
            if (index >= 0) queries.splice(index, 1);
        });
        running = true; stop = false; nativeVisible = false; morph(); buttons();
        q('native').textContent = 'Mostrar tela original';
        q('progress').max = codes.length; q('progress').value = 0;
        render();
        try {
            for (let i = 0; i < codes.length && !stop; i++) {
                const item = {code:codes[i], name:'', state:'CONSULTANDO', note:'', records:[], time:now()};
                queries.push(item);
                status('Consultando aluno ' + item.code + ' (' + (i + 1) + '/' + codes.length + ')…');
                try {
                    await consult(item);
                    if (stop) {
                        item.state = 'INTERROMPIDA';
                        item.note = 'Consulta interrompida; a coleta pode estar incompleta.';
                    }
                } catch (error) {
                    item.state = item.records.length ? 'PARCIAL' : 'ERRO';
                    item.note = error.message;
                    status('Lote interrompido: ' + error.message + ' Os resultados já coletados podem ser exportados.');
                    q('list').value = codes.slice(i).join('\n');
                    render();
                    return;
                }
                q('progress').value = i + 1;
                q('list').value = codes.slice(stop ? i : i + 1).join('\n');
                render();
                if (!stop) await sleep(500);
            }
            status(stop ? 'Lote interrompido. Resultados parciais disponíveis para exportação.' :
                'Consulta concluída. Abra o relatório HTML, PDF ou exporte o CSV.');
        } finally { running = false; buttons(); }
    }

    function recordFields(r) {
        const fields = [
            ['Código do aluno', r.student || 'Não confirmado'],
            ['Tipo', r.type], ['Período', r.start + ' a ' + r.end],
            ['Dias letivos', r.days || 'Não disponível'],
            ['Observações', r.observation || (r.status === 'OK' ? 'Sem observações.' : 'Detalhes não coletados.')],
            ['Incluído em', r.createdAt], ['Incluído por', r.createdBy],
            ['Alterado em', /\d{2}\/\d{2}\/\d{4}/.test(r.changedAt || '') ? r.changedAt : 'Sem alteração informada'],
            ['Alterado por', r.changedBy],
            ['Coletado em', r.observedAt],
            ['Leitura dos detalhes', r.status + (r.error ? ': ' + r.error : '')]
        ];
        if (/reservista/i.test(r.type || '')) fields.push(
            ['Nº certificado militar', r.militaryNumber], ['Força', r.militaryBranch],
            ['UF do certificado', r.militaryState], ['Categoria', r.militaryCategory]
        );
        return fields.filter(x => x[1]);
    }
    function report() {
        return {
            emitted:now(), context:{...context},
            queries:JSON.parse(JSON.stringify([
                ...queries.filter(x => x.state !== 'SEM ATESTADOS'),
                ...queries.filter(x => x.state === 'SEM ATESTADOS')
            ])),
            count:records().length,
            complete:queries.filter(x => x.state === 'CONCLUÍDA').length,
            empty:queries.filter(x => x.state === 'SEM ATESTADOS').length,
            pending:queries.filter(x => !['CONCLUÍDA','SEM ATESTADOS'].includes(x.state)).length
        };
    }
    function reportHTML(model) {
        const school = [model.context.school, model.context.city, model.context.year && 'Ano letivo ' + model.context.year]
            .filter(Boolean).join(' · ');
        return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Consulta de Atestados em Lote</title><style>' +
            '*{box-sizing:border-box}body{font:14px/1.55 Arial,sans-serif;color:#23364a;background:#edf2f7;margin:0;padding:30px}' +
            'main{max-width:1000px;margin:auto;background:white;padding:40px;box-shadow:0 8px 30px #17334a12}' +
            'header{border-top:7px solid #087e83;padding:22px 0;border-bottom:1px solid #d8e3ec}' +
            '.eyebrow{font-size:11px;letter-spacing:2px;color:#087e83;font-weight:bold}' +
            'h1{font-size:30px;color:#123451;margin:8px 0}h2{font-size:18px;margin:6px 0}' +
            'h3{font-size:15px;color:#123451;margin:0 0 10px}p{margin:7px 0}' +
            '.muted{color:#63768a;font-size:12px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}' +
            '.stat{border:1px solid #dce7ee;border-radius:8px;padding:14px}.stat b{display:block;font-size:27px;color:#087e83}' +
            '.stat span{font-size:12px}.student{margin:28px 0 0}.student-head h2{overflow-wrap:anywhere}' +
            '.details-columns{column-count:2;column-gap:8mm;column-fill:balance}.field{margin-bottom:8px;break-inside:avoid}.empty-list{width:100%;border-collapse:collapse}.empty-list td,.empty-list th{text-align:left;padding:7px;border-bottom:1px solid #dce5ed}.empty-list tr{break-inside:avoid}' +
            '.student-head{padding:13px 16px;background:#edf4f8;border-left:4px solid #087e83;break-inside:avoid;break-after:avoid}' +
            '.card{padding:12px;margin:0 0 12px;border:1px solid #dce5ed;border-radius:8px}.card h3{break-after:avoid}' +
            'dl{margin:0}' +
            'dt{font-size:12px;font-weight:bold;color:#5c7184}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}' +
            '.notice{background:#fff5e8;color:#84460e;padding:12px;border-radius:7px}.footer{margin-top:28px;border-top:1px solid #dce5ed;padding-top:14px}' +
            '@page{size:A4;margin:16mm}@media print{body{background:white;padding:0}main{padding:0;box-shadow:none;max-width:none}' +
            'h1{font-size:24px}.stats{gap:8px}a{color:inherit}header{padding-top:12px}.student{break-before:page}.student:first-of-type{break-before:auto}.empty-section{break-before:page}.details-columns{column-fill:balance}}' +
            '@media screen and (max-width:640px){body{padding:10px}main{padding:20px}.stats{grid-template-columns:1fr 1fr}.details-columns{column-count:1}}' +
            '</style></head><body><main><header><div class="eyebrow">SIGEDUCA / RELATÓRIO DE CONSULTA</div>' +
            '<h1>Consulta de Atestados em Lote</h1><p>' + esc(school) + '</p>' +
            '<p class="muted">Data de emissão do relatório: <strong>' + esc(model.emitted) + '</strong></p></header>' +
            '<div class="stats">' + [[model.queries.length,'alunos consultados'],[model.count,'atestados encontrados'],
                [model.empty,'consultas sem atestados'],[model.pending,'consultas com pendência']].map(x =>
                '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('') + '</div>' +
            (model.pending ? '<p class="notice">Relatório parcial: confira as pendências indicadas em cada aluno e atestado.</p>' : '') +
            model.queries.filter(item => item.state !== 'SEM ATESTADOS').map(item => '<section class="student"><div class="student-head"><h2>' +
                esc(item.name || 'Aluno ' + item.code) + '</h2><p class="muted">Código ' + esc(item.code) +
                ' · ' + esc(item.state) + ' · Consulta em ' + esc(item.time) + '</p></div>' +
                '<p class="muted">' + esc(item.note) + '</p>' +
                '<div class="details-columns">' + item.records.map(r => '<article class="card"><h3>Atestado ' + esc(r.id) + '</h3><dl>' +
                    recordFields(r).map(f => '<div class="field"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') +
                    '</dl></article>').join('') + '</div></section>').join('') +
            (model.empty ? '<section class="empty-section"><h2>Alunos sem atestados</h2>' +
                '<table class="empty-list"><thead><tr><th>Código</th><th>Aluno</th><th>Observação</th></tr></thead><tbody>' +
                model.queries.filter(item => item.state === 'SEM ATESTADOS').map(item =>
                    '<tr><td>' + esc(item.code) + '</td><td>' + esc(item.name || 'Nome não localizado') +
                    '</td><td>' + esc(item.note || 'Não possui atestados.') + '</td></tr>').join('') +
                '</tbody></table></section>' : '') +
            '<div class="footer muted">Fonte: SIGEDUCA · ' + esc(model.context.source) +
            '<br>A data de emissão acima é a deste relatório. As datas de inclusão e alteração pertencem aos registros do sistema.' +
            '<br>Para imprimir esta versão HTML ou salvar como PDF pelo navegador, use Ctrl+P.</div></main></body></html>';
    }

    function reportPDF(model) {
        const Constructor = window.jspdf?.jsPDF;
        if (!Constructor) throw new Error('A biblioteca de PDF não carregou. Reinstale o script ou use o relatório HTML e Ctrl+P.');
        const doc = new Constructor({unit:'mm', format:'a4', compress:true});
        doc.setProperties({title:'Consulta de Atestados em Lote', subject:'Emissão: ' + model.emitted, creator:'SIGEDUCA - Consulta em Lote'});
        const left = 17, width = 176, bottom = 276;
        let y = 20;
        const pdfText = v => String(v ?? '').normalize('NFC')
            .replace(/[\u2013\u2014]/g,'-').replace(/\u2026/g,'...')
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')
            .replace(/[^\u0020-\u00ff\n\r\t]/g,'?');
        function newPage() {
            doc.addPage(); y = 18;
            doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(18,52,81);
            doc.text('CONSULTA DE ATESTADOS EM LOTE', left, y);
            doc.setDrawColor(8,126,131); doc.line(left,y+3,193,y+3); y += 12;
        }
        function space(h) { if (y + h > bottom) newPage(); }
        function text(content, size = 10, bold = false, color = [35,54,74]) {
            doc.setFont('helvetica',bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
            const lines = doc.splitTextToSize(pdfText(content), width);
            const step = size * .3528 * 1.4;
            for (const line of lines) {
                if (y + step > bottom) {
                    newPage();
                    doc.setFont('helvetica',bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
                }
                doc.text(line,left,y + size * .3528); y += step;
            }
            y += 1.5;
        }
        doc.setFillColor(8,126,131); doc.rect(left,10,width,2,'F');
        text('SIGEDUCA / RELATÓRIO DE CONSULTA',9,true,[8,126,131]);
        text('Consulta de Atestados em Lote',21,true,[18,52,81]);
        text([model.context.school,model.context.city,'Ano letivo ' + model.context.year].filter(Boolean).join(' / '),10);
        text('Data de emissão do relatório: ' + model.emitted,9,false,[91,110,127]);
        y += 5;
        const stats = [[model.queries.length,'alunos consultados'],[model.count,'atestados'],
            [model.empty,'sem atestados'],[model.pending,'com pendência']];
        stats.forEach((s,i) => {
            const x = left + i*45;
            doc.setFillColor(237,245,248); doc.roundedRect(x,y,41,21,2,2,'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(8,126,131);
            doc.text(String(s[0]),x+4,y+9);
            doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(65,86,106);
            doc.text(s[1],x+4,y+16);
        });
        y += 31;
        if (model.pending) text('RELATÓRIO PARCIAL: há consultas com pendências. Confira os avisos abaixo.',10,true,[144,71,23]);
        const gap = 8, columnWidth = (width - gap) / 2;
        let column = 0, columnTop = 0, columnLimit = bottom, columnMaxY = 0, activeStudent = null, studentIndex = 0;
        function studentHeading(item, continuation = false) {
            text((item.name || 'Aluno ' + item.code) + (continuation ? ' (continuação)' : ''),12,true,[18,52,81]);
            text('Código ' + item.code + ' | ' + item.state + ' | Consulta: ' + item.time,8,false,[91,110,127]);
        }
        function nextColumn() {
            if (column === 0) { columnMaxY = Math.max(columnMaxY, y); column = 1; y = columnTop; }
            else {
                newPage(); studentHeading(activeStudent, true);
                column = 0; columnTop = y; columnLimit = bottom; columnMaxY = y;
            }
        }
        function columnText(content, size = 9, bold = false, color = [35,54,74]) {
            const step = size * .3528 * 1.35;
            doc.setFont('helvetica',bold ? 'bold' : 'normal'); doc.setFontSize(size);
            const lines = doc.splitTextToSize(pdfText(content), columnWidth);
            for (const line of lines) {
                if (y + step > columnLimit) nextColumn();
                doc.setFont('helvetica',bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
                doc.text(line, left + column * (columnWidth + gap), y + size * .3528);
                y += step;
            }
            y += 1.5;
        }
        for (const item of model.queries.filter(item => item.state !== 'SEM ATESTADOS')) {
            // O nome ocupa a largura da folha; somente os detalhes usam duas colunas.
            if (studentIndex++ > 0) newPage();
            activeStudent = item; studentHeading(item);
            if (item.note) text(item.note,9);
            column = 0; columnTop = y; columnMaxY = y;
            function measuredHeight(content, size, bold) {
                doc.setFont('helvetica',bold ? 'bold' : 'normal'); doc.setFontSize(size);
                return doc.splitTextToSize(pdfText(content), columnWidth).length * size * .3528 * 1.35 + 1.5;
            }
            const totalHeight = item.records.reduce((sum, row) => sum + measuredHeight('ATESTADO ' + row.id,11,true) + 4 +
                recordFields(row).reduce((height, field) => height + measuredHeight(field[0].toUpperCase(),8,true) + measuredHeight(field[1],9,false),0),0);
            // Equilibra relatórios curtos entre as duas colunas; os longos usam toda a folha.
            columnLimit = totalHeight < 2 * (bottom - columnTop) ? Math.min(bottom,columnTop + totalHeight / 2 + 12) : bottom;
            for (const row of item.records) {
                if (y + 18 > columnLimit) nextColumn();
                columnText('ATESTADO ' + row.id,11,true,[8,126,131]);
                for (const field of recordFields(row)) {
                    if (y + 12 > columnLimit) nextColumn();
                    columnText(field[0].toUpperCase(),8,true,[91,110,127]);
                    columnText(field[1],9);
                }
                y += 4;
            }
            // Retoma a largura inteira abaixo da coluna mais comprida.
            y = Math.max(y, columnMaxY) + 6;
        }
        const emptyStudents = model.queries.filter(item => item.state === 'SEM ATESTADOS');
        if (emptyStudents.length) {
            if (studentIndex > 0) newPage();
            text('Alunos sem atestados',14,true,[18,52,81]);
            for (const item of emptyStudents) {
                // Lista compacta: vários alunos na mesma página, sem quebra individual.
                space(18);
                text((item.name || 'Nome não localizado') + ' | Código ' + item.code,10,true);
                text(item.note || 'Não possui atestados.',9);
                y += 2;
            }
        }
        space(24);
        text('Fonte: SIGEDUCA. A data de emissão é a deste relatório; inclusão e alteração são datas dos registros.',8,false,[91,110,127]);
        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
            doc.setPage(p); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110,125,140);
            doc.text('Emitido em ' + pdfText(model.emitted),left,287);
            doc.text('Página ' + p + ' de ' + pages,193,287,{align:'right'});
        }
        return doc.output('blob');
    }
    function openReport(pdf) {
        if (running || !queries.length) return;
        try {
            const model = report();
            const blob = pdf ? reportPDF(model) : new Blob([reportHTML(model)],{type:'text/html;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const tab = window.open(url,'_blank');
            if (tab) tab.opener = null;
            else status('O navegador bloqueou a nova guia. Permita pop-ups para o SIGEDUCA e tente novamente.');
            setTimeout(() => URL.revokeObjectURL(url),600000);
        } catch (error) { status(error.message); }
    }
    function csv() {
        const headers = ['Código aluno','Nome','Situação consulta','Consulta em','Aviso consulta','Código atestado',
            'Tipo','Início','Fim','Dias letivos','Observações','Incluído em','Incluído por','Alterado em','Alterado por',
            'Certificado militar','Força','UF militar','Categoria militar','Situação detalhes','Erro detalhes'];
        const lines = [headers];
        report().queries.forEach(item => (item.records.length ? item.records : [{}]).forEach(r => lines.push([
            item.code,item.name,item.state,item.time,item.note,r.id,r.type,r.start,r.end,r.days,r.observation,
            r.createdAt,r.createdBy,r.changedAt,r.changedBy,r.militaryNumber,r.militaryBranch,r.militaryState,
            r.militaryCategory,r.status,r.error
        ])));
        const cell = v => {
            let s = String(v ?? '');
            if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
            return '"' + s.replace(/"/g,'""') + '"';
        };
        const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(r => r.map(cell).join(';')).join('\r\n')],
            {type:'text/csv;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url; link.download = 'consulta-atestados-' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url),5000);
    }
    q('start').addEventListener('click',start);
    q('stop').addEventListener('click',() => {
        stop = true; buttons(); status('Parando após a leitura em andamento…');
    });
    q('native').addEventListener('click',() => {
        nativeVisible = !nativeVisible; morph();
        q('native').textContent = nativeVisible ? 'Ocultar tela original' : 'Mostrar tela original';
    });
    q('clear').addEventListener('click',() => {
        queries.length = 0; context = captureContext(); q('progress').value = 0; render();
        status('Resultados limpos.');
    });
    q('html').addEventListener('click',() => openReport(false));
    q('pdf').addEventListener('click',() => openReport(true));
    q('csv').addEventListener('click',csv);
    context = captureContext();
    let attempts = 0;
    const timer = setInterval(() => {
        if (morph() || ++attempts >= 60) {
            clearInterval(timer);
            if (!panel.isConnected) {
                document.body.prepend(panel);
                status('Não foi possível localizar o formulário. Confirme que a sessão está aberta na consulta de atestados.');
                q('start').disabled = true;
            }
        }
    },200);
    render();
    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) return;
        if (!panel.isConnected || (nativeTable && !nativeTable.isConnected)) {
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; morph(); });
        }
    }).observe(document.body,{childList:true,subtree:true});
})();
