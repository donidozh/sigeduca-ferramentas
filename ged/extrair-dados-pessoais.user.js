// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Extrair Dados Pessoais
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Módulo do menu Ferramentas para extração em lote de dados pessoais, sociais, matrícula e dados por nº INEP no SIGEDUCA.
// @author       Elder Martins / baseado no Extrator Contatos Sigeduca de Roberson Arruda
// @match        *://*.seduc.mt.gov.br/ged/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrair-dados-pessoais.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrair-dados-pessoais.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '3.0.2',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrair-dados-pessoais.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrair-dados-pessoais.user.js'
    });

    // =====================================================================
    // MÓDULO / REGISTRO NO MENU LATERAL
    // =====================================================================

    const FLAG_MODULO = '__SIGEDUCA_EXTRAIR_DADOS_PESSOAIS_MODULAR_V3_0__';
    if (window[FLAG_MODULO]) return;
    window[FLAG_MODULO] = true;

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const HASH_FERRAMENTA = '#extrair-dados-pessoais';

    const FERRAMENTA = Object.freeze({
        id: 'extrair-dados-pessoais',
        titulo: 'Extrair Dados Pessoais',
        url: `hwmconaluno.aspx${HASH_FERRAMENTA}`,
        descricao: 'Extrair dados pessoais, sociais, matrícula e dados por nº INEP',
        ordem: 45,
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

    function ehPaginaConsultaAluno() {
        return /\/ged\/hwmconaluno\.aspx$/i.test(window.location.pathname);
    }

    function ehRotaFerramenta() {
        return ehPaginaConsultaAluno() && window.location.hash.toLowerCase() === HASH_FERRAMENTA;
    }

    window.addEventListener('hashchange', () => {
        const appExiste = Boolean(document.getElementById('edp-modular-host'));
        if (ehRotaFerramenta() && !appExiste) {
            window.location.reload();
            return;
        }
        if (!ehRotaFerramenta() && appExiste) {
            window.location.reload();
        }
    });

    // O módulo precisa registrar-se em TODAS as páginas do GED, mas só monta a
    // ferramenta quando a rota específica estiver ativa.
    if (!ehRotaFerramenta()) return;

    // =====================================================================
    // ESTADO
    // =====================================================================

    const state = {
        codigos: [],
        codigosInep: [],
        indice: 0,
        linhas: '',
        cabecalho: '',
        grupoSocial: '',
        abortControllerMatricula: null,
        abortControllerInep: null,
        executando: false,
        morphAplicando: false,
        morphObserver: null,
        morphTimer: null
    };

    let refs = null;

    const sleep = (ms, signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Abortado'));
            }, { once: true });
        }
    });

    function origemGED() {
        return `${window.location.origin}/ged/`;
    }

    function getFrameDoc() {
        try {
            return refs?.iframe?.contentDocument || refs?.iframe?.contentWindow?.document || null;
        } catch (erro) {
            console.error('[Extrair Dados Pessoais] Não foi possível acessar o iframe:', erro);
            return null;
        }
    }

    function texto(doc, id, fallback = '') {
        const el = doc?.getElementById(id);
        return el ? String(el.textContent ?? el.innerText ?? '').trim() : fallback;
    }

    function setStatus(mensagem, tipo = 'info') {
        if (!refs?.status) return;
        refs.status.textContent = mensagem;
        refs.status.dataset.tipo = tipo;
    }

    function setProgresso(atual, total, mensagem = '') {
        if (!refs?.progressBar || !refs?.progressText) return;
        const pct = total ? Math.max(0, Math.min(100, Math.round((atual / total) * 100))) : 0;
        refs.progressBar.style.width = `${pct}%`;
        refs.progressText.textContent = mensagem || (total ? `${atual} de ${total}` : 'Aguardando');
        refs.progressPct.textContent = `${pct}%`;
    }

    function atualizarBotoes() {
        if (!refs) return;
        refs.botoesAcao.forEach(btn => {
            btn.disabled = state.executando;
        });
        refs.btnParar.disabled = !state.executando;
        refs.btnLimpar.disabled = state.executando;
    }

    function iniciarExecucao(label, total) {
        state.executando = true;
        atualizarBotoes();
        setStatus(label, 'processando');
        setProgresso(0, total, total ? `0 de ${total}` : 'Preparando...');
    }

    function finalizarExecucao(mensagem = 'Consulta finalizada!') {
        state.executando = false;
        atualizarBotoes();
        setStatus(mensagem, 'sucesso');
        const total = state.codigos.length || state.codigosInep.length || 1;
        setProgresso(total, total, mensagem);
    }

    function interromperExecucao(mensagem = 'Processo interrompido.') {
        state.executando = false;
        atualizarBotoes();
        setStatus(mensagem, 'erro');
    }

    // =====================================================================
    // ENTRADA / SAÍDA
    // =====================================================================

    function extrairCodigosAluno() {
        const entrada = refs.input.value || '';
        return [...new Set(entrada.match(/(?<!\d)\d{6,7}(?!\d)/g) || [])];
    }

    function extrairCodigosInep() {
        const entrada = refs.input.value || '';
        return [...new Set(entrada.match(/[0-9]+/g) || [])];
    }

    function validarEntrada(codigos, tipo = 'códigos') {
        if (codigos.length) return true;
        setStatus(`Nenhum ${tipo} válido foi encontrado no campo de entrada.`, 'erro');
        refs.input.focus();
        return false;
    }

    async function tentarCopiarSaida() {
        const valor = refs.output.value;
        if (!valor) return false;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(valor);
                return true;
            }
        } catch (_) {
            // Fallback abaixo.
        }

        try {
            refs.output.focus();
            refs.output.select();
            refs.output.setSelectionRange(0, refs.output.value.length);
            return Boolean(document.execCommand?.('copy'));
        } catch (_) {
            return false;
        }
    }

    function salvarCSV() {
        const conteudo = refs.output.value;
        if (!conteudo.trim()) {
            setStatus('Não há dados para salvar.', 'erro');
            return;
        }

        const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dadosGED.csv';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('CSV gerado com sucesso.', 'sucesso');
    }

    function limparTudo() {
        if (state.executando) return;
        refs.input.value = '';
        refs.output.value = '';
        state.codigos = [];
        state.codigosInep = [];
        state.indice = 0;
        state.linhas = '';
        state.cabecalho = '';
        setProgresso(0, 0, 'Aguardando');
        setStatus('Pronto para extrair dados.', 'info');
    }

    function formatarCPF(valor) {
        return String(valor || '').trim().replace(
            /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
            '$1.$2.$3-$4'
        );
    }

    function telefone(ddd, numero) {
        const d = String(ddd || '').trim();
        const n = String(numero || '').trim();
        if (!d && !n) return '';
        return d ? `(${d})${n}` : n;
    }

    function csvSafe(valor) {
        return String(valor ?? '').replaceAll(';', ',').replace(/[\r\n]+/g, ' ').trim();
    }

    // =====================================================================
    // EXTRAÇÃO ABA PESSOAL
    // =====================================================================

    function lerGrupoSocial(doc) {
        let grupo = '';
        const mapa = {
            N: 'Não declarado',
            I: 'Circense',
            T: 'Trabalhador Itinerante',
            C: 'Acampados',
            A: 'Artista',
            P: 'Povos Indígenas',
            Q: 'Povos Quilombolas'
        };

        doc?.querySelectorAll('input[name="CTLGERPESGRPSOC"]').forEach(radio => {
            if (radio.checked) grupo = mapa[radio.value] || '';
        });
        return grupo;
    }

    function montarLinhaPessoal(doc, codigo) {
        const grupoSocial = lerGrupoSocial(doc);

        const colunas = [
            ['Cod Aluno', codigo],
            ['Nº INEP', texto(doc, 'span_CTLGEDALUIDINEP')],
            ['Aluno', texto(doc, 'span_CTLGERPESNOM')],
            ['Nome Social', texto(doc, 'span_CTLGERPESNOMSOC')],
            ['CPF do Aluno', formatarCPF(texto(doc, 'span_CTLGERPESCPF'))],
            ['Cor ou Raça', texto(doc, 'span_CTLGERPESRACA')],
            ['Grupo Social', grupoSocial],
            ['RG do aluno', texto(doc, 'span_CTLGERPESRG')],
            ['Órgão Expedidor', texto(doc, 'span_CTLGERORGEMICOD')],
            ['Sexo do Aluno', texto(doc, 'span_CTLGERPESSEXO')],
            ['Data de Nascimento', texto(doc, 'span_CTLGERPESDTANASC')],
            ['Naturalidade', texto(doc, 'span_CTLGERPESNATDSC')],
            ['UF', texto(doc, 'span_CTLGERPESNATUF')],
            ['Filiação 1', texto(doc, 'span_CTLGERPESNOMMAE')],
            ['filiação 2', texto(doc, 'span_CTLGERPESNOMPAI')],

            ['Nome do responsável 1', texto(doc, 'span_CTLGERPESNOMRESP')],
            ['CPF do responsável 1', formatarCPF(texto(doc, 'span_CTLGERPESRESPCPF'))],
            ['Tel Res Resp 1', telefone(texto(doc, 'span_CTLGERPESTELRESDDDRESP'), texto(doc, 'span_CTLGERPESTELRESRESP'))],
            ['Tel Celular Resp 1', telefone(texto(doc, 'span_CTLGERPESTELCELDDDRESP'), texto(doc, 'span_CTLGERPESTELCELRESP'))],
            ['Tel Comercial Resp 1', telefone(texto(doc, 'span_CTLGERPESTELCOMDDDRESP'), texto(doc, 'span_CTLGERPESTELCOMRESP'))],
            ['Tel Contato Resp 1', telefone(texto(doc, 'span_CTLGERPESTELCONDDDRESP'), texto(doc, 'span_CTLGERPESTELCONRESP'))],
            ['E-mail Resp 1', texto(doc, 'span_CTLGERPESEMAILRESP')],

            ['Nome do responsável 2', texto(doc, 'span_CTLGERPESNOMRESP2')],
            ['CPF do responsável 2', formatarCPF(texto(doc, 'span_CTLGERPESRESPCPF2'))],
            ['Tel Res Resp 2', telefone(texto(doc, 'span_CTLGERPESTELRESDDDRESP2'), texto(doc, 'span_CTLGERPESTELRESRESP2'))],
            ['Tel Celular Resp 2', telefone(texto(doc, 'span_CTLGERPESTELCELDDDRESP2'), texto(doc, 'span_CTLGERPESTELCELRESP2'))],
            ['Tel Comercial Resp 2', telefone(texto(doc, 'span_CTLGERPESTELCOMDDDRESP2'), texto(doc, 'span_CTLGERPESTELCOMRESP2'))],
            ['Tel Contato Resp 2', telefone(texto(doc, 'span_CTLGERPESTELCONDDDRESP2'), texto(doc, 'span_CTLGERPESTELCONRESP2'))],
            ['E-mail Resp 2', texto(doc, 'span_CTLGERPESEMAILRESP2')],

            ['Tel Residencial', telefone(texto(doc, 'span_CTLGERPESTELRESDDD'), texto(doc, 'span_CTLGERPESTELRES'))],
            ['Tel Celular', telefone(texto(doc, 'span_CTLGERPESTELCELDDD'), texto(doc, 'span_CTLGERPESTELCEL'))],
            ['Tel Comercial', telefone(texto(doc, 'span_CTLGERPESTELCOMDDD'), texto(doc, 'span_CTLGERPESTELCOM'))],
            ['Tel Contato', telefone(texto(doc, 'span_CTLGERPESTELCONDDD'), texto(doc, 'span_CTLGERPESTELCON'))],

            ['Endereço Rua', texto(doc, 'span_CTLGERPESEND')],
            ['Número', texto(doc, 'span_CTLGERPESNMRLOG')],
            ['Complemento', texto(doc, 'span_CTLGERPESCMPLOG')],
            ['Bairro', texto(doc, 'span_CTLGERPESBAIRRO')],
            ['Cidade', texto(doc, 'span_CTLGERPESENDCIDDSC')],
            ['UF', texto(doc, 'span_CTLGERPESENDUF')],
            ['CEP', texto(doc, 'span_CTLGERPESCEP')],
            ['UC (Distribuidora)', texto(doc, 'span_CTLGERPESDISTCOD')],
            ['Nº UC', texto(doc, 'span_CTLGERPESUC')]
        ];

        if (!state.cabecalho) state.cabecalho = colunas.map(([nome]) => nome).join(';') + ';';
        return colunas.map(([, valor]) => csvSafe(valor)).join(';') + ';';
    }

    function iniciarPessoal() {
        const codigos = extrairCodigosAluno();
        if (!validarEntrada(codigos, 'código de aluno com 6 ou 7 dígitos')) return;

        cancelarExecucoesAtivas(false);
        state.codigos = codigos;
        state.indice = 0;
        state.linhas = '';
        state.cabecalho = '';
        refs.output.value = '';

        iniciarExecucao('Extraindo dados da aba Pessoal...', codigos.length);

        refs.iframe.onload = processarPessoal;
        refs.iframe.src = `${origemGED()}hwtmgedaluno.aspx?${codigos[0]},,HWMConAluno,DSP,1,0`;
    }

    async function processarPessoal() {
        if (!state.executando) return;
        const doc = getFrameDoc();
        if (!doc) return;

        const codigo = state.codigos[state.indice];
        try {
            const linha = montarLinhaPessoal(doc, codigo);
            state.linhas += linha + '\n';
            refs.output.value = `${state.cabecalho}\n${state.linhas}`;
        } catch (erro) {
            console.error('[Extrair Dados Pessoais] Falha na aba Pessoal:', erro);
            state.linhas += `${codigo};ERRO AO EXTRAIR DADOS;${csvSafe(erro?.message || erro)}\n`;
            refs.output.value = `${state.cabecalho || 'Cod Aluno;Resultado;Erro;'}\n${state.linhas}`;
        }

        state.indice += 1;
        setProgresso(state.indice, state.codigos.length, `Pessoal: ${state.indice} de ${state.codigos.length}`);

        if (state.indice < state.codigos.length) {
            refs.iframe.src = `${origemGED()}hwtmgedaluno.aspx?${state.codigos[state.indice]},,HWMConAluno,DSP,1,0`;
            return;
        }

        refs.iframe.onload = null;
        await tentarCopiarSaida();
        finalizarExecucao(`Aba Pessoal concluída: ${state.codigos.length} aluno(s).`);
    }

    // =====================================================================
    // EXTRAÇÃO ABA SOCIAL
    // =====================================================================

    function nomeAlunoDoGXState(doc) {
        try {
            const valor = doc?.getElementsByName('GXState')?.[0]?.value || '';
            const match = valor.match(/"GedAluNom":"([^"]+)"/);
            return match?.[1] || '';
        } catch (_) {
            return '';
        }
    }

    function montarLinhaSocial(doc, codigo) {
        const colunas = [
            ['Cod Aluno', codigo],
            ['Nome do Aluno', nomeAlunoDoGXState(doc)],
            ['Nro SUS', texto(doc, 'span_CTLGERPESNUMCARTAOSUS')],
            ['Nro NIS', texto(doc, 'span_CTLGERPESNIS')],
            ['Tipo sanguíneo', texto(doc, 'span_CTLGEDALUTIPOSANGUINEO').replace('SELECIONE', 'não consta')],
            ['Recebe Atendimento Especializado', texto(doc, 'span_CTLGEDALURECATEEDUESP')],
            ['Recebe BPC', texto(doc, 'span_CTLGERPESBENPCAS')],
            ['Utiliza Passe Livre', texto(doc, 'span_CTLGEDALUPASSELIVRE')]
        ];

        if (!state.cabecalho) state.cabecalho = colunas.map(([nome]) => nome).join(';') + ';';
        return colunas.map(([, valor]) => csvSafe(valor)).join(';') + ';';
    }

    function iniciarSocial() {
        const codigos = extrairCodigosAluno();
        if (!validarEntrada(codigos, 'código de aluno com 6 ou 7 dígitos')) return;

        cancelarExecucoesAtivas(false);
        state.codigos = codigos;
        state.indice = 0;
        state.linhas = '';
        state.cabecalho = '';
        refs.output.value = '';

        iniciarExecucao('Extraindo dados da aba Social...', codigos.length);

        refs.iframe.onload = processarSocial;
        refs.iframe.src = `${origemGED()}hwtmgedaluno1.aspx?${codigos[0]},,HWMConAluno,DSP,0,1,0,1`;
    }

    async function processarSocial() {
        if (!state.executando) return;
        const doc = getFrameDoc();
        if (!doc) return;

        const codigo = state.codigos[state.indice];
        try {
            state.linhas += montarLinhaSocial(doc, codigo) + '\n';
            refs.output.value = `${state.cabecalho}\n${state.linhas}`;
        } catch (erro) {
            console.error('[Extrair Dados Pessoais] Falha na aba Social:', erro);
            state.linhas += `${codigo};ERRO AO EXTRAIR DADOS;${csvSafe(erro?.message || erro)}\n`;
            refs.output.value = `${state.cabecalho || 'Cod Aluno;Resultado;Erro;'}\n${state.linhas}`;
        }

        state.indice += 1;
        setProgresso(state.indice, state.codigos.length, `Social: ${state.indice} de ${state.codigos.length}`);

        if (state.indice < state.codigos.length) {
            refs.iframe.src = `${origemGED()}hwtmgedaluno1.aspx?${state.codigos[state.indice]},,HWMConAluno,DSP,0,1,0,1`;
            return;
        }

        refs.iframe.onload = null;
        await tentarCopiarSaida();
        finalizarExecucao(`Aba Social concluída: ${state.codigos.length} aluno(s).`);
    }

    // =====================================================================
    // EXTRAÇÃO DADOS DA MATRÍCULA
    // =====================================================================

    function lerCheckbox(doc, nome) {
        const checkbox = doc?.getElementsByName(nome)?.[0];
        if (!checkbox) return 'N/A';
        return checkbox.value === '1' ? 'Sim' : 'Não';
    }

    function selecionarTextoSelect(doc, id) {
        const select = doc?.getElementById(id);
        if (!select) return 'N/A';
        return select.options?.[select.selectedIndex]?.text?.trim() || 'N/A';
    }

    async function aguardarElementoAlterar(doc, id, valorAntigo, signal, tentativas = 50, intervalo = 100) {
        for (let i = 0; i < tentativas; i++) {
            if (signal.aborted) throw new Error('Processo abortado');
            const valor = texto(doc, id);
            if (valor && valor !== valorAntigo) return valor;
            await sleep(intervalo, signal);
        }
        throw new Error('Erro ao consultar aluno');
    }

    function iniciarMatricula() {
        const codigos = extrairCodigosAluno();
        if (!validarEntrada(codigos, 'código de aluno com 6 ou 7 dígitos')) return;

        cancelarExecucoesAtivas(false);
        state.codigos = codigos;
        refs.output.value = '';
        iniciarExecucao('Preparando consulta de matrícula...', codigos.length);

        state.abortControllerMatricula = new AbortController();
        const controller = state.abortControllerMatricula;

        refs.iframe.onload = () => {
            refs.iframe.onload = null;
            executarMatriculas(codigos, controller).catch(erro => {
                if (erro?.message !== 'Abortado' && erro?.message !== 'Processo abortado') {
                    console.error('[Extrair Dados Pessoais] Matrículas:', erro);
                    interromperExecucao(`Erro na extração de matrícula: ${erro?.message || erro}`);
                }
            });
        };
        refs.iframe.src = `${origemGED()}hwmgedmanutencaomatricula.aspx`;
    }

    async function executarMatriculas(codigos, controller) {
        const { signal } = controller;
        const doc = getFrameDoc();
        if (!doc) throw new Error('Página de matrícula não carregou no iframe.');

        refs.output.value = [
            'Código',
            'Nome do Aluno',
            'Matriz',
            'Turma',
            'Rede de Origem',
            'Utiliza Transporte',
            'Matrícula Mescla',
            'Matrícula Extraordinária',
            'Matrícula de Progressão Parcial',
            'Data da Matrícula',
            'Nº da Matrícula',
            'Observação'
        ].join('; ') + '\n';

        let matCodAntigo = '0';
        let nomeAntigo = '0';

        try {
            for (let i = 0; i < codigos.length; i++) {
                if (signal.aborted) throw new Error('Processo abortado');
                const codigo = codigos[i];
                setStatus(`[${i + 1}/${codigos.length}] Consultando matrícula: ${codigo}...`, 'processando');

                const campoCodigo = doc.getElementById('vGEDALUCOD');
                const btnConsultar = doc.getElementsByName('BCONSULTAR')?.[0];
                if (!campoCodigo || !btnConsultar) {
                    throw new Error('Campos da tela de manutenção de matrícula não foram encontrados.');
                }

                campoCodigo.value = codigo;
                try {
                    if (typeof campoCodigo.onblur === 'function') campoCodigo.onblur();
                    else campoCodigo.dispatchEvent(new Event('blur', { bubbles: true }));
                } catch (_) {}

                await sleep(60, signal);
                btnConsultar.click();

                try {
                    const matCodAtual = await aguardarElementoAlterar(doc, 'span_vGEDMATCOD_0001', matCodAntigo, signal);
                    const nomeAtual = await aguardarElementoAlterar(doc, 'span_vGEDALUNOM', nomeAntigo, signal);

                    const linha = [
                        codigo,
                        texto(doc, 'span_vGEDALUNOM', 'N/A'),
                        texto(doc, 'span_vGRIDGEDMATDISCGERMATMSC_0001', 'N/A'),
                        texto(doc, 'span_vGERTURSAL_0001', 'N/A'),
                        selecionarTextoSelect(doc, 'vGEDMATTIPOORIGEMMAT_0001'),
                        selecionarTextoSelect(doc, 'vMATTRANSPESCOLAR_0001'),
                        lerCheckbox(doc, 'vMATMESCLA_0001'),
                        lerCheckbox(doc, 'vMATEXTRAORDINARIA_0001'),
                        lerCheckbox(doc, 'vMATPROGRESSAOPARCIAL_0001'),
                        texto(doc, 'span_vGEDMATDTA_0001', 'N/A'),
                        texto(doc, 'span_vGEDMATCOD_0001', 'N/A'),
                        ''
                    ].map(csvSafe).join('; ');

                    refs.output.value += linha + '\n';
                    matCodAntigo = matCodAtual;
                    nomeAntigo = nomeAtual;
                } catch (erro) {
                    if (signal.aborted) throw erro;
                    const nomeAluno = texto(doc, 'span_vGEDALUNOM', 'N/A');
                    const erroTela = doc.querySelector('#gxErrorViewer .erro')?.textContent?.trim() || '';
                    refs.output.value += [
                        codigo,
                        nomeAluno,
                        erroTela || 'O extrator não teve retorno da consulta. Verifique o código deste aluno.'
                    ].map(csvSafe).join('; ') + '\n';
                }

                refs.output.scrollTop = refs.output.scrollHeight;
                setProgresso(i + 1, codigos.length, `Matrícula: ${i + 1} de ${codigos.length}`);
            }

            finalizarExecucao(`Matrículas concluídas: ${codigos.length} aluno(s).`);
        } catch (erro) {
            if (erro?.message === 'Abortado' || erro?.message === 'Processo abortado') {
                interromperExecucao('Extração de matrícula interrompida.');
                return;
            }
            throw erro;
        } finally {
            if (state.abortControllerMatricula === controller) {
                state.abortControllerMatricula = null;
            }
        }
    }

    // =====================================================================
    // EXTRAÇÃO PELO Nº INEP
    // =====================================================================

    function iniciarInep() {
        const codigos = extrairCodigosInep();
        if (!validarEntrada(codigos, 'número INEP')) return;

        cancelarExecucoesAtivas(false);
        state.codigosInep = codigos;
        refs.output.value = '';
        iniciarExecucao('Preparando consulta por nº INEP...', codigos.length);

        state.abortControllerInep = new AbortController();
        const controller = state.abortControllerInep;

        refs.iframe.onload = () => {
            refs.iframe.onload = null;
            executarInep(codigos, controller).catch(erro => {
                if (erro?.message !== 'Abortado' && erro?.message !== 'Execução abortada') {
                    console.error('[Extrair Dados Pessoais] INEP:', erro);
                    interromperExecucao(`Erro na consulta por INEP: ${erro?.message || erro}`);
                }
            });
        };
        refs.iframe.src = `${origemGED()}hwmconaluno.aspx`;
    }

    async function executarInep(codigos, controller) {
        const { signal } = controller;
        const doc = getFrameDoc();
        if (!doc) throw new Error('Página de consulta não carregou no iframe.');

        const campoCodigo = doc.getElementById('vGEDALUIDINEP');
        const botaoConsultar = doc.getElementsByName('BCONSULTAR')?.[0];
        const viewerErro = doc.getElementById('gxErrorViewer');

        if (!campoCodigo || !botaoConsultar) {
            throw new Error('Campo INEP ou botão Consultar não encontrado.');
        }

        const camposCSV = [
            { id: 'span_vGEDALUIDINEPGRID_', nome: 'Matrícula INEP' },
            { id: 'span_vGERPESCODCHAR_', nome: 'Código' },
            { id: 'span_vGERPESNOM_', nome: 'Aluno' },
            { id: 'span_vGERPESDTANASC_', nome: 'Nascimento' },
            { id: 'span_vGERPESNATDSC_', nome: 'Natural' },
            { id: 'span_vGERPESNOMMAE_', nome: 'Filiação 1' },
            { id: 'span_vGERPESNOMPAI_', nome: 'Filiação 2' },
            { id: 'span_vGERPESNOMFIL3_', nome: 'Filiação 3' },
            { id: '', nome: 'Observação' }
        ];

        refs.output.value = camposCSV.map(c => c.nome).join(';') + ';Erro na consulta\n';
        let ultimoErro = '';

        try {
            for (let idx = 0; idx < codigos.length; idx++) {
                const cod = codigos[idx];
                if (signal.aborted) throw new Error('Execução abortada');

                setStatus(`[${idx + 1}/${codigos.length}] Consultando INEP: ${cod}...`, 'processando');
                campoCodigo.value = cod;
                campoCodigo.dispatchEvent(new Event('input', { bubbles: true }));
                campoCodigo.dispatchEvent(new Event('change', { bubbles: true }));
                botaoConsultar.click();

                const inicio = Date.now();
                let resultado = '';

                while (Date.now() - inicio < 6000) {
                    await sleep(300, signal);
                    if (signal.aborted) throw new Error('Execução abortada');

                    const linhas = doc.querySelectorAll('#GriddetalhesContainerTbl tr');
                    if (linhas.length > 1) {
                        const primeira = doc.getElementById('span_vGEDALUIDINEPGRID_0001');
                        if (primeira && primeira.textContent.trim() === String(cod)) {
                            const registros = [];
                            for (let i = 1; ; i++) {
                                const sufixo = String(i).padStart(4, '0');
                                const cel = doc.getElementById(`span_vGEDALUIDINEPGRID_${sufixo}`);
                                if (!cel) break;
                                registros.push({
                                    sufixo,
                                    nomeAluno: texto(doc, `span_vGERPESNOM_${sufixo}`)
                                });
                            }

                            let observacao = '';
                            if (registros.length > 1) {
                                const nomes = registros.map(r => r.nomeAluno).filter(Boolean).join(', ');
                                observacao = `Nº INEP cadastrado para mais de um aluno: "${nomes}"`;
                            }

                            const linhasResultado = registros.map(reg => {
                                const valores = camposCSV.map(campo => {
                                    if (campo.nome === 'Observação') return observacao;
                                    return texto(doc, `${campo.id}${reg.sufixo}`);
                                });
                                return valores.map(csvSafe).join(';') + ';';
                            });

                            refs.output.value += linhasResultado.join('\n') + '\n';
                            resultado = 'ok';
                            break;
                        }
                    }

                    const erroDiv = viewerErro?.querySelector('.erro');
                    if (erroDiv) {
                        const textoErro = erroDiv.textContent.trim();
                        if (textoErro && textoErro !== ultimoErro) {
                            ultimoErro = textoErro;
                            refs.output.value += `${csvSafe(cod)};;;;;;;;;${csvSafe(textoErro)}\n`;
                            resultado = 'erro';
                            break;
                        }
                    }
                }

                if (!resultado) {
                    refs.output.value += `${csvSafe(cod)};;;;;;;;;Erro: tempo esgotado\n`;
                }

                refs.output.scrollTop = refs.output.scrollHeight;
                setProgresso(idx + 1, codigos.length, `INEP: ${idx + 1} de ${codigos.length}`);
            }

            finalizarExecucao(`Consulta por INEP concluída: ${codigos.length} número(s).`);
        } catch (erro) {
            if (erro?.message === 'Abortado' || erro?.message === 'Execução abortada') {
                interromperExecucao('Consulta por INEP interrompida.');
                return;
            }
            throw erro;
        } finally {
            if (state.abortControllerInep === controller) {
                state.abortControllerInep = null;
            }
        }
    }

    // =====================================================================
    // CANCELAMENTO
    // =====================================================================

    function cancelarExecucoesAtivas(mostrarStatus = true) {
        refs && (refs.iframe.onload = null);

        if (state.abortControllerMatricula) {
            state.abortControllerMatricula.abort();
            state.abortControllerMatricula = null;
        }
        if (state.abortControllerInep) {
            state.abortControllerInep.abort();
            state.abortControllerInep = null;
        }

        if (state.executando) {
            state.executando = false;
            atualizarBotoes();
            if (mostrarStatus) setStatus('Processo interrompido pelo usuário.', 'erro');
        }
    }

    // =====================================================================
    // INTERFACE MODULAR
    // =====================================================================

    function garantirEstilo() {
        if (document.getElementById('edp-modular-style')) return;

        const style = document.createElement('style');
        style.id = 'edp-modular-style';
        style.textContent = `
            body.Form { background:#fff !important; }

            #TABLE1_MPAGE {
                width:min(1180px, calc(100vw - 18px)) !important;
            }

            [data-edp-native-hidden="1"] {
                display:none !important;
            }

            #edp-modular-host {
                display:block !important;
                width:min(1040px, calc(100vw - 34px)) !important;
                margin:10px auto 28px !important;
                padding:0 !important;
                box-sizing:border-box !important;
                font-family:Verdana,Arial,sans-serif !important;
            }

            #edp-modular-host * { box-sizing:border-box; }

            #edp-app {
                overflow:hidden;
                border:1px solid #aab5c0;
                border-radius:5px;
                background:#f8fafc;
                box-shadow:0 2px 7px rgba(0,0,0,.14);
                color:#1f2937;
                font-family:Verdana,Arial,sans-serif;
                font-size:11px;
            }

            #edp-app .edp-header {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:14px;
                padding:14px 16px;
                border-bottom:1px solid #cbd5e1;
                background:#065195;
                color:#fff;
            }

            #edp-app .edp-header h2 {
                margin:0 0 3px;
                font-size:15px;
                line-height:1.2;
            }

            #edp-app .edp-header p {
                margin:0;
                font-size:10px;
                opacity:.88;
                font-weight:normal;
            }

            #edp-app .edp-badge {
                flex:0 0 auto;
                padding:4px 7px;
                border:1px solid rgba(255,255,255,.45);
                border-radius:3px;
                background:rgba(255,255,255,.12);
                font-size:9px;
                font-weight:bold;
            }

            #edp-app .edp-body {
                display:grid;
                grid-template-columns:minmax(270px, .9fr) minmax(380px, 1.4fr);
                gap:12px;
                padding:14px;
            }

            #edp-app .edp-card {
                border:1px solid #cbd5e1;
                border-radius:4px;
                padding:12px;
                background:#fff;
            }

            #edp-app .edp-card h3 {
                margin:0 0 9px;
                color:#065195;
                font-size:12px;
            }

            #edp-app label {
                display:block;
                margin-bottom:5px;
                color:#333;
                font-size:10px;
                font-weight:bold;
            }

            #edp-app textarea {
                width:100%;
                border:1px solid #9aa7b4;
                border-radius:3px;
                padding:7px;
                background:#fff;
                color:#111;
                font:11px Consolas,monospace;
                resize:vertical;
                outline:none;
            }

            #edp-app textarea:focus {
                border-color:#3982f7;
                box-shadow:0 0 0 2px rgba(57,130,247,.12);
            }

            #edp-input { min-height:150px; }
            #edp-output { min-height:305px; }

            #edp-app .edp-hint {
                margin:6px 0 10px;
                color:#64748b;
                font-size:9px;
                line-height:1.4;
            }

            #edp-app .edp-actions {
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:7px;
            }

            #edp-app button {
                min-height:32px;
                border:1px solid #777;
                border-radius:3px;
                padding:6px 8px;
                background:#efefef;
                color:#222;
                cursor:pointer;
                font:700 10px Verdana,Arial,sans-serif;
            }

            #edp-app button:hover:not(:disabled) { background:#e3e3e3; }
            #edp-app button:disabled { opacity:.48; cursor:not-allowed; }
            #edp-app .primary { background:#065195; border-color:#054579; color:#fff; }
            #edp-app .primary:hover:not(:disabled) { background:#043f75; }
            #edp-app .green { background:#238636; border-color:#1d6f2e; color:#fff; }
            #edp-app .green:hover:not(:disabled) { background:#1c702d; }
            #edp-app .danger { background:#dc3545; border-color:#bb2d3b; color:#fff; }
            #edp-app .danger:hover:not(:disabled) { background:#bb2d3b; }

            #edp-status {
                margin:10px 0 8px;
                border:1px solid #cbd5e1;
                border-radius:3px;
                padding:7px 8px;
                background:#f8fafc;
                color:#334155;
                font-size:10px;
                font-weight:bold;
            }

            #edp-status[data-tipo="processando"] { background:#fff3cd; border-color:#ffe69c; color:#664d03; }
            #edp-status[data-tipo="sucesso"] { background:#d1e7dd; border-color:#badbcc; color:#0f5132; }
            #edp-status[data-tipo="erro"] { background:#f8d7da; border-color:#f5c2c7; color:#842029; }

            #edp-app .progress-wrap {
                display:flex;
                align-items:center;
                gap:8px;
                margin-bottom:10px;
                font-size:9px;
                color:#555;
            }

            #edp-app .progress-track {
                flex:1;
                height:8px;
                overflow:hidden;
                border:1px solid #b8c2cc;
                border-radius:10px;
                background:#e9ecef;
            }

            #edp-progress-bar {
                width:0;
                height:100%;
                background:#065195;
                transition:width .2s ease;
            }

            #edp-app .output-toolbar {
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
                margin-bottom:7px;
            }

            #edp-app .output-toolbar .right {
                display:flex;
                gap:6px;
            }

            #edp-app .edp-footer {
                display:flex;
                justify-content:space-between;
                gap:10px;
                padding:8px 14px;
                border-top:1px solid #d8dee6;
                background:#f1f5f9;
                color:#64748b;
                font-size:9px;
            }

            #edp-frame { display:none !important; }

            @media (max-width: 820px) {
                #edp-app .edp-body { grid-template-columns:1fr; }
                #edp-app .edp-actions { grid-template-columns:1fr; }
                #edp-output { min-height:220px; }
            }
        `;
        document.head.appendChild(style);
    }

    function encontrarTabelaNativa() {
        const alvo = document.getElementById('vGRHDESCRICAO')
            || document.getElementById('vGERPESCPFAUX')
            || document.getElementById('GriddetalhesContainerDiv')
            || document.getElementById('TABLE4');

        if (!alvo) return document.getElementById('TABLE4');
        if (alvo.id === 'TABLE4') return alvo;

        let no = alvo;
        while (no && no !== document.body) {
            if (no.tagName === 'TABLE' && (no.id === 'TABLE4' || no.querySelector?.('#GriddetalhesContainerDiv'))) {
                return no;
            }
            no = no.parentElement;
        }

        return document.getElementById('TABLE4') || alvo.closest?.('table') || null;
    }

    function prepararHost(tabelaNativa) {
        let host = document.getElementById('edp-modular-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'edp-modular-host';
        }

        const pai = tabelaNativa?.parentNode;
        if (pai && host.parentNode !== pai) {
            pai.insertBefore(host, tabelaNativa);
        } else if (!host.isConnected) {
            (document.getElementById('MAINFORM') || document.body || document.documentElement).appendChild(host);
        }
        return host;
    }

    function criarInterface(host) {
        if (document.getElementById('edp-app')) return document.getElementById('edp-app');

        const app = document.createElement('section');
        app.id = 'edp-app';
        app.innerHTML = `
            <div class="edp-header">
                <div>
                    <h2>Extrair Dados Pessoais</h2>
                    <p>Extração em lote a partir dos códigos dos alunos ou nº INEP.</p>
                </div>
                <div class="edp-badge">SIGEDUCA • Ferramentas</div>
            </div>

            <div class="edp-body">
                <div class="edp-card">
                    <h3>1. Alunos para consulta</h3>
                    <label for="edp-input">Informe os códigos dos alunos</label>
                    <textarea id="edp-input" spellcheck="false" placeholder="Cole aqui os códigos, um por linha.\n\nPara Pessoal, Social e Matrícula: códigos de aluno com 6 ou 7 dígitos.\nPara consulta INEP: informe os números INEP."></textarea>
                    <div class="edp-hint">
                        Duplicidades são removidas automaticamente. Os dados são processados dentro de um iframe oculto do próprio SIGEDUCA.
                    </div>

                    <div class="edp-actions">
                        <button type="button" id="edp-pessoal" class="primary">👤 Extrair aba “Pessoal”</button>
                        <button type="button" id="edp-social" class="primary">🧩 Extrair aba “Social”</button>
                        <button type="button" id="edp-matricula">🎓 Extrair Dados da Matrícula</button>
                        <button type="button" id="edp-inep" class="green">🔎 Extrair dados pelo nº INEP</button>
                    </div>

                    <div id="edp-status" data-tipo="info">Pronto para extrair dados.</div>

                    <div class="progress-wrap">
                        <span id="edp-progress-text">Aguardando</span>
                        <div class="progress-track"><div id="edp-progress-bar"></div></div>
                        <strong id="edp-progress-pct">0%</strong>
                    </div>

                    <div class="edp-actions">
                        <button type="button" id="edp-parar" class="danger" disabled>■ Parar processo</button>
                        <button type="button" id="edp-limpar">Limpar tudo</button>
                    </div>
                </div>

                <div class="edp-card">
                    <div class="output-toolbar">
                        <h3 style="margin:0;">2. Informações extraídas</h3>
                        <div class="right">
                            <button type="button" id="edp-copiar">Copiar</button>
                            <button type="button" id="edp-salvar" class="primary">Salvar CSV</button>
                        </div>
                    </div>
                    <textarea id="edp-output" readonly spellcheck="false" placeholder="Os dados extraídos aparecerão aqui..."></textarea>
                </div>
            </div>

            <iframe id="edp-frame" src="about:blank" title="Processamento interno SIGEDUCA"></iframe>

            <div class="edp-footer">
                <span>Módulo modular v3.0.0</span>
                <span>Baseado no “Extrator Contatos Sigeduca” de Roberson Arruda</span>
            </div>
        `;

        host.appendChild(app);

        refs = {
            app,
            input: app.querySelector('#edp-input'),
            output: app.querySelector('#edp-output'),
            iframe: app.querySelector('#edp-frame'),
            status: app.querySelector('#edp-status'),
            progressText: app.querySelector('#edp-progress-text'),
            progressBar: app.querySelector('#edp-progress-bar'),
            progressPct: app.querySelector('#edp-progress-pct'),
            btnPessoal: app.querySelector('#edp-pessoal'),
            btnSocial: app.querySelector('#edp-social'),
            btnMatricula: app.querySelector('#edp-matricula'),
            btnInep: app.querySelector('#edp-inep'),
            btnParar: app.querySelector('#edp-parar'),
            btnLimpar: app.querySelector('#edp-limpar'),
            btnCopiar: app.querySelector('#edp-copiar'),
            btnSalvar: app.querySelector('#edp-salvar')
        };
        refs.botoesAcao = [refs.btnPessoal, refs.btnSocial, refs.btnMatricula, refs.btnInep];

        refs.btnPessoal.addEventListener('click', iniciarPessoal);
        refs.btnSocial.addEventListener('click', iniciarSocial);
        refs.btnMatricula.addEventListener('click', iniciarMatricula);
        refs.btnInep.addEventListener('click', iniciarInep);
        refs.btnParar.addEventListener('click', () => cancelarExecucoesAtivas(true));
        refs.btnLimpar.addEventListener('click', limparTudo);
        refs.btnSalvar.addEventListener('click', salvarCSV);
        refs.btnCopiar.addEventListener('click', async () => {
            const ok = await tentarCopiarSaida();
            setStatus(ok ? 'Dados copiados para a área de transferência.' : 'Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.', ok ? 'sucesso' : 'erro');
        });

        refs.output.addEventListener('click', () => refs.output.select());
        return app;
    }

    function aplicarMorph() {
        if (state.morphAplicando || !ehRotaFerramenta()) return false;
        state.morphAplicando = true;

        try {
            garantirEstilo();
            document.title = 'Extrair Dados Pessoais - SIGEDUCA';

            const titulo = document.getElementById('TTITULO');
            if (titulo) titulo.textContent = 'Extrair Dados Pessoais';

            const tabelaNativa = encontrarTabelaNativa();
            if (!tabelaNativa) return false;

            tabelaNativa.dataset.edpNativeHidden = '1';
            tabelaNativa.style.setProperty('display', 'none', 'important');

            const host = prepararHost(tabelaNativa);
            criarInterface(host);

            return Boolean(document.getElementById('edp-app'));
        } finally {
            state.morphAplicando = false;
        }
    }

    function iniciarMorphRobusto() {
        let tentativas = 0;
        const MAX = 80;

        const tentar = () => {
            tentativas += 1;
            const sucesso = aplicarMorph();
            if (sucesso || tentativas >= MAX) {
                if (state.morphTimer) {
                    clearInterval(state.morphTimer);
                    state.morphTimer = null;
                }
            }
        };

        tentar();
        if (!document.getElementById('edp-app')) {
            state.morphTimer = setInterval(tentar, 100);
        } else {
            let reforcos = 0;
            state.morphTimer = setInterval(() => {
                reforcos += 1;
                aplicarMorph();
                if (reforcos >= 10) {
                    clearInterval(state.morphTimer);
                    state.morphTimer = null;
                }
            }, 120);
        }

        if (!state.morphObserver && document.body) {
            state.morphObserver = new MutationObserver(() => {
                if (!ehRotaFerramenta()) return;

                const tabela = encontrarTabelaNativa();
                const host = document.getElementById('edp-modular-host');
                const app = document.getElementById('edp-app');

                if (
                    (tabela && tabela.dataset.edpNativeHidden !== '1') ||
                    !host ||
                    !app ||
                    app.parentNode !== host ||
                    getComputedStyle(app).display === 'none'
                ) {
                    requestAnimationFrame(aplicarMorph);
                }
            });

            state.morphObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }

    function iniciarModulo() {
        const iniciar = () => iniciarMorphRobusto();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar, { once: true });
        } else {
            iniciar();
        }
    }

    iniciarModulo();
})();
