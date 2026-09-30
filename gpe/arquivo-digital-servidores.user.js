// ==UserScript==
// @name         Arquivo Digital - GPE
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Consulta de servidores e espaço para documentos internos, com interface integrada ao GPE.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/grh/*
// @run-at       document-start
// @noframes
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/arquivo-digital-servidores.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/arquivo-digital-servidores.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(() => {
    'use strict';
    if(window.top!==window.self||!/^\/grh\//i.test(location.pathname)||window.__SIGEDUCA_ARQUIVO_GPE__)return;
    window.__SIGEDUCA_ARQUIVO_GPE__=true;
    const version=typeof GM_info==='object'?GM_info.script.version:'0.1.0';
    const url='https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/arquivo-digital-servidores.user.js';
    const ATUALIZACAO_SCRIPT={versao:version,updateUrl:url,installUrl:url};
    const ferramenta={
        id:'arquivo-digital-gpe',titulo:'Arquivo Digital - GPE',descricao:'Servidores e documentos internos',
        url:'hwmgrhservidor.aspx#arquivo-digital-gpe',grupo:'Gestão de Pessoas',grupoOrdem:10,ordem:10,
    };
    const register=()=>window.dispatchEvent(new CustomEvent('sigeduca:ferramentas:registrar',{detail:{...ferramenta,...ATUALIZACAO_SCRIPT}}));
    for(const event of ['sigeduca:ferramentas:solicitar-registro','sigeduca:ferramentas:base-pronta'])window.addEventListener(event,register);
    register();setTimeout(register,100);
    if(!/\/grh\/hwmgrhservidor\.aspx$/i.test(location.pathname))return;

    const modes=[['BCPF','CPF'],['BNOME','Nome'],['BMAT','Matrícula'],['BMAE','Mãe e nascimento'],['BPIS','PIS/Pasep'],['BTIT','Título de eleitor'],['BCOD','Código interno']];
    const fields={vWCPF:'CPF',vWNOMEPESSOA:'Nome',vWGERPESCOD:'Código interno',vWGRHSRVNMRTITELE:'Título de eleitor',vWGRHSRVNMRPISPAS:'PIS/Pasep',vWGRHSRVVNCNUMFUNC:'Matrícula SEAP',vWGRHSRVVNCMAT:'Matrícula SEDUC',vWGRHSRVIDINEP:'Matrícula INEP',vWGERPESNOMMAE:'Nome da mãe',vWGERPESDTANASC:'Nascimento'};
    let app,observer,scheduled=false,tab='consulta',originalTitle;
    const moved=new Map();
    const byId=id=>document.getElementById(id);
    function adopt(id,slot){
        const node=byId(id),host=app.querySelector(slot);
        if(!node||!host||host.contains(node))return;
        const anchor=document.createComment('Arquivo GPE: '+id);node.before(anchor);moved.set(node,anchor);host.append(node);
    }
    function bindNative(){
        observer?.disconnect();
        try{
            for(const [id,slot] of [['TABLEFILTROVARIAVEIS','[data-fields]'],['TABLE8','[data-actions]'],['GriddetalhesContainerDiv','[data-grid]'],['TABLEPAGINACAO','[data-pages]'],['gxErrorViewer','[data-errors]']])adopt(id,slot);
            for(const [id,label] of Object.entries(fields)){const input=byId(id);if(input)input.setAttribute('aria-label',label);}
            const active=modes.find(([name])=>document.querySelector(`input[name="${name}"]`)?.disabled);
            if(active)app.querySelector('[data-mode]').value=active[0];
            // Não altere display/disabled dos controles nativos: são permissões e estado do GeneXus.
            const empty=app.querySelector('[data-empty]');empty.hidden=Boolean(byId('GriddetalhesContainerDiv')?.textContent.trim());
            const birth=byId('vWGERPESDTANASC');
            if(birth&&!birth.dataset.gpeMask){birth.dataset.gpeMask='1';birth.inputMode='numeric';birth.addEventListener('input',()=>{const n=birth.value.replace(/\D/g,'').slice(0,8);birth.value=n.slice(0,2)+(n.length>2?'/'+n.slice(2,4):'')+(n.length>4?'/'+n.slice(4):'');});}
        }finally{if(app?.isConnected)observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','style']});}
    }
    function selectTab(key){
        tab=key;
        for(const button of app.querySelectorAll('[role="tab"]')){const active=button.dataset.tab===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
        for(const panel of app.querySelectorAll('[role="tabpanel"]'))panel.hidden=panel.dataset.panel!==key;
    }
    function restore(){
        observer?.disconnect();
        for(const [node,anchor] of moved){if(anchor.isConnected){if(node.isConnected)anchor.replaceWith(node);else anchor.remove();}}
        moved.clear();app?.remove();app=null;document.body.classList.remove('gpe-archive-active');document.title=originalTitle;
    }
    function mount(){
        if(location.hash==='#sigeduca-original'){if(app)restore();return;}
        if(app?.isConnected)return;
        const form=byId('MAINFORM');
        // Se a estrutura mudar, preserve a página original em vez de ocultar a consulta.
        if(!form||!byId('TABLEFILTROVARIAVEIS')||!byId('GriddetalhesContainerDiv')||!form.querySelector('input[name="BCONSULTAR"]'))return;
        originalTitle=document.title;document.title='Arquivo Digital - GPE';
        app=document.createElement('section');app.id='gpe-archive';
        app.innerHTML=`<header class="ga-header"><div><span class="ga-eyebrow">GPE · GESTÃO DE PESSOAS</span><h1>Arquivo Digital - GPE</h1><p>Servidores e documentos internos</p></div><button type="button" data-original>Página original</button></header>
          <nav class="ga-tabs" role="tablist" aria-label="Arquivo Digital GPE">
            <button type="button" role="tab" id="ga-tab-consulta" data-tab="consulta" aria-controls="ga-panel-consulta">Consultar Servidores</button>
            <button type="button" role="tab" id="ga-tab-internos" data-tab="internos" aria-controls="ga-panel-internos">Documentos Internos</button>
            <button type="button" role="tab" id="ga-tab-ajuda" data-tab="ajuda" aria-controls="ga-panel-ajuda">Ajuda</button>
          </nav>
          <section role="tabpanel" id="ga-panel-consulta" data-panel="consulta" aria-labelledby="ga-tab-consulta">
            <div class="ga-layout"><aside class="ga-card ga-search"><h2>Localizar servidor</h2><label for="ga-search-mode">Pesquisar por</label><select id="ga-search-mode" data-mode></select><div data-fields></div><div data-actions></div><div data-errors role="status"></div></aside>
              <div class="ga-results"><section class="ga-card"><div class="ga-section-title"><h2>Servidores</h2><span class="ga-tag">SIGEDUCA</span></div><div data-grid></div><div data-pages></div><div class="ga-empty" data-empty><strong>Localize um servidor</strong><p>Escolha o filtro e faça a pesquisa.</p></div></section>
              <section class="ga-card ga-pending"><h2>Pastas digitais</h2><p>O acervo de servidores contratados e efetivos aguarda a configuração das listas e do acesso restrito.</p></section></div></div>
          </section>
          <section role="tabpanel" id="ga-panel-internos" data-panel="internos" aria-labelledby="ga-tab-internos"><div class="ga-card ga-empty"><span class="ga-tag">ACERVO NÃO CONFIGURADO</span><h2>Documentos Internos</h2><p>Esta área passa a fazer parte do GPE. A consulta será habilitada após a configuração do acervo e das permissões.</p></div></section>
          <section role="tabpanel" id="ga-panel-ajuda" data-panel="ajuda" aria-labelledby="ga-tab-ajuda"><div class="ga-card ga-help"><h2>Como consultar</h2><ol><li>Selecione CPF, nome ou outro filtro e preencha os dados.</li><li>Clique em Pesquisar e utilize as ações disponíveis no cadastro encontrado.</li></ol><p>A consulta utiliza sua sessão e as permissões do SIGEDUCA. As pastas digitais de servidores e os documentos internos ainda não estão conectados ao Drive.</p><p>Para consultar alunos, abra o Arquivo Digital no módulo GED.</p></div></section>`;
        form.prepend(app);
        const select=app.querySelector('[data-mode]');
        for(const [name,label] of modes){if(document.querySelector(`input[name="${name}"]`)){const option=document.createElement('option');option.value=name;option.textContent=label;select.append(option);}}
        select.onchange=()=>{const button=document.querySelector(`input[name="${select.value}"]`);if(button&&!button.disabled)button.click();};
        app.querySelector('[data-original]').onclick=()=>{location.hash='sigeduca-original';restore();};
        app.querySelector('.ga-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button)selectTab(button.dataset.tab);});
        app.querySelector('.ga-tabs').addEventListener('keydown',event=>{
            const keys=['consulta','internos','ajuda'],i=keys.indexOf(tab),next=event.key==='ArrowRight'?(i+1)%3:event.key==='ArrowLeft'?(i+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;
            if(next<0)return;event.preventDefault();selectTab(keys[next]);app.querySelector(`[data-tab="${keys[next]}"]`).focus();
        });
        observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(app?.isConnected)bindNative();});});
        bindNative();selectTab(tab);document.body.classList.add('gpe-archive-active');
    }
    function style(){
        if(byId('gpe-archive-style'))return;
        const css=document.createElement('style');css.id='gpe-archive-style';css.textContent=`
          body.gpe-archive-active{opacity:1!important;background:#f5f6f8!important;margin:0!important}
          body.gpe-archive-active #MAINFORM>:not(#gpe-archive){display:none!important}
          #gpe-archive{--ga-primary:#9e242b;--ga-line:#e6d9dc;max-width:1480px;margin:0 auto;padding:30px 40px 60px 66px;font:14px Arial,sans-serif;color:#342126;text-align:left}
          #gpe-archive *{box-sizing:border-box}#gpe-archive [hidden]{display:none!important}
          #gpe-archive h1{font-size:29px;margin:5px 0 8px}#gpe-archive h2{font-size:18px;margin:0 0 20px}#gpe-archive p{color:#80676b;line-height:1.6;margin:8px 0}
          #gpe-archive .ga-eyebrow{font-size:11px;letter-spacing:1.6px;font-weight:bold;color:var(--ga-primary)}
          #gpe-archive .ga-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:26px}
          #gpe-archive button,#gpe-archive input[type=button]{border:1px solid var(--ga-line);border-radius:8px;padding:11px 17px;font:600 13px Arial;background:#fff;color:#63313a;cursor:pointer;transition:background .16s,box-shadow .16s,transform .16s;min-height:40px}
          #gpe-archive button:hover,#gpe-archive input[type=button]:hover{background:#faecee;box-shadow:0 3px 10px #59263212;transform:translateY(-1px)}
          #gpe-archive button:focus-visible,#gpe-archive select:focus-visible,#gpe-archive input:focus-visible{outline:3px solid #bc6970;outline-offset:2px}
          #gpe-archive .ga-tabs{display:flex;gap:7px;border-bottom:1px solid var(--ga-line);margin-bottom:26px;padding-bottom:10px;overflow-x:auto}
          #gpe-archive .ga-tabs button{border-color:transparent;background:transparent;white-space:nowrap}
          #gpe-archive .ga-tabs [aria-selected=true]{background:#9e242b;color:white}
          #gpe-archive .ga-layout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:24px;align-items:start}
          #gpe-archive .ga-card{background:white;border:1px solid var(--ga-line);border-radius:14px;padding:24px;box-shadow:0 5px 20px #34212604;margin-bottom:20px;min-width:0}
          #gpe-archive label{display:block;font-weight:bold;font-size:12px;margin-bottom:8px}
          #gpe-archive select,#gpe-archive input[type=text]{max-width:100%;border:1px solid #d9c7cc;border-radius:8px;padding:10px 12px!important;font:14px Arial!important;color:#342126!important;background:#fff;min-height:42px}
          #gpe-archive [data-mode]{width:100%;margin-bottom:20px}
          #gpe-archive [data-fields] table{width:100%!important;border-spacing:0}#gpe-archive [data-fields] td{display:block;width:100%!important;text-align:left!important;padding:3px 0}
          #gpe-archive [data-fields] input[type=text]{width:100%!important;text-align:left!important}#gpe-archive .TituloCampo{font:600 12px Arial!important;color:#63313a!important}
          #gpe-archive #TABLE8{width:100%;margin:18px 0 0}#gpe-archive input[name=BCONSULTAR]{background:#9e242b;color:white;width:100%;border-color:#9e242b}
          #gpe-archive [data-errors]{color:#9e242b;line-height:1.5}#gpe-archive [data-grid]{overflow:auto}
          #gpe-archive [data-grid] table{width:100%;border-collapse:collapse;font:13px Arial}#gpe-archive [data-grid] th,#gpe-archive [data-grid] td{padding:12px 10px;border-bottom:1px solid #eee6e8}
          #gpe-archive [data-grid] tr:hover td{background:#fcf2f3}#gpe-archive [data-pages]{margin-top:15px}
          #gpe-archive .ga-section-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
          #gpe-archive .ga-tag{font-size:10px;font-weight:bold;letter-spacing:.8px;color:#9e242b;background:#faecee;padding:7px 9px;border-radius:6px}
          #gpe-archive .ga-empty{padding:48px 24px;text-align:center}#gpe-archive .ga-empty strong{font-size:18px}#gpe-archive .ga-empty h2{margin:22px 0 12px}#gpe-archive .ga-empty p{max-width:510px;margin:12px auto}
          #gpe-archive .ga-pending h2{font-size:15px;margin-bottom:8px}#gpe-archive .ga-pending p{font-size:13px}#gpe-archive .ga-help{max-width:800px;line-height:1.8}
          @keyframes ga-enter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}#gpe-archive [role=tabpanel]:not([hidden]){animation:ga-enter .18s ease-out}
          @media(max-width:850px){#gpe-archive{padding:24px 18px 40px 42px}#gpe-archive .ga-layout{grid-template-columns:1fr}#gpe-archive .ga-header{align-items:start}#gpe-archive h1{font-size:24px}}
          @media(prefers-reduced-motion:reduce){#gpe-archive *{animation:none!important;transition:none!important}}
        `;document.head.append(css);
    }
    const start=()=>{style();mount();};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    window.addEventListener('load',mount);window.addEventListener('hashchange',mount);
})();
