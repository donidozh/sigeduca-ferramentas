// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Lançador de Históricos
// @namespace    http://tampermonkey.net/
// @version      5.0.2
// @description  Módulo Ferramentas para lançar históricos escolares diretamente no SIGEDUCA com GUI integrada.
// @author       Jhonatan Aquino; adaptação modular Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      servicodados.ibge.gov.br
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/lancador-historicos.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/lancador-historicos.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @grant        GM_info
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '5.0.2',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/lancador-historicos.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/lancador-historicos.user.js'
    });

    // =====================================================================
    // ARQUITETURA MODULAR - MENU FERRAMENTAS
    // =====================================================================

    const LAH_MOD_FLAG = '__SIGEDUCA_LANCADOR_HISTORICOS_MODULAR_V5_0_1__';
    if (window[LAH_MOD_FLAG]) return;
    window[LAH_MOD_FLAG] = true;

    const LAH_EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const LAH_EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const LAH_EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';
    const LAH_HASH_FERRAMENTA = '#lancador-historicos';

    const LAH_FERRAMENTA = Object.freeze({
        id: 'lancador-historicos',
        titulo: 'Lançador de Históricos',
        url: `hwmgedhistorico.aspx?0${LAH_HASH_FERRAMENTA}`,
        descricao: 'Lançamento assistido de Histórico Escolar',
        ordem: 40,
        grupo: ''
    });

    function lahRegistrarNoMenuFerramentas() {
        window.dispatchEvent(new CustomEvent(LAH_EVENTO_REGISTRAR, {
            detail: { ...LAH_FERRAMENTA, ...ATUALIZACAO_SCRIPT }
        }));
    }

    window.addEventListener(LAH_EVENTO_SOLICITAR, lahRegistrarNoMenuFerramentas);
    window.addEventListener(LAH_EVENTO_BASE_PRONTA, lahRegistrarNoMenuFerramentas);
    lahRegistrarNoMenuFerramentas();
    setTimeout(lahRegistrarNoMenuFerramentas, 100);

    const LAH_PAGINA_HISTORICO = /\/ged\/hwmgedhistorico\.aspx$/i.test(location.pathname);
    const LAH_MODO_FERRAMENTA = LAH_PAGINA_HISTORICO && location.hash.toLowerCase() === LAH_HASH_FERRAMENTA;

    // Analisador de Dependências e Lançador de Históricos usam a mesma tela.
    // Ao trocar apenas o hash o navegador não recarrega o DOM; por isso o
    // módulo força um reload somente quando sua própria rota é selecionada.
    if (LAH_PAGINA_HISTORICO) {
        window.addEventListener('hashchange', () => {
            if (location.hash.toLowerCase() === LAH_HASH_FERRAMENTA) {
                location.reload();
            }
        });
    }

    // Fora da rota da ferramenta o script apenas se registra no menu modular.
    if (!LAH_MODO_FERRAMENTA) return;

// Sistema de Log melhorado
class LogManager {
    constructor() {
        this.queue = [];
        this.isDisplaying = false;
        this.lastMessage = '';
        this.lastMessageTime = 0;
    }

    init() {
        this.divLog = document.getElementById('divlog');
        if (!this.divLog) {
            console.warn('Elemento divlog não encontrado, criando...');
            this.divLog = document.createElement('div');
            this.divLog.id = 'divlog';
            this.divLog.className = 'divlog';
            // Adiciona estilos para preservar quebras de linha
            this.divLog.style.cssText = `
                white-space: pre-line;
                word-wrap: break-word;
                overflow-wrap: break-word;
                line-height: 1.5;
                padding: 10px;
                text-align: left;
            `;
            document.body.appendChild(this.divLog);
        }
    }

    async addLog(mensagem, tempo = 3000, cor = '#087eff') {
        if (!this.divLog) {
            this.init();
        }

        const now = Date.now();
        if (this.lastMessage === mensagem && (now - this.lastMessageTime) < 2000) {
            return;
        }

        this.lastMessage = mensagem;
        this.lastMessageTime = now;
        this.queue.push({ mensagem, tempo, cor });

        if (!this.isDisplaying) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (!this.divLog) {
            this.init();
        }

        if (this.queue.length === 0) {
            this.isDisplaying = false;
            return;
        }

        this.isDisplaying = true;
        const { mensagem, tempo, cor } = this.queue.shift();

        this.divLog.style.display = 'block';
        this.divLog.style.color = cor;
        // Usa textContent e substitui \n por <br> para garantir quebras de linha
        this.divLog.textContent = mensagem;

        await new Promise(resolve => setTimeout(resolve, tempo));
        this.divLog.style.display = 'none';

        await new Promise(resolve => setTimeout(resolve, 300));
        this.processQueue();
    }
}

// Criar instância do LogManager
const logManager = new LogManager();

// Função auxiliar de exibição de log
function exibirLog(mensagem, tempo = 3000, cor = '#087eff') {
    if (logManager) {
        logManager.addLog(mensagem, tempo, cor);
    } else {
        console.warn('LogManager não está disponível');
    }
}


// Adiciona estilos personalizados
(function() {
	var style = document.createElement('style');
	style.type = 'text/css';
	style.innerHTML = `
        /* Estilos base e reset */

        #containerLAH{
            background:rgba(237, 237, 237, 0.55);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
            backdrop-filter: blur(6.6px);
            -webkit-backdrop-filter: blur(6.6px);
            border:1px solid rgba(214, 214, 214, 0.47);
            border-radius: 20px;
            color: #293254;
            width: auto;
            text-align: center;
            font-weight: bold;
            position: fixed;
            z-index: 2002;
            padding: 15px;
            bottom: 33px;
            right: 30px;
            height: auto;
            min-width: 350px;
        }
        #containerLAH * {
            font-family: "SF Pro Text","SF Pro Icons","Helvetica Neue","Helvetica","Arial",sans-serif !important;
        }


        #containerLAH a {
            color: #666 !important;
        }
 #containerLAH .divseletor {
            padding: 0;
            text-align: center;
            min-width: 460px;
        }

           /* Estilos do botão de exibir */
        #exibirLAH {
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(20px);
            font-weight: 500;
            letter-spacing: 0.3px;
            padding: 5px 15px;
        }
        /* Estilo base do botão LAH */
            #containerLAH .botaoSCT {
                background: #ebebeb;
                backdrop-filter: blur(6px);
                border-radius: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.25);
                color: #087eff;
                font-size: 13px;
                font-weight: normal;
                padding: 9px 20px;
                min-width: 124.5px;
                margin: 5px;
                text-decoration: none;
                transition: all 0.15s ease-in-out;
            }

             #containerLAH .msgsim, #containerLAH  #btnCarregarDados {
            background: #3982f7;
            color: #fff;
            border: none;
        }

        #containerLAH .msgsim:hover, #containerLAH  #btnCarregarDados:hover{
            background: #3982f7;
            opacity: 0.9;
            transform: scale(1.02);
        }


            /* Hover padrão */
            #containerLAH .botaoSCT:hover {
                background: #3982f7;
                transform: scale(1.02);
                color: #fff;
            }

            /* Botão de sucesso */
            #containerLAH .btninserido {
                background: #34A568;  /* Aumentei opacidade para mais consistência */
                color: #fff !important;  /* Mudei para branco para maior consistência */
                border: none;
            }

            #containerLAH .btninserido:hover {
                background: rgba(84, 210, 105, 1);
                transform: scale(1.02);
            }
        /* Estilos das divisões */
        #containerLAH .divseletor h3 {
            font-size: 28px !important;
            font-weight: 500 !important;
            margin-bottom: 15px;
            color: #1d1d1f;
            letter-spacing: -0.5px;
        }

        #containerLAH .divbotoes {
            max-height: 600px;
            overflow: hidden;
            line-height: 20px;
        }

        #containerLAH .divajuda {
            display: none;
            max-width: 460px;
            max-height: 700px;
            overflow: hidden;
            line-height: 20px;
            font-size: 11px;
            font-weight: normal;
            text-align: justify;
        }

        #containerLAH .divcarregando {
            overflow: hidden;
            display: none;
        }

        #containerLAH .divlog {
            background: rgba(244, 244, 244, 0.58);
            border-radius: 16px;
            box-shadow: 0 5px 10px rgba(0, 0, 0, 0);
            backdrop-filter: blur(6.6px);
            -webkit-backdrop-filter: blur(6.6px);
            border: 1px solid rgba(214, 214, 214, 0.27);
            color: #087eff;
            width: auto;
            text-align: center;
            position: absolute;
            z-index: 2002;
            padding: 5px;
            top: -5px;
            min-height: 25px;
            min-width: 340px;
            font-size: 14px;
            font-weight: normal;
            line-height: 25px;
            white-space: pre-line;
            display: none;
            margin-left: -10px;
            transform: translateY(-100%);
        }

        /* Estados de altura */
        #containerLAH .open {
            max-height: 500px;
        }

        #containerLAH .closed {
            max-height: 0px;
        }

        /* Estilos de loading */
        #containerLAH #loadingGif {
            width: 100px;
        }

        #containerLAH #loadingBtn {
            position: relative;
            padding: 25px 20px;
            font-size: 14px;
            background: none;
            color: #087dff;
            cursor: pointer;
            border-radius: 5px;
            overflow: hidden;
            border: none;
        }

        #containerLAH #loadingBtn.loading {
            color: #087dff;
            pointer-events: none;
        }

        #containerLAH #loadingBtn.loading::after {
            content: "";
            position: absolute;
            width: 56px;
            height: 56px;
            border: 3px solid #087dff;
            border-top-color: transparent;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation: spin 1.8s linear infinite;
        }

        /* Estilos SVG */
        #containerLAH svg:hover path {
            fill: #087dff !important;
        }

        /* Estilos de mensagem */
        #containerLAH .mensagem {
            display: none;
            padding: 18.5px;
            border-radius: 15px;
            background: rgba(255, 255, 255, 0.3);
            margin-bottom: -20px;
        }

        #containerLAH .msgcancela {
            background: none;
            box-shadow: none;
            border-color: #ddd;
            color: #d94839;
        }

        #containerLAH .msgcancela:hover {
            background: #f26865;
        }

        /* Animações */
        @keyframes spin {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
  `;
	document.head.appendChild(style);
})();

// Matriz interna consumida pelo motor de lançamento
var Mxhistorico = [];

// Adiciona no início do script, após as declarações de variáveis globais
var permissoesHistorico = new Map();

// Adiciona funções para manipular cookies (MOVER PARA ANTES DA CRIAÇÃO DO BOTÃO)
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// A interface sempre inicia minimizada e abre em tela cheia quando solicitada.
var lahGuiAberta = true;

function lahDefinirEstadoGui(aberta, semAnimacao = false) {
    lahGuiAberta = Boolean(aberta);
    const painel = document.getElementById('containerLAH');
    if (!painel) return;

    if (semAnimacao) painel.classList.add('lah-no-transition');
    painel.classList.toggle('lah-panel-open', lahGuiAberta);
    painel.classList.toggle('lah-panel-closed', !lahGuiAberta);
    painel.setAttribute('aria-hidden', String(!lahGuiAberta));
    btnExibir.value = lahGuiAberta ? 'MINIMIZAR' : 'MAXIMIZAR | Lançador de históricos';
    document.documentElement.classList.toggle('lah-gui-aberta', lahGuiAberta);

    if (semAnimacao) {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                painel.classList.remove('lah-no-transition');
            });
        });
    }
}

// Cria o botão para exibir ou minimizar a caixa de conteúdo.
var btnExibir = document.createElement('input');
btnExibir.type = 'button';
btnExibir.id = 'exibirLAH';
btnExibir.value = lahGuiAberta ? 'MINIMIZAR' : 'MAXIMIZAR | Lançador de históricos';
btnExibir.className = 'menuSCT';
btnExibir.style = `
  background: #293254;
  color: #ffffff;
  font-size: 12px;
  border:none;
  height: 30px;
  position: fixed;
  z-index: 2010;
  bottom: 1px;
  left: 16px;
  cursor: pointer;
  transition: background-color 0.1s ease-in-out;
  border-radius:15px;
`;
btnExibir.onmouseover = () => btnExibir.style.backgroundColor = '#3982F7';
btnExibir.onmouseout = () => btnExibir.style.backgroundColor = '#293254';
btnExibir.onclick = function() {
    lahDefinirEstadoGui(!lahGuiAberta);
    setCookie('containerLAHState', lahGuiAberta, 30);
};

document.body.appendChild(btnExibir);

// Cria a caixa de conteúdo
var divCredit = document.createElement('div');
divCredit.id = 'containerLAH';
divCredit.className = 'menuSCT';

document.body.appendChild(divCredit);
window.setTimeout(() => lahDefinirEstadoGui(lahGuiAberta, true), 0);

// Interface integrada: substitui a etapa de copiar/colar dados da planilha.
divCredit.innerHTML = `
<style id="lah-gui-integrada-css">
    html.lah-gui-aberta,
    html.lah-gui-aberta body {
        overflow: hidden !important;
    }
    #exibirLAH {
        left: 16px !important;
        right: auto !important;
        bottom: 12px !important;
        z-index: 2010 !important;
        min-width: 116px;
        padding: 0 14px;
    }
    #containerLAH {
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        max-height: none !important;
        overflow: auto;
        overflow-anchor: none;
        padding: 0;
        background: #eef2f7;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        color: #172033;
        text-align: left;
        opacity: 1;
        visibility: visible;
        clip-path: inset(0 round 0);
        transition:
            opacity .28s ease,
            clip-path .46s cubic-bezier(.22, .8, .2, 1),
            visibility 0s linear 0s;
    }
    #containerLAH.lah-panel-closed {
        opacity: 0;
        visibility: hidden;
        clip-path: inset(90% 86% 0 0 round 18px);
        pointer-events: none;
        transition:
            opacity .24s ease,
            clip-path .42s cubic-bezier(.4, 0, 1, 1),
            visibility 0s linear .42s;
    }
    #containerLAH.lah-panel-open {
        opacity: 1;
        visibility: visible;
        clip-path: inset(0 round 0);
        pointer-events: auto;
    }
    #containerLAH.lah-modal-open {
        overflow: hidden;
    }
    #containerLAH.lah-no-transition {
        transition: none !important;
    }
    #containerLAH .divseletor {
        min-width: 0;
        min-height: 100vh;
        padding: 24px clamp(20px, 4vw, 64px) 32px;
        text-align: left;
    }
    #containerLAH .lah-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
    }
    #containerLAH .lah-header h2 {
        margin: 0 0 4px;
        color: #18213a;
        font-size: 22px;
        line-height: 1.15;
    }
    #containerLAH .lah-header p,
    #containerLAH .lah-muted {
        margin: 0;
        color: #64748b;
        font-size: 12px;
        font-weight: 400;
    }
    #containerLAH .lah-badge {
        flex: 0 0 auto;
        border: 1px solid #bfdbfe;
        border-radius: 999px;
        padding: 5px 9px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
    }
    #containerLAH label {
        display: grid;
        gap: 5px;
        color: #475569;
        font-size: 11px;
        font-weight: 700;
    }
    #containerLAH input,
    #containerLAH select,
    #containerLAH textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 36px;
        border: 1px solid #cbd5e1;
        border-radius: 9px;
        padding: 8px 10px;
        background: #fff;
        color: #172033;
        font-size: 13px;
        font-weight: 400;
        outline: none;
    }
    #containerLAH input:focus,
    #containerLAH select:focus,
    #containerLAH textarea:focus {
        border-color: #3982f7;
        box-shadow: 0 0 0 3px rgba(57, 130, 247, .13);
    }
    #containerLAH textarea {
        min-height: 68px;
        resize: vertical;
    }
    #containerLAH .lah-student {
        display: grid;
        grid-template-columns: minmax(160px, 220px) 1fr;
        align-items: end;
        gap: 12px;
        padding: 13px;
        border: 1px solid #dbe3ef;
        border-radius: 12px;
        background: #fff;
    }
    #containerLAH .lah-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 14px 0;
    }
    #containerLAH .lah-settings {
        position: relative;
    }
    #containerLAH .lah-settings-menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 40;
        display: grid;
        gap: 5px;
        min-width: 180px;
        border: 1px solid #cbd5e1;
        border-radius: 11px;
        padding: 7px;
        background: #fff;
        box-shadow: 0 14px 32px rgba(15, 23, 42, .18);
    }
    #containerLAH .lah-settings-menu[hidden] {
        display: none;
    }
    #containerLAH .lah-settings-menu button {
        width: 100%;
        text-align: left;
    }
    #containerLAH button,
    #containerLAH .lah-button {
        min-height: 34px;
        border: 1px solid #cbd5e1;
        border-radius: 9px;
        padding: 7px 11px;
        background: #fff;
        color: #334155;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
    }
    #containerLAH button:hover,
    #containerLAH .lah-button:hover {
        border-color: #93c5fd;
        background: #eff6ff;
        color: #1d4ed8;
    }
    #containerLAH .lah-primary {
        border-color: #3982f7;
        background: #3982f7;
        color: #fff;
    }
    #containerLAH .lah-primary:hover {
        background: #2563eb;
        color: #fff;
    }
    #containerLAH .lah-danger {
        color: #b91c1c;
    }
    #containerLAH .lah-year-card {
        margin: 10px 0;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 13px;
        background: #fff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, .05);
        transition: border-color .24s ease, box-shadow .24s ease, transform .24s ease;
    }
    #containerLAH .lah-year-card.is-active {
        border-color: #93c5fd;
        box-shadow: 0 8px 24px rgba(37, 99, 235, .10);
    }
    #containerLAH .lah-year-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px 8px 14px;
        background: #d9e0e8;
        transition: background-color .24s ease;
    }
    #containerLAH .lah-year-card.is-active .lah-year-head {
        background: #f8fafc;
    }
    #containerLAH .lah-year-toggle {
        display: flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
        border: 0;
        padding: 4px 8px 4px 0;
        background: transparent;
        text-align: left;
    }
    #containerLAH .lah-year-toggle:hover {
        border: 0;
        background: transparent;
        color: inherit;
    }
    #containerLAH .lah-expand-label {
        flex: 0 0 auto;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
    }
    #containerLAH .lah-year-title {
        display: grid;
        gap: 2px;
    }
    #containerLAH .lah-year-title strong {
        color: #1e293b;
        font-size: 14px;
    }
    #containerLAH .lah-year-actions {
        display: flex;
        flex: 0 0 auto;
        gap: 6px;
    }
    #containerLAH .lah-year-collapse {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transition: grid-template-rows .32s ease, opacity .24s ease;
    }
    #containerLAH .lah-year-card.is-active .lah-year-collapse {
        grid-template-rows: 1fr;
        opacity: 1;
    }
    #containerLAH .lah-year-collapse-inner {
        min-height: 0;
        overflow: hidden;
    }
    #containerLAH .lah-year-body {
        display: grid;
        gap: 14px;
        padding: 18px;
    }
    #containerLAH .lah-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 10px;
    }
    #containerLAH .lah-col-2 { grid-column: span 2; }
    #containerLAH .lah-col-3 { grid-column: span 3; }
    #containerLAH .lah-col-4 { grid-column: span 4; }
    #containerLAH .lah-col-5 { grid-column: span 5; }
    #containerLAH .lah-col-6 { grid-column: span 6; }
    #containerLAH .lah-col-7 { grid-column: span 7; }
    #containerLAH .lah-col-8 { grid-column: span 8; }
    #containerLAH .lah-col-12 { grid-column: span 12; }
    #containerLAH .lah-subsection {
        display: grid;
        gap: 10px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
    }
    #containerLAH .lah-subsection-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }
    #containerLAH .lah-subsection-head h4 {
        margin: 0;
        font-size: 13px;
        color: #334155;
    }
    #containerLAH .lah-table-wrap {
        overflow-x: auto;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
    }
    #containerLAH .lah-disc-table {
        width: 100%;
        min-width: 820px;
        border-collapse: collapse;
    }
    #containerLAH .lah-disc-table th {
        padding: 7px;
        background: #f8fafc;
        color: #64748b;
        font-size: 10px;
        text-align: left;
    }
    #containerLAH .lah-disc-table td {
        padding: 6px;
        border-top: 1px solid #eef2f7;
        vertical-align: middle;
    }
    #containerLAH .lah-disc-table input {
        min-height: 32px;
        padding: 6px 7px;
        font-size: 11px;
    }
    #containerLAH .lah-readonly {
        background: #f8fafc;
        color: #334155;
        cursor: default;
    }
    #containerLAH .lah-search-discipline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: 100%;
        white-space: nowrap;
    }
    #containerLAH .lah-search-discipline.is-search {
        border-color: #93c5fd;
        background: #eff6ff;
        color: #1d4ed8;
    }
    #containerLAH .lah-search-discipline.is-search:hover {
        border-color: #60a5fa;
        background: #dbeafe;
        color: #1d4ed8;
    }
    #containerLAH .lah-search-discipline.is-change {
        background: #fff;
        color: #334155;
    }
    #containerLAH .lah-discipline-actions {
        display: grid;
        gap: 6px;
        min-width: 132px;
    }
    #containerLAH .lah-discipline-actions > button {
        width: 100%;
    }
    #containerLAH .lah-icon-button {
        min-width: 32px;
        padding: 5px 7px;
    }
    #containerLAH .lah-row-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    #containerLAH .lah-favorite-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        min-width: 42px;
        min-height: 42px;
        padding: 0;
        color: #a16207;
        font-size: 24px;
        line-height: 1;
    }
    #containerLAH .lah-favorite-button.is-favorite {
        border-color: #facc15;
        background: #fefce8;
        color: #ca8a04;
    }
    #containerLAH .lah-favorite-button:disabled {
        cursor: not-allowed;
        opacity: .42;
    }
    #containerLAH .lah-remove-disc {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: auto;
        min-width: 104px;
        min-height: 42px;
        padding: 0 12px 0 9px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        border-color: #fecaca;
        background: #fef2f2;
        color: #b91c1c;
    }
    #containerLAH .lah-remove-disc:hover {
        border-color: #fca5a5;
        background: #fee2e2;
        color: #991b1b;
    }
    #containerLAH .lah-remove-disc .lah-remove-x {
        font-size: 28px;
        font-weight: 400;
        line-height: 1;
    }
    #containerLAH .lah-add-discipline-wrap {
        display: flex;
        justify-content: flex-start;
        padding-top: 2px;
    }
    #containerLAH .lah-add-discipline {
        border-color: #86efac;
        background: #ecfdf5;
        color: #15803d;
    }
    #containerLAH .lah-add-discipline:hover {
        border-color: #4ade80;
        background: #dcfce7;
        color: #166534;
    }
    #containerLAH .lah-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2200;
        display: grid;
        place-items: center;
        padding: 28px;
        background: rgba(15, 23, 42, .58);
        backdrop-filter: blur(4px);
    }
    #containerLAH .lah-modal-backdrop[hidden] {
        display: none;
    }
    #containerLAH .lah-modal {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        width: min(820px, calc(100vw - 48px));
        height: min(720px, calc(100vh - 56px));
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 24px 70px rgba(15, 23, 42, .34);
    }
    #containerLAH .lah-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        border-bottom: 1px solid #e2e8f0;
    }
    #containerLAH .lah-modal-head h3 {
        margin: 0;
        color: #1e293b;
        font-size: 18px;
    }
    #containerLAH .lah-modal-search {
        padding: 14px 18px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
    }
    #containerLAH .lah-search-results {
        overflow: auto;
        padding: 10px;
    }
    #containerLAH .lah-search-summary {
        padding: 8px 10px;
        color: #64748b;
        font-size: 11px;
        font-weight: 500;
    }
    #containerLAH .lah-search-suggestions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        padding: 2px 6px 8px;
    }
    #containerLAH .lah-search-suggestions .lah-search-result-row {
        margin: 0;
    }
    #containerLAH .lah-search-suggestions .lah-search-result {
        margin: 0;
        border-color: #e2e8f0;
        background: #f8fafc;
    }
    #containerLAH .lah-search-result {
        display: grid;
        gap: 3px;
        width: 100%;
        margin: 4px 0;
        padding: 11px 13px;
        border: 1px solid transparent;
        background: #fff;
        text-align: left;
    }
    #containerLAH .lah-search-result-row {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        align-items: stretch;
        gap: 6px;
        margin: 4px 0;
    }
    #containerLAH .lah-search-result-row .lah-search-result {
        margin: 0;
    }
    #containerLAH .lah-search-favorite {
        min-width: 42px;
        min-height: 42px;
        padding: 0;
        color: #a16207;
        font-size: 23px;
        line-height: 1;
    }
    #containerLAH .lah-search-favorite.is-favorite {
        border-color: #facc15;
        background: #fefce8;
        color: #ca8a04;
    }
    #containerLAH .lah-search-result:hover {
        border-color: #bfdbfe;
        background: #eff6ff;
    }
    #containerLAH .lah-search-result strong {
        color: #1e293b;
        font-size: 13px;
    }
    #containerLAH .lah-search-result small {
        color: #64748b;
        font-size: 11px;
        font-weight: 500;
    }
    #containerLAH .lah-municipio-picker {
        position: relative;
        display: block;
    }
    #containerLAH .lah-municipio-results {
        position: absolute;
        top: calc(100% + 5px);
        right: 0;
        left: 0;
        z-index: 30;
        max-height: 260px;
        overflow: auto;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 5px;
        background: #fff;
        box-shadow: 0 14px 32px rgba(15, 23, 42, .18);
    }
    #containerLAH .lah-municipio-results[hidden] {
        display: none;
    }
    #containerLAH .lah-municipio-option {
        display: grid;
        gap: 2px;
        width: 100%;
        margin: 2px 0;
        padding: 9px 10px;
        border-color: transparent;
        text-align: left;
    }
    #containerLAH .lah-municipio-option strong {
        color: #1e293b;
        font-size: 12px;
    }
    #containerLAH .lah-municipio-option small {
        color: #64748b;
        font-size: 10px;
        font-weight: 500;
    }
    #containerLAH .lah-validation {
        display: none;
        margin: 12px 0;
        border: 1px solid #fecaca;
        border-radius: 10px;
        padding: 10px 12px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 12px;
        font-weight: 500;
        white-space: pre-line;
    }
    #containerLAH .lah-validation.is-visible { display: block; }
    #containerLAH .lah-footer-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
    }
    #containerLAH .lah-status {
        color: #64748b;
        font-size: 11px;
        font-weight: 400;
    }
    #containerLAH .divbotoes,
    #containerLAH .divajuda {
        max-width: none;
        max-height: none;
        padding: 20px;
        overflow: auto;
        text-align: left;
    }
    #containerLAH .divcarregando {
        padding: 30px;
        text-align: center;
    }
    #containerLAH .btnscontrole {
        position: sticky;
        top: 8px;
        z-index: 5;
        display: none;
        margin: 8px;
    }
    @media (max-width: 760px) {
        #containerLAH .lah-grid { grid-template-columns: 1fr; }
        #containerLAH .lah-grid > * { grid-column: 1 !important; }
        #containerLAH .lah-student { grid-template-columns: 1fr; }
        #containerLAH .lah-year-head { align-items: flex-start; }
        #containerLAH .lah-year-actions { flex-direction: column; }
        #containerLAH .lah-modal-backdrop { padding: 12px; }
        #containerLAH .lah-modal {
            width: calc(100vw - 24px);
            height: calc(100vh - 24px);
        }
        #containerLAH .lah-search-suggestions { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
        #containerLAH,
        #containerLAH .lah-year-card,
        #containerLAH .lah-year-head,
        #containerLAH .lah-year-collapse,
        #containerLAH .lah-expand-label {
            transition-duration: .01ms !important;
        }
    }
</style>
<div class="divlog" id="divlog"></div>
<button type="button" class="btnscontrole" id="btnvoltar">← Voltar ao editor</button>
<button type="button" class="btnscontrole" id="btnatualizar">↻ Atualizar lista</button>

<section class="divseletor" id="lahEditor">
    <div class="lah-header">
        <div>
            <h2>Lançador de Histórico GED</h2>
            <p>Preencha os dados do histórico escolar nos campos abaixo.</p>
        </div>
        <span class="lah-badge">Módulo Ferramentas · versão 5.0</span>
    </div>

    <div class="lah-student">
        <label>
            Código do aluno
            <input id="lahStudentCode" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Ex.: 9999999">
        </label>
        <div>
            <div id="lahStudentHint" class="lah-muted">O código pode ser preenchido automaticamente a partir da tela.</div>
        </div>
    </div>

    <div class="lah-toolbar">
        <button type="button" class="lah-primary" id="lahAddYear">+ Adicionar ano</button>
        <button type="button" id="lahSaveDraft">Salvar rascunho</button>
        <div class="lah-settings">
            <button type="button" id="lahSettingsToggle" aria-expanded="false">Configurações</button>
            <div class="lah-settings-menu" id="lahSettingsMenu" hidden>
                <button type="button" id="lahExportDraft">Exportar JSON</button>
                <button type="button" id="lahImportDraft">Importar JSON</button>
            </div>
        </div>
        <button type="button" class="btnajuda" id="btnajuda">Ajuda</button>
        <button type="button" class="lah-danger" id="lahClearDraft">Limpar tudo</button>
    </div>

    <input type="file" id="lahImportFile" accept="application/json,.json" hidden>

    <div id="lahYears"></div>
    <div id="lahValidation" class="lah-validation" role="alert"></div>

    <div class="lah-footer-actions">
        <span id="lahDraftStatus" class="lah-status">Rascunho local</span>
        <button type="button" id="btnCarregarDados" class="lah-primary">Lançar Histórico</button>
    </div>
</section>

<div class="lah-modal-backdrop" id="lahDisciplineModal" hidden>
    <section class="lah-modal" role="dialog" aria-modal="true" aria-labelledby="lahDisciplineModalTitle">
        <header class="lah-modal-head">
            <div>
                <h3 id="lahDisciplineModalTitle">Pesquisar disciplina</h3>
                <p class="lah-muted">A busca ignora acentos, cedilha e diferenças entre maiúsculas e minúsculas.</p>
            </div>
            <button type="button" class="lah-icon-button" id="lahDisciplineClose" aria-label="Fechar pesquisa">×</button>
        </header>
        <div class="lah-modal-search">
            <input id="lahDisciplineSearch" autocomplete="off" placeholder="Ex.: matema, português, educacao fisica">
        </div>
        <div class="lah-search-results" id="lahDisciplineResults"></div>
    </section>
</div>

<section class="divcarregando">
    <p style="font-size:20px;margin:0 0 8px;">Aguarde</p>
    <p style="font-weight:400;margin:0;">Inserindo o histórico no SIGEDUCA…</p>
    <button id="loadingBtn" type="button">0%</button>
</section>

<section class="divbotoes" style="display:none"></section>

<section class="divajuda">
    <h3 style="font-size:18px;text-align:center;">Como usar</h3>
    <p><b>1.</b> Informe o código do aluno e adicione um cartão para cada ano do histórico.</p>
    <p><b>2.</b> Escolha a etapa e depois a série. Os códigos usados pelo GED ficam internos e não precisam ser digitados.</p>
    <p><b>3.</b> Escolha o município pelo nome e pesquise as disciplinas. A pesquisa consulta o catálogo completo, ignora acentos e preenche automaticamente a área de conhecimento.</p>
    <p><b>4.</b> Clique em <b>Lançar Histórico</b>, revise os anos encontrados no SIGEDUCA e escolha qual deseja inserir.</p>
    <p><b>Segurança:</b> o rascunho fica somente no armazenamento local do Tampermonkey. A exportação JSON serve para backup e não é enviada a terceiros.</p>
</section>
`;

// Cria o iframe
var ifrIframe1 = document.createElement("iframe");
ifrIframe1.setAttribute("id", "iframe1");
ifrIframe1.setAttribute("src", "about:blank");
ifrIframe1.setAttribute("style", "height: 700px; width: 1000px; display:none; bottom:30px; left:30px");
divCredit.appendChild(ifrIframe1);

var ifrIframe2 = document.createElement("iframe");
ifrIframe2.setAttribute("id", "iframe2");
ifrIframe2.setAttribute("src", "about:blank");
ifrIframe2.setAttribute("style", "height: 700px; width: 1000px; display:none; bottom:30px; left:30px");
divCredit.appendChild(ifrIframe2);

// Eventos da interface integrada
document.getElementById('btnCarregarDados').addEventListener('click', prepararHistoricosDaGUI);
document.getElementById('btnatualizar').addEventListener('click', prepararHistoricosDaGUI);
document.getElementById('btnvoltar').addEventListener('click', voltar);
document.getElementById('btnajuda').addEventListener('click', ajuda);

document.getElementById('vGEDALUCOD')?.addEventListener('focus', function(){$('.credito').slideUp(500, 'swing');});

window.setTimeout(inicializarGuiIntegrada, 0);

function voltar() {
    lahRenderizarEditor();
    lahMostrarErros([]);
    // Oculta os botões e controles e exibe o seletor novamente
    setTimeout(() => {$('.divbotoes').slideUp(500, 'swing');}, 100);
    $('.btnscontrole').fadeOut(500);
    $('.divseletor').slideDown(500, 'swing');
    $('.divcarregando').slideUp(500, 'swing');
    $('.divajuda').slideUp(500, 'swing');
    $('#btnajuda').fadeIn(500);

    document.getElementById("loadingBtn").innerText = "0%";
}
function ajuda() {
    // Oculta os botões e controles e exibe o seletor novamente
    setTimeout(() => {$('.divbotoes').slideUp(500, 'swing');}, 100);
    $('.divajuda').slideDown(500, 'swing');
    $('.btnajuda').fadeOut(500);
    $('#btnatualizar').fadeOut(500);
    $('.divseletor').slideUp(500, 'swing');
    $('.divcarregando').slideUp(500, 'swing');
    $('#btnvoltar').slideDown(500, 'swing');
}


// Estado e catálogos da GUI integrada.
const LAH_DRAFT_KEY = 'lah.gui.draft.v1';
const LAH_MUNICIPIOS_KEY = 'lah.gui.municipios.v1';
const LAH_FAVORITOS_KEY = 'lah.gui.favoritos.v1';
const LAH_DRAFT_VERSION = 1;
const LAH_SERIES = {
    fundamental: [
        { codigo: '1756', nome: '1º Ano Ens. Fundamental' },
        { codigo: '1757', nome: '2º Ano Ens. Fundamental' },
        { codigo: '1758', nome: '3º Ano Ens. Fundamental' },
        { codigo: '1759', nome: '4º Ano Ens. Fundamental' },
        { codigo: '1760', nome: '5º Ano Ens. Fundamental' },
        { codigo: '1761', nome: '6º Ano Ens. Fundamental' },
        { codigo: '1762', nome: '7º Ano Ens. Fundamental' },
        { codigo: '1763', nome: '8º Ano Ens. Fundamental' },
        { codigo: '1764', nome: '9º Ano Ens. Fundamental' }
    ],
    medio: [
        { codigo: '9', nome: '1º Ano Ens. Médio' },
        { codigo: '10', nome: '2º Ano Ens. Médio' },
        { codigo: '11', nome: '3º Ano Ens. Médio' }
    ]
};
const LAH_SERIES_LABELS = Object.fromEntries(
    Object.values(LAH_SERIES).flat().map(item => [item.codigo, item.nome])
);

// Catálogos incorporados no userscript; não há consulta à planilha em tempo de uso.
const LAH_DISCIPLINAS = [{"nivel":"fundamental","codigo":"7","nome":"ARTE","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"8","nome":"EDUCAÇÃO FÍSICA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"16","nome":"L.E.M.(INGLÊS)","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"17","nome":"LINGUA PORTUGUESA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"21","nome":"EDUCAÇÃO ARTISTICA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"24","nome":"L.ESTRANG (INGLÊS)","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"26","nome":"L.ESTRANG (ESPANHOL)","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"74","nome":"L.E.M.(ESPANHOL)","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"97","nome":"LITERATURA BRASILEIRA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"106","nome":"LÍNGUA ESTRANGEIRA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"168","nome":"TÉCNICA DE REDAÇÃO","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"289","nome":"LÍNGUA MATERNA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"554","nome":"LINGUAGEM","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"13723","nome":"LINGUAGEM DE PROGRAMAÇÃO I","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"13744","nome":"LINGUAGENS","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"13803","nome":"LIBRAS","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"13857","nome":"LIBRAS","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"15829","nome":"LEITURA E P. TEXTUAL","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"16661","nome":"RECREAÇÃO E JOGOS ÉTNICOS","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"16662","nome":"LINGUÍSTICA INDIGENA","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"29983","nome":"TÓPICO DE LÍNGUA ESTRANGEIRA MODERNA ESPANHOL","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"30135","nome":"LINGUA BRASILEIRA DE SINAIS - LIBRAS","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"30226","nome":"EDUCAÇÃO FÍSICA/XADREZ","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"30227","nome":"FORMAÇÃO CRISTÃ","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"30235","nome":"ESPANHOL 1","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"30523","nome":"LÍNGUA PORTUGUESA/LAB. APRENDIZAGEM","areaCodigo":"442","areaNome":"LINGUAGENS"},{"nivel":"fundamental","codigo":"3","nome":"HISTÓRIA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"4","nome":"GEOGRAFIA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"13","nome":"FILOSOFIA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"19","nome":"SOCIOLOGIA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"22","nome":"ENSINO RELIGIOSO","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"23","nome":"EDUCAÇÃO RELIGIOSA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"1430","nome":"ANTROPOLOGIA","areaCodigo":"567","areaNome":"CIENCIAS HUMANAS"},{"nivel":"fundamental","codigo":"5","nome":"MATEMÁTICA","areaCodigo":"568","areaNome":"MATEMÁTICA"},{"nivel":"fundamental","codigo":"30524","nome":"MATEMÁTICA/LAB. APRENDIZAGEM","areaCodigo":"568","areaNome":"MATEMÁTICA"},{"nivel":"fundamental","codigo":"14","nome":"BIOLOGIA","areaCodigo":"569","areaNome":"CIÊNCIAS DA NATUREZA"},{"nivel":"fundamental","codigo":"15","nome":"FÍSICA","areaCodigo":"569","areaNome":"CIÊNCIAS DA NATUREZA"},{"nivel":"fundamental","codigo":"18","nome":"QUÍMICA","areaCodigo":"569","areaNome":"CIÊNCIAS DA NATUREZA"},{"nivel":"fundamental","codigo":"16560","nome":"CIÊNCIAS DA NATUREZA","areaCodigo":"569","areaNome":"CIÊNCIAS DA NATUREZA"},{"nivel":"fundamental","codigo":"2","nome":"CIENCIAS NATURAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"3","nome":"HISTÓRIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"4","nome":"GEOGRAFIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"5","nome":"MATEMÁTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"7","nome":"ARTE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"8","nome":"EDUCAÇÃO FÍSICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"12","nome":"ENSINO RELIGIOSO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"13","nome":"FILOSOFIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"14","nome":"BIOLOGIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15","nome":"FÍSICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16","nome":"L.E.M.(INGLÊS)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17","nome":"LINGUA PORTUGUESA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"18","nome":"QUÍMICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"19","nome":"SOCIOLOGIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"20","nome":"CIÊNCIAS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"21","nome":"EDUCAÇÃO ARTISTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"22","nome":"ENSINO RELIGIOSO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"27","nome":"ESTUDOS SOCIAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"28","nome":"CIÊNCIAS E PROGRAMAS DE SAÚDE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"29","nome":"PORTUGUES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"44","nome":"EDUCAÇÃO MORAL E CÍVICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"47","nome":"CIÊNCIAS E PROGRAMA DE SAÚDE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"52","nome":"PROGRAMAS DE SAÚDE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"82","nome":"PROGRAMA DE SAÚDE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"86","nome":"LITERATURA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"97","nome":"LITERATURA BRASILEIRA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"123","nome":"CIÊNCIAS SOCIAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"179","nome":"PRATICAS ZOOTECNICAS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"212","nome":"ESPANHOL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"218","nome":"ARTES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"225","nome":"BASE NACIONAL COMUM","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"312","nome":"DIREITO E LEGISLAÇÃO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"313","nome":"CONTABILIDADE GERAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"354","nome":"RECREAÇÃO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"398","nome":"EDUCAÇÃO ARTÍSTICA/ARTES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"430","nome":"INGLÊS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"516","nome":"ESTÁGIO SUPERVISIONADO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"517","nome":"CONTABILIDADE BANCÁRIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"518","nome":"CONTABILIDADE COMERCIAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"565","nome":"ECONOMIA E MERCADO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"567","nome":"ORGAN. E TEC. COMERCIAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"569","nome":"ESTRUTURA E ANALISE DE BALANÇO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"864","nome":"CALIGRAFIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"984","nome":"GESTÃO DE PESSOAS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1141","nome":"CONTABILIDADE PUBLICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1205","nome":"ELEMENTOS DE CUSTOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1209","nome":"CONTABILIDADE GERENCIAL E DE CUSTOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1214","nome":"CONT. AGRÍC E INDUSTRIAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1482","nome":"ÉTICA PROFISSIONAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1649","nome":"C.F.B.","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"1925","nome":"PORTUGUÊS/LITERATURA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"2315","nome":"DATILOGRAFIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"4124","nome":"METODOLOGIA E PROC. DADOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"13721","nome":"CURRICULO POR ATIVIDADES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"13728","nome":"CIENCIAS.F.B.P.SAUDE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"13746","nome":"TEMAS TRANSVERSAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15470","nome":"HISTÓRIA DO MUNICIPIO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15810","nome":"EMPREENDEDORISMO E ÉTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15813","nome":"NOÇÕES GERAIS DE ESCRITÓRIO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15814","nome":"TRABALHOS EM MADEIRA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15836","nome":"ORIENTAÇÃO HUMANA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15893","nome":"RACIOCINIO LÓGICO-MATEMÁTICO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15894","nome":"SÓCIO-HISTORICA E CULTURAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15895","nome":"NATUREZA , AMBIENTE E O PROPRIO CORPO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15896","nome":"ARTE E MOVIMENTO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15899","nome":"LÍNGUA PORTUGUESA E ARTES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15900","nome":"LIT. PROD. TEXTO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15901","nome":"EST. BARRAGARCENSSE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15955","nome":"HISTÓRIA DE GOIANA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"15957","nome":"MUNDO DO TRABALHO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16023","nome":"TRABALHO DE CONCLUSÃO DE CURSO - TCC","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16046","nome":"ARTES (ARTES PLÁSTICA)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16047","nome":"ARTES MÚSICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16378","nome":"EST. DA HIST. E DA GEOG","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16428","nome":"MEDIA GLOBAL FINAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16511","nome":"EDUCAÇÃO PARA A PAZ","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16559","nome":"L.E.M-(INGLÊS/ESPANHOL)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16568","nome":"GESTÃO DE NEGÓCIOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16585","nome":"METODOS E TECNICAS DE PESQUISA I","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16634","nome":"PRODUÇÃO E FRUIÇÃO DE ARTES","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"16648","nome":"TÓPICOS DE FÍSICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17739","nome":"TÓPICOS DE QUÍMICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17751","nome":"DESPORTO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17752","nome":"OFICINA DE TEMÁTICA BÁSICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17753","nome":"CIÊNCIA EXPERIMENTAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17754","nome":"TÓPICOS DE BIOLOGIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"17779","nome":"ARTE LITERÁRIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"19797","nome":"ESTUDO DA ARTE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"19798","nome":"ENSINO DE HISTORIA E GEOGRAFIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30226","nome":"EDUCAÇÃO FÍSICA/XADREZ","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30227","nome":"FORMAÇÃO CRISTÃ","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30228","nome":"OFICINA TECNOLÓGICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30255","nome":"OPERAÇÕES DE MATEMÁTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30256","nome":"GRAMÁTICA INTERPRETAÇÃO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30257","nome":"PRATICANDO MATEMÁTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30258","nome":"LINGUA/LITERATURA ESTRANGEIRA INGLÊS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30259","nome":"ELETIVA DE INFORMÁTICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30260","nome":"ELETIVA DE EXP. QUÍMICOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30261","nome":"ORIENTAÇÃO DE ESTUDOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30263","nome":"ESCOLA DA INTELIGÊNCIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30283","nome":"INTRODUÇÃO A SISTEMAS OPERACIONAIS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30284","nome":"SEGURANÇA DA INFORMAÇÃO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30290","nome":"ELETIVA II","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30291","nome":"ELETIVA III","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30292","nome":"PORTUGUÊS INSTRUMENTAL","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30293","nome":"SOCIEDADE E MEIO AMBIENTE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30294","nome":"NUTRIÇÃO ANIMAL E FORRAGICULTURA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30295","nome":"INVESTIGAÇÃO CIENTÍFICA E TECNOLÓGICA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30296","nome":"LEGISLAÇÃO APLICADA A NEGÓCIOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30297","nome":"PRÁTICAS ADMINISTRATIVAS E RECURSOS HUMANOS","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30298","nome":"NOÇÃO BÁSICA DE AGRICULTURA E ZOOTECNIA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30315","nome":"PINTURA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30316","nome":"CIRANDA","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30322","nome":"MATEMÁTICA/COMPL. MAT","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30323","nome":"CIÊNCIAS/COMPL. CIÊN","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30325","nome":"DIREITOS E DEVERES DO CIDADÃO","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30326","nome":"MÍDIA E SOCIEDADE","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30334","nome":"ARTES II","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30335","nome":"ARTES III","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30336","nome":"ARTES IV","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30337","nome":"CIÊNCIAS II","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30338","nome":"CIÊNCIAS III","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30339","nome":"EDUCAÇÃO FÍSICA III (JUDÔ)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30340","nome":"EDUCAÇÃO FÍSICA IV","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30341","nome":"PORTUGUÊS I (EL/PT)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30342","nome":"PORTUGUÊS II (MTDIC)","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30345","nome":"HIST.GEO./MT","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"30358","nome":"ECONOMIA SOLIDÁRIA FAMILIAR</option","areaCodigo":"30","areaNome":"BASE NACIONAL COMUM"},{"nivel":"fundamental","codigo":"5","nome":"MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"8","nome":"EDUCAÇÃO FÍSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"27","nome":"ESTUDOS SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"33","nome":"LINGUA ESTRANGEIRA MODERNA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"46","nome":"ENSINO POR ATIVIDADES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"63","nome":"LITERATURA BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"70","nome":"PRATICA INT. DO LAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"71","nome":"EDUCAÇÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"72","nome":"CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"79","nome":"ARTES VISUAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"84","nome":"INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"85","nome":"PSICOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"92","nome":"EMPREENDEDORISMO/AGRONEGÓCIO E ECONIMIA AGROINDUST","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"95","nome":"GEOGRAFIA REGIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"97","nome":"LITERATURA BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"99","nome":"REDAÇÃO E EXPRESSÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"106","nome":"LÍNGUA ESTRANGEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"108","nome":"INTRODUÇÃO A INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"119","nome":"PRATICAS AGRICOLAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"121","nome":"PRÁTICA INDUSTRIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"122","nome":"PRÁTICA COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"124","nome":"MUSICALIZAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"129","nome":"MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"130","nome":"ÉTICA E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"133","nome":"GEOMETRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"136","nome":"PRATICA LAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"137","nome":"TÉCNICAS COMERCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"139","nome":"PROP RURAL E SUSTENTABILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"140","nome":"CONHECIMENTOS GERAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"141","nome":"TECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"146","nome":"DESENHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"148","nome":"INICIAÇÃO A AGRICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"155","nome":"PSICOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"156","nome":"EDUCAÇÃO MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"157","nome":"POLIVALÊNCIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"160","nome":"RECREAÇÃO E JOGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"174","nome":"EMPREENDEDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"178","nome":"ESPORTES E RECREAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"179","nome":"PRATICAS ZOOTECNICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"185","nome":"DESENHO GEOMETRICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"196","nome":"LABORATÓRIO DE REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"199","nome":"ENSINO DA ARTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"200","nome":"COOPERATIVISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"202","nome":"EDUCAÇÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"204","nome":"TEATRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"205","nome":"DANÇA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"209","nome":"INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"211","nome":"INFORMÁTICA BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"239","nome":"PARTE DIVERSIFICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"240","nome":"PRÁTICA AGRICOLAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"241","nome":"EDUCAÇÃO TECNOLÓGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"260","nome":"CULTURA GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"267","nome":"ARTIGO  7º","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"271","nome":"AGROINDÚSTRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"272","nome":"AGRICULTURA III","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"275","nome":"ZOOTECNIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"276","nome":"AGRICULTURA IV","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"278","nome":"MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"288","nome":"EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"291","nome":"LABORATÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"312","nome":"DIREITO E LEGISLAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"313","nome":"CONTABILIDADE GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"319","nome":"TÉCNICAS AGRÍCOLAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"323","nome":"ESTUDOS AMAZÔNICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"325","nome":"PRODUÇÃO DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"329","nome":"MATEMATICA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"337","nome":"ESTUDOS REGIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"339","nome":"INFORMATICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"354","nome":"RECREAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"358","nome":"TÉC. ZOOTÉCNICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"362","nome":"INFORMATICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"366","nome":"COM. E EXP.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"382","nome":"FUND. METOD. E PESQ. PROJETO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"390","nome":"CBAI","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"392","nome":"LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"398","nome":"EDUCAÇÃO ARTÍSTICA/ARTES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"400","nome":"CBAC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"412","nome":"ATUALIDADES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"422","nome":"TÉCNICAS DE REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"423","nome":"FUNDAMENTO EM PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"427","nome":"HISTÓRIA DO PARANÁ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"438","nome":"GEOGRAFIA DO ESTADO DE RONDÔNIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"439","nome":"HISTÓRIA DO ESTADO DE RONDÔNIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"446","nome":"EDUCAÇÃO MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"448","nome":"EDUCAÇÃO PARA O TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"455","nome":"INTRODUÇÃO À INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"456","nome":"QUALIDADE DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"464","nome":"AGRIMENSURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"465","nome":"ADM. E CONTROLE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"466","nome":"MECANOGRAFIA E PROC.DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"469","nome":"ADMINISTRAÇÃO E CONTROLE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"472","nome":"LÍNGUA PÁTRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"474","nome":"PROJETOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"485","nome":"RELAÇÕES HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"500","nome":"CULTURA BAIANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"511","nome":"XADREZ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"516","nome":"ESTÁGIO SUPERVISIONADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"517","nome":"CONTABILIDADE BANCÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"518","nome":"CONTABILIDADE COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"521","nome":"EDUCAÇÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"523","nome":"TURISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"529","nome":"HORTA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"532","nome":"LABORATORIO DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"539","nome":"DIDATICA GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"540","nome":"DIDÁTICA DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"548","nome":"MATEMÁTICA BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"552","nome":"ORIENTAÇÃO EDUCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"554","nome":"LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"565","nome":"ECONOMIA E MERCADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"573","nome":"DIDÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"615","nome":"CONHECIMENTO LINGUISTICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"622","nome":"ARTES INDUSTRIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"648","nome":"LITERATURA INFANTO JUVENIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"678","nome":"AGRICULTURA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"699","nome":"REDACÃO COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"720","nome":"CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"791","nome":"HORTICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"845","nome":"ENSINO GLOBALIZADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"906","nome":"AGRICULTURA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"916","nome":"OFICINA DE CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"960","nome":"AGRICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"984","nome":"GESTÃO DE PESSOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"995","nome":"MATERIAL DE PROTESE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1012","nome":"EDUCAÇÃO PARA O TRÂNSITO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1020","nome":"A. E. ESCULTURA DENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1026","nome":"DESENHO TÉCNICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1031","nome":"EDUCAÇAO DO LAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1042","nome":"CONHECIMENTO LINGUISTICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1046","nome":"CONTABILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1048","nome":"EXPRESSÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1051","nome":"ESTÁGIO 01","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1054","nome":"MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1061","nome":"TÉCNICA DE ALFABETIZAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1071","nome":"MATEMATICA FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1072","nome":"ARITMÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1074","nome":"TOPOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1080","nome":"ECONOMIA DOMÉSTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1086","nome":"SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1089","nome":"LITERATURA E REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1096","nome":"EDUCAÇÃO SEXUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1103","nome":"LINGUA PORTUGUESA REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1127","nome":"ARTES PLÁSTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1135","nome":"PRÁTICA DE LABORATÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1139","nome":"CONTABILIDADE DE CUSTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1141","nome":"CONTABILIDADE PUBLICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1147","nome":"LITERATURA INFANTIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1154","nome":"CIENCIAS PROGRAMA DE SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1216","nome":"DIREITO APLICADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1220","nome":"MERCADOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1234","nome":"INFORMÁTICA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1235","nome":"MATERIAIS DE CONSTRUÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1236","nome":"DESENHO ARQUITETONICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1242","nome":"RELAÇÕES INTERPESSOAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1250","nome":"GEOGRAFIA ECONOMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1258","nome":"GRAMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1270","nome":"PROJETO INTERDISCIPLINAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1306","nome":"FUNDAMENTOS DA COMPUTAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1309","nome":"HISTÓRIA REGIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1332","nome":"INFORMATICA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1380","nome":"INTRODUÇÃO A ECONOMIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1383","nome":"INC. ÀS CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1388","nome":"ECOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1412","nome":"OLERICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1420","nome":"ARTES CÊNICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1425","nome":"SOLOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1430","nome":"ANTROPOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1438","nome":"MEIO AMBIENTE E DESENVOLVIMENTO DE TECNOLOGIAS SUS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1441","nome":"LÍNGUA PORTUGUESA E LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1452","nome":"CAPOEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1453","nome":"JOGOS INTELECTIVOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1458","nome":"ASSOCIATIVISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1461","nome":"SUPORTE PEDAGOGICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1462","nome":"FORMAÇÃO PARA CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1463","nome":"ARTES PLÁSTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1470","nome":"ALIMENTAÇÃO ANIMAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1471","nome":"AVICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1472","nome":"DESENHO E TOPOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1482","nome":"ÉTICA PROFISSIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1489","nome":"INTEGRAÇÃO SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1495","nome":"IDENTIDADE E AUTONOMIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1521","nome":"METODOLOGIA CIENTÍFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1530","nome":"LÍNGUA ESTRANGEIRA INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1550","nome":"ARTESANATO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1552","nome":"OPERADOR DE MICROCOMPUTADOR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1555","nome":"REDES DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1560","nome":"TEORIA ECONÔMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1561","nome":"NOÇÕES DE DIREITO E LEGISLAÇÃO SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1566","nome":"ALGORITMOS E LÓGICA DE PROG.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1568","nome":"SISTEMAS OPERACIONAIS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1574","nome":"LABORATÓRIO DE INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1577","nome":"LINGUA ESTRANGEIRA MODERNA INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1580","nome":"BIOQUÍMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1582","nome":"INGLÊS INSTRUMENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1584","nome":"FILOSOFIA E SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1586","nome":"PROJETOS ESPECIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1594","nome":"GEOGRAFIA DO PIAUI","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1602","nome":"CULINARIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1605","nome":"HISTÓRIA ECONÔMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1635","nome":"LINGUAGEM ORAL E ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1643","nome":"BIOLOGIA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1656","nome":"FRUTICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1657","nome":"CONTABILIDADE E CUSTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1665","nome":"METODOLOGIA INICIACAO PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1671","nome":"BIOLOGIA CELULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1674","nome":"ZOOTECNIA III","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1675","nome":"ZOOTECNIA IV","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1703","nome":"ZOOTECNIA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1709","nome":"SOCIEDADE E CULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1720","nome":"INICIAÇÃO A INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1724","nome":"INFORMÁTICA EDUCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1738","nome":"CIÊNCIAS DA VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1746","nome":"CRIAÇÃO DE ANIMAIS DE PEQUENO PORTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1748","nome":"EXTENSÃO RURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1749","nome":"PLANEJAMENTO AGROPECUARIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1752","nome":"LINGUA XAVANTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1766","nome":"PRÁTICA DE ENSINO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1768","nome":"HISTÓRIA DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1769","nome":"METODOLOGIA DO ENSINO DA ARTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1771","nome":"METODOLOGIA DO ENSINO DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1772","nome":"METODOLOGIA DO ENSINO DE PORTUGUÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1785","nome":"AGROECOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1794","nome":"GEOGRAFIA E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1798","nome":"CIÊNCIAS SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1802","nome":"LEITURA E PRODUÇÃO DE TEXTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1835","nome":"ADM. RURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1836","nome":"EDUCAÇÃO FAMILIAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1837","nome":"ZOOTECNIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1843","nome":"GESTÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1846","nome":"CIENCIAS SAUDE E EDUCAÇÃO SEXUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1849","nome":"HISTORIA E CULTURA AFRO BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1862","nome":"SOCIOLOGIA DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1868","nome":"LINGUAG. DE PROG. ESTRUTURADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1869","nome":"SISTEMAS OPERACIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1878","nome":"GEOGRAFIA DO PARANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1892","nome":"GEOGRAFIA E GEOGRAFIA DE MATO GROSSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1893","nome":"HISTÓRIA E HISTÓRIA DE MATO GROSSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1925","nome":"PORTUGUÊS/LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1940","nome":"ECOL. AGROTÓXICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1961","nome":"HIDROLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1963","nome":"OFICINA DE TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1967","nome":"ESTUDOS PARAENSES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"1984","nome":"ENSINO DA HISTÓRIA E GEOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2026","nome":"EDUCAÇÃO PARA CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2049","nome":"DIDÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2069","nome":"INICIAÇÃO À METODOLOGIA CIENTIFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2161","nome":"ARTES E COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2173","nome":"LINGUA PORTUGUESA/LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2197","nome":"NOÇÕES DE FILOSOFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2207","nome":"MATEMATICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2208","nome":"MATEMATICA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2267","nome":"SOCIEDADE E CULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2277","nome":"PARECER DESCRITIVO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2315","nome":"DATILOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2335","nome":"ESTATÍSTICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2336","nome":"PEC LINGUAGEM E CODIGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2340","nome":"LINGUAGENS E CODIGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2347","nome":"AGROECOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2372","nome":"EDUCAÇÃO PARA PAZ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2373","nome":"LINGUAGEM DE PROGRAMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2378","nome":"PROJETO INTERDISCIPLINAR 2","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2379","nome":"PROJETO INTERDISCIPLINAR 3","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2380","nome":"BIOLOGIA/PROGRAMA DE SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2381","nome":"JOGOS E RECREAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2382","nome":"CIÊNCIAS, SAUDE E EDUCAÇÃO SEXUAL.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2439","nome":"INTRODUÇÃO À ADMINISTRAÇÃO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2445","nome":"LEGISLAÇÃO E TRIBUTAÇÃO EM LOGISTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2449","nome":"AULAS PRÁTICAS E TCC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2451","nome":"TEORIA GERAL DA ADMINISTRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2453","nome":"MONTAGEM DE MANUTENÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2625","nome":"ECOSSISTEMAS E POLUIÇÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2627","nome":"LEGISLAÇÃO E POLÍTICAS AMBIENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2629","nome":"CLIMATOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2631","nome":"INTRODUÇÃO AOS SISTEMAS DE GERECIAMENTO DE BANCO DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2632","nome":"LITERATURA PORTUGUESA BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2633","nome":"ORIENTAÇÃO VOCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"2990","nome":"ESTUDOS MATOGROSSENSE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3194","nome":"INTRODUÇÃO À ADMINISTRAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3196","nome":"GESTAO EMPREENDEDORA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3205","nome":"LINGUAGEM DE PROGRAMAÇÃO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3207","nome":"ANALISE DE SISTEMAS ORIENTADA A OBJETOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3208","nome":"FUNDAMENTOS DE REDES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3209","nome":"INTRODUÇÃO A BANCO DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3210","nome":"LINGUAGEM E PROGRAMAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3213","nome":"INTRODUÇÃO À ADMINISTRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3341","nome":"FOLCLORE ALAGOANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3362","nome":"LEITURA DE PRODUÇÃO DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3440","nome":"GEOECOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3468","nome":"REDAÇÃO E PRODUÇÃO DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3469","nome":"ESTUDO BARRAGARCENSE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3475","nome":"ARQUITETURA E MONTAGEM DE COMP","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3476","nome":"EXTRATIVISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3479","nome":"ANÁLISE DE SISTEMAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3480","nome":"BANCO DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3482","nome":"ALGORITMO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3488","nome":"ALGORITIMOS E LÓGICA DE PROG","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3489","nome":"AULAS PRÁTICAS E TCC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3490","nome":"EXPRESSAO ARTISTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3492","nome":"ATIVIDADES LUDICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3493","nome":"INICIAÇÃO CIENTÍFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3495","nome":"DESENVOLVIMENTO INTERPESSOAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3496","nome":"CUNICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3497","nome":"TECNOLOGIA DA INFORMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3498","nome":"MANEJO DA FERTILIDADE E FISICA DO SOLO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3500","nome":"PISCICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3501","nome":"PROCESSAMENTO DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3502","nome":"CULTURA DE CEREAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3504","nome":"MANEJO E CONSERVAÇÃO DO SOLO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3505","nome":"MECANIZAÇÃO AGRICOLA APLICAÇÃO DE DEFENSIVOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3506","nome":"PLANTAS MEDICINAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3507","nome":"PLANTAS SACARINAS E SUCULENTAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3508","nome":"PROJETOS EMPRESARIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3509","nome":"SUINOCULTURA/OVINOCULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3510","nome":"PEC CIÊNCIA DA NATUREZA E MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3514","nome":"LABORATÓRIO DE CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3515","nome":"LABORATÓRIO DE LINGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3516","nome":"INCENTIVO AS ATIVIDADES FILOSÓFICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3521","nome":"JUDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3522","nome":"JUDO E CAPOEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3523","nome":"EXPRESSÃO CORPORAL E MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3524","nome":"ARTE E CULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3535","nome":"ADMINISTRAÇÃO E PROJETOS EMPRESARIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3537","nome":"MECANIZAÇÃO AGRICOLA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3538","nome":"SUINOCULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3539","nome":"FORMAÇÃO ÉTICA E CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3542","nome":"CURRICULO INTEGRADO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3543","nome":"CURRICULO INTEGRADO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3544","nome":"PSICOLOGIA APLICADA AO ENSINO MEDIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3546","nome":"CIENCIAS BIOLOGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3547","nome":"ESTUDO DA CULTURA REGIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3548","nome":"MOVIMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3549","nome":"NATUREZA E SOCIEDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3551","nome":"PESQUISA MULTIDISCIPLINAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3554","nome":"LEM (INGLÊS)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3555","nome":"LEM (ESPANHOL)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3558","nome":"TECNICO EDUCAÇAO FISICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3559","nome":"OFICINA DE GEOMETRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3560","nome":"QUALIDADE DE VIDA ATRAVES DA CIENCIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3564","nome":"MICRO-INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3565","nome":"LINGUA INDIGINA CARAJÁ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3566","nome":"ESTUDOS NA SOCIEDADE E NATUREZA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3568","nome":"FUNDAMENTOS BIOLOGICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3569","nome":"ENS. GLOBALIZADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3570","nome":"CIDAD. E. ED. P/ O TRANSITO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3571","nome":"PRAT. COMERCIAIS E TRIBUTARIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3579","nome":"INSTITUIÇÃO DE DIREITO PUBLICO E PRIVADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3583","nome":"ANTROPOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3879","nome":"FILOSOFIA DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3880","nome":"PSICOLOGIA DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3881","nome":"BIOLOGIA EDUCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3882","nome":"ESTRUTURA E FUNCIONAMENTO ENS. 1º GRAU","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3883","nome":"METODOLOGIA DO ENSINO DE PORTUGUÊS E ALFABETIZAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3884","nome":"METODOLOGIA DO ENSINO DE HISTÓRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3885","nome":"METODOLOGIA DO ENSINO DE GEOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3886","nome":"METODOLOGIA DO ENSINO DE CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3887","nome":"METODOLOGIA DO ENSINO DE EDUCAÇÃO FISICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3888","nome":"METODOLOGIA ENSINO DA ARTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3889","nome":"INTRODUÇÃO À METODOLOGIA CIENTIFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"3890","nome":"FUNDAMENTO DA EDUCAÇÃO PRÉ-ESCOLAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4081","nome":"CICLO BASICO DE ALFABETIZAÇÃO CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4083","nome":"CIENCIAS E TECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4084","nome":"HISTÓRIA DA ARTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4087","nome":"HISTORIA DE ALAGOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4088","nome":"PSICOMOTRICIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4089","nome":"INFORMÁTICA EDUCATIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4090","nome":"ESTUDOS AMBIENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4091","nome":"DIDATICA DA LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4092","nome":"NOÇOES BASICAS DE AGROECOLOGIA E ZOOTECNIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4093","nome":"LIT ANALISE P TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4094","nome":"INTERAÇAO ESCOLA FAMILIA PROJETOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4095","nome":"LABORATORIO DE LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4096","nome":"ARTES MARCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4104","nome":"METODOLOGIA GLOBALIZADA INTERDISCIPLINAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4105","nome":"ENSINO RELIGIOSO/EDUCAÇÃO RELIGIOSA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4106","nome":"COM.EXP./C.E.L/PORT./L.PORT","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4107","nome":"INICIAIS C/C. P.S/C.F.B./CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4108","nome":"ORGANIZAÇÃO E NORMAS DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4109","nome":"DANÇA E EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4110","nome":"INICIAÇÃO MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4111","nome":"HISTÓRIA DA CULTURA PERNAMBUCANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4112","nome":"CONHECIMENTO SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4113","nome":"CONHECIMENTO MATEMATICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4114","nome":"CONHECIMENTO NATURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4115","nome":"BIOLOGIA AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4116","nome":"DIMENSÃO HUMANA E CONTEMPORÂNEA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4117","nome":"EDUCAÇÃO E TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4123","nome":"CULTURA BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4125","nome":"LINGUAGENS DE CODIGOS DIGITAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"4126","nome":"EDUCAÇÃO PREVENTIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"6168","nome":"MANIPULAÇÃO DE IMAGENS E DESIGN","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"12563","nome":"PROCESSOS ADMINISTRATIVOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"12564","nome":"EQUIPAMENTOS DE AUTOMAÇÃO E PROCESSADOR DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"12565","nome":"HABILIDADES SOCIAIS DE TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"12566","nome":"INTRODUÇÃO À COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"12579","nome":"ORGANIZAÇÃO DE EVENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13389","nome":"METODOS, TECNICAS DE PESQUISA - MTP*","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13391","nome":"METODOS, TECNICAS DE PESQUISA - MTPII","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13491","nome":"SISTEMAS OPERACIONAIS AVANÇADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13577","nome":"DESENVOLVIMENTO WEB","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13588","nome":"ALGORITMOS E ESTRUTURA DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13589","nome":"LINGUAGEM DE PROGRAMACAO ORIENTADA A OBJETOS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13609","nome":"ECONOMIA E MERCADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13617","nome":"ARTES E EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13620","nome":"ADMINISTRAÇÃO DE PESSOAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13624","nome":"AGRICULTURA FAMILIAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13625","nome":"ECONÔMIA SOLIDÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13627","nome":"ALGORITMO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13632","nome":"ECONOMIA E PESQUISA DE MERCADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13660","nome":"CIENCIAS DA NATUREZA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13671","nome":"TRABALHO DE CONCLUSÃO DE CURSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13675","nome":"ARTE/MUSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13678","nome":"HORA DO CONTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13679","nome":"TÉCNICO INDUSTRIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13680","nome":"PRÁTICAS CULTURAIS E SUSTENTABILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13681","nome":"PRÁTICAS AGROECOLÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13682","nome":"TECNOLOGIAS INDÍGENAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13684","nome":"SISTEMA DE INFORMAÇÕES GERENCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13685","nome":"METODOLOGIA E TÉCNICA DE PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13686","nome":"ED. SENTIMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13687","nome":"TECNICAS DOMESTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13688","nome":"CONSERVAÇÃO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13690","nome":"CIDADANIA E PRATICAS DA VIDAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13691","nome":"EXPRESSÃO CORPORAL E MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13693","nome":"SEGURANÇA LABORATORIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13694","nome":"M.A.S.S.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13695","nome":"CIENCIAS DA LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13696","nome":"CIENCIAS NATURAIS E LINGUAGEM MATEMATICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13697","nome":"CIENCIAS HUMANAS, AMBIENTAIS E SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13699","nome":"MATEMATICA DINAMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13700","nome":"EDUC. ALIMENTAR E AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13701","nome":"ESTUDO E PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13702","nome":"MOMENTO DA LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13703","nome":"INCLUSÃO DIGITAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13704","nome":"DIREITO HUMANOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13705","nome":"LETRAMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13706","nome":"MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13707","nome":"ACOMP. PEDAGOGICO EM MATEMATICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13708","nome":"E.M.C","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13709","nome":"EST.SOCIAIS/ENS.RELIGIOSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13713","nome":"LEGIS. E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13714","nome":"CULTURA INDÍGENA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13715","nome":"CIÊNCIAS EXATAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13719","nome":"FUNDAMENTOS FILOSÓFICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13720","nome":"ARTES,RITOS E MITOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13721","nome":"CURRICULO POR ATIVIDADES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13722","nome":"EDUC.REFLEXIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13723","nome":"LINGUAGEM DE PROGRAMAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13724","nome":"METODOLOGIA DA PESQUISA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13725","nome":"ALGORITMOS E ESTRUTURA DE DADOS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13726","nome":"MATEMÁTICA E O LÚDICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13729","nome":"OFIC.PRODU.TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13730","nome":"SALA DE RECURSOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13731","nome":"CONSUMO E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13732","nome":"DJSR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13733","nome":"PESQUISA E LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13734","nome":"HIST.ENS.REL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13735","nome":"PRODUÇÕES INTERATIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13736","nome":"ATIVIDADE COMPLEMENTAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13737","nome":"NATAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13738","nome":"TECNICAS AGROP. E  ED.AMB","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13739","nome":"ATIVIDADES FISICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13740","nome":"ARTES E CULT. REGIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13743","nome":"ARTES CÊNICAS, ARTES VISUAIS, DANÇA E MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13745","nome":"CIÊNCIAS PRATICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13747","nome":"LINGUAGEM E COD. DIGITAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13749","nome":"INICIAÇÃO À PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13752","nome":"PORTUGUÊS II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13753","nome":"PSICOLOGIA DESENHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13754","nome":"AÇAO COMUNITÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13755","nome":"HISTORIA GEOGRAFIA DE ALAGOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13756","nome":"LINGUA ESTRANGEIRA INGLÊS E ESPANHOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13757","nome":"ARTES E CULTURAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13759","nome":"TÉCNICAS DE LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13760","nome":"ORIENTAÇAO SEXUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13761","nome":"ESPORTE EDUCATIVO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13762","nome":"PRÁTICA ORIENTADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13763","nome":"DESENVOLVIMENTO SUSTENTÁVEL DOS POVOS E COMUNIDADES TRADICIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13764","nome":"ECOLOGIA E BIODIVERSIDADE BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13765","nome":"PATRIMÔNIO E PLURALIDADE CULTURAL BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13766","nome":"GESTÃO SUSTENTÁVEL DE ESPAÇOS TERRITORIAIS EDIFICADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13767","nome":"IMPACTOS AMBIENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13773","nome":"EDUCAÇÃO FISICA/JOGOS E RECREAÇAO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13774","nome":"PEC CIÊNCIAS HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13775","nome":"NOÇÕES DE FILOSOFIA E SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13776","nome":"CIÊNCIAS DA LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13777","nome":"HISTÓRIA SOC. E CULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13778","nome":"FUND.HIST.FIL.EDUC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13779","nome":"ESTRUTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13780","nome":"FUND.PSI.DA EDUC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13781","nome":"FUND.BIOL.DA EDUC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13782","nome":"FUND.SOC.DA EDUC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13783","nome":"INICIAÇÃO ARTÍSTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13784","nome":"ED.FIS. ARTE, ED.REL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13786","nome":"TRANSPORTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13787","nome":"JARDINAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13788","nome":"TRABALHO EXTRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13789","nome":"TRABALHO MONITORADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13790","nome":"VIVEIRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13793","nome":"GEOGRAFIA DE ALAGOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13794","nome":"LINGUAGEM, CÓDIGO E SUAS TECNOLOGIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13797","nome":"LÍNGUA JAPONESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13798","nome":"ESTUDO DA VIDA COTIDIANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13799","nome":"ARTES DOMÉSTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13800","nome":"CIENCIAS.CIENC.NAT","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13801","nome":"FILOSOFIA. SOCIOLOGIA E ENS.RELIG","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13802","nome":"TECNOLOGIA DE PROCESSAMENTO DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13803","nome":"LIBRAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13804","nome":"OFICINA LUDICA DE APRENDIZAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13805","nome":"PESQUISA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13812","nome":"ATIVIDADE COMPLEMENTAR CURRICULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13813","nome":"LINGUA MATERNA: CINTA LARGA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13814","nome":"FISIOLOGIA VEGETAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13815","nome":"MANEJO DE PRAGAS, DOENÇAS E PLANTAS DANINHAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13816","nome":"CULTURAS BIOENERGÉTICAS 01","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13817","nome":"CULTURAS PERENES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13818","nome":"MANEJO DE IRRIGAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13819","nome":"OVINOCULTURA E CAPRINOCULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13820","nome":"BOVINOCULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13821","nome":"CULTURAS BIOENERGÉTICAS 02","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13822","nome":"ESTÁGIO 02","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13823","nome":"PÓS-COLHEITA E PROCESSAMENTO DE PROD. DE ORIGEM VEGETAL E ANIMAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13824","nome":"LITERATURA INFANTO JUV.  E PROD. TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13825","nome":"JOGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13826","nome":"BIBLIOTECA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13827","nome":"CRESC. DESENV. DE PLANTAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13828","nome":"MANEJO INTEGRADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13829","nome":"ZOOTECNIA GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13833","nome":"TEATRO E DANÇA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13837","nome":"CENARIOS ECONOMICOS E MERCADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13842","nome":"ADMINISTRAÇÃO DE MARKETING E VENDAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13853","nome":"ATENDIMENTO E SUPORTE AO USUÁRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"13936","nome":"ROBÓTICA EDUCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"14573","nome":"SEGURANÇA AMBIENTAL E DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"14645","nome":"ESTATÍSTICA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"14646","nome":"LEGISLAÇÃO E ORGANIZAÇÃO EMPRESARIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"14647","nome":"RECURSOS HUMANOS E CAPACITAÇÃO PROFISSIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15095","nome":"CULTURAS REGIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15135","nome":"BRINQUEDOTECA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15202","nome":"NOÇÕES BÁSICA DE AGROECOLOGIA E ZOOTECNIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15213","nome":"CULT. PALMARINA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15217","nome":"CABEAMENTO ESTRUTURADO E PROJETOS DE REDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15556","nome":"CONVIVENCIA SOCIAL E ETICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15611","nome":"ORGANIZAÇÃO, SISTEMAS E MÉTODOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15612","nome":"ESTATISTICA APLICADA A ADMINISTRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15614","nome":"LEGISLAÇÃO APLICADA EM VENDAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15705","nome":"MECANOGRAFIA PROCESSAMENTO DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15706","nome":"ORGANIZAÇÃO E TÉCNICAS COMERCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15707","nome":"CONTABILIDADE INDUSTRIAL AG.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15708","nome":"EDUCAÇÃO VISUAL E TECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15710","nome":"VALLORACION ACTITUDES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15711","nome":"EXP. MUSICAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15712","nome":"CONHEC. DO MEIO NAT. SOC. CULT.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15713","nome":"CASTELHANO: LING. E LIT.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15714","nome":"VALENCIANO: LING.  E LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15715","nome":"HISTORIA DO PIAUÍ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15716","nome":"LITERATURA DO PIAUÍ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15779","nome":"HISTÓRIA INDIGENA PARESI","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15786","nome":"LAB. DE LITERATURA E REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15787","nome":"LAB. CIÊNCIAS NATUREZA E MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15790","nome":"OFICINAS PEDAGÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15791","nome":"LEITURA DE RÓTULOS DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15792","nome":"ATITUDES E VALORES ÉTICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15793","nome":"COMPROMISSO E ASSIDUIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15794","nome":"CRIATIVIDADE/CRITICIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15795","nome":"PARTICIPAÇÃO FAMILIAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15796","nome":"EDUCAÇÃO CRISTÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15797","nome":"CONTABILIDADE AGRÍCOLA E INDUSTRIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15798","nome":"ELEMENTOS A. BALANÇO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15799","nome":"ORGANIZAÇÃO TECNICA COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15800","nome":"REDAÇÃO TECNICA E EXPRESSÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15801","nome":"CONTEÚDO E METODOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15802","nome":"CONT. MET. DE ESTUDOS SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15803","nome":"ESTRUTURA F . E. 1º GRAU","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15804","nome":"L.E.M. INGLESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15805","nome":"CIENCIAS /CFB","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15806","nome":"CIÊNCIAS NATURAIS E LINGUAGUEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15808","nome":"ENSINO RELIGIOSO XAVANTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15809","nome":"ENSINO RELIGIOSO E RELAÇÕES HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15810","nome":"EMPREENDEDORISMO E ÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15811","nome":"FILOSOFIA E PROGRAMA DE SAUDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15812","nome":"DIREITO CIVIL E COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15813","nome":"NOÇÕES GERAIS DE ESCRITÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15814","nome":"TRABALHOS EM MADEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15815","nome":"PROJETO INTERDISCIPLINAR I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15816","nome":"PROJETO INTERDISCIPLINAR II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15817","nome":"LABORAT. GEOG","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15818","nome":"EDUCAÇÃO AMBIENTAL E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15838","nome":"ORGANIZAÇÃO RURAL E DA PRODUÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15839","nome":"AVICULTURA/CUNICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15840","nome":"PISCICULTURA/MINHOCULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15841","nome":"DESENHO TÉCNICO E TOPOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15864","nome":"EDUCAÇÃO FISICA E SAUDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15873","nome":"PROJETO LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15883","nome":"MATEMÁTICA/GEOMETRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15884","nome":"MATEMATICA COMERCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15885","nome":"ELEMENTO ECONOMICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15886","nome":"FSCF","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15887","nome":"INT. TEC. DE TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15903","nome":"FILOSOFIA E LOGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15909","nome":"LEGISLAÇÃO - PATROMÔNIO, CULTURA E AMBIENTE ARTIFICIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15911","nome":"BANCO DE DADOS II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15912","nome":"DESIGN GRÁFICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15929","nome":"FORMAÇAO ÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15930","nome":"JORNALISMO ESCOLAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15931","nome":"OFICINA DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15945","nome":"TÉC. DO LAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15956","nome":"EDUCAÇAO CIDADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15957","nome":"MUNDO DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15958","nome":"INTRODUÇÃO A TECNOLOGIA DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15959","nome":"MICROBIOLOGIA E ANÁLISE DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15960","nome":"PRÍNCIPIOS DA BIOQUÍMICA DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15961","nome":"HIGIENE E LEGISLAÇÃO DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15962","nome":"ADMINISTRAÇÃO E EMPREENDEDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15984","nome":"ÉTICA E RELAÇÕES HUMANAS NO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15985","nome":"REDAÇÃO EMPRESARIAL E OFICIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"15986","nome":"RELAÇÕES PÚBLICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16023","nome":"TRABALHO DE CONCLUSÃO DE CURSO - TCC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16025","nome":"TECNOLOGIA E INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16026","nome":"ARTE E IMAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16027","nome":"CIÊNCIAS MOTORAS E ESPORTIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16028","nome":"CONVIVÊNCIA CIVIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16029","nome":"ESPERANTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16034","nome":"LINGUAGEM DE PROGRAMAÇÃO ORIENTADA A OBJETO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16049","nome":"HISTÓRIA, CIDADANIA E CONSTITUÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16060","nome":"AULAS PRÁTICAS E TCC*","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16100","nome":"DESENVOLVIMENTO SUSTENTÁVEL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16161","nome":"ADMINISTRANDO A VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16325","nome":"CULTURAS ANUAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16326","nome":"CARTOGRAFIA BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16369","nome":"LEGISLAÇÃO E ÉTICA PROFISSIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16370","nome":"ORGANIZAÇÃO E ARQUITETURA DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16371","nome":"ALGORITMO E ESTRUTURA DE DADOS II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16372","nome":"PROGRAMAÇÃO WEB I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16373","nome":"FUNDAMENTOS DA INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16401","nome":"SEMINARIO INTEGRADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16405","nome":"SÓCIO-HISTÓRICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16406","nome":"QUÍMICA NO COTIDIANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16407","nome":"REDAÇÃO DE DOCUMENTOS OFICIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16408","nome":"VIDEOTECA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16428","nome":"MEDIA GLOBAL FINAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16471","nome":"DOM EMPREENDEDOR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16472","nome":"D. CIVIL ECOL.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16473","nome":"CONHECIMENTOS REGIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16474","nome":"PRATICAS CULTURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16476","nome":"RELAÇÕES INTERPESSOAIS NO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16477","nome":"FUNDAMENTOS DO TURISMO E HOSPITALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16478","nome":"PLANEJAMENTO E GESTÃO DE EVENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16479","nome":"CERIMÔNIA PROTOCOLO E ETIQUETA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16480","nome":"INFORMÁTICA E TECNOLOGIAS APLICADAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16481","nome":"SUSTENTABILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16482","nome":"P.S.B.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16483","nome":"OFIC. DE TÉC. AGRIC. E AMBIENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16484","nome":"OFIC. DE ATIV. LUDICO DESPORTIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16485","nome":"OFICINA DE EXPRESSÕES ARTÍSTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16486","nome":"OFIC. DE LEITURA E PROD. TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16487","nome":"LING. NATURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16498","nome":"INICIAÇÃO À PESQUISA E A INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16499","nome":"PROJETOS INTEGRADORES DE LINGUAGENS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16500","nome":"PROJETOS INTEGRADORES DE CIENCIAS DA NATUREZA E MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16501","nome":"PROJETOS INTEGRADORES DE CIÊNCIAS HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16503","nome":"PROJETO DEF","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16504","nome":"HISTÓRIA DE GOIÁS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16505","nome":"GRAMÁTICA CONTEXTUALIZADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16506","nome":"LEITURA E INTERPRETAÇÃO EM INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16510","nome":"TECNOLOGIA E ADMINISTRAÇÃO E ORGANIZAÇÃO DE EMPRESAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16512","nome":"EDUCAÇÃO FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16513","nome":"P.T.L.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16514","nome":"TÉCNICAS DE REDAÇÃO E MECANOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16515","nome":"PSICOLOGIA DAS RELAÇÕES HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16516","nome":"ADMINISTRAÇÃO E ORG. DE EMPRESAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16517","nome":"CIÊNCIAS E PS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16518","nome":"CFB E PS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16519","nome":"CIENCIAS / EDUCAÇAO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16520","nome":"ARTES INDÍGENAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16521","nome":"OFICINA INT. ENFASE EM CALCULO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16522","nome":"ANALISE E SOLUÇÕES DE PROBLEMAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16523","nome":"GESTÃO EMPRESARIAL BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16525","nome":"TRABALHO INTERDISCIPLINAR INTEGRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16526","nome":"QUALIFICAÇAO PROFISSIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16527","nome":"PARTICIPAÇAO CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16528","nome":"LEITURA E ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16529","nome":"ARTES VISUAIS E MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16534","nome":"EDUCAÇÃO DO CONSUMIDOR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16537","nome":"PEC - CIÊNCIAS DA NAT. E MATEMATICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16538","nome":"PEC- CIÊNCIAS HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16539","nome":"PEC - LINGUAGENS E CODIGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16540","nome":"AÇÃO E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16541","nome":"CODIGOS DIGITAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16542","nome":"EDUCAÇÃO ALIMENTAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16543","nome":"CIÊNCIAS HORTA ES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16544","nome":"HISTORIA E CULTURA BRASILEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16545","nome":"LINGUAGEM TEATRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16546","nome":"SOCIAIS RECICLAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16547","nome":"ADM.E EMPEEND","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16548","nome":"SAÚDE E SEG. DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16549","nome":"HARDWARE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16550","nome":"LOGICA DE PROG.I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16551","nome":"CIÊNCIAS SAÚDE E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16552","nome":"EXATAS BLOG","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16553","nome":"CULTURA AFRO-BRASILEIRA AFRICANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16556","nome":"BIOL. APLIC. E SAÚDE E SEX. HUM.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16557","nome":"EDUC. FÍSICA ENF. VIDA SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16558","nome":"PRÁTICAS AGROPECUÁRIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16567","nome":"ADM E ENG RURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16579","nome":"OFICINA DE BANDA MARCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16580","nome":"ROBÓTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16586","nome":"TRABALHO DE CONCLUSÃO DE CURSO III","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16595","nome":"SAÚDE E SEGURANÇA DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16612","nome":"ROTINAS DE GESTÃO DE PESSOAS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16613","nome":"ROTINAS DE GESTÃO DE PESSOAS II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16616","nome":"QUALIDADE DE VIDA E SEGURANÇA NO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16629","nome":"PSICULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16637","nome":"MANEJO DA FERTILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16639","nome":"PROCESSAMENTOS DE DADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16645","nome":"MANEJO E CONSERVAÇÃO DO SOLO E DA ÁGUA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16646","nome":"ADLS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16647","nome":"OFICINA DE COMUNICAÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16648","nome":"TÓPICOS DE FÍSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16649","nome":"CRIAÇÃO DE PEQUENOS ANIMAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16650","nome":"CRIAÇÃO DE MÉDIOS ANIMAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16651","nome":"GERENCIAMENTO AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16676","nome":"CIÊNCIAS AGRÁRIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16679","nome":"MICROBIOLOGIA DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16687","nome":"PROCESSAMENTO DE FRUTAS E HORTALIÇAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16688","nome":"PROCESSAMENTO DE ÓLEOS E GORDURAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16689","nome":"MECÂNICA DE SOLOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16690","nome":"CIÊNCIAS EXATAS E NATURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16698","nome":"MERCADO E COMERCIALIZAÇÃO DE PRODUTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16699","nome":"APOIO ESCOLAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16700","nome":"CULTURA PARNANGUARA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16701","nome":"JOGOS PEDAGÓGICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16702","nome":"OFICINA DE IDEIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16703","nome":"SAÚDE E QUALIDADE DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"16704","nome":"FORMAÇÃO HUMANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17566","nome":"ECONOMIA DE MERCADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17589","nome":"INFORMÁTICA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17591","nome":"INTROD. A LEG. TRABALHISTA(SOCIAL E DO TRABALHO)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17592","nome":"FORMAÇÃO E DESENVOLVIMENTO DE PESSOAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17593","nome":"FUNDAMENTOS TEÓRICOS DA ADMINISTRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17594","nome":"ADMINISTRAÇÃO E GESTÃO DE PESSOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17595","nome":"FUNDAMENTOS DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17596","nome":"PLANEJAMENTO E ANÁLISE DE FUNÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17597","nome":"AVALIAÇÃO DE DESEMPENHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17598","nome":"NEGOCIAÇÃO E RESOLUÇÃO DE CONFLITOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17599","nome":"CONTABILIDADE GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17600","nome":"METODOLOGIA DA PESQUISA CIENTÍFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17704","nome":"P.Q.V/ AE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17709","nome":"HISTÓRIA E CULTURA AFRO-BRASILEIRA E INDÍGENA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17710","nome":"SAUDE E RESPONSABILIDADE SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17711","nome":"TÓPICOS DE LINGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17714","nome":"ECOLOGIA/TURISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17715","nome":"ORIENTAÇÃO CRISTA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17716","nome":"HISTORIA E ED. RELAÇOES ETNICO E RACIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17717","nome":"OLERICULTURA E JARDINAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17718","nome":"AVICULTURA DE CORTE E POSTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17719","nome":"CRIAÇÕES ALTERNATIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17720","nome":"ESTUDO RELIGIOSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17721","nome":"ESP. CULTURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17722","nome":"CIDADANIA DIVERSIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17723","nome":"MEIO AMBIENTE E SAUDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17724","nome":"TOPICOS DE HISTORIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17725","nome":"TOPICOS DE GEOGRAFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17726","nome":"TOPICOS DE REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17727","nome":"TÉCNICAS SECRETARIAIS II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17728","nome":"SISTEMA DE INFORMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17729","nome":"ADMINISTRAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17730","nome":"ARTES INDIGENAS RITOS E MITOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17731","nome":"ESPCDOB","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17732","nome":"PRINCÍPIOS E VALORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17735","nome":"LEITURA, INTERPRETAÇÃO E PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17736","nome":"COMPUTAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17737","nome":"QUÍMICA EXPERIMENTA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17738","nome":"EXPERIMENTOS EM FÍSICA COM PREPARAÇÃO PARA AS OLIMPÍADAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17739","nome":"TÓPICOS DE QUÍMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17740","nome":"TÓPICOS DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17741","nome":"CULTURA AFRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17742","nome":"SEGURANÇA DO TRABALHO E SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17743","nome":"OPERAÇÕES UNITÁRIAS DA INDÚSTRIA DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17744","nome":"HIGIENE NA INDÚSTRIA DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17745","nome":"QUÍMICA E ANÁLISE DE ALIMENTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17746","nome":"V PROD ORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17747","nome":"GEOG./FIL./SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17748","nome":"HIST./FIL./SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17749","nome":"CSA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17750","nome":"IDENTIDADE CULTURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17753","nome":"CIÊNCIA EXPERIMENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17754","nome":"TÓPICOS DE BIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17755","nome":"ESTUDO MONITORADO PORT MAT","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17756","nome":"PESQUISA E PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17757","nome":"TEATRO ARTES CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17758","nome":"DANÇA ARTES CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17759","nome":"OFICINA DE JOGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17760","nome":"JAPONES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17761","nome":"VIVENCIANDO CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17762","nome":"VIVENCIANDO LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17763","nome":"INCLUSÃO DIGITAL E COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17764","nome":"APOIO À MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17765","nome":"ATIVIDADES ESPORTIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17766","nome":"RACIOCÍNIO LOGICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17767","nome":"ESTUDO DIRIGIDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17768","nome":"EXP.MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17769","nome":"PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17770","nome":"SOCIOLOGIA E ANTROPOLOGIA POLÍTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17771","nome":"OFICINA DE MATEMÁTICA BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17772","nome":"ALGEBRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17773","nome":"TIPOLOGIA TEXTUAL-REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17774","nome":"FISICA DO COTIDIANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17775","nome":"ESPANHOL DO COTIDIANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17778","nome":"TOPITOS DE DESPORTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17779","nome":"ARTE LITERÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17780","nome":"LIT. INF. JUVENIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17781","nome":"TÓPICO DE FILOSOFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17782","nome":"LEITURA PRODUÇÃO E REFLEXÃO DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17783","nome":"TÓPICOS DE LÍNGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17784","nome":"ATIVIDADES DE MEDIAÇÃO CURRICULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17785","nome":"PRÁTICAS CORP. MARCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17786","nome":"XADREZ E JOGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17787","nome":"INICIAÇÃO ESPORTIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17788","nome":"ESTUDO MONITORADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17789","nome":"EXPERIÊNCIA MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17790","nome":"LINGUAGEM CORPORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17791","nome":"CULTURA PALMARINA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17792","nome":"PQV/AE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17793","nome":"VALORES HUMANOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17794","nome":"CIÊNCIAS FÍSICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17795","nome":"FUTSAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17796","nome":"FÍSICA MODERNA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17797","nome":"QUÍMICA, SAÚDE E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17798","nome":"EDUCAÇÃO FÍSICA LABORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17799","nome":"CALCULO OPERACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17800","nome":"EDUCAÇÃO AGRICULA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17801","nome":"IDENTIDADE ÉTNICA E HISTÓRICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17803","nome":"PREP. P/ O TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17804","nome":"TÓPICO DE BIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17805","nome":"MATEMÁTICA - VESTIBULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17806","nome":"ESTUDOS MONITORADOS (PORT. MAT.)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17807","nome":"PESQUISA E PRODUÇÃO TEXTUAL (P.P.T)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17808","nome":"TEATRO (ARTES CIÊNCIAS)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17810","nome":"CIÊNCIAS F.B.P.S.E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17811","nome":"CIÊNCIAS F.B.PROGRAMA DE SAUDE E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17812","nome":"PRÁTICAS CORPORAIS MARCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17813","nome":"ELETRICIDADE BÁSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17814","nome":"ELETRÔNICA DIGITAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17815","nome":"ANALISE DE CIRCUITOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17816","nome":"ELETRÔNICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17817","nome":"SEGURANÇA DO TRABALHO, NORMAS E GESTÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17818","nome":"INICIAÇÃO À FILOSOFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17819","nome":"ORGANIZAÇÃO DOS PROCESSOS DE TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17820","nome":"LING.PORT/LIT.E REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17821","nome":"ANÁLISE DE CUSTOS E FORMAÇÃO DE PREÇOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17822","nome":"PLURALIDADE CULTURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17864","nome":"LEITURA E ESCRITA ATRAVÉS DA INFORMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17865","nome":"GEOGRAFIA AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17866","nome":"NOÇÕES DE GEOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17867","nome":"NOÇÕES DE HIDRÁULICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17868","nome":"POLUIÇÃO E CONTROLE AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17869","nome":"TÉCNICAS DE LABORATÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17940","nome":"HORA DA LEITURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17941","nome":"ATIVIDADE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17942","nome":"PROJETOS ESPECIAIS DO MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17943","nome":"TEATRO, ARTES VISUAIS E DANÇA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17944","nome":"ESPORTE, GINÁSTICA E JOGOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17945","nome":"CIÊNCIAS ECONÔMICAS E SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17946","nome":"CIÊNCIAS VIDA E TERRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17947","nome":"METODOLOGIA E PRÁTICAS CIENTIFICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17948","nome":"PROCESSOS INDUSTRIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17949","nome":"LÍNGUA PORTUGUESA GRAMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17950","nome":"PROJETO E INSTALAÇÕES ELÉTRICAS EM BAIXA TENSÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17951","nome":"SEGURANÇA DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17952","nome":"ELETRICIDADE I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17953","nome":"ELETRICIDADE II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17954","nome":"ELETRÔNICA GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17955","nome":"PRIMEIRO SOCORROS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17956","nome":"APOIO A LINGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17957","nome":"ESTUDOS AGRÁRIOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17958","nome":"TERRA VIDA TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17959","nome":"CIÊNCIAS FÍSICAS E BIOLÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17961","nome":"ASPECTOS CULTURAIS EM LÍNGUA INGLESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17962","nome":"TECNOLOGIA DA INFORMAÇÃO E COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17963","nome":"NÚCLEO DE TRABALHO , PESQUISA E PRATICAS SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17964","nome":"LINGUA ESTRANGEIRA-INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17965","nome":"TÓPICOS DE MATEMÁTICA FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17966","nome":"EDUCAÇÃO FÍSICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17967","nome":"LINGUA PORTUGUESA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17968","nome":"ARTES I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17969","nome":"QUIMICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17970","nome":"FILOSOFIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17971","nome":"TÉCNICAS LABORATORIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17972","nome":"EDUCAÇÃO FÍSICA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17973","nome":"QUÍMICA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17974","nome":"SOCIOLOGIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17975","nome":"LÍNGUA ESTRANGEIRA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17976","nome":"SOLUÇÕES QUÍMICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17977","nome":"FÍSICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17978","nome":"MATEMATICÁ BÁSICA E FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17979","nome":"ESPORTE E SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17980","nome":"PROJ. CONVIVENDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17981","nome":"ARTES/DIV.CULT.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17982","nome":"OFICINA DE LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17983","nome":"OFICINAS EXATAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17984","nome":"OFICINAS SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17985","nome":"LÍNG. PORT./ PORTUGUÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17986","nome":"CIÊNCIAS/C.F.B./P.S","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17987","nome":"ED. RELIGIOSA/ ENS. REL.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17988","nome":"ARTE/ED. ART./ ENS. ARTES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17989","nome":"PREVENÇÃO E QUALIDADE DE VIDA COM AMOR EXIGENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17990","nome":"RECURSOS NATURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17991","nome":"METODOLOGIA GLOBALIZADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17992","nome":"TIC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17993","nome":"TÓPICO DE EDUCAÇÃO FÍSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17994","nome":"LÍNGUA PORTUGUESA E PRODUÇÃO DE TEXTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17995","nome":"HISTORIA XAVANTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17996","nome":"LOGICA COMPUTACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17997","nome":"PROGRAMAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17998","nome":"REDES E SISTEMAS OPERACIONAIS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"17999","nome":"ELETRÔNICA E ELETRICIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18000","nome":"EDUCAÇÃO RELIGIOSA ESCOLAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18001","nome":"HISTÓRIA/FILOSOFIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18002","nome":"GEOGRAFIA/SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18003","nome":"RES. DE PROB. MATEMÁTICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18004","nome":"ESTUDOS DA SOCIEDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18005","nome":"DISCIPLINAS ELETIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18006","nome":"ORIENTAÇÃO PARA ESTUDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18007","nome":"PROJETO DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18008","nome":"PROTAGONISMO JUVENIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18009","nome":"VOLEIBOL - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18010","nome":"FUTSAL - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18011","nome":"HANDEBOL - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18012","nome":"ORIENTAÇÃO DE ESTUDOS E LEITURA - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18013","nome":"BANDA - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18014","nome":"HISTÓRIA EM QUADRINHOS - AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18015","nome":"ASPECTOS DA VIDA CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18016","nome":"SETOR PRIMARIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18017","nome":"SETOR SECUNDARIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18018","nome":"SETOR TERCIARIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18019","nome":"ATIVIDADE DE CONVIVÊNCIA, HÁBITOS HIGIÊNICOS E ALIMENTARES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18020","nome":"ATIVIDADES ARTÍSTICAS E CULTURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18021","nome":"APOIO AO LETRAMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18022","nome":"ATIVIDADES ESPORTIVAS E CORPORAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18027","nome":"LINGUAGEM/CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18462","nome":"ARQUITETURA E ORGANIZAÇÃO DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18463","nome":"LÍNGUA E LINGUAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18914","nome":"DESENVOLVIMENTO HUMANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18979","nome":"ENS. DA USABILID. DAS FUNCIONALID. DA INFORMÁTICA - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18980","nome":"ENS. DE USO DA COMUNIC. ALTERNATIVA E AUMENTATIVA - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18981","nome":"ENS. DA LINGUA PORTUGUESA E MOD. ESCRITA - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18982","nome":"ENSINO DA LINGUA BRASILEIRA DE SINAIS/LIBRAS - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18983","nome":"ENSINO DE USO DE RECURSOS OPTICOS E NAO OPTICOS - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18984","nome":"ENSINO DO SISTEMA BRASIL - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18985","nome":"ENSINO DO USO DO SOROBAN - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18986","nome":"ESTRATEGIAS P/AUTONOMIA NO AMBIENTE ESCOLAR - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18987","nome":"ESTRATEGIAS PARA ENRIQUECIMENTO CURRICULAR - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18988","nome":"ESTRATEGIAS PARA O DESENVOLV. DE PROCESSOS MENTAIS - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18989","nome":"TECNICAS DE ORIENTAÇÃO E MOBILIDADE - AEE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18990","nome":"ALFABETIZAÇÃO LINGUÍSTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18991","nome":"ALFABETIZAÇÃO MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18992","nome":"ORIENTAÇÕES PARA A VIDA FAMILIAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"18993","nome":"DIREITO E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19640","nome":"ORGANIZ. SOC. POLIT. DO BRASIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19776","nome":"TUPY","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19777","nome":"ETNO HISTÓRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19786","nome":"ECONOMIA FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19787","nome":"INICIAÇÃO AOS EXPERIMENTOS PEDAGÓGICOS ÀS PRÁTICAS PEDAGÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19788","nome":"TÓPICOS DE DESPORTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19789","nome":"MATEMÁTICA DO DIA-A-DIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19790","nome":"CONHECENDO A ÁGUA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19791","nome":"PROBLEMÁTICA SOCIO AMBIENTAL E SAÚDE PÚBLICA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19792","nome":"PROJETOS DE EDUCAÇÃO AMBIENTAL I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19796","nome":"LEITURA E INTERPRETAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19799","nome":"LINGUA/LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19800","nome":"TÓPICO DE INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19802","nome":"IND. VESTUÁRIO CORTE E COSTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19803","nome":"ARTE CULINÁRIA E ED. ALIMENTAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19804","nome":"LINGUA MATERNA CASTELHANO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19805","nome":"SEGUNDA LINGUA GUARANI","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19806","nome":"VIDA SOCIAL E TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19807","nome":"MEIO NATURAL E SAÚDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19808","nome":"DIREITO APLICADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19809","nome":"TÉCNICAS PROFISSIONAIS I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19810","nome":"LETRAMENTO DIGITAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19811","nome":"LITERATURA/PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19812","nome":"AMBIENTE EMPRESARIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19813","nome":"FUNDAMENTOS DE GESTÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19814","nome":"PLANEJAMENTO ESTRATÉGICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19815","nome":"ESCRITA E ORALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19816","nome":"CALCULOS MATEMÁTICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19817","nome":"ARTESANATO POPULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19818","nome":"INICIAÇÃO AO EXPERIMENTO AS PRÁTICAS PEDAGÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19819","nome":"ATIVIDADE CÍVICO MILITAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19820","nome":"INSTRUÇÃO CÍVICA E MILITAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19821","nome":"PSICOM. E EXP. CORPORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19822","nome":"INCLUSÃO SOCIAL - 20","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19823","nome":"EDUCAÇÃO FISICA EXAME MÉDICO BIOMTÉRICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19824","nome":"ENSINO INTERDISCIPLINAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19825","nome":"ÁREA LÓGICO-MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19826","nome":"ÁREA SOCIO-HISTORICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19827","nome":"ÁREA DA COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19828","nome":"ÁREA DE CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19829","nome":"FUNDAMENTOS PSICOLOGICO DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19830","nome":"FUNDAMENTOS SOCIOLOGICO DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19831","nome":"PRATICA DE FORMAÇÃO (EST.SUPE)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19832","nome":"NOÇÕES DE CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19833","nome":"PRODUÇÃO DE TEXTO E ORALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19834","nome":"JUVENTUDE EM AÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19835","nome":"PROJETANDO O FUTURO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19836","nome":"ACOMPANHAMENTO PEDAGÓGICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19837","nome":"ARTES E RECREAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19838","nome":"ATIVIDADES DESPORTIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19839","nome":"VIVENCIANDO A MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19840","nome":"HISTÓRIA DO ESTADO DO ACRE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19841","nome":"PLANEJAMENTO E EMPREENDEDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19842","nome":"SOC. POLÍTICA E CULTURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19843","nome":"PRÁTICA SOCIAL E VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19844","nome":"TÉCNICO EM CONTROLE AMBIENTAL INTEGRADO AO ENSINO MÉDIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19845","nome":"ATENÇÃO EDUCACIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19846","nome":"CIÊNCIAS SOCIAIS, GEOGRAFIA E HISTORIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19847","nome":"EDUCAÇÃO PLÁSTICA E VISUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19848","nome":"LÍNGUA ESPANHOLA E LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19849","nome":"LÍNGUA GALEGA E LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19850","nome":"EDUCAÇÃO PARA A CIDADANIA E OS DIREITOS HUMANOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19851","nome":"MATEMÁTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19852","nome":"RELIGIÃO CATÓLICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19853","nome":"TECNOLOGIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19854","nome":"HISTÓRIA E EDUCAÇÃO RELIGIOSA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19855","nome":"ALFABETIZAÇÃO/LETRAMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19856","nome":"APOIO PEDAGÓGICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19857","nome":"CANTO E CORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19858","nome":"CULTURA ARTES E EDUCAÇÃO PATRIMONIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19859","nome":"CULTURA DIGITAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19860","nome":"ESPORTE E LAZER","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19861","nome":"KARATÊ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19862","nome":"ATLETISMO-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19863","nome":"CAMPO DO CONHECIMENTO-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19864","nome":"CANTEIROS SUSTENTAVEIS-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19865","nome":"DANÇA-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19866","nome":"MATEMATICA-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19867","nome":"PORTUGUES-AC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19868","nome":"GEOMORFOLOGIA E HIDROLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19869","nome":"TÉCNICAS DE AVALIAÇÃO E CONTROLE DE IMPACTOS AMBIENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19870","nome":"HISTÓRIA E GEOGRAFIA DE PORTUGAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19871","nome":"EST. ACOMP.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19872","nome":"FOR. CÍV.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19874","nome":"ELETRÔNICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19875","nome":"PROCESSOS DE FABRICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19876","nome":"ATIVIDADES DE ENRIQUECIMENTO CURRICULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19877","nome":"ATIVIDADES DE VIDA AUTÔNOMA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19878","nome":"COMUNICAÇÃO AUTERNATIVA E AUMENTATIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19879","nome":"DESENVOLVIMENTO DE PROCESSOS MENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19880","nome":"INFORMÁTICA ACESSÍVEL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19881","nome":"LINGUA BRASILEIRA DE SINAIS-LIBRAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19882","nome":"LÍNGUA PORTUGUESA NA MODALIDADE ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19883","nome":"ORIENTAÇÃO E MOBILIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19884","nome":"SISTEMA BRAILE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19885","nome":"SOROBAN","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19886","nome":"TECNOLOGIA ASSISTIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19887","nome":"ATIVIDADE ENR CURRICULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19969","nome":"O INDIVÍDUO NA ORGANIZAÇÃO:PAPÉIS E INTERAÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19991","nome":"OFICINA TECNOLÓGICA/LEGO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19992","nome":"METODOLOGIA DO ESTUDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19993","nome":"EDUCAÇÃO DIREITOS HUMANOS E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19994","nome":"QUIMICA,SAÚDE E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"19998","nome":"VALOR DO AMANHA NA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20001","nome":"TOPICOS DE LINGUA ESTR. MODERNA INGLÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20007","nome":"FILOSOFIA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20008","nome":"ATIVIDADES INTEGRADORAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20009","nome":"PROJETO EMPREENDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20010","nome":"C.M DE PORTUGUES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20011","nome":"C.M DE CIENCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20012","nome":"C.M DE EST.SOCIAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20013","nome":"FUN.HIST.E.FIL.DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20014","nome":"FUND.PSICOL.DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20015","nome":"FUND.BIOL.DA EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20017","nome":"DGB","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20024","nome":"ESP NATAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20025","nome":"JOGOS ED DE TABULEIRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20026","nome":"SAUDE E PREVENÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20027","nome":"OR HUMANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20028","nome":"ORIENTAÇOES PARA A VIDA FAMILIAR E SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20029","nome":"TECNOLOGIA DE PRODUTOS DE ORIGEM VEGETAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20030","nome":"COM. EXP./PORT","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20031","nome":"ESTUDOS SOCIAIS E ENS. RELIG/EMC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20032","nome":"LINGUA MATERNA: ESPANHOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20033","nome":"TRABALHO E TECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20034","nome":"EDUCAÇÃO PARA A SAUDE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20035","nome":"METODOS E TECNICAS DE PESQUISA SOCIOAMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20036","nome":"TÉCNICAS DE LABORATÓRIO I (BIOLOGIA)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20037","nome":"TÉCNICAS DE LABORATÓRIO II (QUIMICA)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20038","nome":"ARQUITETURA E MANUTENÇÃO DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20039","nome":"ENSINO RELIGIOSO, FORMAÇÃO ÉTICA E CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20040","nome":"PROJETO INTERDISCIPLINAR III","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20041","nome":"PROJETO INTERDISCIPLINAR IV","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20042","nome":"PROJETO INTERDISCIPLINAR VII","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20043","nome":"BLOCO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20044","nome":"RELIGIÃO/ÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20045","nome":"ATIVIDADES CURRICULARES PROGRAMADAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20046","nome":"CURRÍCULO INTEGRADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20047","nome":"PRESERVAÇÃO DO MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20048","nome":"PRODUÇÕES E LUDICIDADES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20049","nome":"HISTÓRIA DE PENEDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20050","nome":"EDUCAÇÃO DO CAMPO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20051","nome":"C.F.B E IEPC","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20052","nome":"INFORMÁTICA INTEGRADA ÀS PRÁTICAS PEDAGÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20053","nome":"SAÚDE E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20054","nome":"ED.FÍSICA/NATAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20055","nome":"FUNDAMENTOS FILOSÓFICOS E RELIGIOSOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20056","nome":"PLANEJANDO O FUTURO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20057","nome":"FORMAÇÃO CIDADÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20058","nome":"IDENTIDADE,AUTONOMIA E VALORES HUMANOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20059","nome":"JOGOS DE TABULEIRO/XADREZ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20060","nome":"PESQUISA/PRODUÇÃO DE TEXTO E ORALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20061","nome":"RÁDIO NA ESCOLA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20062","nome":"ESPORTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20063","nome":"ESPORTE(2)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20066","nome":"ATIVIDADES ESPORTIVAS E MOTORAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20067","nome":"HISTORIA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20068","nome":"FORMAÇÃO PESSOAL E SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20069","nome":"MATEMATICA OFICINA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20070","nome":"EIXO TEMATICO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20072","nome":"EDUCAÇÃO ESPORTIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20073","nome":"EDUCAÇÃO FISCAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20074","nome":"LINGUA PORTUGUESA OFICINA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20075","nome":"OFICINA INTERDISCIPLINAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20076","nome":"APROPRIAÇÃO DO SISTEMA DE ESCRITA ALFABÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20077","nome":"PRÁTICAS CIENTÍFICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20078","nome":"AQUISIÇÃO DO SISTEMA DE ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20079","nome":"VIVÊNCIAS TECNOLÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20080","nome":"LEITURA PRODUÇÃO DE TEXTOS ESCRITOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20081","nome":"ORALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20083","nome":"PEC - PORTUGUÊS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20084","nome":"NUMEROS E OPERAÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20085","nome":"ESPAÇO E FORMAÇÃO DE GRANDEZAS E MEDIDAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20086","nome":"TRATAMENTO DA INFORMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20087","nome":"COMPETÊNCIA PESSOAL E SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20088","nome":"COMPETENCIA PESSOAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20089","nome":"COMPETENCIA PESSOAL E SOCIAL:EDUCAÇÃO FISICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20090","nome":"COMPETENCIA PESSOAL: ARTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20091","nome":"MATEMÁTICA NÚMEROS E OPERAÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20092","nome":"EDUCAÇÃO PARA VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20093","nome":"MET.DA PESQ CIENT. E TEC. DE INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20094","nome":"PROJETOS INTEGRADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20095","nome":"PEC. MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20096","nome":"EDUCAÇÃO DA ARTE/ MUSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20198","nome":"PRÁTICAS AGROECOLÓGICAS E EXTRATIVISTAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20210","nome":"DISCIPLINAS ELETIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20211","nome":"PRÁTICAS EXPERÍMENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20212","nome":"ESTUDO ORIENTADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20213","nome":"AVALIAÇÃO SEMANAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20214","nome":"PROJETO DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20215","nome":"PREPARAÇÃO PÓS MÉDIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20250","nome":"LITERATURA E TEATRO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20346","nome":"CIENCIAS NAVAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20347","nome":"ESPORTES INDIVIDUAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20348","nome":"MUSICA DO MUNDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20349","nome":"DESENVOLVIMENTO INGLÊS ESOL(LEITURA)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20351","nome":"INGLÊS TRÊS POR ESOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20352","nome":"ALGEBRA DOIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20353","nome":"HISTORIA DOS ESTADOS UNIDOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20437","nome":"OPERAÇÕES UNITÁRIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20737","nome":"ATIVIDADES DE CONVIVÊNCIA, HÁBITOS HIGIÊNICOS E ALIMENTARES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20738","nome":"ATIVIDADES DE LINGUAGEM E MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20739","nome":"ATIVIDADES CULTURAIS E ARTÍSTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20744","nome":"ATIVIDADES DE FORMAÇÃO PESSOAL E SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"20745","nome":"ATIVIDADES DE MÍDIAS DIGITAIS E TECNOLÓGICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24841","nome":"VÍDEO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24842","nome":"EXPERIENCIAS MATEMÁTICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24845","nome":"EDUCAÇÃO PATRIMONIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24846","nome":"ATIVIDADES RITMICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24847","nome":"VOLEIBOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24848","nome":"ATLETISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"24849","nome":"ECONOMIA SOLIDÁRIA E CRIATIVA/EDUCAÇÃO FINANCEIRA E FISCAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28241","nome":"MUSICA NO MUNDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28242","nome":"ALGEBRA 2","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28243","nome":"OFICINA PEDAGOGICA INTERATIVA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28244","nome":"PROGRAMA MAIS EDUCAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28248","nome":"OFICINA DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28255","nome":"INIC ÁS CIÊNCIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28256","nome":"TEC.TECNOLÓGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28258","nome":"INTERDISCIPLINARIDADES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28259","nome":"R.H.S.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28261","nome":"HORA DE ESTUDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28262","nome":"OFICINA TECNOLOGICA/ROBÓTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28263","nome":"TÉCNICA LEITURA E REDAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28266","nome":"DIREITO EMPRESARIAL, TRABALHISTA E TRIBUTÁRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28267","nome":"FUNDAMENTOS DA ADMINISTRAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28268","nome":"QUALIDADE DE VIDA E TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28269","nome":"MORAL, ÉTICA E CIVISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28270","nome":"AGROTURISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28271","nome":"CIDADANIA E QUALIDADE DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28272","nome":"LINGUA PORTUGUESA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28274","nome":"ÁREA LÓGICA-MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28275","nome":"ÁREA SÓCIO HISTÓRICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28276","nome":"CONHECIMENTOS DE COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28277","nome":"ÁREA DA COMUNICAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28278","nome":"DIREITO DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28565","nome":"DIVERSIDADE, INCLUSÃO E O MUNDO DO TRABALHO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28566","nome":"NOÇÕES DE SOCIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28567","nome":"ATIVIDADES MULTIDISCIPLINARES POR ÁREA DE CONHECIMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28568","nome":"TRÂNSITO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28569","nome":"SEXUALIDADE E GÊNERO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28570","nome":"VIDA FAMILIAR E SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28571","nome":"DIREITOS DAS CRIANÇAS E ADOLESCENTES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28612","nome":"EMPREENDEDORISMO E EDUCAÇÃO FINANCEIRA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28613","nome":"PRATICA DE LEITURA E PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28616","nome":"CORPO E MOVIMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28617","nome":"ARQUEOLOGIA E PATRIM HISTORICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28618","nome":"COMPONENTE CURRICULAR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28619","nome":"EDUCAÇÃO CIENTIFICA E CIDADANIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28620","nome":"ESPAÇO CULTURAL PARANAENSE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28621","nome":"L.E.M.-ESPANHOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28622","nome":"O INGLES NA LITERAT. E NO CINEMA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28623","nome":"VIVENCIA CORPORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28625","nome":"LINGUA ESTRANGEIRA - ALEMÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28626","nome":"LITERATURA E FOLCLORE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28635","nome":"ATIVIDADE ELETIVA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28636","nome":"ATIVIDADE ELETIVA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28637","nome":"ATIVIDADE ELETIVA III","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28655","nome":"MATEMÁTICA FUNDAMENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28656","nome":"PORTUGUÊS FUNDAMENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28657","nome":"INTRODUÇÃO A AGROINDÚSTRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28658","nome":"HIGIENIZAÇÃO E SEGURANÇA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28659","nome":"METODOLOGIA DE PROJETO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28660","nome":"INSTALAÇÕES DE PROJETOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28661","nome":"NUMERAMENTO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28662","nome":"GRAVIDEZ NA ADOLESCENCIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28663","nome":"JOVEM CIENTISTA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28664","nome":"CORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28665","nome":"CIENCIAS PRATICAS E AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28666","nome":"CIENCIAS SOCIAIS E NATURAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28667","nome":"INTRODUÇÃO À COMPUTAÇÃO GRÁFICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28668","nome":"FERRAMENTAS DE DESENHO GRÁFICO PARA WEB1","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28669","nome":"FERRAMENTAS DE DESENHO GRÁFICO PARA WEB2","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28670","nome":"FUNDAMENTOS DE LÓGICA E PROGRAMAÇÃO DE COMPUTADORES 1","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28671","nome":"FUNDAMENTOS DE LÓGICA E PROGRAMAÇÃO DE COMPUTADORES 2","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28673","nome":"FUNDAMENTOS PARA O DESIGN WEB E ARQUITETURA DA INFORMAÇÃO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28704","nome":"LINGUAJE - LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28705","nome":"EDUCAÇÃO FÍSICA E HIGIENE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28706","nome":"RELIGIÃO E MORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28707","nome":"SEGUNDA LÍNGUA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28708","nome":"TEC. CONHEC. PRATICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28709","nome":"IDIOMA ORIGINÁRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"28710","nome":"INTERPRETAÇÃO E PRODUÇÃO TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29693","nome":"ESTUDO APLICADO DE LÍNGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29694","nome":"ESTUDO APLICADO DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29695","nome":"PROJETO EDUCATIVO CULTURAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29698","nome":"PROTAGONISMO ESTUDANTIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29935","nome":"ATIVIDADES INVESTIGATIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29936","nome":"ESTUDO APLICADO EM LIBRAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"29937","nome":"PRATICAS CORPORAIS E LUDICIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30076","nome":"AGROINDÚSTRIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30077","nome":"BIOLOGIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30078","nome":"GEOGRAFIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30079","nome":"HISTÓRIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30080","nome":"LINGUA ESTRANGEIRA MODERNA - INGLES I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30081","nome":"LINGUA ESTRANGEIRA MODERNA - ESPANHOL I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30082","nome":"LÍNGUA PORTUGUESA E LITERATURA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30083","nome":"BIOESTATISTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30084","nome":"BIOÉTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30085","nome":"BIOSSEGURANÇA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30086","nome":"BIOTECNOLOGIA AMBIENTAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30087","nome":"FUNDAMENTOS DA QUÍMICA E GESTÃO DE LABORATÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30088","nome":"INTRODUÇÃO A BIOTECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30089","nome":"HIGIENE E CONTROLE DE QUALIDADE NA INDÚSTRIA DE ALIMENTÍCIOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30152","nome":"TECNOLOGIA E SOCIEDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30153","nome":"LÍNGUA CASTELHANA E ORIGINÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30154","nome":"ARTES PLÁSTICAS E VISUAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30155","nome":"EDUCAÇÃO FÍSICA E ESPORTES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30156","nome":"TÉCNICA TECNOLÓGICA GERAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30157","nome":"COSMOVISÕES,FILOSOFIA E PSICOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30158","nome":"VALORES,ESPIRITUALIDADE E RELIGIÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30159","nome":"METODOLOGIA DO TRABALHO CIENTÍFICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30160","nome":"LEGISLAÇÃO DO EXERCÍCIO PROFISSIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30161","nome":"ANATOMIA E FISIOLOGIA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30162","nome":"PSICOLOGIA APLICADA A ENFERMAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30163","nome":"MICROBIOLOGIA E PARASITOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30164","nome":"ANATOMIA E FISIOLOGIA II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30171","nome":"CIÊNCIAS E SABERES DO CAMPO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30172","nome":"ORDEM UNIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30173","nome":"JOVEM EMPREENDEDOR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30174","nome":"LÍNGUA PORTUGUESA - PRODUÇÃO DE TEXTUAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30175","nome":"LÍNG PORTUGUESA LIT. E EST. DE TEXTOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30176","nome":"LEITURA ESCRITA E ORALIDADE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30177","nome":"NÚMEROS E OPERAÇÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30178","nome":"ESPAÇO E FORMA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30179","nome":"GRANDEZA E MEDIDAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30180","nome":"VIDA E MEIO AMBIENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30181","nome":"GINÁSTICA E ESPORTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30182","nome":"FAZER ARTISTICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30184","nome":"APROFUNDAMENTO EM LEITURA ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30185","nome":"EDUCAÇÃO CIDADANIA E TECNOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30186","nome":"EDUCAÇÃO FÍSICA/ESP. EM GRUPO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30187","nome":"COMUNICAÇÃO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30188","nome":"REDAÇÃO I E II - LITERATURA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30189","nome":"MATEMÁTICA PARA AL. ESTRANGEIROS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30190","nome":"CIENCIAS INTEGRADA I E II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30191","nome":"HISTÓRIA I E II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30192","nome":"LIV(LABORATÓRIO DE VIDA)","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30193","nome":"METODOLOGIA E ELABORAÇÃO DE PROJETOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30194","nome":"COOPERATIVISMO E EMPREENDEDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30195","nome":"MANEJO ECOLOGICO DO SOLO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30196","nome":"AGRICULTURA SUSTENTAVEL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30197","nome":"GESTAO DA PROPRIEDADE ECOLOGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30198","nome":"PLANOS DE ESTUDO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30199","nome":"TUTORIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30200","nome":"ATIVIDADES PRATICAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30201","nome":"SERÕES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30202","nome":"ESTÁGIO SUPERV. ÁREA SOCIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30203","nome":"SERVIÇOS DE VENDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30204","nome":"PROJETO DE VIDA/PÓS MÉDIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30205","nome":"PROJETOS DE APRENDIZAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30206","nome":"LINGUAGEM: ORAL, LEITURA E ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30207","nome":"LITERATURA/CONTAÇÃO DE HISTÓRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30208","nome":"LUDICIDADE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30213","nome":"PROGRAMAÇÃO E ARQUITETURA DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30214","nome":"TÓPICOS DE INFRAESTRUTURA DE INFORMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30215","nome":"FUNDAMENTOS DOS SISTEMAS OPERACIONAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30216","nome":"ORGANIZAÇÃO DE REDES DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30217","nome":"MONTAGEM E MANUTENÇÃO DE COMPUTADORES","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30218","nome":"OFICINAS DE LÍNGUA PORTUGUESA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30219","nome":"OFERTA ELETIVA - ROBÓTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30220","nome":"PROJETO INTEGRADOR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30221","nome":"PROJETO ORIENTADOR DE TURMA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30222","nome":"ESTUDOS ORIENTADOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30223","nome":"CLUBE JUVENIL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30224","nome":"CONTAÇÃO DE HISTÓRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30225","nome":"PROJETO TÉCNICO CIENTÍFICO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30226","nome":"EDUCAÇÃO FÍSICA/XADREZ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30227","nome":"FORMAÇÃO CRISTÃ","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30228","nome":"OFICINA TECNOLÓGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30229","nome":"INOVAÇÃO E EMPREENDEDORISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30230","nome":"IDIOMA DESENVOLVIMENTAL - INGLES PARA FALANTES DE OUTRAS LINGUAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30231","nome":"INGLES 3 ATRAVES DE INGLES FALANTES DE OUTRAS LINGUAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30232","nome":"ESPORTES INDIVIDUAIS E EM DUPLA 1","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30233","nome":"ESPORTES INDIVIDUAIS E EM DUPLA 2","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30234","nome":"CIENCIA NAVAL 1","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30235","nome":"ESPANHOL 1","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30236","nome":"VIDA EM FAMÍLIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30237","nome":"VIDA EM FAMÍLIA E ECONOMIA DOMÉSTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30238","nome":"EDUCAÇÃO SOCIOEMOCIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30239","nome":"MOVIMENTO/CULTURA CORPORAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30240","nome":"IDENTIDADE, AUTONOMIA E INDEPENDÊNCIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30241","nome":"EIXO INTEGRADOR DE LINGUAGENS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30242","nome":"EIXO INTEGRADOR DE MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30243","nome":"EIXO INTEGRADOR DE CIÊNCIAS DA NATUREZA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30244","nome":"EIXO INTEGRADOR DE CIÊNCIAS DA HUMANAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30245","nome":"VALORES, ESPIRITUALIDADE E RELIGIOSO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30246","nome":"ARTES PLASTICAS E VISUAIS TÉCNICA E TECNOLÓGICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30247","nome":"INTRODUÇÃO À ELETROMECÂNICA E MECÂNICA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30248","nome":"ANÁLISE LINGUÍSTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30249","nome":"PROD. DE TEXTO/ESCRITA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30250","nome":"EDUCAÇÃO LITERÁRIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30251","nome":"CULTURA DO RIO GRANDE DO NORTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30252","nome":"INTRODUÇÃO À ELETROMECÂNICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30253","nome":"MECÂNICA APLICADA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30254","nome":"HISTÓRIA INDÍGENA HALITI","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30262","nome":"HABILIDADES DIGITAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30263","nome":"ESCOLA DA INTELIGÊNCIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30264","nome":"ECONOMIA 4.0","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30265","nome":"ELETIVA I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30266","nome":"OFICINA/LEGO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30267","nome":"OFICINA LEGO/ROBÓTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30268","nome":"OFERTA ELETIVA: CULTURA, PATRIMÔNIO HISTÓRICO DE ALAGOAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30269","nome":"OFERTA ELETIVA: TEATRALIZANDO DANÇA E MÚSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30271","nome":"ESTUDOS FILOSÓFICOS, ANTROPOLÓGICOS E SOCIOLÓGICOS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30272","nome":"ELETIVA DE ARTE E RECICLAGEM","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30273","nome":"ATIVIDADES ACADÊMICAS COMPLEMENTARES OPTATIVAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30274","nome":"ATIVIDADES MOTORAS E LAZER","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30275","nome":"INIC. CIENT/CULT.DIG./TECNOL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30276","nome":"ATIVIDADES MONITORADAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30277","nome":"MUS/ARTES CÊNIC/ARTES VIS/LIBR","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30278","nome":"INTELIGÊNCIA EMOCIONAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30279","nome":"PRÁTICAS EXPERIMENTAIS - MATEMÁTICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30280","nome":"PRÁTICAS EXPERIMENTAIS - BIOLOGIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30281","nome":"PRÁTICAS EXPERIMENTAIS - FÍSICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30282","nome":"PRÁTICAS EXPERIMENTAIS - QUÍMICA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30287","nome":"OFERTA ELETIVA - QUÍMICA NO DIA A DIA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30317","nome":"CULTURA XACRIABA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30318","nome":"USO DO TERRITÓRIO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30319","nome":"LAB. DE CIÊNCIAS E TECNOLOGIAS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30320","nome":"SAÚDE PARA VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30343","nome":"DIVERSIDADE AFRODESCENDENTE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30344","nome":"HISTÓRIA DE PORTO SEGURO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30399","nome":"BILÍNGUE","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30400","nome":"EQUIP. E INST.","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30401","nome":"A. E FIS. HUMANA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30402","nome":"T. AGRICOLA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"30403","nome":"A. INDUSTRIAL","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31562","nome":"PENSAMENTO CIENTÍFICO I","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31563","nome":"PENSAMENTO CIENTÍFICO II","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31564","nome":"ESTUDO ORIENTADO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31565","nome":"PRÁTICAS EXPERIMENTAIS","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31566","nome":"PROJETO DE VIDA","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"fundamental","codigo":"31584","nome":"PROTAGONISMO","areaCodigo":"9","areaNome":"Parte Diversificada"},{"nivel":"medio","codigo":"5","nome":"MATEMÁTICA","areaCodigo":"1025","areaNome":"MATEMÁTICA E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"3","nome":"HISTÓRIA","areaCodigo":"1061","areaNome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"nivel":"medio","codigo":"4","nome":"GEOGRAFIA","areaCodigo":"1061","areaNome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"nivel":"medio","codigo":"13","nome":"FILOSOFIA","areaCodigo":"1061","areaNome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"nivel":"medio","codigo":"19","nome":"SOCIOLOGIA","areaCodigo":"1061","areaNome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"nivel":"medio","codigo":"30488","nome":"FILOSOFIA IF/TA","areaCodigo":"1061","areaNome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"nivel":"medio","codigo":"7","nome":"ARTE","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"8","nome":"EDUCAÇÃO FÍSICA","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"17","nome":"LINGUA PORTUGUESA","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"24","nome":"L.ESTRANG (INGLÊS)","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"26","nome":"L.ESTRANG (ESPANHOL)","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"289","nome":"LÍNGUA MATERNA","areaCodigo":"1062","areaNome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"14","nome":"BIOLOGIA","areaCodigo":"1063","areaNome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"15","nome":"FÍSICA","areaCodigo":"1063","areaNome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"nivel":"medio","codigo":"18","nome":"QUÍMICA","areaCodigo":"1063","areaNome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"}];
const LAH_AREAS = [{"codigo":"27","nome":"ADMINISTRAÇÃO RURAL"},{"codigo":"150","nome":"AGROINDÚSTRIA"},{"codigo":"18","nome":"ÁREA DE CIÊNCIAS DA NATUREZA"},{"codigo":"17","nome":"ÁREA DE CIÊNCIAS HUMANAS"},{"codigo":"26","nome":"ÁREA GLOBALIZADA"},{"codigo":"148","nome":"ÁREA PROFISSIONAL"},{"codigo":"979","nome":"Artes e suas Tecnologias"},{"codigo":"982","nome":"atividades integradoras"},{"codigo":"1037","nome":"ATIVIDADES INTEGRADORAS"},{"codigo":"30","nome":"BASE NACIONAL COMUM"},{"codigo":"458","nome":"BASE PROFISSIONALIZANTE"},{"codigo":"561","nome":"BASE TÉCNICA"},{"codigo":"562","nome":"BASE TÉCNICA"},{"codigo":"187","nome":"BASE TÉCNICA"},{"codigo":"983","nome":"c.m de ciencias"},{"codigo":"563","nome":"CIÊNCIAS AGRÁRIAS"},{"codigo":"460","nome":"CIÊNCIAS AGRÁRIAS"},{"codigo":"973","nome":"Ciências Básicas e suas Tecnologias"},{"codigo":"464","nome":"CIÊNCIAS DA LINGUAGEM"},{"codigo":"569","nome":"CIÊNCIAS DA NATUREZA"},{"codigo":"459","nome":"CIÊNCIAS DA NATUREZA E MATEMATICA"},{"codigo":"1024","nome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"codigo":"1032","nome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"codigo":"1063","nome":"CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"codigo":"570","nome":"CIÊNCIAS DA NATUREZA MATEMÁTICA E SUAS TECNOLOGIAS"},{"codigo":"455","nome":"CIÊNCIAS E SABERES INDÍGENAS"},{"codigo":"462","nome":"CIÊNCIAS E SABERES QUILOMBOLA"},{"codigo":"980","nome":"Ciências e Tecnologias"},{"codigo":"996","nome":"CIÊNCIAS EXATAS E NATURAIS"},{"codigo":"7","nome":"CIÊNCIAS HUMAN. E SUAS TECNOL."},{"codigo":"3","nome":"CIÊNCIAS HUMANAS"},{"codigo":"454","nome":"CIÊNCIAS HUMANAS"},{"codigo":"567","nome":"CIENCIAS HUMANAS"},{"codigo":"8","nome":"CIÊNCIAS HUMANAS E SOCIAIS"},{"codigo":"1061","nome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"codigo":"1022","nome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"codigo":"1031","nome":"CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"codigo":"441","nome":"CIÊNCIAS HUMANAS E SOCIAIS E SUA TECNOLOGIAS"},{"codigo":"566","nome":"CIÊNCIAS HUMANAS E SUAS TÉCNOLOGIAS"},{"codigo":"468","nome":"CIÊNCIAS HUMANAS, AMBIENTAIS E SOCIAIS"},{"codigo":"6","nome":"CIÊNCIAS NATUR. MAT. E TECNOL."},{"codigo":"573","nome":"Ciências Natur. Mat. e Tecnologias"},{"codigo":"984","nome":"CIÊNCIAS NATURAIS E EXATAS"},{"codigo":"467","nome":"CIÊNCIAS NATURAIS E LINGUAGEM MATEMÁTICA"},{"codigo":"4","nome":"CIÊNCIAS NATURAIS E MATEMÁTICA"},{"codigo":"13","nome":"CIÊNCIAS SOCIAIS"},{"codigo":"977","nome":"Ciências sociais e suas Tecnologias"},{"codigo":"576","nome":"COMUNICAÇÃO, ATIVIDADE DE VIDA DIÁRIA, ORIENTAÇÃO E MOBILIDADE"},{"codigo":"51","nome":"CONHECIMENTO LINGUISTICO"},{"codigo":"575","nome":"CONHECIMENTO LINGUÍSTICO, CONHECIMENTO MATEMÁTICO,CONHECIMENTO NATURAL E SOCIAL"},{"codigo":"50","nome":"CONHECIMENTO MATEMÁTICO"},{"codigo":"52","nome":"CONHECIMENTO NATURAL E SOCIAL"},{"codigo":"16","nome":"CONHECIMENTOS LINGUISTICO, MATEMÁTICO, NATURAL E SOCIAL"},{"codigo":"978","nome":"Ed. Física e suas Tecnologias"},{"codigo":"578","nome":"EDUCAÇÃO EM DIREITOS HUMANOS"},{"codigo":"989","nome":"EDUCAÇÃO FISICA"},{"codigo":"565","nome":"EDUCAÇÃO PROFISSIONAL"},{"codigo":"1021","nome":"ELETIVAS"},{"codigo":"450","nome":"ENSINO CULTURAL"},{"codigo":"164","nome":"ENSINO POR ATIVIDADES"},{"codigo":"540","nome":"ENSINO PROFISSIONAL"},{"codigo":"558","nome":"ENSINO PROFISSIONALIZANTE"},{"codigo":"971","nome":"ESPECÍFICO"},{"codigo":"579","nome":"ESPORTE E LAZER"},{"codigo":"1001","nome":"Eu, Outro, Nós; Corpo e movimento; Traço, som, cor, forma; Linguagem, pensamento, imaginação"},{"codigo":"580","nome":"EXPERIMENTOS EM FÍSICA COM PREPARAÇÃO PARA AS OLIMPÍADAS"},{"codigo":"523","nome":"FORMAÇÃO DE MAGISTÉRIO"},{"codigo":"188","nome":"FORMAÇÃO E ETICA"},{"codigo":"564","nome":"FORMAÇÃO ESPECIFICA"},{"codigo":"559","nome":"FORMAÇÃO PROFISSIONAL"},{"codigo":"577","nome":"FUNDAMENTOS DA EDUCAÇÃO E CONHECIMENTOS DIDÁTICOS E METODOLÓGICOS"},{"codigo":"560","nome":"FUNDAMENTOS DA EDUCAÇÃO, PLANEJAMENTO CURRICULAR, VIVÊNCIA PEDAGÓGICA"},{"codigo":"448","nome":"GEOGRAFIA DO PARANÁ"},{"codigo":"969","nome":"GERAL"},{"codigo":"451","nome":"HISTÓRIA DA CULTURA PERNAMBUCANA"},{"codigo":"444","nome":"HISTORIA DO PARANA"},{"codigo":"149","nome":"INFORMÁTICA"},{"codigo":"28","nome":"INFORMÁTICA"},{"codigo":"1035","nome":"INICIAÇÃO PARA O MUNDO DO TRABALHO NA INDÚSTRIA"},{"codigo":"966","nome":"INTRODUTÓRIO"},{"codigo":"1064","nome":"ITINERÁRIO FORMATIVO"},{"codigo":"1212","nome":"ITINERÁRIO FORMATIVO DE CIÊNCIAS DA NATUREZA E CIÊNCIAS HUMANAS E SOCIAS APLICADAS"},{"codigo":"1209","nome":"ITINERÁRIO FORMATIVO DE CIÊNCIAS DA NATUREZA E SUAS TENCOLOGIAS E MATEMÁTICA"},{"codigo":"1208","nome":"ITINERÁRIO FORMATIVO DE LINGUAGENS E SUAS TECNOLOGIAS E CIÊNCIAS HUMANAS E SOCIAS APLICADAS"},{"codigo":"1211","nome":"ITINERÁRIO FORMATIVO DE MATEMÁTICA E SUAS TECNOLOGIAS E CIÊNCIAS HUMANAS E SOCIAS APLICADAS"},{"codigo":"997","nome":"LEGISLAÇÃO DO EXERCÍCIO PROFISSIONAL"},{"codigo":"972","nome":"Língua, Literatura e suas Tecnologias"},{"codigo":"14","nome":"LINGUAGEM"},{"codigo":"1","nome":"LINGUAGEM"},{"codigo":"471","nome":"LINGUAGEM E CIÊNCIAS HUMANAS"},{"codigo":"1034","nome":"LINGUAGEM E SUAS TECNOLOGIAS"},{"codigo":"91","nome":"LINGUAGEM, CIÊNCIAS NATURAIS E MATEMÁTICA, CIÊNCIAS HUMANAS"},{"codigo":"472","nome":"LINGUAGEM, MATEMÁTICA,CIÊNCIAS DA NATUREZA, CIÊNCIAS HUMANAS"},{"codigo":"442","nome":"LINGUAGENS"},{"codigo":"1023","nome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"codigo":"1062","nome":"LINGUAGENS E SUAS TECNOLOGIAS"},{"codigo":"988","nome":"LINGUAGENS, CIÊNCIAS EXATAS E NATURAIS, CIÊNCIAS HUMANAS E SOCIAIS"},{"codigo":"5","nome":"LINGUAGENS, COD. E TECNOLOGIAS"},{"codigo":"572","nome":"LINGUAGENS, MATEMÁTICA, CIÊNCIAS DA NATUREZA, CIÊNCIAS HUMANAS"},{"codigo":"574","nome":"LINGUAGENS, MATEMÁTICA, CIÊNCIAS DA NATUREZA, CIÊNCIAS HUMANAS, CIÊNCIAS E SABERES INDIGENAS"},{"codigo":"10","nome":"LNG"},{"codigo":"568","nome":"MATEMÁTICA"},{"codigo":"473","nome":"MATEMÁTICA E CIÊNCIAS DA NATUREZA"},{"codigo":"974","nome":"Matemática e suas Tecnologias"},{"codigo":"1033","nome":"MATEMÁTICA E SUAS TECNOLOGIAS"},{"codigo":"1025","nome":"MATEMÁTICA E SUAS TECNOLOGIAS"},{"codigo":"161","nome":"MEIO AMBIENTE"},{"codigo":"1210","nome":"NÚCLEO ARTICULADOR COM ÊNFASE EM LÍNGUAS"},{"codigo":"445","nome":"OFICINA DE GEOMETRIA"},{"codigo":"446","nome":"OFICINA DE PRODUÇÃO DE TEXTO"},{"codigo":"58","nome":"OUTRAS DISCIPLINAS"},{"codigo":"999","nome":"PARTE COMPLEMENTAR"},{"codigo":"48","nome":"PARTE DIVERSIFICADA"},{"codigo":"9","nome":"Parte Diversificada"},{"codigo":"959","nome":"PEDAGÓGICO"},{"codigo":"1060","nome":"PRÁTICAS ESPORTIVAS"},{"codigo":"986","nome":"Produções Interativas"},{"codigo":"1020","nome":"PROJETO DE VIDA"},{"codigo":"522","nome":"PROJETOS"},{"codigo":"571","nome":"PROJETOS MACROCAMPOS"},{"codigo":"447","nome":"QUALIDADE DE VIDA ATRAVÉS DA CIÊNCIAS"},{"codigo":"987","nome":"Raciocínio Lógico"},{"codigo":"1036","nome":"TAI EM LINGUAGENS E SUAS TECNOLOGIAS E CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS"},{"codigo":"1028","nome":"TAI EM MATEMÁTICA E SUAS TECNOLOGIAS E CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"},{"codigo":"449","nome":"TECNICO EDUCAÇÃO FISICA"},{"codigo":"1047","nome":"TRILHA DE APROFUNDAMENTO - CIÊNCIA DA NATUREZA"},{"codigo":"1059","nome":"TRILHA DE APROFUNDAMENTO - CIÊNCIA HUMANAS E SOCIAIS APLICADAS"},{"codigo":"1057","nome":"TRILHA DE APROFUNDAMENTO - EDUCAÇÃO PROFISSIONAL TECNOLÓGICA"},{"codigo":"1030","nome":"TRILHA DE APROFUNDAMENTO - LINGUAGENS"},{"codigo":"1058","nome":"TRILHA DE APROFUNDAMENTO - MATEMÁTICA"},{"codigo":"1066","nome":"TRILHA DE APROFUNDAMENTO DE CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS (CNT)"},{"codigo":"1065","nome":"TRILHA DE APROFUNDAMENTO DE CIÊNCIAS HUMANAS E SOCIAIS APLICADAS (CHSA)"},{"codigo":"1116","nome":"TRILHA DE APROFUNDAMENTO EPT"},{"codigo":"1213","nome":"TRILHA DE APROFUNDAMENTO EPT MANUTENÇÃO AUTOMOTIVA"},{"codigo":"1214","nome":"TRILHA DE APROFUNDAMENTO EPT QUÍMICA"},{"codigo":"1215","nome":"TRILHA DE APROFUNDAMENTO EPT SEGURANÇA DO TRABALHO"}];
const LAH_AREAS_POR_CODIGO = new Map(LAH_AREAS.map(item => [item.codigo, item.nome]));
const LAH_SUGESTOES_COMUNS = {
    fundamental: [
        ['17', '442'], // Língua Portuguesa
        ['5', '568'],  // Matemática
        ['16560', '569'], // Ciências da Natureza
        ['3', '567'],  // História
        ['4', '567'],  // Geografia
        ['24', '442'], // Língua Estrangeira — Inglês
        ['8', '442'],  // Educação Física
        ['7', '442']   // Arte
    ],
    medio: [
        ['17', '1062'], // Língua Portuguesa
        ['5', '1025'],  // Matemática
        ['14', '1063'], // Biologia
        ['15', '1063'], // Física
        ['18', '1063'], // Química
        ['3', '1061'],  // História
        ['4', '1061'],  // Geografia
        ['24', '1062'], // Língua Estrangeira — Inglês
        ['8', '1062'],  // Educação Física
        ['7', '1062'],  // Arte
        ['13', '1061'], // Filosofia
        ['19', '1061']  // Sociologia
    ]
};

var lahGuiState = null;
var lahMunicipios = [];
var lahMunicipiosPorRotulo = new Map();
var lahFavoritos = new Set();
var lahSaveTimer = null;
var lahSearchTimer = null;
var lahSearchTarget = null;
var lahSearchScrollPosition = 0;
var lahStudentNameObserver = null;
var lahObservedStudentNameNode = null;
var lahObservedStudentCodeNode = null;
var lahStudentMonitorTimer = null;

function lahGerarId(prefixo) {
    return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lahCriarDisciplina(seed = {}) {
    const areaCodigo = String(seed.areaCodigo || '');
    return {
        id: seed.id || lahGerarId('disc'),
        nome: String(seed.nome || ''),
        areaCodigo,
        areaNome: String(seed.areaNome || LAH_AREAS_POR_CODIGO.get(areaCodigo) || ''),
        disciplinaCodigo: String(seed.disciplinaCodigo || ''),
        resultado: String(seed.resultado || '').toLocaleUpperCase('pt-BR'),
        cargaHoraria: String(seed.cargaHoraria || '').replace(/\D/g, '')
    };
}

function lahCriarAno(seed = {}) {
    const disciplinas = Array.isArray(seed.disciplinas) && seed.disciplinas.length
        ? seed.disciplinas.map(lahCriarDisciplina)
        : [lahCriarDisciplina()];

    return {
        id: seed.id || lahGerarId('ano'),
        ano: String(seed.ano || '').replace(/\D/g, '').slice(0, 4),
        serieCodigo: String(seed.serieCodigo || ''),
        nivel: seed.nivel === 'medio' ? 'medio' : 'fundamental',
        escola: String(seed.escola || '').toLocaleUpperCase('pt-BR'),
        cidadeNome: String(seed.cidadeNome || ''),
        cidadeCodigo: String(seed.cidadeCodigo || ''),
        cargaTotal: String(seed.cargaTotal || '').replace(/\D/g, ''),
        observacao: String(seed.observacao || ''),
        modo: seed.modo === 'area' ? 'area' : 'disciplinas',
        areaCodigo: String(seed.areaCodigo || ''),
        conceito: String(seed.conceito || '').toLocaleUpperCase('pt-BR'),
        disciplinas
    };
}

function lahEstadoInicial() {
    const codigoPagina = lahCodigoAlunoDaPagina();
    const primeiroAno = lahCriarAno();
    return {
        versao: LAH_DRAFT_VERSION,
        codigoAluno: codigoPagina,
        anoAtivoId: primeiroAno.id,
        anos: [primeiroAno]
    };
}

function lahNormalizarEstado(raw) {
    const estado = raw && typeof raw === 'object' ? raw : {};
    const anos = Array.isArray(estado.anos) && estado.anos.length
        ? estado.anos.map(lahCriarAno)
        : [lahCriarAno()];
    const anoAtivoId = estado.anoAtivoId && anos.some(item => item.id === estado.anoAtivoId)
        ? estado.anoAtivoId
        : '';
    return {
        versao: LAH_DRAFT_VERSION,
        codigoAluno: String(estado.codigoAluno || '').replace(/\D/g, ''),
        anoAtivoId,
        anos
    };
}

function lahCodigoAlunoDaPagina() {
    const campo = document.getElementById('vGEDALUCOD');
    return campo ? String(campo.value || '').replace(/\D/g, '') : '';
}

function lahNomeAlunoDaPagina() {
    const span = document.getElementById('span_vGEDALUNOM');
    return span ? String(span.textContent || '').trim() : '';
}

function lahSincronizarCodigoComPagina(codigo, confirmar = false) {
    const campo = document.getElementById('vGEDALUCOD');
    if (!campo) return;

    const valor = String(codigo || '').replace(/\D/g, '');
    if (String(campo.value || '').trim() !== valor) {
        const descritor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descritor?.set) descritor.set.call(campo, valor);
        else campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (confirmar) campo.dispatchEvent(new Event('change', { bubbles: true }));
}

function lahSincronizarAlunoDaPagina() {
    if (!lahGuiState) return;
    const codigoPagina = lahCodigoAlunoDaPagina();
    if (codigoPagina && codigoPagina !== lahGuiState.codigoAluno) {
        lahGuiState.codigoAluno = codigoPagina;
        lahAgendarSalvamento();
    }
    lahRenderizarCabecalhoAluno();
}

function lahInstalarMonitorAlunoPagina() {
    const campoCodigo = document.getElementById('vGEDALUCOD');
    if (campoCodigo && campoCodigo !== lahObservedStudentCodeNode) {
        lahObservedStudentCodeNode = campoCodigo;
        campoCodigo.addEventListener('input', lahSincronizarAlunoDaPagina);
        campoCodigo.addEventListener('change', lahSincronizarAlunoDaPagina);
    }

    const spanNome = document.getElementById('span_vGEDALUNOM');
    if (spanNome && spanNome !== lahObservedStudentNameNode) {
        lahStudentNameObserver?.disconnect();
        lahObservedStudentNameNode = spanNome;
        lahStudentNameObserver = new MutationObserver(lahRenderizarCabecalhoAluno);
        lahStudentNameObserver.observe(spanNome, {
            childList: true,
            characterData: true,
            subtree: true
        });
        lahRenderizarCabecalhoAluno();
    }
}

function lahEscape(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function lahSelected(atual, esperado) {
    return atual === esperado ? ' selected' : '';
}

function lahChaveDisciplina(item) {
    if (!item) return '';
    return `${item.nivel}|${item.areaCodigo}|${item.codigo}`;
}

function lahCarregarFavoritos() {
    const bruto = GM_getValue(LAH_FAVORITOS_KEY, '[]');
    try {
        const itens = JSON.parse(bruto);
        lahFavoritos = new Set(Array.isArray(itens) ? itens.map(String) : []);
    } catch (erro) {
        console.warn('Lista de disciplinas favoritas inválida.', erro);
        lahFavoritos = new Set();
    }
}

function lahSalvarFavoritos() {
    GM_setValue(LAH_FAVORITOS_KEY, JSON.stringify([...lahFavoritos]));
}

function lahIndiceDisciplinaSelecionada(ano, disciplina) {
    if (!ano || !disciplina?.areaCodigo || !disciplina?.disciplinaCodigo) return -1;
    return LAH_DISCIPLINAS.findIndex(item =>
        item.nivel === ano.nivel
        && item.areaCodigo === disciplina.areaCodigo
        && item.codigo === disciplina.disciplinaCodigo
    );
}

function lahAlternarFavorito(indice) {
    const item = LAH_DISCIPLINAS[Number(indice)];
    if (!item) return false;
    const chave = lahChaveDisciplina(item);
    if (lahFavoritos.has(chave)) lahFavoritos.delete(chave);
    else lahFavoritos.add(chave);
    lahSalvarFavoritos();
    return true;
}

function lahMarkupResultadoDisciplina(item, indice) {
    const favorita = lahFavoritos.has(lahChaveDisciplina(item));
    const acaoFavorito = favorita ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    const nivelRotulo = item.nivel === 'medio' ? 'Ensino Médio' : 'Ensino Fundamental';
    return `
        <div class="lah-search-result-row">
            <button type="button"
                class="lah-search-favorite ${favorita ? 'is-favorite' : ''}"
                data-favorite-index="${indice}"
                aria-label="${lahEscape(`${acaoFavorito}: ${item.nome} — ${item.areaNome} — ${nivelRotulo}`)}"
                title="${acaoFavorito}">
                ${favorita ? '★' : '☆'}
            </button>
            <button type="button" class="lah-search-result" data-disciplina-index="${indice}">
                <strong>${lahEscape(item.nome)}</strong>
                <small>${lahEscape(item.areaNome)} · ${nivelRotulo}</small>
            </button>
        </div>
    `;
}

function lahCarregarRascunho() {
    const bruto = GM_getValue(LAH_DRAFT_KEY, '');
    if (!bruto) return lahEstadoInicial();

    try {
        const estado = lahNormalizarEstado(JSON.parse(bruto));
        const codigoPagina = lahCodigoAlunoDaPagina();
        if (!estado.codigoAluno && codigoPagina) estado.codigoAluno = codigoPagina;
        return estado;
    } catch (erro) {
        console.warn('Rascunho local inválido; iniciando um novo.', erro);
        return lahEstadoInicial();
    }
}

function lahSalvarRascunho(mensagem = 'Rascunho salvo localmente') {
    GM_setValue(LAH_DRAFT_KEY, JSON.stringify(lahGuiState));
    const status = document.getElementById('lahDraftStatus');
    if (status) status.textContent = `${mensagem} · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function lahAgendarSalvamento() {
    window.clearTimeout(lahSaveTimer);
    lahSaveTimer = window.setTimeout(() => lahSalvarRascunho('Salvo automaticamente'), 450);
}

function lahObterAno(id) {
    return lahGuiState.anos.find(item => item.id === id);
}

function lahObterDisciplina(ano, id) {
    return ano?.disciplinas.find(item => item.id === id);
}

function lahTituloAno(ano, indice) {
    const partes = [];
    if (ano.ano) partes.push(ano.ano);
    if (ano.serieCodigo) partes.push(LAH_SERIES_LABELS[ano.serieCodigo] || `série ${ano.serieCodigo}`);
    return partes.length ? partes.join(' · ') : `Ano ${indice + 1} — ainda não preenchido`;
}

function lahSubtituloAno(ano) {
    const etapa = ano.nivel === 'medio' ? 'Ensino Médio' : 'Ensino Fundamental';
    return `${etapa} · ${ano.escola || 'Escola não informada'}`;
}

function lahOpcoesSeries(ano) {
    const opcoes = LAH_SERIES[ano.nivel] || [];
    return [
        '<option value="">Selecione a série…</option>',
        ...opcoes.map(item =>
            `<option value="${lahEscape(item.codigo)}"${lahSelected(ano.serieCodigo, item.codigo)}>${lahEscape(item.nome)}</option>`
        )
    ].join('');
}

function lahOpcoesAreas(codigoAtual) {
    return [
        '<option value="">Selecione a área…</option>',
        ...LAH_AREAS.map(item =>
            `<option value="${lahEscape(item.codigo)}"${lahSelected(codigoAtual, item.codigo)}>${lahEscape(item.nome)}</option>`
        )
    ].join('');
}

function lahRenderDisciplina(ano, disciplina) {
    const indiceCatalogo = lahIndiceDisciplinaSelecionada(ano, disciplina);
    const itemCatalogo = LAH_DISCIPLINAS[indiceCatalogo];
    const selecionada = indiceCatalogo >= 0;
    const favorita = itemCatalogo ? lahFavoritos.has(lahChaveDisciplina(itemCatalogo)) : false;
    const acaoFavorito = favorita ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    return `
        <tr data-row="${lahEscape(disciplina.id)}">
            <td>
                <div class="lah-discipline-actions">
                    <button type="button" class="lah-search-discipline ${selecionada ? 'is-change' : 'is-search'}" data-action="pesquisar-disciplina" data-year="${lahEscape(ano.id)}" data-row="${lahEscape(disciplina.id)}">
                        <span aria-hidden="true">🔍</span> ${selecionada ? 'Alterar Disciplina' : 'Pesquisar Disciplina'}
                    </button>
                </div>
            </td>
            <td><input class="lah-readonly" value="${lahEscape(disciplina.nome || 'Nenhuma disciplina selecionada')}" aria-label="Disciplina selecionada" readonly></td>
            <td><input class="lah-readonly" value="${lahEscape(disciplina.areaNome || '')}" aria-label="Área de conhecimento" readonly></td>
            <td><input data-year="${lahEscape(ano.id)}" data-row="${lahEscape(disciplina.id)}" data-field="resultado" value="${lahEscape(disciplina.resultado)}" placeholder="7,5 ou PS"></td>
            <td><input data-year="${lahEscape(ano.id)}" data-row="${lahEscape(disciplina.id)}" data-field="cargaHoraria" value="${lahEscape(disciplina.cargaHoraria)}" inputmode="numeric" pattern="[0-9]*" placeholder="80"></td>
            <td>
                <div class="lah-row-actions">
                    <button type="button"
                        class="lah-favorite-button ${favorita ? 'is-favorite' : ''}"
                        data-action="alternar-favorito-inserido"
                        data-year="${lahEscape(ano.id)}"
                        data-row="${lahEscape(disciplina.id)}"
                        title="${acaoFavorito}"
                        aria-label="${lahEscape(`${acaoFavorito}: ${disciplina.nome || 'disciplina'}`)}"
                        ${indiceCatalogo < 0 ? 'disabled' : ''}>
                        ${favorita ? '★' : '☆'}
                    </button>
                    <button type="button" class="lah-remove-disc lah-danger" data-action="remover-disciplina" data-year="${lahEscape(ano.id)}" data-row="${lahEscape(disciplina.id)}" title="Remover disciplina" aria-label="Remover disciplina">
                        <span class="lah-remove-x" aria-hidden="true">×</span>
                        <span>Remover</span>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function lahRenderAno(ano, indice) {
    const modoDisciplinas = ano.modo === 'disciplinas';
    const ativo = lahGuiState.anoAtivoId === ano.id;
    return `
        <article class="lah-year-card ${ativo ? 'is-active' : 'is-collapsed'}" data-year-card="${lahEscape(ano.id)}">
            <header class="lah-year-head">
                <button type="button" class="lah-year-toggle" data-action="alternar-ano" data-year="${lahEscape(ano.id)}" aria-expanded="${ativo}">
                    <span class="lah-year-title">
                        <strong>${lahEscape(lahTituloAno(ano, indice))}</strong>
                        <span class="lah-muted lah-year-summary">${lahEscape(lahSubtituloAno(ano))}</span>
                    </span>
                    <span class="lah-expand-label">${ativo ? 'Recolher' : 'Expandir'}</span>
                </button>
                <span class="lah-year-actions">
                    <button type="button" data-action="duplicar-ano" data-year="${lahEscape(ano.id)}">Duplicar</button>
                    <button type="button" class="lah-danger" data-action="remover-ano" data-year="${lahEscape(ano.id)}">Remover</button>
                </span>
            </header>
            <div class="lah-year-collapse"${ativo ? '' : ' inert'}>
              <div class="lah-year-collapse-inner">
               <div class="lah-year-body">
                <div class="lah-grid">
                    <label class="lah-col-2">
                        Ano cursado
                        <input data-year="${lahEscape(ano.id)}" data-field="ano" value="${lahEscape(ano.ano)}" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="2006">
                    </label>
                    <label class="lah-col-3">
                        Etapa
                        <select data-year="${lahEscape(ano.id)}" data-field="nivel">
                            <option value="fundamental"${lahSelected(ano.nivel, 'fundamental')}>Ensino Fundamental</option>
                            <option value="medio"${lahSelected(ano.nivel, 'medio')}>Ensino Médio</option>
                        </select>
                    </label>
                    <label class="lah-col-4">
                        Série
                        <select data-year="${lahEscape(ano.id)}" data-field="serieCodigo">
                            ${lahOpcoesSeries(ano)}
                        </select>
                    </label>
                    <label class="lah-col-3">
                        Carga horária total (ou informe por disciplina)
                        <input data-year="${lahEscape(ano.id)}" data-field="cargaTotal" value="${lahEscape(ano.cargaTotal)}" inputmode="numeric" pattern="[0-9]*" placeholder="Ex: 800">
                    </label>
                    <label class="lah-col-8">
                        Nome da escola
                        <input data-year="${lahEscape(ano.id)}" data-field="escola" value="${lahEscape(ano.escola)}" autocomplete="off" placeholder="Nome conforme o documento">
                    </label>
                    <label class="lah-col-4">
                        Município
                        <span class="lah-municipio-picker">
                            <input data-year="${lahEscape(ano.id)}" data-field="cidadeNome" value="${lahEscape(ano.cidadeNome)}" autocomplete="off" aria-label="Município" placeholder="Digite o município, sem precisar usar acentos">
                            <span class="lah-municipio-results" data-municipio-results="${lahEscape(ano.id)}" hidden></span>
                        </span>
                    </label>
                    <label class="lah-col-4">
                        Tipo de lançamento
                        <select data-year="${lahEscape(ano.id)}" data-field="modo">
                            <option value="disciplinas"${lahSelected(ano.modo, 'disciplinas')}>Por disciplinas</option>
                            <option value="area"${lahSelected(ano.modo, 'area')}>Conceito único por área</option>
                        </select>
                    </label>
                    <label class="lah-col-8">
                        Observação (opcional)
                        <textarea data-year="${lahEscape(ano.id)}" data-field="observacao" placeholder="Observação que será gravada no histórico">${lahEscape(ano.observacao)}</textarea>
                    </label>
                </div>

                ${modoDisciplinas ? `
                    <div class="lah-subsection">
                        <div class="lah-subsection-head">
                            <h4>Disciplinas</h4>
                        </div>
                        <div class="lah-table-wrap">
                            <table class="lah-disc-table">
                                <thead>
                                    <tr>
                                        <th>Pesquisa</th>
                                        <th>Disciplina</th>
                                        <th>Área do conhecimento</th>
                                        <th>Nota / conceito</th>
                                        <th>CH</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>${ano.disciplinas.map(item => lahRenderDisciplina(ano, item)).join('')}</tbody>
                            </table>
                        </div>
                        <div class="lah-add-discipline-wrap">
                            <button type="button" class="lah-add-discipline" data-action="adicionar-disciplina" data-year="${lahEscape(ano.id)}">Adicionar Disciplina</button>
                        </div>
                    </div>
                ` : `
                    <div class="lah-subsection">
                        <div class="lah-grid">
                            <label class="lah-col-6">
                                Área de conhecimento
                                <select data-year="${lahEscape(ano.id)}" data-field="areaCodigo">
                                    ${lahOpcoesAreas(ano.areaCodigo)}
                                </select>
                            </label>
                            <label class="lah-col-6">
                                Conceito
                                <input data-year="${lahEscape(ano.id)}" data-field="conceito" value="${lahEscape(ano.conceito)}" placeholder="Ex.: PS">
                            </label>
                        </div>
                    </div>
                `}
               </div>
              </div>
            </div>
        </article>
    `;
}

function lahObterRolagemGui() {
    return document.getElementById('containerLAH')?.scrollTop || 0;
}

function lahRestaurarRolagemGui(posicao) {
    const painel = document.getElementById('containerLAH');
    if (!painel) return;
    const destino = Math.max(0, Number(posicao) || 0);
    const aplicar = () => {
        if (document.getElementById('containerLAH') === painel) {
            painel.scrollTop = destino;
        }
    };
    aplicar();
    window.requestAnimationFrame(() => {
        aplicar();
        window.requestAnimationFrame(aplicar);
    });
    [60, 180, 360].forEach(atraso => window.setTimeout(aplicar, atraso));
}

function lahRenderizarAnos(opcoes = {}) {
    const container = document.getElementById('lahYears');
    if (!container) return;
    const posicao = Number.isFinite(opcoes.scrollTop) ? opcoes.scrollTop : lahObterRolagemGui();
    container.innerHTML = lahGuiState.anos.map(lahRenderAno).join('');
    lahRestaurarRolagemGui(posicao);
}

function lahAtivarAnoNoDom(anoId) {
    document.querySelectorAll('#lahYears .lah-year-card').forEach(cartao => {
        const ativo = cartao.dataset.yearCard === anoId;
        cartao.classList.toggle('is-active', ativo);
        cartao.classList.toggle('is-collapsed', !ativo);
        cartao.querySelector('.lah-year-toggle')?.setAttribute('aria-expanded', String(ativo));
        cartao.querySelector('.lah-year-collapse')?.toggleAttribute('inert', !ativo);
        const rotulo = cartao.querySelector('.lah-expand-label');
        if (rotulo) rotulo.textContent = ativo ? 'Recolher' : 'Expandir';
    });
}

function lahAtualizarResumoAnoNoDom(ano) {
    const indice = lahGuiState.anos.indexOf(ano);
    const cartao = [...document.querySelectorAll('#lahYears .lah-year-card')]
        .find(item => item.dataset.yearCard === ano.id);
    if (!cartao || indice < 0) return;
    const titulo = cartao.querySelector('.lah-year-title strong');
    const resumo = cartao.querySelector('.lah-year-summary');
    if (titulo) titulo.textContent = lahTituloAno(ano, indice);
    if (resumo) resumo.textContent = lahSubtituloAno(ano);
}

function lahNormalizarValorCampo(campo, valor) {
    const texto = String(valor || '');
    if (campo === 'ano') return texto.replace(/\D/g, '').slice(0, 4);
    if (campo === 'cargaTotal' || campo === 'cargaHoraria') return texto.replace(/\D/g, '');
    if (campo === 'escola' || campo === 'conceito' || campo === 'resultado') {
        return texto.toLocaleUpperCase('pt-BR');
    }
    return texto;
}

function lahRenderizarCabecalhoAluno() {
    const campo = document.getElementById('lahStudentCode');
    const hint = document.getElementById('lahStudentHint');
    if (campo && campo.value !== lahGuiState.codigoAluno) campo.value = lahGuiState.codigoAluno;

    if (!hint) return;
    const codigoPagina = lahCodigoAlunoDaPagina();
    const nomePagina = lahNomeAlunoDaPagina();

    if (codigoPagina && lahGuiState.codigoAluno && codigoPagina !== lahGuiState.codigoAluno) {
        hint.textContent = `Atenção: o SIGEDUCA está no aluno ${codigoPagina}${nomePagina ? ` (${nomePagina})` : ''}, mas o rascunho é do aluno ${lahGuiState.codigoAluno}.`;
        hint.style.color = '#b45309';
    } else if (codigoPagina) {
        hint.textContent = nomePagina
            ? `Aluno atual no SIGEDUCA: ${nomePagina}.`
            : `Código ${codigoPagina} sincronizado; aguardando o nome do aluno no SIGEDUCA.`;
        hint.style.color = '#64748b';
    } else {
        hint.textContent = 'O código pode ser preenchido automaticamente após consultar o aluno no SIGEDUCA.';
        hint.style.color = '#64748b';
    }
}

function lahRenderizarEditor() {
    lahRenderizarCabecalhoAluno();
    lahRenderizarAnos();
}

function lahAtualizarCampo(evento) {
    const alvo = evento.target;
    const campo = alvo.dataset.field;
    const anoId = alvo.dataset.year;
    if (!campo || !anoId) return;

    const ano = lahObterAno(anoId);
    if (!ano) return;

    const valorNormalizado = lahNormalizarValorCampo(campo, alvo.value);
    if (alvo.value !== valorNormalizado) alvo.value = valorNormalizado;

    if (alvo.dataset.row) {
        const disciplina = lahObterDisciplina(ano, alvo.dataset.row);
        if (!disciplina) return;
        disciplina[campo] = valorNormalizado;
    } else {
        ano[campo] = valorNormalizado;
    }

    if (campo === 'cidadeNome' && evento.type === 'input') {
        ano.cidadeCodigo = '';
        lahRenderizarSugestoesMunicipio(ano.id, alvo.value);
    }

    if (campo === 'cidadeNome' && evento.type === 'change') {
        lahResolverMunicipio(ano, alvo.value);
        if (ano.cidadeCodigo) lahFecharSugestoesMunicipio();
    }

    if (campo === 'nivel' && evento.type === 'change') {
        ano.serieCodigo = '';
        lahRenderizarAnos();
    } else if (campo === 'modo' && evento.type === 'change') {
        lahRenderizarAnos();
    } else {
        lahAtualizarResumoAnoNoDom(ano);
    }

    lahAgendarSalvamento();
}

function lahTratarCliqueAnos(evento) {
    const botao = evento.target.closest('button[data-action]');
    if (!botao) return;
    evento.preventDefault();
    evento.stopPropagation();

    const acao = botao.dataset.action;
    const ano = lahObterAno(botao.dataset.year);
    if (!ano) return;

    if (acao === 'alternar-ano') {
        lahGuiState.anoAtivoId = lahGuiState.anoAtivoId === ano.id ? '' : ano.id;
        lahAtivarAnoNoDom(lahGuiState.anoAtivoId);
        lahSalvarRascunho(lahGuiState.anoAtivoId ? 'Ano selecionado' : 'Todos os anos recolhidos');
        return;
    }

    if (acao === 'adicionar-disciplina') {
        const posicaoRolagem = lahObterRolagemGui();
        const novaDisciplina = lahCriarDisciplina();
        ano.disciplinas.push(novaDisciplina);
        lahGuiState.anoAtivoId = ano.id;
        lahRenderizarAnos({ scrollTop: posicaoRolagem });
        lahSalvarRascunho('Disciplina adicionada');
        window.requestAnimationFrame(() => {
            lahAbrirPesquisaDisciplina(ano.id, novaDisciplina.id);
        });
        return;
    }

    if (acao === 'pesquisar-disciplina') {
        lahAbrirPesquisaDisciplina(ano.id, botao.dataset.row);
        return;
    }

    if (acao === 'selecionar-municipio') {
        ano.cidadeNome = botao.dataset.municipioRotulo || '';
        ano.cidadeCodigo = botao.dataset.municipioCodigo || '';
        const campo = [...document.querySelectorAll('input[data-field="cidadeNome"]')]
            .find(item => item.dataset.year === ano.id);
        if (campo) campo.value = ano.cidadeNome;
        botao.closest('.lah-municipio-results')?.setAttribute('hidden', '');
        lahSalvarRascunho('Município selecionado');
        return;
    }

    if (acao === 'alternar-favorito-inserido') {
        const disciplina = lahObterDisciplina(ano, botao.dataset.row);
        const indiceCatalogo = lahIndiceDisciplinaSelecionada(ano, disciplina);
        if (indiceCatalogo >= 0 && lahAlternarFavorito(indiceCatalogo)) {
            lahRenderizarAnos();
        }
        return;
    }

    if (acao === 'remover-disciplina') {
        if (ano.disciplinas.length === 1) {
            ano.disciplinas = [lahCriarDisciplina()];
        } else {
            ano.disciplinas = ano.disciplinas.filter(item => item.id !== botao.dataset.row);
        }
    }

    if (acao === 'duplicar-ano') {
        const copia = lahCriarAno(JSON.parse(JSON.stringify(ano)));
        copia.id = lahGerarId('ano');
        if (/^\d{4}$/.test(ano.ano.trim())) {
            copia.ano = String(Number(ano.ano) + 1);
        }
        copia.conceito = '';
        copia.disciplinas = copia.disciplinas.map(item => ({
            ...item,
            id: lahGerarId('disc'),
            resultado: '',
            cargaHoraria: ''
        }));
        lahGuiState.anos.splice(lahGuiState.anos.indexOf(ano) + 1, 0, copia);
        lahGuiState.anoAtivoId = copia.id;
    }

    if (acao === 'remover-ano') {
        const descricao = ano.ano ? `o ano ${ano.ano}` : 'este cartão';
        if (!window.confirm(`Remover ${descricao} do rascunho?`)) return;
        lahGuiState.anos = lahGuiState.anos.filter(item => item.id !== ano.id);
        if (!lahGuiState.anos.length) lahGuiState.anos.push(lahCriarAno());
        if (!lahGuiState.anos.some(item => item.id === lahGuiState.anoAtivoId)) {
            lahGuiState.anoAtivoId = '';
        }
    }

    lahRenderizarAnos();
    lahSalvarRascunho();
}

function lahNormalizarBusca(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function lahAbrirPesquisaDisciplina(anoId, disciplinaId) {
    const ano = lahObterAno(anoId);
    const disciplina = lahObterDisciplina(ano, disciplinaId);
    if (!ano || !disciplina) return;

    lahSearchTarget = { anoId, disciplinaId };
    lahSearchScrollPosition = lahObterRolagemGui();
    const modal = document.getElementById('lahDisciplineModal');
    const campo = document.getElementById('lahDisciplineSearch');
    if (!modal || !campo) return;

    document.getElementById('containerLAH')?.classList.add('lah-modal-open');
    modal.hidden = false;
    campo.value = '';
    lahRenderizarResultadosDisciplina('');
    window.setTimeout(() => campo.focus(), 0);
}

function lahFecharPesquisaDisciplina() {
    const modal = document.getElementById('lahDisciplineModal');
    const estavaAberto = Boolean(modal && !modal.hidden);
    if (modal) modal.hidden = true;
    document.getElementById('containerLAH')?.classList.remove('lah-modal-open');
    if (estavaAberto) lahRestaurarRolagemGui(lahSearchScrollPosition);
    lahSearchTarget = null;
}

function lahPontuarResultado(item, consulta) {
    const nome = lahNormalizarBusca(item.nome);
    if (nome === consulta) return 0;
    if (nome.startsWith(consulta)) return 1;
    if (nome.includes(consulta)) return 2;
    return 3;
}

function lahObterMenuRapido() {
    const ano = lahObterAno(lahSearchTarget?.anoId);
    const nivel = ano?.nivel === 'medio' ? 'medio' : 'fundamental';
    const favoritas = LAH_DISCIPLINAS
        .map((item, indice) => ({ item, indice }))
        .filter(({ item }) => lahFavoritos.has(lahChaveDisciplina(item)))
        .sort((a, b) =>
            (a.item.nivel === nivel ? 0 : 1) - (b.item.nivel === nivel ? 0 : 1)
            || a.item.nome.localeCompare(b.item.nome, 'pt-BR')
        );
    const chavesFavoritas = new Set(favoritas.map(({ item }) => lahChaveDisciplina(item)));
    const frequentes = (LAH_SUGESTOES_COMUNS[nivel] || [])
        .map(([codigo, areaCodigo]) => {
            const indice = LAH_DISCIPLINAS.findIndex(item =>
                item.nivel === nivel
                && item.codigo === codigo
                && item.areaCodigo === areaCodigo
            );
            return indice >= 0 ? { item: LAH_DISCIPLINAS[indice], indice } : null;
        })
        .filter(opcao => opcao && !chavesFavoritas.has(lahChaveDisciplina(opcao.item)));
    return { favoritas, frequentes };
}

function lahRenderizarResultadosDisciplina(consultaBruta) {
    const container = document.getElementById('lahDisciplineResults');
    if (!container) return;

    const consulta = lahNormalizarBusca(consultaBruta);
    if (!consulta) {
        const menuRapido = lahObterMenuRapido();
        container.innerHTML = `
            ${menuRapido.favoritas.length ? `
                <div class="lah-search-summary">
                    Disciplinas favoritas · clique para adicionar
                </div>
                <div class="lah-search-suggestions">
                    ${menuRapido.favoritas.map(({ item, indice }) => lahMarkupResultadoDisciplina(item, indice)).join('')}
                </div>
            ` : ''}
            <div class="lah-search-summary">
                Disciplinas mais usadas · clique para adicionar
            </div>
            <div class="lah-search-suggestions">
                ${menuRapido.frequentes.map(({ item, indice }) => lahMarkupResultadoDisciplina(item, indice)).join('')}
            </div>
            <div class="lah-search-summary">
                Você também pode digitar parte do nome. Exemplo: “matema” encontra “MATEMÁTICA” e “MATEMATICA”.
            </div>
        `;
        return;
    }

    const termos = consulta.split(/\s+/).filter(Boolean);
    const anoAlvo = lahObterAno(lahSearchTarget?.anoId);
    const nivelAlvo = anoAlvo?.nivel === 'medio' ? 'medio' : 'fundamental';
    const encontrados = LAH_DISCIPLINAS
        .map((item, indice) => ({ item, indice }))
        .filter(({ item }) => {
            const texto = lahNormalizarBusca(`${item.nome} ${item.areaNome}`);
            return termos.every(termo => texto.includes(termo));
        })
        .sort((a, b) =>
            (a.item.nivel === nivelAlvo ? 0 : 1) - (b.item.nivel === nivelAlvo ? 0 : 1)
            || lahPontuarResultado(a.item, consulta) - lahPontuarResultado(b.item, consulta)
            || a.item.nome.localeCompare(b.item.nome, 'pt-BR')
            || a.item.areaNome.localeCompare(b.item.areaNome, 'pt-BR')
        );

    const limite = 100;
    const exibidos = encontrados.slice(0, limite);
    const resumo = encontrados.length
        ? `${encontrados.length.toLocaleString('pt-BR')} resultado(s)${encontrados.length > limite ? ` · mostrando os primeiros ${limite}` : ''}`
        : 'Nenhuma disciplina encontrada.';

    container.innerHTML = `
        <div class="lah-search-summary">${lahEscape(resumo)}</div>
        ${exibidos.map(({ item, indice }) => lahMarkupResultadoDisciplina(item, indice)).join('')}
    `;
}

function lahSelecionarDisciplina(indice) {
    const item = LAH_DISCIPLINAS[Number(indice)];
    const ano = lahObterAno(lahSearchTarget?.anoId);
    const disciplina = lahObterDisciplina(ano, lahSearchTarget?.disciplinaId);
    if (!item || !ano || !disciplina) return;

    disciplina.nome = item.nome;
    disciplina.areaCodigo = item.areaCodigo;
    disciplina.areaNome = item.areaNome;
    disciplina.disciplinaCodigo = item.codigo;
    lahGuiState.anoAtivoId = ano.id;
    lahFecharPesquisaDisciplina();
    lahRenderizarAnos({ scrollTop: lahSearchScrollPosition });
    lahSalvarRascunho('Disciplina selecionada');
}

function lahRenderizarMunicipios() {
    lahMunicipiosPorRotulo = new Map();
    lahMunicipios.forEach(item => {
        lahMunicipiosPorRotulo.set(lahNormalizarBusca(item.rotulo), item);
        const chaveNome = lahNormalizarBusca(item.nome);
        if (!lahMunicipiosPorRotulo.has(chaveNome)) {
            lahMunicipiosPorRotulo.set(chaveNome, item);
        }
    });
}

function lahContainerResultadosMunicipio(anoId) {
    return [...document.querySelectorAll('[data-municipio-results]')]
        .find(item => item.dataset.municipioResults === anoId);
}

function lahFecharSugestoesMunicipio() {
    document.querySelectorAll('[data-municipio-results]').forEach(item => {
        item.hidden = true;
    });
}

function lahRenderizarSugestoesMunicipio(anoId, consultaBruta) {
    const container = lahContainerResultadosMunicipio(anoId);
    if (!container) return;

    const consulta = lahNormalizarBusca(consultaBruta);
    if (consulta.length < 2 || !lahMunicipios.length) {
        container.hidden = true;
        container.replaceChildren();
        return;
    }

    const somenteDigitos = consulta.replace(/\D/g, '');
    const resultados = lahMunicipios
        .map(item => {
            const nome = lahNormalizarBusca(item.nome);
            const rotulo = lahNormalizarBusca(item.rotulo);
            let prioridade = 99;
            if (nome.startsWith(consulta)) prioridade = 0;
            else if (nome.split(/\s+/).some(parte => parte.startsWith(consulta))) prioridade = 1;
            else if (nome.includes(consulta)) prioridade = 2;
            else if (rotulo.includes(consulta)) prioridade = 3;
            else if (somenteDigitos && item.codigo.startsWith(somenteDigitos)) prioridade = 4;
            return { item, prioridade };
        })
        .filter(resultado => resultado.prioridade < 99)
        .sort((a, b) =>
            a.prioridade - b.prioridade
            || a.item.nome.localeCompare(b.item.nome, 'pt-BR')
            || a.item.uf.localeCompare(b.item.uf, 'pt-BR')
        )
        .slice(0, 25);

    container.innerHTML = resultados.length
        ? resultados.map(({ item }) => `
            <button type="button"
                class="lah-municipio-option"
                data-action="selecionar-municipio"
                data-year="${lahEscape(anoId)}"
                data-municipio-codigo="${lahEscape(item.codigo)}"
                data-municipio-rotulo="${lahEscape(item.rotulo)}">
                <strong>${lahEscape(item.nome)}</strong>
                <small>${lahEscape(item.uf || 'UF não informada')} · código ${lahEscape(item.codigo)}</small>
            </button>
        `).join('')
        : '<div class="lah-search-summary">Nenhum município encontrado pelo nome informado.</div>';
    container.hidden = false;
}

function lahExtrairUfMunicipio(municipio) {
    return municipio?.microrregiao?.mesorregiao?.UF?.sigla
        || municipio?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
        || '';
}

function lahCarregarMunicipios() {
    const cache = GM_getValue(LAH_MUNICIPIOS_KEY, '');

    if (cache) {
        try {
            const itens = JSON.parse(cache);
            if (Array.isArray(itens) && itens.length > 5000) {
                lahMunicipios = itens;
                lahRenderizarMunicipios();
                return;
            }
        } catch (erro) {
            console.warn('Cache de municípios inválido.', erro);
        }
    }

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
        onload: resposta => {
            if (resposta.status < 200 || resposta.status >= 300) {
                console.warn('Busca de municípios indisponível no momento.');
                return;
            }
            try {
                const dados = JSON.parse(resposta.responseText);
                lahMunicipios = dados.map(item => {
                    const uf = lahExtrairUfMunicipio(item);
                    return {
                        codigo: String(item.id).slice(0, 6),
                        nome: item.nome,
                        uf,
                        rotulo: `${item.nome}${uf ? ` - ${uf}` : ''}`
                    };
                });
                GM_setValue(LAH_MUNICIPIOS_KEY, JSON.stringify(lahMunicipios));
                lahRenderizarMunicipios();
            } catch (erro) {
                console.warn('Falha ao interpretar catálogo de municípios.', erro);
            }
        },
        onerror: () => {
            console.warn('Busca de municípios indisponível no momento.');
        }
    });
}

function lahResolverMunicipio(ano, valor) {
    const somenteDigitos = String(valor || '').replace(/\D/g, '');
    let item = lahMunicipiosPorRotulo.get(lahNormalizarBusca(valor)) || null;
    ano.cidadeCodigo = '';

    if (item) {
        ano.cidadeNome = item.rotulo;
        ano.cidadeCodigo = item.codigo;
    } else if (somenteDigitos.length >= 6 && somenteDigitos.length <= 7) {
        ano.cidadeCodigo = somenteDigitos.slice(0, 6);
    }
    lahAgendarSalvamento();
}

function lahExportarRascunho() {
    lahSalvarRascunho();
    const blob = new Blob([JSON.stringify(lahGuiState, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-${lahGuiState.codigoAluno || 'sem-codigo'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function lahImportarArquivo(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        try {
            lahGuiState = lahNormalizarEstado(JSON.parse(String(leitor.result || '')));
            lahSalvarRascunho('Rascunho importado');
            lahRenderizarEditor();
            lahMostrarErros([]);
        } catch (erro) {
            lahMostrarErros(['O arquivo JSON não contém um rascunho válido.']);
        }
    };
    leitor.readAsText(arquivo, 'utf-8');
}

function lahMostrarErros(erros) {
    const painel = document.getElementById('lahValidation');
    if (!painel) return;
    if (!erros.length) {
        painel.textContent = '';
        painel.classList.remove('is-visible');
        return;
    }
    painel.textContent = `Revise antes de continuar:\n• ${erros.join('\n• ')}`;
    painel.classList.add('is-visible');
    painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function lahEhNumero(valor) {
    return /^-?\d+(?:[.,]\d+)?$/.test(String(valor || '').trim());
}

function lahValidar() {
    const erros = [];
    const codigoAluno = lahGuiState.codigoAluno.trim();

    if (!codigoAluno) erros.push('Informe o código do aluno.');
    else if (!/^\d+$/.test(codigoAluno)) erros.push('O código do aluno deve conter apenas números.');

    if (!lahGuiState.anos.length) erros.push('Adicione pelo menos um ano.');

    lahGuiState.anos.forEach((ano, indice) => {
        const nome = ano.ano ? `Ano ${ano.ano}` : `Cartão ${indice + 1}`;
        if (!/^\d{4}$/.test(ano.ano.trim())) erros.push(`${nome}: informe o ano cursado com quatro dígitos.`);
        if (!ano.serieCodigo.trim()) erros.push(`${nome}: selecione a série.`);
        if (!ano.escola.trim()) erros.push(`${nome}: informe o nome da escola.`);

        if (!ano.cidadeCodigo && ano.cidadeNome) {
            lahResolverMunicipio(ano, ano.cidadeNome);
        }
        const cidade = ano.cidadeCodigo.replace(/\D/g, '');
        if (cidade.length < 6) erros.push(`${nome}: selecione um município válido na lista.`);
        const temCargaTotal = Boolean(ano.cargaTotal.trim());

        if (ano.modo === 'area') {
            if (!ano.areaCodigo.trim()) erros.push(`${nome}: selecione a área de conhecimento.`);
            if (!ano.conceito.trim()) erros.push(`${nome}: informe o conceito da área.`);
            if (!temCargaTotal) erros.push(`${nome}: informe a carga horária total.`);
            return;
        }

        // Uma disciplina só participa do lançamento quando possui nota/conceito
        // e/ou carga horária. Linhas apenas selecionadas, mas sem lançamento,
        // são ignoradas completamente.
        const preenchidas = ano.disciplinas.filter(item =>
            Boolean(String(item.resultado || '').trim() || String(item.cargaHoraria || '').trim())
        );

        // Se nenhuma disciplina tiver nota/conceito nem carga horária, o ano
        // ainda pode ser lançado: nesse caso basta informar a carga horária
        // total do ano e o histórico será criado sem disciplinas.
        if (!preenchidas.length) {
            if (!temCargaTotal) {
                erros.push(`${nome}: sem lançamentos por disciplina; informe a carga horária total do ano.`);
            }
            return;
        }

        preenchidas.forEach((disciplina, discIndice) => {
            const prefixo = `${nome}, disciplina ${discIndice + 1}`;
            if (!disciplina.areaCodigo.trim() || !disciplina.disciplinaCodigo.trim()) {
                erros.push(`${prefixo}: selecione a disciplina pelo botão Pesquisar.`);
            }
            // Nota/conceito e carga horária individual podem ficar em branco.
            // O motor preencherá somente os campos efetivamente informados.
        });

        const resultados = preenchidas.map(item => item.resultado).filter(Boolean);
        const tipos = new Set(resultados.map(item => lahEhNumero(item) ? 'nota' : 'conceito'));
        if (tipos.size > 1) erros.push(`${nome}: não misture notas numéricas e conceitos no mesmo histórico.`);
    });

    const anosDuplicados = lahGuiState.anos
        .map(item => item.ano.trim())
        .filter((ano, indice, lista) => ano && lista.indexOf(ano) !== indice);
    if (anosDuplicados.length) erros.push(`Há anos cursados repetidos: ${[...new Set(anosDuplicados)].join(', ')}.`);

    return erros;
}

function lahCodificar(valor) {
    return encodeURIComponent(String(valor || '').trim());
}

function lahConstruirMatriz() {
    return lahGuiState.anos.map(ano => {
        const cidade = ano.cidadeCodigo.replace(/\D/g, '').slice(0, 6);
        const matrizAno = [
            [ano.ano.trim(), ano.serieCodigo.trim(), ano.escola.trim(), cidade],
            [
                lahGuiState.codigoAluno.trim(),
                lahCodificar(ano.cargaTotal),
                lahCodificar(ano.observacao),
                ano.modo === 'area' ? `[${ano.areaCodigo.trim()};${ano.conceito.trim()}]` : ''
            ]
        ];

        if (ano.modo === 'disciplinas') {
            ano.disciplinas
                .filter(item => Boolean(String(item.resultado || '').trim() || String(item.cargaHoraria || '').trim()))
                .forEach(item => {
                    matrizAno.push([
                        item.areaCodigo.trim(),
                        item.disciplinaCodigo.trim(),
                        item.resultado.trim(),
                        lahCodificar(item.cargaHoraria)
                    ]);
                });
        }
        return matrizAno;
    });
}

function inicializarGuiIntegrada() {
    lahCarregarFavoritos();
    lahGuiState = lahCarregarRascunho();
    lahRenderizarEditor();
    lahCarregarMunicipios();
    lahInstalarMonitorAlunoPagina();
    window.clearInterval(lahStudentMonitorTimer);
    lahStudentMonitorTimer = window.setInterval(lahInstalarMonitorAlunoPagina, 750);

    const campoAlunoGui = document.getElementById('lahStudentCode');
    campoAlunoGui?.addEventListener('input', evento => {
        const codigo = evento.target.value.replace(/\D/g, '');
        if (evento.target.value !== codigo) evento.target.value = codigo;
        lahGuiState.codigoAluno = codigo;
        lahSincronizarCodigoComPagina(lahGuiState.codigoAluno);
        lahRenderizarCabecalhoAluno();
        lahAgendarSalvamento();
    });
    campoAlunoGui?.addEventListener('change', () => {
        lahSincronizarCodigoComPagina(lahGuiState.codigoAluno, true);
    });

    document.getElementById('lahYears')?.addEventListener('input', lahAtualizarCampo);
    document.getElementById('lahYears')?.addEventListener('change', lahAtualizarCampo);
    document.getElementById('lahYears')?.addEventListener('click', lahTratarCliqueAnos);
    document.getElementById('lahYears')?.addEventListener('focusin', evento => {
        if (evento.target.matches('input[data-field="cidadeNome"]')) {
            lahRenderizarSugestoesMunicipio(evento.target.dataset.year, evento.target.value);
        }
    });
    document.addEventListener('click', evento => {
        if (!evento.target.closest('.lah-municipio-picker')) {
            lahFecharSugestoesMunicipio();
        }
        if (!evento.target.closest('.lah-settings')) {
            const menu = document.getElementById('lahSettingsMenu');
            const toggle = document.getElementById('lahSettingsToggle');
            if (menu) menu.hidden = true;
            toggle?.setAttribute('aria-expanded', 'false');
        }
    });

    document.getElementById('lahAddYear')?.addEventListener('click', () => {
        const novoAno = lahCriarAno();
        lahGuiState.anos.push(novoAno);
        lahGuiState.anoAtivoId = novoAno.id;
        lahRenderizarAnos();
        lahSalvarRascunho('Ano adicionado');
    });

    document.getElementById('lahDisciplineSearch')?.addEventListener('input', evento => {
        window.clearTimeout(lahSearchTimer);
        lahSearchTimer = window.setTimeout(
            () => lahRenderizarResultadosDisciplina(evento.target.value),
            120
        );
    });
    document.getElementById('lahDisciplineResults')?.addEventListener('click', evento => {
        const favorito = evento.target.closest('button[data-favorite-index]');
        if (favorito) {
            evento.preventDefault();
            evento.stopPropagation();
            if (lahAlternarFavorito(favorito.dataset.favoriteIndex)) {
                lahRenderizarResultadosDisciplina(document.getElementById('lahDisciplineSearch')?.value || '');
                lahRenderizarAnos();
            }
            return;
        }
        const resultado = evento.target.closest('button[data-disciplina-index]');
        if (resultado) lahSelecionarDisciplina(resultado.dataset.disciplinaIndex);
    });
    document.getElementById('lahDisciplineClose')?.addEventListener('click', lahFecharPesquisaDisciplina);
    document.getElementById('lahDisciplineModal')?.addEventListener('click', evento => {
        if (evento.target.id === 'lahDisciplineModal') lahFecharPesquisaDisciplina();
    });
    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && !document.getElementById('lahDisciplineModal')?.hidden) {
            lahFecharPesquisaDisciplina();
        }
        if (evento.key === 'Escape') {
            const menu = document.getElementById('lahSettingsMenu');
            const toggle = document.getElementById('lahSettingsToggle');
            if (menu) menu.hidden = true;
            toggle?.setAttribute('aria-expanded', 'false');
        }
    });

    document.getElementById('lahSaveDraft')?.addEventListener('click', () => lahSalvarRascunho());
    document.getElementById('lahSettingsToggle')?.addEventListener('click', evento => {
        evento.stopPropagation();
        const menu = document.getElementById('lahSettingsMenu');
        if (!menu) return;
        menu.hidden = !menu.hidden;
        evento.currentTarget.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.getElementById('lahExportDraft')?.addEventListener('click', lahExportarRascunho);
    document.getElementById('lahImportDraft')?.addEventListener('click', () => document.getElementById('lahImportFile')?.click());
    document.getElementById('lahImportFile')?.addEventListener('change', evento => {
        lahImportarArquivo(evento.target.files?.[0]);
        evento.target.value = '';
    });

    document.getElementById('lahClearDraft')?.addEventListener('click', () => {
        if (!window.confirm('Apagar todo o rascunho local deste histórico?')) return;
        lahGuiState = lahEstadoInicial();
        lahSalvarRascunho('Novo rascunho');
        lahRenderizarEditor();
        lahMostrarErros([]);
    });

    lahDefinirEstadoGui(lahGuiAberta, true);
}

// Mantém o nome da função antiga para que o motor de lançamento e o botão
// "Atualizar lista" continuem usando o mesmo ponto de entrada.
function prepararHistoricosDaGUI() {
    const errosValidacao = lahValidar();
    lahMostrarErros(errosValidacao);
    if (errosValidacao.length) {
        exibirLog('Revise os campos destacados no editor antes de continuar.', 5000, '#FF4B40');
        $('.divbotoes').slideUp(200);
        $('.divseletor').slideDown(300);
        return;
    }

    Mxhistorico = lahConstruirMatriz();
    permissoesHistorico.clear();
    lahSalvarRascunho('Dados preparados');
    criarBotoesHistorico();
    verificanomeano();
}

// Verifica os anos disponíveis no histórico do aluno
async function verificanomeano() {
    var colunavar = Mxhistorico[0];
    var codaluno = colunavar[1][0];

    document.querySelector('#vGEDALUCOD').value = codaluno;
    document.querySelector('.btnConsultar').click();

    ifrIframe2.src = `${location.origin}/ged/hwmgedhistorico.aspx?${codaluno}`;

    ifrIframe2.addEventListener("load", async function() {

        let iframeDoc2 = ifrIframe2.contentDocument || ifrIframe2.contentWindow.document;
        await aguardarCarregamentoCompleto(document);

        let vetor = [];
        let i = 1;

        // Obtém os anos disponíveis no histórico do aluno
        while (true) {
            let span = document.getElementById('span_vDESC_GEDHISTANO_' + String(i).padStart(4, '0'));
            if (span === null) break;

            // Verifica a permissão de alteração
            let imgPermissao = document.getElementById('vALTERAR_' + String(i).padStart(4, '0'));
            let temPermissao = imgPermissao && !imgPermissao.src.includes('naoalterar.gif') ? 1 : 0;

            // Armazena a permissão no Map usando o código do histórico como chave
            let codHistorico = document.getElementById('span_vGRIDGEDHISTCOD_' + String(i).padStart(4, '0'))?.innerHTML.replace(/\s+/g, '');
            if (codHistorico) {
                permissoesHistorico.set(codHistorico, temPermissao);
            }

            vetor.push([span.innerHTML, i, temPermissao]);
            i++;
        }

        // Marca os botões correspondentes aos anos já inseridos
        vetor.forEach(function(item) {
            let ano = item[0];
            let iValue = item[1];
            let permissao = item[2];

            let inputs = document.querySelectorAll('input[data-ano="' + ano + '"]');
            inputs.forEach(function(input) {
                input.classList.add('btninserido');
                input.setAttribute('data-index', iValue);
                input.setAttribute('data-perm', permissao);

                if (permissao === 0) {
                    input.title = 'Você não tem permissão para alterar este histórico';
                }
            });
        });

        // Exibe o nome do aluno na interface
        const nomealuno = document.getElementById("span_vGEDALUNOM").innerHTML;
        document.querySelector('.divbotoes>p').innerHTML = "Selecione o ano que deseja inserir para <br><b>" + nomealuno + "</b>.";
    });
}

// Cria os botões correspondentes aos anos preparados na GUI
async function criarBotoesHistorico() {
    var divBotoes = document.querySelector('.divbotoes');
    divBotoes.innerHTML = '<p style="font-weight:400;text-align:center;">Selecione o ano que deseja lançar no SIGEDUCA</p>';

    Mxhistorico.forEach((coluna, index) => {
        var ano = coluna[0][0];
        var botao = document.createElement('input');
        botao.setAttribute('type', 'button');
        botao.setAttribute('class', 'botaoSCT');
        const rotuloSerie = lahGuiState?.anos?.[index]?.serieCodigo
            ? (LAH_SERIES_LABELS[lahGuiState.anos[index].serieCodigo] || `série ${lahGuiState.anos[index].serieCodigo}`)
            : '';
        botao.setAttribute('value', `Inserir histórico de ${ano}${rotuloSerie ? ` · ${rotuloSerie}` : ''}`);
        botao.setAttribute('data-index', index);
        botao.setAttribute('data-ano', ano);
        botao.addEventListener("click", function() {
            let permissao = this.getAttribute('data-perm');
            inserir(this, index, permissao ? parseInt(permissao) : undefined);
        });
        divBotoes.appendChild(botao);
        divBotoes.appendChild(document.createElement('br'));
    });

    await esperar(500);
    $('.divseletor').slideUp(500);
    setTimeout(() => { $('.divbotoes').slideDown(500, 'swing'); }, 100);
    $('.btnscontrole').fadeIn(500);
    $('.btnajuda').fadeIn(500);
}
// Função para inserir os dados no histórico
async function inserir(bot, index, permissao) {
    deletarmsg();
    await esperar(500);

    var anobotao = bot.getAttribute('data-ano');
    var indexbotao = bot.getAttribute('data-index');
    var classebotao = bot.getAttribute('class');

    if (classebotao.includes('btninserido')) {
        var codhistorico = document.getElementById('span_vGRIDGEDHISTCOD_' + String(indexbotao).padStart(4, '0')).innerHTML.replace(/\s+/g, '');

        let novoNo = document.createElement('div');
        novoNo.setAttribute('class', 'mensagem');

        if (permissao === 0) {
            novoNo.innerHTML = `
                <p style="font-family: "SF Pro Text","SF Pro Icons","Helvetica Neue","Helvetica","Arial",sans-serif !important; font-weight:normal;">
                    Você não pode alterar este Historico. Parece que ele foi inserido por outra escola!
                </p>
            `;
        } else {
            novoNo.innerHTML = `
                <p style="font-family: "SF Pro Text","SF Pro Icons","Helvetica Neue","Helvetica","Arial",sans-serif !important; font-weight:normal;">
                    Tem certeza que deseja sobrescrever o histórico de ${anobotao}?
                </p>
                <input type="button" class="botaoSCT msgsim" value="Sobrescrever">
                <input type="button" class="botaoSCT msgcancela" value="Cancelar">
            `;
        }

        bot.insertAdjacentElement('afterend', novoNo);
        $('.mensagem').slideToggle();

        if (permissao !== 0) {
            document.querySelector(".msgcancela").addEventListener("click", deletarmsg);
            document.querySelector(".msgsim").addEventListener("click", function() {
                preencherFormulario(codhistorico, index);
            });
        }
    } else {
        preencherFormulario(1, index);
    }
}

// Função para arredondar para cima se a parte decimal for maior que 0.7
function arredondarParaCimaSeMaiorQueMeia(numero) {
    return numero % 1 > 0.7 ? Math.ceil(numero) : Math.floor(numero);
}

// Função para atualizar a barra de progresso
function atualizarProgresso(quantia) {
    let div = document.getElementById("loadingBtn");
    let progressoAtual = div.innerText.trim() ? parseInt(div.innerText) : 0;
    let novoProgresso = Math.min(progressoAtual + quantia, 100);
    div.innerText = arredondarParaCimaSeMaiorQueMeia(novoProgresso) + "%";
}

// Função auxiliar para aguardar um tempo específico
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para esperar o carregamento de um iframe e verificar se um select tem opções
function esperarCarregarIframe(iframe, seletorSelect) {
    return new Promise((resolve) => {
        let checkOpcoesExist = async () => {
            let select = iframe.contentDocument.querySelector(seletorSelect);
            if (select && select.options.length > 1) {
                resolve();
            } else {
                await esperar(1000);
                select = null;
                checkOpcoesExist();
            }
        };
        checkOpcoesExist();
    });

}
// Função para deletar a mensagem de confirmação
async function deletarmsg() {
    let mensagem = document.querySelector('.mensagem');
    if (mensagem) {
        $('.mensagem').slideToggle();
        await esperar(500);
        mensagem.remove();
    }
}

  // Função para verificar se a página está carregando
  const aguardarCarregamentoCompleto = async (local) => {
    return new Promise((resolver) => {
        let tempoLimiteAtingido = false;
        const tempoMaximoEspera = 15000; // 15 segundos
        const tempoInicio = Date.now();

        const verificarCarregamento = () => {
            const elementoCarregamento = local.getElementById('gx_ajax_notification');
            const tempoAtual = Date.now();
            let tempoDecorrido = tempoAtual - tempoInicio;

            // Verifica se o tempo máximo foi atingido
            if (tempoDecorrido >= tempoMaximoEspera && !tempoLimiteAtingido) {
                tempoLimiteAtingido = true;
                exibirLog('Algo deu errado durante o carregamento. Verifique o sistema e tente novamente!', 4000, '#FF4B40');
                resolver(); // Resolve a Promise mesmo se o tempo esgotar
                return;
            }

            // Se o elemento não existe OU está oculto (display: none), considera carregamento concluído
            if (!elementoCarregamento || elementoCarregamento.style.display === 'none') {
                setTimeout(resolver, 1000); // Espera 1 segundo adicional para garantir
            } else {
                console.log('AGUARDANDO CARREGAMENTO...');
                setTimeout(verificarCarregamento, 1000); // Continua verificando
            }
        };

        verificarCarregamento();
    });
};
let ErrosInserir = [];
let erros = [];
let coluna = [];

// Função para preencher o formulário de histórico escolar
async function preencherFormulario(codhistorico, index) {

     // Limpa os logs e a fila do LogManager
     if (logManager) {
        logManager.queue = []; // Limpa a fila
        logManager.isDisplaying = false; // Reseta o estado de exibição
        logManager.lastMessage = ''; // Limpa a última mensagem
        logManager.lastMessageTime = 0; // Reseta o tempo da última mensagem
        if (logManager.divLog) {
            logManager.divLog.style.display = 'none'; // Esconde o div de log
            logManager.divLog.innerHTML = ''; // Limpa o conteúdo
        }
    }

    // Cria um escopo isolado para a execução
    const execucaoAtual = {
        codhistorico,
        index,
        coluna: null,
        erros: [],
        ErrosInserir: [],
        tipodeavaliacao: null,
        selectAvaliacao: null,
        selectArea: null,
        selectDisciplina: null,
        elemento: null,
        inputConceito: null,
        selectTipo: null,
        nomedadisciplina: null,
        optionconceito: null,
        iframe: null,
        iframeDoc: null,
        tamanhocoluna: null,
        evolucao: null,
        codaluno: null,
        tipolancamento: null,
        codigoArea: null,
        conceito: null,
        changeEvent: new Event('change'),
        btn: document.getElementById("loadingBtn")
    };

    // Função para verificar erros no iframe
    function verificarErrosIframe(iframeDoc) {
        let errorViewer = iframeDoc.getElementById('gxErrorViewer');
        if (!errorViewer) return null;

        let erros = errorViewer.querySelectorAll('.erro');
        if (erros.length === 0) return null;

        let mensagensErro = Array.from(erros).map(erro => erro.textContent.trim());
        console.log(mensagensErro.join('\n'));
        return mensagensErro.join('\n');
    }

    // Verifica a permissão real antes de prosseguir
    if (codhistorico !== 1) {
        let permissaoReal = permissoesHistorico.get(codhistorico);
        if (permissaoReal === 0) {
            exibirLog('Você não tem permissão para alterar este histórico!', 5000, '#FF4B40');
            voltar();
            return;
        }
    }

    exibirLog('Iniciando!', 3000);
    $('.btnajuda').fadeOut(500);
    $('.btnscontrole').fadeOut(500);
    setTimeout(() => {
        $('.divbotoes').slideUp(500, 'swing');
    }, 100);
    $('.divcarregando').slideDown(600, 'swing');

    let btn = document.getElementById("loadingBtn");
    btn.classList.add("loading");

    if (!Mxhistorico || !Mxhistorico[index]) {
        console.error("Índice inválido ou matriz não definida.");
        exibirLog('O sistema encontrou um erro ao processar o histórico escolar! Revise os dados no editor e tente novamente!', 5000, '#FF4B40');
        voltar();
        return;
    }

    atualizarProgresso(5);
    divCredit.appendChild(ifrIframe1);
    execucaoAtual.coluna = Mxhistorico[index].filter(linha =>
        linha.some(valor => valor !== null && valor !== undefined && valor !== "")
    );

    execucaoAtual.codaluno = execucaoAtual.coluna[1][0];
    execucaoAtual.tipodeavaliacao = (!execucaoAtual.coluna[2] || !execucaoAtual.coluna[2][2] || execucaoAtual.coluna[2][2].trim() === "" || /\d/.test(execucaoAtual.coluna[2][2])) ? "NOTA" : "CONCEITO";

    // Verifica se a coluna[1][3] tem conteúdo para determinar o tipo de avaliação e lançamento
    if (execucaoAtual.coluna[1][3]==null) {
        exibirLog('O sistema encontrou um erro ao processar o histórico escolar! Revise o tipo de avaliação e tente novamente!', 5000, '#FF4B40');
        voltar();
        return;
    }

    execucaoAtual.tipolancamento = execucaoAtual.coluna[1][3].trim() !== "" ? "A" : "D";
    if (execucaoAtual.coluna[1][3].trim() !== "") {
        execucaoAtual.tipodeavaliacao = "CONCEITO";
        exibirLog('Lançamento de Conceito por Área de Conhecimento!', 3000);
    } else {
        if (execucaoAtual.tipodeavaliacao === "CONCEITO") {
            exibirLog('Lançamento de Conceito por Disciplina!', 3000);
        } else {
            exibirLog('Lançamento de Nota por Disciplina!', 3000);
        }
    }

    let codigolotacao = document.getElementById("span_vGERLOTCOD").textContent;
    ifrIframe1.src = codhistorico == 1
        ? `${location.origin}/ged/HWGedValidacaoHistorico.aspx?${codhistorico},${execucaoAtual.codaluno},,0,HWMGedHistorico`
        : `${location.origin}/ged/hwtgedhistoricoescolar.aspx?${codhistorico},${execucaoAtual.codaluno},HWMGedHistorico,${codigolotacao},UPD,N`;

    atualizarProgresso(5);

    // Remove qualquer listener anterior do iframe
    ifrIframe1.removeEventListener("load", iframeLoadHandler);

    // Declara a função iframeLoadHandler antes de usá-la
    async function iframeLoadHandler() {
        execucaoAtual.iframe = parent.document.querySelector("iframe#iframe1");
        execucaoAtual.iframeDoc = execucaoAtual.iframe.contentDocument || execucaoAtual.iframe.contentWindow.document;

        // Espera o iframe carregar completamente
        await esperar(2000);
        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);

        // Verifica se os elementos necessários existem
        const elementosNecessarios = [
            "vGEDHISTANO",
            "vGEDSERIECOD",
            "vGEDHISTCRGHOR",
            "vGEDHISTOBS",
            "vGEDHISTNOMLOT",
            "vGEDHISTCIDID"
        ];

        // Verifica se todos os elementos existem antes de tentar acessá-los
        const elementosExistem = elementosNecessarios.every(id => {
            const elemento = execucaoAtual.iframeDoc.getElementById(id);
            if (!elemento) {
                console.error(`Elemento ${id} não encontrado no iframe`);
                return false;
            }
            return true;
        });

        if (!elementosExistem) {
            exibirLog('O sistema encontrou um erro! O formulário não foi carregado corretamente. Por favor, tente novamente.', 5000, '#FF4B40');
            voltar();
            return;
        }


            // Preenche os campos do formulário
            execucaoAtual.iframeDoc.getElementById("vGEDHISTANO").value = execucaoAtual.coluna[0][0] || "";
            execucaoAtual.iframeDoc.getElementById("vGEDSERIECOD").value = execucaoAtual.coluna[0][1] || "";
            execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR").value = "";

            if (execucaoAtual.coluna[1][2]) {
                const elementoOBS = execucaoAtual.iframeDoc.getElementById("vGEDHISTOBS");
                if (elementoOBS) {
                    elementoOBS.textContent = decodeURIComponent(execucaoAtual.coluna[1][2]);
                }
            }

            const elementoNOMLOT = execucaoAtual.iframeDoc.getElementById("vGEDHISTNOMLOT");
            if (elementoNOMLOT) {
                elementoNOMLOT.setAttribute("value", execucaoAtual.coluna[0][2] || "");
            }

            const elementoCIDID = execucaoAtual.iframeDoc.getElementById("vGEDHISTCIDID");
            if (elementoCIDID) {
                elementoCIDID.setAttribute("value", execucaoAtual.coluna[0][3] || "");
            }

            await esperar(1000);


        const changeEvent = new Event('change');
        try {
            execucaoAtual.selectAvaliacao = execucaoAtual.iframeDoc.getElementById('vGEDHISTFRMAVA');
            execucaoAtual.selectAvaliacao.value = execucaoAtual.tipodeavaliacao === "NOTA" ? "3" : "2";
            execucaoAtual.selectAvaliacao.dispatchEvent(changeEvent);
        } catch (erro) {
            exibirLog('O sistema encontrou um erro ao tentar selecionar o tipo de avaliação!', 5000, '#FF4B40');
            voltar();
            return;
        }

        await esperar(1000);
        await esperarCarregarIframe(ifrIframe1, "#vGEDHISTTPO");

        try {
            execucaoAtual.selectTipo = execucaoAtual.iframeDoc.getElementById('vGEDHISTTPO');
            execucaoAtual.selectTipo.value = execucaoAtual.tipolancamento;
            execucaoAtual.selectTipo.dispatchEvent(changeEvent);
        } catch (erro) {
            exibirLog('O sistema encontrou um erro ao tentar selecionar o tipo de lançamento!', 5000, '#FF4B40');
            voltar();
            return;
        }

        // Se for lançamento por área de conhecimento
        if (execucaoAtual.tipolancamento === "A") {
            await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
            await esperarCarregarIframe(ifrIframe1, "#vGEDHISTAREACOD");

            // Extrai o código da área e o conceito da coluna[1][3]
            let [codigoArea, conceito] = execucaoAtual.coluna[1][3].replace(/[\[\]]/g, '').split(';');

            // Preenche o código da área
            try {
                execucaoAtual.selectArea = execucaoAtual.iframeDoc.getElementById('vGEDHISTAREACOD');
                execucaoAtual.selectArea.value = codigoArea;
                execucaoAtual.selectArea.dispatchEvent(changeEvent);
                atualizarProgresso(40);
            } catch (erro) {
                exibirLog('A Área de Conhecimento informada não foi encontrada!', 5000, '#FF4B40');
                voltar();
                return;
            }
            await esperar(500);
            try {
                // Preenche o conceito
                execucaoAtual.inputConceito = execucaoAtual.iframeDoc.getElementById('vGEDHISTAREACONSGL');
                execucaoAtual.inputConceito.value = conceito;
                execucaoAtual.inputConceito.dispatchEvent(changeEvent);
                atualizarProgresso(40);
            } catch (erro) {
                exibirLog('O conceito informado não foi encontrado!', 5000, '#FF4B40');
                voltar();
                return;
            }

            await esperar(500);
            execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
            await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
            execucaoAtual.erros = verificarErrosIframe(execucaoAtual.iframeDoc);
            if (execucaoAtual.erros) {
                throw new Error(execucaoAtual.erros);
            } else {
                atualizarProgresso(10);
            }

            if (execucaoAtual.coluna[1][1]) {
                try {
                    await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                    execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR").value = decodeURIComponent(execucaoAtual.coluna[1][1]);
                    execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR").dispatchEvent(changeEvent);
                    exibirLog('Corrigindo a carga horária!', 2000);
                    execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
                } catch (erro) {
                    exibirLog('O sistema encontrou um erro ao tentar corrigir a carga horária!', 5000, '#FF4B40');
                }
            }

            await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);

            $('.divcarregando').slideUp(1000);
            btn.classList.remove("loading");
            exibirLog('CONCLUÍDO!', 4000,'#34A568');
            prepararHistoricosDaGUI();

            // Limpeza das variáveis
            Object.keys(execucaoAtual).forEach(key => {
                execucaoAtual[key] = null;
            });

            await esperar(3000);

            document.getElementById("loadingBtn").innerText = "0%";
            let botaoIndex = document.querySelector(`.botaoSCT[data-index="${execucaoAtual.index}"]`);
            ifrIframe1.src = "about:blank";
            execucaoAtual.iframe.remove();

            return;
        }

        // Se o ano não possui nenhuma disciplina com nota/conceito ou carga
        // horária, cria o histórico somente com a carga horária total do ano.
        if (!execucaoAtual.coluna[2]) {
            try {
                const cargaAno = decodeURIComponent(execucaoAtual.coluna[1][1] || '');
                const campoCargaAno = execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR");
                if (campoCargaAno) {
                    campoCargaAno.value = cargaAno;
                    campoCargaAno.dispatchEvent(changeEvent);
                }

                await esperar(500);
                execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
                await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                execucaoAtual.erros = verificarErrosIframe(execucaoAtual.iframeDoc);
                if (execucaoAtual.erros) throw new Error(execucaoAtual.erros);

                atualizarProgresso(100);
                $('.divcarregando').slideUp(1000);
                btn.classList.remove("loading");
                exibirLog('CONCLUÍDO! Histórico lançado somente com a carga horária do ano.', 5000, '#34A568');

                try { execucaoAtual.iframe.remove(); } catch (_) {}
                document.getElementById("loadingBtn").innerText = "0%";
                ifrIframe1.src = "about:blank";
                prepararHistoricosDaGUI();
                return;
            } catch (erro) {
                exibirLog(`Erro ao lançar o histórico somente com a carga horária do ano: ${erro.message}`, 8000, '#FF4B40');
                voltar();
                return;
            }
        }

        // Se for lançamento por disciplina, continua com o código existente.
        execucaoAtual.tamanhocoluna = execucaoAtual.coluna.length;
        atualizarProgresso(5);
        execucaoAtual.evolucao = 85 / Math.max(1, (execucaoAtual.tamanhocoluna - 2));
        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
        execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
        execucaoAtual.erros = await verificarErrosIframe(execucaoAtual.iframeDoc);
        await esperar(500);
        if (execucaoAtual.erros) {
            exibirLog('Atenção! Alguns erros ocorreram durante o processo:\n\n' + execucaoAtual.erros, 150000, '#FF4B40');
            voltar();
            throw new Error(execucaoAtual.erros);
            return;
        }
        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);

        if(!execucaoAtual.coluna[2]){atualizarProgresso(100);}

        for (let linha = 2; linha < execucaoAtual.tamanhocoluna; linha++) {
            console.log("linha sendo executada: " + linha);
            try {
                await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                await esperarCarregarIframe(ifrIframe1, "#vGEDHISTAREACOD");

                try {
                    execucaoAtual.selectArea = execucaoAtual.iframeDoc.getElementById('vGEDHISTAREACOD');
                    execucaoAtual.selectArea.value = execucaoAtual.coluna[linha][0] || "";
                    execucaoAtual.selectArea.dispatchEvent(changeEvent);
                    atualizarProgresso(execucaoAtual.evolucao / 5);
                } catch (erro) {
                    throw new Error('Área de Conhecimento não encontrada');
                }
                await esperar(500);
                await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                await esperarCarregarIframe(ifrIframe1, "#vGEDHISTDISCCOD");

                try {
                    execucaoAtual.selectDisciplina = execucaoAtual.iframeDoc.getElementById('vGEDHISTDISCCOD');
                    execucaoAtual.selectDisciplina.value = execucaoAtual.coluna[linha][1] || "";
                    execucaoAtual.selectDisciplina.dispatchEvent(changeEvent);
                    atualizarProgresso(execucaoAtual.evolucao / 5);
                    execucaoAtual.nomedadisciplina = execucaoAtual.selectDisciplina.querySelector('option[value="'+execucaoAtual.coluna[linha][1]+'"]').textContent;
                } catch (erro) {
                    throw new Error('Disciplina não encontrada');
                }

                await esperar(500);
                execucaoAtual.elemento = execucaoAtual.tipodeavaliacao === "NOTA"
                    ? execucaoAtual.iframeDoc.getElementById("vGEDHISTDISCAVANOTA")
                    : execucaoAtual.iframeDoc.getElementById("vGEDHISTDISCCONSGL");

                const resultadoInformado = String(execucaoAtual.coluna[linha][2] || '').trim();
                if (resultadoInformado) {
                    try {
                        execucaoAtual.elemento.value = execucaoAtual.tipodeavaliacao === "NOTA"
                            ? resultadoInformado.replace(/\./g, ",")
                            : resultadoInformado;
                        execucaoAtual.elemento.dispatchEvent(changeEvent);
                    } catch (erro) {
                        throw new Error('Erro ao tentar inserir a nota/conceito');
                    }
                    execucaoAtual.optionconceito = execucaoAtual.tipodeavaliacao === "CONCEITO"
                        ? execucaoAtual.elemento.querySelector('option[value="'+resultadoInformado+'"]')
                        : "é nota";
                    if(!execucaoAtual.optionconceito){
                        throw new Error('Conceito não encontrado');
                    }
                }

                atualizarProgresso(execucaoAtual.evolucao / 5);

                await esperar(500);
                const cargaDisciplina = decodeURIComponent(execucaoAtual.coluna[linha][3] || '');
                if (String(cargaDisciplina).trim()) {
                    try {
                        execucaoAtual.iframeDoc.getElementById("vGEDHISTDISCCRGHOR").value = cargaDisciplina;
                        execucaoAtual.iframeDoc.getElementById("vGEDHISTDISCCRGHOR").dispatchEvent(changeEvent);
                        atualizarProgresso(execucaoAtual.evolucao / 5);
                    } catch (erro) {
                        throw new Error('Erro ao tentar inserir a carga horária');
                    }
                }
                try {
                    await esperar(1000);
                    execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
                    await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                    execucaoAtual.erros = verificarErrosIframe(execucaoAtual.iframeDoc);
                    if (execucaoAtual.erros) {
                        throw new Error(execucaoAtual.erros);
                    }

                    atualizarProgresso(execucaoAtual.evolucao / 5);
                } catch (erro) {
                    throw new Error(erro.message);
                }
                //Exibir log da displina incluida
                exibirLog(execucaoAtual.nomedadisciplina + '  Inserido!', 1500);
                await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
            } catch (erro) {
                // Registra o erro específico da linha
                exibirLog(`Erro ao inserir ${execucaoAtual.nomedadisciplina ? execucaoAtual.nomedadisciplina : `a disciplina ${execucaoAtual.coluna[linha][1]}`}!`, 4000, '#FF4B40');
                execucaoAtual.ErrosInserir.push(`Erro ao inserir ${execucaoAtual.nomedadisciplina ? execucaoAtual.nomedadisciplina : `a disciplina ${execucaoAtual.coluna[linha][1]}`}-${erro.message}`);
                execucaoAtual.nomedadisciplina = null;

                // Continua para a próxima linha
                continue;
            }
        }

        if (execucaoAtual.coluna[1][1]) {
            try {
                await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);
                execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR").value = decodeURIComponent(execucaoAtual.coluna[1][1]);
                execucaoAtual.iframeDoc.getElementById("vGEDHISTCRGHOR").dispatchEvent(changeEvent);
                exibirLog('Corrigindo a carga horária!', 1000);
                await esperar(600);
                execucaoAtual.iframeDoc.querySelector(".btnIncluir")?.click();
            } catch (erro) {
                execucaoAtual.ErrosInserir.push(`Erro ao tentar corrigir a carga horária do histórico escolar. ${erro.message}`);
                exibirLog('Erro ao tentar corrigir a carga horária do histórico escolar!', 5000, '#FF4B40');
            }
        }

        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);

        $('.divcarregando').slideUp(1000);
        btn.classList.remove("loading");
        await aguardarCarregamentoCompleto(execucaoAtual.iframeDoc);

        if (execucaoAtual.ErrosInserir.length > 0) {
            exibirLog('Atenção! Alguns erros ocorreram durante o processo:\n\n' + execucaoAtual.ErrosInserir.join('\n'), 150000, '#FF4B40');
        } else {
            exibirLog('CONCLUÍDO!', 4000,'#34A568');
        }

        execucaoAtual.iframe.remove();

        // Limpeza final
        Object.keys(execucaoAtual).forEach(key => {
            execucaoAtual[key] = null;
        });

        document.getElementById("loadingBtn").innerText = "0%";
        ifrIframe1.src = "about:blank";
        prepararHistoricosDaGUI();
    }

    // Adiciona o novo handler
    ifrIframe1.addEventListener("load", iframeLoadHandler);
}

// Exemplo de uso:
adicionarEfeitoBrilhoFlexivel('#containerLAH', {
    delay: 1000,
    duration: 2000,
    colors: {
        before: [
            'rgba(235, 20, 20, 0.3)',
            'transparent',
            'rgba(64, 255, 166, 0.3)',
            'rgba(214, 114, 114, 0.5)',
            'transparent',
            'rgba(255, 40, 40, 0.6)'
        ],
        after: [
            'rgba(57, 130, 247, 0.5)',
            'rgba(52, 165, 104, 0.7)',
            'transparent',
            'rgba(255, 255, 255, 0.91)',
            'rgba(57, 130, 247, 0.5)'
        ]
    },
    blur: {
        before: 50,
        after: 70
    },
    botaoId: 'exibirLAH'
});

function adicionarEfeitoBrilhoFlexivel(containerSelector, options = {}) {
    // Obtém a versão atual do script
    const versaoAtual = GM_info.script.version;

    // Obtém a última versão em que o efeito foi executado
    const ultimaVersaoExecutada = GM_getValue('ultimaVersaoEfeitoBrilho', '0.0');

    // Se a versão atual for diferente da última versão executada, executa o efeito
    if (versaoAtual !== ultimaVersaoExecutada) {
        // Configurações padrão
        const config = {
            delay: options.delay || 1000,
            duration: options.duration || 2000,
            colors: {
                before: options.colors?.before || [
                    'rgba(235, 20, 20, 0.3)',
                    'rgba(64, 255, 166, 0.3)',
                    'transparent',
                    'rgba(255, 40, 40, 0.6)'
                ],
                after: options.colors?.after || [
                    'rgba(57, 130, 247, 0.5)',
                    'rgba(52, 165, 104, 0.7)',
                    'rgba(57, 130, 247, 0.5)'
                ]
            },
            blur: {
                before: options.blur?.before || 30,
                after: options.blur?.after || 50
            }
        };

        // Obtém o container
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // Obtém o botão se o ID foi fornecido
        const botao = options.botaoId ? document.getElementById(options.botaoId) : null;
        let backgroundOriginal = null;

        if (botao) {
            // Salva o background original do botão
            backgroundOriginal = botao.style.background;
        }

        // Cria os elementos de brilho
        const glowBefore = document.createElement('div');
        const glowAfter = document.createElement('div');

        // Configura os elementos de brilho
        glowBefore.className = 'glow-layer before';
        glowAfter.className = 'glow-layer after';

        // Adiciona os estilos necessários
        const styleId = 'glow-effect-flexible-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.type = 'text/css';
            style.innerHTML = `
                .glow-layer {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    z-index: -1;
                    border-radius: inherit;
                    opacity: 0;
                }

                .glow-layer.before {
                    animation: glow-reverse-flexible ${config.duration}ms linear;
                }

                .glow-layer.after {
                    animation: glow-flexible ${config.duration}ms linear;
                }

                @keyframes glow-flexible {
                    0% {
                        opacity: 0;
                        transform: scale(1);
                        background-position: 0% 0%;
                        background-size: 100% 100%;
                    }
                    5% {
                        opacity: 1;
                        transform: scale(1.1);
                        background-position: 100% 0%;
                        background-size: 150% 150%;
                    }
                    15% {
                        opacity: 0.8;
                        transform: scale(1.05);
                        background-position: 50% 100%;
                        background-size: 180% 180%;
                    }
                    35% {
                        opacity: 0.9;
                        transform: scale(1.03);
                        background-position: 25% 75%;
                        background-size: 200% 200%;
                    }
                    65% {
                        opacity: 0.7;
                        transform: scale(1.04);
                        background-position: 85% 15%;
                        background-size: 220% 220%;
                    }
                    85% {
                        opacity: 0.5;
                        transform: scale(1.02);
                        background-position: 35% 65%;
                        background-size: 180% 180%;
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1);
                        background-position: 0% 0%;
                        background-size: 100% 100%;
                    }
                }

                @keyframes glow-reverse-flexible {
                    0% {
                        opacity: 0;
                        transform: scale(1);
                        background-position: 0% 0%;
                        background-size: 100% 100%;
                    }
                    5% {
                        opacity: 0.9;
                        transform: scale(1.08);
                        background-position: 0% 100%;
                        background-size: 160% 160%;
                    }
                    20% {
                        opacity: 1;
                        transform: scale(1.06);
                        background-position: 100% 50%;
                        background-size: 190% 190%;
                    }
                    45% {
                        opacity: 0.8;
                        transform: scale(1.04);
                        background-position: 75% 25%;
                        background-size: 220% 220%;
                    }
                    75% {
                        opacity: 0.6;
                        transform: scale(1.03);
                        background-position: 15% 85%;
                        background-size: 250% 250%;
                    }
                    90% {
                        opacity: 0.3;
                        transform: scale(1.01);
                        background-position: 65% 35%;
                        background-size: 280% 280%;
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1);
                        background-position: 200% 200%;
                        background-size: 300% 300%;
                    }
                }

                @keyframes botao-brilho {
                    0% {
                        background: ${backgroundOriginal || 'rgba(57, 130, 247, 0.5)'};
                    }
                    25% {
                        background: rgba(52, 165, 104, 0.7);
                    }
                    50% {
                        background: rgba(57, 130, 247, 0.9);
                    }
                    75% {
                        background: rgba(52, 165, 104, 0.7);
                    }
                    100% {
                        background: ${backgroundOriginal || 'rgba(57, 130, 247, 0.5)'};
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Configura os estilos específicos para este container
        glowBefore.style.background = `conic-gradient(from 0deg, ${config.colors.before.join(',')})`;
        glowBefore.style.filter = `blur(${config.blur.before}px)`;
        glowAfter.style.background = `conic-gradient(from 0deg, ${config.colors.after.join(',')})`;
        glowAfter.style.filter = `blur(${config.blur.after}px)`;

        // Adiciona os elementos de brilho ao container
        setTimeout(() => {
            container.appendChild(glowBefore);
            container.appendChild(glowAfter);

            // Se houver um botão, anima seu background
            if (botao) {
                botao.style.animation = `botao-brilho ${config.duration}ms linear`;
            }
        }, config.delay);

        // Após a animação terminar, restaura o background original do botão e armazena a versão atual
        setTimeout(() => {
            glowBefore.remove();
            glowAfter.remove();
            if (botao) {
                botao.style.animation = '';
                botao.style.background = backgroundOriginal;
            }
            GM_setValue('ultimaVersaoEfeitoBrilho', versaoAtual);
        }, config.duration + config.delay);
    }
}


    // =====================================================================
    // MORPH MODULAR DA PÁGINA DE HISTÓRICO
    // =====================================================================
    //
    // IMPORTANTE:
    // A tela hwmgedhistorico.aspx é atualizada internamente pelo GeneXus.
    // Na v5.0.0 o host da nossa GUI era colocado DENTRO da árvore da TABLE4.
    // Em algumas inicializações/AJAX essa região era redesenhada e o GeneXus
    // removia o host do DOM — por isso a interface "piscava" e desaparecia.
    //
    // Nesta versão o host fica ANTES da TABLE4, como irmão dela. A TABLE4
    // original permanece inteira no DOM, apenas invisível. Assim os campos,
    // grids e botões nativos continuam funcionando para o motor do script.
    // =====================================================================

    let lahMorphObserver = null;
    let lahMorphRetryTimer = null;
    let lahMorphAplicando = false;

    function lahGarantirEstiloMorph() {
        if (document.getElementById('lah-modular-morph-style')) return;

        const style = document.createElement('style');
        style.id = 'lah-modular-morph-style';
        style.textContent = `
            /* Mantém o cabeçalho/menu nativo do SIGEDUCA e amplia a área útil. */
            body.Form {
                background:#fff !important;
            }

            #TABLE1_MPAGE {
                width:min(1180px, calc(100vw - 18px)) !important;
            }

            /* A tela nativa continua viva no DOM, mas não aparece para o usuário. */
            #TABLE4[data-lah-native-hidden="1"] {
                display:none !important;
            }

            /* Host fora da região que o GeneXus redesenha. */
            #lah-modular-host {
                display:block !important;
                width:min(1120px, calc(100vw - 34px)) !important;
                margin:10px auto 26px !important;
                padding:0 !important;
                box-sizing:border-box !important;
                font-family:Verdana,Arial,sans-serif !important;
            }

            #lah-modular-host,
            #lah-modular-host * {
                box-sizing:border-box;
                font-family:Verdana,Arial,sans-serif !important;
            }

            /* Neutraliza completamente o antigo comportamento de janela flutuante. */
            #lah-modular-host #containerLAH,
            #lah-modular-host #containerLAH.lah-panel-closed,
            #lah-modular-host #containerLAH.lah-panel-open {
                display:block !important;
                position:static !important;
                inset:auto !important;
                top:auto !important;
                right:auto !important;
                bottom:auto !important;
                left:auto !important;
                width:100% !important;
                height:auto !important;
                min-width:0 !important;
                min-height:0 !important;
                max-width:none !important;
                max-height:none !important;
                margin:0 !important;
                padding:0 !important;
                overflow:visible !important;
                opacity:1 !important;
                visibility:visible !important;
                clip-path:none !important;
                transform:none !important;
                pointer-events:auto !important;
                transition:none !important;
                border:1px solid #9aa7b3 !important;
                border-radius:0 !important;
                background:#f7f7f7 !important;
                box-shadow:none !important;
                backdrop-filter:none !important;
                -webkit-backdrop-filter:none !important;
                color:#000 !important;
                text-align:left !important;
            }

            /* O botão MAXIMIZAR/MINIMIZAR não faz sentido no modo integrado. */
            #exibirLAH {
                display:none !important;
            }

            html.lah-gui-aberta,
            html.lah-gui-aberta body {
                overflow:auto !important;
            }

            #lah-modular-host #containerLAH .divseletor {
                display:block !important;
                min-width:0 !important;
                min-height:0 !important;
                padding:12px 14px 16px !important;
                text-align:left !important;
            }

            #lah-modular-host #containerLAH .lah-header {
                margin-bottom:10px !important;
                align-items:center !important;
            }

            #lah-modular-host #containerLAH .lah-header h2 {
                margin:0 0 3px !important;
                color:#000 !important;
                font-size:11pt !important;
                font-weight:bold !important;
                letter-spacing:0 !important;
            }

            #lah-modular-host #containerLAH .lah-header p,
            #lah-modular-host #containerLAH .lah-muted,
            #lah-modular-host #containerLAH .lah-status {
                font-size:7pt !important;
                color:#555 !important;
            }

            #lah-modular-host #containerLAH .lah-badge {
                padding:3px 6px !important;
                border:1px solid #aaa !important;
                border-radius:2px !important;
                background:#fff !important;
                color:#444 !important;
                font-size:7pt !important;
            }

            #lah-modular-host #containerLAH label {
                color:#000 !important;
                font-size:8pt !important;
                font-weight:bold !important;
            }

            #lah-modular-host #containerLAH input,
            #lah-modular-host #containerLAH select,
            #lah-modular-host #containerLAH textarea {
                min-height:27px !important;
                border:1px solid #999 !important;
                border-radius:0 !important;
                padding:4px 6px !important;
                background:#fff !important;
                color:#000 !important;
                font-size:8pt !important;
                box-shadow:none !important;
            }

            #lah-modular-host #containerLAH button,
            #lah-modular-host #containerLAH .lah-button {
                min-height:27px !important;
                border:1px solid #777 !important;
                border-radius:2px !important;
                padding:4px 8px !important;
                background:#efefef !important;
                color:#000 !important;
                font-size:8pt !important;
                font-weight:bold !important;
                box-shadow:none !important;
            }

            #lah-modular-host #containerLAH button:hover,
            #lah-modular-host #containerLAH .lah-button:hover {
                background:#e0e0e0 !important;
                color:#000 !important;
            }

            #lah-modular-host #containerLAH .lah-primary {
                border-color:#044477 !important;
                background:#065195 !important;
                color:#fff !important;
            }

            #lah-modular-host #containerLAH .lah-primary:hover {
                background:#0b65ae !important;
                color:#fff !important;
            }

            #lah-modular-host #containerLAH .lah-student,
            #lah-modular-host #containerLAH .lah-year-card,
            #lah-modular-host #containerLAH .lah-table-wrap,
            #lah-modular-host #containerLAH .lah-validation {
                border-radius:0 !important;
                box-shadow:none !important;
            }

            #lah-modular-host #containerLAH .lah-student {
                padding:9px !important;
                border:1px solid #bbb !important;
            }

            #lah-modular-host #containerLAH .lah-year-card {
                margin:8px 0 !important;
                border:1px solid #aaa !important;
            }

            #lah-modular-host #containerLAH .lah-year-head,
            #lah-modular-host #containerLAH .lah-year-card.is-active .lah-year-head {
                padding:6px 8px !important;
                background:#e7e7e7 !important;
            }

            #lah-modular-host #containerLAH .lah-year-title strong {
                font-size:9pt !important;
                color:#000 !important;
            }

            #lah-modular-host #containerLAH .lah-year-body {
                gap:10px !important;
                padding:10px !important;
            }

            #lah-modular-host #containerLAH .lah-disc-table th {
                padding:5px !important;
                background:#065195 !important;
                color:#fff !important;
                font-size:7pt !important;
            }

            #lah-modular-host #containerLAH .lah-disc-table td {
                padding:4px !important;
                border-top:1px solid #ddd !important;
            }

            #lah-modular-host #containerLAH .lah-disc-table input {
                min-height:25px !important;
                font-size:7.5pt !important;
            }

            #lah-modular-host #containerLAH .divlog {
                position:static !important;
                width:auto !important;
                min-width:0 !important;
                min-height:0 !important;
                margin:0 0 8px !important;
                padding:6px !important;
                transform:none !important;
                border:1px solid #bbb !important;
                border-radius:0 !important;
                background:#fff !important;
                font-size:8pt !important;
                line-height:1.35 !important;
                box-shadow:none !important;
            }

            #lah-modular-host #containerLAH .divcarregando,
            #lah-modular-host #containerLAH .divbotoes,
            #lah-modular-host #containerLAH .divajuda {
                width:100% !important;
                max-width:none !important;
            }

            #lah-modular-host #containerLAH .lah-modal-backdrop {
                position:fixed !important;
            }

            @media (max-width:900px) {
                #TABLE1_MPAGE,
                #lah-modular-host {
                    width:calc(100vw - 10px) !important;
                }
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    function lahEncontrarTabelaHistoricoNativa() {
        // Na página real enviada pelo usuário, TABLE4 contém toda a tela de
        // Manutenção de Histórico Escolar: filtros, botões e Griddetalhes.
        const table4 = document.getElementById('TABLE4');
        if (table4) return table4;

        // Fallback defensivo para pequenas mudanças futuras do SIGEDUCA.
        const inputAluno = document.getElementById('vGEDALUCOD');
        if (!inputAluno) return null;

        let no = inputAluno.parentElement;
        while (no && no !== document.body) {
            if (
                no.tagName === 'TABLE' &&
                no.querySelector?.('#GriddetalhesContainerDiv')
            ) {
                return no;
            }
            no = no.parentElement;
        }

        return null;
    }

    function lahPrepararHostForaDoGeneXus(tabelaNativa) {
        let host = document.getElementById('lah-modular-host');

        if (!host) {
            host = document.createElement('div');
            host.id = 'lah-modular-host';
        }

        // O ponto crítico da correção: o host é IRMÃO de TABLE4, nunca filho
        // de TABLE4/TABLE1/TABLE2. Assim um refresh AJAX da grade não o apaga.
        const pai = tabelaNativa?.parentNode;
        if (pai && host.parentNode !== pai) {
            pai.insertBefore(host, tabelaNativa);
        } else if (!host.isConnected) {
            const mainForm = document.getElementById('MAINFORM');
            (mainForm || document.body || document.documentElement).appendChild(host);
        }

        return host;
    }

    function lahForcarPainelVisivel(host) {
        const painel = document.getElementById('containerLAH');
        if (!painel) return false;

        if (painel.parentNode !== host) {
            host.appendChild(painel);
        }

        // Evita que qualquer estado antigo/cookie/transição volte a ocultá-lo.
        lahGuiAberta = true;
        painel.classList.remove('lah-panel-closed', 'lah-no-transition');
        painel.classList.add('lah-panel-open');
        painel.setAttribute('aria-hidden', 'false');

        // Há estilos inline do script original; removemos somente propriedades
        // relacionadas à antiga janela flutuante. O CSS do morph assume depois.
        painel.style.display = 'block';
        painel.style.opacity = '1';
        painel.style.visibility = 'visible';
        painel.style.pointerEvents = 'auto';
        painel.style.position = 'static';
        painel.style.inset = 'auto';
        painel.style.width = '100%';
        painel.style.height = 'auto';
        painel.style.maxHeight = 'none';
        painel.style.overflow = 'visible';
        painel.style.clipPath = 'none';
        painel.style.transform = 'none';

        const editor = document.getElementById('lahEditor');
        if (editor) editor.style.display = 'block';

        const botaoMaximizar = document.getElementById('exibirLAH');
        if (botaoMaximizar) botaoMaximizar.style.display = 'none';

        return true;
    }

    function lahAplicarMorphModular() {
        if (lahMorphAplicando || !LAH_MODO_FERRAMENTA) return false;
        lahMorphAplicando = true;

        try {
            lahGarantirEstiloMorph();

            document.title = 'Lançador de Históricos';

            const titulo = document.getElementById('TTITULO');
            if (titulo) titulo.textContent = 'Lançador de Históricos';

            const tabelaNativa = lahEncontrarTabelaHistoricoNativa();
            if (!tabelaNativa) return false;

            tabelaNativa.dataset.lahNativeHidden = '1';

            // Mantém TODOS os elementos nativos no DOM, inclusive
            // BUTTONCONSULTAR, BUTTONINCLUIR e GriddetalhesContainerDiv.
            // Não usamos .remove(), apenas ocultação visual.
            tabelaNativa.style.setProperty('display', 'none', 'important');

            const host = lahPrepararHostForaDoGeneXus(tabelaNativa);
            const painelOk = lahForcarPainelVisivel(host);

            // O título interno da GUI passa a combinar com a página morfada.
            const tituloGui = document.querySelector('#lah-modular-host .lah-header h2');
            if (tituloGui) tituloGui.textContent = 'Lançador de Históricos';

            // Remove a trava de scroll do modo fullscreen original.
            document.documentElement.classList.remove('lah-gui-aberta');

            return painelOk;
        } finally {
            lahMorphAplicando = false;
        }
    }

    function lahIniciarMorphRobusto() {
        let tentativas = 0;
        const MAX_TENTATIVAS_MORPH = 80;

        const tentar = () => {
            tentativas += 1;

            const sucesso = lahAplicarMorphModular();

            if (sucesso || tentativas >= MAX_TENTATIVAS_MORPH) {
                if (lahMorphRetryTimer) {
                    clearInterval(lahMorphRetryTimer);
                    lahMorphRetryTimer = null;
                }
            }
        };

        // Primeira tentativa imediata.
        tentar();

        // O GeneXus termina parte da montagem depois do document-idle.
        // Repetimos por alguns segundos sem depender de um único setTimeout.
        if (!document.getElementById('containerLAH') || !document.getElementById('TABLE4')) {
            lahMorphRetryTimer = setInterval(tentar, 100);
        } else {
            // Mesmo com ambos presentes, fazemos algumas reaplicações rápidas
            // para atravessar o primeiro ciclo de inicialização do GeneXus.
            let reforcos = 0;
            lahMorphRetryTimer = setInterval(() => {
                reforcos += 1;
                lahAplicarMorphModular();
                if (reforcos >= 12) {
                    clearInterval(lahMorphRetryTimer);
                    lahMorphRetryTimer = null;
                }
            }, 120);
        }

        // Se o GeneXus redesenhar a TABLE4 posteriormente, reaplicamos somente
        // o morph visual. O observer não remove nem recria campos do sistema.
        if (!lahMorphObserver) {
            lahMorphObserver = new MutationObserver(() => {
                if (!LAH_MODO_FERRAMENTA) return;

                const table4 = document.getElementById('TABLE4');
                const host = document.getElementById('lah-modular-host');
                const painel = document.getElementById('containerLAH');

                if (
                    (table4 && table4.dataset.lahNativeHidden !== '1') ||
                    !host ||
                    !painel ||
                    painel.parentNode !== host ||
                    getComputedStyle(painel).display === 'none' ||
                    getComputedStyle(painel).visibility === 'hidden'
                ) {
                    requestAnimationFrame(lahAplicarMorphModular);
                }
            });

            lahMorphObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }

    // Aguarda a GUI original ser construída e integra de forma persistente.
    // Não depende mais de um único timeout de 50 ms.
    lahIniciarMorphRobusto();

})();
