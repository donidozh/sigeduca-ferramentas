# Exportador de Contratos — GPE

Versão 3.0.0 do userscript `exportador-contratos.user.js`, integrado ao menu Ferramentas. O nome e o namespace do script enviado foram preservados para atualizar a instalação existente.

## Uso

1. Instale o arquivo no Tampermonkey, substituindo o exportador anterior, e recarregue o SIGEDUCA.
2. Abra **Ferramentas → Exportador de Contratos**, no GPE. A ferramenta reorganiza `/grh/hwmgrhfechamentoquadro.aspx` e aciona o **Confirmar** nativo para abrir a emissão da escola.
3. Confira a lotação e os tipos de processo apresentados. As opções são obtidas do seletor da emissão, incluindo Contrato Administrativo e Aulas em Substituição quando disponíveis. Todos vêm selecionados.
4. Use **Testar 1 documento** para conferir um HTML ou **Exportar documentos** para percorrer os tipos selecionados e suas páginas.

O padrão reúne os documentos em **um HTML por código de servidor**, dentro de um único ZIP. Servidores homônimos recebem arquivos diferentes, identificados também pelo código. Dentro de cada arquivo, os processos seguem a ordem numérica, com Contrato, Retificação e Distrato. Desmarcar o agrupamento produz arquivos individuais, em pastas por tipo de processo.

Retificações, distratos e CSV vêm habilitados e podem ser desmarcados. O CSV informa tipo, servidor, processo, documento, resultado e diagnóstico. O teste coleta somente **um documento**, mesmo com agrupamento ativado. **Parar e salvar parcial** aguarda a operação atual e salva o que foi coletado; consultas incompletas são identificadas como parciais.

**Página original** recarrega a tela sem a interface da ferramenta, permitindo conferir ou ajustar os parâmetros nativos da escola. A ferramenta reutiliza a sessão atual e não armazena documentos no servidor. A emissão abre automaticamente; os downloads só começam após escolher testar ou exportar.

## Integração e otimizações

- Registro pelos eventos do menu e entrada em `catalogo.json`, restritos a `grh`.
- Interface vermelha do GPE, responsiva, com tipos, status por tipo, servidor atual, contadores e progresso do ZIP.
- Cache de recursos compartilhados durante o lote; limpeza ao concluir; liberação dos HTMLs individuais após agrupamento.
- Histórico visual limitado às últimas 100 mensagens; CSV mantém o diagnóstico completo. Contagem de falhas incremental, sem percorrer todo o relatório a cada documento.
- Execução sequencial para preservar o estado da sessão GeneXus; deduplicação de documentos e linhas; validação de tipo, lotação, processo e paginação repetida.
- Confirmar usa o controle nativo e mantém suas validações. Reconhece emissão em iframe ou `window.open` com URL direta da emissão. Estruturas diferentes, sessão expirada ou parâmetros obrigatórios geram uma mensagem e permitem retornar à página original.

## Validação local

Execute `node tests/contratos-fixture.cjs`, abra `http://127.0.0.1:8794/grh/hwmgrhfechamentoquadro.aspx` e clique em **Executar testes locais**.

A reprodução usa escola e servidores fictícios. Verifica confirmação automática, registro no menu, tipos, paginação, retificações/distratos, homônimos, ordem, HTML sem scripts, CSV, teste unitário de documento, filtros, erro de tipo e salvamento parcial. A simulação substitui a biblioteca ZIP por um coletor em memória e intercepta downloads; não comprova a compactação da biblioteca JSZip nem o funcionamento na sessão autenticada do SIGEDUCA.

O script está incluído no catálogo do GPE. Abra **Ferramentas → Adicionar ferramentas → Exportador de Contratos** para instalar pelo Tampermonkey e recarregue o SIGEDUCA. Também é possível [instalar diretamente](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpe/exportador-contratos.user.js). O menu-base descobre a ferramenta pelo catálogo, sem precisar de uma nova versão.
