# Arquivo Digital - GPE

[Instalar no Tampermonkey](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/arquivo-digital-servidores.user.js).

A versão 0.1.0 reorganiza automaticamente `/grh/hwmgrhservidor.aspx` com a estrutura visual do Arquivo Digital, na paleta vermelha do GPE. O menu base 2.8.4 também recebeu o acabamento correspondente. A central de instalação exibe esta ferramenta somente no GPE.

- **Consultar Servidores:** consulta nativa do SIGEDUCA, com seletor de CPF, nome, matrícula, mãe/nascimento, PIS/Pasep, título de eleitor ou código interno. Preserva os controles, eventos, permissões, validações, resultados e paginação do formulário existente.
- **Documentos Internos:** espaço transferido do GED, ainda não conectado a um acervo.
- **Ajuda:** orientações curtas. **Página original** restaura os elementos em suas posições anteriores, preservando os valores; o menu permite reabrir o Arquivo Digital.

As pastas digitais dos servidores contratados/efetivos e os documentos internos já eram áreas em preparação. Esta migração não cria planilhas, senhas, pastas ou permissões. A conexão com esses acervos continua pendente; o script não usa o token nem as listas de alunos do GED.

Validação: reprodução local do HTML fornecido, com dados fictícios e eventos GeneXus simulados. Conferidos troca de filtro, consulta, ação no resultado, abas, restauração do formulário e ausência de campos duplicados. A consulta autenticada ao SIGEDUCA precisa ser conferida na sessão da escola após a instalação. Nenhum token ou HTML de sessão foi incluído no repositório.

## Calendário A4

[Instalar no Tampermonkey](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/calendario-a4.user.js).

Abra **Imprimir Calendário** no GPE (`/grh/hwmgrhcalendarioimp.aspx`). A impressão automática abre a prévia; também é possível usar o botão **Calendário A4** na página.

- Padrão: duas folhas A4 retrato, com duas colunas de meses e aparência próxima da original.
- Alternativa: uma folha compacta, com três colunas de meses.
- Legenda completa e três campos de assinatura no final, com 14 mm de espaço acima das assinaturas.
- Preserva o ano, a escola, os dias e as siglas do calendário aberto. Bloqueia a impressão quando os dados estão incompletos ou o conteúdo excede a folha.
- Na impressão, selecione A4, retrato, escala 100% e desative os cabeçalhos e rodapés do navegador.

A versão 1.0.0 foi validada localmente com o HTML fornecido e aprovada pelo usuário no SIGEDUCA. Não inclui dados de escola, HTML de sessão ou PDFs de exemplo no repositório. Se a versão **Calendário A4 (TESTE)** estiver instalada, desative-a ou remova-a ao instalar esta versão para evitar execução duplicada. O menu-base não precisa ser alterado.