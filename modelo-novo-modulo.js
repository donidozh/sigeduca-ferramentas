// ==UserScript==
// @name         SIGEDUCA - Ferramentas - MODELO NOVO MÓDULO
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Modelo para registrar uma nova ferramenta no menu modular Ferramentas.
// @author       Elder Martins
// @match        *://sigeduca.seduc.mt.gov.br/ged/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Troque estes dados para cada ferramenta.
    const FERRAMENTA = Object.freeze({
        id: 'meu-modulo-unico',               // SEM repetir em outro script
        titulo: 'Minha Ferramenta',
        url: 'PAGINA_DO_SIGEDUCA.aspx?minhaFerramenta=1',
        descricao: 'Descrição da minha ferramenta',
        ordem: 100,
        grupo: ''                              // opcional: ex. 'Secretaria'
    });

    const EVENTO_REGISTRAR = 'sigeduca:ferramentas:registrar';
    const EVENTO_SOLICITAR = 'sigeduca:ferramentas:solicitar-registro';
    const EVENTO_BASE_PRONTA = 'sigeduca:ferramentas:base-pronta';

    function registrar() {
        window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, {
            detail: { ...FERRAMENTA }
        }));
    }

    window.addEventListener(EVENTO_SOLICITAR, registrar);
    window.addEventListener(EVENTO_BASE_PRONTA, registrar);
    registrar();
    setTimeout(registrar, 100);

    // =====================================================================
    // DAQUI PARA BAIXO FICA A LÓGICA NORMAL DA SUA FERRAMENTA.
    // Você NÃO precisa colocar o código dela dentro do script-base.
    // =====================================================================

    // Exemplo de ponto de entrada. Ajuste conforme a ferramenta:
    // if (!window.location.href.includes('minhaFerramenta=1')) return;
    //
    // ... restante do seu script antigo aqui ...

})();
