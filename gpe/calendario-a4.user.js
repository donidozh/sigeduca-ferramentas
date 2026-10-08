// ==UserScript==
// @name         SIGEDUCA - GPE - Calendário A4
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Prévia do calendário escolar em A4 retrato, com 12 ou 6 meses por folha.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/grh/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/calendario-a4.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/calendario-a4.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function () {
    'use strict';
    const ATUALIZACAO_SCRIPT = Object.freeze({
        versao: typeof GM_info === 'object' ? GM_info.script.version : '1.0.1',
        updateUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/calendario-a4.user.js',
        installUrl: 'https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/calendario-a4.user.js'
    });
    // Registro no menu modular do GPE.
    const FERRAMENTA = Object.freeze({
        id: 'gpe-calendario-a4', titulo: 'Calendário A4', url: '/grh/hwmgrhlotcal.aspx',
        descricao: 'Abrir calendários e imprimir em A4 retrato', grupo: 'GPE', ordem: 100
    });
    const register = () => window.dispatchEvent(new CustomEvent('sigeduca:ferramentas:registrar', {
        detail: { ...FERRAMENTA, ...ATUALIZACAO_SCRIPT }
    }));
    window.addEventListener('sigeduca:ferramentas:solicitar-registro', register);
    window.addEventListener('sigeduca:ferramentas:base-pronta', register);
    register();
    setTimeout(register, 100);
    if (!/\/hwmgrhcalendarioimp\.aspx$/i.test(location.pathname)) return;
    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const escape = value => String(value ?? '').replace(/[&<>"']/g,
        char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const text = id => document.getElementById(id)?.textContent.trim() || '';
    const originalPrint = window.print.bind(window);
    let frame, status, mode, printButton, ready = false, pending = false;

    // O GeneXus chama window.print() ao abrir a tela. Direcionar para a prévia
    // evita que o usuário receba primeiro o calendário original cortado.
    window.print = () => {
        if (!ready) { pending = true; return; }
        openPreview();
    };

    function readCalendar() {
        const heading = text('TTITULO');
        const year = Number(heading.match(/\b(20\d{2}|19\d{2})\b/)?.[0]);
        if (!year) throw new Error('Não foi possível identificar o ano do calendário.');
        const days = new Map();
        const inputs = document.querySelectorAll('input[name$="Grid1ContainerDataV"]');
        for (const input of inputs) {
            if (!/^W\d+Grid1ContainerDataV$/.test(input.name)) continue;
            const rows = JSON.parse(input.value);
            for (const row of rows) {
                // Campos do calendário GeneXus: data, número do dia e siglas.
                if (!String(row[9] ?? '').trim()) continue;
                const match = String(row[8]).match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
                if (!match) throw new Error('Formato de data não reconhecido.');
                const day = Number(match[1]), month = Number(match[2]);
                const date = new Date(Date.UTC(year, month - 1, day));
                const rowYear = Number(match[3]);
                if ((match[3].length === 4 ? rowYear !== year : rowYear !== year % 100) ||
                    date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
                    Number(row[9]) !== day) throw new Error('Os dados contêm uma data inconsistente.');
                const key = `${month}-${day}`;
                if (days.has(key)) throw new Error('Há datas duplicadas no calendário.');
                days.set(key, String(row[15] ?? '').trim());
            }
        }
        for (let month = 1; month <= 12; month++) {
            const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
            for (let day = 1; day <= total; day++) {
                if (!days.has(`${month}-${day}`)) {
                    throw new Error(`Calendário incompleto: falta ${day}/${month}/${year}. Aguarde o carregamento e reabra a prévia.`);
                }
            }
        }
        const legendInput = document.querySelector('input[name="Grid2ContainerDataV"]');
        if (!legendInput) throw new Error('A legenda do calendário ainda não está disponível.');
        const legend = JSON.parse(legendInput.value).map(row => ({ code: row[5], label: row[7] }));
        if (!legend.length || legend.some(item => !item.code || !item.label)) {
            throw new Error('Formato da legenda não reconhecido.');
        }
        const known = new Set(legend.map(item => item.code));
        for (const codes of days.values()) {
            for (const code of codes.split(/\s*-\s*/).filter(Boolean)) {
                if (!known.has(code)) throw new Error(`A sigla ${code} não foi encontrada na legenda.`);
            }
        }
        const logo = document.getElementById('IMAGE2');
        return { year, days, legend, school: text('TESCOLA'),
            state: text('TEXTBLOCK3'), department: text('TEXTBLOCK24'),
            logo: logo ? new URL(logo.getAttribute('src').replace(/\\/g, '/'), location.href).href : '' };
    }

    function monthHTML(data, month) {
        const first = new Date(Date.UTC(data.year, month - 1, 1)).getUTCDay();
        const total = new Date(Date.UTC(data.year, month, 0)).getUTCDate();
        const cells = Array.from({ length: 42 }, (_, index) => {
            const day = index - first + 1;
            if (day < 1 || day > total) return '<td class="empty"></td>';
            const codes = data.days.get(`${month}-${day}`);
            return `<td data-date="${data.year}-${month}-${day}" class="${index % 7 === 0 ? 'sunday' : ''}"><b>${day}</b><div class="codes">${escape(codes)}</div></td>`;
        });
        let rows = '';
        for (let i = 0; i < 42; i += 7) rows += `<tr>${cells.slice(i, i + 7).join('')}</tr>`;
        return `<article class="month"><h2>${MONTHS[month - 1]}</h2><table><thead><tr>${['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></article>`;
    }

    function buildHTML(data, perPage) {
        const sheets = [];
        for (let start = 1; start <= 12; start += perPage) {
            const months = Array.from({ length: perPage }, (_, i) => start + i);
            const lastPage = start + perPage > 12;
            sheets.push(`<section class="sheet ${perPage === 6 ? 'semester' : ''}">
                <header>${data.logo ? `<img src="${escape(data.logo)}" alt="Brasão">` : ''}<div><div>${escape(data.state)}</div><div>${escape(data.department)}</div><strong>${escape(data.school)}</strong></div><div class="title"><h1>Calendário Escolar ${data.year}</h1><span>${perPage === 6 ? (start === 1 ? '1º semestre' : '2º semestre') : 'Calendário anual'}</span></div></header>
                <main>${months.map(month => monthHTML(data, month)).join('')}</main>
                ${lastPage ? `<section class="legend"><h3>Legenda:</h3><div class="legend-grid">${data.legend.map(item => `<div><b>${escape(item.code)}</b><span>${escape(item.label)}</span></div>`).join('')}</div></section>
                <footer><div>Presidente do CDCE</div><div>Diretor(a)</div><div>Coordenador(a) Pedagógico(a)</div></footer>` : ''}
                <div class="page-number">${sheets.length + 1} / ${12 / perPage}</div>
            </section>`);
        }
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Calendário Escolar ${data.year}</title><style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111; font-family: Arial, sans-serif; background: #dce2e6; }
            .sheet { width: 190mm; margin: 8mm auto; padding: 0; background: white; break-after: page; page-break-after: always; }
            .sheet:last-child { break-after: auto; page-break-after: auto; }
            header { display: flex; align-items: center; gap: 3mm; padding-bottom: 2mm; margin-bottom: 3mm; min-height: 17mm; font-size: 7pt; line-height: 1.4; }
            header img { width: 12mm; height: 14mm; object-fit: contain; }
            header .title { margin-left: auto; text-align: right; }
            h1 { font-size: 10pt; margin: 0 0 1mm; } h2 { margin: 0; padding: 1mm; font-size: 9pt; color: #008cff; text-align: center; font-style: italic; }
            main { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3mm; }
            .month { min-width: 0; break-inside: avoid; page-break-inside: avoid; }
            table { border-collapse: separate; border-spacing: .35mm; border: .2mm solid #aaa; width: 100%; table-layout: fixed; background: #fafafa; }
            th { height: 3.5mm; font-size: 6pt; background: #778c90; color: white; }
            td { border: .2mm solid #d3d3d3; border-radius: .6mm; background: #eee; height: 5.4mm; vertical-align: top; padding: .35mm; font-size: 8pt; }
            td b { font-weight: normal; } .codes { font-size: 5.7pt; line-height: 1.1; color: #a00000; overflow-wrap: anywhere; }
            .sunday { background: #faecee; } td.empty { background: #fafafa; border-color: transparent; }
            h3 { font-size: 7pt; margin: 0 0 1.4mm; }
            .legend { margin-top: 3mm; break-inside: avoid; }
            .legend-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4mm 1mm; font-size: 5.8pt; line-height: 1.15; }
            .legend-grid > div { display: flex; gap: 1mm; border: .2mm solid #778c90; border-radius: .5mm; padding: .2mm; overflow-wrap: anywhere; } .legend-grid b { min-width: 6mm; font-weight: normal; }
            footer { display: flex; justify-content: space-between; gap: 7mm; margin-top: 14mm; font-size: 6.5pt; text-align: center; break-inside: avoid; }
            footer div { border-top: .2mm solid #64747b; padding-top: 1.5mm; flex: 1; }
            .page-number { text-align: right; font-size: 6pt; margin-top: 2mm; }
            .semester main { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
            .semester td { height: 6.4mm; font-size: 9pt; }
            .semester .codes { font-size: 7pt; } .semester h2 { font-size: 11pt; }
            .semester th { font-size: 7pt; }
            .sheet:not(.semester) main { row-gap: 1mm; }
            .sheet:not(.semester) td { height: 4.8mm; padding: .2mm; font-size: 7pt; line-height: 1; }
            .sheet:not(.semester) .codes { font-size: 5.2pt; line-height: 1; }
            @media print { html, body { background: white; } .sheet { margin: 0; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style></head><body>${sheets.join('')}</body></html>`;
    }

    async function checkPreview() {
        const doc = frame.contentDocument;
        if (!doc?.querySelector('.sheet')) return;
        printButton.disabled = true;
        await Promise.all(Array.from(doc.images, image => image.decode().catch(() => {})));
        if (doc !== frame.contentDocument) return;
        const pxPerMM = doc.querySelector('.sheet').getBoundingClientRect().width / 190;
        const overflow = Array.from(doc.querySelectorAll('.sheet')).some(sheet =>
            sheet.getBoundingClientRect().height > 276 * pxPerMM || sheet.scrollWidth > sheet.clientWidth + 1);
        if (overflow) {
            status.textContent = 'O conteúdo excedeu a folha. Selecione 2 folhas; se persistir, mantenha a impressão original e informe o problema.';
            return;
        }
        status.textContent = 'Prévia pronta. Na impressão, use A4, retrato, escala 100% e desative cabeçalhos e rodapés do navegador.';
        printButton.disabled = false;
    }

    function refreshPreview() {
        printButton.disabled = true;
        try {
            const data = readCalendar();
            status.textContent = 'Preparando a prévia…';
            frame.srcdoc = buildHTML(data, Number(mode.value));
        } catch (error) {
            frame.srcdoc = '<!doctype html><html><body></body></html>';
            status.textContent = `Não foi possível preparar a impressão: ${error.message}`;
        }
    }

    function openPreview() {
        if (!ready) { pending = true; return; }
        let panel = document.getElementById('sig-cal-a4-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'sig-cal-a4-panel';
            panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#eef2f5;display:flex;flex-direction:column;font:14px Arial;color:#172e3c;';
            const toolbar = document.createElement('div');
            toolbar.style.cssText = 'padding:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:white;';
            toolbar.innerHTML = '<strong>Calendário A4</strong><label>Formato <select aria-label="Formato"><option value="6">2 folhas • próximo do original</option><option value="12">1 folha • compacto (3 colunas)</option></select></label>';
            mode = toolbar.querySelector('select');
            mode.onchange = refreshPreview;
            printButton = document.createElement('button');
            printButton.textContent = 'Imprimir / Salvar PDF';
            printButton.onclick = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
            const original = document.createElement('button');
            original.textContent = 'Impressão original';
            original.onclick = () => { panel.style.display = 'none'; originalPrint(); };
            const close = document.createElement('button');
            close.textContent = 'Fechar prévia';
            close.onclick = () => { panel.style.display = 'none'; document.getElementById('sig-cal-a4-button').focus(); };
            toolbar.append(printButton, original, close);

            status = document.createElement('p');
            status.setAttribute('role', 'status');
            status.style.cssText = 'margin:0;padding:10px 14px;';
            frame = document.createElement('iframe');
            frame.title = 'Prévia de impressão do calendário';
            frame.style.cssText = 'width:100%;flex:1;border:0;min-height:0;';
            frame.addEventListener('load', checkPreview);
            panel.append(toolbar, status, frame);
            document.body.append(panel);
        }
        panel.style.display = 'flex';
        refreshPreview();
    }

    function init() {
        const style = document.createElement('style');
        style.textContent = '@media print { #sig-cal-a4-button, #sig-cal-a4-panel { display:none!important; } }';
        document.head.append(style);
        const button = document.createElement('button');
        button.id = 'sig-cal-a4-button';
        button.type = 'button';
        button.textContent = 'Calendário A4';
        button.style.cssText = 'position:fixed;right:18px;top:14px;z-index:2147483646;padding:12px 18px;border:0;border-radius:8px;background:#234d5a;color:white;font:bold 14px Arial;cursor:pointer;box-shadow:0 2px 8px #0003;';
        button.onclick = openPreview;
        document.body.append(button);
        ready = true;
        if (pending) openPreview();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
