// ==UserScript==
// @name         SIGEDUCA - Extrator de Matrícula Certidão
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Extrai Livro, Folha e Registro da Matrícula da Certidão (Padrão CNJ) no SIGEDUCA.
// @author       Você
// @match        http://sigeduca.seduc.mt.gov.br/ged/hwtmgedaluno.aspx*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrator-certidao.user.js
// @downloadURL  https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrator-certidao.user.js
// @homepageURL  https://github.com/donidozh/sigeduca-ferramentas
// @supportURL   https://github.com/donidozh/sigeduca-ferramentas/issues
// ==/UserScript==

(function() {
    'use strict';

    // Como o SIGEDUCA recarrega partes da tela via AJAX (UpdatePanels do ASP.NET),
    // usamos um MutationObserver para garantir que o botão seja inserido mesmo após um reload na página.
    const observer = new MutationObserver((mutations) => {
        const inputMatricula = document.getElementById('CTLGERPESNMRMATCERTNASC');

        // Se o campo de matrícula existe na tela e o nosso botão ainda não foi criado
        if (inputMatricula && !document.getElementById('btn-extrair-matricula')) {
            adicionarBotao(inputMatricula);
        }
    });

    // Inicia a observação no corpo do iframe
    observer.observe(document.body, { childList: true, subtree: true });

    function adicionarBotao(inputMatricula) {
        // Encontra o TD (célula da tabela) que contém o input
        const tdElement = inputMatricula.closest('td') || inputMatricula.parentElement;

        // Cria o botão
        const btn = document.createElement('button');
        btn.id = 'btn-extrair-matricula';
        btn.type = 'button'; // Previne que o botão submeta o formulário sem querer
        btn.innerHTML = '🔄 Extrair Dados';
        btn.style.marginLeft = '10px';
        btn.style.padding = '3px 8px';
        btn.style.cursor = 'pointer';
        btn.style.backgroundColor = '#0056b3'; // Azul padrão de botões administrativos
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '3px';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = 'bold';

        // Ação do clique
        btn.onclick = function(e) {
            e.preventDefault();
            extrairDados();
        };

        // Alinha o input e o botão lado a lado dentro do TD de forma amigável
        tdElement.style.display = 'flex';
        tdElement.style.alignItems = 'center';
        tdElement.appendChild(btn);
    }

    function extrairDados() {
        const matriculaInput = document.getElementById('CTLGERPESNMRMATCERTNASC');

        // Remove qualquer caractere que não seja número (espaços, hífens, etc)
        let matricula = matriculaInput.value.replace(/\D/g, '');

        // Valida se tem o tamanho padrão da certidão do CNJ
        if (matricula.length !== 32) {
            alert('Atenção: A matrícula da certidão deve conter exatamente 32 números para a extração funcionar.');
            return;
        }

        /* * Padrão CNJ de 32 dígitos:
         * Posições 00-05: CNS (Cartório)
         * Posições 06-07: Acervo
         * Posições 08-09: Reg Civil (55 = Nascimento)
         * Posições 10-13: Ano
         * Posição  14:    Tipo de Livro
         * Posições 15-19: Livro (5 posições)
         * Posições 20-22: Folha (3 posições)
         * Posições 23-29: Termo/Registro (7 posições)
         * Posições 30-31: Dígitos Verificadores
         */

        const livro = matricula.substring(15, 20); // Extrai 5 caracteres a partir do índice 15
        const folha = matricula.substring(20, 23); // Extrai 3 caracteres a partir do índice 20
        const registro = matricula.substring(23, 30); // Extrai 7 caracteres a partir do índice 23

        // Preenche os campos
        preencherCampo('CTLGERPESLVRCERTCIV', livro);
        preencherCampo('CTLGERPESFLHCERTCIV', folha);
        preencherCampo('CTLGERPESNMRCERTCIV', registro);

        // Dá um feedback visual rápido de que funcionou
        const btn = document.getElementById('btn-extrair-matricula');
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '✔ Extraído!';
        btn.style.backgroundColor = '#28a745'; // Fica verde

        setTimeout(() => {
            btn.innerHTML = textoOriginal;
            btn.style.backgroundColor = '#0056b3';
        }, 2000);
    }

    function preencherCampo(id, valor) {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = valor;

            // ATENÇÃO: O SIGEDUCA usa a framework Genexus que mapeia eventos onchange/onblur
            // no HTML ('gx.evt.onchange'). Precisamos forçar o disparo desses eventos via
            // JavaScript para que o sistema reconheça que o campo foi preenchido,
            // senão ele pode ignorar os valores na hora de salvar.
            campo.dispatchEvent(new Event('change', { bubbles: true }));
            campo.dispatchEvent(new Event('blur', { bubbles: true }));
        }
    }

})();