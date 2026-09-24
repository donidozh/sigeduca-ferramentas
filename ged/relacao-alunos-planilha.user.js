// ==UserScript==
// @name         Relação de Alunos e Planilha Online - Por Turma (Com Atestados)
// @namespace    http://tampermonkey.net/
// @version      5.0.2
// @description  Impressão de lista manual, envio para Planilha Online e Extração de Atestados
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/arralunossituacao.aspx*
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/relacao-alunos-planilha.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/relacao-alunos-planilha.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function() {
    'use strict';

    // Configure seus próprios links na engrenagem; eles ficam salvos neste navegador.
    const urlWebAppPadrao = "";
    const urlPlanilhaPadrao = "";

    let urlWebapp = localStorage.getItem('sigeduca_url_webapp') || urlWebAppPadrao;
    let urlPlanilha = localStorage.getItem('sigeduca_url_planilha') || urlPlanilhaPadrao;

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // Utilitários para a extração de atestados
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

    let nomeTurma = "Turma Desconhecida";
    try {
        const urlCompleta = window.location.href;
        if (urlCompleta.includes('?')) {
            const partesUrl = urlCompleta.split('?')[1].split(',');
            if (partesUrl.length >= 7) {
                nomeTurma = decodeURIComponent(partesUrl[6].replace(/\+/g, ' '));
            }
        }
    } catch (e) {}

    function criarPainel() {
        if (document.getElementById('painel-sigeduca')) return;

        const painel = document.createElement('div');
        painel.id = 'painel-sigeduca';
        painel.style = "position:fixed; top:20px; right:20px; z-index:999999; background:#f8f9fa; border:2px solid #343a40; border-radius:8px; box-shadow: 0px 4px 6px rgba(0,0,0,0.3); font-family: Arial, sans-serif; width: 320px; overflow: hidden;";

        const trilho = document.createElement('div');
        trilho.id = 'trilho-slider';
        trilho.style = "display: flex; width: 640px; transition: transform 0.3s ease-in-out;";

        const telaPrincipal = document.createElement('div');
        telaPrincipal.style = "width: 320px; padding: 15px; box-sizing: border-box; position: relative;";

        telaPrincipal.innerHTML = `
            <div id="btn-engrenagem" style="position: absolute; top: 12px; right: 15px; cursor: pointer; font-size: 18px;" title="Configurações">⚙️</div>
            <h4 style="margin: 0 0 15px 0; color: #343a40; font-size: 14px; text-align: center; padding-right: 20px;">
                🎓 Turma: <b>${nomeTurma}</b> <span id="span-turno" style="color: #007bff; font-size: 12px; font-weight: bold;">(⏳...)</span>
            </h4>

            <select id="acao-sigeduca" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box;">
                <option value="gerar_tela_impressao">🖨️ Gerar Tela de Impressão</option>
                <option value="enviar_sheets">🚀 Enviar para Planilha Online</option>
                <option value="extrair_atestados">🩺 Extrair Atestados p/ Planilha</option>
                <option value="copiar_codigos">📋 Copiar Apenas Códigos</option>
                <option value="copiar_excel">📊 Copiar para Excel</option>
            </select>

            <button id="btn-executar" style="width: 100%; padding: 10px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; transition: background 0.3s; box-sizing: border-box;">Executar Ação</button>
            <button id="btn-abrir-planilha" style="display: block; width: 100%; padding: 10px; margin-top: 10px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; text-align: center; text-decoration: none; box-sizing: border-box; transition: background 0.3s;">📂 Abrir Planilha</button>
        `;

        const telaConfig = document.createElement('div');
        telaConfig.style = "width: 320px; padding: 15px; box-sizing: border-box; position: relative; background: #ececec;";
        telaConfig.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #d9534f; font-size: 13px; text-align: center; font-weight: bold;">⚠️ Configurações de Link</h4>

            <label style="font-size: 11px; font-weight: bold; color: #333;">Link da Implantação (Apps Script):</label>
            <input type="text" id="input-webapp" value="${urlWebapp}" style="width: 100%; padding: 6px; margin-bottom: 10px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">

            <label style="font-size: 11px; font-weight: bold; color: #333;">Link da Planilha (Para visualização):</label>
            <input type="text" id="input-planilha" value="${urlPlanilha}" style="width: 100%; padding: 6px; margin-bottom: 15px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box;">

            <div style="display: flex; gap: 10px;">
                <button id="btn-voltar" style="flex: 1; padding: 8px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Voltar</button>
                <button id="btn-salvar-config" style="flex: 1; padding: 8px; background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Salvar</button>
            </div>
        `;

        trilho.appendChild(telaPrincipal);
        trilho.appendChild(telaConfig);
        painel.appendChild(trilho);
        document.body.appendChild(painel);

        document.getElementById('btn-engrenagem').onclick = () => { trilho.style.transform = "translateX(-320px)"; };
        document.getElementById('btn-voltar').onclick = () => { trilho.style.transform = "translateX(0)"; };
        document.getElementById('btn-abrir-planilha').onclick = () => {
            if (!urlPlanilha) return alert("Nenhum link de planilha configurado.");
            window.open(urlPlanilha, '_blank');
        };

        document.getElementById('btn-salvar-config').onclick = () => {
            const novoWebapp = document.getElementById('input-webapp').value.trim();
            const novaPlanilha = document.getElementById('input-planilha').value.trim();
            localStorage.setItem('sigeduca_url_webapp', novoWebapp);
            localStorage.setItem('sigeduca_url_planilha', novaPlanilha);
            urlWebapp = novoWebapp;
            urlPlanilha = novaPlanilha;
            alert("Configurações salvas com sucesso no navegador!");
            trilho.style.transform = "translateX(0)";
        };

        document.getElementById('btn-executar').onclick = executarAcao;
    }

    function buscarTurnoSilenciosamente() {
        const pdfUrl = window.location.href;
        GM_xmlhttpRequest({
            method: "GET", url: pdfUrl, responseType: "arraybuffer",
            onload: async function(response) {
                try {
                    const data = new Uint8Array(response.response);
                    const loadingTask = pdfjsLib.getDocument({data});
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(1);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");

                    const regexTurno = /\b(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)\b/i;
                    const matchTurno = pageText.match(regexTurno);

                    const spanTurno = document.getElementById('span-turno');
                    if (matchTurno && spanTurno) {
                        spanTurno.innerHTML = `- ${matchTurno[1].toUpperCase()}`;
                        spanTurno.style.color = "#28a745";
                    } else if (spanTurno) {
                        spanTurno.innerHTML = ``;
                    }
                } catch (err) {}
            }
        });
    }

    async function executarAcao() {
        const acao = document.getElementById('acao-sigeduca').value;
        const btn = document.getElementById('btn-executar');

        btn.innerHTML = '⏳ Lendo PDF...';
        btn.style.background = '#ffc107';
        btn.disabled = true;

        try {
            const pdfUrl = window.location.href;
            GM_xmlhttpRequest({
                method: "GET", url: pdfUrl, responseType: "arraybuffer",
                onload: async function(response) {
                    const data = new Uint8Array(response.response);
                    const loadingTask = pdfjsLib.getDocument({data});
                    const pdf = await loadingTask.promise;
                    let fullText = "";

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
                    }

                    processarDados(fullText, acao, btn);
                },
                onerror: function() {
                    alert('Erro ao baixar o arquivo PDF.');
                    resetarBotao(btn);
                }
            });
        } catch (e) {
            alert('Erro durante o processamento do PDF.');
            resetarBotao(btn);
        }
    }

    function processarDados(fullText, acao, btn) {
        let turnoTurma = "";
        const regexTurno = /\b(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)\b/i;
        const matchTurno = fullText.match(regexTurno);
        if (matchTurno) turnoTurma = matchTurno[1].toUpperCase();

        const regexLinhaAluno = /\b(?:\d{1,3})\s+([A-ZÀ-Ÿ0-9\s\.\-'\’\‘]+?)\s+(\d{7,10})\s+((?:\d{2}\/\d{2}\/\d{2,4})|(?:\/\s*\/))\s+(\d{2}\/\d{2}\/\d{4})\s+(SIM|NÃO)\s+(SIM|NÃO)\s+(SIM|NÃO)/g;

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

        if (alunosExtraidos.length === 0) {
            alert('Não encontrei alunos válidos no PDF.');
            resetarBotao(btn);
            return;
        }

        if (acao === 'copiar_codigos') {
            const apenasCodigos = alunosExtraidos.map(a => a.codigo).join('\n');
            GM_setClipboard(apenasCodigos);
            alert(`Sucesso! ${alunosExtraidos.length} CÓDIGOS copiados.`);
            resetarBotao(btn);
        }
        else if (acao === 'copiar_excel') {
            let tsv = "CÓDIGO\tNOME DO ALUNO\tSITUAÇÃO 2026\tDATA AJUSTE\tDATA MATRÍCULA\tALUNO PAED\tMATRÍCULA PAED\tTRANSPORTE\n";
            alunosExtraidos.forEach(a => { tsv += `${a.codigo}\t${a.nome}\t${a.situacao}\t${a.dataAjuste}\t${a.dataMatricula}\t${a.alunoPaed}\t${a.matPaed}\t${a.transporte}\n`; });
            GM_setClipboard(tsv);
            alert(`Sucesso! ${alunosExtraidos.length} registros copiados.`);
            resetarBotao(btn);
        }
        else if (acao === 'gerar_tela_impressao') {
            gerarTelaImpressao(alunosExtraidos, nomeTurma, turnoTurma);
            resetarBotao(btn);
        }
        else if (acao === 'enviar_sheets') {
            if (!urlWebapp) {
                alert("Link não configurado! Clique na engrenagem ⚙️.");
                resetarBotao(btn);
                return;
            }

            btn.innerHTML = '🚀 Enviando...';
            // Payload original
            const payload = { tipoIntegracao: "RELACAO", turma: nomeTurma, turno: turnoTurma, alunos: alunosExtraidos };

            GM_xmlhttpRequest({
                method: "POST", url: urlWebapp, data: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" },
                onload: function(response) {
                    alert(`Sucesso! Dados da turma enviados.`);
                    resetarBotao(btn);
                },
                onerror: function() {
                    alert('Erro de comunicação.');
                    resetarBotao(btn);
                }
            });
        }
        else if (acao === 'extrair_atestados') {
            if (!urlWebapp) {
                alert("Link não configurado! Clique na engrenagem ⚙️.");
                resetarBotao(btn);
                return;
            }
            // Inicia o fluxo assíncrono do Iframe de Atestados
            coletarEEnviarAtestados(alunosExtraidos, nomeTurma, turnoTurma, btn);
        }
    }

    // --- FUNÇÕES DE ATESTADOS ---
    function prepararIframeAtestados() {
        let container = document.getElementById('containerIframeAtestados');
        if (!container) {
            container = document.createElement('div');
            container.id = 'containerIframeAtestados';
            container.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; visibility: hidden; opacity: 0; border: none;';
            let iframe = document.createElement('iframe');
            iframe.id = 'iframeAtestados'; iframe.name = 'iframeAtestados';
            container.appendChild(iframe);
            document.body.appendChild(container);
        }
        return document.getElementById('iframeAtestados');
    }

    async function coletarEEnviarAtestados(alunos, turma, turno, btn) {
        const iframe = prepararIframeAtestados();
        btn.innerHTML = '⏳ Carregando tela de Atestados...';
        iframe.src = 'http://sigeduca.seduc.mt.gov.br/ged/hwmgedatestado.aspx';

        let iframeDoc = iframe.contentWindow.document;
        let tentativasLoad = 0;

        while (!iframeDoc.getElementById('vGEDALUCOD') && tentativasLoad < 30) {
            await delay(1000);
            iframeDoc = iframe.contentWindow.document;
            tentativasLoad++;
        }

        if (tentativasLoad >= 30) {
            alert("Erro ao carregar o módulo de atestados do SIGEDUCA.");
            resetarBotao(btn);
            return;
        }

        await delay(1500);

        let atestadosColetados = [];

        for (let i = 0; i < alunos.length; i++) {
            let aluno = alunos[i];
            btn.innerHTML = `🩺 Lendo Atestados: ${i + 1} de ${alunos.length}`;

            let inputAluno = iframeDoc.getElementById('vGEDALUCOD');
            if (inputAluno) {
                inputAluno.value = aluno.codigo;
                if ("createEvent" in iframeDoc) {
                    var evt = iframeDoc.createEvent("HTMLEvents");
                    evt.initEvent("change", false, true);
                    inputAluno.dispatchEvent(evt);
                } else {
                    inputAluno.fireEvent("onchange");
                }
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
                    } else {
                        selectPag.fireEvent("onchange");
                    }
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

        if (atestadosColetados.length === 0) {
            alert("Nenhum atestado ou justificativa registrado para os alunos desta turma.");
            resetarBotao(btn);
            return;
        }

        btn.innerHTML = '🚀 Enviando Atestados...';

        // Estrutura de dados para o Apps Script interceptar
        const payloadAtestados = {
            tipoIntegracao: "ATESTADOS",
            abaDestino: "ATESTADOS",
            dados: atestadosColetados
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: urlWebapp,
            data: JSON.stringify(payloadAtestados),
            headers: { "Content-Type": "application/json" },
            onload: function(response) {
                alert(`Sucesso! ${atestadosColetados.length} atestados foram enviados para a planilha.`);
                resetarBotao(btn);
            },
            onerror: function() {
                alert('Erro de comunicação ao enviar para a planilha.');
                resetarBotao(btn);
            }
        });
    }

    // --- FUNÇÕES DE IMPRESSÃO ---
    function gerarTelaImpressao(alunos, turma, turno) {
        const novaJanela = window.open('', '_blank');
        if (!novaJanela) {
            alert("O navegador bloqueou a nova aba. Por favor, permita pop-ups para este site.");
            return;
        }

        const linhasPorPagina = 55;
        const alunosFiltrados = alunos.filter(a => !a.situacao.toUpperCase().includes("DEPENDENTE"));

        // Garante pelo menos uma página, mesmo se todos os registros forem filtrados.
        const totalPaginas = Math.max(1, Math.ceil(alunosFiltrados.length / linhasPorPagina));
        let paginasHtml = "";

        for (let pagina = 0; pagina < totalPaginas; pagina++) {
            const inicio = pagina * linhasPorPagina;
            const fim = Math.min(inicio + linhasPorPagina, alunosFiltrados.length);
            const alunosPagina = alunosFiltrados.slice(inicio, fim);

            let linhasTabela = "";

            alunosPagina.forEach((aluno, indexPagina) => {
                let situacaoExibicao = aluno.situacao.toUpperCase();

                if (situacaoExibicao === "MATRICULADO") {
                    situacaoExibicao = "&nbsp;";
                } else if (situacaoExibicao === "TRANSFERIDO DA ESCOLA") {
                    situacaoExibicao = "TRANSF.";
                } else if (situacaoExibicao === "TRANSFERIDO DA TURMA") {
                    situacaoExibicao = "REMOV.";
                }

                const numeroRegistro = inicio + indexPagina + 1;

                linhasTabela += `
                    <tr>
                        <td class="centro">${numeroRegistro}</td>
                        <td class="centro">${aluno.codigo}</td>
                        <td>${aluno.nome}</td>
                        <td class="centro">${situacaoExibicao}</td>
                        <td class="centro">${aluno.dataAjuste}</td>
                        <td class="centro">${aluno.dataMatricula}</td>
                    </tr>
                `;
            });

            // Completa somente a última página com linhas vazias até chegar a 55.
            const linhasEmBranco = linhasPorPagina - alunosPagina.length;

            for (let i = 1; i <= linhasEmBranco; i++) {
                const numeroLinha = inicio + alunosPagina.length + i;

                linhasTabela += `
                    <tr>
                        <td class="centro">${numeroLinha}</td>
                        <td class="centro">&nbsp;</td>
                        <td>&nbsp;</td>
                        <td class="centro">&nbsp;</td>
                        <td class="centro">&nbsp;</td>
                        <td class="centro">&nbsp;</td>
                    </tr>
                `;
            }

            paginasHtml += `
                <div class="pagina-impressao">
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

                    ${
                        totalPaginas > 1 && pagina < totalPaginas - 1
                            ? `<div class="aviso-continuacao">Continua na próxima página <span class="seta-continuacao">→</span></div>`
                            : ``
                    }
                </div>
            `;
        }

        const htmlRelatorio = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório - ${turma}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 15px; color: #333; margin: 0; }

                    .cabecalho-impr {
                        text-align: center;
                        margin-bottom: 5px;
                    }

                    .cabecalho-impr .titulo {
                        font-size: 10pt;
                        text-transform: uppercase;
                        font-weight: bold;
                        color: #333;
                    }

                    .cabecalho-impr .subtitulo {
                        font-size: 10pt;
                        text-transform: uppercase;
                        color: #333;
                    }

                    .cabecalho-impr .subtitulo b {
                        color: #000;
                        font-weight: bold;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 7pt;
                        border: 1px solid #000;
                    }

                    th {
                        border: none;
                        border-top: 1px solid #000;
                        border-bottom: 1px solid #000;
                        padding: 3px 2px;
                        text-transform: uppercase;
                        background-color: #f2f2f2;
                        font-weight: bold;
                        text-align: center;
                    }

                    th:first-child { border-left: 1px solid #000; }
                    th:last-child { border-right: 1px solid #000; }

                    td {
                        border: none;
                        border-top: 1px solid #000;
                        border-bottom: 1px solid #000;
                        padding: 3px 2px;
                        text-transform: uppercase;
                    }

                    tbody td:nth-child(1),
                    tbody td:nth-child(2) {
                        border-left: 1px solid #000;
                        border-right: 1px solid #000;
                    }

                    td.centro { text-align: center; }

                    .pagina-impressao {
                        page-break-after: always;
                        break-after: page;
                    }

                    .pagina-impressao:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }

                    .aviso-continuacao {
                        margin-top: 6px;
                        text-align: right;
                        font-size: 8pt;
                        font-weight: bold;
                        font-style: italic;
                        color: #333;
                    }

                    .seta-continuacao {
                        display: inline-block;
                        margin-left: 4px;
                        font-size: 11pt;
                        font-style: normal;
                        font-weight: bold;
                    }

                    .btn-imprimir {
                        display: block;
                        width: 200px;
                        margin: 15px auto;
                        padding: 10px;
                        background: #007bff;
                        color: white;
                        text-align: center;
                        font-weight: bold;
                        border-radius: 5px;
                        cursor: pointer;
                        border: none;
                        font-size: 12px;
                    }

                    .btn-imprimir:hover { background: #0056b3; }

                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }

                        .pagina-impressao {
                            page-break-after: always;
                            break-after: page;
                        }

                        .pagina-impressao:last-child {
                            page-break-after: auto;
                            break-after: auto;
                        }
                    }
                </style>
            </head>
            <body>
                <button class="btn-imprimir no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
                ${paginasHtml}
            </body>
            </html>
        `;

        novaJanela.document.write(htmlRelatorio);
        novaJanela.document.close();
    }

    function resetarBotao(btn) {
        btn.innerHTML = 'Executar Ação';
        btn.style.background = '#007bff';
        btn.disabled = false;
    }

    setTimeout(() => {
        criarPainel();
        setTimeout(buscarTurnoSilenciosamente, 500);
    }, 2000);

})();