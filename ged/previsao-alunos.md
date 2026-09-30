# Previsão de alunos por turma

Atualize `SIGEDUCA - Ferramentas - Ações em Lote (Turmas).user.js` para a versão **4.4.0** no Tampermonkey. Recarregue o GED, abra **Ferramentas → Ações em Lote** e escolha **Previsão de alunos por turma (PAED)** no dropdown. Toda a implementação está no próprio script de Ações em Lote. Se instalou a versão separada de Previsão de Alunos, pode desativá-la para remover a entrada antiga do menu.

1. O ano inicial é **2027**. Clique em **Buscar turmas para previsão**. O script seleciona o ano no filtro do GED e consulta todos os turnos. Os demais filtros nativos continuam valendo; deixe-os abrangentes se quiser todas as turmas da escola.
2. Marque as turmas na lista do próprio Ações em Lote e clique em **Gerar previsão de alunos**.
3. Confira o resumo: total, PAED, não PAED, não identificado e situação por turma. Expanda uma turma para ver os alunos.
4. Use **Baixar resumo CSV**, **Baixar alunos CSV** ou **Imprimir / salvar PDF**. Para salvar PDF, escolha essa opção na janela de impressão.

A classificação usa exclusivamente a coluna **Aluno PAED?**. Todos os alunos previstos no PDF entram na contagem, inclusive aqueles com matrícula ainda não efetivada. O total geral é a soma por turma, não a quantidade de pessoas únicas entre turmas.

O script usa os identificadores das turmas retornadas para o ano escolhido. Prefere o link nativo de previsão; quando a grade fornece somente `arralunossituacao.aspx`, conserva os sete primeiros parâmetros e usa os três filtros finais `0,0,0` do modelo informado. Links de outro ano são recusados.

Cada PDF é conferido pela escola, nome da turma, turno quando disponível, sequência, códigos únicos e total do rodapé. Uma falha não vira zero: aparece com a explicação e deixa o relatório parcial. PAED ausente ou diferente de SIM/NÃO fica como **não identificado**. Turmas ainda não consultadas após uma interrupção permanecem pendentes. O CSV detalhado contém somente os alunos lidos; o CSV de resumo registra também as pendências.

Os dados ficam na memória da aba até recarregar/fechar. As consultas são feitas ao GED; não há envio para planilhas ou outros serviços. A biblioteca PDF.js é carregada pelo Tampermonkey, como no módulo Ações em Lote.

## Validação

- PDF fornecido: 26 alunos, 0 PAED, 26 não PAED.
- Leitura verificada com casos de PAED positivo, negativo e desconhecido, turma vazia, duas páginas, linha ausente e identidade/ano divergentes.
- Interface verificada em navegador com grade e respostas simuladas: seleção de 2027/todos os turnos, busca, leitura, CSV e impressão.
- A consulta na sessão real do GED e seus controles de paginação ainda precisam ser validados no uso. Mudanças nos controles nativos ou no formato dos PDFs podem exigir ajuste; erros reconhecidos ficam visíveis no painel.

A implementação está em [acoes-lote-turmas.user.js](acoes-lote-turmas.user.js), integrada ao dropdown de Ações em Lote.

Ao entrar ou sair da ação de previsão, a lista é limpa para exigir uma consulta apropriada à ação escolhida. A previsão não grava checkpoint; a retomada automática de envio à planilha fica suspensa enquanto essa opção estiver selecionada.

