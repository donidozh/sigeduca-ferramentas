# Arquivo Digital - GPE

[Instalar no Tampermonkey](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/arquivo-digital-servidores.user.js).

A versão 0.1.0 reorganiza automaticamente `/grh/hwmgrhservidor.aspx` com a estrutura visual do Arquivo Digital, na paleta vermelha do GPE. O menu base 2.8.4 também recebeu o acabamento correspondente. A central de instalação exibe esta ferramenta somente no GPE.

- **Consultar Servidores:** consulta nativa do SIGEDUCA, com seletor de CPF, nome, matrícula, mãe/nascimento, PIS/Pasep, título de eleitor ou código interno. Preserva os controles, eventos, permissões, validações, resultados e paginação do formulário existente.
- **Documentos Internos:** espaço transferido do GED, ainda não conectado a um acervo.
- **Ajuda:** orientações curtas. **Página original** restaura os elementos em suas posições anteriores, preservando os valores; o menu permite reabrir o Arquivo Digital.

As pastas digitais dos servidores contratados/efetivos e os documentos internos já eram áreas em preparação. Esta migração não cria planilhas, senhas, pastas ou permissões. A conexão com esses acervos continua pendente; o script não usa o token nem as listas de alunos do GED.

Validação: reprodução local do HTML fornecido, com dados fictícios e eventos GeneXus simulados. Conferidos troca de filtro, consulta, ação no resultado, abas, restauração do formulário e ausência de campos duplicados. A consulta autenticada ao SIGEDUCA precisa ser conferida na sessão da escola após a instalação. Nenhum token ou HTML de sessão foi incluído no repositório.
