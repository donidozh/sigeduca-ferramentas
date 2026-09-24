// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Arquivo Digital do Aluno
// @namespace    http://tampermonkey.net/
// @version      0.10.2
// @description  Arquivo Digital modular com Consulta e Upload; pesquisa de alunos diretamente no Google Sheets, OCR local e Google Drive.
// @author       Elder Martins / adaptação assistida
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/arquivo-digital-aluno.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/arquivo-digital-aluno.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @grant        GM_info
// ==/UserScript==

(() => {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '0.10.2',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/arquivo-digital-aluno.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/arquivo-digital-aluno.user.js'
    });

    if (window.top !== window.self) return;

    const FLAG = '__SIGEDUCA_ARQUIVO_DIGITAL_MODULAR_V0_9__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    /* =====================================================================
     * 1. REGISTRO NO MENU MODULAR
     * ===================================================================== */

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const FERRAMENTAS = Object.freeze([
        {
            id: 'arquivo-digital-consulta',
            titulo: 'Arquivo Digital — Consulta',
            url: 'hwmconaluno.aspx#arquivo-digital-consulta',
            descricao: 'Consultar localização física, pasta digital e documentos do aluno',
            ordem: 30,
            grupo: 'Secretaria',
            grupoOrdem: 10,
            versao: '0.10.2'
        },
        {
            id: 'arquivo-digital-upload',
            titulo: 'Arquivo Digital — Upload',
            url: 'hwmconaluno.aspx#arquivo-digital-upload',
            descricao: 'Digitalizar/importar, classificar e enviar documentos',
            ordem: 31,
            grupo: 'Secretaria',
            grupoOrdem: 10,
            versao: '0.10.2'
        }
    ]);

    function registrarNoMenu() {
        for (const ferramenta of FERRAMENTAS) {
            window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, {
                detail: { ...ferramenta, ...ATUALIZACAO_SCRIPT }
            }));
        }
    }

    window.addEventListener(EVENTO_SOLICITAR, registrarNoMenu);
    window.addEventListener(EVENTO_BASE_PRONTA, registrarNoMenu);
    registrarNoMenu();
    setTimeout(registrarNoMenu, 100);

    /* =====================================================================
     * 2. CONFIGURAÇÕES E TIPOS DE DOCUMENTO
     * ===================================================================== */

    const APP = {
        id: 'adig03',
        version: '0.10.2',
        hashes: Object.freeze({
            consulta: '#arquivo-digital-consulta',
            upload: '#arquivo-digital-upload'
        }),
        maxPdfSize: 120 * 1024 * 1024,
        maxGeneratedFileSize: 5 * 1024 * 1024,
        thumbnailScale: 0.28,
        uploadPollMs: 800,
        uploadTimeoutMs: 90_000,
        responseTimeoutMs: 90_000,
        betweenUploadsMs: 1_000,
        driveEndpointKey: 'adig01:driveEndpoint',
        driveTokenKey: 'adig01:driveToken',
        uiStateKey: 'adig09:uiState'
    };

    // IMPORTANTE:
    // gedId = ID real usado pelo SIGEDUCA.
    // gedId = null significa que o tipo existe SOMENTE no Arquivo Digital.
    // O campo group serve apenas para organizar a interface.
    const DOCUMENT_TYPES = Object.freeze({
        ignore: {
            label: 'NÃO ARQUIVAR / IGNORAR', short: 'Ignorar', group: 'system', gedId: null,
            keywords: []
        },

        ged_responsavel: {
            label: 'DOCUMENTOS PESSOAIS DO PAI, DA MÃE OU DO RESPONSÁVEL', short: 'Responsável', group: 'ged', gedId: 1,
            keywords: ['responsavel', 'responsável', 'pai', 'mae', 'mãe', 'rg', 'cpf']
        },
        ged_certidao: {
            label: 'CERTIDÃO DE NASCIMENTO OU CASAMENTO DO ESTUDANTE', short: 'Certidão', group: 'ged', gedId: 2,
            keywords: ['certidao de nascimento', 'certidão de nascimento', 'registro civil', 'nascimento']
        },
        ged_rgcpf: {
            label: 'DOCUMENTOS PESSOAIS DO ESTUDANTE (RG E CPF)', short: 'RG e CPF', group: 'ged', gedId: 3,
            keywords: ['registro geral', 'carteira de identidade', 'cpf', 'cadastro de pessoas fisicas', 'cadastro de pessoas físicas']
        },
        ged_energia: {
            label: 'FATURA ATUALIZADA DE ENERGIA ELÉTRICA', short: 'Energia', group: 'ged', gedId: 4,
            keywords: ['energia eletrica', 'energia elétrica', 'unidade consumidora', 'conta de energia', 'fatura de energia']
        },
        ged_sangue: {
            label: 'TIPO DO GRUPO SANGUÍNEO E FATOR RH DO ESTUDANTE', short: 'Tipo sanguíneo', group: 'ged', gedId: 5,
            keywords: ['grupo sanguineo', 'grupo sanguíneo', 'fator rh', 'tipo sanguineo', 'tipo sanguíneo']
        },
        ged_vacina: {
            label: 'CARTÃO ATUALIZADO DE VACINA DO ESTUDANTE', short: 'Vacina', group: 'ged', gedId: 6,
            keywords: ['caderneta de vacinacao', 'caderneta de vacinação', 'cartao de vacina', 'cartão de vacina', 'vacina']
        },
        ged_oftalmo: {
            label: 'ATESTADO MÉDICO OFTALMOLÓGICO OU AVALIAÇÃO TÉCNICA DE OPTOMETRIA (APENAS EF)', short: 'Oftalmológico', group: 'ged', gedId: 7,
            keywords: ['oftalmologico', 'oftalmológico', 'optometria', 'acuidade visual', 'oftalmologista']
        },
        ged_historico: {
            label: 'HISTÓRICO ESCOLAR OU ATESTADO DE TRANSFERÊNCIA', short: 'Histórico/transferência', group: 'ged', gedId: 8,
            keywords: ['historico escolar', 'histórico escolar', 'atestado de transferencia', 'atestado de transferência', 'transferencia escolar', 'transferência escolar', 'estudos realizados', 'carga horaria', 'carga horária']
        },
        ged_paed: {
            label: 'DOCUMENTO PAED', short: 'PAED (GED)', group: 'ged', gedId: 9,
            keywords: ['paed', 'paede', 'educacao especial', 'educação especial']
        },

        arquivo_certificado: {
            label: 'Certificado / Diploma', short: 'Certificado/Diploma', group: 'archive', gedId: null,
            keywords: ['certificado', 'diploma', 'concluiu', 'conclusao', 'conclusão', 'confere']
        },
        arquivo_ficha_matricula: {
            label: 'Ficha de Matrícula', short: 'Ficha de Matrícula', group: 'archive', gedId: null,
            keywords: ['ficha de matricula', 'ficha de matrícula', 'dados do aluno', 'dados do estudante', 'responsavel legal', 'responsável legal']
        },
        arquivo_atestado_medico: {
            label: 'Atestado Médico', short: 'Atestado Médico', group: 'archive', gedId: null,
            keywords: ['atestado medico', 'atestado médico', 'crm', 'declaro para os devidos fins', 'afastamento', 'dias de afastamento']
        },
        arquivo_ficha_individual: {
            label: 'Ficha Individual', short: 'Ficha Individual', group: 'archive', gedId: null,
            keywords: ['ficha individual', 'rendimento escolar', 'componentes curriculares', 'resultado final', 'ano letivo']
        },
        arquivo_termo_compromisso: {
            label: 'Termo de Compromisso', short: 'Termo de Compromisso', group: 'archive', gedId: null,
            keywords: ['termo de compromisso', 'comprometo-me', 'comprometo me', 'responsavel', 'responsável']
        },
        arquivo_cartao_sus: {
            label: 'Cartão SUS', short: 'Cartão SUS', group: 'archive', gedId: null,
            keywords: ['cartao nacional de saude', 'cartão nacional de saúde', 'cns', 'sistema unico de saude', 'sistema único de saúde', 'sus']
        },
        arquivo_paede: {
            label: 'Documentos PAEDE', short: 'Documentos PAEDE', group: 'archive', gedId: null,
            keywords: ['paede', 'educacao especial', 'educação especial', 'atendimento educacional especializado', 'laudo']
        },
        arquivo_diversos: {
            label: 'Diversos', short: 'Diversos', group: 'archive', gedId: null,
            keywords: []
        }
    });

    const ARCHIVE_ROOTS = Object.freeze({
        PERMANENTE: 'PERMANENTE',
        FORMANDOS: 'FORMANDOS'
    });

    const state = {
        initialized: false,
        originalTitle: document.title,
        sourceFile: null,
        sourceBytes: null,
        pdfjsDocument: null,
        pageModels: [],
        generatedDocuments: [],
        undoStack: [],
        sourceNames: [],
        batchSignature: '',
        draftTimer: null,
        draftQueue: Promise.resolve(),
        listIndexes: {
            PERMANENTE: [],
            FORMANDOS: []
        },
        workbookNames: {
            PERMANENTE: '',
            FORMANDOS: ''
        },
        selectedStudentMatch: null,
        logs: [],
        processing: false,
        cancelled: false,
        iframe: null,
        hiddenNativeNodes: [],
        consultationDocuments: [],
        consultationObjectUrls: [],
        lastSearchResults: [],
        lastSearchMode: 'similarity',
        lastSearchTerm: '',
        ocrWorker: null,
        ocrWorkerPromise: null,
        ocrStatus: 'não carregado'
    };

    const el = {};

    /* =====================================================================
     * 3. PONTO DE ENTRADA / MORPH DA PÁGINA
     * ===================================================================== */

    function ehPaginaBaseArquivoDigital() {
        return /\/ged\/hwmconaluno\.aspx$/i.test(location.pathname);
    }

    function ehModoConsulta() {
        return ehPaginaBaseArquivoDigital() &&
               location.hash.toLowerCase() === APP.hashes.consulta;
    }

    function ehModoUpload() {
        return ehPaginaBaseArquivoDigital() &&
               location.hash.toLowerCase() === APP.hashes.upload;
    }

    function ehPaginaArquivoDigital() {
        return ehModoConsulta() || ehModoUpload();
    }

    function quandoDOMPronto(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function iniciarSeNecessario() {
        if (!ehPaginaArquivoDigital()) return;
        quandoDOMPronto(() => {
            if (!ehPaginaArquivoDigital()) return;
            init();
        });
    }

    queueMicrotask(iniciarSeNecessario);
    window.addEventListener('hashchange', iniciarSeNecessario);

    /* =====================================================================
     * 4. UTILITÁRIOS
     * ===================================================================== */

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function humanSize(bytes) {
        if (!Number.isFinite(bytes)) return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        return `${size.toFixed(unit ? 2 : 0)} ${units[unit]}`;
    }

    function normalizeText(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeLoose(value) {
        return normalizeText(value).toLowerCase();
    }

    function safeFilename(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseDateFlexible(value) {
        if (!value && value !== 0) return '';

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
        }

        if (typeof value === 'number' && window.XLSX?.SSF?.parse_date_code) {
            const d = XLSX.SSF.parse_date_code(value);
            if (d?.y) return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
        }

        const text = String(value).trim();
        const br = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
        if (br) {
            let year = Number(br[3]);
            if (year < 100) year += year >= 30 ? 1900 : 2000;
            return `${String(Number(br[1])).padStart(2, '0')}/${String(Number(br[2])).padStart(2, '0')}/${year}`;
        }

        const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return `${String(Number(iso[3])).padStart(2, '0')}/${String(Number(iso[2])).padStart(2, '0')}/${iso[1]}`;

        return text;
    }

    function dateForFilename(brDate) {
        const m = String(brDate || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : safeFilename(brDate || 'SEM-DATA');
    }

    function levenshtein(a, b) {
        a = normalizeText(a);
        b = normalizeText(b);
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;

        const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
        const curr = new Array(b.length + 1);

        for (let i = 1; i <= a.length; i++) {
            curr[0] = i;
            for (let j = 1; j <= b.length; j++) {
                curr[j] = Math.min(
                    curr[j - 1] + 1,
                    prev[j] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
            for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
        }
        return prev[b.length];
    }

    function similarity(a, b) {
        const na = normalizeText(a);
        const nb = normalizeText(b);
        if (!na || !nb) return 0;
        if (na === nb) return 1;
        const max = Math.max(na.length, nb.length);
        return Math.max(0, 1 - levenshtein(na, nb) / max);
    }

    function inferStudentCode(filename) {
        const base = String(filename || '').replace(/\.pdf$/i, '');
        const match = base.match(/(?:^|\D)(\d{4,})(?:\D|$)/);
        return match ? match[1] : '';
    }

    function addLog(message, type = 'info') {
        const entry = { time: new Date(), type, message };
        state.logs.push(entry);
        if (!el.log) return;
        const line = document.createElement('div');
        line.className = `${APP.id}-log-line ${APP.id}-log-${type}`;
        line.textContent = `[${entry.time.toLocaleTimeString('pt-BR')}] ${message}`;
        el.log.appendChild(line);
        el.log.scrollTop = el.log.scrollHeight;
    }

    function updateProgress(percent, text) {
        if (!el.progressBar || !el.progressText) return;
        const value = Math.max(0, Math.min(100, Math.round(percent)));
        el.progressBar.style.width = `${value}%`;
        el.progressText.textContent = `${value}% — ${text}`;
    }

    function setBusy(busy) {
        state.processing = busy;
        document.querySelectorAll(`#${APP.id}-app button, #${APP.id}-app input, #${APP.id}-app select`).forEach(node => {
            if (node.dataset.keepEnabled === '1') return;
            if (node.id === `${APP.id}-cancel`) return;
            node.disabled = busy;
        });
        if (el.cancelBtn) el.cancelBtn.style.display = busy ? '' : 'none';
        atualizarBotoes();
        refreshSearchControls();
    }

    function showError(error, prefix = '') {
        console.error(error);
        const message = `${prefix}${prefix ? ': ' : ''}${error?.message || error}`;
        addLog(message, 'error');
        alert(message);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function getStudentMeta() {
        return {
            historical: el.historical?.checked || false,
            root: el.archiveRoot?.value || 'PERMANENTE',
            code: el.studentCode?.value?.trim() || '',
            name: el.studentName?.value?.trim() || '',
            birth: el.studentBirth?.value?.trim() || '',
            sheet: state.selectedStudentMatch?.sheet || '',
            row: state.selectedStudentMatch?.row || '',
            nameCol: state.selectedStudentMatch?.nameCol || '',
            birthCol: state.selectedStudentMatch?.birthCol || '',
            folderCol: state.selectedStudentMatch?.folderCol || '',
            existingFolderUrl: state.selectedStudentMatch?.folderUrl || ''
        };
    }

    /* =====================================================================
     * 5. INTERFACE
     * ===================================================================== */

    function injectStyles() {
        if (document.getElementById(`${APP.id}-style`)) return;
        const style = document.createElement('style');
        style.id = `${APP.id}-style`;
        style.textContent = `
            #${APP.id}-app, #${APP.id}-app * { box-sizing: border-box; }
            #${APP.id}-app {
                position: fixed; inset: 0; z-index: 2147482000;
                background: #eef1f6; color: #20263a;
                font-family: Arial, Helvetica, sans-serif; overflow: hidden;
            }
            #${APP.id}-app .ad-shell { height:100vh; display:grid; grid-template-rows:auto auto 1fr auto; }
            #${APP.id}-app .ad-header {
                display:flex; align-items:center; justify-content:space-between; gap:16px;
                padding:12px 20px 12px 64px; background:#fff; border-bottom:1px solid #dde3ec;
                box-shadow:0 2px 12px rgba(25,37,60,.06);
            }
            #${APP.id}-app .ad-title { font-size:20px; font-weight:800; }
            #${APP.id}-app .ad-subtitle { margin-top:3px; font-size:11px; color:#6d7588; }
            #${APP.id}-app .ad-header-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
            #${APP.id}-app button, #${APP.id}-app .ad-btn {
                border:1px solid #ccd4df; border-radius:9px; padding:8px 12px; background:#fff; color:#26304a;
                cursor:pointer; font-size:12px; transition:.15s ease;
            }
            #${APP.id}-app button:hover:not(:disabled) { transform:translateY(-1px); border-color:#2878e7; }
            #${APP.id}-app button:disabled { opacity:.45; cursor:not-allowed; transform:none; }
            #${APP.id}-app .primary { background:#2878e7; border-color:#2878e7; color:white; }
            #${APP.id}-app .success { background:#147a46; border-color:#147a46; color:white; }
            #${APP.id}-app .danger { background:#fff2f2; border-color:#efbbbb; color:#a92a24; }
            #${APP.id}-app .ghost { background:#f7f9fc; }
            #${APP.id}-app .ad-identity {
                padding:10px 20px 10px 64px; background:#f8fafc; border-bottom:1px solid #dde3ec;
                display:grid; grid-template-columns:150px 175px minmax(220px,1fr) 150px 170px auto; gap:9px; align-items:end;
            }
            #${APP.id}-app label { display:block; margin-bottom:4px; color:#687086; font-size:10px; font-weight:700; text-transform:uppercase; }
            #${APP.id}-app input[type="text"], #${APP.id}-app input[type="url"], #${APP.id}-app select {
                width:100%; min-height:35px; border:1px solid #cbd3df; border-radius:8px; padding:7px 9px; background:#fff; color:#20263a; font-size:12px;
            }
            #${APP.id}-app input:focus, #${APP.id}-app select:focus { outline:2px solid rgba(40,120,231,.18); border-color:#2878e7; }
            #${APP.id}-app .checkbox-line { min-height:35px; display:flex; align-items:center; gap:7px; padding:0 4px; font-size:12px; }
            #${APP.id}-app .checkbox-line input { width:16px; height:16px; }
            #${APP.id}-app .ad-main { min-height:0; display:grid; grid-template-columns:320px minmax(0,1fr); }
            #${APP.id}-app .ad-left, #${APP.id}-app .ad-right { min-height:0; overflow:auto; background:#fff; padding:14px; }
            #${APP.id}-app .ad-left { border-right:1px solid #dde3ec; }
            #${APP.id}-app .ad-right { display:none; }
            #${APP.id}-app .ad-center { min-height:0; overflow:auto; padding:14px; }
            #${APP.id}-app .section { margin-bottom:14px; border:1px solid #e0e5ed; border-radius:12px; background:#fff; overflow:hidden; }
            #${APP.id}-app .section-title { padding:9px 10px; background:#f6f8fb; border-bottom:1px solid #e5e9f0; font-size:11px; font-weight:800; color:#364057; }
            #${APP.id}-app .section-body { padding:10px; }
            #${APP.id}-app .row { display:flex; gap:7px; align-items:center; margin-bottom:8px; }
            #${APP.id}-app .row:last-child { margin-bottom:0; }
            #${APP.id}-app .row > * { min-width:0; }
            #${APP.id}-app .grow { flex:1; }
            #${APP.id}-app .tiny { font-size:10px; color:#737c90; line-height:1.4; }
            #${APP.id}-app .status-card { border-radius:9px; padding:9px; font-size:11px; background:#f5f7fa; border:1px solid #e1e6ed; line-height:1.5; }
            #${APP.id}-app .status-ok { background:#eef9f2; border-color:#bfe4cc; color:#17643b; }
            #${APP.id}-app .status-warn { background:#fff8e8; border-color:#eed99c; color:#815d00; }
            #${APP.id}-app .status-error { background:#fff0f0; border-color:#efc1c1; color:#9a2b25; }
            #${APP.id}-app .search-results {
                display:flex; flex-direction:column; gap:7px; margin-top:10px;
                max-height:340px; overflow-y:auto; padding-right:4px;
            }
            #${APP.id}-app .search-result {
                padding:9px 10px; border:1px solid #d9e1ec; border-radius:9px; background:#fff;
                box-shadow:0 1px 5px rgba(31,48,78,.04); flex:0 0 auto;
            }
            #${APP.id}-app .search-result.selected {
                border:2px solid #29945d; background:#effaf4;
                box-shadow:0 3px 10px rgba(27,126,76,.12);
            }
            #${APP.id}-app .search-result.selected::before {
                content:'ALUNO SELECIONADO';
                display:inline-block; margin-bottom:6px; padding:3px 6px;
                border-radius:999px; background:#d9f3e5; color:#17643b;
                font-size:8.5px; font-weight:800; letter-spacing:.2px;
            }
            #${APP.id}-app .search-result-name {
                font-size:11px; font-weight:800; color:#293247; line-height:1.35; margin-bottom:6px;
            }
            #${APP.id}-app .search-result-meta {
                display:grid; grid-template-columns:1fr 1fr; gap:4px 8px;
                font-size:9.5px; color:#6f778a; line-height:1.35;
            }
            #${APP.id}-app .search-result-meta b { color:#3b455a; }
            #${APP.id}-app .search-result-bottom {
                display:flex; align-items:center; gap:6px; margin-top:7px;
            }
            #${APP.id}-app .search-result-bottom .result-mode {
                margin-right:auto; font-size:9px; color:#758095;
            }
            #${APP.id}-app .search-result-bottom button {
                padding:6px 10px; min-width:86px;
            }
            #${APP.id}-app .folder-load-box {
                margin-top:10px; padding:11px; border:1px solid #b9d9c6; border-radius:11px;
                background:#f1faf5;
            }
            #${APP.id}-app .folder-load-box strong { display:block; margin-bottom:6px; font-size:11px; color:#17643b; }
            #${APP.id}-app .folder-doc-list { display:grid; gap:6px; margin-top:9px; }
            #${APP.id}-app .folder-doc-item {
                padding:7px 8px; border:1px solid #dbe3eb; border-radius:8px; background:#fff;
                font-size:10px; line-height:1.4;
            }

            #${APP.id}-match-modal {
                position:fixed; inset:0; z-index:2147483200; display:none; align-items:center; justify-content:center;
                background:rgba(16,25,42,.68); backdrop-filter:blur(4px); padding:22px;
            }
            #${APP.id}-match-modal .match-box {
                width:min(1050px,96vw); max-height:90vh; overflow:hidden; display:grid; grid-template-rows:auto 1fr;
                background:#f5f7fb; border-radius:18px; box-shadow:0 28px 90px rgba(0,0,0,.35);
            }
            #${APP.id}-match-modal .match-head {
                padding:17px 18px; background:#fff; border-bottom:1px solid #dfe5ed;
                display:flex; justify-content:space-between; gap:12px; align-items:center;
            }
            #${APP.id}-match-modal .match-head h2 { margin:0 0 3px; font:800 18px Arial,sans-serif; color:#252d40; }
            #${APP.id}-match-modal .match-head p { margin:0; font:11px Arial,sans-serif; color:#70798c; }
            #${APP.id}-match-modal .match-body { overflow:hidden; padding:14px 16px 16px; }
            #${APP.id}-match-modal .match-grid {
                height:min(68vh,620px); overflow-y:auto; padding-right:5px;
                display:flex; flex-direction:column; gap:7px;
            }
            #${APP.id}-match-modal .match-list-head {
                position:sticky; top:0; z-index:2;
                display:grid; grid-template-columns:minmax(250px,2.2fr) 125px 115px 100px 65px 115px;
                gap:10px; align-items:center; padding:8px 11px;
                background:#e9eef5; border:1px solid #d3dce8; border-radius:8px;
                font:800 10px Arial,sans-serif; color:#59647a;
            }
            #${APP.id}-match-modal .match-card {
                display:grid; grid-template-columns:minmax(250px,2.2fr) 125px 115px 100px 65px 115px;
                gap:10px; align-items:center;
                background:#fff; border:1px solid #dce4ef; border-radius:9px; padding:9px 11px;
                box-shadow:0 1px 5px rgba(26,39,67,.05);
            }
            #${APP.id}-match-modal .match-card.best { border-color:#8eb8ec; background:#f8fbff; }
            #${APP.id}-match-modal .match-name {
                min-width:0; font:800 11.5px/1.35 Arial,sans-serif; color:#26304a;
            }
            #${APP.id}-match-modal .match-cell {
                min-width:0; font:10px/1.35 Arial,sans-serif; color:#606a7d;
                overflow-wrap:anywhere;
            }
            #${APP.id}-match-modal .match-cell b { color:#2d374c; }
            #${APP.id}-match-modal .match-score {
                display:inline-block; padding:3px 6px; border-radius:999px; background:#eaf3ff; color:#2268bd;
                font:800 9px Arial,sans-serif;
            }
            #${APP.id}-match-modal .match-score.term {
                background:#f0f2f5; color:#5e687a;
            }
            #${APP.id}-match-modal .match-folder {
                padding:5px 6px; border-radius:7px; background:#eff9f3; color:#17643b;
                font:700 9px Arial,sans-serif; text-align:center;
            }
            #${APP.id}-match-modal .match-no-folder {
                padding:5px 6px; border-radius:7px; background:#f5f6f8; color:#70798c;
                font:9px Arial,sans-serif; text-align:center;
            }
            #${APP.id}-match-modal .match-select {
                width:100%; border:0; border-radius:8px; padding:7px 8px; cursor:pointer;
                background:#2878e7; color:#fff; font:700 9.5px Arial,sans-serif;
            }
            @media (max-width:900px) {
                #${APP.id}-match-modal .match-list-head { display:none; }
                #${APP.id}-match-modal .match-card {
                    grid-template-columns:1fr 1fr;
                }
                #${APP.id}-match-modal .match-name { grid-column:1 / -1; font-size:12px; }
            }
            #${APP.id}-app .dropzone {
                min-height:115px; border:2px dashed #c8d0dc; border-radius:14px; background:rgba(255,255,255,.7);
                display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#6f778a; text-align:center; padding:14px;
            }
            #${APP.id}-app .dropzone.active { border-color:#2878e7; background:#edf5ff; }
            #${APP.id}-app .pages { display:grid; grid-template-columns:repeat(auto-fill,minmax(205px,1fr)); gap:12px; margin-top:12px; align-items:start; }
            #${APP.id}-app .page-card { background:#fff; border:2px solid transparent; border-radius:12px; padding:9px; box-shadow:0 3px 10px rgba(30,43,68,.08); cursor:grab; }
            #${APP.id}-app .page-card.drag-over { border-color:#2878e7; }
            #${APP.id}-app .page-head { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:6px; }
            #${APP.id}-app .page-head strong { font-size:11px; }
            #${APP.id}-app .page-head span { font-size:9px; color:#7b8292; }
            #${APP.id}-app .thumb-wrap { min-height:170px; border-radius:8px; background:#e9edf3; overflow:hidden; display:flex; align-items:center; justify-content:center; }
            #${APP.id}-app .thumb { display:block; max-width:100%; height:auto; background:white; }
            #${APP.id}-app .page-select { margin-top:7px; }
            #${APP.id}-app .page-actions { display:flex; gap:5px; margin-top:7px; }
            #${APP.id}-app .page-actions button { flex:1; padding:6px; font-size:10px; }
            #${APP.id}-app .ai-line { margin-top:6px; padding:6px 7px; border-radius:7px; font-size:9px; background:#f5f7fb; color:#5e6677; }
            #${APP.id}-app .ai-high { background:#edf8f0; color:#17643b; }
            #${APP.id}-app .ai-mid { background:#fff7e6; color:#805b00; }
            #${APP.id}-app .vision-status {
                margin-top:7px; padding:7px 8px; border-radius:8px; background:#f3f6fa;
                font-size:9px; line-height:1.45; color:#59657a;
            }
            #${APP.id}-app .summary-row { display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid #edf0f4; font-size:10px; }
            #${APP.id}-app .summary-row:last-child { border-bottom:0; }
            #${APP.id}-app .summary-row strong { color:#2878e7; }
            #${APP.id}-app .log { height:180px; overflow:auto; border:1px solid #e1e5eb; border-radius:9px; background:#f8f9fb; padding:7px; font:10px/1.4 Consolas,monospace; }
            #${APP.id}-app .${APP.id}-log-line { margin-bottom:5px; padding-bottom:5px; border-bottom:1px solid #edf0f4; }
            #${APP.id}-app .${APP.id}-log-success { color:#14713c; }
            #${APP.id}-app .${APP.id}-log-error { color:#aa2a22; }
            #${APP.id}-app .${APP.id}-log-warning { color:#866100; }
            #${APP.id}-app .ad-footer { padding:9px 18px 9px 64px; background:#fff; border-top:1px solid #dde3ec; display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; }
            #${APP.id}-app .progress-shell { height:8px; border-radius:99px; overflow:hidden; background:#e5e9f0; }
            #${APP.id}-app .progress-bar { width:0; height:100%; background:#2878e7; transition:width .2s ease; }
            #${APP.id}-app .progress-text { margin-top:4px; font-size:10px; color:#697185; }
            #${APP.id}-app .footer-actions { display:flex; gap:7px; flex-wrap:wrap; justify-content:flex-end; }
            #${APP.id}-app .pill { display:inline-block; padding:2px 6px; border-radius:99px; background:#edf3ff; color:#286dc7; font-size:9px; font-weight:700; }
            #${APP.id}-modal { position:fixed; inset:0; z-index:2147483000; background:rgba(0,0,0,.6); display:none; align-items:center; justify-content:center; padding:20px; }
            #${APP.id}-modal .box { width:min(950px,95vw); max-height:92vh; overflow:auto; background:white; border-radius:14px; padding:12px; }
            #${APP.id}-modal .head { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px; }
            #${APP.id}-preview { display:block; max-width:100%; height:auto; margin:auto; background:#eee; }

            /* Tela de Consulta */
            #${APP.id}-app .consult-shell { height:100vh; display:grid; grid-template-rows:auto auto 1fr; }
            #${APP.id}-app .consult-search {
                padding:14px 20px 14px 64px; background:#f8fafc; border-bottom:1px solid #dde3ec;
                display:grid; grid-template-columns:180px minmax(260px,1fr) 170px auto; gap:10px; align-items:end;
            }
            #${APP.id}-app .consult-main {
                min-height:0; display:grid; grid-template-columns:360px minmax(0,1fr);
            }
            #${APP.id}-app .consult-left {
                min-height:0; overflow:auto; background:#fff; border-right:1px solid #dde3ec; padding:16px;
            }
            #${APP.id}-app .consult-content {
                min-height:0; overflow:auto; padding:18px;
            }
            #${APP.id}-app .student-hero {
                border:1px solid #dfe5ee; background:#fff; border-radius:14px; padding:16px; margin-bottom:14px;
                box-shadow:0 3px 12px rgba(28,40,64,.05);
            }
            #${APP.id}-app .student-hero h2 { margin:0 0 6px; font-size:18px; }
            #${APP.id}-app .student-hero .meta { font-size:11px; color:#6c7486; line-height:1.65; }
            #${APP.id}-app .consult-toolbar {
                display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px;
            }
            #${APP.id}-app .document-grid {
                display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px;
            }
            #${APP.id}-app .document-card {
                border:1px solid #dfe5ee; border-radius:13px; background:#fff; padding:13px;
                box-shadow:0 3px 10px rgba(28,40,64,.05); display:flex; flex-direction:column; gap:8px;
            }
            #${APP.id}-app .document-card:hover { border-color:#a8c8f4; box-shadow:0 5px 16px rgba(28,40,64,.08); }
            #${APP.id}-app .document-icon { font-size:30px; line-height:1; }
            #${APP.id}-app .document-card strong { font-size:12px; overflow-wrap:anywhere; }
            #${APP.id}-app .document-card .doc-meta { font-size:10px; color:#747d90; line-height:1.45; }
            #${APP.id}-app .document-actions { display:flex; gap:6px; margin-top:auto; }
            #${APP.id}-app .empty-documents {
                min-height:260px; display:flex; flex-direction:column; align-items:center; justify-content:center;
                gap:10px; border:2px dashed #cdd5e1; border-radius:16px; color:#727b8d; background:rgba(255,255,255,.65);
                text-align:center; padding:24px;
            }
            #${APP.id}-doc-modal {
                position:fixed; inset:0; z-index:2147483100; background:rgba(0,0,0,.65);
                display:none; flex-direction:column; padding:18px;
            }
            #${APP.id}-doc-modal .doc-modal-box {
                width:min(1200px,96vw); height:calc(100vh - 36px); margin:auto; background:#fff;
                border-radius:14px; display:grid; grid-template-rows:auto 1fr; overflow:hidden;
            }
            #${APP.id}-doc-modal .doc-modal-head {
                padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px;
                border-bottom:1px solid #dde3ec;
            }
            #${APP.id}-doc-frame { width:100%; height:100%; border:0; background:#eef1f5; }

            @media (max-width:1200px) {
                #${APP.id}-app .ad-main { grid-template-columns:280px minmax(0,1fr); }
                #${APP.id}-app .ad-right { display:none; }
                #${APP.id}-app .ad-identity { grid-template-columns:150px 160px 1fr 150px; }
            }
        `;
        document.head.appendChild(style);
    }


    function ensureMatchModal() {
        let modal = document.getElementById(`${APP.id}-match-modal`);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = `${APP.id}-match-modal`;
            modal.innerHTML = `
                <div class="match-box">
                    <div class="match-head">
                        <div>
                            <h2>Possíveis correspondências</h2>
                            <p>Escolha o aluno correto na lista abaixo.</p>
                        </div>
                        <button id="${APP.id}-match-close">Fechar</button>
                    </div>
                    <div class="match-body">
                        <div id="${APP.id}-match-grid" class="match-grid"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector(`#${APP.id}-match-close`).addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', event => {
                if (event.target === modal) modal.style.display = 'none';
            });
        }

        el.matchModal = modal;
        el.matchGrid = modal.querySelector(`#${APP.id}-match-grid`);
        return modal;
    }

    function showMatchChooser(results) {
        const modal = ensureMatchModal();
        const list = Array.isArray(results) ? results : [];
        const simpleMode = list[0]?.matchMode === 'contains';

        const subtitle = modal.querySelector('.match-head p');
        if (subtitle) {
            subtitle.textContent = simpleMode
                ? `Busca rápida por “${el.studentName.value.trim()}”. Escolha pelo nome completo, nascimento, caixa e linha.`
                : 'Confira os dados antes de selecionar o aluno correto.';
        }

        el.matchGrid.innerHTML = `
            <div class="match-list-head">
                <div>Nome completo</div>
                <div>Nascimento</div>
                <div>Arquivo</div>
                <div>Caixa/Aba</div>
                <div>Linha</div>
                <div>Ação</div>
            </div>
            ${list.map((r, i) => `
                <article class="match-card ${i === 0 && !simpleMode ? 'best' : ''}">
                    <div class="match-name">
                        ${escapeHtml(r.name)}
                        <div style="margin-top:4px">
                            ${simpleMode
                                ? `<span class="match-score term">contém “${escapeHtml(el.studentName.value.trim())}”</span>`
                                : `<span class="match-score">${Math.round(Math.min(1, r.score) * 100)}%</span>`}
                        </div>
                    </div>
                    <div class="match-cell"><b>${escapeHtml(r.birth || 'não informado')}</b></div>
                    <div class="match-cell">${escapeHtml(r.root)}</div>
                    <div class="match-cell"><b>${escapeHtml(r.sheet)}</b></div>
                    <div class="match-cell"><b>${r.row}</b></div>
                    <div>
                        ${r.folderUrl
                            ? '<div class="match-folder">📁 Pasta digital</div>'
                            : '<div class="match-no-folder">Sem pasta</div>'}
                        <button class="match-select" data-match-index="${i}" style="margin-top:5px">Selecionar</button>
                    </div>
                </article>
            `).join('')}
        `;

        el.matchGrid.querySelectorAll('[data-match-index]').forEach(button => {
            button.addEventListener('click', () => {
                const match = list[Number(button.dataset.matchIndex)];
                selectStudentMatch(match, false);
                modal.style.display = 'none';
            });
        });

        modal.style.display = 'flex';
    }

    function renderEmbeddedMatches(results) {
        if (!el.searchResults) return;

        const original = Array.isArray(results) ? results : [];
        const selected = state.selectedStudentMatch;
        let list = [...original];

        // Sempre fixa o aluno selecionado na primeira posição da lista lateral.
        if (selected) {
            const sameStudent = item =>
                item.root === selected.root &&
                item.sheet === selected.sheet &&
                item.row === selected.row;

            const selectedIndex = list.findIndex(sameStudent);

            if (selectedIndex >= 0) {
                const [selectedItem] = list.splice(selectedIndex, 1);
                list.unshift(selectedItem);
            } else {
                // Se a lista tiver sido atualizada ou filtrada, ainda assim
                // preservamos a seleção visível no topo.
                list.unshift({
                    ...selected,
                    matchMode: selected.matchMode || state.lastSearchMode || 'selected',
                    searchTerm: selected.searchTerm || state.lastSearchTerm || '',
                    score: Number.isFinite(selected.score) ? selected.score : 1
                });
            }
        }

        el.searchResults.innerHTML = list.map((r, i) => {
            const isSelected = Boolean(selected &&
                selected.root === r.root &&
                selected.sheet === r.sheet &&
                selected.row === r.row);

            let modeText = '';
            if (isSelected) {
                modeText = 'seleção atual';
            } else if (r.matchMode === 'contains') {
                modeText = `contém “${escapeHtml(state.lastSearchTerm || el.studentName.value.trim())}”`;
            } else if (Number.isFinite(r.score)) {
                modeText = `${Math.round(Math.min(1, r.score) * 100)}% de correspondência`;
            }

            return `
                <div class="search-result ${isSelected ? 'selected' : ''}">
                    <div class="search-result-name">${isSelected ? '✓ ' : ''}${escapeHtml(r.name)}</div>
                    <div class="search-result-meta">
                        <div>Nascimento<br><b>${escapeHtml(r.birth || 'não informado')}</b></div>
                        <div>Arquivo<br><b>${escapeHtml(r.root)}</b></div>
                        <div>Caixa/Aba<br><b>${escapeHtml(r.sheet)}</b></div>
                        <div>Linha<br><b>${r.row}</b></div>
                    </div>
                    <div class="search-result-bottom">
                        <span class="result-mode">${modeText}</span>
                        ${r.folderUrl ? '<span class="pill">📁</span>' : ''}
                        <button class="${isSelected ? 'success' : 'primary'}" data-result="${i}">
                            ${isSelected ? 'Selecionado' : 'Selecionar'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        el.searchResults.querySelectorAll('[data-result]').forEach(node => {
            node.addEventListener('click', () => selectStudentMatch(list[Number(node.dataset.result)], false));
        });
    }

    function buildUploadInterface() {
        document.getElementById(`${APP.id}-app`)?.remove();
        document.getElementById(`${APP.id}-modal`)?.remove();

        const app = document.createElement('div');
        app.id = `${APP.id}-app`;
        app.innerHTML = `
            <div class="ad-shell">
                <header class="ad-header">
                    <div>
                        <div class="ad-title">Arquivo Digital — Upload</div>
                        <div class="ad-subtitle">Identifique o aluno, classifique as páginas e salve nos destinos • v${APP.version}</div>
                    </div>
                    <div class="ad-header-actions">
                        <button id="${APP.id}-load-lists" style="display:none" aria-hidden="true">Carregar lista local</button>
                        <input type="file" id="${APP.id}-list-files" accept=".xlsx,.xls" multiple hidden>
                        <button id="${APP.id}-drive-config">Configurar Drive</button>
                        <button id="${APP.id}-scanner" title="Será habilitado com o Scanner Bridge">🖨 Scanner (em breve)</button>
                        <button id="${APP.id}-close">Fechar</button>
                    </div>
                </header>

                <section class="ad-identity">
                    <div>
                        <label>Tipo de aluno</label>
                        <div class="checkbox-line"><input type="checkbox" id="${APP.id}-historical"> <span>Fora do SIGEDUCA</span></div>
                    </div>
                    <div>
                        <label>Arquivo</label>
                        <select id="${APP.id}-root">
                            <option value="PERMANENTE">PERMANENTE</option>
                            <option value="FORMANDOS">FORMANDOS</option>
                        </select>
                    </div>
                    <div>
                        <label>Nome ou parte do nome</label>
                        <input type="text" id="${APP.id}-name" placeholder="Ex.: Felipe">
                    </div>
                    <div>
                        <label>Nascimento</label>
                        <input type="text" id="${APP.id}-birth" placeholder="dd/mm/aaaa">
                    </div>
                    <div>
                        <label>Código SIGEDUCA</label>
                        <input type="text" id="${APP.id}-code" inputmode="numeric" placeholder="Opcional p/ histórico">
                    </div>
                    <div>
                        <button class="primary" id="${APP.id}-search-student">Pesquisar aluno</button>
                    </div>
                </section>

                <div class="ad-main">
                    <aside class="ad-left">
                        <div class="section">
                            <div class="section-title">Localização no arquivo físico</div>
                            <div class="section-body">
                                <div id="${APP.id}-list-status" class="status-card status-warn">Pesquisa online: configure o Google Drive e digite o nome do aluno.</div>
                                <div id="${APP.id}-search-results" class="search-results"></div>

                                <div id="${APP.id}-upload-folder-box" class="folder-load-box" style="display:none">
                                    <strong>📁 Este aluno já possui pasta digital</strong>
                                    <button class="success" id="${APP.id}-upload-load-folder" style="width:100%">Carregar Pasta Digital</button>
                                    <div id="${APP.id}-upload-folder-docs" class="folder-doc-list"></div>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Destinos</div>
                            <div class="section-body">
                                <div class="checkbox-line"><input type="checkbox" id="${APP.id}-dest-ged" checked> <span>SIGEDUCA / GED</span></div>
                                <div class="checkbox-line"><input type="checkbox" id="${APP.id}-dest-local" checked> <span>Computador (PDF único)</span></div>
                                <div class="checkbox-line"><input type="checkbox" id="${APP.id}-dest-drive"> <span>Google Drive</span></div>
                                <div class="tiny" style="margin-top:6px">Tipos exclusivos do Arquivo Digital nunca são enviados ao GED, mesmo com o destino GED marcado.</div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Google Drive</div>
                            <div class="section-body">
                                <div id="${APP.id}-drive-status" class="status-card">Endpoint ainda não configurado.</div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Identificação automática / OCR</div>
                            <div class="section-body">
                                <div class="status-card">
                                    <b>PDF com texto:</b> usa o texto existente no arquivo.<br>
                                    <b>PDF escaneado:</b> executa OCR local em português e depois classifica pelo texto reconhecido.
                                </div>
                                <div class="vision-status" id="${APP.id}-ocr-status">
                                    OCR ainda não iniciado.
                                </div>
                                <div class="tiny" style="margin-top:7px">
                                    O OCR roda no computador do usuário. A sugestão deve ser conferida antes de aceitar.
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Resumo da classificação</div>
                            <div class="section-body" id="${APP.id}-summary">Nenhuma página carregada.</div>
                        </div>
                    </aside>

                    <main class="ad-center">
                        <div id="${APP.id}-dropzone" class="dropzone">
                            <strong>Adicione PDFs ou fotos do aluno</strong>
                            <span class="tiny">Novos arquivos são acrescentados ao trabalho atual. Aceita PDF, JPG e PNG.</span>
                            <div class="row">
                                <button class="primary" id="${APP.id}-choose-pdf">Adicionar arquivos</button>
                                <button id="${APP.id}-auto-detect" disabled>🤖 Identificar / OCR</button>
                                <button id="${APP.id}-accept-ai" disabled>Aceitar sugestões ≥ 85%</button>
                            </div>
                            <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" id="${APP.id}-pdf" multiple hidden>
                        </div>
                        <div id="${APP.id}-pages" class="pages"></div>
                    </main>

                    <aside class="ad-right">
                        <div id="${APP.id}-generated"></div>
                        <div id="${APP.id}-log"></div>
                    </aside>
                </div>

                <footer class="ad-footer">
                    <div>
                        <div class="progress-shell"><div class="progress-bar" id="${APP.id}-progress-bar"></div></div>
                        <div class="progress-text" id="${APP.id}-progress-text">0% — Sistema pronto</div>
                    </div>
                    <div class="footer-actions">
                        <button class="danger" id="${APP.id}-clear">Limpar</button>
                        <button class="danger" id="${APP.id}-cancel" style="display:none" data-keep-enabled="1">Cancelar</button>
                        <button class="success" id="${APP.id}-execute" disabled>Gerar e salvar nos destinos</button>
                    </div>
                </footer>
            </div>
        `;

        const modal = document.createElement('div');
        modal.id = `${APP.id}-modal`;
        modal.innerHTML = `
            <div class="box">
                <div class="head">
                    <strong id="${APP.id}-modal-title">Visualização</strong>
                    <button id="${APP.id}-modal-close">Fechar</button>
                </div>
                <canvas id="${APP.id}-preview"></canvas>
            </div>
        `;

        document.body.append(app, modal);

        Object.assign(el, {
            app,
            historical: app.querySelector(`#${APP.id}-historical`),
            archiveRoot: app.querySelector(`#${APP.id}-root`),
            studentName: app.querySelector(`#${APP.id}-name`),
            studentBirth: app.querySelector(`#${APP.id}-birth`),
            studentCode: app.querySelector(`#${APP.id}-code`),
            searchStudentBtn: app.querySelector(`#${APP.id}-search-student`),
            loadListsBtn: app.querySelector(`#${APP.id}-load-lists`),
            listFiles: app.querySelector(`#${APP.id}-list-files`),
            listStatus: app.querySelector(`#${APP.id}-list-status`),
            searchResults: app.querySelector(`#${APP.id}-search-results`),
            uploadFolderBox: app.querySelector(`#${APP.id}-upload-folder-box`),
            uploadLoadFolderBtn: app.querySelector(`#${APP.id}-upload-load-folder`),
            uploadFolderDocs: app.querySelector(`#${APP.id}-upload-folder-docs`),
            destGed: app.querySelector(`#${APP.id}-dest-ged`),
            destLocal: app.querySelector(`#${APP.id}-dest-local`),
            destDrive: app.querySelector(`#${APP.id}-dest-drive`),
            driveStatus: app.querySelector(`#${APP.id}-drive-status`),
            driveConfigBtn: app.querySelector(`#${APP.id}-drive-config`),
            scannerBtn: app.querySelector(`#${APP.id}-scanner`),
            choosePdfBtn: app.querySelector(`#${APP.id}-choose-pdf`),
            pdfInput: app.querySelector(`#${APP.id}-pdf`),
            dropzone: app.querySelector(`#${APP.id}-dropzone`),
            pages: app.querySelector(`#${APP.id}-pages`),
            autoDetectBtn: app.querySelector(`#${APP.id}-auto-detect`),
            ocrStatus: app.querySelector(`#${APP.id}-ocr-status`),
            acceptAiBtn: app.querySelector(`#${APP.id}-accept-ai`),
            summary: app.querySelector(`#${APP.id}-summary`),
            generated: app.querySelector(`#${APP.id}-generated`),
            log: app.querySelector(`#${APP.id}-log`),
            progressBar: app.querySelector(`#${APP.id}-progress-bar`),
            progressText: app.querySelector(`#${APP.id}-progress-text`),
            clearBtn: app.querySelector(`#${APP.id}-clear`),
            cancelBtn: app.querySelector(`#${APP.id}-cancel`),
            executeBtn: app.querySelector(`#${APP.id}-execute`),
            closeBtn: app.querySelector(`#${APP.id}-close`),
            modal,
            modalTitle: modal.querySelector(`#${APP.id}-modal-title`),
            modalClose: modal.querySelector(`#${APP.id}-modal-close`),
            previewCanvas: modal.querySelector(`#${APP.id}-preview`)
        });

        bindUploadInterfaceEvents();
        installWorkspaceTools();
        atualizarDriveStatus();
        setOcrStatus(
            state.ocrWorker
                ? 'OCR em português carregado e pronto.'
                : 'OCR ainda não iniciado. Ele será carregado somente se o PDF não possuir texto.',
            state.ocrWorker ? 'ok' : ''
        );
        atualizarBotoes();
    }

    function bindUploadInterfaceEvents() {
        el.closeBtn.addEventListener('click', () => {
            location.hash = '';
            location.reload();
        });

        el.historical.addEventListener('change', () => {
            el.studentCode.placeholder = el.historical.checked ? 'Opcional p/ histórico' : 'Código do aluno';
        });

        el.archiveRoot.addEventListener('change', () => {
            state.selectedStudentMatch = null;
            state.lastSearchResults = [];
            el.searchResults.innerHTML = '';
            renderStudentLocationStatus();
            updateUploadFolderControls();
        });

        el.loadListsBtn.addEventListener('click', () => el.listFiles.click());
        el.listFiles.addEventListener('change', async event => {
            const files = [...(event.target.files || [])];
            if (files.length) await importListFiles(files);
            event.target.value = '';
        });

        el.searchStudentBtn.addEventListener('click', searchStudentInLists);
        el.studentName.addEventListener('keydown', event => {
            if (event.key === 'Enter') searchStudentInLists();
        });
        el.studentBirth.addEventListener('keydown', event => {
            if (event.key === 'Enter') searchStudentInLists();
        });

        el.uploadLoadFolderBtn.addEventListener('click', loadUploadFolderDocuments);

        el.driveConfigBtn.addEventListener('click', configureDriveEndpoint);
        el.scannerBtn.addEventListener('click', () => {
            alert('O botão já está reservado para o Scanner Bridge. Nesta versão ele ainda não chama o scanner do Windows.');
        });

        el.choosePdfBtn.addEventListener('click', () => el.pdfInput.click());
        el.pdfInput.addEventListener('change', async event => {
            await importSourceFiles([...(event.target.files || [])]);
            event.target.value = '';
        });

        ['dragenter', 'dragover'].forEach(type => el.dropzone.addEventListener(type, event => {
            event.preventDefault();
            el.dropzone.classList.add('active');
        }));
        ['dragleave', 'drop'].forEach(type => el.dropzone.addEventListener(type, event => {
            event.preventDefault();
            el.dropzone.classList.remove('active');
        }));
        el.dropzone.addEventListener('drop', async event => {
            await importSourceFiles([...(event.dataTransfer?.files || [])]);
        });

        el.autoDetectBtn.addEventListener('click', identifyDocumentsOneClick);
        el.acceptAiBtn.addEventListener('click', acceptAiSuggestions);
        el.executeBtn.addEventListener('click', () => executeDestinations());
        el.clearBtn.addEventListener('click', () => clearAll(true));
        el.cancelBtn.addEventListener('click', () => {
            state.cancelled = true;
            stopLocalAi();
            if(state.ocrWorker){state.ocrWorker.terminate();state.ocrWorker=null;state.ocrWorkerPromise=null;}
            addLog('Cancelamento solicitado.', 'warning');
        });

        el.modalClose.addEventListener('click', () => el.modal.style.display = 'none');
        el.modal.addEventListener('click', event => {
            if (event.target === el.modal) el.modal.style.display = 'none';
        });
    }


    /* =====================================================================
     * 5B. TELA DE CONSULTA — interface simples e separada do upload
     * ===================================================================== */

    function buildConsultInterface() {
        document.getElementById(`${APP.id}-app`)?.remove();
        document.getElementById(`${APP.id}-doc-modal`)?.remove();

        const app = document.createElement('div');
        app.id = `${APP.id}-app`;
        app.innerHTML = `
            <div class="consult-shell">
                <header class="ad-header">
                    <div>
                        <div class="ad-title">Arquivo Digital — Consulta</div>
                        <div class="ad-subtitle">Localize o aluno, confira a caixa física e visualize os documentos digitais • v${APP.version}</div>
                    </div>
                    <div class="ad-header-actions">
                        <button id="${APP.id}-load-lists" style="display:none" aria-hidden="true">Carregar lista local</button>
                        <input type="file" id="${APP.id}-list-files" accept=".xlsx,.xls" multiple hidden>
                        <button id="${APP.id}-drive-config">Configurar Drive</button>
                        <button id="${APP.id}-close">Fechar</button>
                    </div>
                </header>

                <section class="consult-search">
                    <div>
                        <label>Arquivo</label>
                        <select id="${APP.id}-root">
                            <option value="PERMANENTE">PERMANENTE</option>
                            <option value="FORMANDOS">FORMANDOS</option>
                        </select>
                    </div>
                    <div>
                        <label>Nome ou parte do nome</label>
                        <input type="text" id="${APP.id}-name" placeholder="Ex.: Felipe">
                    </div>
                    <div>
                        <label>Data de nascimento</label>
                        <input type="text" id="${APP.id}-birth" placeholder="dd/mm/aaaa">
                    </div>
                    <div>
                        <button class="primary" id="${APP.id}-search-student">Pesquisar</button>
                    </div>
                </section>

                <div class="consult-main">
                    <aside class="consult-left">
                        <div class="section">
                            <div class="section-title">Aluno / arquivo físico</div>
                            <div class="section-body">
                                <div id="${APP.id}-list-status" class="status-card status-warn">Pesquisa online: configure o Google Drive e digite o nome do aluno.</div>
                                <div id="${APP.id}-search-results" class="search-results"></div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">Acesso rápido</div>
                            <div class="section-body">
                                <button class="success" id="${APP.id}-load-folder" style="width:100%;display:none">📂 Carregar Pasta Digital</button>
                                <button id="${APP.id}-open-folder" style="width:100%;margin-top:7px;display:none">Abrir pasta no Google Drive</button>
                                <div class="tiny" id="${APP.id}-folder-help" style="margin-top:8px">
                                    Se o aluno possuir pasta digital, o botão para carregá-la aparecerá aqui.
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main class="consult-content">
                        <div id="${APP.id}-student-hero" class="student-hero">
                            <h2>Nenhum aluno selecionado</h2>
                            <div class="meta">Pesquise pelo nome e, de preferência, informe também a data de nascimento.</div>
                        </div>

                        <div class="consult-toolbar">
                            <strong style="margin-right:auto">Documentos digitais</strong>
                            <button id="${APP.id}-refresh-docs" disabled>↻ Atualizar</button>
                            <button id="${APP.id}-test-local">Testar visualização com PDFs locais</button>
                            <input type="file" id="${APP.id}-test-local-input" accept="application/pdf,.pdf" multiple hidden>
                        </div>

                        <div id="${APP.id}-consult-documents" class="empty-documents">
                            <strong>Os documentos do aluno aparecerão aqui.</strong>
                            <span class="tiny">Enquanto o Drive ainda não está conectado, use “Testar visualização com PDFs locais” para experimentar a nova interface.</span>
                        </div>
                    </main>
                </div>
            </div>

            <input type="hidden" id="${APP.id}-code">
        `;

        const docModal = document.createElement('div');
        docModal.id = `${APP.id}-doc-modal`;
        docModal.innerHTML = `
            <div class="doc-modal-box">
                <div class="doc-modal-head">
                    <strong id="${APP.id}-doc-modal-title">Visualização do documento</strong>
                    <div style="display:flex;gap:7px">
                        <a id="${APP.id}-doc-open-new" class="ad-btn" target="_blank" rel="noopener">Abrir em nova guia</a>
                        <button id="${APP.id}-doc-modal-close">Fechar</button>
                    </div>
                </div>
                <iframe id="${APP.id}-doc-frame" title="Visualização do documento"></iframe>
            </div>
        `;

        document.body.append(app, docModal);

        Object.assign(el, {
            app,
            historical: null,
            archiveRoot: app.querySelector(`#${APP.id}-root`),
            studentName: app.querySelector(`#${APP.id}-name`),
            studentBirth: app.querySelector(`#${APP.id}-birth`),
            studentCode: app.querySelector(`#${APP.id}-code`),
            searchStudentBtn: app.querySelector(`#${APP.id}-search-student`),
            loadListsBtn: app.querySelector(`#${APP.id}-load-lists`),
            listFiles: app.querySelector(`#${APP.id}-list-files`),
            listStatus: app.querySelector(`#${APP.id}-list-status`),
            searchResults: app.querySelector(`#${APP.id}-search-results`),
            driveConfigBtn: app.querySelector(`#${APP.id}-drive-config`),
            closeBtn: app.querySelector(`#${APP.id}-close`),
            studentHero: app.querySelector(`#${APP.id}-student-hero`),
            loadFolderBtn: app.querySelector(`#${APP.id}-load-folder`),
            openFolderBtn: app.querySelector(`#${APP.id}-open-folder`),
            folderHelp: app.querySelector(`#${APP.id}-folder-help`),
            refreshDocsBtn: app.querySelector(`#${APP.id}-refresh-docs`),
            testLocalBtn: app.querySelector(`#${APP.id}-test-local`),
            testLocalInput: app.querySelector(`#${APP.id}-test-local-input`),
            consultDocuments: app.querySelector(`#${APP.id}-consult-documents`),
            docModal,
            docModalTitle: docModal.querySelector(`#${APP.id}-doc-modal-title`),
            docFrame: docModal.querySelector(`#${APP.id}-doc-frame`),
            docOpenNew: docModal.querySelector(`#${APP.id}-doc-open-new`),
            docModalClose: docModal.querySelector(`#${APP.id}-doc-modal-close`)
        });

        bindConsultInterfaceEvents();
        installSearchCacheControls();
        renderStudentLocationStatus();
        renderConsultStudentHero();
    }

    function bindConsultInterfaceEvents() {
        el.closeBtn.addEventListener('click', () => {
            revokeConsultationObjectUrls();
            location.hash = '';
            location.reload();
        });

        el.archiveRoot.addEventListener('change', () => {
            state.selectedStudentMatch = null;
            state.lastSearchResults = [];
            el.searchResults.innerHTML = '';
            renderStudentLocationStatus();
            renderConsultStudentHero();
            renderConsultDocuments([]);
        });

        el.loadListsBtn.addEventListener('click', () => el.listFiles.click());
        el.listFiles.addEventListener('change', async event => {
            const files = [...(event.target.files || [])];
            if (files.length) await importListFiles(files);
            event.target.value = '';
        });

        el.searchStudentBtn.addEventListener('click', searchStudentInLists);
        el.studentName.addEventListener('keydown', event => {
            if (event.key === 'Enter') searchStudentInLists();
        });
        el.studentBirth.addEventListener('keydown', event => {
            if (event.key === 'Enter') searchStudentInLists();
        });

        el.driveConfigBtn.addEventListener('click', configureDriveEndpoint);

        el.loadFolderBtn.addEventListener('click', loadConsultDocuments);

        el.openFolderBtn.addEventListener('click', () => {
            const url = state.selectedStudentMatch?.folderUrl;
            if (url) window.open(url, '_blank', 'noopener');
        });

        el.refreshDocsBtn.addEventListener('click', loadConsultDocuments);

        el.testLocalBtn.addEventListener('click', () => el.testLocalInput.click());
        el.testLocalInput.addEventListener('change', event => {
            const files = [...(event.target.files || [])].filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
            if (files.length) loadLocalConsultDocuments(files);
            event.target.value = '';
        });

        el.docModalClose.addEventListener('click', closeConsultPreview);
        el.docModal.addEventListener('click', event => {
            if (event.target === el.docModal) closeConsultPreview();
        });
    }

    function renderConsultStudentHero() {
        if (!el.studentHero) return;
        const match = state.selectedStudentMatch;
        if (!match) {
            el.studentHero.innerHTML = `
                <h2>Nenhum aluno selecionado</h2>
                <div class="meta">Pesquise pelo nome e, de preferência, informe também a data de nascimento.</div>
            `;
            if (el.loadFolderBtn) el.loadFolderBtn.style.display = 'none';
            if (el.openFolderBtn) el.openFolderBtn.style.display = 'none';
            if (el.folderHelp) el.folderHelp.textContent = 'Se o aluno possuir pasta digital, o botão para carregá-la aparecerá aqui.';
            if (el.refreshDocsBtn) el.refreshDocsBtn.disabled = true;
            return;
        }

        el.studentHero.innerHTML = `
            <h2>${escapeHtml(match.name)}</h2>
            <div class="meta">
                Nascimento: <b>${escapeHtml(match.birth || 'não informado')}</b><br>
                Arquivo: <b>${escapeHtml(match.root)}</b> • Caixa/Aba: <b>${escapeHtml(match.sheet)}</b> • Linha: <b>${match.row}</b><br>
                Pasta digital: <b>${match.folderUrl ? 'vinculada' : 'ainda não vinculada'}</b>
            </div>
        `;
        if (el.loadFolderBtn) el.loadFolderBtn.style.display = match.folderUrl ? '' : 'none';
        if (el.openFolderBtn) el.openFolderBtn.style.display = match.folderUrl ? '' : 'none';
        if (el.folderHelp) {
            el.folderHelp.textContent = match.folderUrl
                ? 'Clique em “Carregar Pasta Digital” para trazer os documentos do Google Drive para esta tela.'
                : 'Este registro ainda não possui pasta digital vinculada.';
        }
        if (el.refreshDocsBtn) el.refreshDocsBtn.disabled = !match.folderUrl;
    }

    function revokeConsultationObjectUrls() {
        for (const url of state.consultationObjectUrls) {
            try { URL.revokeObjectURL(url); } catch {}
        }
        state.consultationObjectUrls = [];
    }

    function loadLocalConsultDocuments(files) {
        revokeConsultationObjectUrls();
        const docs = files.map((file, index) => {
            const url = URL.createObjectURL(file);
            state.consultationObjectUrls.push(url);
            return {
                id: `local-${index}-${Date.now()}`,
                name: file.name,
                type: inferDocumentLabelFromFilename(file.name),
                url,
                previewUrl: url,
                source: 'Teste local',
                size: file.size
            };
        });
        state.consultationDocuments = docs;
        renderConsultDocuments(docs);
    }

    function inferDocumentLabelFromFilename(filename) {
        const normalized = normalizeText(filename);
        if (normalized.includes('HISTOR')) return 'Histórico Escolar';
        if (normalized.includes('FICHA INDIVIDUAL')) return 'Ficha Individual';
        if (normalized.includes('MATRIC')) return 'Ficha de Matrícula';
        if (normalized.includes('ATESTADO')) return 'Atestado Médico';
        if (normalized.includes('CERTIFIC') || normalized.includes('DIPLOMA')) return 'Certificado / Diploma';
        if (normalized.includes('SUS')) return 'Cartão SUS';
        if (normalized.includes('PAED')) return 'Documentos PAEDE';
        if (normalized.includes('TERMO')) return 'Termo de Compromisso';
        return 'Documento';
    }

    function renderConsultDocuments(documents, message = '') {
        if (!el.consultDocuments) return;
        const docs = Array.isArray(documents) ? documents : [];

        if (!docs.length) {
            el.consultDocuments.className = 'empty-documents';
            el.consultDocuments.innerHTML = `
                <strong>${escapeHtml(message || 'Nenhum documento listado.')}</strong>
                <span class="tiny">${state.selectedStudentMatch?.folderUrl
                    ? 'Você pode abrir a pasta digital pelo botão à esquerda. A listagem automática será usada quando o endpoint do Drive estiver ativo.'
                    : 'Selecione um aluno com pasta digital ou teste a visualização com PDFs locais.'}</span>
            `;
            return;
        }

        el.consultDocuments.className = 'document-grid';
        el.consultDocuments.innerHTML = docs.map((doc, index) => `
            <article class="document-card">
                <div class="document-icon">📄</div>
                <strong>${escapeHtml(doc.type || 'Documento')}</strong>
                <div>${escapeHtml(doc.name || `Documento ${index + 1}`)}</div>
                <div class="doc-meta">
                    ${doc.source ? `${escapeHtml(doc.source)}<br>` : ''}
                    ${Number.isFinite(doc.size) ? humanSize(doc.size) : ''}
                </div>
                <div class="document-actions">
                    <button class="primary" data-consult-preview="${index}">Visualizar</button>
                    ${doc.url ? `<a class="ad-btn" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}
                </div>
            </article>
        `).join('');

        el.consultDocuments.querySelectorAll('[data-consult-preview]').forEach(button => {
            button.addEventListener('click', () => {
                const doc = docs[Number(button.dataset.consultPreview)];
                openConsultPreview(doc);
            });
        });
    }

    function openConsultPreview(doc) {
        const url = doc?.previewUrl || doc?.url;
        if (!url) return alert('Este documento não possui uma URL de visualização.');
        el.docModalTitle.textContent = doc.name || doc.type || 'Visualização do documento';
        el.docFrame.src = url;
        el.docOpenNew.href = doc.url || url;
        el.docModal.style.display = 'flex';
    }

    function closeConsultPreview() {
        if (!el.docModal) return;
        el.docModal.style.display = 'none';
        el.docFrame.src = 'about:blank';
    }


    function updateUploadFolderControls() {
        if (!el.uploadFolderBox) return;
        const match = state.selectedStudentMatch;
        const hasFolder = Boolean(match?.folderUrl);

        el.uploadFolderBox.style.display = hasFolder ? '' : 'none';
        if (!hasFolder && el.uploadFolderDocs) el.uploadFolderDocs.innerHTML = '';
    }

    async function fetchSelectedStudentDriveDocuments() {
        const match = state.selectedStudentMatch;
        if (!match) throw new Error('Selecione um aluno primeiro.');
        if (!match.folderUrl) throw new Error('Este aluno ainda não possui pasta digital vinculada.');

        const payload = {
            action: 'listStudentDocuments',
            clientVersion: APP.version,
            student: {
                root: match.root,
                name: match.name,
                birth: match.birth,
                physicalSheet: match.sheet,
                physicalRow: match.row,
                nameCol: match.nameCol || '',
                birthCol: match.birthCol || '',
                folderCol: match.folderCol || '',
                existingFolderUrl: match.folderUrl || ''
            }
        };

        const response = await drivePostJson(payload);
        const data = parseDriveResponse(response);

        if (!data.ok) throw new Error(data.error || data.message || 'Não foi possível consultar a pasta digital.');

        if (data.folderUrl) {
            state.selectedStudentMatch.folderUrl = data.folderUrl;
            renderStudentLocationStatus();
            renderConsultStudentHero();
            updateUploadFolderControls();
        }

        return (data.documents || []).map((doc, index) => ({
            id: doc.id || `drive-${index}`,
            name: doc.name || `Documento ${index + 1}`,
            type: doc.type || inferDocumentLabelFromFilename(doc.name || ''),
            url: doc.url || '',
            previewUrl: doc.previewUrl || doc.url || '',
            source: 'Google Drive',
            size: Number(doc.size) || undefined
        }));
    }

    async function loadUploadFolderDocuments() {
        if (!el.uploadLoadFolderBtn || !el.uploadFolderDocs) return;

        el.uploadLoadFolderBtn.disabled = true;
        el.uploadLoadFolderBtn.textContent = 'Carregando pasta...';
        el.uploadFolderDocs.innerHTML = '<div class="tiny">Consultando o Google Drive...</div>';

        try {
            const docs = await fetchSelectedStudentDriveDocuments();

            if (!docs.length) {
                el.uploadFolderDocs.innerHTML = '<div class="folder-doc-item">Pasta localizada, mas nenhum documento foi retornado.</div>';
            } else {
                el.uploadFolderDocs.innerHTML = docs.map(doc => `
                    <div class="folder-doc-item">
                        <b>${escapeHtml(doc.type || 'Documento')}</b><br>
                        ${escapeHtml(doc.name)}
                    </div>
                `).join('');
            }

            addLog(`Pasta digital carregada: ${docs.length} documento(s) existente(s).`, 'success');
        } catch (error) {
            el.uploadFolderDocs.innerHTML = `<div class="folder-doc-item" style="color:#9a2b25">${escapeHtml(error.message)}</div>`;
            addLog(`Pasta digital: ${error.message}`, 'warning');
        } finally {
            el.uploadLoadFolderBtn.disabled = false;
            el.uploadLoadFolderBtn.textContent = 'Carregar Pasta Digital';
        }
    }

    async function loadConsultDocuments() {
        const match = state.selectedStudentMatch;
        if (!match) {
            renderConsultDocuments([], 'Selecione um aluno primeiro.');
            return;
        }
        if (!match.folderUrl) {
            renderConsultDocuments([], 'Este aluno ainda não possui pasta digital vinculada.');
            return;
        }

        if (el.loadFolderBtn) {
            el.loadFolderBtn.disabled = true;
            el.loadFolderBtn.textContent = 'Carregando pasta...';
        }
        if (el.refreshDocsBtn) {
            el.refreshDocsBtn.disabled = true;
            el.refreshDocsBtn.textContent = 'Consultando...';
        }

        try {
            const docs = await fetchSelectedStudentDriveDocuments();
            state.consultationDocuments = docs;
            renderConsultDocuments(docs, 'Nenhum PDF encontrado na pasta digital.');
        } catch (error) {
            console.error(error);
            renderConsultDocuments([], `Falha ao consultar o Drive: ${error.message}`);
        } finally {
            if (el.loadFolderBtn) {
                el.loadFolderBtn.disabled = false;
                el.loadFolderBtn.textContent = '📂 Carregar Pasta Digital';
            }
            if (el.refreshDocsBtn) {
                el.refreshDocsBtn.disabled = false;
                el.refreshDocsBtn.textContent = '↻ Atualizar';
            }
        }
    }


    function atualizarBotoes() {
        if (!el.executeBtn) return;
        const hasSelectedPages = state.pageModels.some(p => p.docKey !== 'ignore');
        el.executeBtn.disabled = state.processing || !hasSelectedPages;
        el.autoDetectBtn.disabled = state.processing || !state.pageModels.length;
        el.acceptAiBtn.disabled = state.processing || !state.pageModels.some(p => p.aiSuggestion?.confidence >= 0.85);
        el.choosePdfBtn.disabled = state.processing;
        if (el.retryBtn) el.retryBtn.disabled = state.processing || !state.generatedDocuments.length;
        el.clearBtn.disabled = state.processing;
    }

    /* =====================================================================
     * 6. IMPORTAÇÃO LOCAL / FALLBACK (a busca normal usa o Google Drive)
     * ===================================================================== */

    async function importListFiles(files) {
        if (!window.XLSX) return alert('A biblioteca XLSX não foi carregada.');

        setBusy(true);
        updateProgress(3, 'Lendo planilhas de localização...');

        try {
            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellFormula: true, cellStyles: false });

                let root = null;
                const n = normalizeText(file.name);
                if (n.includes('FORMANDO')) root = 'FORMANDOS';
                else if (n.includes('PERMANENTE')) root = 'PERMANENTE';
                else {
                    root = prompt(`Não consegui identificar a lista “${file.name}”. Digite PERMANENTE ou FORMANDOS:`)?.toUpperCase();
                    if (!ARCHIVE_ROOTS[root]) {
                        addLog(`Planilha ignorada: ${file.name}.`, 'warning');
                        continue;
                    }
                }

                const index = indexWorkbook(wb, root);
                state.listIndexes[root] = index;
                state.workbookNames[root] = file.name;
                addLog(`${root}: ${index.length} registro(s) indexado(s) em ${wb.SheetNames.length} aba(s).`, 'success');
            }

            renderStudentLocationStatus();
            updateProgress(10, 'Listas carregadas.');
        } catch (error) {
            showError(error, 'Erro ao importar as listas');
        } finally {
            setBusy(false);
        }
    }

    function indexWorkbook(workbook, root) {
        const records = [];

        for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            if (!ws?.['!ref']) continue;

            const range = XLSX.utils.decode_range(ws['!ref']);
            const maxHeaderRow = Math.min(range.e.r, range.s.r + 30);
            const maxHeaderCol = Math.min(range.e.c, range.s.c + 20);

            let headerRow = -1;
            let nameCol = -1;
            let birthCol = -1;
            let folderCol = -1;

            for (let r = range.s.r; r <= maxHeaderRow; r++) {
                for (let c = range.s.c; c <= maxHeaderCol; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })];
                    const text = normalizeText(cell?.v);
                    if (!text) continue;

                    if (nameCol < 0 && /^(ALUNO|ALUNOS|NOME|NOME DO ALUNO|NOME DOS ALUNOS)$/.test(text)) {
                        nameCol = c;
                        headerRow = r;
                    }
                }

                if (headerRow === r && nameCol >= 0) {
                    for (let c = range.s.c; c <= maxHeaderCol; c++) {
                        const text = normalizeText(ws[XLSX.utils.encode_cell({ r, c })]?.v);
                        if (/DATA.*NASC|NASCIMENTO/.test(text)) birthCol = c;
                        if (/PASTA.*DIGITAL|LINK.*PASTA|ARQUIVO.*DIGITAL/.test(text)) folderCol = c;
                    }
                    break;
                }
            }

            // Fallback para planilhas antigas sem cabeçalho padronizado:
            // procura a coluna que contém maior quantidade de nomes e uma coluna de datas próxima.
            if (nameCol < 0) {
                const guessed = guessColumns(ws, range);
                nameCol = guessed.nameCol;
                birthCol = guessed.birthCol;
                headerRow = guessed.headerRow;
            }

            if (nameCol < 0) {
                addLog(`${root}/${sheetName}: não foi possível localizar a coluna de aluno.`, 'warning');
                continue;
            }

            for (let r = Math.max(headerRow + 1, range.s.r); r <= range.e.r; r++) {
                const nameCell = ws[XLSX.utils.encode_cell({ r, c: nameCol })];
                const rawName = nameCell?.v;
                const name = String(rawName ?? '').trim();
                if (!name || name.length < 3) continue;

                const normalizedName = normalizeText(name);
                if (!normalizedName || /^(ALUNO|ALUNOS|NOME)$/.test(normalizedName)) continue;

                const birthCell = birthCol >= 0 ? ws[XLSX.utils.encode_cell({ r, c: birthCol })] : null;
                const birth = parseDateFlexible(birthCell?.v ?? '');

                let folderUrl = '';
                if (folderCol >= 0) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c: folderCol })];
                    folderUrl = extractHyperlink(cell);
                }

                records.push({
                    root,
                    sheet: sheetName,
                    row: r + 1,
                    name,
                    normalizedName,
                    birth,
                    folderUrl,
                    nameCol: nameCol + 1,
                    birthCol: birthCol >= 0 ? birthCol + 1 : null,
                    folderCol: folderCol >= 0 ? folderCol + 1 : null
                });
            }
        }

        return records;
    }

    function guessColumns(ws, range) {
        const candidateRows = Math.min(range.e.r, range.s.r + 15);
        let best = { nameCol: -1, birthCol: -1, headerRow: range.s.r - 1, score: 0 };

        for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 12); c++) {
            let nameScore = 0;
            let dateScoreRight = 0;

            for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 80); r++) {
                const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
                const text = String(v ?? '').trim();
                if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{5,}$/.test(text) && text.split(/\s+/).length >= 2) nameScore++;

                const right = ws[XLSX.utils.encode_cell({ r, c: c + 1 })]?.v;
                if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(String(right ?? '').trim()) || right instanceof Date) dateScoreRight++;
            }

            const score = nameScore + dateScoreRight * 1.5;
            if (score > best.score && nameScore >= 3) {
                best = { nameCol: c, birthCol: dateScoreRight >= 2 ? c + 1 : -1, headerRow: candidateRows < range.s.r ? range.s.r - 1 : range.s.r - 1, score };
            }
        }

        return best;
    }

    function extractHyperlink(cell) {
        if (!cell) return '';
        if (cell.l?.Target) return cell.l.Target;
        const f = String(cell.f || '');
        const m = f.match(/HYPERLINK\(\s*["']([^"']+)/i);
        if (m) return m[1];
        const value = String(cell.v || '');
        if (/^https?:\/\//i.test(value)) return value;
        return '';
    }

    async function searchStudentInLists(forceRefresh = false) {
        if (state.processing || state.searchBusy || state.syncingIndex) return;
        if (!validateBirthInput()) return;
        forceRefresh = forceRefresh === true;
        const searchId = state.searchSequence = (state.searchSequence || 0) + 1;
        const name = el.studentName.value.trim();
        const birth = parseDateFlexible(el.studentBirth.value.trim());
        const root = el.archiveRoot.value;
        const searchIsCurrent = () => searchId === state.searchSequence && name === el.studentName.value.trim() && root === el.archiveRoot.value && birth === parseDateFlexible(el.studentBirth.value.trim());

        state.selectedStudentMatch = null;
        state.lastSearchResults = [];
        state.lastSearchTerm = '';
        el.searchResults.innerHTML = '';
        updateUploadFolderControls();
        renderConsultStudentHero();

        if (name.length < 3) {
            renderStudentLocationStatus('Informe ao menos 3 caracteres do nome.', 'warn');
            el.studentName.focus();
            return;
        }

        const endpoint = GM_getValue(APP.driveEndpointKey, '').trim();
        const token = GM_getValue(APP.driveTokenKey, '').trim();

        if (!endpoint || !token) {
            renderStudentLocationStatus(
                'Google Drive ainda não configurado. Clique em “Configurar Drive” antes de pesquisar.',
                'warn'
            );
            return;
        }

        const normalizedName = normalizeText(name);
        const searchParts = normalizedName.split(/\s+/).filter(Boolean);
        const singleTermMode = searchParts.length === 1;

        state.lastSearchMode = singleTermMode ? 'contains' : 'similarity';
        state.lastSearchTerm = normalizedName;

        const oldButtonText = el.searchStudentBtn.textContent;
        state.searchBusy=true;refreshSearchControls();
        el.searchStudentBtn.disabled = true;
        el.searchStudentBtn.textContent = 'Pesquisando...';
        renderStudentLocationStatus(`Consultando ${root} no Google Drive...`, '');

        try {
            const response = await cachedStudentSearch({
                action: 'searchStudents',
                clientVersion: APP.version,
                root,
                query: name,
                birth: birth || '',
                maxResults: singleTermMode ? 150 : 100
            }, forceRefresh);
            if (!searchIsCurrent()) return;

            const data = parseDriveResponse(response);
            if (!data.ok) {
                throw new Error(data.error || data.message || 'Falha ao pesquisar a planilha.');
            }

            let results = (Array.isArray(data.results) ? data.results : []).map(record => ({
                root: record.root || root,
                sheet: String(record.sheet || ''),
                row: Number(record.row || 0),
                name: String(record.name || '').trim(),
                normalizedName: normalizeText(record.name || ''),
                birth: parseDateFlexible(record.birth || ''),
                folderUrl: String(record.folderUrl || ''),
                nameCol: Number(record.nameCol || 0) || null,
                birthCol: Number(record.birthCol || 0) || null,
                folderCol: Number(record.folderCol || 0) || null
            })).filter(record => record.name && record.row > 0);

            if (singleTermMode) {
                // Uma palavra: busca simples "contém", sem cálculo de similaridade.
                results = results
                    .filter(record => record.normalizedName.includes(normalizedName))
                    .map(record => ({
                        ...record,
                        matchMode: 'contains',
                        searchTerm: normalizedName,
                        exactName: normalizedName === record.normalizedName,
                        exactBirth: Boolean(birth && record.birth && birth === record.birth)
                    }))
                    .sort((a, b) => {
                        if (birth && a.exactBirth !== b.exactBirth) return a.exactBirth ? -1 : 1;

                        const aStarts = a.normalizedName.startsWith(normalizedName);
                        const bStarts = b.normalizedName.startsWith(normalizedName);
                        if (aStarts !== bStarts) return aStarts ? -1 : 1;

                        return a.name.localeCompare(b.name, 'pt-BR');
                    })
                    .slice(0, 150);
            } else {
                // Nome composto: o backend devolve candidatos encontrados online
                // e o navegador mantém a comparação aproximada que já usávamos.
                results = results.map(record => {
                    let score = similarity(normalizedName, record.normalizedName);
                    const exactName = normalizedName === record.normalizedName;
                    const exactBirth = Boolean(birth && record.birth && birth === record.birth);

                    if (exactName) score += 0.28;
                    if (exactBirth) score += 0.25;
                    if (birth && record.birth && !exactBirth) score -= 0.20;

                    return {
                        ...record,
                        score: Math.max(0, Math.min(1.5, score)),
                        exactName,
                        exactBirth,
                        matchMode: 'similarity',
                        searchTerm: normalizedName
                    };
                })
                .filter(record => record.score >= 0.55)
                .sort((a, b) => b.score - a.score)
                .slice(0, 100);
            }

            state.lastSearchResults = results;

            if (!results.length) {
                const detail = singleTermMode
                    ? `Nenhum nome contendo “${name}” foi encontrado online em ${root}.`
                    : `Nenhuma correspondência encontrada online em ${root}.`;

                renderStudentLocationStatus(detail, 'warn');
                return;
            }

            addLog(
                `${root}: ${results.length} resultado(s) ${response.fromCache ? 'do cache local' : 'do Google Sheets'}` +
                (data.elapsedMs ? ` em ${(data.elapsedMs / 1000).toFixed(1)} s.` : '.'),
                'success'
            );

            if (singleTermMode) {
                renderEmbeddedMatches(results);
                renderStudentLocationStatus(
                    `${results.length} registro(s) online contendo “${name}”. Selecione pela data de nascimento, caixa e linha.`,
                    'warn'
                );
                showMatchChooser(results);
                return;
            }

            const exact = results.find(record =>
                record.exactName && (!birth || record.exactBirth)
            );

            if (results.length === 1 && exact && (!birth || exact.exactBirth)) {
                selectStudentMatch(exact, true);
                renderEmbeddedMatches(results);
                return;
            }

            renderEmbeddedMatches(results);
            renderStudentLocationStatus(
                `${results.length} possível(is) correspondência(s) encontradas no Google Sheets. Confira e selecione a correta.`,
                'warn'
            );
            showMatchChooser(results);

        } catch (error) {
            if (!searchIsCurrent()) return;
            console.error(error);
            renderStudentLocationStatus(`Falha na pesquisa online: ${error.message}`, 'warn');
            addLog(`Pesquisa Google Sheets: ${error.message}`, 'error');
        } finally {
            if (searchId === state.searchSequence) {
                state.searchBusy=false;refreshSearchControls();
                el.searchStudentBtn.textContent = oldButtonText;
            }
        }
    }

    function selectStudentMatch(match, automatic) {
        if (state.processing) return;
        state.selectedStudentMatch = { ...match };
        invalidateBatch();
        scheduleDraft();
        el.archiveRoot.value = match.root;
        el.studentName.value = match.name;
        if (match.birth) el.studentBirth.value = match.birth;
        renderStudentLocationStatus();
        renderConsultStudentHero();
        updateUploadFolderControls();
        if (state.lastSearchResults.length) renderEmbeddedMatches(state.lastSearchResults);
        addLog(`${automatic ? 'Correspondência automática' : 'Aluno selecionado'}: ${match.name} — ${match.root}/${match.sheet}, linha ${match.row}.`, 'success');
    }

    function renderStudentLocationStatus(customMessage = '', type = '') {
        if (!el.listStatus) return;

        if (customMessage) {
            el.listStatus.className = `status-card status-${type || 'warn'}`;
            el.listStatus.innerHTML = escapeHtml(customMessage);
            return;
        }

        const match = state.selectedStudentMatch;
        if (match) {
            el.listStatus.className = 'status-card status-ok';
            el.listStatus.innerHTML = `
                <strong>✓ Aluno localizado</strong><br>
                Arquivo: <b>${escapeHtml(match.root)}</b><br>
                Caixa/Aba: <b>${escapeHtml(match.sheet)}</b><br>
                Linha: <b>${match.row}</b><br>
                ${match.folderUrl
                    ? `<a href="${escapeHtml(match.folderUrl)}" target="_blank" rel="noopener">📁 Abrir pasta digital existente</a>`
                    : '<span>📁 Ainda sem link de pasta digital detectado.</span>'}
            `;
            return;
        }

        const endpoint = GM_getValue(APP.driveEndpointKey, '').trim();
        const token = GM_getValue(APP.driveTokenKey, '').trim();

        if (endpoint && token) {
            el.listStatus.className = 'status-card status-ok';
            el.listStatus.innerHTML = `
                <strong>✓ Pesquisa online ativa</strong><br>
                Fonte: <b>Google Sheets</b><br>
                Arquivo atual: <b>${escapeHtml(el.archiveRoot?.value || 'PERMANENTE')}</b><br>
                <span class="tiny">Digite um nome ou parte dele e clique em Pesquisar.</span>
            `;
        } else {
            el.listStatus.className = 'status-card status-warn';
            el.listStatus.innerHTML = `
                <strong>Google Drive não configurado.</strong><br>
                Configure o endpoint para pesquisar diretamente nas planilhas online.
            `;
        }
    }

    /* =====================================================================
     * 7. PDF / MINIATURAS
     * ===================================================================== */

    async function loadSourcePdf(file) { return importSourceFiles([file]); }

    async function renderPageToDataUrl(pageNumber, rotation = 0, scale = APP.thumbnailScale) {
        const page = await state.pdfjsDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.82);
    }

    function makeDocumentOptions(selected = 'ignore') {
        const groups = [
            ['system', 'AÇÃO'],
            ['ged', 'SIGEDUCA / GED'],
            ['archive', 'ARQUIVO DIGITAL']
        ];

        return groups.map(([groupKey, label]) => {
            const options = Object.entries(DOCUMENT_TYPES)
                .filter(([, meta]) => meta.group === groupKey)
                .map(([key, meta]) => `<option value="${key}" title="${escapeHtml(meta.label)}" ${key === selected ? 'selected' : ''}>${escapeHtml(meta.short)}</option>`)
                .join('');
            return options ? `<optgroup label="${label}">${options}</optgroup>` : '';
        }).join('');
    }

    function appendPageCard(model) {
        const card = document.createElement('article');
        card.className = 'page-card';
        card.draggable = true;
        card.dataset.pageId = model.id;
        card.innerHTML = `
            <div class="page-head">
                <label><input type="checkbox" class="page-check" aria-label="Selecionar página ${model.originalPage}"> <strong>Posição</strong></label>
                <span title="${escapeHtml(model.sourceName || '')}">Original ${model.originalPage}</span>
            </div>
            <div class="thumb-wrap"><img class="thumb" src="${model.thumbnailDataUrl}" alt="Página ${model.originalPage}"></div>
            <select class="page-select">${makeDocumentOptions(model.docKey)}</select>
            <div class="ai-line">🤖 Sem análise automática</div>
            <div class="page-actions">
                <button data-action="preview">Ampliar</button>
                <button data-action="rotate">Girar</button>
                <button data-action="ignore">Ignorar</button>
            </div>
        `;

        const select = card.querySelector('.page-select');
        select.addEventListener('change', () => {
            if (state.processing) return;
            rememberEdit();
            model.manual = true;
            model.reviewed = true;
            model.docKey = select.value;
            scheduleDraft();
            state.generatedDocuments = [];
            renderGeneratedSummary();
            updateSummary();
            atualizarBotoes();
        });

        card.addEventListener('click', async event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action || state.processing) return;
            if (action === 'preview') await previewPage(model);
            if (action === 'rotate') await rotatePage(model, card);
            if (action === 'ignore') {
                rememberEdit();
                model.manual = true;
                model.reviewed = true;
                invalidateBatch();
                model.docKey = 'ignore';
                scheduleDraft();
                select.value = 'ignore';
                updateSummary();
                atualizarBotoes();
            }
        });

        card.addEventListener('dragstart', event => {
            if (state.processing) { event.preventDefault(); return; }
            state.draggedPageId = model.id;
            card.style.opacity = '.45';
        });
        card.addEventListener('dragend', () => {
            state.draggedPageId = null;
            card.style.opacity = '';
            el.pages.querySelectorAll('.page-card').forEach(n => n.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', event => {
            event.preventDefault();
            card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', event => {
            event.preventDefault();
            card.classList.remove('drag-over');
            reorderPages(state.draggedPageId, model.id);
        });

        el.pages.appendChild(card);
        renderAiSuggestion(model);
    }

    function updatePageLabels() {
        state.pageModels.forEach((model, index) => {
            const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
            if (card) card.querySelector('.page-head strong').textContent = `Posição ${index + 1}`;
        });
    }

    function reorderPages(sourceId, targetId) {
        if (state.processing || !sourceId || sourceId === targetId) return;
        const from = state.pageModels.findIndex(p => p.id === sourceId);
        const to = state.pageModels.findIndex(p => p.id === targetId);
        if (from < 0 || to < 0) return;
        rememberEdit();
        const [moved] = state.pageModels.splice(from, 1);
        scheduleDraft();
        state.pageModels.splice(to, 0, moved);

        const card = el.pages.querySelector(`[data-page-id="${CSS.escape(sourceId)}"]`);
        const target = el.pages.querySelector(`[data-page-id="${CSS.escape(targetId)}"]`);
        if (from < to) target.after(card); else target.before(card);

        state.generatedDocuments = [];
        updatePageLabels();
        updateSummary();
        renderGeneratedSummary();
        atualizarBotoes();
    }

    async function rotatePage(model, card) {
        if (state.processing) return;
        rememberEdit();
        setBusy(true);
        try {
            model.rotation = (model.rotation + 90) % 360;
            model.thumbnailDataUrl = await renderPageToDataUrl(model.originalPage, model.rotation, APP.thumbnailScale);
            card.querySelector('img').src = model.thumbnailDataUrl;
            state.generatedDocuments = [];
            renderGeneratedSummary();
            atualizarBotoes();
        } catch (error) {
            showError(error, 'Erro ao girar página');
        } finally { setBusy(false); scheduleDraft(); }
    }

    async function previewPage(model) {
        try {
            el.modal.style.display = 'flex';
            el.modalTitle.textContent = `Página original ${model.originalPage}`;
            const page = await state.pdfjsDocument.getPage(model.originalPage);
            const viewport = page.getViewport({ scale: 1.35, rotation: model.rotation });
            el.previewCanvas.width = Math.ceil(viewport.width);
            el.previewCanvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: el.previewCanvas.getContext('2d'), viewport }).promise;
        } catch (error) {
            showError(error, 'Erro na visualização');
        }
    }

    function updateSummary() {
        applyPageFilter();
        if (!state.pageModels.length) {
            el.summary.textContent = 'Nenhuma página carregada.';
            return;
        }
        const counts = new Map();
        for (const page of state.pageModels) counts.set(page.docKey, (counts.get(page.docKey) || 0) + 1);
        el.summary.innerHTML = [...counts.entries()].map(([key, count]) => `
            <div class="summary-row"><span>${escapeHtml(DOCUMENT_TYPES[key]?.short || key)}</span><strong>${count} pág.</strong></div>
        `).join('');
    }

    /* =====================================================================
     * 8. IDENTIFICAÇÃO AUTOMÁTICA POR TEXTO EXISTENTE NO PDF
     * ===================================================================== */

    function setOcrStatus(message, kind = '') {
        state.ocrStatus = message;
        if (!el.ocrStatus) return;
        el.ocrStatus.textContent = message;
        el.ocrStatus.style.background =
            kind === 'ok' ? '#edf8f0' :
            kind === 'error' ? '#fff0ef' :
            kind === 'loading' ? '#eef4ff' : '#f3f6fa';
        el.ocrStatus.style.color =
            kind === 'ok' ? '#17643b' :
            kind === 'error' ? '#9c2e27' :
            kind === 'loading' ? '#31557f' : '#59657a';
    }

    async function getOcrWorker() {
        if (state.ocrWorker) return state.ocrWorker;
        if (state.ocrWorkerPromise) return state.ocrWorkerPromise;

        state.ocrWorkerPromise = (async () => {
            if (!window.Tesseract?.createWorker) {
                throw new Error('A biblioteca Tesseract.js não foi carregada.');
            }

            setOcrStatus('Carregando OCR em português pela primeira vez...', 'loading');

            const worker = await window.Tesseract.createWorker(
                'por',
                window.Tesseract.OEM?.LSTM_ONLY ?? 1,
                {
                    logger: message => {
                        if (message?.status === 'recognizing text' && Number.isFinite(message.progress)) {
                            const pct = Math.round(message.progress * 100);
                            setOcrStatus(`OCR reconhecendo texto... ${pct}%`, 'loading');
                        } else if (message?.status) {
                            setOcrStatus(`OCR: ${message.status}`, 'loading');
                        }
                    }
                }
            );

            state.ocrWorker = worker;
            setOcrStatus('OCR em português carregado e pronto.', 'ok');
            return worker;
        })();

        try {
            return await state.ocrWorkerPromise;
        } catch (error) {
            state.ocrWorkerPromise = null;
            state.ocrWorker = null;
            setOcrStatus(`Falha no OCR: ${error.message}`, 'error');
            throw error;
        }
    }

    async function renderPageForOcr(model) {
        const page = await state.pdfjsDocument.getPage(model.originalPage);
        const viewport = page.getViewport({
            scale: 2.0,
            rotation: model.rotation || 0
        });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));

        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
            canvasContext: ctx,
            viewport
        }).promise;

        return canvas;
    }

    async function readPageTextWithOcr(model) {
        const page = await state.pdfjsDocument.getPage(model.originalPage);
        const content = await page.getTextContent();
        let text = content.items.map(item => item.str).join(' ').trim();

        model.ocrUsed = false;

        if (normalizeLoose(text).replace(/[^a-z]/g, '').length >= 40) {
            return text;
        }

        const worker = await getOcrWorker();
        const canvas = await renderPageForOcr(model);

        setOcrStatus(`Executando OCR na página ${model.originalPage}...`, 'loading');
        const result = await worker.recognize(canvas);
        canvas.width = canvas.height = 0;
        text = String(result?.data?.text || '').trim();
        model.ocrUsed = true;

        setOcrStatus('OCR em português carregado e pronto.', 'ok');
        return text;
    }

    async function autoDetectAllPages() {
        if (!state.pdfjsDocument || state.processing) return;
        setBusy(true);
        state.cancelled = false;

        let nativeTextCount = 0;
        let ocrCount = 0;

        try {
            for (let i = 0; i < state.pageModels.length; i++) {
                if (state.cancelled) throw new Error('Análise cancelada.');

                const model = state.pageModels[i];
                updateProgress(
                    50 + ((i + 1) / state.pageModels.length) * 20,
                    `Identificando página ${i + 1}/${state.pageModels.length}`
                );

                const text = await readPageTextWithOcr(model);
                model.extractedText = text;
                model.aiSuggestion = classifyText(text);
                scheduleDraft();

                if (model.ocrUsed) ocrCount++;
                else nativeTextCount++;

                renderAiSuggestion(model);
                await sleep(0);
            }

            addLog(
                `Identificação concluída: ${nativeTextCount} página(s) com texto nativo e ${ocrCount} página(s) processada(s) por OCR.`,
                'success'
            );
            updateProgress(70, 'Sugestões geradas. Revise antes de aceitar.');
        } catch (error) {
            addLog(error.message, 'error');
            setOcrStatus(`OCR: ${error.message}`, 'error');
        } finally {
            setBusy(false);
            atualizarBotoes();
        }
    }

    function classifyText(text) {
        const normalized = normalizeLoose(text);
        if (normalized.length < 20) return { key: 'arquivo_diversos', confidence: 0, hits: [] };

        const candidates = [];
        for (const [key, meta] of Object.entries(DOCUMENT_TYPES)) {
            if (key === 'ignore' || key === 'arquivo_diversos') continue;
            let points = 0;
            const hits = [];

            for (const k of new Set((meta.keywords || []).map(normalizeLoose))) {
                const keyword = k;
                if (!k) continue;
                if ((` ${normalized.replace(/[^a-z0-9]+/g, ' ')} `).includes(` ${k} `)) {
                    const weight = k.split(/\s+/).length >= 2 ? 18 : 7;
                    points += weight;
                    hits.push(keyword);
                }
            }

            // Regras reforçadas para documentos comuns.
            if (key === 'arquivo_ficha_individual') {
                if (normalized.includes('ficha individual')) points += 55;
                if (normalized.includes('resultado final')) points += 12;
                if (normalized.includes('componentes curriculares')) points += 12;
            }
            if (key === 'ged_historico') {
                if (normalized.includes('historico escolar')) points += 60;
                if (normalized.includes('estudos realizados')) points += 14;
                if (normalized.includes('carga horaria')) points += 10;
            }
            if (key === 'arquivo_atestado_medico') {
                if (normalized.includes('atestado medico')) points += 60;
                if (/\bcrm\b/.test(normalized)) points += 18;
            }
            if (key === 'arquivo_ficha_matricula') {
                if (normalized.includes('ficha de matricula')) points += 60;
                if (normalized.includes('dados do aluno')) points += 12;
            }
            if (key === 'arquivo_cartao_sus') {
                if (normalized.includes('cartao nacional de saude')) points += 65;
                if (/\bcns\b/.test(normalized)) points += 15;
            }
            if (key === 'arquivo_certificado') {
                if (/\b(diploma|certificado)\b/.test(normalized)) points += 45;
                if (/\b(concluiu|conclusao)\b/.test(normalized)) points += 15;
            }

            if (points > 0) candidates.push({ key, points, hits });
        }

        candidates.sort((a, b) => b.points - a.points);
        const best = candidates[0];
        if (!best) return { key: 'arquivo_diversos', confidence: 0.20, hits: [] };

        const second = candidates[1]?.points || 0;
        const margin = best.points - second;
        let confidence = Math.min(0.99, 0.35 + best.points / 120 + margin / 180);
        if (best.points < 18) confidence = Math.min(confidence, 0.55);
        if (margin < 15) confidence = Math.min(confidence, 0.70);

        return { key: best.key, confidence, hits: best.hits.slice(0, 5), points: best.points };
    }

    function renderAiSuggestion(model) {
        const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
        if (!card) return;
        const line = card.querySelector('.ai-line');
        const suggestion = model.aiSuggestion;
        if (model.manual) {
            line.className = 'ai-line';
            line.textContent = 'Classificação manual';
            return;
        }
        if (!suggestion) {
            line.className = 'ai-line';
            line.textContent = '';
            return;
        }

        const meta = DOCUMENT_TYPES[suggestion.key] || DOCUMENT_TYPES.arquivo_diversos;
        if(suggestion.engine){
            line.className='ai-line '+(suggestion.autoApply?'ai-high':'ai-mid');
            line.textContent=`${meta.short} · ${suggestion.reason}`;
            line.title=suggestion.engine==='local-ai'?'Análise semântica executada neste computador; os escores não são probabilidades.':'Somente palavras-chave: a IA não foi executada nesta página.';
            return;
        }
        const pct = Math.round((suggestion.confidence || 0) * 100);
        line.className = `ai-line ${pct >= 85 ? 'ai-high' : pct >= 60 ? 'ai-mid' : ''}`;
        line.textContent = model.extractedText.trim().length < 20
            ? `${model.ocrUsed ? '🔎 OCR' : '🤖 Texto'}: pouco texto reconhecido`
            : `${model.ocrUsed ? '🔎 OCR' : '🤖 Texto'}: ${meta.short} — ${pct}%${suggestion.hits?.length ? ` • ${suggestion.hits.slice(0, 2).join(', ')}` : ''}`;
    }

    function acceptAiSuggestions() {
        if (state.processing) return;
        rememberEdit();
        let accepted = 0;
        for (const model of state.pageModels) {
            if (model.manual || !model.aiSuggestion || model.aiSuggestion.confidence < 0.85) continue;
            model.docKey = model.aiSuggestion.key;
            const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
            if (card) card.querySelector('.page-select').value = model.docKey;
            accepted++;
        }
        state.generatedDocuments = [];
        renderGeneratedSummary();
        updateSummary();
        atualizarBotoes();
        scheduleDraft();
        addLog(`${accepted} sugestão(ões) aplicada(s); escolhas manuais preservadas.`, 'success');
    }

    /* =====================================================================
     * 9. GERAÇÃO DOS PDFs AGRUPADOS
     * ===================================================================== */

    async function generateGroupedDocuments() {
        if (!state.sourceBytes || !state.pageModels.length) {
            throw new Error('Carregue um PDF antes de salvar.');
        }

        const selected = state.pageModels.filter(p => p.docKey !== 'ignore');
        if (!selected.length) throw new Error('Classifique ao menos uma página.');
        if (!window.PDFLib?.PDFDocument) throw new Error('pdf-lib não carregado.');

        state.generatedDocuments = [];
        renderGeneratedSummary();

        const grouped = new Map();
        for (const page of selected) {
            if (!grouped.has(page.docKey)) grouped.set(page.docKey, []);
            grouped.get(page.docKey).push(page);
        }

        const sourcePdf = await PDFLib.PDFDocument.load(state.sourceBytes.slice(), { ignoreEncryption: false });
        let groupIndex = 0;
        const student = getStudentMeta();

        for (const [docKey, pages] of grouped.entries()) {
            if (state.cancelled) throw new Error('Preparação cancelada.');
            groupIndex++;
            const meta = DOCUMENT_TYPES[docKey];
            updateProgress(68 + (groupIndex / grouped.size) * 17, `Gerando ${meta.short}...`);

            const output = await PDFLib.PDFDocument.create();
            const copiedPages = await output.copyPages(sourcePdf, pages.map(p => p.originalPage - 1));
            copiedPages.forEach((copiedPage, index) => {
                const rotation = pages[index].rotation || 0;
                copiedPage.setRotation(PDFLib.degrees(rotation));
                output.addPage(copiedPage);
            });

            output.setTitle(meta.label);
            output.setSubject(`Arquivo Digital — ${student.name || student.code || 'Aluno'}`);
            output.setCreator(`SIGEDUCA Arquivo Digital v${APP.version}`);
            output.setProducer('pdf-lib');

            const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
            const identity = student.name || student.code || 'ALUNO';
            const filename = `${safeFilename(identity)} - ${safeFilename(meta.short)}.pdf`;
            const file = new File([bytes], filename, { type: 'application/pdf', lastModified: Date.now() });

            state.generatedDocuments.push({
                docKey,
                docName: meta.label,
                shortName: meta.short,
                gedId: meta.gedId,
                pages: pages.map(p => p.originalPage),
                file,
                status: 'pronto',
                statusGed: '',
                statusLocal: '',
                statusDrive: '',
                message: ''
            });

            addLog(`${meta.short}: ${pages.length} pág., ${humanSize(file.size)}.`, 'success');
        }

        renderGeneratedSummary();
        const oversized = state.generatedDocuments.filter(d => d.gedId && d.file.size > APP.maxGeneratedFileSize);
        if (oversized.length) addLog(`${oversized.length} arquivo(s) do GED ultrapassam 5 MB.`, 'warning');

        updateProgress(85, `${state.generatedDocuments.length} documento(s) preparado(s) internamente.`);
        return state.generatedDocuments;
    }

    function renderGeneratedSummary() {
        if (el.resultsPanel) el.resultsPanel.hidden = !state.generatedDocuments.length;
        if (!state.generatedDocuments.length) {
            el.generated.textContent = 'Os PDFs serão gerados automaticamente ao salvar.';
            return;
        }

        el.generated.innerHTML = state.generatedDocuments.map(doc => {
            const badges = [
                doc.gedId ? `<span class="pill">GED ${doc.gedId}</span>` : '<span class="pill">Arquivo</span>',
                doc.statusGed ? `<span>${escapeHtml(doc.statusGed)}</span>` : '',
                doc.statusLocal ? `<span>${escapeHtml(doc.statusLocal)}</span>` : '',
                doc.statusDrive ? `<span>${escapeHtml(doc.statusDrive)}</span>` : ''
            ].filter(Boolean).join(' ');
            return `
                <div class="summary-row">
                    <span title="${escapeHtml(doc.docName)}">${escapeHtml(doc.shortName)}<br><small>${doc.pages.length} pág. • ${humanSize(doc.file.size)}</small></span>
                    <strong>${badges}</strong>
                    ${doc.message ? `<small>${escapeHtml(doc.message)}</small>` : ''}
                </div>
            `;
        }).join('');
    }

    /* =====================================================================
     * 10. DESTINOS
     * ===================================================================== */

    async function executeDestinations(retry = false) {
        if (state.processing) return;
        if (!validateBirthInput()) return;
        const useGed = el.destGed.checked, useLocal = el.destLocal.checked, useDrive = el.destDrive.checked;
        if (!useGed && !useLocal && !useDrive) return alert('Selecione pelo menos um destino.');
        const selectedPages = state.pageModels.filter(p => p.docKey !== 'ignore');
        if (!state.sourceBytes || !selectedPages.length) return alert('Adicione arquivos e classifique ao menos uma página.');
        let student = getStudentMeta();
        if (!student.name && !student.code) return alert('Informe o nome ou código do aluno.');
        if (useGed && selectedPages.some(p => Number.isInteger(DOCUMENT_TYPES[p.docKey]?.gedId)) && !/^\d+$/.test(student.code)) return alert('Informe um código SIGEDUCA numérico para enviar ao GED.');
        if (useDrive && (!GM_getValue(APP.driveEndpointKey, '') || !GM_getValue(APP.driveTokenKey, ''))) return alert('Configure o Google Drive antes de enviar.');
        let signature = currentBatchSignature();
        if (retry && signature !== state.batchSignature) return alert('O aluno ou as páginas mudaram. Use Revisar e salvar para preparar um novo envio.');
        setBusy(true);
        state.cancelled = false;
        try {
            if (useDrive && state.selectedStudentMatch) {
                await refreshSelectedStudent();
                student = getStudentMeta();
                signature = currentBatchSignature();
                // Updating the physical row/folder does not invalidate confirmed document deliveries.
                if (state.generatedDocuments.length) state.batchSignature = signature;
            }
            if (!state.generatedDocuments.length || state.batchSignature !== signature) {
                await generateGroupedDocuments();
                state.batchSignature = signature;
            }
            if (useGed) {
                for (const doc of state.generatedDocuments.filter(d => Number.isInteger(d.gedId) && d.file.size > APP.maxGeneratedFileSize && !isDestinationDone(d.statusGed))) {
                    if (!await offerCompression(doc)) {
                        updateProgress(85, 'Envio não iniciado. Revise os documentos grandes.');
                        return;
                    }
                }
            }
            if (state.cancelled || !await reviewBeforeSave({ useGed, useLocal, useDrive, student })) return;
            if (state.cancelled) return;
            if (useLocal && state.generatedDocuments.some(d => !isDestinationDone(d.statusLocal))) {
                try { await saveLocalSinglePdf(); }
                catch (error) { for (const doc of state.generatedDocuments) { doc.statusLocal = '✗ Download'; doc.message = error.message; } }
            }
            if (useGed && !state.cancelled) await startGedUpload();
            if (useDrive && !state.cancelled) {
                try { await saveToDriveEndpoint(); }
                catch (error) {
                    for (const doc of state.generatedDocuments.filter(d => !isDestinationDone(d.statusDrive))) {
                        doc.statusDrive ||= '✗ Drive'; doc.message = error.message;
                    }
                    addLog(error.message, 'error');
                }
            }
            const result = summarizeDestinations(state.generatedDocuments, { useGed, useLocal, useDrive });
            const message = `${result.sent} envio(s) confirmado(s), ${result.downloads} download(s) solicitado(s), ${result.existing} já cadastrado(s), ${result.failed} erro(s), ${result.pending} pendente(s).`;
            updateProgress(state.cancelled ? 95 : 100, message);
            addLog(message, result.failed || result.pending ? 'warning' : 'success');
            el.resultStatus.textContent = message;
        } catch (error) { showError(error, 'Processamento interrompido'); }
        finally { setBusy(false); renderGeneratedSummary(); atualizarBotoes(); scheduleDraft(); }
    }


    async function saveLocalSinglePdf() {
        if (!window.PDFLib?.PDFDocument) throw new Error('pdf-lib não carregado.');
        if (!state.sourceBytes) throw new Error('PDF original não carregado.');

        const selectedPages = state.pageModels.filter(p => p.docKey !== 'ignore');
        if (!selectedPages.length) throw new Error('Nenhuma página selecionada para o PDF local.');

        const sourcePdf = await PDFLib.PDFDocument.load(state.sourceBytes.slice(), { ignoreEncryption: false });
        const output = await PDFLib.PDFDocument.create();
        const copiedPages = await output.copyPages(sourcePdf, selectedPages.map(p => p.originalPage - 1));

        // Usa exatamente a ordem atual da interface e respeita as rotações feitas pelo usuário.
        copiedPages.forEach((copiedPage, index) => {
            const rotation = selectedPages[index].rotation || 0;
            copiedPage.setRotation(PDFLib.degrees(rotation));
            output.addPage(copiedPage);
        });

        const student = getStudentMeta();
        const identity = student.name || student.code || 'ALUNO';
        const birthSuffix = student.birth ? ` - ${dateForFilename(student.birth)}` : '';
        const filename = `${safeFilename(student.root)} - ${safeFilename(identity)}${birthSuffix} - Arquivo Digital.pdf`;

        output.setTitle(`Arquivo Digital - ${identity}`);
        output.setSubject(`${student.root}${student.birth ? ` • Nascimento: ${student.birth}` : ''}`);
        output.setCreator(`SIGEDUCA Arquivo Digital v${APP.version}`);
        output.setProducer('pdf-lib');

        const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        downloadBlob(blob, filename);

        for (const doc of state.generatedDocuments) doc.statusLocal = '✓ Download solicitado';
        addLog(`Download do PDF único solicitado: ${filename} (${selectedPages.length} pág., ${humanSize(blob.size)}).`, 'success');
        renderGeneratedSummary();
    }

    /* =====================================================================
     * 11. UPLOAD DO GED — REAPROVEITADO DO MÓDULO ORIGINAL
     * ===================================================================== */

    async function startGedUpload() {
        const student = getStudentMeta();
        const docs = state.generatedDocuments.filter(d => Number.isInteger(d.gedId) && !isDestinationDone(d.statusGed));
        if (!docs.length) {
            addLog('Nenhum dos documentos preparados possui tipo compatível com o GED.', 'warning');
            return;
        }

        for (let index = 0; index < docs.length; index++) {
            if (state.cancelled) throw new Error('Processamento cancelado.');
            const doc = docs[index];
            updateProgress(90 + (index / docs.length) * 5, `GED: ${doc.shortName} (${index + 1}/${docs.length})`);

            try {
                const iframe = await openStudentPage(student.code);
                const result = await uploadDocumentToGed(iframe, doc);
                doc.statusGed = result === 'existing' ? '↷ Já cadastrado no GED' : '✓ GED';
                doc.message = '';
            } catch (error) {
                doc.statusGed = state.cancelled ? 'Pendente — cancelado' : '✗ GED';
                doc.message = error.message;
                addLog(`${doc.shortName} / GED: ${error.message}`, 'error');
            }

            renderGeneratedSummary();
            scheduleDraft();
            await sleep(APP.betweenUploadsMs);
        }
    }

    function openStudentPage(studentCode) {
        return new Promise((resolve, reject) => {
            state.iframe?.remove();
            const iframe = document.createElement('iframe');
            iframe.id = `${APP.id}-ged-frame`;
            iframe.style.cssText = 'position:fixed;width:2px;height:2px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
            document.body.appendChild(iframe);
            state.iframe = iframe;

            const base = `${location.protocol}//${location.host}`;
            const url = `${base}/ged/hwtmgedaluno2.aspx?${encodeURIComponent(studentCode)},,HWMConAluno,UPD,1,0,1`;
            let settled = false;

            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Tempo excedido ao abrir a página do aluno.'));
                }
            }, 45_000);

            iframe.onload = () => {
                if (settled) return;
                try {
                    const doc = iframe.contentDocument;
                    if (!doc) throw new Error('Não foi possível acessar o GED.');
                    settled = true;
                    clearTimeout(timeout);
                    resolve(iframe);
                } catch (error) {
                    settled = true;
                    clearTimeout(timeout);
                    reject(new Error(`Iframe do GED bloqueado: ${error.message}`));
                }
            };
            iframe.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                reject(new Error('Falha ao carregar a página do aluno.'));
            };
            iframe.src = url;
        });
    }

    function getGedDocument(iframe) {
        try { return iframe?.isConnected ? iframe.contentDocument : null; }
        catch { return null; }
    }

    async function waitForUploadForm(iframe, requireEnabledButton = false) {
        const started = Date.now();
        while (Date.now() - started < APP.responseTimeoutMs) {
            if (state.cancelled) throw new Error('Cancelado pelo usuário.');
            const doc = getGedDocument(iframe);
            const select = doc?.getElementById('vGEDDOCOBRIGID');
            const fileInput = doc?.querySelector('input[type="file"]');
            const addButton = doc?.querySelector('input[name="BTNINCLUIRARQUIVO"], #BTNINCLUIRARQUIVO, button[name="BTNINCLUIRARQUIVO"]');
            const buttonReady = addButton && (!requireEnabledButton || (
                !addButton.disabled && addButton.getAttribute('aria-disabled') !== 'true'
            ));
            if (doc?.readyState !== 'loading' && select && fileInput && buttonReady) return doc;
            await sleep(APP.uploadPollMs);
        }
        throw new Error('Tempo excedido aguardando o formulário do GED.');
    }

    function findText(root, selectors) {
        for (const selector of selectors) {
            const node = root.querySelector(selector);
            const text = node?.textContent?.trim();
            if (text) return text;
        }
        return '';
    }

    function readServerFeedback(doc) {
        return {
            error: findText(doc, ['.erro', '.Error', '[class*="erro"]', '[id*="ERRO"]']),
            notice: findText(doc, ['.aviso', '.sucesso', '.Success', '[class*="aviso"]', '[id*="AVISO"]'])
        };
    }

    function findExistingDocument(doc, docId) {
        const spans = doc.querySelectorAll('[id^="span_vGRID_GEDDOCOBRIGID_"]');
        for (const span of spans) {
            if (span.textContent.trim() !== String(docId)) continue;
            const row = span.closest('tr');
            const filename = row?.querySelector('[id^="span_vGRID_GEDDOCOBRIGARQUIVONOME_"]')?.textContent?.trim() || '';
            return { exists: true, filename };
        }
        return { exists: false, filename: '' };
    }

    async function uploadDocumentToGed(iframe, generated) {
        let doc = await waitForUploadForm(iframe);
        const existing = findExistingDocument(doc, generated.gedId);
        if (existing.exists) {
            addLog(`${generated.shortName}: já cadastrado no GED; preservado.`, 'info');
            return 'existing';
        }

        if (generated.file.size > APP.maxGeneratedFileSize) {
            throw new Error(`${generated.shortName}: acima de 5 MB. Reduza o PDF antes do envio.`);
        }

        const select = doc.getElementById('vGEDDOCOBRIGID');
        if (!select) throw new Error('Seletor do tipo de documento não encontrado no GED.');
        select.value = String(generated.gedId);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);

        doc = await waitForUploadForm(iframe);
        const fileInput = doc.querySelector('input[type="file"]');
        if (!fileInput) throw new Error('Campo de arquivo não encontrado no GED.');

        const transfer = new DataTransfer();
        transfer.items.add(generated.file);
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        await waitForPreUpload(iframe);

        doc = await waitForUploadForm(iframe, true);
        const addButton = doc.querySelector('input[name="BTNINCLUIRARQUIVO"], #BTNINCLUIRARQUIVO, button[name="BTNINCLUIRARQUIVO"]');
        if (!addButton) throw new Error('Botão de inclusão não encontrado.');
        const feedbackBeforeSubmit = readServerFeedback(doc);
        addButton.click();

        const response = await waitForServerResponse(iframe, generated.gedId, feedbackBeforeSubmit);
        if (response.type === 'error') throw new Error(response.message);
        addLog(`${generated.shortName}: ${response.message}`, 'success');
    }

    async function waitForPreUpload(iframe) {
        const started = Date.now();
        while (Date.now() - started < APP.uploadTimeoutMs) {
            if (state.cancelled) throw new Error('Cancelado pelo usuário.');
            const doc = getGedDocument(iframe);
            if (!doc || doc.readyState === 'loading') {
                await sleep(APP.uploadPollMs);
                continue;
            }

            const text = findText(doc, ['#span_vTEXTOADICIONAR', '[id*="TEXTOADICIONAR"]', '.erro', '.aviso', '.Error', '.Warning']);
            if (text) {
                const normalized = text.toLowerCase();
                if (/erro|falha|inválid|exced|não permitido|nao permitido/.test(normalized)) throw new Error(text);
                if (/sucesso|carregado|adicionado|pronto|arquivo selecionado/.test(normalized)) return text;
            }
            if (Date.now() - started > 2500) return text || '';
            await sleep(APP.uploadPollMs);
        }
        return '';
    }

    async function waitForServerResponse(iframe, docId, feedbackBeforeSubmit) {
        const started = Date.now();
        while (Date.now() - started < APP.responseTimeoutMs) {
            if (state.cancelled) throw new Error('Cancelado pelo usuário.');
            const doc = getGedDocument(iframe);
            if (!doc || doc.readyState === 'loading') {
                await sleep(APP.uploadPollMs);
                continue;
            }

            const existing = findExistingDocument(doc, docId);
            if (existing.exists) {
                return { type: 'success', message: `Documento incluído${existing.filename ? ` como “${existing.filename}”` : ''}.` };
            }

            const feedback = readServerFeedback(doc);
            if (feedback.error && feedback.error !== feedbackBeforeSubmit.error) return { type: 'error', message: feedback.error };
            if (feedback.notice && feedback.notice !== feedbackBeforeSubmit.notice) {
                const normalized = feedback.notice.toLowerCase();
                if (/erro|falha|inválid|impossível|impossivel|atenção|atencao/.test(normalized)) return { type: 'error', message: feedback.notice };
                if (/sucesso|incluíd|incluid|realizado|cadastrado|adicionado/.test(normalized)) return { type: 'success', message: feedback.notice };
            }

            await sleep(APP.uploadPollMs);
        }
        throw new Error('Tempo excedido aguardando confirmação do GED.');
    }

    /* =====================================================================
     * 12. GOOGLE DRIVE — CONTRATO DO ENDPOINT PARA A PRÓXIMA ETAPA
     * ===================================================================== */

    function configureDriveEndpoint() {
        const currentEndpoint = GM_getValue(APP.driveEndpointKey, '');
        const endpoint = prompt(
            'Cole a URL /exec do Web App do Arquivo Digital.\n\nDeixe vazio para desativar.',
            currentEndpoint
        );
        if (endpoint === null) return;

        if (!endpoint.trim()) {
            GM_setValue(APP.driveEndpointKey, '');
            GM_setValue(APP.driveTokenKey, '');
            atualizarDriveStatus();
            return;
        }

        let validatedEndpoint;
        try{validatedEndpoint=normalizeDriveEndpoint(endpoint);}catch(error){alert(error.message);return;}

        const currentToken = GM_getValue(APP.driveTokenKey, '');
        const token = prompt(
            'Cole a CHAVE DE ACESSO (API_TOKEN) definida no Google Apps Script.\n\nEla funciona como senha do Arquivo Digital.',
            currentToken
        );
        if (token === null) return;

        GM_setValue(APP.driveEndpointKey, validatedEndpoint);
        GM_setValue(APP.driveTokenKey, token.trim());
        atualizarDriveStatus();

        testDriveConnection().catch(error => {
            alert(`Configuração salva, mas o teste falhou:\n${error.message}`);
        });
    }

    function atualizarDriveStatus() {
        if (!el.driveStatus) return;

        const endpoint = GM_getValue(APP.driveEndpointKey, '').trim();
        const token = GM_getValue(APP.driveTokenKey, '').trim();

        if (!endpoint || !token) {
            el.driveStatus.className = 'status-card status-warn';
            el.driveStatus.textContent = 'Drive ainda não configurado.';
            return;
        }

        el.driveStatus.className = 'status-card status-ok';
        el.driveStatus.innerHTML = `✓ Endpoint e chave configurados<br><span class="tiny">${escapeHtml(endpoint)}</span>`;
    }

    async function testDriveConnection() {
        const response = await drivePostJson({ action: 'ping' });
        const data = parseDriveResponse(response);
        if (!data.ok) throw new Error(data.error || 'O serviço respondeu com erro.');
        state.indexSupported=Boolean(data.capabilities?.includes('studentIndex'));
        addLog(`Drive conectado: ${data.message || 'serviço disponível.'}`, 'success');
        if (el.driveStatus) {
            el.driveStatus.className = 'status-card status-ok';
            el.driveStatus.innerHTML = `✓ Google Drive conectado<br><span class="tiny">${escapeHtml(data.message || 'Backend ativo')}</span>`;
        }
        return data;
    }

    function parseDriveResponse(response) {
        try {
            return JSON.parse(response.responseText || '{}');
        } catch {
            throw new Error('O Google retornou uma página em vez dos dados. Confira a URL /exec em Configurar Drive e a implantação do serviço.');
        }
    }

    async function fileToBase64(file) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < buffer.length; i += chunk) {
            binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function studentPayload(student) {
        return {
            root: student.root,
            code: student.code,
            name: student.name,
            birth: student.birth,
            physicalSheet: student.sheet,
            physicalRow: student.row,
            nameCol: student.nameCol || '',
            birthCol: student.birthCol || '',
            folderCol: student.folderCol || '',
            existingFolderUrl: student.existingFolderUrl || ''
        };
    }

    async function saveToDriveEndpoint() {
        const student = getStudentMeta();

        updateProgress(96, 'Localizando/criando pasta digital...');
        const ensureResponse = await drivePostJson({
            action: 'ensureStudentFolder',
            clientVersion: APP.version,
            student: studentPayload(student),
            source: {
                workbook: state.workbookNames[student.root] || '',
                originalPdf: state.sourceFile?.name || ''
            }
        });

        const ensureData = parseDriveResponse(ensureResponse);
        if (!ensureData.ok) {
            throw new Error(ensureData.error || ensureData.message || 'Não foi possível preparar a pasta digital.');
        }

        clearSearchCache().catch(console.warn);
        const folderId = ensureData.folderId;
        const folderUrl = ensureData.folderUrl;

        if (!folderId) throw new Error('O backend não retornou o ID da pasta digital.');

        if (state.selectedStudentMatch) {
            state.selectedStudentMatch.folderUrl = folderUrl || state.selectedStudentMatch.folderUrl;
            if (ensureData.folderCol) state.selectedStudentMatch.folderCol = ensureData.folderCol;
            if (ensureData.physicalRow) state.selectedStudentMatch.row = ensureData.physicalRow;
        }

        renderStudentLocationStatus();
        renderConsultStudentHero();
        updateUploadFolderControls();

        state.batchSignature = currentBatchSignature();
        for (let i = 0; i < state.generatedDocuments.length; i++) {
            if (state.cancelled) throw new Error('Cancelado pelo usuário.');

            const doc = state.generatedDocuments[i];
            if (isDestinationDone(doc.statusDrive)) continue;
            if (doc.statusDrive?.startsWith('?')) {
                if (!confirm(`${doc.shortName}: o envio anterior ao Drive ficou sem confirmação. Confira a pasta antes de repetir para evitar duplicata. Deseja reenviar este documento?`)) continue;
            }
            try {
            updateProgress(
                96 + ((i + 1) / state.generatedDocuments.length) * 3,
                `Drive: ${doc.shortName} (${i + 1}/${state.generatedDocuments.length})`
            );

            const uploadResponse = await drivePostJson({
                action: 'uploadDocument',
                requestId: doc.requestId || (doc.requestId=createRequestId()),
                clientVersion: APP.version,
                folderId,
                student: studentPayload(student),
                document: {
                    docKey: doc.docKey,
                    docName: doc.docName,
                    filename: doc.file.name,
                    mimeType: 'application/pdf',
                    base64: await fileToBase64(doc.file),
                    sha256: await fileSha256(doc.file)
                }
            });

            const uploadData = parseDriveResponse(uploadResponse);
            if (!uploadData.ok) {
                doc.statusDrive = '✗ Drive';
                renderGeneratedSummary();
                throw new Error(uploadData.error || `Erro ao enviar ${doc.shortName}.`);
            }

            doc.statusDrive = uploadData.duplicate ? '↷ Já recebido no Drive' : '✓ Drive';
            doc.message = '';
            } catch (error) {
                if (!doc.statusDrive?.startsWith('✗')) doc.statusDrive = '? Drive — conferir pasta';
                doc.message = error.message;
                addLog(`${doc.shortName} / Drive: ${error.message}`, 'error');
            }
            renderGeneratedSummary();
            scheduleDraft();
        }

        state.batchSignature=currentBatchSignature();
        scheduleDraft();
        const warning = ensureData.warning ? ` Aviso: ${ensureData.warning}` : '';
        addLog(`Drive: ${state.generatedDocuments.filter(d => d.statusDrive === '✓ Drive').length} documento(s) confirmado(s).${warning}`, 'info');
    }

    function drivePostJson(data) {
        const endpoint = GM_getValue(APP.driveEndpointKey, '').trim();
        const token = GM_getValue(APP.driveTokenKey, '').trim();

        if (!endpoint) throw new Error('Endpoint do Google Drive não configurado.');
        if (!token) throw new Error('Chave de acesso do Google Drive não configurada.');

        return gmPostJson(normalizeDriveEndpoint(endpoint), {
            ...data,
            token
        });
    }

    function normalizeDriveEndpoint(value) {
        let url;try{url=new URL(String(value).trim());}catch(_){throw new Error('Informe a URL /exec da implantação em Configurar Drive.');}
        const match=url.pathname.match(/^\/macros\/(?:u\/\d+\/)?s\/([A-Za-z0-9_-]+)\/exec\/?$/);
        if(url.protocol!=='https:'||url.hostname!=='script.google.com'||url.port||url.username||url.password||!match)
            throw new Error('Use a URL do App da Web terminada em /exec, disponível em Apps Script → Implantar → Gerenciar implantações.');
        return 'https://script.google.com/macros/s/'+match[1]+'/exec';
    }

    function driveHttpError(status) {
        if(status===404)return 'Serviço do Drive não encontrado (HTTP 404). Confira a URL /exec em Configurar Drive e se a implantação continua ativa.';
        if(status===401||status===403)return `Acesso ao serviço do Drive recusado (HTTP ${status}). Confira a implantação e suas permissões.`;
        if(status===429)return 'O Google limitou as solicitações. Aguarde um pouco e tente novamente.';
        return `Falha no serviço do Drive (HTTP ${Number(status)||0}). Tente novamente em instantes.`;
    }

    function gmPostJson(url, data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                anonymous: true,
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                data: JSON.stringify(data),
                timeout: 180_000,
                onload: response => {
                    if (response.status >= 200 && response.status < 400) resolve(response);
                    else reject(new Error(driveHttpError(response.status)));
                },
                onerror: () => reject(new Error('Falha de conexão com o endpoint do Google Drive.')),
                ontimeout: () => reject(new Error('Tempo excedido no endpoint do Google Drive.'))
            });
        });
    }

    /* =====================================================================
     * 13. LIMPEZA / INICIALIZAÇÃO
     * ===================================================================== */

    function clearPdfOnly() {
        state.sourceFile = null;
        state.sourceBytes = null;
        state.pdfjsDocument?.destroy().catch(console.warn);
        state.pdfjsDocument = null;
        state.sourceNames = [];
        state.undoStack = [];
        state.batchSignature = '';
        state.pageModels = [];
        state.generatedDocuments = [];
        state.cancelled = false;
        state.iframe?.remove();
        state.iframe = null;
        if (el.pages) el.pages.innerHTML = '';
        if (el.summary) el.summary.textContent = 'Nenhuma página carregada.';
        if (el.generated) el.generated.textContent = 'Os PDFs serão gerados automaticamente ao salvar.';
        updateProgress(0, 'Sistema pronto');
        atualizarBotoes();
    }

    function clearAll(confirmFirst = true) {
        if (state.processing) return;
        if (confirmFirst && (state.sourceFile || state.selectedStudentMatch) && !confirm('Limpar o aluno selecionado, o PDF e a classificação atual?')) return;
        clearPdfOnly();
        state.selectedStudentMatch = null;
        state.lastSearchResults = [];
        el.studentName.value = '';
        el.studentBirth.value = '';
        el.studentCode.value = '';
        el.searchResults.innerHTML = '';
        renderStudentLocationStatus();
        updateUploadFolderControls();
        clearTimeout(state.draftTimer);
        queueDraftWrite(null).catch(error => addLog(`Não foi possível apagar o rascunho: ${error.message}`, 'warning'));
        state.draftDirty=false;
        if (el.draftStatus) el.draftStatus.textContent = 'Rascunho removido.';
        addLog('Tela limpa.');
    }

    // Editing, recovery and delivery helpers. All draft data remains in this browser.
    function isDestinationDone(status) { return /^[✓↷]/u.test(status || ''); }

    function summarizeDestinations(docs, destinations) {
        const result = { sent: 0, downloads: 0, existing: 0, failed: 0, pending: 0 };
        for (const doc of docs) {
            for (const [enabled, key] of [[destinations.useGed && Number.isInteger(doc.gedId), 'statusGed'], [destinations.useLocal, 'statusLocal'], [destinations.useDrive, 'statusDrive']]) {
                if (!enabled) continue;
                const status = doc[key] || '';
                if (status.startsWith('↷')) result.existing++;
                else if (status.startsWith('✓')) result[key === 'statusLocal' ? 'downloads' : 'sent']++;
                else if (status.startsWith('✗')) result.failed++;
                else result.pending++;
            }
        }
        if (destinations.useLocal) result.downloads = docs.some(d=>(d.statusLocal||'').startsWith('✓')) ? 1 : 0;
        return result;
    }

    function currentBatchSignature() {
        return JSON.stringify({ student: getStudentMeta(), pages: state.pageModels.map(p => [p.id, p.originalPage, p.docKey, p.rotation]) });
    }

    function invalidateBatch() {
        state.generatedDocuments = [];
        state.batchSignature = '';
        if (el.resultsPanel) el.resultsPanel.hidden = true;
        if (el.generated) renderGeneratedSummary();
        if (el.resultStatus) el.resultStatus.textContent = '';
    }

    function rememberEdit() {
        state.undoStack.push(state.pageModels.map(p => ({ ...p })));
        if (state.undoStack.length > 20) state.undoStack.shift();
    }

    function redrawPages() {
        el.pages.replaceChildren();
        state.pageModels.forEach(appendPageCard);
        updatePageLabels(); updateSummary(); atualizarBotoes();
    }

    function pageNeedsReview(p) {
        return !p.manual && (!p.aiSuggestion || (p.aiSuggestion.engine ? !p.aiSuggestion.autoApply : p.aiSuggestion.confidence < 0.85));
    }

    function applyPageFilter() {
        if (!el.pageFilter || !el.pages) return;
        const filter = el.pageFilter.value;
        for (const p of state.pageModels) {
            const card = el.pages.querySelector(`[data-page-id="${CSS.escape(p.id)}"]`);
            if (!card) continue;
            card.hidden = filter === 'unclassified' ? p.docKey !== 'ignore' || p.reviewed : filter === 'review' ? !pageNeedsReview(p) : false;
        }
    }

    async function bulkEdit(action) {
        if (state.processing) return;
        const ids = new Set([...el.pages.querySelectorAll('.page-check:checked')].map(n => n.closest('.page-card').dataset.pageId));
        const pages = state.pageModels.filter(p => ids.has(p.id));
        if (!pages.length) return alert('Marque as páginas que deseja alterar.');
        rememberEdit(); setBusy(true);
        try {
            for (const p of pages) {
                if (action === 'rotate') {
                    p.rotation = (p.rotation + 90) % 360;
                    p.thumbnailDataUrl = await renderPageToDataUrl(p.originalPage, p.rotation);
                } else { p.docKey = action === 'ignore' ? 'ignore' : el.bulkType.value; p.manual = true; p.reviewed = true; }
            }
            invalidateBatch(); redrawPages(); scheduleDraft();
        } catch (error) { showError(error, 'Falha na edição'); }
        finally { setBusy(false); }
    }

    function installWorkspaceTools() {
        const style = document.createElement('style');
        style.textContent = `#${APP.id}-app .page-card[hidden]{display:none} #${APP.id}-app .work-tools{display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#fff;border-radius:10px;margin:10px 0} #${APP.id}-app .work-tools select{max-width:280px} #${APP.id}-app .results{padding:14px;background:white;border-radius:10px;margin-top:12px} #${APP.id}-app .results .summary-row{flex-wrap:wrap;gap:8px} .ad-review{font:15px system-ui;color:#21334a;background:#fff;border:0;border-radius:14px;padding:24px;width:min(850px,90vw);max-height:85vh;overflow:auto;box-shadow:0 15px 80px #0005;z-index:2147483647} .ad-review::backdrop{background:#0008} .ad-review button{padding:10px 16px;margin:8px 8px 0 0;cursor:pointer} .ad-review table{width:100%;border-collapse:collapse} .ad-review td,.ad-review th{text-align:left;padding:8px;border-bottom:1px solid #ddd} .ad-review iframe{width:100%;height:50vh;border:1px solid #ccc}`;
        document.head.appendChild(style);
        const bar = document.createElement('div'); bar.className = 'work-tools';
        bar.innerHTML = `<label>Mostrar <select data-tool="filter"><option value="all">Todas as páginas</option><option value="unclassified">Não classificadas</option><option value="review">Revisar sugestões</option></select></label><button data-tool="select">Marcar visíveis</button><button data-tool="unselect">Desmarcar todas</button><select data-tool="type" aria-label="Tipo para as páginas marcadas">${makeDocumentOptions()}</select><button data-tool="classify">Classificar marcadas</button><button data-tool="rotate">Girar marcadas</button><button data-tool="ignore">Ignorar marcadas</button><button data-tool="undo">Desfazer</button><button data-tool="draft">Salvar rascunho agora</button><button data-tool="restore">Recuperar rascunho</button><span data-tool="draft-status" role="status">Rascunho automático neste navegador.</span>`;
        el.pages.before(bar);
        el.pageFilter = bar.querySelector('[data-tool="filter"]');
        el.bulkType = bar.querySelector('[data-tool="type"]');
        el.draftStatus = bar.querySelector('[data-tool="draft-status"]');
        el.pageFilter.addEventListener('change', applyPageFilter);
        bar.querySelector('[data-tool="select"]').onclick = () => el.pages.querySelectorAll('.page-card:not([hidden]) .page-check').forEach(n => n.checked = true);
        bar.querySelector('[data-tool="unselect"]').onclick = () => el.pages.querySelectorAll('.page-check').forEach(n => n.checked = false);
        for (const action of ['classify', 'rotate', 'ignore']) bar.querySelector(`[data-tool="${action}"]`).onclick = () => bulkEdit(action);
        bar.querySelector('[data-tool="undo"]').onclick = () => {
            if (state.processing || !state.undoStack.length) return;
            state.pageModels = state.undoStack.pop(); invalidateBatch(); redrawPages(); scheduleDraft();
        };
        bar.querySelector('[data-tool="draft"]').onclick = saveDraftNow;
        bar.querySelector('[data-tool="restore"]').onclick = restoreDraft;
        const result = document.createElement('section'); result.className = 'results';
        result.innerHTML = '<h3>Resultado por documento</h3><p class="result-status" role="status"></p><button class="retry">Reenviar somente pendentes</button>';
        result.append(el.generated, el.log); el.pages.after(result);
        el.resultStatus = result.querySelector('.result-status');
        el.retryBtn = result.querySelector('.retry'); el.retryBtn.onclick = () => executeDestinations(true);
        el.executeBtn.textContent = 'Revisar e salvar';
        compactUploadInterface(bar, result);
        for (const control of [el.studentName, el.studentBirth, el.studentCode, el.archiveRoot, el.historical]) control.addEventListener('change', () => {
            if ([el.studentName,el.studentBirth,el.studentCode].includes(control)) { state.selectedStudentMatch = null; renderStudentLocationStatus(); updateUploadFolderControls(); }
            invalidateBatch(); scheduleDraft();
        });
        window.addEventListener('beforeunload', event => {
            if (state.processing || state.draftPending) { event.preventDefault(); event.returnValue = ''; }
        });
        draftStore('readonly').then(draft => { if (draft) el.draftStatus.textContent = 'Há um rascunho salvo. Use Recuperar rascunho antes de iniciar outro trabalho.'; }).catch(() => el.draftStatus.textContent = 'Armazenamento de rascunho indisponível.');
    }

    async function importSourceFiles(files) {
        if (state.processing || !files.length) return;
        setBusy(true); state.cancelled = false;
        let nextDocument;
        try {
            if (files.some(f => !/\.(pdf|jpe?g|png)$/i.test(f.name))) throw new Error('Selecione somente PDF, JPG ou PNG.');
            if ((state.sourceBytes?.byteLength || 0) + files.reduce((n,f) => n + f.size, 0) > APP.maxPdfSize) throw new Error('O conjunto de arquivos ultrapassa 120 MB.');
            const output = state.sourceBytes ? await PDFLib.PDFDocument.load(state.sourceBytes.slice()) : await PDFLib.PDFDocument.create();
            const previousCount = output.getPageCount();
            const sourceNames = [];
            for (const file of files) {
                if (state.cancelled) throw new Error('Importação cancelada.');
                updateProgress(5, `Importando ${file.name}...`);
                const bytes = new Uint8Array(await file.arrayBuffer());
                if (/\.pdf$/i.test(file.name)) {
                    const pdf = await PDFLib.PDFDocument.load(bytes);
                    for (const page of await output.copyPages(pdf, pdf.getPageIndices())) { output.addPage(page); sourceNames.push(file.name); }
                } else {
                    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
                    const canvas = document.createElement('canvas');
                    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
                    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
                    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
                    if (!blob) throw new Error(`Não foi possível converter ${file.name}.`);
                    const image = await output.embedJpg(await blob.arrayBuffer());
                    const size = image.width > image.height ? [841.89,595.28] : [595.28,841.89];
                    const page = output.addPage(size); const scale = Math.min(size[0]/image.width, size[1]/image.height);
                    page.drawImage(image,{x:(size[0]-image.width*scale)/2,y:(size[1]-image.height*scale)/2,width:image.width*scale,height:image.height*scale});
                    sourceNames.push(file.name); canvas.width = canvas.height = 0;
                }
            }
            const bytes = await output.save();
            if (bytes.byteLength > APP.maxPdfSize) throw new Error('O PDF combinado ultrapassa 120 MB.');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            nextDocument = await pdfjsLib.getDocument({data:bytes.slice()}).promise;
            const models = [...state.pageModels];
            for (let i = previousCount; i < nextDocument.numPages; i++) {
                if (state.cancelled) throw new Error('Importação cancelada.');
                const page = await nextDocument.getPage(i+1); const rotation = page.rotate || 0;
                const viewport = page.getViewport({scale:APP.thumbnailScale,rotation});
                const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
                models.push({id:createRequestId(),originalPage:i+1,docKey:'ignore',rotation,thumbnailDataUrl:canvas.toDataURL('image/jpeg',.82),extractedText:'',aiSuggestion:null,ocrUsed:false,manual:false,reviewed:false,sourceName:sourceNames[i-previousCount]});
                canvas.width=canvas.height=0;
                updateProgress(10+40*(i-previousCount+1)/sourceNames.length, `Preparando página ${i+1}...`);
            }
            const oldDocument = state.pdfjsDocument;
            state.pdfjsDocument=nextDocument; nextDocument=null;
            state.sourceBytes=bytes; state.sourceNames.push(...files.map(f=>f.name));
            state.sourceFile=new File([bytes], 'Documentos do aluno.pdf',{type:'application/pdf'});
            state.pageModels=models; state.undoStack=[];
            if (!el.studentCode.value && files.length===1) el.studentCode.value=inferStudentCode(files[0].name);
            await oldDocument?.destroy(); invalidateBatch(); redrawPages(); scheduleDraft();
            updateProgress(50, `${models.length} página(s) pronta(s).`);
        } catch (error) { showError(error,'Não foi possível importar'); }
        finally { await nextDocument?.destroy(); setBusy(false); }
    }

    function draftStore(mode, value) {
        return new Promise((resolve,reject) => {
            const request=indexedDB.open('sigeduca-arquivo-digital',1);
            request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
            request.onerror=()=>reject(request.error);
            request.onsuccess=()=>{
                const db=request.result; const tx=db.transaction('drafts',mode); const store=tx.objectStore('drafts');
                const action=mode==='readonly'?store.get('current'):value===null?store.delete('current'):store.put(value,'current');
                tx.oncomplete=()=>{db.close();resolve(action.result);};
                tx.onerror=tx.onabort=()=>{db.close();reject(tx.error || new Error('Rascunho não salvo.'));};
            };
        });
    }

    function queueDraftWrite(value) {
        state.draftPending = true;
        const next = state.draftQueue.catch(()=>{}).then(()=>draftStore('readwrite',value));
        state.draftQueue = next;
        next.then(()=>{ if(state.draftQueue===next && !state.draftDirty) state.draftPending=false; },()=>{ if(state.draftQueue===next && !state.draftDirty) state.draftPending=false; });
        return next;
    }

    function scheduleDraft() {
        if (!el.pages || !state.sourceBytes) return;
        clearTimeout(state.draftTimer); state.draftDirty=true; state.draftPending=true;
        state.draftTimer=setTimeout(saveDraftNow,600);
    }

    async function saveDraftNow() {
        clearTimeout(state.draftTimer);
        if (!state.sourceBytes) return;
        state.draftDirty=false;
        const draft={version:1,savedAt:Date.now(),bytes:state.sourceBytes.slice(),student:getStudentMeta(),match:state.selectedStudentMatch,sourceNames:[...state.sourceNames],pages:state.pageModels.map(({thumbnailDataUrl,...p})=>({...p})),destinations:[el.destGed.checked,el.destLocal.checked,el.destDrive.checked],generated:state.generatedDocuments.map(d=>({...d})),batchSignature:state.batchSignature};
        try { await queueDraftWrite(draft); el.draftStatus.textContent='Rascunho salvo às '+new Date(draft.savedAt).toLocaleTimeString('pt-BR')+'.'; }
        catch(error) { el.draftStatus.textContent='Não foi possível salvar o rascunho. Mantenha esta aba aberta.'; addLog(error.message,'warning'); }
    }

    async function restoreDraft() {
        if (state.processing) return;
        if (state.sourceBytes && !confirm('Substituir o trabalho aberto pelo último rascunho salvo?')) return;
        clearTimeout(state.draftTimer); setBusy(true);
        let loaded;
        try {
            await state.draftQueue.catch(()=>{});
            const draft=await draftStore('readonly');
            if (!draft || draft.version!==1) return alert('Nenhum rascunho compatível encontrado.');
            pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            loaded=await pdfjsLib.getDocument({data:draft.bytes.slice()}).promise;
            const models=[];
            for (const p of draft.pages) {
                if (!DOCUMENT_TYPES[p.docKey] || p.originalPage<1 || p.originalPage>loaded.numPages) throw new Error('Rascunho inválido.');
                const page=await loaded.getPage(p.originalPage); const viewport=page.getViewport({scale:APP.thumbnailScale,rotation:p.rotation});
                const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
                await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
                models.push({...p,thumbnailDataUrl:canvas.toDataURL('image/jpeg',.82)});canvas.width=canvas.height=0;
            }
            const old=state.pdfjsDocument; state.pdfjsDocument=loaded; loaded=null; await old?.destroy();
            state.sourceBytes=draft.bytes;state.sourceFile=new File([draft.bytes],'Rascunho.pdf',{type:'application/pdf'});
            state.sourceNames=draft.sourceNames || [];state.pageModels=models;state.selectedStudentMatch=draft.match;state.undoStack=[];
            const student=draft.student;
            el.studentName.value=student.name;el.studentCode.value=student.code;el.studentBirth.value=student.birth;el.archiveRoot.value=student.root;el.historical.checked=student.historical;
            [el.destGed.checked,el.destLocal.checked,el.destDrive.checked]=draft.destinations;
            updateStudentCodeVisibility();
            invalidateBatch();
            if(draft.batchSignature===currentBatchSignature()){state.generatedDocuments=draft.generated||[];state.batchSignature=draft.batchSignature;}
            redrawPages();renderGeneratedSummary();renderStudentLocationStatus();updateUploadFolderControls();
            el.draftStatus.textContent='Rascunho recuperado. Confira os destinos antes de enviar novamente.';
            updateProgress(50,`${models.length} página(s) recuperada(s).`);
        } catch(error){showError(error,'Não foi possível recuperar');}
        finally{await loaded?.destroy();state.draftPending=false;setBusy(false);}
    }

    function askInDialog(title, content, acceptLabel) {
        return new Promise(resolve=>{
            const dialog=document.createElement('dialog');dialog.className='ad-review';
            dialog.innerHTML=`<h2>${escapeHtml(title)}</h2>${content}<div><button data-choice="yes">${escapeHtml(acceptLabel)}</button><button data-choice="no">Voltar sem enviar</button></div>`;
            document.body.appendChild(dialog);
            let finished=false;
            const finish=value=>{if(finished)return;finished=true;dialog.close();dialog.remove();resolve(value);};
            dialog.querySelector('[data-choice="yes"]').onclick=()=>finish(true);
            dialog.querySelector('[data-choice="no"]').onclick=()=>finish(false);
            dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
            dialog.showModal();dialog.querySelector('[data-choice="no"]').focus();
        });
    }

    async function reviewBeforeSave({useGed,useLocal,useDrive,student}) {
        const rows=state.generatedDocuments.map(d=>`<tr><td>${escapeHtml(d.shortName)}</td><td>${d.pages.length}</td><td>${humanSize(d.file.size)}</td><td>${[useGed&&Number.isInteger(d.gedId)?(isDestinationDone(d.statusGed)?escapeHtml(d.statusGed):'GED'):'',useLocal?(isDestinationDone(d.statusLocal)?'Download já solicitado':'Computador'):'',useDrive?(isDestinationDone(d.statusDrive)?'Drive já enviado':'Drive'):''].filter(Boolean).join(' · ') || 'Sem destino compatível'}</td></tr>`).join('');
        const ignored=state.pageModels.filter(p=>p.docKey==='ignore').length;
        const unreviewed=state.pageModels.filter(p=>p.docKey!=='ignore'&&pageNeedsReview(p)).length;
        return askInDialog('Conferir antes de salvar',`<p><b>Aluno:</b> ${escapeHtml(student.name || 'Sem nome')} · <b>Código:</b> ${escapeHtml(student.code || 'Não informado')} · <b>Nascimento:</b> ${escapeHtml(student.birth || 'Não informado')}</p><p><b>Arquivo:</b> ${escapeHtml(student.root)} · ${escapeHtml(student.sheet || 'Sem localização física')} ${escapeHtml(String(student.row || ''))}</p><p><b>Pasta digital:</b> ${escapeHtml(student.existingFolderUrl || 'Será localizada ou criada pelo serviço configurado, se Drive estiver marcado.')}</p><p><b>${ignored} página(s) ignorada(s)</b>; ${unreviewed} página(s) selecionada(s) com sugestão a revisar.</p><table><thead><tr><th>Documento</th><th>Páginas</th><th>Tamanho</th><th>Destino / situação</th></tr></thead><tbody>${rows}</tbody></table><p>O computador receberá um PDF único com as páginas selecionadas na ordem atual. O navegador solicitará o download.</p>`,'Confirmar e salvar');
    }

    async function offerCompression(doc) {
        if (!await askInDialog('Documento acima de 5 MB',`<p>${escapeHtml(doc.shortName)}: ${humanSize(doc.file.size)}. Preparar uma cópia reduzida para GED e Drive? A redução transforma as páginas em imagens; confira a legibilidade na prévia. O PDF único do computador mantém as páginas originais.</p>`,'Preparar redução')) return false;
        let reduced;
        for (const [scale,quality] of [[1.6,.78],[1.25,.65],[1,.52]]) {
            if(state.cancelled)return false;
            const pdf=await PDFLib.PDFDocument.create();
            for(const pageNumber of doc.pages){
                if(state.cancelled)return false;
                const model=state.pageModels.find(p=>p.originalPage===pageNumber);
                const page=await state.pdfjsDocument.getPage(pageNumber);
                const viewport=page.getViewport({scale,rotation:model.rotation});
                const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
                const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
                await page.render({canvasContext:ctx,viewport}).promise;
                const image=await pdf.embedJpg(canvas.toDataURL('image/jpeg',quality));
                const target=pdf.addPage([viewport.width/scale,viewport.height/scale]);
                target.drawImage(image,{x:0,y:0,width:target.getWidth(),height:target.getHeight()});canvas.width=canvas.height=0;
            }
            reduced=new File([await pdf.save()],doc.file.name,{type:'application/pdf'});
            if(reduced.size<=APP.maxGeneratedFileSize)break;
        }
        if(reduced.size>APP.maxGeneratedFileSize){alert('A cópia ainda ultrapassa 5 MB. Separe ou digitalize novamente com resolução menor. Nenhum envio iniciado.');return false;}
        const url=URL.createObjectURL(reduced);
        try{
            const accepted=await askInDialog('Conferir legibilidade da cópia reduzida',`<p>${escapeHtml(doc.shortName)}: ${humanSize(doc.file.size)} → ${humanSize(reduced.size)}. Confira todas as páginas antes de aceitar.</p><iframe title="PDF reduzido para conferência" src="${url}"></iframe><p><a href="${url}" target="_blank" rel="noopener">Abrir prévia em outra aba</a></p>`,'Usar esta cópia reduzida');
            if(accepted)doc.file=reduced;
            return accepted;
        }finally{URL.revokeObjectURL(url);}
    }


    const SEARCH_CACHE_TTL = 15 * 60 * 1000;
    const searchInFlight = new Map();

    async function searchCacheKey() {
        const scope = `${GM_getValue(APP.driveEndpointKey, '')}\n${GM_getValue(APP.driveTokenKey, '')}`;
        return 'adig:search:v1:' + await sha256Hex(new TextEncoder().encode(scope));
    }

    async function clearSearchCache() {
        const key=await searchCacheKey();
        GM_setValue(key, []); GM_setValue(key+':index:PERMANENTE',null); GM_setValue(key+':index:FORMANDOS',null);
    }

    async function cachedStudentSearch(payload, forceRefresh = false) {
        if(state.backendReady)await state.backendReady;
        const storeKey = await searchCacheKey();
        let index=GM_getValue(storeKey+':index:'+payload.root,null);
        if(state.indexSupported&&(forceRefresh||!index||index.expiresAt<=Date.now())){
            index=await downloadStudentIndex(payload.root,forceRefresh);
            forceRefresh=false;
        }
        if (!forceRefresh && index && index.expiresAt>Date.now() && Array.isArray(index.records)) {
            const query=normalizeText(payload.query);
            const terms=query.split(/\s+/).filter(t=>t.length>=3&&!/^(DAS|DOS|DEL|DELLA)$/.test(t));
            const single=query.split(/\s+/).length===1;
            const results=index.records.filter(r=>single?normalizeText(r.name).includes(query):terms.some(t=>normalizeText(r.name).includes(t)));
            if(el.cacheStatus)el.cacheStatus.textContent='Índice local · '+new Date(index.createdAt).toLocaleTimeString('pt-BR');
            return {responseText:JSON.stringify({ok:true,results}),fromCache:true};
        }
        const queryKey = JSON.stringify([payload.root, normalizeText(payload.query), payload.birth || '', payload.maxResults]);
        const now = Date.now();
        const stored = GM_getValue(storeKey, []);
        const entries = (Array.isArray(stored) ? stored : []).filter(e => e && now-e.time >= 0 && now-e.time < SEARCH_CACHE_TTL);
        const cached = entries.find(e => e.key === queryKey);
        if (!forceRefresh && cached) {
            if (el.cacheStatus) el.cacheStatus.textContent = `Cache local · ${new Date(cached.time).toLocaleTimeString('pt-BR')}`;
            return { responseText: JSON.stringify(cached.data), fromCache: true };
        }
        const pendingKey = storeKey + queryKey;
        if (searchInFlight.has(pendingKey)) return searchInFlight.get(pendingKey);
        const request = (async () => {
            const started = performance.now();
            const response = await drivePostJson({...payload,forceRefresh});
            const data = parseDriveResponse(response);
            if (data.ok && Array.isArray(data.results)) {
                const latest = GM_getValue(storeKey, []);
                const next = (Array.isArray(latest) ? latest : []).filter(e => e && e.key !== queryKey && Date.now()-e.time < SEARCH_CACHE_TTL);
                next.push({ key:queryKey, time:Date.now(), data });
                try { GM_setValue(storeKey,next.slice(-60)); } catch(error) { console.warn('Cache de consultas não salvo:',error); }
            }
            if(el.cacheStatus)el.cacheStatus.textContent=`Google Sheets · ${((performance.now()-started)/1000).toFixed(1)} s`;
            return response;
        })();
        searchInFlight.set(pendingKey,request);
        try{return await request;}finally{searchInFlight.delete(pendingKey);}
    }

    function installSearchCacheControls() {
        installBirthMask();
        state.backendReady=prepareSearchBackend();
        el.archiveRoot.addEventListener('change',()=>{
            state.selectedStudentMatch=null;state.lastSearchResults=[];state.searchSequence=(state.searchSequence||0)+1;
            if(el.studentCode)el.studentCode.value='';
            if(el.matchModal)el.matchModal.style.display='none';
            if(el.cacheStatus)el.cacheStatus.textContent='Consultando '+el.archiveRoot.value+'.';
        });
        const container = el.searchStudentBtn.parentElement;
        const refresh = document.createElement('button'); refresh.type='button';refresh.textContent='Atualizar busca';refresh.title='Consultar novamente o Google Sheets, sem usar o resultado salvo';
        refresh.onclick=()=>{if(!state.processing&&!el.searchStudentBtn.disabled)searchStudentInLists(true);};
        const clear=document.createElement('button');clear.type='button';clear.textContent='Limpar cache';clear.title='Apagar as consultas guardadas neste navegador';
        clear.onclick=()=>clearSearchCache().then(()=>el.cacheStatus.textContent='Cache removido.').catch(error=>showError(error));
        el.cacheStatus=document.createElement('small');el.cacheStatus.setAttribute('role','status');el.cacheStatus.style.display='block';el.cacheStatus.textContent='Consultas guardadas por 15 minutos.';
        const options=document.createElement('details');options.className='search-options';options.innerHTML='<summary>Opções de busca</summary>';
        const sync=document.createElement('button');sync.type='button';sync.textContent='Sincronizar nomes';sync.onclick=()=>syncStudentIndex(sync);
        options.append(refresh,sync,clear,el.cacheStatus);container.append(options);
    }

    async function refreshSelectedStudent() {
        const selected = state.selectedStudentMatch;
        const response = await drivePostJson({action:'searchStudents',clientVersion:APP.version,root:selected.root,query:selected.name,birth:selected.birth || '',maxResults:100});
        const data=parseDriveResponse(response);
        if(!data.ok)throw new Error(data.error || 'Não foi possível conferir a localização atual do aluno.');
        const matches=(data.results || []).filter(r=>normalizeText(r.name)===normalizeText(selected.name)&&(!selected.birth || parseDateFlexible(r.birth)===parseDateFlexible(selected.birth))&&(!r.root || r.root===selected.root));
        if(matches.length!==1)throw new Error('A localização do aluno mudou ou há homônimos. Pesquise e selecione o aluno novamente antes de enviar ao Drive.');
        const fresh=matches[0];
        if(!Number.isInteger(Number(fresh.row))||Number(fresh.row)<1)throw new Error('A planilha retornou uma localização inválida.');
        state.selectedStudentMatch={...selected,...fresh,root:selected.root,birth:parseDateFlexible(fresh.birth || '')};
        renderStudentLocationStatus();updateUploadFolderControls();scheduleDraft();
    }

    function compactUploadInterface(bar,result) {
        el.resultsPanel=result;result.hidden=!state.generatedDocuments.length;
        const app=el.app;
        app.querySelector('.ad-title').textContent='Arquivo Digital';
        app.querySelector('.ad-subtitle').textContent=`Organização e envio de documentos · v${APP.version}`;
        el.scannerBtn.hidden=true;
        const left=app.querySelector('.ad-left');
        const sections=[...left.querySelectorAll(':scope > .section')];
        const help=document.createElement('details');help.className='section';
        help.innerHTML='<summary style="padding:12px;cursor:pointer">Ajuda e conexão</summary><div class="help-content"></div>';
        const content=help.querySelector('.help-content');
        for(const section of sections){
            const title=section.querySelector('.section-title')?.textContent || '';
            if(title==='Google Drive' || title.includes('OCR'))content.append(section);
            if(title==='Destinos'){
                section.querySelector('.tiny')?.remove();
                section.classList.add('destination-box');
                app.querySelector('.ad-footer').before(section);
            }
        }
        left.append(help);
        const hint=el.dropzone.querySelector(':scope > .tiny');if(hint)hint.textContent='PDF, JPG ou PNG · até 120 MB';
        el.autoDetectBtn.textContent='Identificar documentos';
        el.autoDetectBtn.title='Executa OCR e IA local em um clique; preserva escolhas manuais.';
        el.acceptAiBtn.hidden=true;
        const aiHelp=document.createElement('p');aiHelp.className='tiny';aiHelp.textContent='Identificar documentos combina OCR e IA local gratuita. No primeiro uso, baixa cerca de 118 MB do modelo, além dos arquivos de execução. Os documentos não são enviados ao provedor da IA. Casos duvidosos ficam para revisão.';content.prepend(aiHelp);
        const draft=document.createElement('details');draft.innerHTML='<summary>Rascunho</summary>';draft.style.marginLeft='auto';
        for(const name of ['draft','restore','draft-status'])draft.append(bar.querySelector(`[data-tool="${name}"]`));
        bar.append(draft);
        const logs=document.createElement('details');logs.innerHTML='<summary>Detalhes do processamento</summary>';logs.append(el.log);result.append(logs);
        const style=document.createElement('style');
        style.textContent=`#${APP.id}-app .ad-main{grid-template-columns:275px minmax(0,1fr)} #${APP.id}-app .ad-right{display:none} #${APP.id}-app .destination-box{margin:0;border-radius:0;border-top:1px solid #dbe1e9;display:flex;align-items:center;gap:20px;padding:8px 18px} #${APP.id}-app .destination-box .section-title{padding:0;border:0;background:none} #${APP.id}-app .destination-box .section-body{padding:0;display:flex;gap:20px;flex-wrap:wrap} #${APP.id}-app details summary{cursor:pointer} #${APP.id}-app .work-tools{font-size:12px} #${APP.id}-app .work-tools button{padding:7px 9px} #${APP.id}-app .work-tools details button{display:block;margin:8px 0} #${APP.id}-app .results[hidden]{display:none} #${APP.id}-app .help-content .section{box-shadow:none} @media(max-width:1000px){#${APP.id}-app .ad-main{grid-template-columns:1fr} #${APP.id}-app .destination-box{flex-wrap:wrap}}`;
        document.head.append(style);
        const layout=document.createElement('style');
        layout.textContent=`#${APP.id}-app .ad-shell{grid-template-rows:auto auto minmax(0,1fr) auto auto} #${APP.id}-app .ad-identity.without-ged{grid-template-columns:140px 160px minmax(200px,1fr) 140px auto} #${APP.id}-app .ad-identity > [hidden]{display:none} @media(max-width:1000px){#${APP.id}-app .ad-identity,#${APP.id}-app .ad-identity.without-ged{grid-template-columns:repeat(2,minmax(0,1fr));padding-left:18px}}`;
        document.head.append(layout);
        installSearchCacheControls();
        const codeField=el.studentCode.parentElement;
        codeField.querySelector('label').textContent='Código do aluno (GED)';
        el.studentCode.placeholder='Para envio ao GED';
        el.studentCode.title='Usado para abrir o cadastro e anexar documentos no SIGEDUCA.';
        el.destGed.addEventListener('change',updateStudentCodeVisibility);
        updateStudentCodeVisibility();
    }

    function updateStudentCodeVisibility() {
        if(!el.studentCode||!el.destGed)return;
        el.studentCode.parentElement.hidden=!el.destGed.checked;
        el.app.querySelector('.ad-identity').classList.toggle('without-ged',!el.destGed.checked);
    }


    async function fileSha256(file) {
        return sha256Hex(new Uint8Array(await file.arrayBuffer()));
    }

    // SIGEDUCA também é servido por HTTP: randomUUID e subtle podem não existir.
    function createRequestId() {
        const bytes=crypto.getRandomValues(new Uint8Array(16));
        bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
        const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }

    async function sha256Hex(input) {
        if(crypto.subtle?.digest){
            const digest=await crypto.subtle.digest('SHA-256',input);
            return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        }
        // SHA-256 local mantém a mesma chave de cache e identificação dos arquivos.
        const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
        const bytes=new Uint8Array(Math.ceil((input.length+9)/64)*64);bytes.set(input);bytes[input.length]=128;
        const view=new DataView(bytes.buffer),bits=input.length*8;
        view.setUint32(bytes.length-8,Math.floor(bits/4294967296));view.setUint32(bytes.length-4,bits>>>0);
        const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        const w=new Uint32Array(64),ror=(n,s)=>(n>>>s)|(n<<(32-s));
        for(let offset=0;offset<bytes.length;offset+=64){
            for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
            for(let i=16;i<64;i++){
                const x=w[i-15],y=w[i-2];
                w[i]=(w[i-16]+(ror(x,7)^ror(x,18)^(x>>>3))+w[i-7]+(ror(y,17)^ror(y,19)^(y>>>10)))>>>0;
            }
            let [a,b,c,d,e,f,g,j]=h;
            for(let i=0;i<64;i++){
                const t1=(j+(ror(e,6)^ror(e,11)^ror(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0;
                const t2=((ror(a,2)^ror(a,13)^ror(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
                j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
            }
            [a,b,c,d,e,f,g,j].forEach((n,i)=>h[i]=(h[i]+n)>>>0);
        }
        return h.map(n=>n.toString(16).padStart(8,'0')).join('');
    }

    function formatBirthDigits(value) {
        const digits=String(value||'').replace(/\D/g,'').slice(0,8);
        return digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2,4):'')+(digits.length>4?'/'+digits.slice(4):'');
    }
    function isValidBirth(value) {
        if(!value)return true;
        const match=String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return false;
        const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
        if(year<1000)return false;
        const date=new Date(year,month-1,day);
        return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day&&date<=new Date();
    }
    function validateBirthInput() {
        if(!el.studentBirth)return true;
        const valid=isValidBirth(el.studentBirth.value.trim());
        el.studentBirth.setCustomValidity(valid?'':'Informe uma data válida no formato dd/mm/aaaa.');
        if(!valid)el.studentBirth.reportValidity();return valid;
    }
    function installBirthMask() {
        const input=el.studentBirth;if(!input)return;
        input.inputMode='numeric';input.maxLength=10;input.placeholder='dd/mm/aaaa';
        input.addEventListener('input',()=>{
            const before=input.value,position=input.selectionStart||0,digitsBefore=before.slice(0,position).replace(/\D/g,'').length;
            input.value=formatBirthDigits(before);let next=0,count=0;
            while(next<input.value.length&&count<digitsBefore){if(/\d/.test(input.value[next]))count++;next++;}
            input.setSelectionRange(next,next);input.setCustomValidity('');
        });
        input.addEventListener('blur',()=>{input.setCustomValidity(isValidBirth(input.value)?'':'Informe uma data válida no formato dd/mm/aaaa.');});
    }
    function refreshSearchControls() {
        const busy=Boolean(state.processing||state.searchBusy||state.syncingIndex);
        for(const input of [el.archiveRoot,el.studentName,el.studentBirth,el.studentCode,el.searchStudentBtn])if(input)input.disabled=busy;
    }

    async function prepareSearchBackend() {
        state.indexSupported=false;
        if(!GM_getValue(APP.driveEndpointKey,'')||!GM_getValue(APP.driveTokenKey,''))return;
        try{const data=parseDriveResponse(await drivePostJson({action:'ping'}));state.indexSupported=Boolean(data.ok&&data.capabilities?.includes('studentIndex'));}
        catch(error){console.warn('Não foi possível verificar o serviço:',error.message);}
    }

    async function downloadStudentIndex(root,forceRefresh=false) {
        const storeKey=await searchCacheKey();let offset=0,version='',records=[],snapshot;
        do{
            const progress='Sincronizando '+root+' · '+records.length+' nomes...';
            if(el.cacheStatus)el.cacheStatus.textContent=progress;
            const boot=document.querySelector('[data-boot="index"]');if(boot)boot.textContent='◌ '+progress;
            const data=parseDriveResponse(await drivePostJson({action:'getStudentIndex',root,offset,version,createdAt:snapshot?.createdAt,forceRefresh}));
            if(!data.ok)throw new Error(data.error||'Falha ao sincronizar.');
            if(!Array.isArray(data.results)||!data.version||(version&&version!==data.version))throw new Error('Índice mudou durante a sincronização. Tente novamente.');
            if(data.nextOffset!==null&&(!Number.isInteger(data.nextOffset)||data.nextOffset<=offset))throw new Error('Página de índice inválida.');
            records.push(...data.results);version=data.version;offset=data.nextOffset;snapshot=data;
        }while(offset!==null);
        if((snapshot.total!==null&&snapshot.total!==records.length)||snapshot.expiresAt<=Date.now())throw new Error('Índice incompleto ou expirado. Tente novamente.');
        const index={records,version,createdAt:snapshot.createdAt,expiresAt:snapshot.expiresAt};
        GM_setValue(storeKey+':index:'+root,index);return index;
    }

    async function syncStudentIndex(button) {
        if(state.processing||state.searchBusy||state.syncingIndex)return;
        state.syncingIndex=true;button.disabled=true;refreshSearchControls();
        const root=el.archiveRoot.value;
        try{
            const ping=parseDriveResponse(await drivePostJson({action:'ping'}));
            state.indexSupported=ping.capabilities?.includes('studentIndex') || false;
            if(!ping.ok||!state.indexSupported)throw new Error('Atualize o serviço Google Apps Script para a versão 1.2.0 antes de sincronizar. A busca online continua disponível.');
            const index=await downloadStudentIndex(root);
            el.cacheStatus.textContent=index.records.length+' nomes disponíveis localmente em '+root+'.';
        }catch(error){el.cacheStatus.textContent=error.message;addLog(error.message,'warning');}
        finally{state.syncingIndex=false;button.disabled=false;refreshSearchControls();}
    }


    async function configureLocalModelCache(env) {
        env.useBrowserCache=false;env.useCustomCache=false;
        try{
            if(typeof caches!=='undefined'){await caches.open('transformers-cache');env.useBrowserCache=true;return;}
        }catch(_){/* Cache API bloqueada: tenta armazenamento compatível com HTTP. */}
        if(typeof indexedDB==='undefined')return;
        let db;
        try{
            db=await new Promise((resolve,reject)=>{
                const request=indexedDB.open('sigeduca-modelos-ia',1);
                request.onupgradeneeded=()=>request.result.createObjectStore('files');
                request.onsuccess=()=>resolve(request.result);
                request.onerror=()=>reject(request.error);
                request.onblocked=()=>reject(new Error('Armazenamento de modelos ocupado.'));
            });
        }catch(_){return;}
        db.onversionchange=()=>db.close();
        const transact=(mode,key,value)=>new Promise((resolve,reject)=>{
            const tx=db.transaction('files',mode),store=tx.objectStore('files');
            const request=mode==='readonly'?store.get(key):store.put(value,key);
            tx.oncomplete=()=>resolve(request.result);
            tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
        });
        env.customCache={
            async match(key){
                try{const saved=await transact('readonly',String(key));return saved?new Response(saved.body,{status:200,headers:saved.headers}):undefined;}
                catch(_){return undefined;}
            },
            async put(key,response){
                try{
                    if(response.status!==200)return;
                    const copy=response.clone(),body=await copy.arrayBuffer();
                    const headers={};for(const name of ['content-type','content-length']){const value=copy.headers.get(name);if(value)headers[name]=value;}
                    await transact('readwrite',String(key),{body,headers});
                }catch(_){/* Falta de espaço não impede usar o modelo já baixado. */}
            }
        };
        env.useCustomCache=true;
    }

    function localAiWorkerProgram() {
        let extractor, referenceVectors, referenceKeys;
        self.onmessage = async ({data}) => {
            try {
                if (!extractor) {
                    const {pipeline,env} = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
                    env.allowLocalModels = false;
                    await configureLocalModelCache(env);
                    env.backends.onnx.wasm.numThreads = 1;
                    extractor = await pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{
                        dtype:'q8',device:'wasm',revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',
                        progress_callback: p => self.postMessage({id:data.id,progress:p.status==='progress' ? `Baixando IA local: ${Math.round(p.progress || 0)}%` : 'Preparando IA local...'})
                    });
                }
                if (!referenceVectors) {
                    referenceKeys=data.references.map(r=>r.key);
                    referenceVectors=(await extractor(data.references.map(r=>r.text),{pooling:'mean',normalize:true})).tolist();
                }
                const text=String(data.text || '').replace(/\s+/g,' ').trim();
                const chunks=[text.slice(0,900)];
                if(text.length>900)chunks.push(text.slice(900,1800));
                if(text.length>1800)chunks.push(text.slice(-900));
                const vectors=(await extractor(chunks,{pooling:'mean',normalize:true})).tolist();
                const ranked=referenceKeys.map((key,i)=>({key,score:Math.max(...vectors.map(v=>v.reduce((sum,n,j)=>sum+n*referenceVectors[i][j],0)))})).sort((a,b)=>b.score-a.score);
                self.postMessage({id:data.id,result:{key:ranked[0].key,score:ranked[0].score,margin:ranked[0].score-(ranked[1]?.score || 0),alternatives:ranked.slice(0,3)}});
            } catch(error) { self.postMessage({id:data.id,error:error.message || String(error)}); }
        };
    }

    function aiDocumentReferences() {
        const descriptions={
            ged_responsavel:'Documento de identidade RG ou CPF pertencente ao pai, mãe ou responsável legal do estudante.',
            ged_certidao:'Certidão de nascimento ou casamento. Registro civil, matrícula da certidão, cartório, filiação, data e local de nascimento.',
            ged_rgcpf:'Carteira de identidade, registro geral RG, CPF ou carteira de identidade nacional do próprio estudante.',
            ged_energia:'Conta de energia elétrica, fatura de luz, unidade consumidora, consumo em kWh, vencimento e endereço.',
            ged_sangue:'Resultado de exame de tipagem sanguínea. Grupo ABO A B AB O e fator Rh positivo ou negativo.',
            ged_vacina:'Caderneta de vacinação, carteira de vacinas, doses aplicadas, datas, lote e imunização.',
            ged_oftalmo:'Exame oftalmológico, avaliação de optometria, acuidade visual, visão, olhos e receita de óculos.',
            ged_historico:'Histórico escolar ou atestado de transferência. Estabelecimento de ensino, séries cursadas, disciplinas, notas, carga horária, aprovação e vida escolar.',
            arquivo_ficha_individual:'Ficha individual do estudante. Ano letivo, turma, frequência, notas por bimestre, componentes curriculares e resultado final.',
            arquivo_ficha_matricula:'Ficha de matrícula escolar. Dados cadastrais do aluno, responsáveis, endereço, nascimento, telefone, série e turma.',
            arquivo_atestado_medico:'Atestado médico. Paciente necessita afastamento ou repouso por motivo de saúde, dias, data, assinatura e CRM do médico.',
            arquivo_certificado:'Certificado ou diploma de conclusão de curso ou ensino, nome do concluinte, instituição, certificação e conclusão.',
            arquivo_cartao_sus:'Cartão nacional de saúde SUS. Número CNS, nome do cidadão, data de nascimento e Ministério da Saúde.',
            arquivo_termo_compromisso:'Termo de compromisso ou autorização, ciência e responsabilidade, assinatura do responsável e consentimento.'
        };
        return Object.entries(DOCUMENT_TYPES).filter(([key])=>!['ignore','arquivo_diversos'].includes(key)).map(([key,meta])=>({key,text:descriptions[key] || `${meta.label}. ${(meta.keywords || []).join(', ')}.`}));
    }

    function stopLocalAi(reason='Identificação cancelada.') {
        state.aiWorker?.terminate();state.aiWorker=null;
        if(state.aiWorkerUrl)URL.revokeObjectURL(state.aiWorkerUrl);
        state.aiWorkerUrl=null;
        state.aiRequest?.reject(new Error(reason));state.aiRequest=null;
    }

    function classifyWithLocalAi(text) {
        if (!state.aiWorker) {
            state.aiWorkerUrl=URL.createObjectURL(new Blob([`${configureLocalModelCache.toString()}\n(${localAiWorkerProgram.toString()})()`],{type:'text/javascript'}));
            state.aiWorker=new Worker(state.aiWorkerUrl,{type:'module'});
            state.aiWorker.onmessage=({data})=>{
                const pending=state.aiRequest;if(!pending || data.id!==pending.id)return;
                if(data.progress){setOcrStatus(data.progress,'loading');updateProgress(55,data.progress);return;}
                state.aiRequest=null;
                if(data.error)pending.reject(new Error(data.error));else pending.resolve(data.result);
            };
            state.aiWorker.onerror=event=>stopLocalAi(event.message || 'Não foi possível carregar a IA local.');
        }
        return new Promise((resolve,reject)=>{
            const id=createRequestId();
            const timeout=setTimeout(()=>stopLocalAi('Tempo excedido ao carregar/processar a IA local. Tente novamente.'),240000);
            state.aiRequest={id,resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}};
            state.aiWorker.postMessage({id,text,references:aiDocumentReferences()});
        });
    }

    function combineDocumentEvidence(rule,semantic,text) {
        const enoughText=normalizeLoose(text).replace(/[^a-z]/g,'').length>=40;
        if(!semantic)return {...rule,confidence:Math.min(rule.confidence,.70),autoApply:false,engine:'rules-only',reason:'IA indisponível — revisar'};
        const same=rule.key===semantic.key;
        const ambiguousPersonal=['ged_responsavel','ged_rgcpf'].includes(semantic.key);
        const autoApply=enoughText&&same&&rule.confidence>=.85&&semantic.score>=.35&&semantic.margin>=.045&&!ambiguousPersonal;
        const key=rule.confidence>=.85&&!same?rule.key:semantic.key;
        return {key,confidence:autoApply?.90:.65,autoApply,engine:'local-ai',semanticScore:semantic.score,margin:semantic.margin,alternatives:semantic.alternatives,hits:rule.hits,reason:!enoughText?'Pouco texto — revisar':!same?'IA e palavras-chave divergem — revisar':autoApply?'OCR/texto e IA concordam':'Sugestão da IA — revisar'};
    }

    async function identifyDocumentsOneClick() {
        if(!state.pdfjsDocument||state.processing)return;
        rememberEdit();setBusy(true);state.cancelled=false;
        let autoApplied=0,review=0,failed=0,aiAvailable=true;
        try{
            for(let i=0;i<state.pageModels.length;i++){
                if(state.cancelled)break;
                const model=state.pageModels[i];
                if(model.manual)continue;
                try{
                    updateProgress(10+75*i/state.pageModels.length,`Lendo página ${i+1}/${state.pageModels.length}...`);
                    const text=await readPageTextWithOcr(model);if(state.cancelled)break;
                    model.extractedText=text;
                    const rule=classifyText(text);let semantic=null;
                    if(aiAvailable&&text.trim().length>=20){
                        setOcrStatus(`IA local: analisando página ${i+1}...`,'loading');
                        try{semantic=await classifyWithLocalAi(text);}catch(error){
                            if(state.cancelled)break;
                            aiAvailable=false;stopLocalAi();addLog(`IA local indisponível: ${error.message}. Resultados por palavras-chave exigem revisão.`,'warning');
                        }
                    }
                    model.aiSuggestion=combineDocumentEvidence(rule,semantic,text);
                    if(model.aiSuggestion.autoApply){model.docKey=model.aiSuggestion.key;autoApplied++;}else review++;
                    renderAiSuggestion(model);
                }catch(error){failed++;model.aiSuggestion={key:'arquivo_diversos',confidence:0,autoApply:false,engine:'rules-only',reason:'Leitura falhou — revisar'};addLog(`Página ${i+1}: ${error.message}`,'error');renderAiSuggestion(model);}
                scheduleDraft();await sleep(0);
            }
            invalidateBatch();redrawPages();
            const message=`${autoApplied} página(s) classificada(s), ${review} para revisar, ${failed} falha(s).`;
            updateProgress(state.cancelled?50:70,state.cancelled?'Identificação cancelada. Alterações já concluídas foram mantidas.':message);
            setOcrStatus(aiAvailable?'OCR e IA local prontos.':'IA indisponível; confira as sugestões por palavras-chave.',aiAvailable?'ok':'error');
            addLog(message,failed||review?'warning':'success');
        }finally{setBusy(false);scheduleDraft();}
    }


    async function preloadArchiveSystem() {
        if(!el.autoDetectBtn || !el.app?.isConnected)return;
        const generation=state.bootGeneration=(state.bootGeneration||0)+1;
        document.getElementById(`${APP.id}-loading`)?.remove();
        const overlay=document.createElement('div');overlay.id=`${APP.id}-loading`;
        overlay.style.cssText='position:fixed;inset:0;z-index:2147483500;background:#f3f6fa;display:grid;place-items:center;font:14px Arial;color:#23334b';
        overlay.innerHTML='<section style="width:min(480px,90vw);background:white;border:1px solid #dce3ed;border-radius:18px;padding:32px;box-shadow:0 12px 45px #21334b12"><h1 style="font-size:23px;margin:0 0 8px">Carregando o sistema</h1><p style="color:#66758b">Preparando o Arquivo Digital neste computador.</p><ul style="list-style:none;padding:0;line-height:2.2"><li data-boot="pdf">◌ Leitor de PDF</li><li data-boot="ocr">◌ OCR em português</li><li data-boot="ai">◌ IA local</li></ul><p class="boot-message" role="status" style="font-size:12px;color:#66758b">O primeiro uso baixa o modelo de IA. Os próximos acessos reutilizam o cache disponível.</p><button class="boot-retry" hidden style="padding:10px">Tentar novamente</button><button class="boot-manual" style="padding:10px;margin-top:12px">Continuar com classificação manual</button></section>';
        document.body.append(overlay);overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');el.app.inert=true;setBusy(true);state.cancelled=false;
        const manual=()=>{if(generation!==state.bootGeneration)return;state.bootGeneration++;stopLocalAi();overlay.remove();el.app.inert=false;setBusy(false);setOcrStatus('Pré-carregamento interrompido. Clique em Identificar documentos para tentar novamente.','error');};
        overlay.querySelector('.boot-manual').onclick=manual;
        overlay.querySelector('.boot-retry').onclick=()=>{if(generation===state.bootGeneration)preloadArchiveSystem();};
        const failures=[],completedStages=new Set();
        const stage=async(key,label,work)=>{
            try{await work();if(generation===state.bootGeneration)overlay.querySelector(`[data-boot="${key}"]`).textContent='✓ '+label;return true;}
            catch(error){if(generation===state.bootGeneration){
                const component={pdf:'Leitor de PDF',ocr:'OCR em português',ai:'IA local',index:'Busca de alunos'}[key];
                const message=component+': '+(error.message||String(error));failures.push(message);
                overlay.querySelector(`[data-boot="${key}"]`).textContent='✗ '+message;
                overlay.querySelector('.boot-message').textContent=failures.join(' • ');
                addLog(message,'error');
            }return false;}finally{completedStages.add(key);}
        };
        const progressTimer=setInterval(()=>{
            if(generation!==state.bootGeneration){clearInterval(progressTimer);return;}
            if(!completedStages.has('ai')&&(state.ocrStatus?.includes('Baixando IA')||state.ocrStatus?.includes('Preparando IA')))overlay.querySelector('[data-boot="ai"]').textContent='◌ '+state.ocrStatus;
        },400);
        const tasks=[
            stage('pdf','Leitor de PDF pronto',async()=>{
                if(!window.PDFLib||!window.pdfjsLib)throw new Error('As bibliotecas de PDF não carregaram. Atualize a página.');
                pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const pdf=await PDFLib.PDFDocument.create();pdf.addPage([10,10]);
                const loaded=await pdfjsLib.getDocument({data:await pdf.save()}).promise;await loaded.destroy();
            }),
            stage('ocr','OCR em português pronto',getOcrWorker),
            stage('ai','IA local pronta',()=>classifyWithLocalAi('Preparação da identificação de documentos escolares.'))
        ];
        if(GM_getValue(APP.driveEndpointKey,'')&&GM_getValue(APP.driveTokenKey,'')){
            const row=document.createElement('li');row.dataset.boot='index';row.textContent='◌ Índice de alunos';overlay.querySelector('ul').append(row);
            tasks.push(stage('index','Busca de alunos pronta',async()=>{
                const ping=parseDriveResponse(await drivePostJson({action:'ping'}));
                if(!ping.ok)throw new Error(ping.error || 'Serviço indisponível.');
                state.indexSupported=ping.capabilities?.includes('studentIndex') || false;
                if(state.indexSupported){
                    const key=await searchCacheKey(),index=GM_getValue(key+':index:'+el.archiveRoot.value,null);
                    if(!index||index.expiresAt<=Date.now())await downloadStudentIndex(el.archiveRoot.value);
                }
            }));
        }
        const results=await Promise.all(tasks);
        clearInterval(progressTimer);
        if(generation!==state.bootGeneration)return;
        if(results.every(Boolean)){overlay.remove();el.app.inert=false;setBusy(false);setOcrStatus('PDF, OCR e IA local prontos.','ok');updateProgress(0,'Sistema pronto');}
        else{overlay.querySelector('.boot-retry').hidden=false;overlay.querySelector('.boot-message').textContent=failures.join(' • ')+' — Tente novamente ou continue com classificação manual.';}
    }

    function init() {
        if (state.initialized && document.getElementById(`${APP.id}-app`)) return;
        state.initialized = true;
        state.originalTitle = document.title;

        injectStyles();

        if (ehModoConsulta()) {
            document.title = 'Arquivo Digital — Consulta';
            buildConsultInterface();
            addLog(`Arquivo Digital — Consulta v${APP.version} inicializado.`, 'success');
        } else if (ehModoUpload()) {
            document.title = 'Arquivo Digital — Upload';
            buildUploadInterface();
            queueMicrotask(preloadArchiveSystem);
            addLog(`Arquivo Digital — Upload v${APP.version} inicializado.`, 'success');
            addLog('O upload foi simplificado: consulta e visualização agora ficam em uma ferramenta separada.', 'info');
        }

        console.info(`[Arquivo Digital] v${APP.version} inicializado em ${location.hash}.`);
    }

})();
