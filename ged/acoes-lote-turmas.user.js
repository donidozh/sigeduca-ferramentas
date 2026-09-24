// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Ações em Lote (Turmas)
// @namespace    http://tampermonkey.net/
// @version      4.3.4
// @description  Módulo Ferramentas para ações em lote por turma, com atualização automática, envio das relações, dados pessoais, atestados, impressão e cópia de códigos.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      *.googleusercontent.com
// @connect      sigeduca.seduc.mt.gov.br
// @connect      *.seduc.mt.gov.br
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/acoes-lote-turmas.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/acoes-lote-turmas.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @grant        GM_info
// ==/UserScript==

(function() {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '4.3.4',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/acoes-lote-turmas.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/acoes-lote-turmas.user.js'
    });


    // =====================================================================
    // REGISTRO NO MENU MODULAR "FERRAMENTAS"
    // =====================================================================
    const FLAG_MODULO = '__SIGEDUCA_ACOES_LOTE_TURMAS_MODULAR_V4_3_0__';
    if (window[FLAG_MODULO]) return;
    window[FLAG_MODULO] = true;

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const HASH_FERRAMENTA = '#acoes-lote-turmas';
    const QUERY_TURMAS_COMPLETA = '?0,0,0,0,9,HWMGrhLotTurma.aspx%3f0%2c0%2c0%2c0';
    const URL_FERRAMENTA_COMPLETA =
        `http://sigeduca.seduc.mt.gov.br/ged/hwmgrhturma.aspx${QUERY_TURMAS_COMPLETA}${HASH_FERRAMENTA}`;

    const FERRAMENTA = Object.freeze({
        id: 'acoes-lote-turmas',
        titulo: 'Ações em Lote',
        url: URL_FERRAMENTA_COMPLETA,
        descricao: 'Ações em lote por turma',
        ordem: 40,
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

    function ehPaginaTurmas() {
        return /\/ged\/hwmgrhturma\.aspx$/i.test(window.location.pathname);
    }

    function ehRotaFerramenta() {
        return ehPaginaTurmas() && window.location.hash.toLowerCase() === HASH_FERRAMENTA;
    }

    function temParametrosCompletosDaTelaDeTurmas() {
        if (!ehPaginaTurmas()) return false;
        try {
            // Compara a forma decodificada para tolerar %3f/%3F e %2c/%2C.
            return decodeURIComponent(window.location.search).toLowerCase() ===
                '?0,0,0,0,9,hwmgrhlotturma.aspx?0,0,0,0';
        } catch {
            return window.location.search.toLowerCase() === QUERY_TURMAS_COMPLETA.toLowerCase();
        }
    }

    function navegarParaTelaCompletaDaFerramenta() {
        // Mantém o protocolo efetivamente aceito pelo navegador/servidor para
        // evitar loop caso a instalação redirecione HTTP para HTTPS, mas força
        // exatamente os parâmetros posicionais necessários para montar a grade.
        const destino = `${window.location.origin}/ged/hwmgrhturma.aspx${QUERY_TURMAS_COMPLETA}${HASH_FERRAMENTA}`;
        window.location.replace(destino);
    }

    // A tela simples hwmgrhturma.aspx não monta os links arralunossituacao.
    // A ferramenta só inicia sobre a rota completa usada pelo SIGEDUCA.
    if (ehRotaFerramenta() && !temParametrosCompletosDaTelaDeTurmas()) {
        navegarParaTelaCompletaDaFerramenta();
        return;
    }

    // Se o usuário já estiver na página de turmas e clicar no módulo, o browser
    // pode alterar apenas o hash. Primeiro garantimos a URL completa; se ela já
    // estiver correta, recarregamos para iniciar sobre uma árvore GeneXus limpa.
    window.addEventListener('hashchange', () => {
        if (!ehRotaFerramenta()) return;
        if (!temParametrosCompletosDaTelaDeTurmas()) {
            navegarParaTelaCompletaDaFerramenta();
            return;
        }
        if (!document.getElementById('painel-lote-sigeduca')) {
            window.location.reload();
        }
    });

    // Padrões de Link atualizados
    const urlWebAppPadrao = "";
    const urlPlanilhaPadrao = "";
    const CHAVE_TURMAS_LOCAL = 'sigeduca_turmas_mapeadas';
    const VERSAO_CACHE_TURMAS = 1;

    // Checkpoint da execução em lote (v3.6)
    // Chave nova para não reaproveitar checkpoints antigos que poderiam conter
    // associações de turma originadas de TRANSFERIDO DA TURMA.
    const CHAVE_CHECKPOINT_LOTE = 'sigeduca_checkpoint_lote_v42_turmas_only';
    const CHAVE_RETOMADA_AUTOMATICA = 'sigeduca_retomada_automatica_v35';
    const VERSAO_CHECKPOINT = 1;

    // Tolerância a quedas/lentidão do Sigeduca e do WebApp
    const TIMEOUT_PAGINA_ALUNO_MS = 25000;
    const ESPERA_ENTRE_ALUNOS_MS = 300;
    const TAMANHO_LOTE_DADOS_ALUNOS = 20;
    const MAX_TENTATIVAS_REDE = 4;
    const ESPERA_RETRY_MS = 5000;
    const ESPERA_RETOMADA_APOS_QUEDA_MS = 60000;
    const TIMEOUT_WEBAPP_MS = 120000;

    let urlWebapp = localStorage.getItem('sigeduca_url_webapp') || urlWebAppPadrao;
    let urlPlanilha = localStorage.getItem('sigeduca_url_planilha') || urlPlanilhaPadrao;

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // Utilitários
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    function isNotificationHidden(docObject) {
        var notification = docObject.getElementById('gx_ajax_notification');
        if (notification) return docObject.defaultView.getComputedStyle(notification).getPropertyValue('display') === 'none';
        return true;
    }

    let situacoesConhecidas = [
        "AFASTADO POR ABANDONO", "DEPENDENTE", "AFASTADO POR DESISTÊNCIA", "MATRICULADO",
        "MATRÍCULA EXTRAORDINÁRIA", "MATRÍCULA DE PROGRESSÃO PARCIAL", "RECLASSIFICADO",
        "TRANSFERIDO DA TURMA", "TRANSFERIDO DA ESCOLA", "TRANSF. ESCOLA - DEPENDENTE",
        "TRANSF. ESCOLA - MAT. PROGRE. PARC.", "TRANSF. ESCOLA - MAT. EXTRAORD.", "ÓBITO",
        "MATRICULA CANCELADA", "MATRICULA ESTORNADA", "TRANSFERÊNCIA CANCELADA",
        "TRANSFERÊNCIA ESTORNADA", "RECLASSIFICAÇÃO CANCELADA", "RECLASSIFICAÇÃO ESTORNADA",
        "MATRÍCULA PENDENTE", "SUPERADO", "SUPERAÇÃO ESTORNADA", "SUPERAÇÃO CANCELADA",
        "RESERVA DE MATRÍCULA", "AFASTADO C.H. COMPONENTE CURRICULAR"
    ];
    situacoesConhecidas.sort((a, b) => b.length - a.length);

    let turmasMapeadas = [];
    let isRodando = false;
    let isAtualizandoTurmas = false;
    let observadorPainelLote = null;
    let timerRecriarPainelLote = null;
    let retomadaAutomatica = localStorage.getItem(CHAVE_RETOMADA_AUTOMATICA) !== '0';

    function normalizarUrlTurma(urlEncontrada) {
        if (!urlEncontrada) return '';

        try {
            const urlSemEscapeHtml = String(urlEncontrada)
                .replace(/&amp;/gi, '&')
                .replace(/['");\\]+$/, '');
            return new URL(urlSemEscapeHtml, `${window.location.origin}/ged/`).href;
        } catch (erro) {
            console.warn('[Sigeduca] Não foi possível normalizar a URL da turma:', urlEncontrada, erro);
            return '';
        }
    }

    function salvarTurmasLocalmente(turmas) {
        const payload = {
            versao: VERSAO_CACHE_TURMAS,
            atualizadoEm: new Date().toISOString(),
            origem: window.location.origin,
            paginaMapeamento: window.location.href,
            total: turmas.length,
            turmas: turmas.map(({ nome, turno, url }) => ({ nome, turno, url }))
        };

        localStorage.setItem(CHAVE_TURMAS_LOCAL, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('sigeduca:turmas-atualizadas', { detail: payload }));
        return payload;
    }

    function exportarLinksDasTurmas() {
        if (isAtualizandoTurmas) {
            return alert('Aguarde a atualização das turmas terminar antes de exportar.');
        }
        const selecionadas = obterTurmasSelecionadasNoPainel();
        if (!selecionadas.length) {
            return alert('Marque pelo menos uma turma para exportar os links.');
        }

        // Usa a mesma seleção das demais ações do painel.
        const payload = {
            versao: VERSAO_CACHE_TURMAS,
            exportadoEm: new Date().toISOString(),
            total: selecionadas.length,
            turmas: selecionadas.map(({ nome, turno, url }) => ({ nome, turno, url }))
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const urlArquivo = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = urlArquivo;
        link.download = `sigeduca-turmas-${payload.exportadoEm.slice(0, 10)}.json`;
        document.body.appendChild(link);
        try {
            link.click();
            addLog(`📥 Exportação de ${payload.total} turmas solicitada. Confira o arquivo nos downloads.`, '#007bff');
        } finally {
            link.remove();
            setTimeout(() => URL.revokeObjectURL(urlArquivo), 10000);
        }
    }

    function carregarTurmasLocais() {
        try {
            const conteudoSalvo = localStorage.getItem(CHAVE_TURMAS_LOCAL);
            if (!conteudoSalvo) return null;

            const payload = JSON.parse(conteudoSalvo);
            if (!payload || !Array.isArray(payload.turmas)) return null;

            const urlsEncontradas = new Set();
            const turmasValidas = payload.turmas.reduce((lista, turma) => {
                const url = normalizarUrlTurma(turma?.url);
                if (!url || urlsEncontradas.has(url)) return lista;

                urlsEncontradas.add(url);
                lista.push({
                    nome: String(turma?.nome || 'TURMA DESCONHECIDA').trim(),
                    turno: String(turma?.turno || 'DESCONHECIDO').trim(),
                    url
                });
                return lista;
            }, []);

            if (turmasValidas.length === 0) return null;
            return { ...payload, total: turmasValidas.length, turmas: turmasValidas };
        } catch (erro) {
            console.warn('[Sigeduca] O cache local de turmas está inválido e foi ignorado.', erro);
            return null;
        }
    }

    // =========================
    // CHECKPOINT / RETOMADA AUTOMÁTICA
    // =========================

    function criarCheckpointSheets(turmas) {
        const agora = new Date().toISOString();
        return {
            versao: VERSAO_CHECKPOINT,
            acao: 'sheets',
            etapa: 'turmas',
            status: 'executando',
            criadoEm: agora,
            atualizadoEm: agora,
            turmas: turmas.map(t => ({ nome: t.nome, turno: t.turno, url: t.url })),
            turmasConcluidas: [],
            ultimaTurma: '',
            erroUltimo: ''
        };
    }

    function salvarCheckpoint(checkpoint) {
        if (!checkpoint || checkpoint.acao !== 'sheets') return;
        checkpoint.atualizadoEm = new Date().toISOString();
        localStorage.setItem(CHAVE_CHECKPOINT_LOTE, JSON.stringify(checkpoint));
        atualizarPainelCheckpoint();
    }

    function carregarCheckpoint() {
        try {
            const bruto = localStorage.getItem(CHAVE_CHECKPOINT_LOTE);
            if (!bruto) return null;
            const checkpoint = JSON.parse(bruto);
            if (!checkpoint || checkpoint.versao !== VERSAO_CHECKPOINT || checkpoint.acao !== 'sheets') return null;
            if (!Array.isArray(checkpoint.turmas) || checkpoint.turmas.length === 0) return null;
            return checkpoint;
        } catch (erro) {
            console.warn('[Sigeduca] Checkpoint inválido. Ele será descartado.', erro);
            localStorage.removeItem(CHAVE_CHECKPOINT_LOTE);
            return null;
        }
    }

    function limparCheckpoint() {
        localStorage.removeItem(CHAVE_CHECKPOINT_LOTE);
        atualizarPainelCheckpoint();
    }

    function resumoCheckpoint(checkpoint) {
        const totalTurmas = checkpoint?.turmas?.length || 0;
        const concluidas = checkpoint?.turmasConcluidas?.length || 0;
        return `Turmas ${concluidas}/${totalTurmas}`;
    }

    function atualizarPainelCheckpoint() {
        const caixa = document.getElementById('checkpoint-lote-box');
        const texto = document.getElementById('checkpoint-lote-resumo');
        if (!caixa || !texto) return;

        const checkpoint = carregarCheckpoint();
        if (!checkpoint) {
            caixa.style.display = 'none';
            return;
        }

        caixa.style.display = 'block';
        const data = checkpoint.atualizadoEm
            ? new Date(checkpoint.atualizadoEm).toLocaleString('pt-BR')
            : 'data desconhecida';
        texto.textContent = `Processo pendente • ${resumoCheckpoint(checkpoint)} • salvo em ${data}`;
    }

    function definirRetomadaAutomatica(valor) {
        retomadaAutomatica = Boolean(valor);
        localStorage.setItem(CHAVE_RETOMADA_AUTOMATICA, retomadaAutomatica ? '1' : '0');
    }

    async function executarComTentativas(rotulo, tarefa, tentativas = MAX_TENTATIVAS_REDE) {
        let ultimoErro = null;
        for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
            try {
                return await tarefa(tentativa);
            } catch (erro) {
                ultimoErro = erro instanceof Error ? erro : new Error(String(erro));
                console.warn(`[Sigeduca] ${rotulo} - tentativa ${tentativa}/${tentativas}:`, ultimoErro);
                if (tentativa >= tentativas) break;
                const espera = ESPERA_RETRY_MS * tentativa;
                addLog(
                    `⚠️ ${rotulo} falhou: ${ultimoErro.message}. Nova tentativa ${tentativa + 1}/${tentativas} em ${Math.round(espera / 1000)}s...`,
                    '#ff9800'
                );
                await delay(espera);
            }
        }
        throw ultimoErro || new Error(`${rotulo} falhou.`);
    }

    function validarRespostaWebApp(response, contexto) {
        if (!response) throw new Error(`${contexto}: resposta vazia do WebApp.`);
        if (response.status && (response.status < 200 || response.status >= 400)) {
            throw new Error(`${contexto}: HTTP ${response.status}.`);
        }

        const texto = String(response.responseText || '').trim();
        if (!texto) {
            throw new Error(`${contexto}: o WebApp respondeu sem JSON de confirmação.`);
        }

        let json;
        try {
            json = JSON.parse(texto);
        } catch (erro) {
            console.error(`[Sigeduca] ${contexto} - resposta não JSON:`, texto.slice(0, 500));
            throw new Error(`${contexto}: o WebApp não retornou JSON válido. A gravação NÃO será marcada como concluída.`);
        }

        if (json?.status === 'erro' || json?.ok === false) {
            throw new Error(json?.mensagem || `${contexto}: o WebApp retornou erro.`);
        }

        // Para os módulos atuais, só aceitamos confirmação explícita. Isso impede
        // que uma página HTML/login/erro do Google seja confundida com gravação concluída.
        const confirmou = json?.status === 'sucesso' || json?.ok === true;
        if (!confirmou) {
            throw new Error(`${contexto}: resposta recebida, mas sem confirmação explícita de sucesso.`);
        }

        console.log(`[Sigeduca] ${contexto} confirmado pelo WebApp:`, json);
        return json;
    }

    function hashOperacao(texto) {
        let hash = 2166136261;
        const valor = String(texto || '');
        for (let i = 0; i < valor.length; i++) {
            hash ^= valor.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function gerarIdOperacaoRelacao(checkpoint, turma) {
        const base = [
            checkpoint?.criadoEm || 'sem-checkpoint',
            turma?.url || '',
            turma?.nome || '',
            turma?.turno || ''
        ].join('|');
        return `REL_${hashOperacao(base)}`;
    }

    function marcarCheckpointInterrompido(checkpoint, erro) {
        if (!checkpoint) return;
        checkpoint.status = 'interrompido';
        checkpoint.erroUltimo = String(erro?.message || erro || 'Falha desconhecida');
        salvarCheckpoint(checkpoint);
    }

    function retomarProcessoSalvo() {
        const checkpoint = carregarCheckpoint();
        if (!checkpoint) {
            atualizarPainelCheckpoint();
            return alert('Não existe processo pendente para retomar.');
        }
        document.getElementById('acao-lote').value = 'sheets';
        iniciarProcessoLote({ retomar: true, checkpoint });
    }

    function agendarRetomadaAutomatica() {
        const checkpoint = carregarCheckpoint();
        if (!checkpoint || !retomadaAutomatica || isRodando) return;

        addLog(`🔄 Checkpoint encontrado. Retomada automática em 4 segundos: ${resumoCheckpoint(checkpoint)}.`, '#6f42c1');
        setTimeout(() => {
            if (!isRodando && carregarCheckpoint()) retomarProcessoSalvo();
        }, 4000);
    }

    function renderizarTurmasMapeadas(mensagemStatus) {
        const status = document.getElementById('status-mapeamento');
        const containerLista = document.getElementById('lista-turmas-lote');
        const btnIniciar = document.getElementById('btn-iniciar-lote');
        if (!status || !containerLista || !btnIniciar) return;

        if (turmasMapeadas.length === 0) {
            containerLista.style.display = 'none';
            status.innerHTML = `❌ Nenhuma URL de relatório encontrada na tela.`;
            status.style.color = "#d9534f";
            btnIniciar.disabled = true;
            btnIniciar.style.opacity = "0.5";
            return;
        }

        status.textContent = mensagemStatus || `✅ ${turmasMapeadas.length} links capturados!`;
        status.style.color = "#28a745";

        let htmlLista = `
            <label style="display:block; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px; cursor:pointer;">
                <input type="checkbox" id="chk-todas-turmas" checked> Selecionar Todas
            </label>
        `;

        turmasMapeadas.forEach((t, i) => {
            htmlLista += `
                <label style="display:block; margin-bottom:4px; cursor:pointer; color:#444;">
                    <input type="checkbox" class="chk-turma-item" value="${i}" checked>
                    ${t.nome} (${t.turno})
                </label>
            `;
        });

        containerLista.innerHTML = htmlLista;
        containerLista.style.display = 'block';

        document.getElementById('chk-todas-turmas').addEventListener('change', (e) => {
            document.querySelectorAll('.chk-turma-item').forEach(chk => chk.checked = e.target.checked);
        });

        btnIniciar.disabled = false;
        btnIniciar.style.opacity = "1";
    }

    function restaurarTurmasSalvasNoPainel() {
        const cache = carregarTurmasLocais();
        if (!cache) return;

        turmasMapeadas = cache.turmas;
        const dataCache = cache.atualizadoEm
            ? new Date(cache.atualizadoEm).toLocaleString('pt-BR')
            : 'data desconhecida';
        renderizarTurmasMapeadas(`💾 ${turmasMapeadas.length} turmas locais (${dataCache})`);
    }

    // =====================================================================
    // MORPH DA TELA NATIVA DE TURMAS
    // =====================================================================
    function ocultarTrQueContem(elemento) {
        const tr = elemento?.closest?.('tr');
        if (!tr) return false;
        if (tr.dataset.sigeducaLoteOculto === '1' && tr.style.display === 'none') {
            return true;
        }
        tr.dataset.sigeducaLoteOculto = '1';
        tr.style.setProperty('display', 'none', 'important');
        return true;
    }

    function ocultarEstruturasNativasDaTela() {
        if (!ehRotaFerramenta()) return;

        // Mantemos os elementos no DOM porque o GeneXus e o módulo ainda
        // precisam do grid, do select de turno e do BCONSULTAR. Só escondemos
        // as TRs que os exibem para o usuário.
        ocultarTrQueContem(document.getElementById('TABLE10'));
        ocultarTrQueContem(document.getElementById('GridfreestyleContainerTbl'));
    }

    function ajaxGeneXusEmAndamento() {
        const notification = document.getElementById('gx_ajax_notification');
        if (!notification) return false;
        try {
            const estilo = window.getComputedStyle(notification);
            return estilo.display !== 'none' &&
                   estilo.visibility !== 'hidden' &&
                   Number(estilo.opacity || '1') !== 0;
        } catch {
            return notification.style.display !== 'none';
        }
    }

    function assinaturaGradeTurmas() {
        const grid = document.getElementById('GridfreestyleContainerTbl');
        if (!grid) return 'sem-grid';
        const linhasTurma = grid.querySelectorAll('[id^="span_vGERTURSAL_"]').length;
        const links = (grid.innerHTML.match(/arralunossituacao\.aspx\?/gi) || []).length;
        const tamanho = grid.innerHTML.length;
        return `${linhasTurma}|${links}|${tamanho}`;
    }

    async function aguardarConsultaGeneXus(assinaturaAntes, timeoutMs = 45000) {
        const inicio = Date.now();
        let viuAjax = false;
        let mudouGrade = false;
        let assinaturaEstavel = '';
        let desdeEstavel = Date.now();

        while (Date.now() - inicio < timeoutMs) {
            const ajax = ajaxGeneXusEmAndamento();
            if (ajax) viuAjax = true;

            const assinaturaAtual = assinaturaGradeTurmas();
            if (assinaturaAtual !== assinaturaAntes && assinaturaAtual !== 'sem-grid') {
                mudouGrade = true;
            }

            if (assinaturaAtual !== assinaturaEstavel) {
                assinaturaEstavel = assinaturaAtual;
                desdeEstavel = Date.now();
            }

            // Fluxo normal GeneXus: vimos o indicador de AJAX e ele terminou.
            if (viuAjax && !ajax && assinaturaAtual !== 'sem-grid') {
                await delay(250);
                return;
            }

            // Fallback: a grade efetivamente foi redesenhada e permaneceu estável.
            if (!ajax && mudouGrade && Date.now() - desdeEstavel >= 450) {
                return;
            }

            // Em algumas versões o indicador AJAX não aparece visualmente.
            // Nesse caso aceitamos a grade estável depois de um tempo mínimo.
            if (!ajax && assinaturaAtual !== 'sem-grid' &&
                Date.now() - inicio >= 2500 && Date.now() - desdeEstavel >= 700) {
                return;
            }

            await delay(100);
        }

        throw new Error('Tempo esgotado aguardando o SIGEDUCA atualizar a lista de turmas.');
    }

    function selecionarTodosOsTurnos() {
        const selectTurno = document.getElementById('vGRHTRNCOD');
        if (!selectTurno) {
            throw new Error('Não encontrei o seletor de turno vGRHTRNCOD.');
        }

        const opcaoTodos = Array.from(selectTurno.options || [])
            .find(opcao => String(opcao.value) === '0');
        if (!opcaoTodos) {
            throw new Error('A opção “Todos” (value 0) não existe no seletor de turno.');
        }

        selectTurno.value = '0';
        opcaoTodos.selected = true;

        // Dispara os mesmos eventos que o controle GeneXus receberia pela UI.
        selectTurno.dispatchEvent(new Event('input', { bubbles: true }));
        selectTurno.dispatchEvent(new Event('change', { bubbles: true }));
        selectTurno.dispatchEvent(new Event('blur', { bubbles: true }));

        return selectTurno;
    }

    function clicarConsultarTurmas() {
        const btnConsultar = document.querySelector('input[name="BCONSULTAR"]')
            || document.getElementById('BCONSULTAR')
            || document.querySelector('.btnConsultar');

        if (!btnConsultar) {
            throw new Error('Não encontrei o botão Consultar (BCONSULTAR).');
        }

        btnConsultar.click();
        return btnConsultar;
    }

    function criarPainelLote() {
        if (!ehRotaFerramenta()) return;
        if (document.getElementById('painel-lote-sigeduca')) return;

        ocultarEstruturasNativasDaTela();

        const painel = document.createElement('div');
        painel.id = 'painel-lote-sigeduca';
        painel.style = "position:relative; z-index:20; background:#f8f9fa; border:1px solid #9aa7b4; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.16); font-family:Verdana,Arial,sans-serif; width:780px; max-width:calc(100% - 20px); margin:14px auto 20px; overflow:hidden; box-sizing:border-box; font-size:11px;";

        const trilho = document.createElement('div');
        trilho.id = 'trilho-slider-lote';
        trilho.style = "display:flex; width:1560px; transition:transform 0.3s ease-in-out;";

        const telaPrincipal = document.createElement('div');
        telaPrincipal.style = "width:780px; padding:14px 18px; box-sizing:border-box; position:relative;";

        // Nova div "lista-turmas-lote" adicionada abaixo do mapeamento
        telaPrincipal.innerHTML = `
            <div id="btn-engrenagem-lote" style="position: absolute; top: 12px; right: 15px; cursor: pointer; font-size: 18px;" title="Configurações">⚙️</div>
            <h4 style="margin:0 0 8px 0; color:#065195; font-size:13px; text-align:center;">Ações em Lote (Turmas)</h4>
            <p style="font-size:10px; color:#555; text-align:center; margin-bottom:12px;">Clique em Atualizar Turmas. O módulo selecionará automaticamente todos os turnos, consultará o SIGEDUCA e carregará a lista atualizada.</p>

            <button type="button" id="btn-mapear" style="width: 100%; padding: 8px; margin-bottom: 10px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">1. Atualizar Turmas</button>
            <div id="status-mapeamento" style="font-size: 12px; font-weight: bold; color: #333; text-align: center; margin-bottom: 5px; min-height: 15px;"></div>

            <div id="lista-turmas-lote" style="display:none; max-height:170px; overflow-y:auto; background:#fff; border:1px solid #ccc; border-radius:3px; padding:7px; margin-bottom:8px; font-size:11px; text-align:left;"></div>

            <button type="button" id="btn-exportar-links-lote" style="width:100%; padding:8px; margin-bottom:10px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;" title="Baixa um arquivo com nome, turno e link somente das turmas marcadas.">📥 Exportar links das turmas marcadas</button>

            <div id="checkpoint-lote-box" style="display:none; background:#fff3cd; border:1px solid #ffe69c; border-radius:4px; padding:8px; margin-bottom:10px; font-size:10px; color:#664d03;">
                <div style="font-weight:bold; margin-bottom:5px;">💾 Retomada disponível</div>
                <div id="checkpoint-lote-resumo" style="line-height:1.35; margin-bottom:7px;"></div>
                <div style="display:flex; gap:6px;">
                    <button type="button" id="btn-retomar-checkpoint" style="flex:1; padding:6px; border:none; border-radius:3px; background:#6f42c1; color:white; cursor:pointer; font-weight:bold;">▶ Retomar</button>
                    <button type="button" id="btn-descartar-checkpoint" style="padding:6px 8px; border:none; border-radius:3px; background:#dc3545; color:white; cursor:pointer; font-weight:bold;">Descartar</button>
                </div>
            </div>

            <label style="display:block; font-size:10px; color:#555; margin:0 0 8px 0; cursor:pointer;">
                <input type="checkbox" id="chk-retomada-automatica" ${retomadaAutomatica ? 'checked' : ''}>
                Retomar automaticamente após recarregar a página
            </label>

            <select id="acao-lote" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                <option value="imprimir">🖨️ Gerar Impressão Manual</option>
                <option value="sheets">🚀 Enviar Turmas p/ Planilha</option>
                <option value="atestados">🩺 Extrair Atestados p/ Planilha</option>
                <option value="dados_pessoais">👤 Enviar Dados Pessoais p/ Planilha</option>
                <option value="copiar_codigos">📋 Copiar códigos dos alunos</option>
            </select>

            <button type="button" id="btn-iniciar-lote" style="width: 100%; padding: 12px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; opacity: 0.5;" disabled>2. Iniciar Processo 🚀</button>

            <textarea id="codigos-copiados-lote" readonly
                style="display:none; width:100%; height:90px; margin:8px 0 0 0; box-sizing:border-box; resize:vertical; font:11px Consolas,monospace;"
                title="Códigos coletados"></textarea>

            <button type="button" id="btn-abrir-planilha-lote" style="display: block; width: 100%; padding: 10px; margin-top: 10px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; text-align: center; text-decoration: none; box-sizing: border-box; transition: background 0.3s;">📂 Abrir Planilha Online</button>

            <div id="log-lote" style="margin-top: 15px; font-size: 10px; color: #28a745; max-height: 150px; overflow-y: auto; border-top: 1px solid #ddd; padding-top: 5px; font-family: monospace;"></div>
        `;

        const telaConfig = document.createElement('div');
        telaConfig.style = "width:780px; padding:14px 18px; box-sizing:border-box; position:relative; background:#ececec;";
        telaConfig.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #d9534f; font-size: 13px; text-align: center; font-weight: bold;">⚠️ Configurações de Link</h4>

            <label style="font-size: 11px; font-weight: bold; color: #333;">Link da Implantação (Apps Script):</label>
            <input type="text" id="input-webapp-lote" value="${urlWebapp}" style="width: 100%; padding: 6px; margin-bottom: 10px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">

            <label style="font-size: 11px; font-weight: bold; color: #333;">Link da Planilha (Para visualização):</label>
            <input type="text" id="input-planilha-lote" value="${urlPlanilha}" style="width: 100%; padding: 6px; margin-bottom: 15px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">

            <div style="display: flex; gap: 10px;">
                <button type="button" id="btn-voltar-lote" style="flex: 1; padding: 8px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Voltar</button>
                <button type="button" id="btn-salvar-config-lote" style="flex: 1; padding: 8px; background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Salvar</button>
            </div>
        `;

        trilho.appendChild(telaPrincipal);
        trilho.appendChild(telaConfig);
        painel.appendChild(trilho);

        // Integra a ferramenta à própria página de turmas, sem remover a tela
        // nativa. O usuário continua filtrando/consultando as turmas normalmente.
        const ancora = document.getElementById('TABLE4')
            || document.getElementById('GriddetalhesContainerDiv')
            || document.querySelector('#MAINFORM > table:last-of-type');

        if (ancora?.parentNode) {
            ancora.insertAdjacentElement('afterend', painel);
        } else {
            (document.getElementById('MAINFORM') || document.body).appendChild(painel);
        }

        document.title = 'Ações em Lote - SIGEDUCA';
        const tituloPagina = document.getElementById('TTITULO');
        if (tituloPagina) tituloPagina.textContent = 'Ações em Lote (Turmas)';

        document.getElementById('btn-engrenagem-lote').onclick = () => { trilho.style.transform = "translateX(-780px)"; };
        document.getElementById('btn-voltar-lote').onclick = () => { trilho.style.transform = "translateX(0)"; };

        document.getElementById('btn-abrir-planilha-lote').onclick = () => {
            if (!urlPlanilha) return alert("Nenhum link de planilha configurado.");
            window.open(urlPlanilha, '_blank');
        };

        document.getElementById('btn-salvar-config-lote').onclick = () => {
            const novoWebapp = document.getElementById('input-webapp-lote').value.trim();
            const novaPlanilha = document.getElementById('input-planilha-lote').value.trim();

            localStorage.setItem('sigeduca_url_webapp', novoWebapp);
            localStorage.setItem('sigeduca_url_planilha', novaPlanilha);
            urlWebapp = novoWebapp;
            urlPlanilha = novaPlanilha;

            alert("Configurações salvas com sucesso no seu navegador!");
            trilho.style.transform = "translateX(0)";
        };

        document.getElementById('btn-mapear').onclick = atualizarTurmas;
        document.getElementById('btn-exportar-links-lote').onclick = exportarLinksDasTurmas;
        document.getElementById('btn-iniciar-lote').onclick = () => executarAcaoLoteSelecionada();
        document.getElementById('acao-lote').addEventListener('change', atualizarTextoBotaoAcao);
        document.getElementById('btn-retomar-checkpoint').onclick = retomarProcessoSalvo;
        document.getElementById('btn-descartar-checkpoint').onclick = () => {
            if (confirm('Descartar o checkpoint salvo? O próximo processo começará do início.')) {
                limparCheckpoint();
            }
        };
        document.getElementById('chk-retomada-automatica').addEventListener('change', (e) => {
            definirRetomadaAutomatica(e.target.checked);
        });

        restaurarTurmasSalvasNoPainel();
        atualizarPainelCheckpoint();
        atualizarTextoBotaoAcao();
        setTimeout(agendarRetomadaAutomatica, 800);

        // Algumas ações GeneXus podem redesenhar trechos da página. Se o painel
        // integrado for removido por um refresh parcial, recriamos sem tocar
        // nos controles nativos da tela.
        if (!observadorPainelLote && document.body) {
            observadorPainelLote = new MutationObserver(() => {
                if (!ehRotaFerramenta()) return;

                // O AJAX do GeneXus pode substituir tanto os filtros quanto a grade.
                // Toda vez que isso ocorrer, escondemos novamente apenas as TRs visuais.
                ocultarEstruturasNativasDaTela();

                if (document.getElementById('painel-lote-sigeduca')) return;
                clearTimeout(timerRecriarPainelLote);
                timerRecriarPainelLote = setTimeout(criarPainelLote, 120);
            });
            observadorPainelLote.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    function addLog(msg, cor = "#333", id = null) {
        const logDiv = document.getElementById('log-lote');
        if (id) {
            let exist = document.getElementById(id);
            if (exist) {
                exist.innerHTML = `• ${msg}`;
                exist.style.color = cor;
                return;
            }
        }
        const newLine = document.createElement('div');
        newLine.style.color = cor;
        newLine.style.marginBottom = "5px";
        if (id) newLine.id = id;
        newLine.innerHTML = `• ${msg}`;
        logDiv.prepend(newLine);
    }

    function coletarTurmasDaGrade() {
        turmasMapeadas = [];

        const grid = document.getElementById('GridfreestyleContainerTbl');
        const escopo = grid || document;
        const trs = escopo.querySelectorAll('tr');

        trs.forEach(tr => {
            const htmlLinha = tr.innerHTML || '';
            const match = htmlLinha.match(/(arralunossituacao\.aspx\?[^"'\s>]+)/i);

            if (!match) return;

            const urlCompleta = normalizarUrlTurma(match[1]);
            const spanNome = tr.querySelector('[id^="span_vGERTURSAL_"]');
            const nome = spanNome ? spanNome.innerText.trim() : 'TURMA DESCONHECIDA';

            if (!urlCompleta || !nome || nome.toUpperCase() === 'NOME DA TURMA') return;

            let turno = 'DESCONHECIDO';
            const textoTr = String(tr.innerText || '').toUpperCase();
            if (textoTr.includes('MATUTINO')) turno = 'MATUTINO';
            else if (textoTr.includes('VESPERTINO')) turno = 'VESPERTINO';
            else if (textoTr.includes('NOTURNO')) turno = 'NOTURNO';
            else if (textoTr.includes('INTEGRAL')) turno = 'INTEGRAL';

            if (!turmasMapeadas.some(t => t.url === urlCompleta)) {
                turmasMapeadas.push({ nome, turno, url: urlCompleta });
            }
        });

        if (turmasMapeadas.length > 0) {
            try {
                salvarTurmasLocalmente(turmasMapeadas);
                renderizarTurmasMapeadas(
                    `✅ ${turmasMapeadas.length} turma(s) atualizada(s) e salva(s) localmente!`
                );
            } catch (erro) {
                console.error('[Sigeduca] Falha ao salvar as turmas localmente.', erro);
                renderizarTurmasMapeadas(
                    `⚠️ ${turmasMapeadas.length} turma(s) carregada(s), mas não foi possível salvar o cache.`
                );
            }
        } else {
            renderizarTurmasMapeadas();
        }

        return turmasMapeadas;
    }

    async function atualizarTurmas() {
        if (isAtualizandoTurmas) return;
        if (isRodando) {
            return alert('Aguarde o processo em lote atual terminar.');
        }

        const btn = document.getElementById('btn-mapear');
        const status = document.getElementById('status-mapeamento');
        const textoOriginal = btn?.textContent || '1. Atualizar Turmas';

        try {
            isAtualizandoTurmas = true;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ Atualizando turmas...';
                btn.style.opacity = '0.75';
            }
            if (status) {
                status.textContent = 'Selecionando todos os turnos e consultando o SIGEDUCA...';
                status.style.color = '#555';
            }

            // Os filtros ficam ocultos para o usuário, mas permanecem funcionais.
            selecionarTodosOsTurnos();
            await delay(100);

            const assinaturaAntes = assinaturaGradeTurmas();
            clicarConsultarTurmas();

            await aguardarConsultaGeneXus(assinaturaAntes);

            // O refresh do GeneXus pode recriar as TRs nativas.
            ocultarEstruturasNativasDaTela();

            const encontradas = coletarTurmasDaGrade();
            if (!encontradas.length) {
                throw new Error('A consulta terminou, mas nenhuma turma com link de alunos foi encontrada.');
            }

            addLog(`🔄 Lista atualizada: ${encontradas.length} turma(s), consultando todos os turnos.`, '#28a745');
        } catch (erro) {
            console.error('[Sigeduca] Falha ao atualizar turmas:', erro);
            turmasMapeadas = [];
            renderizarTurmasMapeadas();
            if (status) {
                status.textContent = `❌ ${erro?.message || erro}`;
                status.style.color = '#d9534f';
            }
            alert(`Não foi possível atualizar as turmas.\n\n${erro?.message || erro}`);
        } finally {
            isAtualizandoTurmas = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = textoOriginal;
                btn.style.opacity = '1';
            }
        }
    }


    function atualizarTextoBotaoAcao() {
        const btn = document.getElementById('btn-iniciar-lote');
        const seletor = document.getElementById('acao-lote');
        if (!btn || !seletor || isRodando) return;

        const rotulos = {
            imprimir: '2. Gerar Impressão 🖨️',
            sheets: '2. Enviar Turmas 🚀',
            atestados: '2. Extrair Atestados 🩺',
            dados_pessoais: '2. Enviar Dados Pessoais 👤',
            copiar_codigos: '2. Copiar Códigos 📋'
        };
        btn.textContent = rotulos[seletor.value] || '2. Iniciar Processo 🚀';
    }

    function executarAcaoLoteSelecionada() {
        const acao = document.getElementById('acao-lote')?.value || '';
        if (acao === 'copiar_codigos') {
            return copiarCodigosDasTurmasSelecionadas();
        }
        return iniciarProcessoLote({ retomar: false });
    }

    function obterTurmasSelecionadasNoPainel() {
        const checkboxes = Array.from(
            document.querySelectorAll('.chk-turma-item:checked')
        );

        return checkboxes
            .map(chk => turmasMapeadas[Number(chk.value)])
            .filter(Boolean);
    }

    async function copiarTextoParaAreaTransferencia(texto) {
        const valor = String(texto || '');
        if (!valor) throw new Error('Não há códigos para copiar.');

        // Primeiro tenta a API moderna.
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(valor);
                return true;
            }
        } catch (erro) {
            console.debug('[Sigeduca] Clipboard API indisponível. Tentando fallback.', erro);
        }

        // Fallback para navegadores/políticas que bloqueiam navigator.clipboard
        // depois das requisições assíncronas dos PDFs.
        const area = document.getElementById('codigos-copiados-lote');
        if (!area) throw new Error('Campo auxiliar de cópia não encontrado.');

        area.style.display = 'block';
        area.value = valor;
        area.focus();
        area.select();
        area.setSelectionRange(0, area.value.length);

        const copiou = document.execCommand?.('copy');
        if (!copiou) {
            throw new Error('O navegador bloqueou a cópia automática. Os códigos ficaram selecionados no campo para Ctrl+C.');
        }

        return true;
    }

    async function copiarCodigosDasTurmasSelecionadas() {
        if (isRodando) {
            return alert('Aguarde o processo em lote atual terminar.');
        }

        const turmasSelecionadas = obterTurmasSelecionadasNoPainel();
        if (!turmasSelecionadas.length) {
            return alert('⚠️ Selecione pelo menos uma turma.');
        }

        const btn = document.getElementById('btn-iniciar-lote');
        const area = document.getElementById('codigos-copiados-lote');
        const textoOriginalBotao = btn?.textContent || '2. Copiar Códigos 📋';

        const codigos = [];
        const vistos = new Set();
        let totalOcorrencias = 0;

        try {
            isRodando = true;
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.75';
            }
            if (area) {
                area.style.display = 'none';
                area.value = '';
            }

            addLog(
                `📋 Coletando códigos de ${turmasSelecionadas.length} turma(s) selecionada(s)...`,
                '#065195',
                'log-copiar-codigos'
            );

            for (let i = 0; i < turmasSelecionadas.length; i++) {
                const turma = turmasSelecionadas[i];

                if (btn) {
                    btn.textContent = `⏳ ${i + 1}/${turmasSelecionadas.length} — ${turma.nome}`;
                }

                addLog(
                    `📚 [${i + 1}/${turmasSelecionadas.length}] Lendo códigos: ${turma.nome} (${turma.turno})`,
                    '#333',
                    'log-copiar-codigos'
                );

                const alunos = await executarComTentativas(
                    `Leitura da turma ${turma.nome}`,
                    async () => {
                        const textoPdf = await baixarExtrairTextoPDF(turma.url);
                        const encontrados = processarTextoDoPdf(textoPdf);
                        if (!encontrados.length) {
                            throw new Error('Relatório vazio ou sem alunos processáveis.');
                        }
                        return encontrados;
                    }
                );

                totalOcorrencias += alunos.length;

                for (const aluno of alunos) {
                    const codigo = String(aluno?.codigo || '').trim();
                    if (!/^\d+$/.test(codigo) || vistos.has(codigo)) continue;
                    vistos.add(codigo);
                    codigos.push(codigo);
                }
            }

            if (!codigos.length) {
                throw new Error('Nenhum código de aluno foi localizado nas turmas selecionadas.');
            }

            const lista = codigos.join('\n');

            if (area) {
                area.value = lista;
            }

            await copiarTextoParaAreaTransferencia(lista);

            if (area) {
                area.style.display = 'block';
            }

            const repetidos = Math.max(0, totalOcorrencias - codigos.length);
            addLog(
                `✅ ${codigos.length} código(s) único(s) copiado(s) para a área de transferência` +
                (repetidos ? ` • ${repetidos} ocorrência(s) repetida(s) removida(s).` : '.'),
                '#28a745',
                'log-copiar-codigos'
            );

            alert(
                `${codigos.length} código(s) de aluno copiado(s) para a área de transferência.` +
                (repetidos ? `\n${repetidos} ocorrência(s) duplicada(s) foram removidas.` : '')
            );

        } catch (erro) {
            console.error('[Sigeduca] Falha ao copiar códigos das turmas:', erro);

            addLog(
                `❌ Falha ao copiar códigos: ${erro?.message || erro}`,
                '#d9534f',
                'log-copiar-codigos'
            );

            if (area?.value) {
                area.style.display = 'block';
                area.focus();
                area.select();
            }

            alert(
                `Não foi possível concluir a cópia automática.\n\n${erro?.message || erro}` +
                (area?.value ? '\n\nA lista ficou disponível e selecionada no campo para copiar manualmente.' : '')
            );
        } finally {
            isRodando = false;
            if (btn) {
                btn.textContent = textoOriginalBotao;
                btn.disabled = turmasMapeadas.length === 0;
                btn.style.opacity = turmasMapeadas.length === 0 ? '0.5' : '1';
            }
            atualizarTextoBotaoAcao();
        }
    }

    async function iniciarProcessoLote(opcoes = {}) {
        const retomar = Boolean(opcoes?.retomar);
        let checkpoint = retomar ? (opcoes?.checkpoint || carregarCheckpoint()) : null;
        const acao = retomar ? 'sheets' : document.getElementById('acao-lote').value;

        if ((acao === 'sheets' || acao === 'atestados' || acao === 'dados_pessoais') && !urlWebapp) {
            return alert("Erro: Link do Apps Script não configurado! Clique na ⚙️ para adicionar.");
        }

        let turmasSelecionadas = [];
        if (retomar) {
            if (!checkpoint) return alert('Checkpoint não encontrado.');
            turmasSelecionadas = checkpoint.turmas.map(t => ({ ...t }));
        } else {
            const checkboxes = document.querySelectorAll('.chk-turma-item:checked');
            if (checkboxes.length === 0) {
                return alert("⚠️ Selecione pelo menos uma turma na lista antes de iniciar.");
            }
            turmasSelecionadas = Array.from(checkboxes).map(chk => turmasMapeadas[chk.value]);

            // Um processo novo de Sheets substitui qualquer checkpoint antigo.
            if (acao === 'sheets') {
                checkpoint = criarCheckpointSheets(turmasSelecionadas);
                salvarCheckpoint(checkpoint);
            }
        }

        if (isRodando) return;
        isRodando = true;

        const btnIniciar = document.getElementById('btn-iniciar-lote');
        btnIniciar.innerHTML = retomar ? "🔄 Retomando..." : "⏳ Processando...";
        btnIniciar.style.background = "#ffc107";
        btnIniciar.style.color = "#333";
        btnIniciar.disabled = true;
        document.getElementById('log-lote').innerHTML = "";

        if (retomar) {
            addLog(`🔄 Retomando processo salvo: ${resumoCheckpoint(checkpoint)}.`, '#6f42c1');
        }

        const turmasConcluidas = new Set(checkpoint?.turmasConcluidas || []);
        // Nesta ação os dados pessoais são independentes do envio de turmas.
        // Primeiro consolidamos os alunos das turmas selecionadas; só depois
        // consultamos as fichas cadastrais e enviamos para DADOS ALUNOS.
        const alunosParaCadastro = acao === 'dados_pessoais' ? new Map() : null;

        let janelaImpressao = null;
        let htmlGeralImpressao = "";
        let concluiuTudo = false;

        try {
            if (acao === 'imprimir') {
                janelaImpressao = window.open('', '_blank');
                if (!janelaImpressao) throw new Error('O navegador bloqueou a nova aba de impressão. Permita pop-ups para este site.');
                janelaImpressao.document.write("<h2>⏳ Processando turmas em lote... Por favor, aguarde.</h2>");
            }

            // ==============================================================
            // ETAPA 1 - TURMAS
            // ==============================================================
            for (let i = 0; i < turmasSelecionadas.length; i++) {
                const turma = turmasSelecionadas[i];
                const chaveTurma = turma.url;

                if (acao === 'sheets' && turmasConcluidas.has(chaveTurma)) {
                    addLog(`⏭️ [${i + 1}/${turmasSelecionadas.length}] ${turma.nome} já estava concluída. Pulando.`, '#6c757d');
                    continue;
                }

                addLog(`[${i + 1}/${turmasSelecionadas.length}] Lendo: <a href="${turma.url}" target="_blank" style="color:#007bff; text-decoration:underline;">${turma.nome}</a>`, "#333");

                if (checkpoint) {
                    checkpoint.etapa = 'turmas';
                    checkpoint.status = 'executando';
                    checkpoint.ultimaTurma = turma.nome;
                    checkpoint.erroUltimo = '';
                    salvarCheckpoint(checkpoint);
                }

                const alunos = await executarComTentativas(
                    `Leitura da turma ${turma.nome}`,
                    async () => {
                        const textoPdf = await baixarExtrairTextoPDF(turma.url);
                        const encontrados = processarTextoDoPdf(textoPdf);
                        if (!encontrados.length) throw new Error('Relatório vazio ou sem alunos processáveis.');
                        return encontrados;
                    }
                );

                if (acao === 'sheets') {
                    // ==========================================================
                    // RELAÇÃO DA TURMA — único envio desta ação
                    // ==========================================================
                    // A lista é enviada completa, inclusive TRANSFERIDO DA TURMA.
                    // Esta ação NÃO consulta DADOS ALUNOS; isso agora existe como opção independente no dropdown.
                    const alunosRelacao = alunos.map(aluno => ({ ...aluno }));

                    addLog(`>> ${alunosRelacao.length} alunos extraídos. Enviando RELAÇÃO COMPLETA de ${turma.nome}...`, "#17a2b8");
                    const idOperacaoRelacao = gerarIdOperacaoRelacao(checkpoint, turma);

                    const confirmacaoRelacao = await executarComTentativas(
                        `Envio da relação ${turma.nome}`,
                        async () => validarRespostaWebApp(
                            await enviarParaSheets(
                                turma.nome,
                                turma.turno,
                                alunosRelacao,
                                idOperacaoRelacao
                            ),
                            `RELACAO ${turma.nome}`
                        )
                    );

                    addLog(
                        `✅ RELAÇÃO confirmada pelo servidor: ${confirmacaoRelacao?.mensagem || 'turma salva com sucesso.'}`,
                        "#28a745"
                    );

                    // Marca a turma como concluída somente após a confirmação do WebApp.
                    turmasConcluidas.add(chaveTurma);
                    checkpoint.turmasConcluidas = Array.from(turmasConcluidas);
                    checkpoint.ultimaTurma = turma.nome;
                    salvarCheckpoint(checkpoint);

                    addLog(`✅ Turma ${turma.nome}: relação enviada e checkpoint gravado. ${turmasConcluidas.size}/${turmasSelecionadas.length}.`, "#28a745");
                }
                else if (acao === 'imprimir') {
                    addLog(`>> ${alunos.length} alunos extraídos. Gerando página...`, "#17a2b8");
                    htmlGeralImpressao += gerarHtmlTurma(alunos, turma.nome, turma.turno);
                    addLog(`✅ Página gerada!`, "#28a745");
                }
                else if (acao === 'atestados') {
                    const logId = "log_atd_" + i;
                    addLog(`>> Preparando módulo de atestados...`, "#17a2b8", logId);
                    const atestados = await extrairAtestados(alunos, turma.nome, turma.turno, logId);

                    if (atestados.length > 0) {
                        addLog(`>> ${atestados.length} atestados coletados. Enviando...`, "#17a2b8", logId);
                        await executarComTentativas(
                            `Envio de atestados ${turma.nome}`,
                            async () => validarRespostaWebApp(await enviarAtestadosParaSheets(atestados), `ATESTADOS ${turma.nome}`)
                        );
                        addLog(`✅ ${atestados.length} atestados salvos na planilha!`, "#28a745", logId);
                    } else {
                        addLog(`✅ Nenhum atestado encontrado nesta turma.`, "#28a745", logId);
                    }
                }
                else if (acao === 'dados_pessoais') {
                    const antes = alunosParaCadastro.size;
                    const ignoradosTransferidos = consolidarAlunosParaCadastro(
                        alunosParaCadastro,
                        alunos,
                        turma
                    );
                    const adicionados = alunosParaCadastro.size - antes;

                    addLog(
                        `👤 ${turma.nome}: ${adicionados} aluno(s) novo(s) incluído(s) para consulta cadastral` +
                        (ignoradosTransferidos ? ` • ${ignoradosTransferidos} TRANSFERIDO(S) DA TURMA ignorado(s).` : '.'),
                        '#6f42c1'
                    );
                }

                if (i < turmasSelecionadas.length - 1) await delay(4000);
            }

            if (acao === 'dados_pessoais') {
                if (!alunosParaCadastro || alunosParaCadastro.size === 0) {
                    throw new Error('Nenhum aluno elegível foi localizado nas turmas selecionadas para consulta de dados pessoais.');
                }

                addLog(
                    `👤 ${alunosParaCadastro.size} aluno(s) único(s) consolidado(s). Iniciando consulta dos dados pessoais...`,
                    '#6f42c1',
                    'log-dados-alunos'
                );

                await consultarDadosAlunosParaPlanilha(alunosParaCadastro);
            }

            if (acao === 'imprimir' && janelaImpressao) {
                finalizarJanelaImpressao(janelaImpressao, htmlGeralImpressao);
            }

            concluiuTudo = true;
            if (acao === 'sheets') limparCheckpoint();

            btnIniciar.innerHTML = "🎉 Lote Concluído!";
            btnIniciar.style.background = "#28a745";
            btnIniciar.style.color = "white";
            addLog(acao === 'sheets'
                ? '🎉 Turmas enviadas com sucesso. Checkpoint removido.'
                : '🎉 Processo concluído com sucesso.', '#28a745');
        } catch (erro) {
            console.error('[Sigeduca] Processo interrompido:', erro);
            if (acao === 'sheets' && checkpoint) {
                marcarCheckpointInterrompido(checkpoint, erro);
                addLog(`⛔ Processo pausado: ${erro?.message || erro}`, '#d9534f');
                if (retomadaAutomatica) {
                    addLog(`💾 Checkpoint salvo. Nova tentativa automática em ${Math.round(ESPERA_RETOMADA_APOS_QUEDA_MS / 1000)}s.`, '#6f42c1');
                    setTimeout(() => {
                        if (!isRodando && carregarCheckpoint() && retomadaAutomatica) {
                            retomarProcessoSalvo();
                        }
                    }, ESPERA_RETOMADA_APOS_QUEDA_MS);
                } else {
                    addLog('💾 O ponto atual foi salvo. Use “Retomar” quando o Sigeduca voltar.', '#6f42c1');
                }
            } else {
                addLog(`❌ Processo interrompido: ${erro?.message || erro}`, '#d9534f');
            }
        } finally {
            isRodando = false;
            if (!concluiuTudo) resetarBotaoLote();
            else setTimeout(() => resetarBotaoLote(), 3000);
            atualizarPainelCheckpoint();
        }
    }

    function baixarExtrairTextoPDF(url) {
        return new Promise((resolve, reject) => {
            let encerrado = false;
            const req = GM_xmlhttpRequest({
                method: "GET",
                url,
                responseType: "arraybuffer",
                timeout: 30000,
                onload: async function(response) {
                    if (encerrado) return;
                    encerrado = true;
                    try {
                        if (response.status && (response.status < 200 || response.status >= 400)) {
                            throw new Error(`HTTP ${response.status} ao baixar o relatório.`);
                        }
                        const data = new Uint8Array(response.response || []);
                        if (!data.length) throw new Error('Relatório recebido sem conteúdo.');

                        const amostra = new TextDecoder('utf-8').decode(data.subarray(0, 300)).trimStart().toLowerCase();
                        if (amostra.startsWith('<!doctype') || amostra.startsWith('<html')) {
                            throw new Error('O Sigeduca devolveu HTML no lugar do PDF (possível queda/sessão expirada).');
                        }

                        const loadingTask = pdfjsLib.getDocument({ data });
                        const pdf = await loadingTask.promise;
                        let fullText = "";
                        try {
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                fullText += textContent.items.map(item => item.str).join(" ") + "\n";
                            }
                        } finally {
                            await pdf.destroy?.();
                        }
                        resolve(fullText);
                    } catch (e) {
                        reject(e instanceof Error ? e : new Error(String(e)));
                    }
                },
                ontimeout: function() {
                    if (encerrado) return;
                    encerrado = true;
                    reject(new Error('Tempo esgotado ao baixar o relatório da turma.'));
                },
                onerror: function() {
                    if (encerrado) return;
                    encerrado = true;
                    reject(new Error('Falha de rede ao baixar o relatório da turma.'));
                }
            });
        });
    }

    function processarTextoDoPdf(fullText) {
        const regexLinhaAluno = /\b(?:\d{1,3})\s+([A-ZÀ-Ÿ0-9\s\.\-]+?)\s+(\d{7,10})\s+((?:\d{2}\/\d{2}\/\d{2,4})|(?:\/\s*\/))\s+(\d{2}\/\d{2}\/\d{4})\s+(SIM|NÃO)\s+(SIM|NÃO)\s+(SIM|NÃO)/g;
        let match;
        const alunosExtraidos = [];

        while ((match = regexLinhaAluno.exec(fullText)) !== null) {
            let textoBloco = match[1].trim();
            let situacao2026 = "NÃO IDENTIFICADA";
            for (let sit of situacoesConhecidas) {
                if (textoBloco.startsWith(sit)) { situacao2026 = sit; break; }
            }
            let nome = textoBloco;
            let limpou = true;
            while(limpou) {
                limpou = false;
                for (let sit of situacoesConhecidas) {
                    if (nome.startsWith(sit)) {
                        nome = nome.substring(sit.length).trim();
                        limpou = true;
                    }
                }
            }
            nome = nome.replace(/^-+\s*/, '').trim();

            alunosExtraidos.push({
                codigo: match[2], nome: nome, situacao: situacao2026,
                dataMatricula: match[4],
                dataAjuste: (match[3].replace(/\s/g, '') === "//" || match[3].trim() === "") ? "" : match[3],
                alunoPaed: match[5], matPaed: match[6], transporte: match[7]
            });
        }
        alunosExtraidos.sort((a, b) => a.nome.localeCompare(b.nome));
        return alunosExtraidos;
    }

    function enviarParaSheets(turma, turno, alunos, idOperacao) {
        return new Promise((resolve, reject) => {
            const payload = {
                tipoIntegracao: "RELACAO",
                turma,
                turno,
                alunos,
                idOperacao: String(idOperacao || '')
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: urlWebapp,
                data: JSON.stringify(payload),
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                },
                timeout: TIMEOUT_WEBAPP_MS,
                onload: resolve,
                ontimeout: () => reject(
                    new Error(`Tempo esgotado (${Math.round(TIMEOUT_WEBAPP_MS / 1000)}s) ao aguardar confirmação da RELACAO.`)
                ),
                onerror: () => reject(
                    new Error('Falha de rede ao enviar RELACAO para o WebApp.')
                )
            });
        });
    }

    // =========================
    // MÓDULO DADOS PESSOAIS / DADOS ALUNOS
    // Ação independente no dropdown.
    // =========================

    function consolidarAlunosParaCadastro(mapa, alunos, turma) {
        let ignoradosTransferidosDaTurma = 0;

        for (const aluno of alunos) {
            const codigo = String(aluno.codigo || '').trim();
            if (!codigo) continue;

            // TRANSFERIDO DA TURMA representa a saída da turma antiga. O aluno
            // normalmente aparece como MATRICULADO na turma de destino; por isso
            // esta ocorrência não entra em DADOS ALUNOS.
            const situacao = String(aluno.situacao || '').trim().toUpperCase();
            if (situacao === 'TRANSFERIDO DA TURMA') {
                ignoradosTransferidosDaTurma++;
                continue;
            }

            const existente = mapa.get(codigo) || {
                codigo,
                nomeRelatorio: aluno.nome || '',
                turmas: new Set(),
                turnos: new Set(),
                situacoes: new Set()
            };

            existente.turmas.add(turma.nome || '');
            existente.turnos.add(turma.turno || '');
            existente.situacoes.add(aluno.situacao || '');
            if (!existente.nomeRelatorio && aluno.nome) existente.nomeRelatorio = aluno.nome;
            mapa.set(codigo, existente);
        }

        return ignoradosTransferidosDaTurma;
    }

    function criarIframeConsultaAluno() {
        document.getElementById('iframeDadosAlunosLote')?.remove();
        const iframe = document.createElement('iframe');
        iframe.id = 'iframeDadosAlunosLote';
        iframe.title = 'Consulta cadastral interna de alunos';
        iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:10px;height:10px;opacity:0;pointer-events:none;border:0;';
        document.body.appendChild(iframe);
        return iframe;
    }

    function carregarFichaAluno(iframe, url) {
        return new Promise((resolve, reject) => {
            let finalizado = false;
            const timerGeral = setTimeout(
                () => finalizar(new Error('Tempo esgotado ao abrir a ficha do aluno.')),
                TIMEOUT_PAGINA_ALUNO_MS
            );

            function limpar() {
                clearTimeout(timerGeral);
                iframe.removeEventListener('load', aoCarregar);
            }

            function finalizar(erro, doc) {
                if (finalizado) return;
                finalizado = true;
                limpar();
                erro ? reject(erro) : resolve(doc);
            }

            async function aoCarregar() {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc) throw new Error('Não foi possível acessar a ficha carregada.');

                    const inicio = Date.now();
                    while (!doc.getElementById('span_CTLGERPESNOM')) {
                        const mensagemErro = doc.querySelector('#gxErrorViewer .erro, .ErrorViewer, .erro')?.textContent?.trim();
                        if (mensagemErro) throw new Error(mensagemErro);
                        if (Date.now() - inicio > 10000) {
                            throw new Error('A ficha abriu sem os campos pessoais esperados.');
                        }
                        await delay(120);
                    }
                    finalizar(null, doc);
                } catch (erro) {
                    finalizar(erro);
                }
            }

            iframe.addEventListener('load', aoCarregar);
            iframe.src = url;
        });
    }

    function valorElementoCadastro(doc, id) {
        const elemento = doc.getElementById(id);
        if (!elemento) return '';
        return String(('value' in elemento && elemento.value) ? elemento.value : (elemento.textContent || ''))
            .replace(/\s+/g, ' ')
            .trim();
    }

    function formatarCpfCadastro(valor) {
        const digitos = String(valor || '').replace(/\D/g, '');
        return digitos.length === 11
            ? digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
            : String(valor || '').trim();
    }

    function telefoneCadastro(doc, idDdd, idNumero) {
        const ddd = valorElementoCadastro(doc, idDdd).replace(/\D/g, '');
        const numero = valorElementoCadastro(doc, idNumero).trim();
        if (!ddd && !numero) return '';
        return `${ddd ? `(${ddd}) ` : ''}${numero}`.trim();
    }

    function obterGrupoSocialCadastro(doc) {
        const valor = doc.querySelector('input[name="CTLGERPESGRPSOC"]:checked')?.value || '';
        return ({
            N: 'Não declarado',
            I: 'Circense',
            T: 'Trabalhador Itinerante',
            C: 'Acampados',
            A: 'Artista',
            P: 'Povos Indígenas',
            Q: 'Povos Quilombolas'
        })[valor] || '';
    }

    function extrairCadastroAluno(doc, aluno) {
        return {
            codigo: aluno.codigo,
            turmas: Array.from(aluno.turmas).filter(Boolean).join(' | '),
            turnos: Array.from(aluno.turnos).filter(Boolean).join(' | '),
            situacoes: Array.from(aluno.situacoes).filter(Boolean).join(' | '),
            inep: valorElementoCadastro(doc, 'span_CTLGEDALUIDINEP'),
            aluno: valorElementoCadastro(doc, 'span_CTLGERPESNOM') || aluno.nomeRelatorio,
            nomeSocial: valorElementoCadastro(doc, 'span_CTLGERPESNOMSOC'),
            cpfAluno: formatarCpfCadastro(valorElementoCadastro(doc, 'span_CTLGERPESCPF')),
            corRaca: valorElementoCadastro(doc, 'span_CTLGERPESRACA'),
            grupoSocial: obterGrupoSocialCadastro(doc),
            rgAluno: valorElementoCadastro(doc, 'span_CTLGERPESRG'),
            orgaoExpedidor: valorElementoCadastro(doc, 'span_CTLGERORGEMICOD'),
            sexoAluno: valorElementoCadastro(doc, 'span_CTLGERPESSEXO'),
            dataNascimento: valorElementoCadastro(doc, 'span_CTLGERPESDTANASC'),
            naturalidade: valorElementoCadastro(doc, 'span_CTLGERPESNATDSC'),
            ufNaturalidade: valorElementoCadastro(doc, 'span_CTLGERPESNATUF'),
            filiacao1: valorElementoCadastro(doc, 'span_CTLGERPESNOMMAE'),
            filiacao2: valorElementoCadastro(doc, 'span_CTLGERPESNOMPAI'),
            responsavel1: valorElementoCadastro(doc, 'span_CTLGERPESNOMRESP'),
            cpfResponsavel1: formatarCpfCadastro(valorElementoCadastro(doc, 'span_CTLGERPESRESPCPF')),
            telResidencialResp1: telefoneCadastro(doc, 'span_CTLGERPESTELRESDDDRESP', 'span_CTLGERPESTELRESRESP'),
            telCelularResp1: telefoneCadastro(doc, 'span_CTLGERPESTELCELDDDRESP', 'span_CTLGERPESTELCELRESP'),
            telComercialResp1: telefoneCadastro(doc, 'span_CTLGERPESTELCOMDDDRESP', 'span_CTLGERPESTELCOMRESP'),
            telContatoResp1: telefoneCadastro(doc, 'span_CTLGERPESTELCONDDDRESP', 'span_CTLGERPESTELCONRESP'),
            emailResp1: valorElementoCadastro(doc, 'span_CTLGERPESEMAILRESP'),
            responsavel2: valorElementoCadastro(doc, 'span_CTLGERPESNOMRESP2'),
            cpfResponsavel2: formatarCpfCadastro(valorElementoCadastro(doc, 'span_CTLGERPESRESPCPF2')),
            telResidencialResp2: telefoneCadastro(doc, 'span_CTLGERPESTELRESDDDRESP2', 'span_CTLGERPESTELRESRESP2'),
            telCelularResp2: telefoneCadastro(doc, 'span_CTLGERPESTELCELDDDRESP2', 'span_CTLGERPESTELCELRESP2'),
            telComercialResp2: telefoneCadastro(doc, 'span_CTLGERPESTELCOMDDDRESP2', 'span_CTLGERPESTELCOMRESP2'),
            telContatoResp2: telefoneCadastro(doc, 'span_CTLGERPESTELCONDDDRESP2', 'span_CTLGERPESTELCONRESP2'),
            emailResp2: valorElementoCadastro(doc, 'span_CTLGERPESEMAILRESP2'),
            telResidencial: telefoneCadastro(doc, 'span_CTLGERPESTELRESDDD', 'span_CTLGERPESTELRES'),
            telCelular: telefoneCadastro(doc, 'span_CTLGERPESTELCELDDD', 'span_CTLGERPESTELCEL'),
            telComercial: telefoneCadastro(doc, 'span_CTLGERPESTELCOMDDD', 'span_CTLGERPESTELCOM'),
            telContato: telefoneCadastro(doc, 'span_CTLGERPESTELCONDDD', 'span_CTLGERPESTELCON'),
            endereco: valorElementoCadastro(doc, 'span_CTLGERPESEND'),
            numero: valorElementoCadastro(doc, 'span_CTLGERPESNMRLOG'),
            complemento: valorElementoCadastro(doc, 'span_CTLGERPESCMPLOG'),
            bairro: valorElementoCadastro(doc, 'span_CTLGERPESBAIRRO'),
            cidade: valorElementoCadastro(doc, 'span_CTLGERPESENDCIDDSC'),
            ufEndereco: valorElementoCadastro(doc, 'span_CTLGERPESENDUF'),
            cep: valorElementoCadastro(doc, 'span_CTLGERPESCEP'),
            distribuidora: valorElementoCadastro(doc, 'span_CTLGERPESDISTCOD'),
            numeroUc: valorElementoCadastro(doc, 'span_CTLGERPESUC'),
            erro: ''
        };
    }

    async function consultarDadosAlunosParaPlanilha(mapaAlunos) {
        const alunos = Array.from(mapaAlunos.values()).sort((a, b) =>
            (a.nomeRelatorio || a.codigo).localeCompare(b.nomeRelatorio || b.codigo, 'pt-BR')
        );

        const iframe = criarIframeConsultaAluno();
        let lote = [];
        let enviados = 0;

        async function enviarLotePendente() {
            if (!lote.length) return;

            const tamanho = lote.length;
            addLog(
                `☁️ Salvando lote de ${tamanho} cadastro(s) em DADOS ALUNOS...`,
                '#17a2b8',
                'log-dados-alunos'
            );

            await executarComTentativas(
                `Envio de ${tamanho} cadastro(s)`,
                async () => validarRespostaWebApp(
                    await enviarDadosAlunosParaSheets(lote),
                    'DADOS_ALUNOS'
                )
            );

            enviados += tamanho;
            lote = [];
            addLog(
                `✅ Dados pessoais salvos: ${enviados}/${alunos.length}.`,
                '#28a745',
                'log-dados-alunos'
            );
        }

        try {
            for (let i = 0; i < alunos.length; i++) {
                const aluno = alunos[i];
                const codigo = String(aluno.codigo || '').trim();
                if (!codigo) continue;

                addLog(
                    `👤 Consultando ${i + 1}/${alunos.length}: ${aluno.nomeRelatorio || codigo}`,
                    '#6f42c1',
                    'log-dados-alunos'
                );

                const cadastro = await executarComTentativas(
                    `Consulta cadastral de ${aluno.nomeRelatorio || codigo}`,
                    async () => {
                        const url = `${window.location.origin}/ged/hwtmgedaluno.aspx?${encodeURIComponent(codigo)},,HWMConAluno,DSP,1,0`;
                        const doc = await carregarFichaAluno(iframe, url);
                        return extrairCadastroAluno(doc, aluno);
                    }
                );

                lote.push(cadastro);

                if (lote.length >= TAMANHO_LOTE_DADOS_ALUNOS) {
                    await enviarLotePendente();
                }

                if (i < alunos.length - 1) await delay(ESPERA_ENTRE_ALUNOS_MS);
            }

            await enviarLotePendente();
            addLog(
                `🎉 Dados pessoais concluídos: ${enviados} cadastro(s) enviado(s) para DADOS ALUNOS.`,
                '#28a745',
                'log-dados-alunos'
            );
        } finally {
            iframe.remove();
        }
    }

    function enviarDadosAlunosParaSheets(dadosAlunos) {
        return new Promise((resolve, reject) => {
            const payload = {
                tipoIntegracao: 'DADOS_ALUNOS',
                abaDestino: 'DADOS ALUNOS',
                dados: dadosAlunos
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: urlWebapp,
                data: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                timeout: TIMEOUT_WEBAPP_MS,
                onload: resolve,
                ontimeout: () => reject(new Error('Tempo esgotado ao enviar DADOS ALUNOS para o WebApp.')),
                onerror: () => reject(new Error('Falha de rede ao enviar DADOS ALUNOS para o WebApp.'))
            });
        });
    }

    // =========================
    // MÓDULO ATESTADOS
    // =========================

    function prepararIframeAtestados() {
        let container = document.getElementById('containerIframeAtestadosLote');
        if (container) {
            container.remove();
        }

        container = document.createElement('div');
        container.id = 'containerIframeAtestadosLote';
        container.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; visibility: hidden; opacity: 0; border: none;';
        let iframe = document.createElement('iframe');
        iframe.id = 'iframeAtestadosLote'; iframe.name = 'iframeAtestadosLote';
        container.appendChild(iframe);
        document.body.appendChild(container);

        return document.getElementById('iframeAtestadosLote');
    }

    async function extrairAtestados(alunos, turma, turno, logId) {
        const iframe = prepararIframeAtestados();
        iframe.src = 'http://sigeduca.seduc.mt.gov.br/ged/hwmgedatestado.aspx';

        let iframeDoc = iframe.contentWindow.document;
        let tentativasLoad = 0;
        while (!iframeDoc.getElementById('vGEDALUCOD') && tentativasLoad < 30) {
            await delay(1000);
            iframeDoc = iframe.contentWindow.document;
            tentativasLoad++;
        }

        if (tentativasLoad >= 30) throw new Error("Falha ao carregar a tela de atestados do Sigeduca.");
        await delay(1500);

        let atestadosColetados = [];

        for (let i = 0; i < alunos.length; i++) {
            if (!isRodando) break;
            let aluno = alunos[i];

            addLog(`>> Lendo atestados: ${i + 1}/${alunos.length} (${aluno.nome.substring(0,18)}...)`, "#17a2b8", logId);

            let inputAluno = iframeDoc.getElementById('vGEDALUCOD');
            if (inputAluno) {
                inputAluno.value = aluno.codigo;
                if ("createEvent" in iframeDoc) {
                    var evt = iframeDoc.createEvent("HTMLEvents");
                    evt.initEvent("change", false, true);
                    inputAluno.dispatchEvent(evt);
                } else { inputAluno.fireEvent("onchange"); }
            } else { continue; }

            await delay(300);
            let btnConsultar = iframeDoc.getElementsByName('BCONSULTAR')[0] || iframeDoc.querySelector('.btnConsultar');
            if (btnConsultar) btnConsultar.click();
            await delay(300);

            while (!isNotificationHidden(iframeDoc)) { await delay(300); }

            let docTabela = iframeDoc;
            if (iframe.contentWindow.frames.length > 0 && iframe.contentWindow.frames[0].document.getElementById('GriddetalhesContainerTbl')) {
                docTabela = iframe.contentWindow.frames[0].document;
            }

            let selectPag = docTabela.getElementById('vPAG');
            let totalPaginas = selectPag ? selectPag.options.length : 1;

            for (let p = 1; p <= totalPaginas; p++) {
                if (p > 1 && selectPag) {
                    selectPag.value = p.toString();
                    if ("createEvent" in docTabela) {
                        var evtPag = docTabela.createEvent("HTMLEvents");
                        evtPag.initEvent("change", false, true);
                        selectPag.dispatchEvent(evtPag);
                    } else { selectPag.fireEvent("onchange"); }
                    try { docTabela.defaultView.gx.evt.execEvt('EVPAG.CLICK.', selectPag); } catch(e){}
                    await delay(300);
                    while (!isNotificationHidden(docTabela)) { await delay(300); }
                }

                let tabelaDetalhes = docTabela.getElementById('GriddetalhesContainerTbl');
                if (tabelaDetalhes && tabelaDetalhes.rows.length > 1) {
                    for (let n = 1; n < tabelaDetalhes.rows.length; n++) {
                        let numStr = ("0000" + n).slice(-4);
                        try {
                            let dataIni = docTabela.getElementById('span_vGEDATEPERINI_' + numStr)?.textContent.trim() || '';
                            let dataFim = docTabela.getElementById('span_vGEDATEPERFIN_' + numStr)?.textContent.trim() || '';
                            let tipoJust = docTabela.getElementById('span_vGEDATETIPO_' + numStr)?.textContent.trim() || '';

                            if (dataIni) {
                                let periodoStr = `de ${dataIni} a ${dataFim || dataIni}`;
                                atestadosColetados.push({
                                    codigo: aluno.codigo,
                                    nome: aluno.nome,
                                    turma: turma,
                                    turno: turno,
                                    periodo: periodoStr,
                                    tipoJustificativa: tipoJust
                                });
                            }
                        } catch (err) {}
                    }
                }
            }
            await delay(200);
        }
        return atestadosColetados;
    }

    function enviarAtestadosParaSheets(atestados) {
        return new Promise((resolve, reject) => {
            const payload = {
                tipoIntegracao: "ATESTADOS",
                abaDestino: "ATESTADOS",
                dados: atestados
            };
            GM_xmlhttpRequest({
                method: "POST",
                url: urlWebapp,
                data: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" },
                timeout: TIMEOUT_WEBAPP_MS,
                onload: resolve,
                ontimeout: () => reject(new Error('Tempo esgotado ao enviar ATESTADOS para o WebApp.')),
                onerror: () => reject(new Error('Falha de rede ao enviar ATESTADOS para o WebApp.'))
            });
        });
    }

    function gerarHtmlTurma(alunos, turma, turno) {
        let linhasTabela = "";
        const alunosFiltrados = alunos.filter(a => !a.situacao.toUpperCase().includes("DEPENDENTE"));

        alunosFiltrados.forEach((aluno, index) => {
            let situacaoExibicao = aluno.situacao.toUpperCase();
            if (situacaoExibicao === "MATRICULADO") situacaoExibicao = "&nbsp;";
            else if (situacaoExibicao === "TRANSFERIDO DA ESCOLA") situacaoExibicao = "TRANSF.";
            else if (situacaoExibicao === "TRANSFERIDO DA TURMA") situacaoExibicao = "REMOV.";

            linhasTabela += `
                <tr>
                    <td class="centro">${index + 1}</td>
                    <td class="centro">${aluno.codigo}</td>
                    <td>${aluno.nome}</td>
                    <td class="centro">${situacaoExibicao}</td>
                    <td class="centro">${aluno.dataAjuste}</td>
                    <td class="centro">${aluno.dataMatricula}</td>
                </tr>
            `;
        });

        const linhasPorPagina = 55;
        let linhasRestantes = linhasPorPagina - (alunosFiltrados.length % linhasPorPagina);
        if (linhasRestantes < 5) linhasRestantes += linhasPorPagina;

        for (let i = 1; i <= linhasRestantes; i++) {
            linhasTabela += `
                <tr>
                    <td class="centro">${alunosFiltrados.length + i}</td>
                    <td class="centro">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td class="centro">&nbsp;</td>
                    <td class="centro">&nbsp;</td>
                    <td class="centro">&nbsp;</td>
                </tr>
            `;
        }

        return `
            <div class="bloco-turma">
                <div class="cabecalho-impr">
                    <div class="titulo">RELAÇÃO DE ALUNOS POR SITUAÇÃO</div>
                    <div class="subtitulo">Turma: <b>${turma}</b> &nbsp;|&nbsp; Turno: <b>${turno}</b></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%;">Nº</th>
                            <th style="width: 14%;">CÓDIGO</th>
                            <th style="width: 38%;">NOME DO ALUNO</th>
                            <th style="width: 20%;">SITUAÇÃO</th>
                            <th style="width: 12%;">DT AJUSTE</th>
                            <th style="width: 12%;">DT MATRÍCULA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasTabela}
                    </tbody>
                </table>
            </div>
        `;
    }

    function finalizarJanelaImpressao(novaJanela, htmlCorpo) {
        const htmlFinal = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Lote de Impressão</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 15px; color: #333; margin: 0; }
                    .bloco-turma { page-break-after: always; padding-bottom: 20px; }
                    .bloco-turma:last-child { page-break-after: auto; }
                    .cabecalho-impr { text-align: center; margin-bottom: 5px; }
                    .cabecalho-impr .titulo { font-size: 10pt; text-transform: uppercase; font-weight: bold; color: #333; }
                    .cabecalho-impr .subtitulo { font-size: 10pt; text-transform: uppercase; color: #333; }
                    .cabecalho-impr .subtitulo b { color: #000; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 7pt; border: 1px solid #000; }
                    th { border: none; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 2px; text-transform: uppercase; background-color: #f2f2f2; font-weight: bold; text-align: center; }
                    th:first-child { border-left: 1px solid #000; }
                    th:last-child { border-right: 1px solid #000; }
                    td { border: none; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 2px; text-transform: uppercase; }
                    tbody td:nth-child(1), tbody td:nth-child(2) { border-left: 1px solid #000; border-right: 1px solid #000; }
                    td.centro { text-align: center; }
                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }
                    }
                    .btn-imprimir {
                        display: block; width: 250px; margin: 15px auto; padding: 12px;
                        background: #007bff; color: white; text-align: center;
                        font-weight: bold; border-radius: 5px; cursor: pointer; border: none; font-size: 14px;
                    }
                    .btn-imprimir:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <button class="btn-imprimir no-print" onclick="window.print()">🖨️ Imprimir Todo o Lote</button>
                ${htmlCorpo}
            </body>
            </html>
        `;

        novaJanela.document.open();
        novaJanela.document.write(htmlFinal);
        novaJanela.document.close();
    }

    function resetarBotaoLote() {
        const btnIniciar = document.getElementById('btn-iniciar-lote');
        if (!btnIniciar) return;
        btnIniciar.style.background = "#28a745";
        btnIniciar.style.color = "white";
        btnIniciar.disabled = turmasMapeadas.length === 0;
        btnIniciar.style.opacity = turmasMapeadas.length === 0 ? '0.5' : '1';
        atualizarTextoBotaoAcao();
    }

    function iniciarModuloAcoesLote() {
        if (!ehRotaFerramenta()) return;
        if (!temParametrosCompletosDaTelaDeTurmas()) {
            navegarParaTelaCompletaDaFerramenta();
            return;
        }

        const iniciar = () => {
            // Aguarda a tela GeneXus existir para inserir a GUI no lugar correto.
            let tentativas = 0;
            const timer = setInterval(() => {
                tentativas++;
                const form = document.getElementById('MAINFORM');
                const table10 = document.getElementById('TABLE10');
                const selectTurno = document.getElementById('vGRHTRNCOD');
                const btnConsultar = document.querySelector('input[name="BCONSULTAR"]');
                if ((form && table10 && selectTurno && btnConsultar) || tentativas >= 100) {
                    clearInterval(timer);
                    ocultarEstruturasNativasDaTela();
                    criarPainelLote();
                }
            }, 100);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar, { once: true });
        } else {
            iniciar();
        }
    }

    iniciarModuloAcoesLote();
})();
