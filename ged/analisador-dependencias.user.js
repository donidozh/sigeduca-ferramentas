// ==UserScript==
// @name         SIGEDUCA - Ferramentas - Analisador de Dependências Integrado
// @namespace    http://tampermonkey.net/
// @version      1.0.8
// @description  Extrai históricos de dependência no SIGEDUCA e aplica, no próprio navegador, a lógica da planilha Analisador de dependências 2024.
// @author       Elder Martins / lógica de extração baseada no trabalho de Roberson Arruda
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/analisador-dependencias.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/analisador-dependencias.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '1.0.8',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/analisador-dependencias.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/analisador-dependencias.user.js'
    });

    // =====================================================================
    // ARQUITETURA MODULAR - MENU FERRAMENTAS
    // =====================================================================

    const FLAG = '__SIGEDUCA_DEPENDENCIAS_INTEGRADO_V1_0_6__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    const HASH_FERRAMENTA = '#analisador-dependencias';

    const FERRAMENTA = Object.freeze({
        id: 'dependencias',
        titulo: 'Analisador de Dependências',
        url: `hwmgedhistorico.aspx${HASH_FERRAMENTA}`,
        descricao: 'Extrai históricos e identifica dependências ainda a pagar',
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
    // CONFIGURAÇÃO
    // =====================================================================

    const PAGINA_HISTORICO = /\/ged\/hwmgedhistorico\.aspx$/i.test(location.pathname);
    const MODO_FERRAMENTA = PAGINA_HISTORICO && location.hash.toLowerCase() === HASH_FERRAMENTA;

    const CHAVE_CHECKPOINT = 'sigeduca_dependencias_integrado_checkpoint_v1';
    const CHAVE_RESULTADO = 'sigeduca_dependencias_integrado_resultado_v1';

    const TIMEOUT_CONSULTA_MS = 45000;
    const TIMEOUT_IFRAME_MS = 30000;
    const INTERVALO_ENTRE_ALUNOS_MS = 450;
    const LOOKAHEAD_PLANILHA = 18;

    const URL_DETALHE_HISTORICO = 'hwtgedhistoricoescolar.aspx';

    let estado = {
        rodando: false,
        pausaSolicitada: false,
        codigos: [],
        indiceAtual: 0,
        linhasHistorico: [],
        erros: [],
        inicio: null,
        fim: null
    };

    // =====================================================================
    // INICIALIZAÇÃO
    // =====================================================================

    function quandoDOMPronto(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    if (PAGINA_HISTORICO) {
        window.addEventListener('hashchange', () => {
            if (location.hash.toLowerCase() === HASH_FERRAMENTA) {
                location.reload();
            }
        });
    }

    quandoDOMPronto(() => {
        if (!MODO_FERRAMENTA) return;
        setTimeout(inicializarFerramenta, 350);
    });

    function inicializarFerramenta() {
        document.title = 'Analisador de Dependências';

        const titulo = document.getElementById('TTITULO');
        if (titulo) titulo.textContent = 'Analisador de Dependências';

        esconderTelaNativa();
        garantirIframe();
        criarInterface();
        carregarEstadoAnterior();
        renderizarTudo();
    }

    // =====================================================================
    // MORPH DA PÁGINA
    // =====================================================================

    function esconderTelaNativa() {
        const inputAluno = document.getElementById('vGEDALUCOD');

        // Mantém todos os controles e grids no DOM, porque o GeneXus continua
        // executando as consultas. Apenas escondemos a interface original.
        if (inputAluno) {
            const tabelaNativa = inputAluno.closest('table');
            if (tabelaNativa) {
                tabelaNativa.dataset.depNativeHidden = '1';
                tabelaNativa.style.display = 'none';
            }
        }

        // Grids e containers de resultado também ficam invisíveis, mas ativos.
        [
            'GRID1',
            'GRIDS',
            'Grid1ContainerDiv',
            'FreesgridContainerDiv'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const style = document.createElement('style');
        style.id = 'dep-integrado-style';
        style.textContent = `
            #dep-integrado-app,
            #dep-integrado-app * {
                box-sizing:border-box;
                font-family:Verdana, Arial, sans-serif;
            }
            #dep-integrado-app { font-size:8pt; }
            #dep-integrado-app button:disabled { opacity:.55; cursor:not-allowed !important; }
            #dep-integrado-app textarea,
            #dep-integrado-app input,
            #dep-integrado-app select,
            #dep-integrado-app button {
                font-family:Verdana, Arial, sans-serif;
                font-size:8pt;
            }
            #dep-integrado-app .dep-card {
                background:#fff;
                border:1px solid #b9c4cf;
                border-radius:3px;
                padding:8px;
            }
            #dep-integrado-app .dep-btn {
                border:1px solid #294e73;
                border-radius:3px;
                padding:6px 9px;
                cursor:pointer;
                font-weight:bold;
            }
            #dep-integrado-app .dep-btn-sec {
                border:1px solid #8a99a8;
                border-radius:3px;
                padding:6px 8px;
                cursor:pointer;
                background:#f6f6f6;
                color:#111;
            }
            #dep-integrado-app table {
                width:100%;
                border-collapse:collapse;
                font-size:7pt;
            }
            #dep-integrado-app th, #dep-integrado-app td {
                border:1px solid #c9d1d8;
                padding:4px;
                vertical-align:top;
                text-align:left;
            }
            #dep-integrado-app th {
                background:#065195;
                color:#fff;
                position:sticky;
                top:0;
                z-index:1;
            }
            #dep-integrado-app .dep-pill {
                display:inline-block;
                padding:2px 5px;
                border-radius:8px;
                font-size:7pt;
                font-weight:bold;
            }
        `;
        document.head.appendChild(style);
    }

    function criarInterface() {
        if (document.getElementById('dep-integrado-app')) return;

        const app = document.createElement('div');
        app.id = 'dep-integrado-app';
        app.style.cssText = `
            width:min(820px, calc(100% - 24px));
            margin:10px auto 24px auto;
            font-family:Verdana,Arial,sans-serif;
            color:#000;
            font-size:8pt;
        `;

        app.innerHTML = `
            <div style="background:#f5f7fa;border:1px solid #b9c4cf;padding:9px;border-radius:3px;">
                <div class="dep-card">
                    <label style="display:block;font-weight:bold;margin-bottom:6px;">
                        Códigos dos alunos
                    </label>
                    <textarea id="dep-codigos" placeholder="Cole um código por linha, por exemplo:
2335051
1873289
2006606"
                        style="width:100%;height:88px;resize:vertical;border:1px solid #8a99a8;border-radius:2px;padding:6px;font-size:8pt;"></textarea>

                    <div style="font-size:7pt;color:#555;margin-top:4px;">
                        Aceita códigos separados por linha, espaço, vírgula ou ponto e vírgula. Duplicados são removidos automaticamente.
                    </div>

                    <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;">
                        <button type="button" id="dep-iniciar" class="dep-btn" style="background:#198754;color:#fff;flex:1;min-width:170px;">
                            ▶ Analisar dependências
                        </button>
                        <button type="button" id="dep-retomar" class="dep-btn" style="display:none;background:#6f42c1;color:#fff;">
                            ▶ Retomar
                        </button>
                        <button type="button" id="dep-pausar" class="dep-btn" disabled style="background:#ffc107;color:#222;">
                            ⏸ Pausar
                        </button>
                        <button type="button" id="dep-limpar" class="dep-btn-sec">
                            🗑 Limpar
                        </button>
                    </div>
                </div>

                <div class="dep-card" style="margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:bold;">Progresso</div>
                            <div id="dep-progresso-texto" style="font-size:7pt;color:#555;margin-top:2px;">Aguardando...</div>
                        </div>
                        <div id="dep-progresso-percentual" style="font-size:11pt;font-weight:bold;color:#065195;">0%</div>
                    </div>
                    <div style="height:7px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-top:6px;">
                        <div id="dep-progresso-barra" style="height:100%;width:0%;background:#198754;transition:width .2s ease;"></div>
                    </div>
                </div>

                <div id="dep-resumo" class="dep-card" style="margin-top:8px;">
                    Nenhum resultado ainda.
                </div>

                <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">
                    <button type="button" id="dep-relatorio" class="dep-btn-sec" disabled>📋 Ver relatório</button>
                    <button type="button" id="dep-csv-alunos" class="dep-btn-sec" disabled>⬇ CSV por aluno</button>
                    <button type="button" id="dep-csv-detalhado" class="dep-btn-sec" disabled>⬇ CSV detalhado</button>
                </div>


                <div class="dep-card" style="margin-top:8px;">
                    <div style="font-weight:bold;margin-bottom:6px;">Log</div>
                    <div id="dep-log" style="max-height:145px;overflow:auto;background:#f7f7f7;color:#222;border:1px solid #c9d1d8;border-radius:2px;padding:6px;font-family:Verdana,Arial,sans-serif;font-size:7pt;line-height:1.4;"></div>
                </div>

            </div>
        `;

        const referencia = localizarReferenciaInsercao();
        if (referencia?.parentNode) {
            referencia.parentNode.insertBefore(app, referencia);
        } else {
            document.body.appendChild(app);
        }

        // A interface fica dentro do <form> do GeneXus. Sem type="button", um
        // <button> comum vira submit e o SIGEDUCA navega para a página original.
        app.querySelectorAll('button').forEach(btn => { btn.type = 'button'; });

        document.getElementById('dep-iniciar').addEventListener('click', iniciarNovoLote);
        document.getElementById('dep-retomar').addEventListener('click', retomarLote);
        document.getElementById('dep-pausar').addEventListener('click', solicitarPausa);
        document.getElementById('dep-limpar').addEventListener('click', limparTudo);
        document.getElementById('dep-relatorio').addEventListener('click', (e) => { e.preventDefault(); abrirRelatorioImpressao(); });
        document.getElementById('dep-csv-alunos').addEventListener('click', (e) => { e.preventDefault(); exportarCsvPorAluno(); });
        document.getElementById('dep-csv-detalhado').addEventListener('click', (e) => { e.preventDefault(); exportarCsvDetalhado(); });
    }

    function localizarReferenciaInsercao() {
        const inputAluno = document.getElementById('vGEDALUCOD');
        const tabela = inputAluno?.closest('table');
        return tabela || document.querySelector('form#MAINFORM > p:last-of-type') || null;
    }

    // =====================================================================
    // IFRAME DE DETALHE DO HISTÓRICO
    // =====================================================================

    function garantirIframe() {
        if (document.getElementById('dep-iframe-historico')) return;
        const iframe = document.createElement('iframe');
        iframe.id = 'dep-iframe-historico';
        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
    }

    function carregarIframe(url, timeoutMs = TIMEOUT_IFRAME_MS) {
        const iframe = document.getElementById('dep-iframe-historico');
        if (!iframe) return Promise.reject(new Error('Iframe auxiliar não encontrado.'));

        return new Promise((resolve, reject) => {
            let terminou = false;
            const timer = setTimeout(() => {
                if (terminou) return;
                terminou = true;
                iframe.onload = null;
                reject(new Error('Tempo esgotado carregando o detalhe do histórico.'));
            }, timeoutMs);

            iframe.onload = () => {
                if (terminou) return;
                terminou = true;
                clearTimeout(timer);
                iframe.onload = null;
                setTimeout(() => resolve(iframe), 300);
            };

            iframe.src = url;
        });
    }

    // =====================================================================
    // UTILITÁRIOS
    // =====================================================================

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    function normalizarTexto(v) {
        return String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function texto(el) {
        return normalizarTexto(el?.textContent || el?.innerText || '');
    }

    function limparNomeAluno(valor) {
        return normalizarTexto(valor)
            .replace(/^\s*=\s*-\s*/u, '')
            .replace(/^\s*-\s*/u, '')
            .replace(/^\s*=\s*/u, '')
            .trim();
    }

    function escaparHtml(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalizarComparacao(v) {
        return normalizarTexto(v)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    }

    function suffix4(n) {
        return String(n).padStart(4, '0');
    }

    function baseAntesHifen(v) {
        const s = normalizarTexto(v);
        const p = s.indexOf('-');
        return p >= 0 ? s.slice(0, p) : s;
    }

    // Corrige uma inconsistência do SIGEDUCA/extração em que MATEMÁTICA
    // pode aparecer com o código da disciplina colado ao nome (ex.: 5MATEMÁTICA).
    // A correção também é aplicada aos dados já salvos no localStorage.
    function corrigirNomeDisciplina(v) {
        return normalizarTexto(v)
            .replace(/^\d+\s*(MATEM[ÁA]TICA)(?=\s*[-–—]|\s*$)/iu, '$1');
    }

    function contemDependente(v) {
        return normalizarComparacao(v).includes('DEPENDENTE');
    }

    function ehSituacaoProgressao(v) {
        const t = normalizarComparacao(v);
        return t === 'EM PROGRESSAO' || t === 'PROGRESSAO PARCIAL';
    }

    function extrairSerieRoberson(valor) {
        const original = normalizarTexto(valor);
        const upper = original.toUpperCase();

        if (upper.includes('FUNDAMENTAL') && !upper.includes('MÉDIO') && !upper.includes('MEDIO')) {
            const matches = [...original.matchAll(/(\d)[º°]/g)];
            if (matches.length) {
                return `${matches[matches.length - 1][1]}º ANO DO FUNDAMENTAL`;
            }
        }

        const m = original.match(/[1-3][º°]\s?ANO/i);
        if (m) return m[0].replace(/°/, 'º').replace(/\s/g, '').toUpperCase();

        return '';
    }

    function listaCodigosDoCampo() {
        const bruto = document.getElementById('dep-codigos')?.value || '';
        const encontrados = bruto.match(/\d+/g) || [];
        return [...new Set(encontrados.map(x => x.trim()).filter(Boolean))];
    }

    function salvarJson(chave, valor) {
        localStorage.setItem(chave, JSON.stringify(valor));
    }

    function carregarJson(chave) {
        try {
            const s = localStorage.getItem(chave);
            return s ? JSON.parse(s) : null;
        } catch {
            return null;
        }
    }

    function addLog(msg, cor = '#e5e7eb') {
        const box = document.getElementById('dep-log');
        if (!box) return;
        const linha = document.createElement('div');
        linha.style.color = cor;
        linha.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
        box.appendChild(linha);
        box.scrollTop = box.scrollHeight;
    }

    // =====================================================================
    // ETAPA 1 - CONSULTA DA LISTA DE HISTÓRICOS
    // Lógica mantida do Extrator de dependências de Roberson Arruda.
    // =====================================================================

    async function consultarCodigosHistorico(codigoAluno) {
        const input = document.getElementById('vGEDALUCOD');
        const btn = document.getElementsByName('BUTTONCONSULTAR')?.[0];

        if (!input || !btn) {
            throw new Error('Não encontrei vGEDALUCOD/BUTTONCONSULTAR na página de Histórico Escolar.');
        }

        // Limpa mensagens anteriores sem remover estruturas do GeneXus.
        const erro = document.getElementById('gxErrorViewer');
        if (erro) erro.innerHTML = '';

        input.value = codigoAluno;
        try {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (_) {}

        btn.click();

        await aguardarRetornoAluno(codigoAluno);

        const selecionados = [];
        const anosProg = [];

        for (let linha = 1; linha <= 99; linha++) {
            const suf = suffix4(linha);
            const elAluno = document.getElementById(`span_vGRIDGEDALUCOD_${suf}`);

            if (!elAluno) {
                if (linha === 1) continue;
                break;
            }

            const serieEl = document.getElementById(`span_vGRIDGEDSERIEDSCCPL_${suf}`);
            const situacaoEl = document.getElementById(`span_vGRIDGEDHISTSITAPR_${suf}`);
            const codHistEl = document.getElementById(`span_vGRIDGEDHISTCOD_${suf}`);

            const serieCompleta = texto(serieEl);
            const partes = serieCompleta.split('>');
            const numAno = normalizarTexto(partes[partes.length - 1]);
            const situacao = texto(situacaoEl);
            const codHistorico = texto(codHistEl).replace(/\s/g, '');

            const histDep = anosProg.includes(numAno);

            if (ehSituacaoProgressao(situacao) || histDep) {
                if (codHistorico) {
                    selecionados.push({
                        codigoAluno,
                        codigoHistorico: codHistorico,
                        serieGrade: numAno,
                        situacaoGrade: situacao
                    });
                    anosProg.push(numAno);
                }
            }
        }

        return selecionados;
    }

    function aguardarRetornoAluno(codigoAluno) {
        return new Promise((resolve, reject) => {
            const inicio = Date.now();

            const timer = setInterval(() => {
                const ajax = document.getElementById('gx_ajax_notification');
                const carregando = ajax && getComputedStyle(ajax).display !== 'none';
                const primeiro = texto(document.getElementById('span_vGRIDGEDALUCOD_0001')).replace(/\s/g, '');
                const erro = texto(document.getElementById('gxErrorViewer'));

                if (!carregando && primeiro === String(codigoAluno)) {
                    clearInterval(timer);
                    resolve();
                    return;
                }

                if (!carregando && erro && Date.now() - inicio > 600) {
                    clearInterval(timer);
                    reject(new Error(erro));
                    return;
                }

                if (Date.now() - inicio >= TIMEOUT_CONSULTA_MS) {
                    clearInterval(timer);
                    reject(new Error('Tempo esgotado ou aluno sem histórico disponível.'));
                }
            }, 120);
        });
    }

    // =====================================================================
    // ETAPA 2 - EXTRAÇÃO DOS DETALHES DO HISTÓRICO
    // Mantém o layout de dados usado pelo extrator original:
    // código; aluno; situação histórico; série; área; disciplinas...
    // =====================================================================

    async function extrairDetalheHistorico(item) {
        const url = new URL(URL_DETALHE_HISTORICO, `${location.origin}/ged/`);
        url.search = `?${encodeURIComponent(item.codigoHistorico)},${encodeURIComponent(item.codigoAluno)},HWMGedHistorico,,UPD,N`;

        const iframe = await carregarIframe(url.href);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) throw new Error('Não foi possível acessar o detalhe do histórico.');

        const nomeAluno = limparNomeAluno(texto(doc.getElementById('span_vGEDALUNOM')));
        const selSituacao = doc.getElementById('vGEDHISTSITAPR');
        const situacaoHistorico = selSituacao?.options?.[selSituacao.selectedIndex]?.textContent
            ? normalizarTexto(selSituacao.options[selSituacao.selectedIndex].textContent)
            : '';

        const serieCompleta = texto(doc.getElementById('span_vGEDSERIEDSCCPL'));
        const serie = extrairSerieRoberson(serieCompleta) || item.serieGrade || '';

        const linhas = [];

        for (let areaIdx = 1; areaIdx <= 99; areaIdx++) {
            const as = suffix4(areaIdx);
            const areaEl = doc.getElementById(`span_vGEDHISTAREADSCG_${as}`);
            if (!areaEl) {
                if (areaIdx === 1) continue;
                break;
            }

            const areaDesc = texto(areaEl);
            const areaSit = texto(doc.getElementById(`span_vGEDHISTAREASITAPRG_${as}`));
            const area = `AREA: ${areaDesc}-${areaSit}`;
            const disciplinas = [];

            for (let discIdx = 1; discIdx <= 99; discIdx++) {
                const ds = suffix4(discIdx);
                const discEl = doc.getElementById(`span_vGEDHISTDISCNOM_${ds}${as}`);
                if (!discEl) {
                    if (discIdx === 1) continue;
                    break;
                }

                const nomeDisc = corrigirNomeDisciplina(texto(discEl));
                const sitDisc = texto(doc.getElementById(`span_vGEDHISTDISCSITAPRG_${ds}${as}`));

                disciplinas.push(`${nomeDisc}-${sitDisc}`);
            }

            linhas.push({
                codigo: String(item.codigoAluno),
                aluno: nomeAluno,
                situacaoHistorico,
                serie,
                area,
                disciplinas,
                codigoHistorico: item.codigoHistorico,
                serieGrade: item.serieGrade,
                situacaoGrade: item.situacaoGrade
            });
        }

        return linhas;
    }

    // =====================================================================
    // ANÁLISE INTEGRADA DA PLANILHA AUXILIAR
    //
    // A fórmula original da planilha faz, para cada célula G:T contendo
    // "Dependente":
    //   - procura nos 18 registros seguintes;
    //   - mesmo código do aluno;
    //   - mesma série;
    //   - se a área atual contém TRILHA, exige área posterior contendo o
    //     prefixo da área atual; caso contrário, exige área posterior que NÃO
    //     contenha TRILHA;
    //   - procura a mesma disciplina em qualquer coluna de disciplinas;
    //   - se reaparecer, considera a disciplina paga.
    //
    // A coluna A marca "Dep. a pagar" quando a quantidade de disciplinas
    // Dependente é maior que a quantidade considerada paga.
    // =====================================================================

    function analisarComLogicaPlanilha(linhas) {
        return linhas.map((linha, i) => {
            const deps = linha.disciplinas
                .map((valor, indice) => ({ valor, indice }))
                .filter(x => contemDependente(x.valor));

            const pagamentos = deps.map(dep => {
                const base = corrigirNomeDisciplina(baseAntesHifen(dep.valor));
                const areaAtual = linha.area;
                const areaEhTrilha = normalizarComparacao(areaAtual).includes('TRILHA');
                const prefixoArea = baseAntesHifen(areaAtual);

                let encontrada = false;
                let onde = null;

                const fim = Math.min(linhas.length - 1, i + LOOKAHEAD_PLANILHA);

                for (let j = i + 1; j <= fim && !encontrada; j++) {
                    const futura = linhas[j];

                    if (String(futura.codigo) !== String(linha.codigo)) continue;
                    if (normalizarTexto(futura.serie) !== normalizarTexto(linha.serie)) continue;

                    const areaFuturaNorm = normalizarComparacao(futura.area);

                    if (areaEhTrilha) {
                        if (!areaFuturaNorm.includes(normalizarComparacao(prefixoArea))) continue;
                    } else {
                        if (areaFuturaNorm.includes('TRILHA')) continue;
                    }

                    const alvo = normalizarComparacao(`${base}-`);
                    const achada = futura.disciplinas.find(d =>
                        normalizarComparacao(corrigirNomeDisciplina(d)).startsWith(alvo)
                    );

                    if (achada) {
                        encontrada = true;
                        onde = {
                            indiceLinha: j,
                            codigoHistorico: futura.codigoHistorico,
                            serie: futura.serie,
                            area: futura.area,
                            disciplina: achada
                        };
                    }
                }

                return {
                    original: dep.valor,
                    disciplina: base,
                    paga: encontrada,
                    comprovacao: onde
                };
            });

            const qtdDependentes = deps.length;
            const qtdPagas = pagamentos.filter(p => p.paga).length;
            const statusLinha = qtdDependentes > qtdPagas ? 'Dep. a pagar' : '';

            return {
                ...linha,
                pagamentos,
                qtdDependentes,
                qtdPagas,
                statusLinha
            };
        });
    }

    // Reproduz a macro GeraRelatorio da planilha:
    // somente linhas marcadas "Dep. a pagar" e todas as células G:T que
    // contêm "-Dependente", removendo o sufixo.
    function gerarRelatorioCompativelPlanilha(analisadas) {
        return analisadas
            .filter(r => r.statusLinha === 'Dep. a pagar')
            .map(r => ({
                codigo: r.codigo,
                aluno: limparNomeAluno(r.aluno),
                serie: r.serie,
                area: String(r.area || '').replace(/-Dependente/g, ''),
                disciplinas: r.disciplinas
                    .filter(d => String(d).includes('-Dependente'))
                    .map(d => corrigirNomeDisciplina(String(d).replace(/-Dependente/g, '')))
            }));
    }

    function gerarPendenciasIndividuais(analisadas) {
        const saida = [];
        for (const r of analisadas) {
            for (const p of r.pagamentos) {
                saida.push({
                    codigo: r.codigo,
                    aluno: limparNomeAluno(r.aluno),
                    serie: r.serie,
                    area: r.area,
                    disciplina: corrigirNomeDisciplina(p.disciplina),
                    paga: p.paga ? 'SIM' : 'NÃO',
                    codigoHistoricoOrigem: r.codigoHistorico,
                    codigoHistoricoPagamento: p.comprovacao?.codigoHistorico || '',
                    detalhePagamento: p.comprovacao
                        ? `${p.comprovacao.serie} | ${p.comprovacao.area} | ${corrigirNomeDisciplina(p.comprovacao.disciplina)}`
                        : ''
                });
            }
        }
        return saida;
    }

    // =====================================================================
    // PROCESSAMENTO
    // =====================================================================

    async function iniciarNovoLote() {
        if (estado.rodando) return;

        const codigos = listaCodigosDoCampo();
        if (!codigos.length) {
            alert('Informe pelo menos um código de aluno.');
            return;
        }

        estado = {
            rodando: true,
            pausaSolicitada: false,
            codigos,
            indiceAtual: 0,
            linhasHistorico: [],
            erros: [],
            inicio: new Date().toISOString(),
            fim: null
        };

        document.getElementById('dep-log').innerHTML = '';
        addLog(`Iniciando análise de ${codigos.length} aluno(s).`, '#86efac');
        atualizarBotoes();
        salvarCheckpoint();
        await processarLote();
    }

    async function retomarLote() {
        if (estado.rodando) return;
        if (!estado.codigos?.length || estado.indiceAtual >= estado.codigos.length) return;

        estado.rodando = true;
        estado.pausaSolicitada = false;
        addLog(`Retomando no aluno ${estado.indiceAtual + 1}/${estado.codigos.length}.`, '#c4b5fd');
        atualizarBotoes();
        await processarLote();
    }

    function solicitarPausa() {
        if (!estado.rodando) return;
        estado.pausaSolicitada = true;
        addLog('Pausa solicitada. O script vai parar após o aluno atual.', '#fde68a');
        atualizarBotoes();
    }

    async function processarLote() {
        while (estado.indiceAtual < estado.codigos.length && estado.rodando) {
            const codigo = estado.codigos[estado.indiceAtual];
            atualizarProgresso(`Consultando aluno ${codigo}...`);
            addLog(`Aluno ${codigo}: consultando lista de históricos...`);

            try {
                const historicos = await consultarCodigosHistorico(codigo);

                if (!historicos.length) {
                    addLog(`Aluno ${codigo}: nenhuma progressão/dependência histórica selecionada.`, '#93c5fd');
                } else {
                    addLog(`Aluno ${codigo}: ${historicos.length} histórico(s) selecionado(s).`, '#93c5fd');
                }

                for (let h = 0; h < historicos.length; h++) {
                    const hist = historicos[h];
                    atualizarProgresso(`Aluno ${codigo}: extraindo histórico ${h + 1}/${historicos.length}...`);
                    const linhas = await extrairDetalheHistorico(hist);
                    estado.linhasHistorico.push(...linhas);
                    addLog(`Histórico ${hist.codigoHistorico}: ${linhas.length} área(s) extraída(s).`, '#d1fae5');
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                estado.erros.push({ codigo, erro: msg });
                addLog(`Aluno ${codigo}: ${msg}`, '#fca5a5');
            }

            estado.indiceAtual++;
            salvarCheckpoint();
            salvarResultadoParcial();
            renderizarTudo();

            if (estado.pausaSolicitada) {
                estado.rodando = false;
                estado.pausaSolicitada = false;
                salvarCheckpoint();
                addLog('Processamento pausado.', '#fde68a');
                atualizarBotoes();
                atualizarProgresso('Pausado. Clique em Retomar para continuar.');
                return;
            }

            await delay(INTERVALO_ENTRE_ALUNOS_MS);
        }

        estado.rodando = false;
        estado.fim = new Date().toISOString();
        salvarCheckpoint();
        salvarResultadoParcial();
        renderizarTudo();
        atualizarProgresso('Concluído.');
        addLog('Análise concluída.', '#86efac');
    }

    // =====================================================================
    // ESTADO / CHECKPOINT
    // =====================================================================

    function salvarCheckpoint() {
        salvarJson(CHAVE_CHECKPOINT, {
            codigos: estado.codigos,
            indiceAtual: estado.indiceAtual,
            linhasHistorico: estado.linhasHistorico,
            erros: estado.erros,
            inicio: estado.inicio,
            fim: estado.fim
        });
    }

    function salvarResultadoParcial() {
        const analisadas = analisarComLogicaPlanilha(estado.linhasHistorico);
        salvarJson(CHAVE_RESULTADO, {
            atualizadoEm: new Date().toISOString(),
            analisadas,
            relatorio: gerarRelatorioCompativelPlanilha(analisadas),
            pendenciasIndividuais: gerarPendenciasIndividuais(analisadas),
            erros: estado.erros
        });
    }

    function carregarEstadoAnterior() {
        const cp = carregarJson(CHAVE_CHECKPOINT);
        if (!cp?.codigos?.length) return;

        estado = {
            rodando: false,
            pausaSolicitada: false,
            codigos: cp.codigos || [],
            indiceAtual: Number(cp.indiceAtual || 0),
            linhasHistorico: Array.isArray(cp.linhasHistorico) ? cp.linhasHistorico : [],
            erros: Array.isArray(cp.erros) ? cp.erros : [],
            inicio: cp.inicio || null,
            fim: cp.fim || null
        };

        const campo = document.getElementById('dep-codigos');
        if (campo && !campo.value) campo.value = estado.codigos.join('\n');

        if (estado.linhasHistorico.length) {
            addLog(`Resultado anterior carregado: ${estado.linhasHistorico.length} linha(s) históricas.`, '#93c5fd');
        }
    }

    function limparTudo() {
        if (estado.rodando) {
            alert('Pause o processamento antes de limpar.');
            return;
        }

        if (!confirm('Limpar códigos, resultados, log e checkpoint deste analisador?')) return;

        estado = {
            rodando: false,
            pausaSolicitada: false,
            codigos: [],
            indiceAtual: 0,
            linhasHistorico: [],
            erros: [],
            inicio: null,
            fim: null
        };

        localStorage.removeItem(CHAVE_CHECKPOINT);
        localStorage.removeItem(CHAVE_RESULTADO);

        const campo = document.getElementById('dep-codigos');
        if (campo) campo.value = '';
        const log = document.getElementById('dep-log');
        if (log) log.innerHTML = '';
        renderizarTudo();
        atualizarProgresso('Aguardando...');
    }

    // =====================================================================
    // INTERFACE / RESUMO / RELATÓRIO
    // =====================================================================

    function obterAnaliseAtual() {
        const analisadas = analisarComLogicaPlanilha(estado.linhasHistorico);
        const relatorio = gerarRelatorioCompativelPlanilha(analisadas);
        const individuais = gerarPendenciasIndividuais(analisadas);
        return { analisadas, relatorio, individuais };
    }

    function renderizarTudo() {
        atualizarBotoes();
        atualizarProgresso();
        renderizarResumo();
    }

    function atualizarBotoes() {
        const iniciar = document.getElementById('dep-iniciar');
        const retomar = document.getElementById('dep-retomar');
        const pausar = document.getElementById('dep-pausar');

        const incompleto = estado.codigos.length > 0 && estado.indiceAtual < estado.codigos.length;

        if (iniciar) iniciar.disabled = estado.rodando;
        if (retomar) {
            retomar.style.display = !estado.rodando && incompleto && estado.indiceAtual > 0 ? '' : 'none';
            retomar.disabled = estado.rodando;
        }
        if (pausar) {
            pausar.disabled = !estado.rodando || estado.pausaSolicitada;
            pausar.textContent = estado.pausaSolicitada ? '⏳ Pausa solicitada...' : '⏸ Pausar';
        }

        const tem = estado.linhasHistorico.length > 0;
        ['dep-relatorio', 'dep-csv-alunos', 'dep-csv-detalhado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = !tem;
        });
    }

    function atualizarProgresso(mensagem) {
        const total = estado.codigos.length;
        const atual = Math.min(estado.indiceAtual, total);
        const pct = total ? Math.round((atual / total) * 100) : 0;

        const textoEl = document.getElementById('dep-progresso-texto');
        const pctEl = document.getElementById('dep-progresso-percentual');
        const barra = document.getElementById('dep-progresso-barra');

        if (textoEl) {
            textoEl.textContent = mensagem || (estado.rodando
                ? `Processando ${atual + 1} de ${total}...`
                : total && atual >= total
                    ? `Finalizado: ${total} de ${total} aluno(s).`
                    : total
                        ? `Processados ${atual} de ${total} aluno(s).`
                        : 'Aguardando...');
        }
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barra) barra.style.width = `${pct}%`;
    }

    function renderizarResumo() {
        const box = document.getElementById('dep-resumo');
        if (!box) return;

        if (!estado.linhasHistorico.length && !estado.erros.length) {
            box.innerHTML = 'Nenhum resultado ainda.';
            return;
        }

        const { analisadas, relatorio, individuais } = obterAnaliseAtual();
        const alunosConsultados = new Set(estado.codigos.slice(0, estado.indiceAtual)).size;
        const alunosComHistorico = new Set(estado.linhasHistorico.map(x => x.codigo)).size;
        const alunosPendentes = new Set(relatorio.map(x => x.codigo)).size;
        const dependencias = individuais.length;
        const pagas = individuais.filter(x => x.paga === 'SIM').length;
        const naoPagas = individuais.filter(x => x.paga === 'NÃO').length;

        box.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;">
                ${cardResumo('Alunos processados', alunosConsultados, '#065195')}
                ${cardResumo('Com histórico de DP', alunosComHistorico, '#6f42c1')}
                ${cardResumo('Dependências lidas', dependencias, '#495057')}
                ${cardResumo('Consideradas pagas', pagas, '#198754')}
                ${cardResumo('Ainda não pagas', naoPagas, '#dc3545')}
                ${cardResumo('Alunos no relatório', alunosPendentes, '#b02a37')}
            </div>
            <div style="margin-top:9px;font-size:10px;color:#5f6368;">
                ${analisadas.length} linha(s) de área analisada(s) • ${relatorio.length} linha(s) no relatório
                ${estado.erros.length ? ` • <span style="color:#dc3545"><b>${estado.erros.length}</b> erro(s)</span>` : ''}
            </div>
        `;
    }

    function cardResumo(rotulo, valor, cor) {
        return `
            <div style="border-left:4px solid ${cor};background:#f8f9fa;padding:8px;border-radius:4px;">
                <div style="font-size:18px;font-weight:bold;color:${cor};">${valor}</div>
                <div style="font-size:10px;color:#555;">${escaparHtml(rotulo)}</div>
            </div>
        `;
    }

    function obterNomeTecnico() {
        const loginSpan = document.getElementById('MPW0010TLOGIN');
        if (!loginSpan) return '';
        return normalizarTexto(loginSpan.innerText || loginSpan.textContent || '')
            .replace(/^USU.?RIO\s+LOGADO:\s*/i, '')
            .trim();
    }

    function formatarDataExtenso(data = new Date()) {
        const meses = [
            'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
        ];
        return `${String(data.getDate()).padStart(2, '0')} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
    }

    function abrirRelatorioImpressao() {
        const { relatorio } = obterAnaliseAtual();

        // SOMENTE PARA O PDF/IMPRESSÃO:
        // agrupa as linhas por aluno + série/ano, reunindo em uma única célula
        // todas as disciplinas pendentes daquele ano. Os CSVs permanecem
        // exatamente com a estrutura anterior.
        const mapaPdf = new Map();

        for (const r of relatorio) {
            const codigo = String(r.codigo || '');
            const aluno = limparNomeAluno(r.aluno);
            const serie = normalizarTexto(r.serie);
            const chave = `${codigo}|||${normalizarComparacao(serie)}`;

            if (!mapaPdf.has(chave)) {
                mapaPdf.set(chave, {
                    codigo,
                    aluno,
                    serie,
                    disciplinas: new Set()
                });
            }

            const grupo = mapaPdf.get(chave);
            for (const disciplina of r.disciplinas || []) {
                const nome = corrigirNomeDisciplina(disciplina);
                if (nome) grupo.disciplinas.add(nome);
            }
        }

        const relatorioPdf = Array.from(mapaPdf.values()).map(r => ({
            codigo: r.codigo,
            aluno: r.aluno,
            serie: r.serie,
            disciplinas: Array.from(r.disciplinas)
        }));

        // Ordenação SOMENTE do PDF:
        // 1) aluno em ordem alfabética;
        // 2) quando for o mesmo aluno, série/ano da dependência em ordem crescente
        //    (1º antes de 2º, 2º antes de 3º etc.).
        function ordemSeriePdf(serie) {
            const s = normalizarComparacao(serie);
            const m = s.match(/(\d{1,2})\s*[º°]?\s*(?:ANO|SERIE)?/i);
            return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
        }

        relatorioPdf.sort((a, b) => {
            const porNome = String(a.aluno || '').localeCompare(
                String(b.aluno || ''),
                'pt-BR',
                { sensitivity: 'base', numeric: true }
            );
            if (porNome !== 0) return porNome;

            // Se houver homônimos, mantém cada código de aluno agrupado.
            if (String(a.codigo) !== String(b.codigo)) {
                return String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });
            }

            const porAno = ordemSeriePdf(a.serie) - ordemSeriePdf(b.serie);
            if (porAno !== 0) return porAno;

            return String(a.serie || '').localeCompare(
                String(b.serie || ''),
                'pt-BR',
                { sensitivity: 'base', numeric: true }
            );
        });

        const janela = window.open('', '_blank');
        if (!janela) {
            alert('O navegador bloqueou a janela do relatório. Permita pop-ups para o SIGEDUCA e tente novamente.');
            return;
        }

        const brasao = new URL('../geral/imagem/BRASAO.jpg', location.href).href;
        const tecnico = obterNomeTecnico();
        const data = formatarDataExtenso();
        const totalAlunos = new Set(relatorioPdf.map(r => r.codigo)).size;
        const totalLinhas = relatorioPdf.length;

        const linhasTabela = relatorioPdf.length
            ? relatorioPdf.map(r => `
                <tr>
                    <td class="cod">${escaparHtml(r.codigo)}</td>
                    <td class="aluno">${escaparHtml(r.aluno)}</td>
                    <td class="serie">${escaparHtml(r.serie)}</td>
                    <td class="disciplinas">${r.disciplinas.map(d => escaparHtml(d)).join(', ')}</td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td colspan="4" class="sem-dados">Nenhuma dependência pendente foi identificada.</td>
                </tr>
            `;

        janela.document.open();
        janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Dependências</title>
    <style>
        @page {
            size: A4 landscape;
            /* Cabeçalho e rodapé agora fazem parte do fluxo normal da página.
               Assim nenhum navegador consegue posicioná-los por cima da tabela. */
            margin: 10mm 12mm 12mm 12mm;
        }

        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
            font-family: "Times New Roman", Times, serif;
            color: #000;
            background: #fff;
        }

        .cabecalho {
            position: static;
            width: 100%;
            height: auto;
            text-align: center;
            font-size: 8pt;
            line-height: 1.12;
            margin: 0 0 9mm 0;
            padding: 0 0 3mm 0;
            border-bottom: 0.25mm solid #b7b7b7;
        }
        .cabecalho img {
            display: block;
            height: 15mm;
            width: auto;
            margin: 0 auto 1.2mm;
        }
        .cabecalho .forte { font-weight: bold; }

        .rodape {
            position: static;
            width: 100%;
            height: auto;
            margin-top: 10mm;
            padding-top: 3mm;
            border-top: 0.25mm solid #b7b7b7;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7.5pt;
            line-height: 1.15;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .rodape-duplo {
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 8mm;
            align-items: start;
        }
        .rodape a { color: #0563c1; text-decoration: underline; }
        .rodape-escola { margin-top: 3mm; }

        .conteudo { width: 100%; }
        .titulo {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 0 0 5mm;
        }
        .meta {
            display: flex;
            justify-content: space-between;
            gap: 8mm;
            margin-bottom: 3mm;
            font-size: 9pt;
        }
        .meta .direita { text-align: right; }

        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8.5pt;
        }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th, td {
            border: 1px solid #000;
            padding: 1.6mm 1.5mm;
            vertical-align: top;
            overflow-wrap: anywhere;
        }
        th {
            text-align: center;
            font-weight: bold;
            background: #efefef;
        }
        td.cod { width: 18mm; text-align: center; }
        td.aluno { width: 70mm; }
        td.serie { width: 38mm; }
        td.disciplinas { width: auto; }
        .sem-dados { text-align: center; padding: 8mm; font-style: italic; }
        .assinatura-tecnica {
            margin-top: 4mm;
            text-align: right;
            font-size: 8pt;
        }

        @media screen {
            body {
                background: #ddd;
                width: 273mm;
                min-height: 190mm;
                margin: 8mm auto;
                padding: 10mm 12mm;
                box-shadow: 0 0 8px rgba(0,0,0,.25);
            }
            .conteudo { width: 100%; margin: 0; padding: 0; }
        }

        @media print {
            html, body { width: auto; min-height: 0; }
            body { background: #fff; }
            .cabecalho,
            .conteudo,
            .rodape { position: static !important; }
            .conteudo { margin: 0; padding: 0; }
        }
    </style>
</head>
<body>
    <header class="cabecalho">
        <img src="${brasao}" alt="Brasão do Estado de Mato Grosso">
        <div class="forte">Governo do Estado de Mato Grosso</div>
        <div>SEDUC – Secretaria de Estado de Educação</div>
        <div>Diretoria Regional de Educação - DRE de Cáceres – MT</div>
        <div class="forte">Escola Estadual Onze de Março</div>
    </header>

    <main class="conteudo">
        <div class="titulo">RELATÓRIO DE DEPENDÊNCIAS</div>

        <div class="meta">
            <div><b>Alunos com pendência:</b> ${totalAlunos} &nbsp;&nbsp; <b>Registros por aluno/ano:</b> ${totalLinhas}</div>
            <div class="direita">Cáceres/MT, ${escaparHtml(data)}.</div>
        </div>

        <table>
            <colgroup>
                <col style="width:18mm">
                <col style="width:70mm">
                <col style="width:38mm">
                <col>
            </colgroup>
            <thead>
                <tr>
                    <th>CÓDIGO</th>
                    <th>ALUNO</th>
                    <th>SÉRIE DA DEPENDÊNCIA</th>
                    <th>DISCIPLINAS PENDENTES</th>
                </tr>
            </thead>
            <tbody>${linhasTabela}</tbody>
        </table>

        ${tecnico ? `<div class="assinatura-tecnica">Relatório emitido por: <b>${escaparHtml(tecnico)}</b></div>` : ''}
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

    <script>
        window.addEventListener('load', function () {
            window.focus();
            setTimeout(function () { window.print(); }, 300);
        });
    <\/script>
</body>
</html>`);
        janela.document.close();
    }

    // =====================================================================
    // EXPORTAÇÕES
    // =====================================================================

    function csvEsc(v) {
        const s = String(v ?? '');
        return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    function baixarTexto(nome, conteudo, tipo = 'text/csv;charset=utf-8;') {
        const blob = new Blob(['\uFEFF' + conteudo], { type: tipo });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function dataArquivo() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function exportarCsvPorAluno() {
        const { relatorio } = obterAnaliseAtual();
        if (!relatorio.length) {
            alert('Não há dependências a pagar no relatório.');
            return;
        }

        const mapa = new Map();
        for (const r of relatorio) {
            if (!mapa.has(r.codigo)) {
                mapa.set(r.codigo, {
                    codigo: r.codigo,
                    aluno: limparNomeAluno(r.aluno),
                    disciplinas: new Set()
                });
            }

            // CSV POR ALUNO: somente os nomes das disciplinas pendentes.
            // Série e área continuam disponíveis no relatório normal e no CSV detalhado.
            for (const disciplina of r.disciplinas) {
                const nome = normalizarTexto(disciplina);
                if (nome) mapa.get(r.codigo).disciplinas.add(nome);
            }
        }

        const linhas = [['CÓDIGO', 'ALUNO', 'DEPENDÊNCIAS']];
        for (const a of mapa.values()) {
            linhas.push([
                a.codigo,
                limparNomeAluno(a.aluno),
                Array.from(a.disciplinas).join(' | ')
            ]);
        }

        baixarTexto(
            `dependencias_por_aluno_${dataArquivo()}.csv`,
            linhas.map(r => r.map(csvEsc).join(';')).join('\r\n')
        );
    }

    function exportarCsvDetalhado() {
        const { analisadas, individuais } = obterAnaliseAtual();
        if (!analisadas.length) {
            alert('Não há dados históricos extraídos.');
            return;
        }

        const cab = [
            'CÓDIGO', 'ALUNO', 'SITUAÇÃO HISTÓRICO', 'SÉRIE', 'ÁREA',
            'DISCIPLINA', 'DEPENDÊNCIA PAGA', 'CÓDIGO HISTÓRICO ORIGEM',
            'CÓDIGO HISTÓRICO PAGAMENTO', 'DETALHE PAGAMENTO'
        ];

        const linhas = [cab];
        for (const r of individuais) {
            const origem = analisadas.find(x => x.codigoHistorico === r.codigoHistoricoOrigem && x.codigo === r.codigo);
            linhas.push([
                r.codigo,
                limparNomeAluno(r.aluno),
                origem?.situacaoHistorico || '',
                r.serie,
                r.area,
                r.disciplina,
                r.paga,
                r.codigoHistoricoOrigem,
                r.codigoHistoricoPagamento,
                r.detalhePagamento
            ]);
        }

        // Também registra alunos/linhas que não contêm disciplina Dependente.
        for (const r of analisadas.filter(x => x.qtdDependentes === 0)) {
            linhas.push([
                r.codigo, limparNomeAluno(r.aluno), r.situacaoHistorico, r.serie, r.area,
                '', '', r.codigoHistorico, '', ''
            ]);
        }

        baixarTexto(
            `dependencias_detalhado_${dataArquivo()}.csv`,
            linhas.map(r => r.map(csvEsc).join(';')).join('\r\n')
        );
    }

})();
