// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Arquivo Digital do Aluno
// @namespace    http://tampermonkey.net/
// @version      0.9.1
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
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/arquivo-digital-aluno.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/arquivo-digital-aluno.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @grant        GM_info
// ==/UserScript==

(() => {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '0.9.1',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/arquivo-digital-aluno.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/arquivo-digital-aluno.user.js'
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
            versao: '0.9.0'
        },
        {
            id: 'arquivo-digital-upload',
            titulo: 'Arquivo Digital — Upload',
            url: 'hwmconaluno.aspx#arquivo-digital-upload',
            descricao: 'Digitalizar/importar, classificar e enviar documentos',
            ordem: 31,
            grupo: 'Secretaria',
            grupoOrdem: 10,
            versao: '0.9.0'
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
        version: '0.9.0',
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

    iniciarSeNecessario();
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
                            <strong>Selecione ou arraste um PDF digitalizado</strong>
                            <span class="tiny">Depois classifique as páginas ou use a identificação automática para PDFs que já possuem texto.</span>
                            <div class="row">
                                <button class="primary" id="${APP.id}-choose-pdf">Selecionar PDF</button>
                                <button id="${APP.id}-auto-detect" disabled>🤖 Identificar / OCR</button>
                                <button id="${APP.id}-accept-ai" disabled>Aceitar sugestões ≥ 85%</button>
                            </div>
                            <input type="file" accept="application/pdf,.pdf" id="${APP.id}-pdf" hidden>
                        </div>
                        <div id="${APP.id}-pages" class="pages"></div>
                    </main>

                    <aside class="ad-right" aria-hidden="true">
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
            const file = event.target.files?.[0];
            if (file) await loadSourcePdf(file);
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
            const file = [...(event.dataTransfer?.files || [])].find(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
            if (!file) return alert('Arraste um arquivo PDF válido.');
            await loadSourcePdf(file);
        });

        el.autoDetectBtn.addEventListener('click', autoDetectAllPages);
        el.acceptAiBtn.addEventListener('click', acceptAiSuggestions);
        el.executeBtn.addEventListener('click', executeDestinations);
        el.clearBtn.addEventListener('click', () => clearAll(true));
        el.cancelBtn.addEventListener('click', () => {
            state.cancelled = true;
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

    async function searchStudentInLists() {
        const name = el.studentName.value.trim();
        const birth = parseDateFlexible(el.studentBirth.value.trim());
        const root = el.archiveRoot.value;

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
        el.searchStudentBtn.disabled = true;
        el.searchStudentBtn.textContent = 'Pesquisando...';
        renderStudentLocationStatus(`Consultando ${root} no Google Drive...`, '');

        try {
            const response = await drivePostJson({
                action: 'searchStudents',
                clientVersion: APP.version,
                root,
                query: name,
                birth: birth || '',
                maxResults: singleTermMode ? 150 : 100
            });

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
                `${root}: ${results.length} resultado(s) recebido(s) diretamente do Google Sheets` +
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
            console.error(error);
            renderStudentLocationStatus(`Falha na pesquisa online: ${error.message}`, 'warn');
            addLog(`Pesquisa Google Sheets: ${error.message}`, 'error');
        } finally {
            el.searchStudentBtn.disabled = false;
            el.searchStudentBtn.textContent = oldButtonText;
        }
    }

    function selectStudentMatch(match, automatic) {
        state.selectedStudentMatch = { ...match };
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

    async function loadSourcePdf(file) {
        if (state.processing) return;
        if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
            return alert('Selecione um arquivo PDF.');
        }
        if (file.size > APP.maxPdfSize) {
            return alert(`PDF com ${humanSize(file.size)}. Limite desta versão: ${humanSize(APP.maxPdfSize)}.`);
        }

        try {
            clearPdfOnly();
            state.sourceFile = file;
            state.sourceBytes = new Uint8Array(await file.arrayBuffer());
            if (!el.studentCode.value) el.studentCode.value = inferStudentCode(file.name);

            addLog(`PDF selecionado: ${file.name} (${humanSize(file.size)}).`);
            updateProgress(2, 'Abrindo PDF...');

            if (!window.pdfjsLib) throw new Error('PDF.js não carregado.');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            state.pdfjsDocument = await pdfjsLib.getDocument({ data: state.sourceBytes.slice() }).promise;

            state.pageModels = Array.from({ length: state.pdfjsDocument.numPages }, (_, index) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${index}`,
                originalPage: index + 1,
                docKey: 'ignore',
                rotation: 0,
                thumbnailDataUrl: '',
                extractedText: '',
                aiSuggestion: null,
                ocrUsed: false
            }));

            el.pages.innerHTML = '';
            for (let i = 0; i < state.pageModels.length; i++) {
                if (state.cancelled) break;
                const model = state.pageModels[i];
                updateProgress(5 + ((i + 1) / state.pageModels.length) * 45, `Miniatura ${i + 1}/${state.pageModels.length}`);
                model.thumbnailDataUrl = await renderPageToDataUrl(model.originalPage, model.rotation, APP.thumbnailScale);
                appendPageCard(model);
                await sleep(0);
            }

            updatePageLabels();
            updateSummary();
            updateProgress(50, `${state.pageModels.length} página(s) carregada(s).`);
            atualizarBotoes();
        } catch (error) {
            showError(error, 'Não foi possível abrir o PDF');
            clearPdfOnly();
        }
    }

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
                .map(([key, meta]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
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
                <strong>Posição</strong>
                <span>Original ${model.originalPage}</span>
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
            model.docKey = select.value;
            state.generatedDocuments = [];
            renderGeneratedSummary();
            updateSummary();
            atualizarBotoes();
        });

        card.addEventListener('click', async event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            if (action === 'preview') await previewPage(model);
            if (action === 'rotate') await rotatePage(model, card);
            if (action === 'ignore') {
                model.docKey = 'ignore';
                select.value = 'ignore';
                updateSummary();
                atualizarBotoes();
            }
        });

        card.addEventListener('dragstart', () => {
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
    }

    function updatePageLabels() {
        state.pageModels.forEach((model, index) => {
            const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
            if (card) card.querySelector('.page-head strong').textContent = `Posição ${index + 1}`;
        });
    }

    function reorderPages(sourceId, targetId) {
        if (!sourceId || sourceId === targetId) return;
        const from = state.pageModels.findIndex(p => p.id === sourceId);
        const to = state.pageModels.findIndex(p => p.id === targetId);
        if (from < 0 || to < 0) return;
        const [moved] = state.pageModels.splice(from, 1);
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
        try {
            model.rotation = (model.rotation + 90) % 360;
            model.thumbnailDataUrl = await renderPageToDataUrl(model.originalPage, model.rotation, APP.thumbnailScale);
            card.querySelector('img').src = model.thumbnailDataUrl;
            state.generatedDocuments = [];
            renderGeneratedSummary();
            atualizarBotoes();
        } catch (error) {
            showError(error, 'Erro ao girar página');
        }
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

        if (text.length >= 20) {
            return text;
        }

        const worker = await getOcrWorker();
        const canvas = await renderPageForOcr(model);

        setOcrStatus(`Executando OCR na página ${model.originalPage}...`, 'loading');
        const result = await worker.recognize(canvas);
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

            for (const keyword of meta.keywords || []) {
                const k = normalizeLoose(keyword);
                if (!k) continue;
                if (normalized.includes(k)) {
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

        return { key: best.key, confidence, hits: best.hits.slice(0, 5), points: best.points };
    }

    function renderAiSuggestion(model) {
        const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
        if (!card) return;
        const line = card.querySelector('.ai-line');
        const suggestion = model.aiSuggestion;
        if (!suggestion) {
            line.className = 'ai-line';
            line.textContent = '🤖 Sem análise automática';
            return;
        }

        const meta = DOCUMENT_TYPES[suggestion.key] || DOCUMENT_TYPES.arquivo_diversos;
        const pct = Math.round((suggestion.confidence || 0) * 100);
        line.className = `ai-line ${pct >= 85 ? 'ai-high' : pct >= 60 ? 'ai-mid' : ''}`;
        line.textContent = model.extractedText.trim().length < 20
            ? `${model.ocrUsed ? '🔎 OCR' : '🤖 Texto'}: pouco texto reconhecido`
            : `${model.ocrUsed ? '🔎 OCR' : '🤖 Texto'}: ${meta.short} — ${pct}%${suggestion.hits?.length ? ` • ${suggestion.hits.slice(0, 2).join(', ')}` : ''}`;
    }

    function acceptAiSuggestions() {
        let accepted = 0;
        for (const model of state.pageModels) {
            if (!model.aiSuggestion || model.aiSuggestion.confidence < 0.85) continue;
            model.docKey = model.aiSuggestion.key;
            const card = el.pages.querySelector(`[data-page-id="${CSS.escape(model.id)}"]`);
            if (card) card.querySelector('.page-select').value = model.docKey;
            accepted++;
        }
        state.generatedDocuments = [];
        renderGeneratedSummary();
        updateSummary();
        atualizarBotoes();
        addLog(`${accepted} sugestão(ões) com confiança ≥ 85% aplicada(s).`, 'success');
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
                if (rotation) copiedPage.setRotation(PDFLib.degrees(rotation));
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
                </div>
            `;
        }).join('');
    }

    /* =====================================================================
     * 10. DESTINOS
     * ===================================================================== */

    async function executeDestinations() {
        if (state.processing) return;

        const useGed = el.destGed.checked;
        const useLocal = el.destLocal.checked;
        const useDrive = el.destDrive.checked;
        if (!useGed && !useLocal && !useDrive) return alert('Selecione pelo menos um destino.');

        const selectedPages = state.pageModels.filter(p => p.docKey !== 'ignore');
        if (!state.sourceBytes || !selectedPages.length) return alert('Carregue o PDF e classifique ao menos uma página.');

        const student = getStudentMeta();
        if (!student.name && !student.code) return alert('Informe ao menos o nome ou o código do aluno.');

        const selectedHasGedTypes = selectedPages.some(p => Number.isInteger(DOCUMENT_TYPES[p.docKey]?.gedId));
        if (useGed && selectedHasGedTypes && !/^\d+$/.test(student.code)) {
            return alert('Para enviar documentos ao GED, informe um código SIGEDUCA numérico. Alunos históricos podem usar apenas Computador/Drive.');
        }

        setBusy(true);
        state.cancelled = false;

        try {
            updateProgress(66, 'Gerando os documentos necessários para os destinos...');
            await generateGroupedDocuments();

            if (useLocal) {
                updateProgress(86, 'Gerando PDF único para o computador...');
                await saveLocalSinglePdf();
            }

            if (useGed) {
                updateProgress(90, 'Enviando documentos compatíveis ao GED...');
                await startGedUpload();
            }

            if (useDrive) {
                updateProgress(96, 'Enviando ao Google Drive...');
                await saveToDriveEndpoint();
            }

            updateProgress(100, 'Processo concluído.');
            addLog('Geração e salvamento nos destinos concluídos.', 'success');
        } catch (error) {
            showError(error, 'Falha ao processar destinos');
        } finally {
            setBusy(false);
            renderGeneratedSummary();
            atualizarBotoes();
        }
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
            if (rotation) copiedPage.setRotation(PDFLib.degrees(rotation));
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

        for (const doc of state.generatedDocuments) doc.statusLocal = '✓ PC — PDF único';
        addLog(`PDF único salvo no computador: ${filename} (${selectedPages.length} pág., ${humanSize(blob.size)}).`, 'success');
        renderGeneratedSummary();
    }

    /* =====================================================================
     * 11. UPLOAD DO GED — REAPROVEITADO DO MÓDULO ORIGINAL
     * ===================================================================== */

    async function startGedUpload() {
        const student = getStudentMeta();
        const docs = state.generatedDocuments.filter(d => Number.isInteger(d.gedId));
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
                await uploadDocumentToGed(iframe, doc);
                doc.statusGed = '✓ GED';
            } catch (error) {
                doc.statusGed = '✗ GED';
                doc.message = error.message;
                addLog(`${doc.shortName} / GED: ${error.message}`, 'error');
            }

            renderGeneratedSummary();
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
            throw new Error(`Documento GED ${generated.gedId} já cadastrado${existing.filename ? ` como “${existing.filename}”` : ''}.`);
        }

        if (generated.file.size > APP.maxGeneratedFileSize) {
            addLog(`${generated.shortName}: ${humanSize(generated.file.size)}, acima do limite de 5 MB do GED. Tentando mesmo assim.`, 'warning');
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

        const currentToken = GM_getValue(APP.driveTokenKey, '');
        const token = prompt(
            'Cole a CHAVE DE ACESSO (API_TOKEN) definida no Google Apps Script.\n\nEla funciona como senha do Arquivo Digital.',
            currentToken
        );
        if (token === null) return;

        GM_setValue(APP.driveEndpointKey, endpoint.trim());
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
            throw new Error(`Resposta inválida do Drive: ${String(response.responseText || '').slice(0, 250)}`);
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

        for (let i = 0; i < state.generatedDocuments.length; i++) {
            if (state.cancelled) throw new Error('Cancelado pelo usuário.');

            const doc = state.generatedDocuments[i];
            updateProgress(
                96 + ((i + 1) / state.generatedDocuments.length) * 3,
                `Drive: ${doc.shortName} (${i + 1}/${state.generatedDocuments.length})`
            );

            const uploadResponse = await drivePostJson({
                action: 'uploadDocument',
                clientVersion: APP.version,
                folderId,
                student: studentPayload(student),
                document: {
                    docKey: doc.docKey,
                    docName: doc.docName,
                    filename: doc.file.name,
                    mimeType: 'application/pdf',
                    base64: await fileToBase64(doc.file)
                }
            });

            const uploadData = parseDriveResponse(uploadResponse);
            if (!uploadData.ok) {
                doc.statusDrive = '✗ Drive';
                renderGeneratedSummary();
                throw new Error(uploadData.error || `Erro ao enviar ${doc.shortName}.`);
            }

            doc.statusDrive = '✓ Drive';
            renderGeneratedSummary();
        }

        const warning = ensureData.warning ? ` Aviso: ${ensureData.warning}` : '';
        addLog(`Drive: ${state.generatedDocuments.length} documento(s) enviado(s).${warning}`, 'success');
    }

    function drivePostJson(data) {
        const endpoint = GM_getValue(APP.driveEndpointKey, '').trim();
        const token = GM_getValue(APP.driveTokenKey, '').trim();

        if (!endpoint) throw new Error('Endpoint do Google Drive não configurado.');
        if (!token) throw new Error('Chave de acesso do Google Drive não configurada.');

        return gmPostJson(endpoint, {
            ...data,
            token
        });
    }

    function gmPostJson(url, data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                data: JSON.stringify(data),
                timeout: 180_000,
                onload: response => {
                    if (response.status >= 200 && response.status < 400) resolve(response);
                    else reject(new Error(`Endpoint HTTP ${response.status}: ${response.responseText || response.statusText}`));
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
        state.pdfjsDocument = null;
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
        addLog('Tela limpa.');
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
            addLog(`Arquivo Digital — Upload v${APP.version} inicializado.`, 'success');
            addLog('O upload foi simplificado: consulta e visualização agora ficam em uma ferramenta separada.', 'info');
        }

        console.info(`[Arquivo Digital] v${APP.version} inicializado em ${location.hash}.`);
    }

})();
