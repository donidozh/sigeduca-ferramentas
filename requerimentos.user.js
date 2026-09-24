// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Requerimentos
// @namespace    http://tampermonkey.net/
// @version      3.0.1
// @description  Módulo Requerimentos: transforma Consulta Matrícula(s) Por Aluno em central de requerimentos.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/requerimentos.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/requerimentos.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '3.0.1',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/requerimentos.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/requerimentos.user.js'
    });

    const FLAG = '__SIGEDUCA_REQUERIMENTOS_MODULAR_V3_0__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    // =====================================================================
    // 1. REGISTRO NO MENU MODULAR "FERRAMENTAS"
    // =====================================================================

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const FERRAMENTA = Object.freeze({
        id: 'requerimentos',
        titulo: 'Requerimentos',
        // Hash não é enviado ao GeneXus: a tela nativa recebe exatamente ?0,0.
        url: 'HWCMatriculasAluno.aspx?0,0#requerimentos',
        descricao: 'Central de Requerimentos',
        ordem: 10,
        grupo: ''
    });

    function registrarNoMenuFerramentas() {
        window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, {
            detail: { ...FERRAMENTA, ...ATUALIZACAO_SCRIPT }
        }));
    }

    window.addEventListener(EVENTO_SOLICITAR, registrarNoMenuFerramentas);
    window.addEventListener(EVENTO_BASE_PRONTA, registrarNoMenuFerramentas);
    registrarNoMenuFerramentas();
    setTimeout(registrarNoMenuFerramentas, 100);

    // =====================================================================
    // 2. CONFIGURAÇÕES
    // =====================================================================

    const HASH_REQUERIMENTOS = '#requerimentos';
    const ID_IFRAME_PESSOAL = 'iframeDadosPessoaisReq';
    const ID_IFRAME_MATRICULA = 'iframeConsultaMatriculaReq';

    function ehTelaConsultaMatricula() {
        return /\/ged\/hwcmatriculasaluno\.aspx$/i.test(window.location.pathname);
    }

    function ehModoRequerimentos() {
        return ehTelaConsultaMatricula() &&
               window.location.hash.toLowerCase() === HASH_REQUERIMENTOS;
    }

    function quandoDOMPronto(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function iniciarSeNecessario() {
        if (!ehModoRequerimentos()) return;

        quandoDOMPronto(() => {
            if (!ehModoRequerimentos()) return;
            garantirIframePessoal();
            adaptarPagina();
        });
    }

    iniciarSeNecessario();
    window.addEventListener('hashchange', iniciarSeNecessario);

    // =====================================================================
    // 3. AUXILIARES GERAIS
    // =====================================================================

    function urlGED(caminho) {
        return new URL(caminho, window.location.href).href;
    }

    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function textoElemento(doc, id) {
        return doc?.getElementById(id)?.innerText?.trim() || '';
    }

    function valorUtil(texto) {
        const v = String(texto || '').trim();
        if (!v) return '';
        if (/^(n\/?a|não informado|nao informado|null|undefined|0)$/i.test(v)) return '';
        return v;
    }

    function normalizar(texto) {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function nomeValido(texto) {
        const n = String(texto || '').trim();
        if (!n) return '';
        const x = normalizar(n);
        if (
            x === 'VALOR INFORMADO INCORRETO!' ||
            x === 'VALOR INFORMADO INCORRETO' ||
            x === 'N/A' ||
            x === 'NAO INFORMADO'
        ) return '';
        return n;
    }

    function formatarCPF(cpfStr) {
        if (!cpfStr) return '';
        const nums = String(cpfStr).replace(/\D/g, '');
        if (nums.length === 11) {
            return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return String(cpfStr).trim();
    }

    function aplicarMascaraCPF(input) {
        if (!input) return;
        input.addEventListener('input', () => {
            let v = input.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 9) {
                v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
            } else if (v.length > 6) {
                v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
            } else if (v.length > 3) {
                v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
            }
            input.value = v;
        });
    }

    function carregarIframe(iframe, url, timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            let terminou = false;

            const timer = setTimeout(() => {
                if (terminou) return;
                terminou = true;
                iframe.onload = null;
                reject(new Error(`Tempo esgotado ao carregar: ${url}`));
            }, timeoutMs);

            iframe.onload = () => {
                if (terminou) return;
                terminou = true;
                clearTimeout(timer);
                iframe.onload = null;
                resolve();
            };

            iframe.src = url;
        });
    }

    function garantirIframePessoal() {
        if (document.getElementById(ID_IFRAME_PESSOAL)) return;

        const iframe = document.createElement('iframe');
        iframe.id = ID_IFRAME_PESSOAL;
        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
    }

    function criarIframeMatriculaLimpo() {
        document.getElementById(ID_IFRAME_MATRICULA)?.remove();

        const iframe = document.createElement('iframe');
        iframe.id = ID_IFRAME_MATRICULA;
        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
        return iframe;
    }

    // =====================================================================
    // 4. "MORPH" DA TELA CONSULTA MATRÍCULA(S) POR ALUNO
    // =====================================================================

    function adaptarPagina() {
        // Idempotência: GeneXus/AJAX/hashchange não cria a interface duas vezes.
        if (document.getElementById('reqTipoDocs')) return;

        const inputAluno = document.getElementById('vGEDALUCOD');
        const btnConsultarOriginal = document.querySelector('input[name="BCONSULTAR"]');

        if (!inputAluno || !btnConsultarOriginal) {
            setTimeout(adaptarPagina, 150);
            return;
        }

        document.title = 'Emissão de Requerimentos';
        const tituloTabela = document.getElementById('TTITULO');
        if (tituloTabela) tituloTabela.textContent = 'Emissão de Requerimentos';

        // Oculta o painel do Extrator de Matrículas, caso o outro userscript
        // esteja instalado e também seja carregado nesta página.
        const css = document.createElement('style');
        css.id = 'req-estilos-tela';
        css.textContent = `
            #tm-extractor-panel { display:none !important; }
            .req-inline-check {
                margin-left: 12px;
                font-family: Verdana, Arial, sans-serif;
                font-size: 8pt;
                white-space: nowrap;
            }
            .req-ajuda {
                margin-left: 6px;
                color: #666;
                font-size: 7.5pt;
            }
        `;
        document.head.appendChild(css);

        // Mantém da tela original APENAS a linha nativa do código do aluno,
        // sua lupa e o span de nome. Os demais campos nativos são ocultados.
        [
            'vGERANOLETCOD',
            'vGEDALUIDINEP',
            'span_vGERPESDTANASC',
            'span_vGERPESNOMMAE'
        ].forEach(id => {
            const el = document.getElementById(id);
            const tr = el?.closest('tr');
            if (tr) tr.style.display = 'none';
        });

        // A grade de matrículas permanece invisível. A consulta complementar
        // será feita em um iframe limpo da MESMA tela.
        const grids = document.getElementById('GRIDS');
        if (grids) grids.style.display = 'none';

        const trAluno = inputAluno.closest('tr');
        const trBotao = btnConsultarOriginal.closest('tr');
        if (!trAluno || !trBotao) {
            console.error('[Requerimentos] Não foi possível localizar as linhas principais.');
            return;
        }

        // Remove/oculta a linha vazia imediatamente anterior ao botão nativo.
        const anteriorBotao = trBotao.previousElementSibling;
        if (anteriorBotao && !anteriorBotao.querySelector('input, select, textarea, span[id]')) {
            anteriorBotao.style.display = 'none';
        }

        // -----------------------------------------------------------------
        // Tipo do requerimento - vem ANTES da linha do aluno.
        // -----------------------------------------------------------------
        const trTipo = document.createElement('tr');
        trTipo.id = 'trTipoRequerimento';
        trTipo.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Tipo de Documento:</span></p>
            </td>
            <td>
                <select id="reqTipoDocs" class="Attribute" style="width:320px;">
                    <option value="transferencia" selected>Transferência de Escola</option>
                    <option value="remocao">Remoção de Turma/Turno</option>
                    <option value="segundavia">2ª via de Documentos</option>
                    <option value="desistencia">Desistência de Curso</option>
                </select>
            </td>
        `;
        trAluno.parentNode.insertBefore(trTipo, trAluno);

        // -----------------------------------------------------------------
        // Linha nativa do aluno + checkbox "Aluno fora do sistema".
        // -----------------------------------------------------------------
        const tdAluno = inputAluno.closest('td');
        const promptAluno = tdAluno?.querySelector('a[href*="openPrompt"]');
        const spanNomeAluno = document.getElementById('span_vGEDALUNOM');

        if (tdAluno && !document.getElementById('reqForaSistemaBox')) {
            const box = document.createElement('span');
            box.id = 'reqForaSistemaBox';
            box.className = 'req-inline-check';
            box.style.display = 'none';
            box.innerHTML = `
                <label title="Use para aluno antigo que não possui cadastro no SIGEDUCA.">
                    <input type="checkbox" id="reqForaSistema">
                    Aluno fora do sistema
                </label>
            `;
            tdAluno.appendChild(box);
        }

        // -----------------------------------------------------------------
        // Dados manuais do aluno fora do SIGEDUCA.
        // -----------------------------------------------------------------
        const trManual = document.createElement('tr');
        trManual.id = 'trAlunoManual';
        trManual.style.display = 'none';
        trManual.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Dados do Aluno:</span></p>
            </td>
            <td>
                <input type="text" id="reqAlunoManualNome" class="Attribute"
                       placeholder="Nome completo" style="width:280px;margin-right:5px;" autocomplete="off">
                <input type="text" id="reqAlunoManualCPF" class="Attribute"
                       placeholder="CPF" style="width:130px;" maxlength="14" autocomplete="off">
            </td>
        `;
        trAluno.parentNode.insertBefore(trManual, trAluno.nextSibling);

        // -----------------------------------------------------------------
        // Solicitante.
        // -----------------------------------------------------------------
        const trSolicitante = document.createElement('tr');
        trSolicitante.id = 'trSolicitante';
        trSolicitante.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Solicitante:</span></p>
            </td>
            <td>
                <select id="reqSolicitante" class="Attribute" style="width:320px;">
                    <option value="responsavel">Responsável</option>
                    <option value="proprio">O Próprio Aluno</option>
                    <option value="terceiro">Terceiro (Outra Pessoa)</option>
                </select>
            </td>
        `;
        trAluno.parentNode.insertBefore(trSolicitante, trManual.nextSibling);

        // -----------------------------------------------------------------
        // Dados do terceiro.
        // -----------------------------------------------------------------
        const trTerceiro = document.createElement('tr');
        trTerceiro.id = 'trTerceiro';
        trTerceiro.style.display = 'none';
        trTerceiro.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Dados Terceiro:</span></p>
            </td>
            <td>
                <input type="text" id="terceiroNome" class="Attribute"
                       placeholder="Nome Completo do Terceiro" style="width:280px;margin-right:5px;" autocomplete="off">
                <input type="text" id="terceiroCPF" class="Attribute"
                       placeholder="CPF" style="width:130px;" maxlength="14" autocomplete="off">
            </td>
        `;
        trAluno.parentNode.insertBefore(trTerceiro, trSolicitante.nextSibling);

        // -----------------------------------------------------------------
        // Destino - apenas transferência de escola.
        // -----------------------------------------------------------------
        const trDestino = document.createElement('tr');
        trDestino.id = 'trDestino';
        trDestino.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Destino:</span></p>
            </td>
            <td>
                <input type="text" id="escolaDestino" class="Attribute"
                       placeholder="Nome da Escola de Destino" style="width:280px;margin-right:5px;" autocomplete="off">
                <input type="text" id="cidadeDestino" class="Attribute"
                       placeholder="Município" style="width:130px;" autocomplete="off">
            </td>
        `;
        trAluno.parentNode.insertBefore(trDestino, trTerceiro.nextSibling);

        // -----------------------------------------------------------------
        // Documentos da 2ª via.
        // -----------------------------------------------------------------
        const trDocs = document.createElement('tr');
        trDocs.id = 'trDocs2aVia';
        trDocs.style.display = 'none';
        trDocs.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;vertical-align:top;">
                <p align="right"><span class="TituloCampo">Documentos:</span></p>
            </td>
            <td>
                <span style="font-family:'Verdana';font-size:8pt;color:#000;line-height:1.8;">
                    <label><input type="checkbox" name="docs2a" value="Diploma de Conclusão do Curso Técnico"> Diploma de Conclusão do Curso Técnico</label><br>
                    <label><input type="checkbox" name="docs2a" value="Certificado de Conclusão do Ensino Médio"> Certificado de Conclusão do Ensino Médio</label><br>
                    <label><input type="checkbox" name="docs2a" value="Histórico Escolar do Ensino Médio"> Histórico Escolar do Ensino Médio</label><br>
                    <label><input type="checkbox" name="docs2a" value="Histórico Escolar do Ensino Fundamental"> Histórico Escolar do Ensino Fundamental</label>
                </span>
            </td>
        `;
        trAluno.parentNode.insertBefore(trDocs, trDestino.nextSibling);

        // -----------------------------------------------------------------
        // Motivo da 2ª via.
        // -----------------------------------------------------------------
        const trMotivo = document.createElement('tr');
        trMotivo.id = 'trMotivo2aVia';
        trMotivo.style.display = 'none';
        trMotivo.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Motivo da 2ª via:</span></p>
            </td>
            <td>
                <select id="reqMotivo2aVia" class="Attribute" style="width:320px;">
                    <option value="Extravio">Extravio</option>
                    <option value="Apostilamento">Apostilamento</option>
                    <option value="Correção de Dados Pessoais">Correção de Dados Pessoais</option>
                    <option value="Correção de Escrituração">Correção de Escrituração</option>
                    <option value="Não Especificado" selected>Não Especificado</option>
                </select>
            </td>
        `;
        trAluno.parentNode.insertBefore(trMotivo, trDocs.nextSibling);

        // -----------------------------------------------------------------
        // MODO - propositalmente a PENÚLTIMA opção, sempre antes de Imprimir.
        // -----------------------------------------------------------------
        const trModo = document.createElement('tr');
        trModo.id = 'trModoRequerimento';
        trModo.innerHTML = `
            <td style="text-align:-khtml-right;height:30px;">
                <p align="right"><span class="TituloCampo">Modo:</span></p>
            </td>
            <td>
                <span style="font-family:'Verdana';font-size:8pt;color:#000;">
                    <label><input type="radio" name="reqModo" value="preenchido" checked> Preenchido</label>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <label><input type="radio" name="reqModo" value="embranco"> Em Branco</label>
                </span>
            </td>
        `;
        trBotao.parentNode.insertBefore(trModo, trBotao);

        // -----------------------------------------------------------------
        // Troca o botão Consultar pelo botão Imprimir.
        // -----------------------------------------------------------------
        const btnImprimir = document.createElement('input');
        btnImprimir.type = 'button';
        btnImprimir.id = 'reqBtnImprimir';
        btnImprimir.value = 'Imprimir';
        btnImprimir.title = 'Imprimir Requerimento';
        btnImprimir.className = 'btnConsultar btnImprimir';
        btnImprimir.addEventListener('click', processarRequerimento);
        btnConsultarOriginal.replaceWith(btnImprimir);

        // Máscaras.
        aplicarMascaraCPF(document.getElementById('terceiroCPF'));
        aplicarMascaraCPF(document.getElementById('reqAlunoManualCPF'));

        // -----------------------------------------------------------------
        // Regras de exibição.
        // -----------------------------------------------------------------
        const selectTipo = document.getElementById('reqTipoDocs');
        const checkFora = document.getElementById('reqForaSistema');
        const selectSolicitante = document.getElementById('reqSolicitante');
        const opcaoResponsavel = selectSolicitante?.querySelector('option[value="responsavel"]');

        function atualizarSolicitante() {
            trTerceiro.style.display =
                selectSolicitante?.value === 'terceiro' ? '' : 'none';
        }

        function atualizarForaSistema() {
            const eh2a = selectTipo?.value === 'segundavia';
            const fora = eh2a && !!checkFora?.checked;

            trManual.style.display = fora ? '' : 'none';

            // "Aluno fora do sistema" só existe para 2ª via.
            const box = document.getElementById('reqForaSistemaBox');
            if (box) box.style.display = eh2a ? 'inline-block' : 'none';

            // Quando fora do sistema, o código/lupa deixam de ser necessários.
            inputAluno.disabled = fora;
            if (promptAluno) promptAluno.style.display = fora ? 'none' : '';
            if (spanNomeAluno) spanNomeAluno.style.display = fora ? 'none' : '';

            if (fora) {
                // Sem cadastro não há como extrair responsável automaticamente.
                // Deixamos "O Próprio Aluno" como escolha segura; "Terceiro"
                // continua disponível para preenchimento manual.
                if (opcaoResponsavel) opcaoResponsavel.disabled = true;
                if (selectSolicitante?.value === 'responsavel') {
                    selectSolicitante.value = 'proprio';
                }
            } else {
                if (opcaoResponsavel) opcaoResponsavel.disabled = false;
            }

            atualizarSolicitante();
        }

        function atualizarTipo() {
            const tipo = selectTipo?.value;
            const eh2a = tipo === 'segundavia';

            trDestino.style.display = tipo === 'transferencia' ? '' : 'none';
            trDocs.style.display = eh2a ? '' : 'none';
            trMotivo.style.display = eh2a ? '' : 'none';

            atualizarForaSistema();
        }

        selectTipo?.addEventListener('change', atualizarTipo);
        checkFora?.addEventListener('change', atualizarForaSistema);
        selectSolicitante?.addEventListener('change', atualizarSolicitante);

        atualizarTipo();
        atualizarSolicitante();

        // Garante que o título não seja reescrito por JS tardio do GeneXus.
        setTimeout(() => {
            document.title = 'Emissão de Requerimentos';
            if (tituloTabela) tituloTabela.textContent = 'Emissão de Requerimentos';
        }, 500);

        console.debug('[Requerimentos] Consulta Matrícula(s) Por Aluno transformada com sucesso.');
    }

    // =====================================================================
    // 5. DADOS PESSOAIS
    // =====================================================================

    async function consultarDadosPessoais(codigoAluno) {
        const iframe = document.getElementById(ID_IFRAME_PESSOAL);
        if (!iframe) throw new Error('Iframe de dados pessoais não encontrado.');

        try {
            const url = urlGED(
                `hwtmgedaluno.aspx?${encodeURIComponent(codigoAluno)},,HWMConAluno,DSP,1,0`
            );

            await carregarIframe(iframe, url);

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) throw new Error('Documento do aluno indisponível.');

            return {
                aluno: nomeValido(textoElemento(doc, 'span_CTLGERPESNOM')) ||
                       nomeValido(textoElemento(document, 'span_vGEDALUNOM')),
                alunoCPF: formatarCPF(textoElemento(doc, 'span_CTLGERPESCPF')),
                respNome: nomeValido(textoElemento(doc, 'span_CTLGERPESNOMRESP')),
                respCPF: formatarCPF(textoElemento(doc, 'span_CTLGERPESRESPCPF'))
            };
        } catch (erro) {
            console.warn('[Requerimentos] Consulta de dados pessoais falhou.', erro);
            return {
                aluno: nomeValido(textoElemento(document, 'span_vGEDALUNOM')),
                alunoCPF: '',
                respNome: '',
                respCPF: ''
            };
        }
    }

    // =====================================================================
    // 6. CONSULTA DA MATRÍCULA VIGENTE
    //
    // Usa a MESMA lógica do "Extrator Automático - Matrículas SigEduca":
    // - HWCMatriculasAluno.aspx;
    // - zera os campos;
    // - dispara change/blur;
    // - clica no Consultar nativo;
    // - aguarda a grade;
    // - encontra a ÚLTIMA movimentação da escola atual;
    // - lê situação, turma e turno.
    // =====================================================================

    function obterCodigoEscolaAtual() {
        const texto = textoElemento(document, 'MPW0010TLOTACAO');
        return texto.split('-')[0]?.trim() || '';
    }

    function dispararEventosGeneXus(el) {
        if (!el) return;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    async function aguardarConsultaMatricula(iframe, timeoutMs = 15000) {
        const inicio = Date.now();

        while (Date.now() - inicio < timeoutMs) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) {
                await esperar(250);
                continue;
            }

            const erro = doc.getElementById('gxErrorViewer')?.innerText?.trim() || '';
            if (erro) {
                return { ok: false, erro };
            }

            const rows = doc.querySelectorAll("tr[id^='FreesgridContainerRow_']");
            const ajaxLoader = doc.getElementById('gx_ajax_notification');
            const carregando = ajaxLoader && ajaxLoader.style.display !== 'none';
            const nome = nomeValido(textoElemento(doc, 'span_vGEDALUNOM'));

            if (rows.length > 0 && !carregando && nome) {
                // Delay extra igual à ideia usada no extrator para garantir que
                // os spans internos da grade terminaram de renderizar.
                await esperar(650);
                return { ok: true };
            }

            await esperar(250);
        }

        return { ok: false, erro: 'Tempo limite da consulta de matrícula.' };
    }

    function lerSituacaoMatricula(doc, suffix) {
        const getVal = prefix =>
            textoElemento(doc, `${prefix}_${suffix}`);

        let situacao = normalizar(getVal('span_vGEDHISTSITAPR'));

        // A tela muitas vezes retorna "AGUARDANDO FECHAMENTO" no campo-resumo.
        // Nesse caso, o Extrator procura a situação real dentro do GRIDDISC.
        if (situacao === 'AGUARDANDO FECHAMENTO') {
            const situacoesAlvo = [
                'AFASTADO POR ABANDONO',
                'DEPENDENTE',
                'AFASTADO POR DESISTENCIA',
                'MATRICULADO',
                'MATRICULA EXTRAORDINARIA',
                'MATRICULA DE PROGRESSAO PARCIAL',
                'RECLASSIFICADO',
                'TRANSFERIDO DA TURMA',
                'TRANSFERIDO DA ESCOLA',
                'TRANSF. ESCOLA - DEPENDENTE',
                'TRANSF. ESCOLA - MAT. PROGRE. PARC.',
                'TRANSF. ESCOLA - MAT. PROGRESSAO PARC.',
                'TRANSF. ESCOLA - MAT. EXTRAORD.',
                'OBITO',
                'MATRICULA CANCELADA',
                'MATRICULA ESTORNADA',
                'TRANSFERENCIA CANCELADA',
                'TRANSFERENCIA ESTORNADA',
                'RECLASSIFICACAO CANCELADA',
                'RECLASSIFICACAO ESTORNADA',
                'MATRICULA PENDENTE',
                'MATRICULA COM PENDENCIA',
                'SUPERADO',
                'SUPERACAO ESTORNADA',
                'SUPERACAO CANCELADA',
                'RESERVA DE MATRICULA',
                'AFASTADO C.H. COMPONENTE CURRICULAR',
                'TRANSFERENCIA DE TURMA'
            ];

            const gridDisc = doc.getElementById(`GRIDDISC_${suffix}`);
            if (gridDisc) {
                for (const span of gridDisc.querySelectorAll('span')) {
                    const t = normalizar(span.textContent);
                    if (situacoesAlvo.includes(t)) {
                        situacao = t;
                        break;
                    }
                }
            }
        }

        return situacao;
    }

    function situacaoEhTransferida(situacao) {
        const s = normalizar(situacao);
        return [
            'TRANSFERIDO DA TURMA',
            'TRANSFERIDO DA ESCOLA',
            'TRANSF. ESCOLA - DEPENDENTE',
            'TRANSF. ESCOLA - MAT. PROGRE. PARC.',
            'TRANSF. ESCOLA - MAT. PROGRESSAO PARC.',
            'TRANSF. ESCOLA - MAT. EXTRAORD.',
            'TRANSFERENCIA DE TURMA'
        ].includes(s);
    }

    function situacaoEhMatriculaVigente(situacao) {
        const s = normalizar(situacao);
        return [
            'MATRICULADO',
            'MATRICULA EXTRAORDINARIA',
            'MATRICULA DE PROGRESSAO PARCIAL'
        ].includes(s);
    }

    async function consultarMatriculaVigente(codigoAluno) {
        const escolaAtual = obterCodigoEscolaAtual();
        if (!escolaAtual) {
            console.warn('[Requerimentos] Código da escola atual não encontrado.');
            return null;
        }

        const iframe = criarIframeMatriculaLimpo();

        try {
            // Sem #requerimentos para que a tela dentro do iframe permaneça NATIVA.
            await carregarIframe(
                iframe,
                urlGED('HWCMatriculasAluno.aspx?0,0')
            );

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return null;

            const inputCod = doc.getElementById('vGEDALUCOD');
            const inputInep = doc.getElementById('vGEDALUIDINEP');
            const btnConsultar = doc.querySelector("input[name='BCONSULTAR']");

            if (!inputCod || !btnConsultar) {
                console.warn('[Requerimentos] Controles nativos de matrícula não encontrados.');
                return null;
            }

            // Mantém o mesmo ano letivo da tela principal, se possível.
            const anoPrincipal =
                textoElemento(document, 'MPW0010TANOLETIVO') ||
                document.getElementById('vGERANOLETCOD')?.value ||
                '';

            const selectAno = doc.getElementById('vGERANOLETCOD');
            if (selectAno && anoPrincipal && selectAno.value !== anoPrincipal) {
                selectAno.value = anoPrincipal;
                dispararEventosGeneXus(selectAno);
                await esperar(500);
            }

            // Limpeza profunda da consulta anterior.
            const grid = doc.getElementById('FreesgridContainerTbl');
            if (grid) grid.innerHTML = '';

            const errorViewer = doc.getElementById('gxErrorViewer');
            if (errorViewer) errorViewer.innerHTML = '';

            const nomeEl = doc.getElementById('span_vGEDALUNOM');
            if (nomeEl) nomeEl.innerText = '';

            if (inputInep) {
                inputInep.value = '0';
                dispararEventosGeneXus(inputInep);
            }

            inputCod.value = '0';
            dispararEventosGeneXus(inputCod);

            await esperar(300);

            inputCod.value = codigoAluno;
            dispararEventosGeneXus(inputCod);

            await esperar(500);
            btnConsultar.click();

            const aguardou = await aguardarConsultaMatricula(iframe);
            if (!aguardou.ok) {
                console.debug('[Requerimentos] Matrícula não retornada:', aguardou.erro);
                return null;
            }

            const rows = Array.from(
                doc.querySelectorAll("tr[id^='FreesgridContainerRow_']")
            );

            // Copia exatamente a ideia do extrator: a cada linha da escola
            // sobrescreve o suffix; ao final, fica a ÚLTIMA movimentação.
            let targetSuffix = null;

            for (const row of rows) {
                const match = row.id.match(/FreesgridContainerRow_(\d+)/);
                if (!match) continue;

                const suffix = match[1];
                const escola = textoElemento(doc, `span_vGERLOTNOMAUX_${suffix}`);
                if (escola && escola.includes(escolaAtual)) {
                    targetSuffix = suffix;
                }
            }

            if (!targetSuffix) {
                console.debug('[Requerimentos] Aluno sem movimentação na escola atual.');
                return null;
            }

            const getVal = prefix =>
                valorUtil(textoElemento(doc, `${prefix}_${targetSuffix}`));

            const situacao = lerSituacaoMatricula(doc, targetSuffix);

            // Regra solicitada: se a ÚLTIMA matrícula/movimentação for
            // transferência, NÃO leva informação de turma/turno ao requerimento.
            if (situacaoEhTransferida(situacao)) {
                console.debug('[Requerimentos] Última matrícula é transferência; informação omitida.', situacao);
                return null;
            }

            // Só informa turma/turno quando a última matrícula é efetivamente
            // vigente/ativa na escola.
            if (!situacaoEhMatriculaVigente(situacao)) {
                console.debug('[Requerimentos] Última situação não é matrícula vigente; informação omitida.', situacao);
                return null;
            }

            const turma = getVal('span_vGERTURSAL');
            const turno = getVal('span_vGERTRNDSC');
            const numero = getVal('span_vGEDMATCOD_GRIDFS');
            const anoLetivo = getVal('span_vANO_LETIVO_ALUNO');

            if (!turma && !turno) return null;

            return {
                numero,
                turma,
                turno,
                anoLetivo,
                situacao
            };

        } catch (erro) {
            console.warn('[Requerimentos] Falha na consulta da matrícula vigente.', erro);
            return null;
        }
    }

    // =====================================================================
    // 7. PROCESSAMENTO
    // =====================================================================

    async function processarRequerimento(event) {
        event?.preventDefault?.();

        const selectTipo = document.getElementById('reqTipoDocs');
        const radioModo = document.querySelector('input[name="reqModo"]:checked');
        const selectSolicitante = document.getElementById('reqSolicitante');
        const inputCodigo = document.getElementById('vGEDALUCOD');

        if (!selectTipo || !radioModo || !selectSolicitante) {
            alert('A tela de requerimentos ainda não terminou de carregar.');
            return;
        }

        const tipoId = selectTipo.value;
        const tipoLabel =
            selectTipo.options[selectTipo.selectedIndex]?.text || 'Requerimento';
        const modo = radioModo.value;
        const solicitante = selectSolicitante.value;
        const codigoAluno = inputCodigo?.value?.trim() || '';

        const foraSistema =
            tipoId === 'segundavia' &&
            !!document.getElementById('reqForaSistema')?.checked;

        const docsSelecionados = Array.from(
            document.querySelectorAll('input[name="docs2a"]:checked')
        ).map(cb => cb.value);

        const motivo2aVia =
            document.getElementById('reqMotivo2aVia')?.value || 'Não Especificado';

        const escolaDestino =
            document.getElementById('escolaDestino')?.value?.trim() || '';

        const cidadeDestino =
            document.getElementById('cidadeDestino')?.value?.trim() || '';

        const terceiroNome =
            document.getElementById('terceiroNome')?.value?.trim() || '';

        const terceiroCPF =
            formatarCPF(document.getElementById('terceiroCPF')?.value);

        // Abre a janela ainda no clique para não ser bloqueada após awaits.
        const janelaImpressao = window.open('', '_blank');
        if (!janelaImpressao) {
            alert('O navegador bloqueou a janela de impressão. Permita pop-ups para o SIGEDUCA.');
            return;
        }

        janelaImpressao.document.open();
        janelaImpressao.document.write(
            '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
            '<title>Gerando requerimento...</title></head>' +
            '<body style="font-family:Arial,sans-serif;padding:30px">' +
            'Consultando dados e preparando o requerimento...</body></html>'
        );
        janelaImpressao.document.close();

        const btn = document.getElementById('reqBtnImprimir');
        const textoOriginal = btn?.value || 'Imprimir';

        if (btn) {
            btn.value = 'Gerando...';
            btn.disabled = true;
        }

        try {
            // -------------------------------------------------------------
            // Modo em branco: não consulta nada.
            // -------------------------------------------------------------
            if (modo === 'embranco') {
                gerarDocumento({
                    escolaDestino,
                    cidadeDestino,
                    motivo2aVia,
                    matriculaAtual: null,
                    foraSistema: false
                }, tipoId, tipoLabel, 'embranco', null, docsSelecionados, janelaImpressao);
                return;
            }

            // -------------------------------------------------------------
            // 2ª via - aluno fora do sistema: dados digitados manualmente.
            // -------------------------------------------------------------
            if (foraSistema) {
                const alunoManual =
                    document.getElementById('reqAlunoManualNome')?.value?.trim() || '';

                const cpfManual =
                    formatarCPF(document.getElementById('reqAlunoManualCPF')?.value);

                if (!alunoManual) {
                    throw new Error('Informe o nome completo do aluno fora do sistema.');
                }

                const dados = {
                    aluno: alunoManual,
                    alunoCPF: cpfManual || '____________________',
                    codigo: '',
                    respNome: '',
                    respCPF: '',
                    terceiroNome: terceiroNome || '____________________________________________________________',
                    terceiroCPF: terceiroCPF || '____________________',
                    escolaDestino,
                    cidadeDestino,
                    motivo2aVia,
                    matriculaAtual: null,
                    foraSistema: true
                };

                gerarDocumento(
                    dados,
                    tipoId,
                    tipoLabel,
                    modo,
                    solicitante,
                    docsSelecionados,
                    janelaImpressao
                );
                return;
            }

            // -------------------------------------------------------------
            // Demais casos preenchidos: precisa de código do aluno.
            // -------------------------------------------------------------
            if (!codigoAluno || codigoAluno === '0') {
                throw new Error('Informe o código do aluno ou selecione "Em Branco".');
            }

            if (btn) btn.value = 'Consultando aluno...';
            const pessoais = await consultarDadosPessoais(codigoAluno);

            const aluno =
                pessoais.aluno ||
                nomeValido(textoElemento(document, 'span_vGEDALUNOM'));

            if (!aluno) {
                throw new Error(
                    'Não foi possível localizar o aluno. Confira o código informado.'
                );
            }

            let matriculaAtual = null;

            if (tipoId === 'transferencia' || tipoId === 'remocao') {
                if (btn) btn.value = 'Consultando matrícula...';
                matriculaAtual = await consultarMatriculaVigente(codigoAluno);
            }

            const dados = {
                aluno,
                alunoCPF: pessoais.alunoCPF || '____________________',
                codigo: codigoAluno,
                respNome: pessoais.respNome || '____________________________________________________________',
                respCPF: pessoais.respCPF || '____________________',
                terceiroNome: terceiroNome || '____________________________________________________________',
                terceiroCPF: terceiroCPF || '____________________',
                escolaDestino,
                cidadeDestino,
                motivo2aVia,
                matriculaAtual,
                foraSistema: false
            };

            gerarDocumento(
                dados,
                tipoId,
                tipoLabel,
                modo,
                solicitante,
                docsSelecionados,
                janelaImpressao
            );

        } catch (erro) {
            console.error('[Requerimentos] Erro ao gerar:', erro);

            try {
                if (!janelaImpressao.closed) janelaImpressao.close();
            } catch (_) {}

            alert(erro?.message || 'Erro ao gerar o requerimento.');
        } finally {
            if (btn) {
                btn.value = textoOriginal;
                btn.disabled = false;
            }
        }
    }

    // =====================================================================
    // 8. MODELO DE IMPRESSÃO
    // =====================================================================

    function escaparHTML(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function obterAnoLetivo() {
        return textoElemento(document, 'MPW0010TANOLETIVO') ||
               document.getElementById('vGERANOLETCOD')?.value ||
               String(new Date().getFullYear());
    }

    function obterNomeTecnico() {
        const loginSpan = document.getElementById('MPW0010TLOGIN');
        if (!loginSpan) return 'Técnico Administrativo';

        const texto = loginSpan.innerText || '';
        const nome = texto.replace(/^USU.?RIO\s+LOGADO:\s*/i, '').trim();
        return nome || 'Técnico Administrativo';
    }

    function formatarDataExtenso(data = new Date()) {
        const meses = [
            'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
        ];

        return `${String(data.getDate()).padStart(2, '0')} de ` +
               `${meses[data.getMonth()]} de ${data.getFullYear()}`;
    }

    function preencherOuLinha(valor, linha) {
        const v = String(valor || '').trim();
        return v ? escaparHTML(v) : linha;
    }

    function infoMatriculaHTML(dados) {
        const mat = dados?.matriculaAtual;
        if (!mat) return '';

        const turma = mat.turma ? escaparHTML(mat.turma) : '';
        const turno = mat.turno ? escaparHTML(mat.turno) : '';

        if (turma && turno) {
            return `, atualmente matriculado(a) na turma <b>${turma}</b>, turno <b>${turno}</b>`;
        }
        if (turma) {
            return `, atualmente matriculado(a) na turma <b>${turma}</b>`;
        }
        if (turno) {
            return `, atualmente matriculado(a) no turno <b>${turno}</b>`;
        }
        return '';
    }

    function listaDocumentosHTML(docsSelecionados) {
        if (!docsSelecionados?.length) {
            return '<div class="linha-manual">________________________________________________________________________________</div>';
        }

        return `<ul class="lista-docs">${docsSelecionados
            .map(doc => `<li>${escaparHTML(doc)}</li>`)
            .join('')}</ul>`;
    }

    function gerarCorpoRequerimento(
        dados,
        tipo,
        modo,
        solicitante,
        docsSelecionados
    ) {
        const anoLetivo = obterAnoLetivo();
        const escDest = preencherOuLinha(
            dados?.escolaDestino,
            '____________________________________________'
        );
        const cidDest = preencherOuLinha(
            dados?.cidadeDestino,
            '____________________________'
        );

        const motivo2a =
            escaparHTML(dados?.motivo2aVia || 'Não Especificado');

        const listaDocs = listaDocumentosHTML(docsSelecionados);

        const linhaNome = '____________________________________________________________';
        const linhaCPF = '____________________';
        const linhaAluno = '____________________________________________________________';

        // -------------------------------------------------------------
        // MODO EM BRANCO
        // -------------------------------------------------------------
        if (modo === 'embranco') {
            if (tipo === 'transferencia') {
                return `
                    <p class="paragrafo">Eu, <b>${linhaNome}</b>, portador(a) do CPF <b>${linhaCPF}</b>, venho por meio deste requerer a transferência do(a) aluno(a) <b>${linhaAluno}</b>, matriculado(a) nesta unidade escolar no ano letivo de ${escaparHTML(anoLetivo)}, para a unidade escolar <b>${escDest}</b>, no município de <b>${cidDest}</b>. Nada mais a declarar, dato e assino o presente.</p>
                `;
            }

            if (tipo === 'remocao') {
                return `
                    <p class="paragrafo">Eu, <b>${linhaNome}</b>, portador(a) do CPF <b>${linhaCPF}</b>, requeiro a remoção do(a) aluno(a) <b>${linhaAluno}</b> para o turno/turma: <b>_________________________________</b>, pelos seguintes motivos:</p>
                    <p class="sem-recuo motivo-livre">______________________________________________________________________________________________<br><br>
                    ________________________________________________________________________________________________</p>
                    <p class="paragrafo">Nestes termos, pede deferimento.</p>
                `;
            }

            if (tipo === 'segundavia') {
                return `
                    <p class="paragrafo">Eu, <b>${linhaNome}</b>, portador(a) do CPF <b>${linhaCPF}</b>, venho por meio deste requerer a emissão da 2ª via de documentos escolares do(a) aluno(a) <b>${linhaAluno}</b>.</p>
                    <div class="bloco"><b>Documentos solicitados:</b>${listaDocs}</div>
                    <p class="sem-recuo"><b>Motivo:</b> ${motivo2a}.</p>
                    <p class="paragrafo">Nestes termos, pede deferimento.</p>
                `;
            }

            if (tipo === 'desistencia') {
                return `
                    <p class="paragrafo">Eu, <b>${linhaNome}</b>, portador(a) do CPF <b>${linhaCPF}</b>, venho por meio deste requerer a desistência de curso nesta unidade escolar.</p>
                    <p class="sem-recuo motivo-livre"><b>Motivo:</b> ______________________________________________________________________________________<br><br>
                    ________________________________________________________________________________________________</p>
                    <p class="paragrafo">Nestes termos, pede deferimento.</p>
                `;
            }
        }

        const aluno = escaparHTML(dados?.aluno || linhaAluno);
        const codigo = escaparHTML(dados?.codigo || '');
        const strAlunoCod =
            `<b>${aluno}${codigo ? ` (Cód: ${codigo})` : ''}</b>`;

        const infoMat = infoMatriculaHTML(dados);

        let nomeSolicitante = '';
        let cpfSolicitante = '';

        if (solicitante === 'proprio') {
            nomeSolicitante = dados?.aluno;
            cpfSolicitante = dados?.alunoCPF;
        } else if (solicitante === 'terceiro') {
            nomeSolicitante = dados?.terceiroNome;
            cpfSolicitante = dados?.terceiroCPF;
        } else {
            nomeSolicitante = dados?.respNome;
            cpfSolicitante = dados?.respCPF;
        }

        const nome = escaparHTML(nomeSolicitante || linhaNome);
        const cpf = escaparHTML(cpfSolicitante || linhaCPF);

        // -------------------------------------------------------------
        // TRANSFERÊNCIA
        // -------------------------------------------------------------
        if (tipo === 'transferencia') {
            if (solicitante === 'proprio') {
                return `
                    <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, venho por meio deste requerer a minha transferência desta unidade escolar${infoMat}, no ano letivo de ${escaparHTML(anoLetivo)}, para a unidade escolar <b>${escDest}</b>, no município de <b>${cidDest}</b>. Nada mais a declarar, dato e assino o presente.</p>
                `;
            }

            return `
                <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, venho por meio deste requerer a transferência do(a) aluno(a) ${strAlunoCod}${infoMat}, no ano letivo de ${escaparHTML(anoLetivo)}, para a unidade escolar <b>${escDest}</b>, no município de <b>${cidDest}</b>. Nada mais a declarar, dato e assino o presente.</p>
            `;
        }

        // -------------------------------------------------------------
        // REMOÇÃO DE TURMA/TURNO
        // -------------------------------------------------------------
        if (tipo === 'remocao') {
            if (solicitante === 'proprio') {
                return `
                    <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, requeiro a minha remoção${infoMat} para o turno/turma: <b>_________________________________</b>, pelos seguintes motivos:</p>
                    <p class="sem-recuo motivo-livre">______________________________________________________________________________________________<br><br>
                    ________________________________________________________________________________________________</p>
                    <p class="paragrafo">Nestes termos, pede deferimento.</p>
                `;
            }

            return `
                <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, requeiro a remoção do(a) aluno(a) ${strAlunoCod}${infoMat} para o turno/turma: <b>_________________________________</b>, pelos seguintes motivos:</p>
                <p class="sem-recuo motivo-livre">______________________________________________________________________________________________<br><br>
                ________________________________________________________________________________________________</p>
                <p class="paragrafo">Nestes termos, pede deferimento.</p>
            `;
        }

        // -------------------------------------------------------------
        // 2ª VIA
        // -------------------------------------------------------------
        if (tipo === 'segundavia') {
            if (solicitante === 'proprio') {
                return `
                    <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, venho por meio deste requerer a emissão da 2ª via de meus documentos escolares.</p>
                    <div class="bloco"><b>Documentos solicitados:</b>${listaDocs}</div>
                    <p class="sem-recuo"><b>Motivo:</b> ${motivo2a}.</p>
                    <p class="paragrafo">Nestes termos, pede deferimento.</p>
                `;
            }

            return `
                <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, venho por meio deste requerer a emissão da 2ª via de documentos escolares do(a) aluno(a) ${strAlunoCod}.</p>
                <div class="bloco"><b>Documentos solicitados:</b>${listaDocs}</div>
                <p class="sem-recuo"><b>Motivo:</b> ${motivo2a}.</p>
                <p class="paragrafo">Nestes termos, pede deferimento.</p>
            `;
        }

        // -------------------------------------------------------------
        // DESISTÊNCIA
        // -------------------------------------------------------------
        if (tipo === 'desistencia') {
            return `
                <p class="paragrafo">Eu, <b>${nome}</b>, portador(a) do CPF <b>${cpf}</b>, venho por meio deste requerer a desistência de curso nesta unidade escolar.</p>
                <p class="sem-recuo motivo-livre"><b>Motivo:</b> ______________________________________________________________________________________<br><br>
                ________________________________________________________________________________________________</p>
                <p class="paragrafo">Nestes termos, pede deferimento.</p>
            `;
        }

        return '<p class="paragrafo">Requerimento.</p>';
    }

    function gerarDocumento(
        dados,
        tipo,
        tipoTexto,
        modo,
        solicitante,
        docsSelecionados,
        janelaImpressao
    ) {
        const nomeTecnico = obterNomeTecnico();
        const dataFormatada = formatarDataExtenso();
        const corpo = gerarCorpoRequerimento(
            dados,
            tipo,
            modo,
            solicitante,
            docsSelecionados
        );

        const titulo =
            `REQUERIMENTO DE ${String(tipoTexto || 'REQUERIMENTO').toUpperCase()}`;

        if (!janelaImpressao || janelaImpressao.closed) {
            alert('A janela de impressão foi fechada antes da geração do documento.');
            return;
        }

        janelaImpressao.document.open();
        janelaImpressao.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${escaparHTML(tipoTexto)}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 0;
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }

        body {
            font-family: "Times New Roman", Times, serif;
            color: #000;
        }

        .folha {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            position: relative;
            overflow: hidden;
            padding: 40mm 25mm 31mm 30mm;
            background: #fff;
        }

        .cabecalho {
            position: absolute;
            top: 8mm;
            left: 30mm;
            right: 25mm;
            text-align: center;
            font-size: 8pt;
            line-height: 1.10;
        }

        .cabecalho img {
            display: block;
            height: 19mm;
            width: auto;
            margin: 0 auto 1.5mm;
        }

        .cabecalho .forte { font-weight: bold; }

        .titulo {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 3mm 0 16mm;
            line-height: 1.2;
        }

        .conteudo {
            font-size: 12pt;
            line-height: 1.5;
            text-align: justify;
        }

        .paragrafo {
            margin: 0 0 1.5mm;
            text-indent: 20mm;
        }

        .sem-recuo {
            margin: 3mm 0;
            text-indent: 0;
        }

        .motivo-livre {
            line-height: 1.75;
        }

        .bloco {
            margin: 5mm 0;
            text-indent: 0;
        }

        .lista-docs {
            margin: 2mm 0 2mm 7mm;
            padding-left: 6mm;
        }

        .lista-docs li {
            margin-bottom: 1mm;
        }

        .linha-manual {
            margin-top: 2mm;
            white-space: nowrap;
            overflow: hidden;
        }

        .data {
            margin-top: 15mm;
            font-size: 12pt;
            text-align: left;
        }

        .assinaturas {
            margin-top: 22mm;
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 22mm;
            text-align: center;
            font-size: 11pt;
        }

        .assinatura .linha {
            border-top: 1px solid #000;
            padding-top: 2mm;
        }

        .assinatura .nome {
            font-weight: bold;
        }

        .rodape {
            position: absolute;
            left: 13mm;
            right: 13mm;
            bottom: 5mm;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            line-height: 1.25;
            text-align: center;
        }

        .rodape-duplo {
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 8mm;
            align-items: start;
        }

        .rodape a {
            color: #0563c1;
            text-decoration: underline;
        }

        .rodape-escola {
            margin-top: 6mm;
        }

        @media screen {
            body { background: #ddd; }
            .folha { box-shadow: 0 0 8px rgba(0,0,0,.25); }
        }

        @media print {
            html, body { width: 210mm; height: 297mm; }
            body { background: #fff; }
            .folha {
                margin: 0;
                box-shadow: none;
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="folha">
        <header class="cabecalho">
            <img src="${urlGED('../geral/imagem/BRASAO.jpg')}" alt="Brasão do Estado de Mato Grosso">
            <div class="forte">Governo do Estado de Mato Grosso</div>
            <div>SEDUC – Secretaria de Estado de Educação</div>
            <div>Diretoria Regional de Educação - DRE de Cáceres – MT</div>
            <div class="forte">Escola Estadual Onze de Março</div>
        </header>

        <main>
            <div class="titulo">${escaparHTML(titulo)}</div>

            <section class="conteudo">
                ${corpo}
            </section>

            <div class="data">
                Cáceres/MT, ${escaparHTML(dataFormatada)}.
            </div>

            <div class="assinaturas">
                <div class="assinatura">
                    <div class="linha">Assinatura do Solicitante</div>
                </div>

                <div class="assinatura">
                    <div class="linha">
                        <span class="nome">${escaparHTML(nomeTecnico)}</span><br>
                        Técnico Administrativo
                    </div>
                </div>
            </div>
        </main>

        <footer class="rodape">
            <div class="rodape-duplo">
                <div>
                    Rua Engenheiro Edgar Prado Arze, 215 Centro Político Administrativo &nbsp;&nbsp;
                    CEP: 78049-909 – Cuiabá-MT Fone (65) 3613-6300<br>
                    <a href="https://www.seduc.mt.gov.br/">www.seduc.mt.gov.br</a>
                </div>
                <div>
                    DRE DE CÁCERES Rua das Saracuras 182, Bairro Maracanãzinho,
                    Cep: 78205-645, Cáceres –MT &nbsp; Fone (65) 3223-7537 e 3223-1326<br>
                    <a href="https://www.cefaprocaceres.com.br/">www.cefaprocaceres.com.br</a>
                </div>
            </div>

            <div class="rodape-escola">
                Escola Estadual Onze de Março Rua Tiradentes, nº 732 –
                Centro Cáceres-MT CEP 78210-090
            </div>
        </footer>
    </div>

    <script>
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 250);
        });
    <\/script>
</body>
</html>`);

        janelaImpressao.document.close();
    }

})();
