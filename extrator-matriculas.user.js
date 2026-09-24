// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Extrator de Matrículas
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Módulo Ferramentas: morfa a Consulta Matrícula(s) Por Aluno em extrator em lote, ocultando a grade nativa e permitindo consultar a matrícula na lotação atual ou a última matrícula anterior à lotação.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-matriculas.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-matriculas.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '2.1.1',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-matriculas.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-matriculas.user.js'
    });

    // =====================================================================
    // PROTEÇÃO CONTRA DUPLICAÇÃO
    // =====================================================================

    const FLAG = '__SIGEDUCA_EXTRATOR_MATRICULAS_MODULAR_V2_1__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    // =====================================================================
    // REGISTRO NO MENU MODULAR "FERRAMENTAS"
    // =====================================================================

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const HASH_EXTRATOR = '#extrator-matriculas';
    const HASH_REQUERIMENTOS = '#requerimentos';

    const FERRAMENTA = Object.freeze({
        id: 'extrator-matriculas',
        titulo: 'Extrator de Matrículas',
        url: `hwcmatriculasaluno.aspx?0,0${HASH_EXTRATOR}`,
        descricao: 'Consulta e extrai dados de matrículas em lote',
        ordem: 20,
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
    // CONFIGURAÇÃO / ESTADO
    // =====================================================================

    const DELAY_BETWEEN_REQUESTS = 1000;

    const state = {
        isRunning: false,
        mode: 'CODIGO',
        scope: 'LOTACAO',
        queue: [],
        results: [],
        schoolCode: '00000',
        schoolName: 'Lotação atual',
        lotacaoTexto: ''
    };

    // =====================================================================
    // ROTEAMENTO
    // =====================================================================

    function ehPaginaConsultaMatriculas() {
        return window.location.pathname.toLowerCase().endsWith('/hwcmatriculasaluno.aspx');
    }

    function ehRotaDoExtrator() {
        return ehPaginaConsultaMatriculas() &&
               window.location.hash.toLowerCase() === HASH_EXTRATOR;
    }

    function executarQuandoDOMPronto(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    executarQuandoDOMPronto(() => {
        if (!ehRotaDoExtrator()) return;
        morfarPagina();
    });

    // Requerimentos e Extrator usam a mesma página-base. Ao trocar somente o
    // hash, o navegador não recarregaria o DOM. O reload garante uma tela limpa.
    window.addEventListener('hashchange', () => {
        if (!ehPaginaConsultaMatriculas()) return;
        const hash = window.location.hash.toLowerCase();
        if (hash === HASH_EXTRATOR || hash === HASH_REQUERIMENTOS) {
            window.location.reload();
        }
    });

    // =====================================================================
    // UTILIDADES
    // =====================================================================

    function texto(el) {
        return (el?.innerText || el?.textContent || '').trim();
    }

    function limparCSV(valor) {
        return String(valor ?? '')
            .replace(/\r?\n|\r/g, ' ')
            .replace(/;/g, '-')
            .trim();
    }

    function csvSeguro(valor) {
        const s = limparCSV(valor);
        if (/["\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }

    function escapeHTML(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function triggerEvents(el) {
        if (!el) return;
        try {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (erro) {
            console.debug('[Extrator Matrículas] Falha ao disparar eventos:', erro);
        }
    }

    function getVal(prefix, suffix) {
        const el = document.getElementById(`${prefix}_${suffix}`);
        return limparCSV(texto(el));
    }

    function extrairCodigoEscola(escolaTexto) {
        const s = String(escolaTexto || '').trim();
        const match = s.match(/^\s*(\d+)\s*-/);
        return match ? match[1] : '';
    }

    // =====================================================================
    // LOTAÇÃO DO USUÁRIO
    // =====================================================================

    function identificarLotacao() {
        const lotacaoEl = document.getElementById('MPW0010TLOTACAO');
        const lotacao = texto(lotacaoEl);

        state.lotacaoTexto = lotacao || 'Lotação não identificada';

        if (!lotacao) return;

        const codigo = extrairCodigoEscola(lotacao);
        if (codigo) state.schoolCode = codigo;

        const partes = lotacao.split('-');
        if (partes.length > 1) {
            state.schoolName = partes.slice(1).join('-').trim();
        } else {
            state.schoolName = lotacao;
        }
    }

    // =====================================================================
    // MORFAGEM DA PÁGINA
    // =====================================================================

    function morfarPagina() {
        if (document.getElementById('tm-matriculas-morph')) return;

        identificarLotacao();

        document.title = 'Extrator de Matrículas';
        const titulo = document.getElementById('TTITULO');
        if (titulo) titulo.innerText = 'Extrator de Matrículas';

        // Oculta a grade nativa VISUALMENTE, mas deixa o DOM vivo para coleta.
        const style = document.createElement('style');
        style.id = 'tm-extrator-style';
        style.textContent = `
            #GRIDS,
            #FreesgridContainerDiv,
            #SCRIPTS {
                display: none !important;
            }

            #tm-matriculas-morph {
                font-family: Verdana, Arial, sans-serif;
                font-size: 12px;
                padding: 12px 14px 16px;
                text-align: left;
            }

            #tm-matriculas-morph .tm-box {
                background: #f8f9fa;
                border: 1px solid #b7c4cf;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
            }

            #tm-matriculas-morph .tm-lotacao {
                background: #eaf3fb;
                border-left: 4px solid #065195;
                padding: 9px 10px;
                margin-bottom: 12px;
                line-height: 1.45;
            }

            #tm-matriculas-morph label {
                line-height: 1.55;
            }

            #tm-matriculas-morph select,
            #tm-matriculas-morph textarea {
                box-sizing: border-box;
                font-family: Verdana, Arial, sans-serif;
                font-size: 11px;
            }

            #tm-matriculas-morph textarea {
                width: 100%;
                resize: vertical;
            }

            #tm-matriculas-morph .tm-actions {
                display: flex;
                gap: 6px;
                margin-top: 10px;
                flex-wrap: wrap;
            }

            #tm-matriculas-morph button {
                border: 0;
                border-radius: 4px;
                padding: 7px 11px;
                cursor: pointer;
                font-weight: bold;
            }

            #tm-matriculas-morph button:disabled {
                opacity: .55;
                cursor: default;
            }

            #tm-btn-cod,
            #tm-btn-inep {
                background: #065195;
                color: #fff;
            }

            #tm-btn-stop {
                background: #c82333;
                color: #fff;
            }

            #tm-btn-export {
                background: #218838;
                color: #fff;
            }

            #tm-status-line {
                margin: 10px 0;
                padding: 8px;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 4px;
            }

            #tm-status {
                font-weight: bold;
                color: #218838;
            }
        `;
        document.head.appendChild(style);

        const table2 = document.getElementById('TABLE2');
        const tbody = table2?.tBodies?.[0];
        if (!tbody) {
            console.error('[Extrator Matrículas] TABLE2 não encontrada.');
            return;
        }

        // Esconde todas as linhas nativas da consulta, preservando os elementos
        // no DOM para o GeneXus continuar processando a pesquisa em background.
        Array.from(tbody.children).forEach((tr, index) => {
            if (index === 0) return; // mantém a faixa de título
            tr.style.display = 'none';
        });

        const tr = document.createElement('tr');
        tr.id = 'tm-matriculas-morph-row';
        tr.innerHTML = `
            <td colspan="2">
                <div id="tm-matriculas-morph">
                    <div class="tm-lotacao">
                        <b>Lotação atual:</b>
                        <span id="tm-lotacao-label">${escapeHTML(state.lotacaoTexto)}</span><br>
                        <span style="font-size:10px;color:#555;">
                            A opção padrão consulta a última movimentação encontrada <b>na sua escola</b>.
                        </span>
                    </div>

                    <div class="tm-box">
                        <div style="margin-bottom:10px;">
                            <label><b>Ano Letivo de Pesquisa:</b></label><br>
                            <select id="tm-ano-letivo" style="width:180px;padding:5px;margin-top:3px;"></select>
                        </div>

                        <div style="margin-bottom:10px;">
                            <b>Qual matrícula deseja localizar?</b><br>

                            <label>
                                <input type="radio" name="tm-scope" value="LOTACAO" checked>
                                Na minha escola — ${escapeHTML(state.lotacaoTexto)}
                            </label><br>

                            <label>
                                <input type="radio" name="tm-scope" value="ANTERIOR_LOTACAO">
                                Última matrícula anterior à minha lotação
                            </label>

                            <div id="tm-scope-help" style="font-size:10px;color:#666;margin:5px 0 0 22px;">
                                Ex.: se o aluno está na sua escola e veio de outra unidade, retorna a última matrícula da escola anterior.
                            </div>
                        </div>

                        <label><b>Cole os Códigos ou INEPs, um por linha:</b></label>
                        <textarea id="tm-input-queue" rows="7" style="margin-top:4px;padding:7px;"></textarea>

                        <div class="tm-actions">
                            <button type="button" id="tm-btn-cod">▶ Consultar por Código</button>
                            <button type="button" id="tm-btn-inep">▶ Consultar por INEP</button>
                            <button type="button" id="tm-btn-stop" disabled>■ Parar</button>
                        </div>

                        <div id="tm-status-line">
                            <span id="tm-status">Aguardando...</span>
                            &nbsp;|&nbsp; Restam: <b id="tm-count">0</b>
                            &nbsp;|&nbsp; Critério: <b id="tm-scope-status">Na minha escola</b>
                        </div>
                    </div>

                    <div class="tm-box">
                        <label><b>Resultados:</b></label>
                        <textarea id="tm-output-csv" rows="9" readonly style="margin-top:4px;padding:7px;white-space:pre;"></textarea>

                        <div class="tm-actions">
                            <button type="button" id="tm-btn-export">💾 Exportar para .CSV</button>
                        </div>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

        popularAnoLetivo();
        vincularEventosUI();
        updateUI();
    }

    function popularAnoLetivo() {
        const pageSelect = document.getElementById('vGERANOLETCOD');
        const tmSelect = document.getElementById('tm-ano-letivo');
        if (!pageSelect || !tmSelect) return;

        tmSelect.innerHTML = '';
        Array.from(pageSelect.options).forEach(opt => {
            const novo = document.createElement('option');
            novo.value = opt.value;
            novo.text = opt.text;
            novo.selected = opt.selected;
            tmSelect.appendChild(novo);
        });

        tmSelect.addEventListener('change', () => {
            pageSelect.value = tmSelect.value;
            triggerEvents(pageSelect);
        });
    }

    function vincularEventosUI() {
        document.getElementById('tm-btn-cod')?.addEventListener('click', () => startProcess('CODIGO'));
        document.getElementById('tm-btn-inep')?.addEventListener('click', () => startProcess('INEP'));
        document.getElementById('tm-btn-stop')?.addEventListener('click', stopProcess);
        document.getElementById('tm-btn-export')?.addEventListener('click', exportCSV);

        document.querySelectorAll('input[name="tm-scope"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (state.isRunning) return;
                state.scope = document.querySelector('input[name="tm-scope"]:checked')?.value || 'LOTACAO';
                updateUI();
            });
        });
    }

    // =====================================================================
    // EXPORTAÇÃO CSV
    // =====================================================================

    function exportCSV() {
        if (state.results.length <= 1) {
            alert('Nenhum dado para exportar ainda!');
            return;
        }

        const csvContent = state.results.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `extracao_sigeduca_${state.schoolCode}_${state.scope.toLowerCase()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // =====================================================================
    // CONTROLE DO LOTE
    // =====================================================================

    function startProcess(mode) {
        if (state.isRunning) return;

        const input = document.getElementById('tm-input-queue');
        const linhas = (input?.value || '')
            .split(/\r?\n/)
            .map(v => v.trim())
            .filter(Boolean);

        if (!linhas.length) {
            alert('Insira pelo menos um código ou INEP para consultar.');
            return;
        }

        state.mode = mode;
        state.scope = document.querySelector('input[name="tm-scope"]:checked')?.value || 'LOTACAO';
        state.queue = linhas;
        state.isRunning = true;

        // Mantém as 17 colunas originais e adiciona duas no final.
        state.results = [
            'Código Pesquisado;Status;Nome do Aluno;Data de Nascimento;Matrícula;Série/Matriz;Turno;Turma;Código Sala;Sala;Nº Diário;Data Matrícula;Matrícula PNE;Ano Letivo;Situação Histórico;Data do Ajuste;Rede Origem;Escola da Matrícula;Critério da Consulta'
        ];

        document.querySelectorAll('input[name="tm-scope"]').forEach(r => r.disabled = true);
        updateUI();
        processNext();
    }

    function stopProcess() {
        state.isRunning = false;
        document.querySelectorAll('input[name="tm-scope"]').forEach(r => r.disabled = false);
        updateUI();
    }

    function updateUI() {
        const count = document.getElementById('tm-count');
        const btnCod = document.getElementById('tm-btn-cod');
        const btnInep = document.getElementById('tm-btn-inep');
        const btnStop = document.getElementById('tm-btn-stop');
        const ano = document.getElementById('tm-ano-letivo');
        const status = document.getElementById('tm-status');
        const output = document.getElementById('tm-output-csv');
        const scopeStatus = document.getElementById('tm-scope-status');

        if (count) count.innerText = String(state.queue.length);
        if (btnCod) btnCod.disabled = state.isRunning;
        if (btnInep) btnInep.disabled = state.isRunning;
        if (btnStop) btnStop.disabled = !state.isRunning;
        if (ano) ano.disabled = state.isRunning;

        if (status) {
            status.innerText = state.isRunning ? 'Processando...' : 'Aguardando...';
            status.style.color = state.isRunning ? '#b8860b' : '#218838';
        }

        if (scopeStatus) {
            scopeStatus.innerText = state.scope === 'ANTERIOR_LOTACAO'
                ? 'Última matrícula anterior à lotação'
                : 'Na minha escola';
        }

        if (output) output.value = state.results.join('\n');
    }

    // =====================================================================
    // PROCESSAMENTO UNITÁRIO
    // =====================================================================

    function limparConsultaAnterior() {
        const grid = document.getElementById('FreesgridContainerTbl');
        if (grid) grid.innerHTML = '';

        const errorViewer = document.getElementById('gxErrorViewer');
        if (errorViewer) errorViewer.innerHTML = '';

        const nomeEl = document.getElementById('span_vGEDALUNOM');
        if (nomeEl) nomeEl.innerText = '';

        const nascEl = document.getElementById('span_vGERPESDTANASC');
        if (nascEl) nascEl.innerText = '';

        const inputCod = document.getElementById('vGEDALUCOD');
        const inputInep = document.getElementById('vGEDALUIDINEP');

        if (inputInep) {
            inputInep.value = '0';
            triggerEvents(inputInep);
        }

        if (inputCod) {
            inputCod.value = '0';
            triggerEvents(inputCod);
        }
    }

    function processNext() {
        if (!state.isRunning) return;

        if (!state.queue.length) {
            state.isRunning = false;
            document.querySelectorAll('input[name="tm-scope"]').forEach(r => r.disabled = false);
            updateUI();
            alert('Consulta finalizada! Os resultados estão prontos para exportação.');
            return;
        }

        const currentCode = state.queue.shift();
        updateUI();
        limparConsultaAnterior();

        const inputCod = document.getElementById('vGEDALUCOD');
        const inputInep = document.getElementById('vGEDALUIDINEP');

        setTimeout(() => {
            if (!state.isRunning) return;

            if (state.mode === 'CODIGO') {
                if (inputCod) {
                    inputCod.value = currentCode;
                    triggerEvents(inputCod);
                }
            } else {
                if (inputInep) {
                    inputInep.value = currentCode;
                    triggerEvents(inputInep);
                }
            }

            setTimeout(() => {
                if (!state.isRunning) return;

                const btnConsultar = document.querySelector("input[name='BCONSULTAR']");
                if (!btnConsultar) {
                    saveResultData(currentCode, 'Erro: botão Consultar não encontrado.');
                    return;
                }

                btnConsultar.click();
                waitForResult(currentCode);
            }, 500);
        }, 300);
    }

    function waitForResult(currentCode) {
        const maxWait = 30; // 15 s
        let attempts = 0;

        const interval = setInterval(() => {
            attempts++;

            if (!state.isRunning) {
                clearInterval(interval);
                return;
            }

            const errorViewer = document.getElementById('gxErrorViewer');
            const erro = texto(errorViewer);
            if (erro) {
                clearInterval(interval);
                saveResultData(currentCode, `Erro: ${limparCSV(erro)}`);
                return;
            }

            const rows = document.querySelectorAll("tr[id^='FreesgridContainerRow_']");
            const ajaxLoader = document.getElementById('gx_ajax_notification');
            const isAjaxLoading = ajaxLoader && ajaxLoader.style.display !== 'none';
            const nomeCarregado = texto(document.getElementById('span_vGEDALUNOM')) !== '';

            if (rows.length > 0 && !isAjaxLoading && nomeCarregado) {
                clearInterval(interval);
                setTimeout(() => {
                    if (state.isRunning) extractAndSave(currentCode);
                }, 800);
                return;
            }

            if (attempts >= maxWait) {
                clearInterval(interval);
                saveResultData(currentCode, 'Erro: Tempo limite de consulta excedido ou sem dados.');
            }
        }, 500);
    }

    // =====================================================================
    // SELEÇÃO DA MATRÍCULA
    // =====================================================================

    function listarMovimentacoes() {
        return Array.from(document.querySelectorAll("tr[id^='FreesgridContainerRow_']"))
            .map((row, index) => {
                const match = row.id.match(/FreesgridContainerRow_(\d+)/);
                if (!match) return null;

                const suffix = match[1];
                const escola = getVal('span_vGERLOTNOMAUX', suffix);
                const codigoEscola = extrairCodigoEscola(escola);

                return {
                    index,
                    suffix,
                    escola,
                    codigoEscola
                };
            })
            .filter(Boolean);
    }

    function selecionarMovimentacao() {
        const movimentos = listarMovimentacoes();

        if (!movimentos.length) {
            return { erro: 'Nenhuma movimentação encontrada.' };
        }

        // -------------------------------------------------------------
        // 1) PADRÃO: ÚLTIMA MOVIMENTAÇÃO NA LOTAÇÃO ATUAL
        // -------------------------------------------------------------
        let indiceLotacao = -1;

        for (let i = 0; i < movimentos.length; i++) {
            const mov = movimentos[i];

            const corresponde = mov.codigoEscola
                ? mov.codigoEscola === state.schoolCode
                : mov.escola.includes(state.schoolCode);

            if (corresponde) indiceLotacao = i;
        }

        if (state.scope === 'LOTACAO') {
            if (indiceLotacao < 0) {
                return {
                    erro: `Sem movimentações na lotação ${state.lotacaoTexto}.`
                };
            }

            return {
                movimento: movimentos[indiceLotacao],
                criterio: 'NA MINHA ESCOLA'
            };
        }

        // -------------------------------------------------------------
        // 2) ÚLTIMA MATRÍCULA ANTERIOR À LOTAÇÃO
        // -------------------------------------------------------------
        // Mantém a mesma premissa do script original: a grade vem em ordem
        // cronológica e o último registro correspondente é o mais recente.
        // Partindo da última ocorrência da lotação, volta na grade até achar
        // a primeira escola diferente. Assim, se:
        //   DEMÉTRIO -> ONZE DE MARÇO
        // retorna DEMÉTRIO.
        // -------------------------------------------------------------

        if (indiceLotacao < 0) {
            return {
                erro: `O aluno não possui movimentação na lotação ${state.lotacaoTexto}; não foi possível determinar a matrícula anterior à lotação.`
            };
        }

        for (let i = indiceLotacao - 1; i >= 0; i--) {
            const mov = movimentos[i];
            if (!mov.escola) continue;

            const ehMesmaLotacao = mov.codigoEscola
                ? mov.codigoEscola === state.schoolCode
                : mov.escola.includes(state.schoolCode);

            if (!ehMesmaLotacao) {
                return {
                    movimento: mov,
                    criterio: 'ÚLTIMA MATRÍCULA ANTERIOR À LOTAÇÃO'
                };
            }
        }

        return {
            erro: `Não foi encontrada matrícula anterior à lotação ${state.lotacaoTexto}.`
        };
    }

    // =====================================================================
    // EXTRAÇÃO DOS DADOS
    // =====================================================================

    function extractAndSave(currentCode) {
        const selecao = selecionarMovimentacao();

        if (selecao.erro) {
            saveResultData(currentCode, selecao.erro);
            return;
        }

        const { movimento, criterio } = selecao;
        const suffix = movimento.suffix;

        const nomeAluno = limparCSV(texto(document.getElementById('span_vGEDALUNOM'))) || 'NOME NÃO ENCONTRADO';
        const dataNascimento = limparCSV(texto(document.getElementById('span_vGERPESDTANASC'))) || 'SEM DATA';

        const matricula = getVal('span_vGEDMATCOD_GRIDFS', suffix);
        const matriz = getVal('span_vGERMATMSC', suffix);
        const turno = getVal('span_vGERTRNDSC', suffix);
        const turma = getVal('span_vGERTURSAL', suffix);
        const codSala = getVal('span_vGERAMBCOD', suffix);
        const sala = getVal('span_vGERAMBCODMASK', suffix);
        const diario = getVal('span_vGEDMATORDDIA', suffix);
        const dataMatricula = getVal('span_vGEDMATDTA', suffix);
        const pne = getVal('span_vGEDMATALUESP', suffix);
        const anoLetivo = getVal('span_vANO_LETIVO_ALUNO', suffix);
        const redeOrigem = getVal('span_vGEDMATTIPOORIGEMMAT', suffix);

        let situacao = getVal('span_vGEDHISTSITAPR', suffix).toUpperCase();

        if (situacao === 'AGUARDANDO FECHAMENTO') {
            const situacoesAlvo = [
                'AFASTADO POR ABANDONO',
                'DEPENDENTE',
                'AFASTADO POR DESISTÊNCIA',
                'MATRICULADO',
                'MATRÍCULA EXTRAORDINÁRIA',
                'MATRÍCULA DE PROGRESSÃO PARCIAL',
                'RECLASSIFICADO',
                'TRANSFERIDO DA TURMA',
                'TRANSFERIDO DA ESCOLA',
                'TRANSF. ESCOLA - DEPENDENTE',
                'TRANSF. ESCOLA - MAT. PROGRE. PARC.',
                'TRANSF. ESCOLA - MAT. EXTRAORD.',
                'ÓBITO',
                'MATRICULA CANCELADA',
                'MATRICULA ESTORNADA',
                'TRANSFERÊNCIA CANCELADA',
                'TRANSFERÊNCIA ESTORNADA',
                'RECLASSIFICAÇÃO CANCELADA',
                'RECLASSIFICAÇÃO ESTORNADA',
                'MATRÍCULA PENDENTE',
                'SUPERADO',
                'SUPERAÇÃO ESTORNADA',
                'SUPERAÇÃO CANCELADA',
                'RESERVA DE MATRÍCULA',
                'AFASTADO C.H. COMPONENTE CURRICULAR',
                'TRANSFERÊNCIA DE TURMA'
            ];

            const gridDisc = document.getElementById(`GRIDDISC_${suffix}`);
            if (gridDisc) {
                for (const span of gridDisc.querySelectorAll('span')) {
                    const valor = texto(span).toUpperCase();
                    if (situacoesAlvo.includes(valor)) {
                        situacao = valor;
                        break;
                    }
                }
            }
        }

        let dataAjuste = '';
        if (situacao && situacao !== 'MATRICULADO') {
            dataAjuste = getVal('span_vGEDAJSDTA', suffix);
        }

        const linha = [
            currentCode,
            'ENCONTRADO',
            csvSeguro(nomeAluno),
            dataNascimento,
            matricula,
            csvSeguro(matriz),
            turno,
            turma,
            codSala,
            sala,
            diario,
            dataMatricula,
            pne,
            anoLetivo,
            situacao,
            dataAjuste,
            redeOrigem,
            csvSeguro(movimento.escola),
            criterio
        ].join(';');

        state.results.push(linha);
        updateUI();
        setTimeout(processNext, DELAY_BETWEEN_REQUESTS);
    }

    // =====================================================================
    // ERROS / SEM RESULTADO
    // =====================================================================

    function saveResultData(code, errorMsg) {
        const linha = new Array(19).fill('');
        linha[0] = code;
        linha[1] = limparCSV(errorMsg);
        linha[18] = state.scope === 'ANTERIOR_LOTACAO'
            ? 'ÚLTIMA MATRÍCULA ANTERIOR À LOTAÇÃO'
            : 'NA MINHA ESCOLA';

        state.results.push(linha.join(';'));
        updateUI();

        if (state.isRunning) {
            setTimeout(processNext, DELAY_BETWEEN_REQUESTS);
        }
    }

})();
