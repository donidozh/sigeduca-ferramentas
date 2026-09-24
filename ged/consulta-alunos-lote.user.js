// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Consulta Alunos em Lote
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Módulo do menu Ferramentas: consulta alunos em lote por nome/CPF, com morph da página e exportação CSV.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-alunos-lote.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-alunos-lote.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '3.0.2',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-alunos-lote.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-alunos-lote.user.js'
    });

    // =====================================================================
    // PROTEÇÃO / DOCUMENTO PRINCIPAL
    // =====================================================================
    if (window.top !== window.self) return;

    const FLAG_MODULO = '__SIGEDUCA_CONSULTA_ALUNOS_LOTE_MODULAR_V3_0__';
    if (window[FLAG_MODULO]) return;
    window[FLAG_MODULO] = true;

    // =====================================================================
    // REGISTRO NO MENU LATERAL "FERRAMENTAS"
    // =====================================================================
    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const HASH_FERRAMENTA = '#consulta-alunos-lote';

    const FERRAMENTA = Object.freeze({
        id: 'consulta-alunos-lote',
        titulo: 'Consulta Alunos em Lote',
        url: `hwmconaluno.aspx${HASH_FERRAMENTA}`,
        descricao: 'Consulta vários alunos por nome ou CPF e exporta os resultados em CSV',
        ordem: 30,
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
    // ROTA DA FERRAMENTA
    // =====================================================================
    function ehPaginaConsultaAluno() {
        return /\/ged\/hwmconaluno\.aspx$/i.test(window.location.pathname);
    }

    function ehRotaFerramenta() {
        return ehPaginaConsultaAluno() &&
            window.location.hash.toLowerCase() === HASH_FERRAMENTA;
    }

    // Se já estivermos em hwmconaluno.aspx e o menu alterar apenas o hash,
    // recarrega uma vez para iniciar sobre uma página GeneXus limpa.
    window.addEventListener('hashchange', () => {
        if (ehRotaFerramenta() && !document.getElementById('tm-modular-host')) {
            window.location.reload();
        }
    });

    // Fora da rota, este userscript serve apenas para registrar o item no menu.
    if (!ehRotaFerramenta()) return;

    // =====================================================================
    // ESTADO / CONSTANTES
    // =====================================================================
    const STORAGE_RESULTADOS = 'tm_resultados_csv';
    const ID_HOST = 'tm-modular-host';
    const ID_PAINEL = 'tm-consulta-lote-app';
    const ID_STYLE = 'tm-consulta-lote-morph-style';

    const TEMPO_MAX_ESPERA_GRID = 6000;
    const INTERVALO_ESPERA_GRID = 200;

    let executando = false;
    let morphAplicando = false;
    let morphObserver = null;
    let morphRetryTimer = null;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // =====================================================================
    // HELPERS DE UI
    // =====================================================================
    const $ = (id) => document.getElementById(id);

    function obterListaEl() {
        return $('tm_listaNomes');
    }

    function obterStatusEl() {
        return $('tm_status');
    }

    function obterBtnConsultar() {
        return $('tm_btnConsultar');
    }

    function obterBtnParar() {
        return $('tm_btnParar');
    }

    function definirStatus(texto, tipo = 'info') {
        const el = obterStatusEl();
        if (!el) return;

        const classes = ['info', 'sucesso', 'aviso', 'erro', 'processando'];
        classes.forEach(c => el.classList.remove(`tm-status-${c}`));
        el.classList.add(`tm-status-${tipo}`);
        el.textContent = texto;
    }

    function definirProgresso(atual = 0, total = 0) {
        const barra = $('tm_progresso_barra');
        const texto = $('tm_progresso_texto');
        const pct = total > 0 ? Math.round((atual / total) * 100) : 0;

        if (barra) barra.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        if (texto) texto.textContent = total > 0 ? `${atual}/${total} (${pct}%)` : '0/0';
    }

    function atualizarEstadoBotoes() {
        const consultar = obterBtnConsultar();
        const parar = obterBtnParar();
        const exportar = $('tm_btnExportar');
        const limpar = $('tm_btnLimpar');
        const temResultados = carregarResultados().length > 0;

        if (consultar) {
            consultar.disabled = executando;
            consultar.textContent = executando ? '⏳ Consultando...' : '▶ Iniciar consultas';
        }

        if (parar) parar.disabled = !executando;
        if (exportar) exportar.disabled = !temResultados || executando;
        if (limpar) limpar.disabled = executando;
    }

    function carregarResultados() {
        try {
            const dados = JSON.parse(localStorage.getItem(STORAGE_RESULTADOS) || '[]');
            return Array.isArray(dados) ? dados : [];
        } catch {
            return [];
        }
    }

    function salvarResultados(dados) {
        localStorage.setItem(STORAGE_RESULTADOS, JSON.stringify(dados));
        atualizarResumoResultados();
        atualizarEstadoBotoes();
    }

    function atualizarResumoResultados() {
        const dados = carregarResultados();
        const total = dados.length;
        const encontrados = dados.filter(r =>
            r.codigo &&
            r.codigo !== 'NÃO ENCONTRADO' &&
            r.codigo !== 'CPF INVÁLIDO'
        ).length;
        const naoEncontrados = dados.filter(r => r.codigo === 'NÃO ENCONTRADO').length;
        const invalidos = dados.filter(r => r.codigo === 'CPF INVÁLIDO').length;

        const totalEl = $('tm_resumo_total');
        const encontradosEl = $('tm_resumo_encontrados');
        const naoEncontradosEl = $('tm_resumo_nao_encontrados');
        const invalidosEl = $('tm_resumo_invalidos');

        if (totalEl) totalEl.textContent = total;
        if (encontradosEl) encontradosEl.textContent = encontrados;
        if (naoEncontradosEl) naoEncontradosEl.textContent = naoEncontrados;
        if (invalidosEl) invalidosEl.textContent = invalidos;
    }

    // =====================================================================
    // CPF / TIPO DE CONSULTA
    // =====================================================================
    function normalizarCPF(valor) {
        let cpf = String(valor || '').replace(/\D/g, '');
        if (cpf.length < 11) cpf = cpf.padStart(11, '0');
        return cpf;
    }

    function identificarTipoConsulta(valor) {
        const valorLimpo = String(valor || '').trim();

        if (/^[\d.\-\s]+$/.test(valorLimpo)) {
            const somenteNumeros = valorLimpo.replace(/\D/g, '');
            if (somenteNumeros.length > 0) return 'CPF';
        }

        return 'NOME';
    }

    // =====================================================================
    // EXPORTAÇÃO CSV
    // =====================================================================
    function escaparCSV(valor) {
        return `"${String(valor ?? '').replace(/"/g, '""')}"`;
    }

    function exportarCSV() {
        const dados = carregarResultados();

        if (dados.length === 0) {
            alert('Nenhum dado encontrado para exportar.');
            return;
        }

        let csvConteudo =
            'Tipo Pesquisa;Termo Pesquisado;Codigo;Nome do Aluno;Data Nascimento;Codigo INEP\n';

        dados.forEach(row => {
            csvConteudo += [
                row.tipo || '',
                row.termo || '',
                row.codigo || '',
                row.nome || '',
                row.dataNasc || '',
                row.inep || ''
            ].map(escaparCSV).join(';') + '\n';
        });

        const blob = new Blob(['\uFEFF' + csvConteudo], {
            type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'consulta_alunos.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // =====================================================================
    // COLETA DA GRID NATIVA
    // =====================================================================
    function coletarDadosGrid(termo, tipo) {
        const resultados = carregarResultados();

        let index = 1;
        let encontrou = false;
        let quantidade = 0;

        while (true) {
            const idxStr = String(index).padStart(4, '0');

            const elCod = document.getElementById(`span_vGERPESCODCHAR_${idxStr}`);
            const elNome = document.getElementById(`span_vGERPESNOM_${idxStr}`);
            const elData = document.getElementById(`span_vGERPESDTANASC_${idxStr}`);
            const elInep = document.getElementById(`span_vGEDALUIDINEPGRID_${idxStr}`);

            if (!elCod && !elNome) break;

            encontrou = true;
            quantidade++;

            resultados.push({
                tipo,
                termo,
                codigo: elCod ? elCod.innerText.trim() : '',
                nome: elNome ? elNome.innerText.trim() : '',
                dataNasc: elData ? elData.innerText.trim() : '',
                inep: elInep ? elInep.innerText.trim() : ''
            });

            index++;
        }

        if (!encontrou) {
            resultados.push({
                tipo,
                termo,
                codigo: 'NÃO ENCONTRADO',
                nome: 'NÃO ENCONTRADO',
                dataNasc: '-',
                inep: '-'
            });
        }

        salvarResultados(resultados);
        return quantidade;
    }

    function registrarCPFInvalido(cpf) {
        const resultados = carregarResultados();

        resultados.push({
            tipo: 'CPF',
            termo: cpf,
            codigo: 'CPF INVÁLIDO',
            nome: 'CPF INVÁLIDO',
            dataNasc: '-',
            inep: '-'
        });

        salvarResultados(resultados);
    }

    // =====================================================================
    // CAMPOS NATIVOS / GENEXUS
    // =====================================================================
    function atualizarCampo(campo, valor) {
        campo.value = valor;

        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
        campo.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function obterControlesNativos() {
        return {
            inputNomeAluno: document.getElementById('vGRHDESCRICAO'),
            inputCPF: document.getElementById('vGERPESCPFAUX'),
            btnConsultarGx: document.querySelector('input[name="BCONSULTAR"]'),
            grid: document.getElementById('GriddetalhesContainerDiv')
        };
    }

    function assinaturaGrid() {
        return document.getElementById('GriddetalhesContainerDiv')?.innerHTML || '';
    }

    async function aguardarRespostaGrid(gridAnterior) {
        await sleep(150);

        let tempoEspera = 0;
        while (tempoEspera < TEMPO_MAX_ESPERA_GRID) {
            if (!executando) return;

            const gridAtual = assinaturaGrid();
            if (gridAtual !== gridAnterior) break;

            await sleep(INTERVALO_ESPERA_GRID);
            tempoEspera += INTERVALO_ESPERA_GRID;
        }

        // Pequena folga para o GeneXus terminar de renderizar os spans da grid.
        await sleep(150);
    }

    // =====================================================================
    // CONSULTA EM LOTE
    // =====================================================================
    async function iniciarConsultaLote() {
        if (executando) return;

        const txtLista = obterListaEl();
        if (!txtLista) return;

        const linhas = txtLista.value
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);

        if (linhas.length === 0) {
            alert('Cole pelo menos um nome ou CPF para consultar.');
            return;
        }

        const {
            inputNomeAluno,
            inputCPF,
            btnConsultarGx
        } = obterControlesNativos();

        if (!inputNomeAluno || !inputCPF || !btnConsultarGx) {
            alert(
                'Erro: algum campo do formulário não foi encontrado.\n\n' +
                'Nome: ' + !!inputNomeAluno + '\n' +
                'CPF: ' + !!inputCPF + '\n' +
                'Consultar: ' + !!btnConsultarGx
            );
            definirStatus('Não foi possível localizar os controles nativos do SIGEDUCA.', 'erro');
            return;
        }

        executando = true;
        atualizarEstadoBotoes();
        definirProgresso(0, linhas.length);

        try {
            for (let i = 0; i < linhas.length; i++) {
                if (!executando) break;

                const termoOriginal = linhas[i];
                const tipo = identificarTipoConsulta(termoOriginal);
                let termoConsulta = termoOriginal;

                if (tipo === 'CPF') {
                    termoConsulta = normalizarCPF(termoOriginal);

                    if (termoConsulta.length > 11) {
                        definirStatus(
                            `[${i + 1}/${linhas.length}] CPF inválido: ${termoOriginal}`,
                            'aviso'
                        );

                        registrarCPFInvalido(termoOriginal);
                        txtLista.value = linhas.slice(i + 1).join('\n');
                        definirProgresso(i + 1, linhas.length);
                        await sleep(200);
                        continue;
                    }

                    definirStatus(
                        `[${i + 1}/${linhas.length}] Consultando CPF: ${termoConsulta}...`,
                        'processando'
                    );

                    atualizarCampo(inputNomeAluno, '');
                    atualizarCampo(inputCPF, termoConsulta);
                } else {
                    termoConsulta = termoOriginal.toUpperCase();

                    definirStatus(
                        `[${i + 1}/${linhas.length}] Consultando nome: ${termoConsulta}...`,
                        'processando'
                    );

                    atualizarCampo(inputCPF, '');
                    atualizarCampo(inputNomeAluno, termoConsulta);
                }

                const gridAnterior = assinaturaGrid();
                btnConsultarGx.click();
                await aguardarRespostaGrid(gridAnterior);

                if (!executando) break;

                const qtd = coletarDadosGrid(termoConsulta, tipo);

                txtLista.value = linhas.slice(i + 1).join('\n');
                definirProgresso(i + 1, linhas.length);

                definirStatus(
                    qtd > 0
                        ? `[${i + 1}/${linhas.length}] ${qtd} resultado(s) coletado(s) para ${termoConsulta}.`
                        : `[${i + 1}/${linhas.length}] Nenhum aluno encontrado para ${termoConsulta}.`,
                    qtd > 0 ? 'sucesso' : 'aviso'
                );

                await sleep(250);
            }

            if (executando) {
                definirStatus('Consultas finalizadas com sucesso!', 'sucesso');
                alert('Processo concluído com sucesso!');
            } else {
                definirStatus('Processo interrompido pelo usuário.', 'aviso');
            }
        } catch (erro) {
            console.error('[SIGEDUCA][Consulta Alunos em Lote] Erro:', erro);
            definirStatus(`Erro durante a consulta: ${erro?.message || erro}`, 'erro');
            alert(`Erro durante a consulta:\n${erro?.message || erro}`);
        } finally {
            executando = false;
            atualizarEstadoBotoes();
        }
    }

    function pararConsulta() {
        if (!executando) return;
        executando = false;
        definirStatus('Interrupção solicitada. Finalizando a etapa atual...', 'aviso');
        atualizarEstadoBotoes();
    }

    function limparDados() {
        if (executando) return;

        if (carregarResultados().length > 0) {
            const confirmar = confirm('Limpar a lista e todos os resultados já coletados?');
            if (!confirmar) return;
        }

        localStorage.removeItem(STORAGE_RESULTADOS);

        const txtLista = obterListaEl();
        if (txtLista) txtLista.value = '';

        definirProgresso(0, 0);
        definirStatus('Pronto para consultar.', 'info');
        atualizarResumoResultados();
        atualizarEstadoBotoes();
    }

    // =====================================================================
    // INTERFACE MODULAR
    // =====================================================================
    function garantirEstiloMorph() {
        if (document.getElementById(ID_STYLE)) return;

        const style = document.createElement('style');
        style.id = ID_STYLE;
        style.textContent = `
            body.Form {
                background:#f4f6f8 !important;
            }

            #TABLE1_MPAGE {
                width:min(1180px, calc(100vw - 18px)) !important;
            }

            [data-tm-native-hidden="1"] {
                display:none !important;
            }

            #${ID_HOST} {
                display:block !important;
                width:min(1040px, calc(100vw - 34px)) !important;
                margin:14px auto 30px !important;
                padding:0 !important;
                box-sizing:border-box !important;
                font-family:Verdana,Arial,sans-serif !important;
            }

            #${ID_HOST},
            #${ID_HOST} * {
                box-sizing:border-box;
                font-family:Verdana,Arial,sans-serif;
            }

            #${ID_PAINEL} {
                overflow:hidden;
                border:1px solid #c8d1dc;
                border-radius:12px;
                background:#fff;
                box-shadow:0 8px 28px rgba(15,23,42,.10);
                color:#172033;
            }

            #${ID_PAINEL} .tm-header {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:16px;
                padding:18px 20px;
                border-bottom:1px solid #dbe3ec;
                background:linear-gradient(180deg,#f8fbff,#eef4fa);
            }

            #${ID_PAINEL} .tm-header h2 {
                margin:0 0 4px;
                font-size:18px;
                line-height:1.2;
                color:#16385f;
            }

            #${ID_PAINEL} .tm-header p {
                margin:0;
                color:#64748b;
                font-size:11px;
            }

            #${ID_PAINEL} .tm-badge {
                flex:0 0 auto;
                padding:5px 9px;
                border:1px solid #b9cee5;
                border-radius:999px;
                background:#fff;
                color:#365b82;
                font-size:10px;
                font-weight:700;
            }

            #${ID_PAINEL} .tm-body {
                padding:18px 20px 20px;
            }

            #${ID_PAINEL} .tm-grid {
                display:grid;
                grid-template-columns:minmax(0, 1.55fr) minmax(250px, .75fr);
                gap:16px;
                align-items:stretch;
            }

            #${ID_PAINEL} .tm-card {
                border:1px solid #dbe3ec;
                border-radius:10px;
                background:#fff;
                padding:14px;
            }

            #${ID_PAINEL} .tm-card h3 {
                margin:0 0 9px;
                font-size:12px;
                color:#334155;
            }

            #${ID_PAINEL} label {
                display:block;
                margin-bottom:6px;
                color:#475569;
                font-size:11px;
                font-weight:700;
            }

            #${ID_PAINEL} textarea {
                width:100%;
                min-height:260px;
                resize:vertical;
                border:1px solid #b8c5d3;
                border-radius:8px;
                padding:10px 11px;
                background:#fff;
                color:#172033;
                font:12px/1.45 Consolas,Menlo,monospace;
                outline:none;
            }

            #${ID_PAINEL} textarea:focus {
                border-color:#3982f7;
                box-shadow:0 0 0 3px rgba(57,130,247,.12);
            }

            #${ID_PAINEL} .tm-ajuda {
                margin-top:7px;
                color:#64748b;
                font-size:10px;
                line-height:1.4;
            }

            #${ID_PAINEL} .tm-resumo {
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:8px;
            }

            #${ID_PAINEL} .tm-resumo-item {
                min-height:68px;
                padding:10px;
                border:1px solid #e0e7ef;
                border-radius:9px;
                background:#f8fafc;
            }

            #${ID_PAINEL} .tm-resumo-item strong {
                display:block;
                margin-bottom:4px;
                color:#183b63;
                font-size:20px;
            }

            #${ID_PAINEL} .tm-resumo-item span {
                color:#64748b;
                font-size:10px;
                line-height:1.25;
            }

            #${ID_PAINEL} .tm-status {
                margin-top:14px;
                padding:10px 12px;
                border:1px solid transparent;
                border-radius:8px;
                font-size:11px;
                font-weight:700;
                text-align:center;
            }

            #${ID_PAINEL} .tm-status-info {
                border-color:#cbd5e1;
                background:#f8fafc;
                color:#475569;
            }

            #${ID_PAINEL} .tm-status-processando {
                border-color:#bfdbfe;
                background:#eff6ff;
                color:#1d4ed8;
            }

            #${ID_PAINEL} .tm-status-sucesso {
                border-color:#bbf7d0;
                background:#f0fdf4;
                color:#166534;
            }

            #${ID_PAINEL} .tm-status-aviso {
                border-color:#fde68a;
                background:#fffbeb;
                color:#92400e;
            }

            #${ID_PAINEL} .tm-status-erro {
                border-color:#fecaca;
                background:#fef2f2;
                color:#991b1b;
            }

            #${ID_PAINEL} .tm-progress-wrap {
                display:flex;
                align-items:center;
                gap:10px;
                margin-top:10px;
            }

            #${ID_PAINEL} .tm-progress {
                flex:1;
                height:8px;
                overflow:hidden;
                border-radius:999px;
                background:#e5e7eb;
            }

            #${ID_PAINEL} .tm-progress > div {
                width:0;
                height:100%;
                border-radius:inherit;
                background:#3982f7;
                transition:width .18s ease;
            }

            #${ID_PAINEL} .tm-progress-text {
                flex:0 0 auto;
                min-width:72px;
                color:#64748b;
                font-size:10px;
                text-align:right;
            }

            #${ID_PAINEL} .tm-actions {
                display:flex;
                flex-wrap:wrap;
                gap:8px;
                margin-top:14px;
            }

            #${ID_PAINEL} button {
                min-height:36px;
                border:1px solid #b9c5d3;
                border-radius:8px;
                padding:8px 13px;
                background:#fff;
                color:#334155;
                cursor:pointer;
                font-size:11px;
                font-weight:700;
            }

            #${ID_PAINEL} button:hover:not(:disabled) {
                border-color:#93c5fd;
                background:#eff6ff;
                color:#1d4ed8;
            }

            #${ID_PAINEL} button:disabled {
                opacity:.45;
                cursor:not-allowed;
            }

            #${ID_PAINEL} .tm-primary {
                flex:1 1 220px;
                border-color:#2874c6;
                background:#2874c6;
                color:#fff;
            }

            #${ID_PAINEL} .tm-primary:hover:not(:disabled) {
                border-color:#1f5fa6;
                background:#1f5fa6;
                color:#fff;
            }

            #${ID_PAINEL} .tm-warning {
                border-color:#d6a514;
                background:#fff8dc;
                color:#725400;
            }

            #${ID_PAINEL} .tm-danger {
                border-color:#e7b2b2;
                background:#fff7f7;
                color:#a11a1a;
            }

            #${ID_PAINEL} .tm-footer-note {
                margin-top:12px;
                padding-top:10px;
                border-top:1px solid #e5e7eb;
                color:#7b8794;
                font-size:9px;
                line-height:1.4;
            }

            @media (max-width: 760px) {
                #${ID_HOST} {
                    width:calc(100vw - 16px) !important;
                }

                #${ID_PAINEL} .tm-grid {
                    grid-template-columns:1fr;
                }

                #${ID_PAINEL} .tm-header {
                    align-items:flex-start;
                }
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    function criarPainel() {
        let painel = document.getElementById(ID_PAINEL);
        if (painel) return painel;

        painel = document.createElement('section');
        painel.id = ID_PAINEL;
        painel.innerHTML = `
            <div class="tm-header">
                <div>
                    <h2>Consulta de Alunos em Lote</h2>
                    <p>Pesquise nomes e CPFs em sequência usando a própria consulta do SIGEDUCA.</p>
                </div>
                <div class="tm-badge">Nome + CPF</div>
            </div>

            <div class="tm-body">
                <div class="tm-grid">
                    <div class="tm-card">
                        <label for="tm_listaNomes">Nomes ou CPFs para consulta — um por linha</label>
                        <textarea id="tm_listaNomes" spellcheck="false" placeholder="JOÃO DA SILVA\n12345678900\n6231310132\n987.654.321-00"></textarea>
                        <div class="tm-ajuda">
                            CPFs com menos de 11 dígitos recebem zeros à esquerda automaticamente.
                            Linhas formadas apenas por números, pontos, traços e espaços são tratadas como CPF.
                        </div>
                    </div>

                    <div class="tm-card">
                        <h3>Resultados acumulados</h3>
                        <div class="tm-resumo">
                            <div class="tm-resumo-item">
                                <strong id="tm_resumo_total">0</strong>
                                <span>linhas gravadas no resultado</span>
                            </div>
                            <div class="tm-resumo-item">
                                <strong id="tm_resumo_encontrados">0</strong>
                                <span>alunos encontrados</span>
                            </div>
                            <div class="tm-resumo-item">
                                <strong id="tm_resumo_nao_encontrados">0</strong>
                                <span>pesquisas sem resultado</span>
                            </div>
                            <div class="tm-resumo-item">
                                <strong id="tm_resumo_invalidos">0</strong>
                                <span>CPFs inválidos</span>
                            </div>
                        </div>

                        <div class="tm-footer-note">
                            Os resultados ficam salvos no navegador até você usar “Limpar dados”.
                        </div>
                    </div>
                </div>

                <div id="tm_status" class="tm-status tm-status-info">Pronto para consultar.</div>

                <div class="tm-progress-wrap">
                    <div class="tm-progress"><div id="tm_progresso_barra"></div></div>
                    <div id="tm_progresso_texto" class="tm-progress-text">0/0</div>
                </div>

                <div class="tm-actions">
                    <button type="button" id="tm_btnConsultar" class="tm-primary">▶ Iniciar consultas</button>
                    <button type="button" id="tm_btnParar" class="tm-warning" disabled>⏹ Parar</button>
                    <button type="button" id="tm_btnExportar">⬇ Exportar CSV</button>
                    <button type="button" id="tm_btnLimpar" class="tm-danger">🗑 Limpar dados</button>
                </div>
            </div>
        `;

        painel.querySelector('#tm_btnConsultar')?.addEventListener('click', iniciarConsultaLote);
        painel.querySelector('#tm_btnParar')?.addEventListener('click', pararConsulta);
        painel.querySelector('#tm_btnExportar')?.addEventListener('click', exportarCSV);
        painel.querySelector('#tm_btnLimpar')?.addEventListener('click', limparDados);

        return painel;
    }

    // =====================================================================
    // MORPH DA PÁGINA
    // =====================================================================
    function encontrarTabelaNativaConsulta() {
        const controles = obterControlesNativos();
        const alvos = [
            controles.inputNomeAluno,
            controles.inputCPF,
            controles.btnConsultarGx,
            controles.grid
        ].filter(Boolean);

        const table4 = document.getElementById('TABLE4');
        if (table4 && alvos.length && alvos.every(el => table4.contains(el))) {
            return table4;
        }

        if (!alvos.length) return table4 || null;

        let tabela = alvos[0].closest('table');
        while (tabela) {
            if (alvos.every(el => tabela.contains(el))) return tabela;
            const pai = tabela.parentElement;
            tabela = pai ? pai.closest('table') : null;
        }

        return table4 || alvos[0].closest('table');
    }

    function prepararHostForaDoGeneXus(tabelaNativa) {
        let host = document.getElementById(ID_HOST);

        if (!host) {
            host = document.createElement('div');
            host.id = ID_HOST;
        }

        const pai = tabelaNativa?.parentNode;

        if (pai && host.parentNode !== pai) {
            pai.insertBefore(host, tabelaNativa);
        } else if (!host.isConnected) {
            const mainForm = document.getElementById('MAINFORM');
            (mainForm || document.body || document.documentElement).appendChild(host);
        }

        return host;
    }

    function aplicarMorphModular() {
        if (morphAplicando || !ehRotaFerramenta()) return false;
        morphAplicando = true;

        try {
            garantirEstiloMorph();

            document.title = 'Consulta Alunos em Lote - SIGEDUCA';

            const titulo = document.getElementById('TTITULO');
            if (titulo) titulo.textContent = 'Consulta de Alunos em Lote';

            const tabelaNativa = encontrarTabelaNativaConsulta();
            if (!tabelaNativa) return false;

            // A tela original não é removida. Ela continua viva para que os
            // campos, botão BCONSULTAR e a grid GeneXus continuem funcionando.
            tabelaNativa.dataset.tmNativeHidden = '1';
            tabelaNativa.style.setProperty('display', 'none', 'important');

            const host = prepararHostForaDoGeneXus(tabelaNativa);
            const painel = criarPainel();

            if (painel.parentNode !== host) host.appendChild(painel);

            atualizarResumoResultados();
            atualizarEstadoBotoes();

            return true;
        } finally {
            morphAplicando = false;
        }
    }

    function iniciarMorphRobusto() {
        let tentativas = 0;
        const MAX_TENTATIVAS = 80;

        const tentar = () => {
            tentativas++;
            const sucesso = aplicarMorphModular();

            if (sucesso || tentativas >= MAX_TENTATIVAS) {
                if (morphRetryTimer) {
                    clearInterval(morphRetryTimer);
                    morphRetryTimer = null;
                }
            }
        };

        tentar();

        if (!document.getElementById('MAINFORM') || !encontrarTabelaNativaConsulta()) {
            morphRetryTimer = setInterval(tentar, 100);
        } else {
            let reforcos = 0;
            morphRetryTimer = setInterval(() => {
                reforcos++;
                aplicarMorphModular();

                if (reforcos >= 12) {
                    clearInterval(morphRetryTimer);
                    morphRetryTimer = null;
                }
            }, 120);
        }

        if (!morphObserver) {
            morphObserver = new MutationObserver(() => {
                if (!ehRotaFerramenta()) return;

                const tabelaNativa = encontrarTabelaNativaConsulta();
                const host = document.getElementById(ID_HOST);
                const painel = document.getElementById(ID_PAINEL);

                if (
                    (tabelaNativa && tabelaNativa.dataset.tmNativeHidden !== '1') ||
                    !host ||
                    !painel ||
                    painel.parentNode !== host ||
                    getComputedStyle(painel).display === 'none' ||
                    getComputedStyle(painel).visibility === 'hidden'
                ) {
                    requestAnimationFrame(aplicarMorphModular);
                }
            });

            const iniciarObserver = () => {
                if (!document.body) return;
                morphObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            };

            if (document.body) iniciarObserver();
            else document.addEventListener('DOMContentLoaded', iniciarObserver, { once: true });
        }
    }

    // =====================================================================
    // INICIALIZAÇÃO
    // =====================================================================
    function iniciarModulo() {
        if (!ehRotaFerramenta()) return;
        iniciarMorphRobusto();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarModulo, { once: true });
    } else {
        iniciarModulo();
    }
})();
