// ==UserScript==
// @name         SIGEDUCA - Exportar notas fiscais para CSV
// @namespace    codex.sigeduca
// @version      2.1.3
// @description  Percorre a consulta, aciona cada botão Visualizar do GeneXus e gera um CSV com os dados das páginas DSP.
// @author       Codex
// @match        http://sigeduca.seduc.mt.gov.br/gpo/*
// @match        https://sigeduca.seduc.mt.gov.br/gpo/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpo/notas-fiscais-csv.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpo/notas-fiscais-csv.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A coleta precisa ocorrer na página principal, nunca dentro de um frame.
    if (window.top !== window.self) return;

    const LIST_PATH = '/gpo/hwmpppdespesacusteio.aspx';
    const DETAIL_PATH = '/gpo/hwtgpodespesacusteio.aspx';
    const currentPath = location.pathname.toLowerCase();
    if (currentPath !== LIST_PATH && currentPath !== DETAIL_PATH) return;

    const STATE_KEY = 'sigeduca_exportacao_notas_custeio_v4';
    const STATE_VERSION = 4;

    const CSV_COLUMNS = [
        'Código',
        'Fornecedor',
        'CNPJ',
        'Nome Fantasia',
        'Forma de Pagamento',
        'Número do Documento',
        'Data do Pagamento',
        'Valor do Documento',
        'Valor do Desconto',
        'Tipo de Documento',
        'Data Limite Emissão',
        'Número do Comprovante',
        'Data do Comprovante',
        'Elemento',
        'Tipo de Despesa',
        'Fonte de Recurso',
        'Natureza do Lançamento',
        'Saldo'
    ];

    let listRunning = false;
    let ui;

    function normalizeText(value) {
        return String(value ?? '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function fixGeneXusText(value) {
        return normalizeText(value)
            .replace(/\bINFORM\s+ÁTICA\b/gi, 'INFORMÁTICA')
            .replace(/\bBANC\s+ÁRIA\b/gi, 'BANCÁRIA')
            .replace(/\bSERVI\s+ÇOS\b/gi, 'SERVIÇOS')
            .replace(/\bJUR\s+ÍDICA\b/gi, 'JURÍDICA')
            .replace(/\bMANUTEN\s+ÇÃO\b/gi, 'MANUTENÇÃO')
            .replace(/À(?=MANUTENÇÃO\b)/gi, 'À ');
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function loadState() {
        try {
            const state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
            return state?.version === STATE_VERSION ? state : null;
        } catch (error) {
            console.warn('[SIGEDUCA CSV] Progresso inválido.', error);
            return null;
        }
    }

    function saveState(state) {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    function getGXState(doc = document) {
        const element = doc.querySelector('input[name="GXState"]');
        if (!element?.value) return {};
        try {
            return JSON.parse(element.value);
        } catch (_) {
            return {};
        }
    }

    function getListContext() {
        const gxState = getGXState();
        const yearText = normalizeText(document.getElementById('MPW0019TANOLETIVO')?.textContent);
        const lotacaoText = normalizeText(document.getElementById('MPW0019TLOTACAO')?.textContent);
        const year = String(gxState.vGPOPRSCTAMODANO || yearText.match(/\b\d{4}\b/)?.[0] || '');
        const lotacao = String(lotacaoText.match(/^\s*(\d+)/)?.[1] || gxState.vGERLOTCOD || '');

        if (!/^\d{4}$/.test(year)) {
            throw new Error('Não consegui identificar o ano letivo no cabeçalho.');
        }
        if (!/^\d+$/.test(lotacao)) {
            throw new Error('Não consegui identificar o código da lotação no cabeçalho.');
        }
        return { year, lotacao };
    }

    function installStyle() {
        if (document.getElementById('sigeduca-csv-style')) return;
        const style = document.createElement('style');
        style.id = 'sigeduca-csv-style';
        style.textContent = `
            #sigeduca-csv-box {
                position: fixed; top: 14px; right: 14px; z-index: 2147483647;
                width: 330px; padding: 12px; box-sizing: border-box;
                font: 13px/1.4 Arial, sans-serif; color: #18241d;
                background: #f7fff9; border: 2px solid #17733a; border-radius: 8px;
                box-shadow: 0 4px 18px rgba(0,0,0,.28);
            }
            #sigeduca-csv-box button {
                cursor: pointer; border: 0; border-radius: 5px; padding: 9px 11px;
                margin: 3px 4px 0 0; font-weight: bold; background: #17733a; color: #fff;
            }
            #sigeduca-csv-box button:disabled { cursor: wait; opacity: .65; }
            #sigeduca-csv-box .danger { background: #8a2f2f; }
            #sigeduca-csv-status { margin-top: 9px; white-space: pre-line; }
            #sigeduca-csv-status[data-error="true"] { color: #8a1414; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    function createUI(isDetail = false) {
        installStyle();
        const box = document.createElement('div');
        box.id = 'sigeduca-csv-box';
        box.innerHTML = `
            <div id="sigeduca-csv-actions"></div>
            <div id="sigeduca-csv-status"></div>
        `;
        document.body.appendChild(box);
        ui = {
            box,
            actions: box.querySelector('#sigeduca-csv-actions'),
            status: box.querySelector('#sigeduca-csv-status'),
            isDetail
        };
        return ui;
    }

    function addButton(label, handler, className = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        if (className) button.className = className;
        button.addEventListener('click', handler);
        ui.actions.appendChild(button);
        return button;
    }

    function setStatus(message, isError = false) {
        if (!ui) return;
        ui.status.textContent = message;
        ui.status.dataset.error = String(isError);
    }

    function clearActions() {
        if (ui) ui.actions.textContent = '';
    }

    function currentPage() {
        const value = Number(document.getElementById('vPAG')?.value || 1);
        return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function totalPages() {
        const select = document.getElementById('vPAG');
        if (!select?.options?.length) return 1;
        return Math.max(...Array.from(select.options, (option) => Number(option.value) || 1));
    }

    function elementValue(element) {
        if (!element) return '';
        if ('value' in element && element.value != null) return normalizeText(element.value);
        return normalizeText(element.textContent);
    }

    function findVisualControls() {
        const root = document.getElementById('GriddetalhesContainerDiv');
        if (!root) return [];

        const named = Array.from(root.querySelectorAll('[id], [name]')).filter((element) => {
            const name = String(element.id || element.getAttribute('name') || '').toUpperCase();
            return name.startsWith('VVISUALIZA_');
        });
        const candidates = named.length
            ? named
            : Array.from(root.querySelectorAll('input[type="image"], img')).filter((element) =>
                /visualizaatr\.gif/i.test(element.getAttribute('src') || '')
            );

        const rows = new Set();
        return candidates.filter((element) => {
            const key = element.closest('tr') || element;
            if (rows.has(key)) return false;
            rows.add(key);
            return true;
        });
    }

    function findCodeForVisual(visual) {
        const identity = String(visual.id || visual.getAttribute('name') || '');
        const suffix = identity.match(/(_\d+)$/)?.[1] || '';
        const row = visual.closest('tr');
        const pool = [];

        if (suffix) {
            pool.push(...Array.from(document.querySelectorAll(`[id$="${suffix}"], [name$="${suffix}"]`)));
        }
        if (row) pool.push(...Array.from(row.querySelectorAll('[id], [name], span, input')));

        for (const element of pool) {
            const id = String(element.id || element.getAttribute?.('name') || '');
            if (!/GPODSP(?:CUS|CAP)?COD/i.test(id)) continue;
            const value = elementValue(element).replace(/\D/g, '');
            if (/^\d{5,}$/.test(value)) return value;
        }

        if (row) {
            for (const cell of Array.from(row.cells || [])) {
                const match = normalizeText(cell.textContent).match(/^\s*(\d{5,})\b/);
                if (match) return match[1];
            }
        }
        return '';
    }

    function visibleEntries() {
        const unique = new Map();
        findVisualControls().forEach((visual, index) => {
            const code = findCodeForVisual(visual);
            if (code) {
                unique.set(code, {
                    code,
                    index,
                    visual,
                    controlId: visual.id || visual.getAttribute('name') || ''
                });
            }
        });
        return Array.from(unique.values());
    }

    function gridSignature() {
        return visibleEntries().map((entry) => entry.code).join('|');
    }

    async function waitFor(predicate, timeoutMs, description) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const result = predicate();
            if (result) return result;
            await sleep(250);
        }
        throw new Error(`Tempo esgotado ao aguardar ${description}.`);
    }

    function triggerConsult() {
        const filter = document.getElementById('vGRHDESCRICAO');
        if (filter) {
            filter.value = '';
            filter.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const button = document.querySelector('[name="BCONSULTAR"]');
        if (!button) throw new Error('Não encontrei o botão Consultar do SIGEDUCA.');
        button.click();
    }

    function goToPageFallback(page) {
        const select = document.getElementById('vPAG');
        if (!select) throw new Error('Não encontrei o seletor de páginas do SIGEDUCA.');
        select.value = String(page);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function paginationLink(direction) {
        const containerId = direction > 0 ? 'TPROXIMO' : 'TANTERIOR';
        const eventName = direction > 0 ? 'PROXIMO' : 'ANTERIOR';
        return document.querySelector(`#${containerId} a`) ||
            Array.from(document.querySelectorAll('a[href]')).find((anchor) =>
                new RegExp(eventName, 'i').test(anchor.getAttribute('href') || '')
            ) || null;
    }

    async function moveToPage(targetPage) {
        while (currentPage() !== targetPage) {
            const fromPage = currentPage();
            const direction = targetPage > fromPage ? 1 : -1;
            const nextPage = fromPage + direction;
            const oldSignature = gridSignature();
            const link = paginationLink(direction);

            setStatus(
                `${direction > 0 ? 'Avançando' : 'Voltando'} da página ${fromPage} ` +
                `para a página ${nextPage}…`
            );

            if (link) link.click();
            else goToPageFallback(nextPage);

            await waitFor(
                () => currentPage() === nextPage && visibleEntries().length > 0 &&
                    gridSignature() !== oldSignature,
                30000,
                `a grade da página ${nextPage}`
            );
        }
    }

    function expectedDetail(state) {
        return state.codes[state.detailIndex] || null;
    }

    function pauseState(error) {
        const state = loadState();
        if (state?.status === 'running') {
            state.status = 'paused';
            state.lastError = error.message;
            saveState(state);
        }
    }

    function startNewExport() {
        const context = getListContext();
        const state = {
            version: STATE_VERSION,
            status: 'running',
            phase: 'collect_codes',
            needsConsult: true,
            page: 1,
            year: context.year,
            lotacao: context.lotacao,
            codes: [],
            detailIndex: 0,
            records: {},
            listUrl: location.href,
            startedAt: new Date().toISOString(),
            lastError: ''
        };
        saveState(state);
        runListCollection();
    }

    async function openExpectedFromList(state) {
        if (state.phase === 'return_to_list' || state.phase === 'await_detail') {
            state.phase = 'open_from_list';
            saveState(state);
        }
        if (state.phase !== 'open_from_list') {
            throw new Error(`Etapa inesperada na página da grade: ${state.phase}.`);
        }

        const item = expectedDetail(state);
        if (!item) throw new Error('Não há outra nota na fila de exportação.');

        if (!visibleEntries().length) {
            setStatus('Recarregando a grade antes de acionar o botão Visualizar…');
            triggerConsult();
            await sleep(700);
            await waitFor(
                () => currentPage() === 1 && visibleEntries().length > 0,
                30000,
                'a grade de despesas'
            );
        }

        if (currentPage() !== item.page) {
            setStatus(
                `Nota ${state.detailIndex + 1}/${state.codes.length}: ${item.code}\n` +
                `Abrindo a página ${item.page} da grade…`
            );
            await moveToPage(item.page);
        }

        const entry = await waitFor(
            () => visibleEntries().find((candidate) => candidate.code === item.code) || false,
            20000,
            `o botão Visualizar da nota ${item.code}`
        );

        state.phase = 'await_detail';
        state.lastError = '';
        saveState(state);
        setStatus(
            `Nota ${state.detailIndex + 1}/${state.codes.length}: ${item.code}\n` +
            `Acionando ${entry.controlId || 'o botão Visualizar'} pelo evento GeneXus…`
        );

        // Este clique executa EVVISUALIZA.CLICK.XXXX e deixa o próprio
        // GeneXus preparar os dados no servidor antes de navegar para a DSP.
        entry.visual.click();

        setTimeout(() => {
            const latest = loadState();
            if (location.pathname.toLowerCase() === LIST_PATH &&
                latest?.status === 'running' && latest.phase === 'await_detail') {
                const error = new Error(
                    `O evento ${entry.controlId || 'Visualizar'} não abriu a página DSP da nota ${item.code}.`
                );
                pauseState(error);
                showListIdle(error.message, true);
            }
        }, 20000);
    }

    async function runListCollection() {
        if (listRunning) return;
        listRunning = true;
        clearActions();
        const cancelButton = addButton('Cancelar', cancelExport, 'danger');
        cancelButton.disabled = false;

        try {
            let state = loadState();
            if (!state || state.status !== 'running') return;

            if (state.phase !== 'collect_codes') {
                await openExpectedFromList(state);
                return;
            }

            const context = getListContext();
            if (context.year !== state.year || context.lotacao !== state.lotacao) {
                throw new Error('O ano ou a lotação mudou. Cancele e comece novamente.');
            }

            if (state.needsConsult) {
                const oldSignature = gridSignature();
                const hadFilter = Boolean(normalizeText(document.getElementById('vGRHDESCRICAO')?.value));
                const started = Date.now();
                state.needsConsult = false;
                state.page = 1;
                state.codes = [];
                saveState(state);
                setStatus('Limpando o filtro e consultando todas as notas…');
                triggerConsult();

                await sleep(700);
                await waitFor(
                    () => currentPage() === 1 && visibleEntries().length > 0 &&
                        (!hadFilter || gridSignature() !== oldSignature || Date.now() - started > 3000),
                    30000,
                    'o resultado da consulta'
                );
            }

            while (true) {
                state = loadState();
                if (!state || state.status !== 'running') return;

                if (currentPage() !== state.page) {
                    setStatus(`Abrindo a página ${state.page} da grade…`);
                    await moveToPage(state.page);
                }

                const entries = await waitFor(
                    () => visibleEntries().length ? visibleEntries() : false,
                    20000,
                    'os códigos da grade'
                );

                const known = new Set(state.codes.map((item) => item.code));
                for (const entry of entries) {
                    if (!known.has(entry.code)) {
                        state.codes.push({
                            code: entry.code,
                            page: state.page,
                            order: (state.page * 1000) + entry.index
                        });
                        known.add(entry.code);
                    }
                }
                saveState(state);

                const pages = totalPages();
                setStatus(
                    `Página ${state.page}/${pages} lida.\n` +
                    `${state.codes.length} código(s) guardado(s).`
                );

                if (state.page >= pages) {
                    if (!state.codes.length) throw new Error('A consulta não trouxe nenhuma nota.');
                    state.codes.sort((a, b) => a.order - b.order);
                    state.phase = 'open_from_list';
                    state.detailIndex = 0;
                    saveState(state);
                    setStatus(
                        `${state.codes.length} código(s) guardado(s).\n` +
                        'Voltando à primeira nota para acionar o botão Visualizar…'
                    );
                    await openExpectedFromList(state);
                    return;
                }

                state.page += 1;
                saveState(state);
                await moveToPage(state.page);
            }
        } catch (error) {
            console.error('[SIGEDUCA CSV]', error);
            pauseState(error);
            showListIdle(error.message, true);
        } finally {
            listRunning = false;
        }
    }

    function cancelExport() {
        const state = loadState();
        if (state) {
            state.status = 'cancelled';
            saveState(state);
        }
        listRunning = false;
        showListIdle('Exportação cancelada.');
    }

    function showListIdle(message = '', isError = false) {
        clearActions();
        addButton('Consultar tudo e gerar CSV', () => {
            const state = loadState();
            if (state && (state.status === 'paused' || state.status === 'running')) {
                state.status = 'running';
                state.lastError = '';
                saveState(state);
                runListCollection();
            } else {
                try {
                    startNewExport();
                } catch (error) {
                    setStatus(error.message, true);
                }
            }
        });
        if (message) setStatus(message, isError);
        else setStatus('O processo guardará os códigos e acionará cada botão Visualizar do GeneXus.');
    }

    function docValue(doc, id) {
        const element = doc.getElementById(id);
        if (!element) return '';
        if ('value' in element && element.value != null) return normalizeText(element.value);
        return normalizeText(element.textContent);
    }

    function displayedValue(doc, name) {
        return docValue(doc, `span_${name}`) || docValue(doc, name);
    }

    function descriptiveValue(doc, gxState, name) {
        const displayed = fixGeneXusText(displayedValue(doc, name));
        const stored = normalizeText(gxState[name]);
        return stored || displayed;
    }

    function joined(...parts) {
        return parts.map(normalizeText).filter(Boolean).join(' ');
    }

    function parseDetailDocument(doc, requestedCode) {
        const gxState = getGXState(doc);
        const d = (name) => displayedValue(doc, name);
        const description = (name) => descriptiveValue(doc, gxState, name);
        const code = d('vGPODSPCUSCOD') || normalizeText(gxState.vGPODSPCUSCOD);

        if (!code || code !== String(requestedCode)) {
            throw new Error(`A página DSP não apresentou o código esperado ${requestedCode}.`);
        }

        const supplierName = description('vGERFORRAZSOC');
        const documentValue = d('vGPODSPCUSVLRDOC');
        if (!supplierName || !documentValue) {
            throw new Error(`Os span_v da nota ${requestedCode} ainda estão incompletos.`);
        }

        let nature = d('vGPODSPCUSNAT') || normalizeText(gxState.vGPODSPCUSNAT);
        if (nature === 'CUS') nature = 'CUSTEIO';

        return {
            'Código': code,
            'Fornecedor': joined(d('vGERFORCOD'), supplierName),
            'CNPJ': d('vGERFORCNPJ'),
            'Nome Fantasia': description('vGERFORNOMFAN'),
            'Forma de Pagamento': joined(d('vGFIFRMPGTCOD'), description('vGFIFRMPGTDSC')),
            'Número do Documento': d('vGPODSPCUSNRODOC'),
            'Data do Pagamento': d('vGPODSPCUSDTAPGT'),
            'Valor do Documento': documentValue,
            'Valor do Desconto': d('vGPODSPCUSVLRDES'),
            'Tipo de Documento': joined(d('vGPOTPODOCCOD'), description('vGPOTPODOCDSC')),
            'Data Limite Emissão': d('vGPODSPCUSDTALIMEMS'),
            'Número do Comprovante': d('vGPODSPCUSNROCMP'),
            'Data do Comprovante': d('vGPODSPCUSDTACMP'),
            'Elemento': joined(d('vGFIELECOD'), description('vGFIELENOM')),
            'Tipo de Despesa': joined(d('vGFITPODSPCOD'), description('vGFITPODSPNOM')),
            'Fonte de Recurso': fixGeneXusText(d('vGERFNTCOD')),
            'Natureza do Lançamento': nature,
            'Saldo': d('vGPOLCTDIVSLDCUSTEIO')
        };
    }

    function csvCell(value) {
        let text = normalizeText(value);
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadCSV(state) {
        const records = Object.values(state.records)
            .sort((a, b) => a.order - b.order)
            .map((item) => item.data);
        const lines = [
            CSV_COLUMNS.map(csvCell).join(';'),
            ...records.map((record) => CSV_COLUMNS.map((column) => csvCell(record[column])).join(';'))
        ];
        const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notas_fiscais_sigeduca_${state.year}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return records.length;
    }

    function returnToList() {
        const state = loadState();
        location.href = state?.listUrl || new URL('hwmpppdespesacusteio.aspx', location.href).href;
    }

    function backToListForNext(state) {
        let pageWasHidden = false;
        window.addEventListener('pagehide', () => {
            pageWasHidden = true;
        }, { once: true });

        history.back();
        setTimeout(() => {
            if (!pageWasHidden && location.pathname.toLowerCase() === DETAIL_PATH) {
                location.href = state.listUrl;
            }
        }, 3000);
    }

    function showDetailCompletion(state, downloadAgain = false) {
        clearActions();
        addButton('Baixar CSV novamente', () => downloadCSV(state));
        addButton('Voltar à lista', returnToList);
        setStatus(
            `Concluído: ${Object.keys(state.records).length} nota(s) exportada(s).` +
            `${downloadAgain ? '\nUse o botão acima caso o navegador não tenha baixado o arquivo.' : ''}`
        );
    }

    function showDetailError(error) {
        clearActions();
        addButton('Tentar novamente', () => {
            const state = loadState();
            if (!state) return;
            state.status = 'running';
            state.phase = 'return_to_list';
            state.lastError = '';
            saveState(state);
            backToListForNext(state);
        });
        addButton('Cancelar e voltar', () => {
            const state = loadState();
            if (state) {
                state.status = 'cancelled';
                saveState(state);
            }
            returnToList();
        }, 'danger');
        setStatus(error.message, true);
    }

    async function runDetailCollection() {
        createUI(true);
        const state = loadState();

        if (!state) {
            clearActions();
            addButton('Voltar à lista', returnToList);
            setStatus('Esta página DSP não faz parte de uma exportação ativa.');
            return;
        }
        if (state.status === 'complete') {
            showDetailCompletion(state);
            return;
        }
        if (state.status === 'paused') {
            showDetailError(new Error(state.lastError || 'A exportação está pausada.'));
            return;
        }
        if (state.status !== 'running') {
            clearActions();
            addButton('Voltar à lista', returnToList);
            setStatus('A exportação foi cancelada.');
            return;
        }
        if (state.phase === 'return_to_list') {
            setStatus('Voltando à grade para acionar o próximo botão Visualizar…');
            backToListForNext(state);
            return;
        }
        if (state.phase !== 'await_detail') {
            showDetailError(new Error(`A página DSP foi aberta numa etapa inesperada: ${state.phase}.`));
            return;
        }

        const item = expectedDetail(state);
        if (!item) {
            const count = downloadCSV(state);
            state.status = 'complete';
            state.completedAt = new Date().toISOString();
            saveState(state);
            showDetailCompletion(state, count > 0);
            return;
        }

        try {
            setStatus(
                `Nota ${state.detailIndex + 1}/${state.codes.length}: ${item.code}\n` +
                'Lendo os span_v desta página DSP…'
            );

            await waitFor(
                () => {
                    const code = displayedValue(document, 'vGPODSPCUSCOD');
                    const supplier = displayedValue(document, 'vGERFORRAZSOC');
                    const amount = displayedValue(document, 'vGPODSPCUSVLRDOC');
                    return code === item.code && supplier && amount;
                },
                20000,
                `os span_v da nota ${item.code}`
            );

            const record = parseDetailDocument(document, item.code);
            state.records[item.code] = { order: item.order, data: record };
            state.detailIndex += 1;
            state.lastError = '';

            if (state.detailIndex < state.codes.length) {
                const next = expectedDetail(state);
                state.phase = 'return_to_list';
                saveState(state);
                setStatus(
                    `Nota ${item.code} salva com todos os campos.\n` +
                    `Voltando à grade para clicar a próxima: ${next.code}…`
                );
                await sleep(350);
                backToListForNext(state);
                return;
            }

            state.status = 'complete';
            state.completedAt = new Date().toISOString();
            saveState(state);
            const count = downloadCSV(state);
            showDetailCompletion(state, count > 0);
        } catch (error) {
            console.error('[SIGEDUCA CSV]', error);
            pauseState(error);
            showDetailError(error);
        }
    }

    function initializeListPage() {
        createUI(false);
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) return;
            listRunning = false;
            const restoredState = loadState();
            if (restoredState?.status === 'running' && restoredState.phase !== 'collect_codes') {
                setStatus('Grade restaurada. Preparando o próximo clique em Visualizar…');
                setTimeout(runListCollection, 250);
            }
        });

        const state = loadState();
        if (state?.status === 'running') {
            setStatus('Retomando a exportação…');
            setTimeout(runListCollection, 600);
        } else if (state?.status === 'paused') {
            showListIdle(
                `${state.lastError || 'A exportação foi pausada.'}\n` +
                'Clique no botão para continuar.',
                true
            );
        } else if (state?.status === 'complete') {
            showListIdle(
                `A última exportação terminou com ${Object.keys(state.records).length} nota(s).\n` +
                'Clique para fazer uma nova consulta.'
            );
        } else {
            showListIdle();
        }
    }

    if (currentPath === LIST_PATH) initializeListPage();
    else runDetailCollection();
})();
