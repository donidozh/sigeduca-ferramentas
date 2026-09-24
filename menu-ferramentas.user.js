// ==UserScript==
// @name         SIGEDUCA - Menu Lateral de Ferramentas (Base)
// @namespace    http://tampermonkey.net/
// @version      2.8.1
// @description  Menu lateral independente para centralizar os userscripts instalados no SIGEDUCA.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @match        *://sigeduca.seduc.mt.gov.br/grh/
// @match        *://sigeduca.seduc.mt.gov.br/grh/*
// @match        *://sigeduca.seduc.mt.gov.br/gpo/
// @match        *://sigeduca.seduc.mt.gov.br/gpo/*
// @run-at       document-start
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/menu-ferramentas.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/menu-ferramentas.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// @grant        GM_info
// ==/UserScript==

(function () {
    'use strict';

    // A versão vem do cabeçalho instalado no Tampermonkey.
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '2.8.1',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/menu-ferramentas.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/menu-ferramentas.user.js'
    });

    // Executa somente no documento principal.
    // Evita criar uma segunda cópia do menu em iframes do SIGEDUCA.
    if (window.top !== window.self) {
        return;
    }

    // O caminho é a referência do módulo; o nome exibido pode ser diferente.
    const MODULOS = Object.freeze({
        ged: { id: 'ged', nome: 'GED', descricao: 'Gestão Escolar' },
        grh: { id: 'grh', nome: 'GPE', descricao: 'Gestão de Pessoas' },
        gpo: { id: 'gpo', nome: 'GPO', descricao: 'GPO' }
    });
    function detectarModulo(caminho) {
        const id = /^\/([^/]+)(?:\/|$)/.exec(String(caminho || '').toLowerCase())?.[1];
        return MODULOS[id] || null;
    }
    const MODULO_ATUAL = detectarModulo(window.location.pathname);
    if (!MODULO_ATUAL) return;

    // Preserva o azul original do GED e aplica a paleta do GPE à interface inteira.
    const CORES_GPE = {
        "#065195": "#9E242B",
        "#005DA4": "#B52C34",
        "#034478": "#7D1820",
        "#DCEAF6": "#F5DFE1",
        "#EEF5FB": "#FCF2F3",
        "#1E2A33": "#342126",
        "#64798A": "#80676B",
        "#C8D8E5": "#E6C7CB",
        "#F5F9FC": "#FCF7F8",
        "#AFC7D9": "#D9AFB5",
        "#E8F2F9": "#F8E8EB",
        "#B8CDDD": "#DDB8BE",
        "#29455A": "#5A2933",
        "#AFC4D5": "#D5AFB6",
        "#5E7689": "#895E69",
        "#C8DCEB": "#EBC8CF",
        "#17344A": "#4A1724",
        "#71879A": "#9A717C",
        "#7F9AAF": "#AF7F8C",
        "#758B9C": "#9C7580",
        "#d8e0eb": "#ebd8dc",
        "#203047": "#47202C",
        "#526178": "#78525F",
        "#1958b7": "#9E242B",
        "#85baff": "#E6A0AB",
        "rgba(0, 55, 100, .24)": "rgba(130,25,35,.24)",
        "rgba(0, 55, 100, .18)": "rgba(130,25,35,.18)",
        "rgba(0, 81, 149, .09)": "rgba(130,25,35,.09)",
        "rgba(0, 93, 164, .12)": "rgba(130,25,35,.12)"
};
    const CORES_GPO = {
        "#065195": "#A94708",
        "#005DA4": "#BD520A",
        "#034478": "#813604",
        "#DCEAF6": "#F8E4D2",
        "#EEF5FB": "#FFF5EB",
        "#1E2A33": "#392C21",
        "#64798A": "#806C59",
        "#C8D8E5": "#E6D1BA",
        "#F5F9FC": "#FFFAF4",
        "#AFC7D9": "#D9BE9F",
        "#E8F2F9": "#F9EAD8",
        "#B8CDDD": "#DDC6AA",
        "#29455A": "#5A4029",
        "#AFC4D5": "#D5BDA2",
        "#5E7689": "#89705E",
        "#C8DCEB": "#EBD7BD",
        "#17344A": "#4A3017",
        "#71879A": "#9A826B",
        "#7F9AAF": "#AF967B",
        "#758B9C": "#9C846C",
        "#d8e0eb": "#EBDFCD",
        "#203047": "#473420",
        "#526178": "#786652",
        "#1958b7": "#A94708",
        "#85baff": "#E9B57C",
        "rgba(0, 55, 100, .24)": "rgba(140,70,10,.24)",
        "rgba(0, 55, 100, .18)": "rgba(140,70,10,.18)",
        "rgba(0, 81, 149, .09)": "rgba(140,70,10,.09)",
        "rgba(0, 93, 164, .12)": "rgba(140,70,10,.12)"
};
    function corDoModulo(cor) {
        if (MODULO_ATUAL.id === "gpo") return CORES_GPO[cor] || cor;
        return MODULO_ATUAL.id === 'grh' ? (CORES_GPE[cor] || cor) : cor;
    }

    // =====================================================================
    // SIGEDUCA - MENU LATERAL DE FERRAMENTAS / NÚCLEO MODULAR
    // =====================================================================
    //
    // Esta versão NÃO altera o menu original do SIGEDUCA e NÃO depende de:
    //
    //   - GXState
    //   - JSCookMenu
    //   - MPW0010vMENUDATACOLLECTION
    //   - qualquer elemento visual do SIGEDUCA
    //
    // Ela cria uma interface própria, fixa na lateral esquerda.
    //
    // Os módulos já existentes podem continuar usando o mesmo protocolo:
    //
    //   sigeduca:ferramentas:registrar
    //   sigeduca:ferramentas:solicitar-registro
    //   sigeduca:ferramentas:base-pronta
    //
    // Exemplo de registro feito por outro userscript:
    //
    // window.dispatchEvent(new CustomEvent('sigeduca:ferramentas:registrar', {
    //     detail: {
    //         id: 'requerimentos',
    //         titulo: 'Requerimentos',
    //         url: 'hwgedboletim.aspx?0&req=1',
    //         descricao: 'Central de Requerimentos',
    //         ordem: 10,
    //         grupo: 'Secretaria',
    //         grupoOrdem: 10,
    //
    //         // Campos opcionais para atualização automática:
    //         versao: '1.0.0',
    //         updateUrl: 'https://raw.githubusercontent.com/USUARIO/REPO/main/scripts/requerimentos.user.js',
    //         installUrl: 'https://raw.githubusercontent.com/USUARIO/REPO/main/scripts/requerimentos.user.js'
    //     }
    // }));
    //
    // =====================================================================

    const FLAG = '__SIGEDUCA_MENU_LATERAL_FERRAMENTAS_BASE_V2__';
    if (window[FLAG]) return;
    window[FLAG] = true;

    const VERSAO_BASE = ATUALIZACAO_SCRIPT.versao;
    const ATUALIZACAO_BASE = Object.freeze({
        id: '__menu_base__', titulo: 'Menu Ferramentas', ...ATUALIZACAO_SCRIPT
    });

    // ---------------------------------------------------------------------
    // PROTOCOLO ENTRE USERSCRIPTS
    // ---------------------------------------------------------------------

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    // ---------------------------------------------------------------------
    // CONFIGURAÇÃO DO PAINEL
    // ---------------------------------------------------------------------

    const CONFIG = {
        largura: 330,
        titulo: 'Ferramentas',
        subtitulo: 'SIGEDUCA · ' + MODULO_ATUAL.nome,
        posicaoBotao: '45%',
        fecharAoNavegar: true,
        fecharComEscape: true,
        fecharAoClicarFora: true,

        // Catálogo público com links de instalação.
        instaladorUrl: 'https://github.com/donidozh/sigeduca-ferramentas#instalacao',

        // Verificação automática das versões publicadas no GitHub.
        verificarAtualizacoes: true,
        intervaloVerificacaoMs: 15 * 60 * 1000
    };

    // Registro válido somente durante a página atual.
    // Se um módulo for desativado no Tampermonkey, ele desaparece
    // naturalmente após a próxima navegação/recarregamento.
    const ferramentas = new Map();
    const CATALOGO_URL = 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/catalogo.json';
    let catalogo = [];
    let catalogoEstado = 'inicial';
    let catalogoAberto = false;
    let catalogoUltimaConsulta = 0;
    let catalogoPedido = null;

    let host = null;
    let shadow = null;
    let refs = null;
    let painelAberto = false;
    let renderAgendado = false;
    let interfaceCriada = false;

    // Status de atualização por id da ferramenta.
    // Ex.: { estado: 'disponivel', versaoRemota: '1.2.0' }
    const statusAtualizacoes = new Map();

    let ultimaVerificacaoAtualizacoes = 0;
    let verificacaoAtualizacoesEmAndamento = false;
    let timerAviso = null;

    // ---------------------------------------------------------------------
    // UTILIDADES
    // ---------------------------------------------------------------------

    function decodificarEntidadesHTML(texto) {
        const el = document.createElement('textarea');
        el.innerHTML = String(texto || '');
        return el.value;
    }

    function normalizarTitulo(texto) {
        return decodificarEntidadesHTML(texto)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function resolverURL(url) {
        try {
            return new URL(String(url || ''), window.location.href);
        } catch (_) {
            return null;
        }
    }

    function sanitizarFerramenta(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const id = String(raw.id || '').trim();
        const titulo = String(raw.titulo || raw.title || '').trim();
        const url = String(raw.url || '').trim();
        const descricao = String(raw.descricao || raw.description || '').trim();
        const grupo = String(raw.grupo || '').trim();
        const target = String(raw.target || '_self').trim() || '_self';
        const icone = String(raw.icone || raw.icon || '').trim();

        // Metadados opcionais usados pela Central de Atualizações.
        const versao = String(raw.versao || raw.version || '').trim();
        const updateUrl = String(
            raw.updateUrl || raw.updateURL || raw.urlAtualizacao || ''
        ).trim();
        const installUrl = String(
            raw.installUrl || raw.downloadUrl || raw.downloadURL || updateUrl || ''
        ).trim();

        // Campo temporário útil enquanto ainda estivermos testando sem GitHub.
        const atualizacaoDisponivel = raw.atualizacaoDisponivel === true;

        const ordemNum = Number(raw.ordem);
        const ordem = Number.isFinite(ordemNum) ? ordemNum : 1000;

        const grupoOrdemNum = Number(raw.grupoOrdem);
        const grupoOrdem = Number.isFinite(grupoOrdemNum) ? grupoOrdemNum : 1000;

        if (!id || !titulo || !url) {
            console.warn(
                '[Menu Lateral] Registro ignorado: id, titulo e url são obrigatórios.',
                raw
            );
            return null;
        }

        const u = resolverURL(url);

        if (!u) {
            console.warn('[Menu Lateral] URL inválida:', url);
            return null;
        }

        // Cada módulo só registra links da sua própria área do SIGEDUCA.
        if (!/^https?:$/.test(u.protocol)) {
            console.warn('[Menu Lateral] Protocolo não permitido:', url);
            return null;
        }

        if (u.origin !== window.location.origin) {
            console.warn('[Menu Lateral] URL externa não permitida:', url);
            return null;
        }

        if (detectarModulo(u.pathname)?.id !== MODULO_ATUAL.id ||
            (raw.modulo && raw.modulo !== MODULO_ATUAL.id)) {
            console.warn('[Menu Lateral] A URL não pertence ao módulo atual:', url);
            return null;
        }

        return {
            id,
            titulo,
            url,
            descricao,
            grupo,
            target,
            ordem,
            grupoOrdem,
            icone,
            versao,
            updateUrl,
            installUrl,
            atualizacaoDisponivel
        };
    }

    function assinaturaFerramenta(item) {
        return JSON.stringify([
            item.id,
            item.titulo,
            item.url,
            item.descricao,
            item.grupo,
            item.target,
            item.ordem,
            item.grupoOrdem,
            item.icone,
            item.versao,
            item.updateUrl,
            item.installUrl,
            item.atualizacaoDisponivel
        ]);
    }

    function criarElemento(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined && texto !== null) {
            el.textContent = String(texto);
        }
        return el;
    }


    // ---------------------------------------------------------------------
    // CENTRAL DE INSTALAÇÃO / ATUALIZAÇÕES
    // ---------------------------------------------------------------------

    function normalizarVersao(valor) {
        return String(valor || '')
            .trim()
            .replace(/^v/i, '');
    }

    function compararVersoes(a, b) {
        // Retorna:
        //  > 0 se A for maior que B
        //  < 0 se A for menor que B
        //  = 0 se equivalentes
        const va = normalizarVersao(a).split(/[.\-+_]/);
        const vb = normalizarVersao(b).split(/[.\-+_]/);
        const tamanho = Math.max(va.length, vb.length);

        for (let i = 0; i < tamanho; i++) {
            const pa = va[i] ?? '0';
            const pb = vb[i] ?? '0';

            const na = /^\d+$/.test(pa) ? Number(pa) : null;
            const nb = /^\d+$/.test(pb) ? Number(pb) : null;

            if (na !== null && nb !== null) {
                if (na !== nb) return na > nb ? 1 : -1;
                continue;
            }

            const comparacao = String(pa).localeCompare(
                String(pb),
                'pt-BR',
                { numeric: true, sensitivity: 'base' }
            );

            if (comparacao !== 0) return comparacao;
        }

        return 0;
    }

    function extrairVersaoUserscript(conteudo) {
        const match = String(conteudo || '').match(
            /^\s*\/\/\s*@version\s+([^\s]+)\s*$/mi
        );

        return match ? String(match[1]).trim() : '';
    }

    function validarURLAtualizacao(valor) {
        try {
            const u = new URL(valor);
            if (u.protocol !== 'https:' || u.hostname !== 'raw.githubusercontent.com' ||
                u.username || u.password || u.port ||
                !u.pathname.startsWith('/donidozh/sigeduca-ferramentas/main/') ||
                !u.pathname.endsWith('.user.js')) return '';
            return u.href;
        } catch (_) { return ''; }
    }

    function requisitarTexto(url) {
        url = url === CATALOGO_URL ? url : validarURLAtualizacao(url);
        return new Promise((resolve, reject) => {
            if (!url) {
                reject(new Error('URL de atualização não informada.'));
                return;
            }

            // Tampermonkey: permite consultar o raw.githubusercontent.com
            // mesmo estando dentro do domínio do SIGEDUCA.
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    anonymous: true,
                    timeout: 12000,
                    headers: {
                        'Cache-Control': 'no-cache'
                    },
                    onload: (resposta) => {
                        if (
                            resposta.status >= 200 &&
                            resposta.status < 300
                        ) {
                            resolve(resposta.responseText || '');
                            return;
                        }

                        reject(
                            new Error(
                                `HTTP ${resposta.status || 'desconhecido'}`
                            )
                        );
                    },
                    ontimeout: () => reject(
                        new Error('Tempo limite ao consultar atualização.')
                    ),
                    onerror: () => reject(
                        new Error('Falha ao consultar atualização.')
                    )
                });

                return;
            }

            // Fallback para ambientes em que fetch cross-origin seja aceito.
            fetch(url, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(12000) })
                .then((resposta) => {
                    if (!resposta.ok) {
                        throw new Error(`HTTP ${resposta.status}`);
                    }
                    return resposta.text();
                })
                .then(resolve)
                .catch(reject);
        });
    }

    function contarAtualizacoesDisponiveis() {
        let total = 0;

        for (const status of statusAtualizacoes.values()) {
            if (status?.estado === 'disponivel') {
                total++;
            }
        }

        return total;
    }

    function atualizarContadorCabecalho() {
        if (!refs?.contador) return;

        const statusBase = statusAtualizacoes.get(ATUALIZACAO_BASE.id);
        if (refs.atualizarBase) {
            refs.atualizarBase.hidden = statusBase?.estado !== 'disponivel';
            refs.atualizarBase.textContent = 'Atualizar menu para v' + (statusBase?.versaoRemota || '');
        }
        const total = ferramentas.size;
        const atualizacoes = contarAtualizacoesDisponiveis();

        let texto =
            total === 0
                ? 'Nenhuma ferramenta registrada'
                : total === 1
                    ? '1 ferramenta disponível'
                    : `${total} ferramentas disponíveis`;

        if (atualizacoes === 1) {
            texto += ' • 1 atualização';
        } else if (atualizacoes > 1) {
            texto += ` • ${atualizacoes} atualizações`;
        }

        refs.contador.textContent = texto;
    }

    function mostrarAviso(mensagem, tipo = 'info') {
        if (!refs?.aviso) return;

        clearTimeout(timerAviso);

        refs.aviso.textContent = String(mensagem || '');
        refs.aviso.dataset.tipo = tipo;
        refs.aviso.classList.add('visivel');

        timerAviso = setTimeout(() => {
            refs?.aviso?.classList.remove('visivel');
        }, 5000);
    }

    function abrirInstalador() {
        catalogoAberto = !catalogoAberto;
        agendarRenderizacao();
        if (catalogoAberto) carregarCatalogo(true);
    }

    function validarCatalogo(dados) {
        if (dados?.formato !== 1 || !Array.isArray(dados.ferramentas) || dados.ferramentas.length > 100) {
            throw new Error('Formato de catálogo inválido.');
        }
        const ids = new Set();
        return dados.ferramentas.map(item => {
            if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) ||
                typeof item.titulo !== 'string' || !item.titulo.trim() || item.titulo.length > 120 ||
                typeof item.descricao !== 'string' || item.descricao.length > 500 ||
                typeof item.arquivo !== 'string' || !/^(?:(?:ged|gpe|gpo)\/)?[a-z0-9-]+\.user\.js$/.test(item.arquivo) ||
                !Array.isArray(item.registros) || item.registros.length > 20 ||
                item.registros.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id))) {
                throw new Error('Ferramenta inválida no catálogo.');
            }
            ids.add(item.id);
            // Compatibilidade: os catálogos antigos pertenciam somente ao GED.
            const modulos = item.modulos === undefined ? ['ged'] : item.modulos;
            if (!Array.isArray(modulos) || !modulos.length || modulos.length > 20 ||
                modulos.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,19}$/.test(id))) {
                throw new Error('Módulo inválido no catálogo.');
            }
            const installUrl = new URL(item.arquivo, CATALOGO_URL).href;
            if (!validarURLAtualizacao(installUrl)) throw new Error('Endereço de instalação inválido.');
            return { id: item.id, titulo: item.titulo.trim(), descricao: item.descricao,
                registros: [...item.registros], modulos: [...new Set(modulos)], installUrl };
        });
    }

    async function carregarCatalogo(forcar = false) {
        if (catalogoPedido) return catalogoPedido;
        if (!forcar && catalogoUltimaConsulta && Date.now() - catalogoUltimaConsulta < CONFIG.intervaloVerificacaoMs) return;
        catalogoEstado = 'carregando';
        agendarRenderizacao();
        catalogoPedido = (async () => {
            try {
                const texto = await requisitarTexto(CATALOGO_URL);
                if (texto.length > 200000) throw new Error('Catálogo grande demais.');
                catalogo = validarCatalogo(JSON.parse(texto)).filter(item => item.modulos.includes(MODULO_ATUAL.id));
                catalogoUltimaConsulta = Date.now();
                catalogoEstado = 'pronto';
            } catch (_) {
                // Mantém o último catálogo válido apenas na página atual.
                catalogoEstado = 'erro';
            } finally {
                catalogoPedido = null;
                agendarRenderizacao();
            }
        })();
        return catalogoPedido;
    }

    function ferramentaDetectada(item) {
        return item.registros.some(id => ferramentas.has(id));
    }

    function renderizarCatalogo() {
        const disponiveis = catalogo.filter(item => !ferramentaDetectada(item));
        if (refs.instalar) {
            refs.instalar.textContent = catalogoAberto ? 'Voltar às ferramentas' :
                'Adicionar ferramentas' + (catalogoEstado === 'pronto' ? ' (' + disponiveis.length + ')' : '');
            refs.instalar.setAttribute('aria-expanded', String(catalogoAberto || !ferramentas.size));
        }
        if (!catalogoAberto && ferramentas.size) return;
        const secao = criarElemento('section', 'sig-grupo');
        secao.appendChild(criarElemento('h3', 'sig-grupo-titulo', 'Central de ferramentas · ' + MODULO_ATUAL.nome));
        const ajuda = criarElemento('p', 'sig-catalogo-ajuda',
            'Escolha uma ferramenta, confirme no Tampermonkey e recarregue o SigEduca. As novidades aparecem aqui automaticamente.');
        secao.appendChild(ajuda);
        if (catalogoEstado === 'inicial' || catalogoEstado === 'carregando') {
            secao.appendChild(criarElemento('p', 'sig-catalogo-ajuda', 'Buscando ferramentas…'));
        }
        if (catalogoEstado === 'erro') {
            secao.appendChild(criarElemento('p', 'sig-catalogo-ajuda',
                'Não foi possível consultar as novidades.' + (catalogo.length ? ' Exibindo a última lista carregada nesta página.' : '')));
            const tentar = criarElemento('button', 'sig-catalogo-instalar', 'Tentar novamente');
            tentar.type = 'button';
            tentar.addEventListener('click', () => carregarCatalogo(true));
            secao.appendChild(tentar);
        }
        for (const item of catalogo) {
            const card = criarElemento('div', 'sig-catalogo-card');
            card.appendChild(criarElemento('strong', '', item.titulo));
            card.appendChild(criarElemento('p', 'sig-catalogo-ajuda', item.descricao));
            const detectada = ferramentaDetectada(item);
            if (detectada) {
                card.appendChild(criarElemento('span', 'sig-catalogo-status', 'Ativa nesta página'));
            } else {
                const instalar = criarElemento('button', 'sig-catalogo-instalar',
                    item.registros.length ? 'Instalar' : 'Instalar / reinstalar');
                instalar.type = 'button';
                instalar.addEventListener('click', () => {
                    abrirAtualizacao(item);
                    mostrarAviso('Confirme a instalação no Tampermonkey e depois recarregue o SigEduca.');
                });
                card.appendChild(instalar);
                if (!item.registros.length) card.appendChild(criarElemento('p', 'sig-catalogo-ajuda',
                    'Funciona em uma tela específica; o menu não consegue confirmar se já está instalada.'));
            }
            secao.appendChild(card);
        }
        if (catalogoEstado === 'pronto' && !catalogo.length) {
            secao.appendChild(criarElemento('p', 'sig-catalogo-ajuda', 'Ainda não há ferramentas publicadas para ' + MODULO_ATUAL.nome + '. As novas ferramentas aparecerão aqui quando forem disponibilizadas.'));
        }
        secao.appendChild(criarElemento('p', 'sig-catalogo-ajuda',
            'Uma ferramenta desativada também pode aparecer como disponível. Confira o Tampermonkey antes de reinstalar.'));
        refs.conteudo.appendChild(secao);
    }

    function abrirAtualizacao(item) {
        const url = validarURLAtualizacao(item.installUrl || item.updateUrl);

        if (!url) {
            mostrarAviso(
                `A ferramenta "${item.titulo}" ainda não possui URL de instalação/atualização configurada.`,
                'erro'
            );
            return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    async function verificarAtualizacaoDaFerramenta(item) {
        // Modo manual para testar o visual antes do GitHub.
        if (item.atualizacaoDisponivel) {
            statusAtualizacoes.set(item.id, {
                estado: 'disponivel',
                versaoLocal: item.versao || '',
                versaoRemota: 'teste'
            });
            return;
        }

        if (!item.versao || !item.updateUrl) {
            statusAtualizacoes.delete(item.id);
            return;
        }

        statusAtualizacoes.set(item.id, {
            estado: 'verificando',
            versaoLocal: item.versao,
            versaoRemota: ''
        });

        agendarRenderizacao();

        try {
            const conteudo = await requisitarTexto(item.updateUrl);
            const versaoRemota = extrairVersaoUserscript(conteudo);

            if (!versaoRemota) {
                throw new Error(
                    'Não foi possível encontrar @version no userscript remoto.'
                );
            }

            const nova =
                compararVersoes(versaoRemota, item.versao) > 0;

            statusAtualizacoes.set(item.id, {
                estado: nova ? 'disponivel' : 'atualizado',
                versaoLocal: item.versao,
                versaoRemota
            });
        } catch (erro) {
            console.debug(
                `[Menu Lateral] Falha ao verificar ${item.titulo}:`,
                erro
            );

            statusAtualizacoes.set(item.id, {
                estado: 'erro',
                versaoLocal: item.versao,
                versaoRemota: '',
                erro: String(erro?.message || erro)
            });
        }
    }

    async function verificarAtualizacoes(forcar = false) {
        if (!CONFIG.verificarAtualizacoes) return;
        if (verificacaoAtualizacoesEmAndamento) return;

        const agora = Date.now();

        if (
            !forcar &&
            ultimaVerificacaoAtualizacoes &&
            agora - ultimaVerificacaoAtualizacoes <
                CONFIG.intervaloVerificacaoMs
        ) {
            return;
        }

        const lista = [ATUALIZACAO_BASE, ...ferramentas.values()].filter(
            item =>
                item.atualizacaoDisponivel ||
                (item.versao && item.updateUrl)
        );

        if (!lista.length) {
            if (forcar) {
                mostrarAviso(
                    'Nenhuma ferramenta informou versão e URL de atualização ainda.',
                    'info'
                );
            }
            return;
        }

        verificacaoAtualizacoesEmAndamento = true;

        if (refs?.verificar) {
            refs.verificar.classList.add('verificando');
            refs.verificar.disabled = true;
        }

        try {
            await Promise.all(
                lista.map(item => verificarAtualizacaoDaFerramenta(item))
            );

            ultimaVerificacaoAtualizacoes = Date.now();
            agendarRenderizacao();

            if (forcar) {
                const total = contarAtualizacoesDisponiveis();

                const erros = lista.filter(item => statusAtualizacoes.get(item.id)?.estado === 'erro').length;
                const semConfiguracao = Array.from(ferramentas.values()).filter(item => !item.versao || !item.updateUrl).length;
                const resumo = total
                    ? (total === 1 ? '1 atualização disponível.' : total + ' atualizações disponíveis.')
                    : (erros ? 'Não foi possível concluir a verificação.' : 'Menu e ferramentas verificadas estão atualizados.');
                mostrarAviso(
                    resumo + (erros ? ' Falha ao consultar ' + erros + ' item(ns). Tente novamente.' : '') +
                    (semConfiguracao ? ' ' + semConfiguracao + ' ferramenta(s) ainda precisam ser reinstaladas pelo catálogo.' : ''),
                    erros ? 'erro' : total ? 'atualizacao' : 'sucesso'
                );
            }
        } finally {
            verificacaoAtualizacoesEmAndamento = false;

            if (refs?.verificar) {
                refs.verificar.classList.remove('verificando');
                refs.verificar.disabled = false;
            }

            atualizarContadorCabecalho();
        }
    }

    // ---------------------------------------------------------------------
    // REGISTRO MODULAR
    // ---------------------------------------------------------------------

    function registrarFerramenta(raw) {
        const item = sanitizarFerramenta(raw);
        if (!item) return;

        const anterior = ferramentas.get(item.id);

        if (
            anterior &&
            assinaturaFerramenta(anterior) === assinaturaFerramenta(item)
        ) {
            return;
        }

        ferramentas.set(item.id, item);

        // Permite testar a aparência de "Atualização disponível"
        // antes mesmo de o repositório GitHub existir.
        if (item.atualizacaoDisponivel) {
            statusAtualizacoes.set(item.id, {
                estado: 'disponivel',
                versaoLocal: item.versao || '',
                versaoRemota: 'teste'
            });
        }

        console.debug(
            `[Menu Lateral] Registrado: ${item.titulo} (${item.id})`
        );

        agendarRenderizacao();
    }

    window.addEventListener(EVENTO_REGISTRAR, (evento) => {
        registrarFerramenta(evento.detail);
    });

    function solicitarRegistros() {
        window.dispatchEvent(
            new CustomEvent(EVENTO_SOLICITAR, {
                detail: { versaoBase: VERSAO_BASE }
            })
        );
    }

    // Mantém a API global com o mesmo nome da versão anterior,
    // acrescentando controles do novo painel.
    window.SIGEDUCA_MENU_FERRAMENTAS = {
        versao: VERSAO_BASE,
        solicitarRegistros,
        abrir: () => definirPainelAberto(true),
        fechar: () => definirPainelAberto(false),
        alternar: () => definirPainelAberto(!painelAberto),
        listar: () => Array.from(ferramentas.values()).map(item => ({ ...item })),
        verificarAtualizacoes: () => verificarAtualizacoes(true),
        configurarInstalador: (url) => {
            CONFIG.instaladorUrl = String(url || '').trim();
            return CONFIG.instaladorUrl;
        }
    };

    // ---------------------------------------------------------------------
    // INTERFACE
    // ---------------------------------------------------------------------

    function criarInterface() {
        if (interfaceCriada) return true;
        if (!document.documentElement) return false;

        // Proteção extra contra reinjeções/reexecuções no documento principal.
        const hostExistente = document.getElementById('sigeduca-ferramentas-lateral-host');
        if (hostExistente) {
            interfaceCriada = true;
            return true;
        }

        host = document.createElement('div');
        host.id = 'sigeduca-ferramentas-lateral-host';

        // Isola totalmente o CSS do painel do CSS antigo do SIGEDUCA.
        shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            .sig-catalogo-card { margin: 10px 0; padding: 12px; border: 1px solid ${corDoModulo("#d8e0eb")}; border-radius: 10px; background: #fff; color: ${corDoModulo("#203047")}; font-size: 13px; }
            .sig-catalogo-ajuda { margin: 8px 0; font-size: 12px; line-height: 1.5; color: ${corDoModulo("#526178")}; }
            .sig-catalogo-instalar { border: 0; border-radius: 7px; background: ${corDoModulo("#1958b7")}; color: white; padding: 8px 12px; font: inherit; cursor: pointer; }
            .sig-catalogo-instalar:focus-visible { outline: 3px solid ${corDoModulo("#85baff")}; outline-offset: 2px; }
            .sig-catalogo-status { color: #176642; font-size: 12px; font-weight: 600; }
            :host {
                all: initial;
            }

            *,
            *::before,
            *::after {
                box-sizing: border-box;
            }

            .sig-shell {
                --sig-width: ${CONFIG.largura}px;
                --sig-primary: ${corDoModulo("#065195")};
                --sig-primary-hover: ${corDoModulo("#005DA4")};
                --sig-primary-dark: ${corDoModulo("#034478")};
                --sig-primary-soft: ${corDoModulo("#DCEAF6")};
                --sig-primary-softer: ${corDoModulo("#EEF5FB")};
                --sig-text: ${corDoModulo("#1E2A33")};
                --sig-muted: ${corDoModulo("#64798A")};
                --sig-line: ${corDoModulo("#C8D8E5")};
                --sig-bg: ${corDoModulo("#F5F9FC")};
                --sig-white: #FFFFFF;

                position: fixed;
                inset: 0;
                z-index: 2147483000;
                pointer-events: none;
                font-family:
                    Verdana, Arial, Helvetica, sans-serif;
            }

            .sig-overlay {
                position: fixed;
                inset: 0;
                border: 0;
                margin: 0;
                padding: 0;
                background: ${corDoModulo("rgba(0, 55, 100, .24)")};
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition:
                    opacity .28s ease,
                    visibility .28s ease;
            }

            .sig-shell.aberto .sig-overlay {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
            }

            .sig-painel {
                position: fixed;
                top: 0;
                bottom: 0;
                left: 0;
                width: var(--sig-width);
                max-width: calc(100vw - 56px);
                display: flex;
                flex-direction: column;
                background: var(--sig-bg);
                color: var(--sig-text);
                border-right: 1px solid ${corDoModulo("#AFC7D9")};
                box-shadow: 8px 0 32px ${corDoModulo("rgba(0, 55, 100, .18)")};
                transform: translate3d(calc(-100% - 12px), 0, 0);
                transition:
                    transform .30s cubic-bezier(.22, .61, .36, 1);
                pointer-events: auto;
                overflow: hidden;
                will-change: transform;
            }

            .sig-shell.aberto .sig-painel {
                transform: translate3d(0, 0, 0);
            }

            .sig-acionador {
                position: fixed;
                left: 0;
                top: ${CONFIG.posicaoBotao};
                transform: translateY(-50%);
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0;
                border: 1px solid ${corDoModulo("#034478")};
                border-left: 0;
                border-radius: 0 5px 5px 0;
                margin: 0;
                padding: 0;
                overflow: hidden;
                background: var(--sig-primary);
                color: #FFFFFF;
                box-shadow: 2px 2px 6px rgba(0, 0, 0, .18);
                cursor: pointer;
                pointer-events: auto;
                font-family: Verdana, Arial, Helvetica, sans-serif;
                font-size: 11px;
                line-height: 1;
                font-weight: 700;
                letter-spacing: .1px;
                white-space: nowrap;
                transition:
                    left .30s cubic-bezier(.22, .61, .36, 1),
                    width .24s cubic-bezier(.22, .61, .36, 1),
                    padding .24s cubic-bezier(.22, .61, .36, 1),
                    gap .24s cubic-bezier(.22, .61, .36, 1),
                    background .16s ease,
                    border-color .16s ease,
                    box-shadow .16s ease,
                    transform .16s ease;
            }

            .sig-shell:not(.aberto) .sig-acionador:hover {
                width: 128px;
                gap: 8px;
                padding: 0 12px 0 13px;
                background: var(--sig-primary-hover);
                border-color: var(--sig-primary-dark);
                box-shadow: 2px 3px 8px rgba(0, 0, 0, .22);
            }

            .sig-acionador:active {
                transform: translateY(-50%) scale(.98);
            }

            .sig-shell.aberto .sig-acionador,
            .sig-shell.aberto .sig-acionador:hover {
                left: min(var(--sig-width), calc(100vw - 40px));
                width: 40px;
                gap: 0;
                padding: 0;
                background: var(--sig-primary);
                border-color: var(--sig-primary-dark);
            }

            .sig-acionador-texto {
                display: block;
                max-width: 0;
                opacity: 0;
                overflow: hidden;
                white-space: nowrap;
                transform: translateX(-5px);
                transition:
                    max-width .24s cubic-bezier(.22, .61, .36, 1),
                    opacity .16s ease,
                    transform .24s cubic-bezier(.22, .61, .36, 1);
            }

            .sig-shell:not(.aberto) .sig-acionador:hover .sig-acionador-texto {
                max-width: 82px;
                opacity: 1;
                transform: translateX(0);
            }

            .sig-shell.aberto .sig-acionador-texto,
            .sig-shell.aberto .sig-acionador:hover .sig-acionador-texto {
                max-width: 0;
                opacity: 0;
                transform: translateX(-5px);
            }

            .sig-acionador svg {
                width: 15px;
                height: 15px;
                flex: 0 0 15px;
                display: block;
                transition: transform .30s ease;
            }

            .sig-shell.aberto .sig-acionador svg {
                transform: rotate(180deg);
            }

            .sig-cabecalho {
                position: relative;
                flex: 0 0 auto;
                padding: 22px 18px 18px;
                color: #fff;
                background:
                    linear-gradient(180deg, ${corDoModulo("#065195")} 0%, ${corDoModulo("#005DA4")} 100%);
                overflow: hidden;
            }

            .sig-cabecalho::after {
                content: "";
                position: absolute;
                width: 150px;
                height: 150px;
                right: -65px;
                top: -80px;
                border-radius: 50%;
                background: rgba(255,255,255,.07);
            }

            .sig-cabecalho-topo {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
            }

            .sig-brand {
                min-width: 0;
            }

            .sig-titulo {
                margin: 0;
                font-size: 20px;
                line-height: 1.15;
                font-weight: 750;
                letter-spacing: -.2px;
            }

            .sig-subtitulo {
                margin-top: 5px;
                font-size: 11px;
                line-height: 1.2;
                opacity: .82;
                text-transform: uppercase;
                letter-spacing: 1.15px;
            }

            .sig-fechar {
                width: 34px;
                height: 34px;
                flex: 0 0 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 0;
                border-radius: 9px;
                margin: -3px -3px 0 0;
                padding: 0;
                color: #fff;
                background: rgba(255,255,255,.10);
                font: 400 23px/1 Arial, sans-serif;
                cursor: pointer;
                transition: background .16s ease;
            }

            .sig-fechar:hover {
                background: rgba(255,255,255,.20);
            }

            .sig-resumo {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                gap: 7px;
                margin-top: 15px;
                color: rgba(255,255,255,.86);
                font-size: 11px;
            }

            .sig-indicador {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #FFFFFF;
                box-shadow: 0 0 0 3px rgba(255,255,255,.16);
            }

            .sig-central-acoes {
                flex: 0 0 auto;
                display: flex;
                align-items: stretch;
                gap: 7px;
                padding: 9px 10px;
                border-bottom: 1px solid var(--sig-line);
                background: #FFFFFF;
            }

            .sig-instalar {
                flex: 1 1 auto;
                min-width: 0;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                border: 1px solid ${corDoModulo("#034478")};
                border-radius: 5px;
                padding: 0 11px;
                color: #FFFFFF;
                background: var(--sig-primary);
                font-family: Verdana, Arial, Helvetica, sans-serif;
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                transition:
                    background .15s ease,
                    border-color .15s ease,
                    transform .12s ease;
            }

            .sig-instalar:hover {
                background: var(--sig-primary-hover);
            }

            .sig-instalar:active {
                transform: scale(.985);
            }

            .sig-verificar {
                width: 36px;
                height: 34px;
                flex: 0 0 36px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid ${corDoModulo("#AFC7D9")};
                border-radius: 5px;
                padding: 0;
                color: var(--sig-primary);
                background: ${corDoModulo("#F5F9FC")};
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
                transition:
                    background .15s ease,
                    transform .15s ease;
            }

            .sig-verificar:hover {
                background: ${corDoModulo("#E8F2F9")};
            }

            .sig-verificar.verificando {
                animation: sig-girar .8s linear infinite;
            }

            .sig-verificar:disabled {
                cursor: wait;
                opacity: .75;
            }

            @keyframes sig-girar {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .sig-aviso {
                display: none;
                flex: 0 0 auto;
                margin: 8px 10px 0;
                padding: 8px 9px;
                border: 1px solid ${corDoModulo("#B8CDDD")};
                border-radius: 5px;
                color: ${corDoModulo("#29455A")};
                background: ${corDoModulo("#EEF5FB")};
                font-size: 9.5px;
                line-height: 1.45;
            }

            .sig-aviso.visivel {
                display: block;
            }

            .sig-aviso[data-tipo="atualizacao"] {
                border-color: #D9A514;
                background: #FFF8D9;
                color: #665000;
            }

            .sig-aviso[data-tipo="sucesso"] {
                border-color: #7CB492;
                background: #EDF8F1;
                color: #285E3D;
            }

            .sig-aviso[data-tipo="erro"] {
                border-color: #D89797;
                background: #FFF1F1;
                color: #7D2929;
            }

            .sig-conteudo {
                flex: 1 1 auto;
                min-height: 0;
                overflow-x: hidden;
                overflow-y: auto;
                padding: 12px 10px 22px;
                scrollbar-width: thin;
                scrollbar-color: ${corDoModulo("#AFC4D5")} transparent;
            }

            .sig-conteudo::-webkit-scrollbar {
                width: 6px;
            }

            .sig-conteudo::-webkit-scrollbar-track {
                background: transparent;
            }

            .sig-conteudo::-webkit-scrollbar-thumb {
                border-radius: 999px;
                background: ${corDoModulo("#AFC4D5")};
            }

            .sig-vazio {
                margin: 28px 14px;
                padding: 22px 18px;
                border: 1px dashed ${corDoModulo("#B8CDDD")};
                border-radius: 12px;
                background: #fff;
                color: var(--sig-muted);
                text-align: center;
                font-size: 12px;
                line-height: 1.55;
            }

            .sig-grupo {
                margin: 2px 0 14px;
            }

            .sig-grupo + .sig-grupo {
                padding-top: 3px;
            }

            .sig-grupo-titulo {
                margin: 0;
                padding: 8px 9px 6px;
                color: ${corDoModulo("#5E7689")};
                font-size: 10px;
                line-height: 1.2;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .95px;
            }

            .sig-item {
                width: 100%;
                min-height: 54px;
                display: flex;
                align-items: center;
                gap: 11px;
                margin: 2px 0;
                padding: 9px 9px;
                border: 1px solid transparent;
                border-radius: 11px;
                color: var(--sig-text);
                background: transparent;
                text-decoration: none;
                outline: none;
                cursor: pointer;
                transition:
                    background .15s ease,
                    border-color .15s ease,
                    transform .12s ease,
                    box-shadow .15s ease;
            }

            .sig-item:hover {
                background: var(--sig-primary-softer);
                border-color: ${corDoModulo("#C8DCEB")};
                box-shadow: 0 2px 7px ${corDoModulo("rgba(0, 81, 149, .09)")};
            }

            .sig-item:focus-visible {
                border-color: var(--sig-primary-hover);
                box-shadow: 0 0 0 3px ${corDoModulo("rgba(0, 93, 164, .12)")};
            }

            .sig-item:active {
                transform: scale(.992);
            }

            .sig-item-icone {
                width: 36px;
                height: 36px;
                flex: 0 0 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                background: var(--sig-primary-soft);
                color: var(--sig-primary);
                font-size: 17px;
                line-height: 1;
                font-weight: 800;
                overflow: hidden;
            }

            .sig-item-icone img {
                width: 20px;
                height: 20px;
                display: block;
                object-fit: contain;
            }

            .sig-item-corpo {
                flex: 1 1 auto;
                min-width: 0;
            }

            .sig-item-titulo {
                overflow: hidden;
                color: ${corDoModulo("#17344A")};
                font-size: 13px;
                line-height: 1.25;
                font-weight: 700;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .sig-item-atualizar {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 24px;
                padding: 0 7px;
                border: 1px solid #D1A000;
                border-radius: 4px;
                color: #604A00;
                background: #FFF3B8;
                font-family: Verdana, Arial, Helvetica, sans-serif;
                font-size: 8.5px;
                line-height: 1;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition:
                    background .14s ease,
                    border-color .14s ease,
                    transform .12s ease;
            }

            .sig-item-atualizar:hover {
                background: #FFE98B;
                border-color: #B68A00;
            }

            .sig-item-atualizar:active {
                transform: scale(.97);
            }

            .sig-item-verificando {
                flex: 0 0 auto;
                color: ${corDoModulo("#71879A")};
                font-size: 8.5px;
                white-space: nowrap;
            }

            .sig-item-seta {
                flex: 0 0 auto;
                color: ${corDoModulo("#7F9AAF")};
                font-size: 18px;
                line-height: 1;
                transform: translateY(-1px);
            }

            .sig-rodape {
                flex: 0 0 auto;
                padding: 9px 14px;
                border-top: 1px solid var(--sig-line);
                background: #fff;
                color: ${corDoModulo("#758B9C")};
                font-size: 9.5px;
                line-height: 1.3;
                text-align: center;
            }

            @media (max-width: 480px) {
                .sig-shell {
                    --sig-width: calc(100vw - 40px);
                }

                .sig-painel {
                    max-width: calc(100vw - 40px);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .sig-painel,
                .sig-overlay,
                .sig-acionador,
                .sig-acionador svg {
                    transition-duration: .01ms !important;
                }
            }
        `;

        const shell = document.createElement('div');
        shell.className = 'sig-shell';

        shell.innerHTML = `
            <button
                class="sig-overlay"
                type="button"
                aria-label="Fechar menu de ferramentas"
                tabindex="-1"
            ></button>

            <aside
                class="sig-painel"
                role="navigation"
                aria-label="Ferramentas do SIGEDUCA"
            >
                <header class="sig-cabecalho">
                    <div class="sig-cabecalho-topo">
                        <div class="sig-brand">
                            <h2 class="sig-titulo"></h2>
                            <div class="sig-subtitulo"></div>
                        </div>

                        <button
                            class="sig-fechar"
                            type="button"
                            title="Fechar"
                            aria-label="Fechar menu"
                        >×</button>
                    </div>

                    <div class="sig-resumo">
                        <span class="sig-indicador"></span>
                        <span class="sig-contador">Nenhuma ferramenta registrada</span>
                    </div>
                </header>

                <div class="sig-central-acoes">
                    <button
                        class="sig-instalar"
                        type="button"
                        title="Adicionar ferramentas sem sair do SigEduca"
                        aria-expanded="false"
                    >
                        <span aria-hidden="true">↓</span>
                        <span>Adicionar ferramentas</span>
                    </button>

                    <button
                        class="sig-verificar"
                        type="button"
                        title="Verificar atualizações"
                        aria-label="Verificar atualizações"
                    >↻</button>
                </div>

                <div
                    class="sig-aviso"
                    role="status"
                    aria-live="polite"
                ></div>

                <main class="sig-conteudo"></main>

                <footer class="sig-rodape">
                    Menu modular independente • v${VERSAO_BASE}
                    <button class="sig-atualizar-base" type="button" hidden style="margin-top:8px;cursor:pointer">Atualizar menu</button>
                </footer>
            </aside>

            <button
                class="sig-acionador"
                type="button"
                title="Abrir ferramentas"
                aria-label="Abrir ferramentas"
                aria-expanded="false"
            >
                <span class="sig-acionador-texto">Ferramentas</span>
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M9 18l6-6-6-6"></path>
                </svg>
            </button>
        `;

        shadow.appendChild(style);
        shadow.appendChild(shell);
        document.documentElement.appendChild(host);

        refs = {
            shell,
            overlay: shell.querySelector('.sig-overlay'),
            painel: shell.querySelector('.sig-painel'),
            acionador: shell.querySelector('.sig-acionador'),
            fechar: shell.querySelector('.sig-fechar'),
            titulo: shell.querySelector('.sig-titulo'),
            subtitulo: shell.querySelector('.sig-subtitulo'),
            contador: shell.querySelector('.sig-contador'),
            instalar: shell.querySelector('.sig-instalar'),
            verificar: shell.querySelector('.sig-verificar'),
            atualizarBase: shell.querySelector('.sig-atualizar-base'),
            aviso: shell.querySelector('.sig-aviso'),
            conteudo: shell.querySelector('.sig-conteudo')
        };

        refs.titulo.textContent = CONFIG.titulo;
        refs.subtitulo.textContent = CONFIG.subtitulo;

        refs.acionador.addEventListener('click', () => {
            definirPainelAberto(!painelAberto);
        });

        refs.fechar.addEventListener('click', () => {
            definirPainelAberto(false);
        });

        refs.instalar.addEventListener('click', () => {
            abrirInstalador();
        });

        refs.atualizarBase.addEventListener('click', () => abrirAtualizacao(ATUALIZACAO_BASE));

        refs.verificar.addEventListener('click', () => {
            verificarAtualizacoes(true);
            carregarCatalogo(true);
        });

        if (CONFIG.fecharAoClicarFora) {
            refs.overlay.addEventListener('click', () => {
                definirPainelAberto(false);
            });
        }

        if (CONFIG.fecharComEscape) {
            window.addEventListener('keydown', (evento) => {
                if (evento.key === 'Escape' && painelAberto) {
                    definirPainelAberto(false);
                }
            });
        }

        interfaceCriada = true;
        renderizarFerramentas();

        return true;
    }

    function definirPainelAberto(aberto) {
        if (!interfaceCriada) {
            criarInterface();
        }

        if (!refs) return;

        painelAberto = Boolean(aberto);

        refs.shell.classList.toggle('aberto', painelAberto);
        refs.acionador.setAttribute(
            'aria-expanded',
            painelAberto ? 'true' : 'false'
        );

        refs.acionador.title = painelAberto
            ? 'Fechar ferramentas'
            : 'Abrir ferramentas';

        refs.acionador.setAttribute(
            'aria-label',
            painelAberto ? 'Fechar ferramentas' : 'Abrir ferramentas'
        );

        if (painelAberto) {
            solicitarRegistros();
            carregarCatalogo(false);

            // Dá alguns milissegundos para os módulos responderem ao evento
            // de solicitação antes de checar as versões.
            setTimeout(() => {
                verificarAtualizacoes(false);
            }, 180);
        }
    }

    // ---------------------------------------------------------------------
    // RENDERIZAÇÃO
    // ---------------------------------------------------------------------

    function obterListaOrdenada() {
        return Array.from(ferramentas.values()).sort((a, b) => {
            if (a.grupoOrdem !== b.grupoOrdem) {
                return a.grupoOrdem - b.grupoOrdem;
            }

            const grupoA = normalizarTitulo(a.grupo);
            const grupoB = normalizarTitulo(b.grupo);

            if (grupoA !== grupoB) {
                return grupoA.localeCompare(grupoB, 'pt-BR');
            }

            if (a.ordem !== b.ordem) {
                return a.ordem - b.ordem;
            }

            return a.titulo.localeCompare(b.titulo, 'pt-BR');
        });
    }

    function criarIcone(item) {
        const caixa = criarElemento('span', 'sig-item-icone');

        if (item.icone) {
            // Se for URL/imagem, tenta mostrar como imagem.
            if (
                /^https?:\/\//i.test(item.icone) ||
                item.icone.startsWith('/') ||
                /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(item.icone)
            ) {
                const img = document.createElement('img');
                img.src = item.icone;
                img.alt = '';
                img.addEventListener('error', () => {
                    caixa.textContent = '⚙';
                });
                caixa.appendChild(img);
                return caixa;
            }

            // Caso contrário, aceita emoji/texto curto.
            caixa.textContent = item.icone;
            return caixa;
        }

        caixa.textContent = '⚙';
        return caixa;
    }

    function criarItemVisual(item) {
        const link = document.createElement('a');
        link.className = 'sig-item';
        link.href = resolverURL(item.url)?.href || item.url;
        link.target = item.target;

        const status = statusAtualizacoes.get(item.id);

        const detalhesTooltip = [];

        if (item.descricao) {
            detalhesTooltip.push(item.descricao);
        }

        if (item.versao) {
            detalhesTooltip.push(`versão instalada: ${item.versao}`);
        }

        if (
            status?.estado === 'disponivel' &&
            status.versaoRemota &&
            status.versaoRemota !== 'teste'
        ) {
            detalhesTooltip.push(
                `nova versão: ${status.versaoRemota}`
            );
        }

        link.title = detalhesTooltip.length
            ? `${item.titulo} — ${detalhesTooltip.join(' • ')}`
            : item.titulo;

        if (item.target === '_blank') {
            link.rel = 'noopener noreferrer';
        }

        const icone = criarIcone(item);
        const corpo = criarElemento('span', 'sig-item-corpo');
        const titulo = criarElemento('span', 'sig-item-titulo', item.titulo);

        corpo.appendChild(titulo);

        link.appendChild(icone);
        link.appendChild(corpo);

        if (status?.estado === 'disponivel') {
            const atualizar = criarElemento(
                'span',
                'sig-item-atualizar',
                'Atualizar'
            );

            atualizar.setAttribute('role', 'button');
            atualizar.setAttribute('tabindex', '0');

            if (
                status.versaoRemota &&
                status.versaoRemota !== 'teste'
            ) {
                atualizar.title =
                    `Atualizar de ${item.versao || '?'} para ${status.versaoRemota}`;
            } else {
                atualizar.title = 'Atualização disponível';
            }

            const executarAtualizacao = (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                abrirAtualizacao(item);
            };

            atualizar.addEventListener('click', executarAtualizacao);

            atualizar.addEventListener('keydown', (evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                    executarAtualizacao(evento);
                }
            });

            link.appendChild(atualizar);
        } else if (status?.estado === 'verificando') {
            const verificando = criarElemento(
                'span',
                'sig-item-verificando',
                'verificando…'
            );
            link.appendChild(verificando);
        } else {
            const seta = criarElemento('span', 'sig-item-seta', '›');
            seta.setAttribute('aria-hidden', 'true');
            link.appendChild(seta);
        }

        link.addEventListener('click', () => {
            if (CONFIG.fecharAoNavegar && item.target !== '_blank') {
                definirPainelAberto(false);
            }
        });

        return link;
    }

    function renderizarFerramentas() {
        renderAgendado = false;

        if (!interfaceCriada) {
            if (!criarInterface()) return;
        }

        if (!refs?.conteudo) return;

        const lista = obterListaOrdenada();
        refs.conteudo.replaceChildren();

        const total = lista.length;

        atualizarContadorCabecalho();

        renderizarCatalogo();
        if (catalogoAberto) return;

        if (!total) {
            const vazio = criarElemento(
                'div',
                'sig-vazio',
                'Suas ferramentas ativas aparecerão aqui depois da instalação e do recarregamento da página.'
            );

            refs.conteudo.appendChild(vazio);
            return;
        }

        const semGrupo = [];
        const grupos = new Map();

        for (const item of lista) {
            if (!item.grupo) {
                semGrupo.push(item);
                continue;
            }

            const chave = normalizarTitulo(item.grupo);

            if (!grupos.has(chave)) {
                grupos.set(chave, {
                    titulo: item.grupo,
                    ordem: item.grupoOrdem,
                    itens: []
                });
            }

            grupos.get(chave).itens.push(item);
        }

        // Ferramentas sem grupo vêm primeiro.
        if (semGrupo.length) {
            const secao = criarElemento('section', 'sig-grupo');

            for (const item of semGrupo) {
                secao.appendChild(criarItemVisual(item));
            }

            refs.conteudo.appendChild(secao);
        }

        const gruposOrdenados = Array.from(grupos.values()).sort(
            (a, b) =>
                a.ordem - b.ordem ||
                a.titulo.localeCompare(b.titulo, 'pt-BR')
        );

        for (const grupo of gruposOrdenados) {
            const secao = criarElemento('section', 'sig-grupo');
            const tituloGrupo = criarElemento(
                'h3',
                'sig-grupo-titulo',
                grupo.titulo
            );

            secao.appendChild(tituloGrupo);

            for (const item of grupo.itens) {
                secao.appendChild(criarItemVisual(item));
            }

            refs.conteudo.appendChild(secao);
        }
    }

    function agendarRenderizacao() {
        if (renderAgendado) return;
        renderAgendado = true;

        requestAnimationFrame(() => {
            renderizarFerramentas();
        });
    }

    // ---------------------------------------------------------------------
    // INICIALIZAÇÃO
    // ---------------------------------------------------------------------

    function inicializarInterfaceQuandoPossivel() {
        if (criarInterface()) {
            solicitarRegistros();
            return;
        }

        setTimeout(inicializarInterfaceQuandoPossivel, 10);
    }

    // Cria o painel assim que o <html> existir.
    inicializarInterfaceQuandoPossivel();

    // Solicita registro várias vezes no início para eliminar problemas
    // de ordem de carregamento entre os userscripts do Tampermonkey.
    setTimeout(solicitarRegistros, 0);
    setTimeout(solicitarRegistros, 50);
    setTimeout(solicitarRegistros, 250);
    setTimeout(solicitarRegistros, 800);
    setTimeout(solicitarRegistros, 1500);
    setTimeout(solicitarRegistros, 3000);

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            () => {
                criarInterface();
                solicitarRegistros();
                agendarRenderizacao();
            },
            { once: true }
        );
    } else {
        criarInterface();
        solicitarRegistros();
        agendarRenderizacao();
    }

    // Reafirma que a base está disponível depois da criação da interface.
    setTimeout(() => {
        window.dispatchEvent(
            new CustomEvent(EVENTO_BASE_PRONTA, {
                detail: { versaoBase: VERSAO_BASE }
            })
        );
    }, 0);

})();
