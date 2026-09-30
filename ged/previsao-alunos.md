# Previsão de alunos por turma

Atualize o Ações em Lote para a versão **4.5.0**, recarregue o GED e escolha **Previsão de alunos por turma (PAED)** no dropdown.

1. Use a lista de turmas já restaurada do cache pelo Ações em Lote. Se precisar atualizá-la, clique no botão original **Atualizar Turmas**.
2. Marque as turmas desejadas na mesma lista do painel.
3. Clique em **Gerar previsão de alunos**. O ano da previsão é **2027**.
4. Confira os totais e a coluna **Vagas disponíveis**, ao lado da turma, e expanda cada turma para ver os alunos. É possível baixar resumo e alunos em CSV ou imprimir/salvar PDF.

A previsão usa exatamente a mesma busca e o mesmo cache das outras ações. Ela não depende de um botão de impressão de previsão nem de um filtro de ano específico. Ao consultar cada turma, cria uma cópia da URL: troca `arralunossituacao.aspx` por `arrprevisaoalunosturma.aspx` e o primeiro parâmetro por `2027`. Todos os demais parâmetros permanecem intactos, inclusive os filtros finais. A URL no cache não é modificada. Alternar entre as ações preserva a lista e suas marcações.

A classificação usa a coluna **Aluno PAED?**. Todos os alunos previstos no PDF entram na contagem, independentemente da matrícula efetivada. O total geral é a soma por turma, não o número de pessoas únicas entre turmas.

Cada PDF é conferido pela escola, nome da turma, turno quando disponível, sequência, códigos únicos e total do rodapé. Falhas aparecem como pendências, nunca como turma vazia. PAED diferente de SIM/NÃO fica como **não identificado**. O CSV detalhado contém somente alunos lidos; o resumo registra também as pendências.

Os resultados ficam na memória da aba. A previsão não envia dados para planilhas e não grava checkpoint. A retomada automática de envio à planilha fica suspensa enquanto a previsão estiver selecionada.

## Vagas e leitura do PDF

A capacidade segue os valores informados pelo usuário: **30 no ensino fundamental** e **35 no ensino médio/EPT**. A etapa é identificada no cabeçalho do PDF. Vagas disponíveis são a capacidade menos o total de alunos, com mínimo zero. Turmas acima da capacidade mostram o excedente na situação. Quando a leitura falha ou a etapa não é identificada, as vagas ficam sem valor; não são presumidas vagas livres.

Páginas de continuação reutilizam as posições das colunas da primeira página. Páginas apenas com totais ou continuação do rodapé também são aceitas. A mensagem explícita do GED “Não há aluno(s) matriculado(s) na Série/Ano/Fase.” permite confirmar uma turma vazia sem rodapé numérico; ela aparece como **Sem alunos**. Ausência de texto por si só não confirma zero alunos.

## Validação

- PDF original: 26 alunos, 0 PAED, 26 não PAED e 9 vagas para EPT.
- PDF reunido: 43 páginas, 25 relatórios (incluindo um repetido), conferidos individualmente. Total e PAED comparados com extração independente; turmas vazias, continuação sem cabeçalho, rodapé separado e excedentes tratados.
- Interface, CSV e impressão testados com quatro dos relatórios reais.
- Testes sem dados pessoais: `node tests/previsao-alunos.cjs`.
- Teste em navegador com cache de 2026: geração sem nova busca, preservação das marcações e do cache e URL convertida para previsão de 2027 sem alterar os parâmetros restantes.
- Teste do botão original Atualizar Turmas: consulta todos os turnos, atualiza a mesma lista e salva o cache; a previsão também funciona a partir dessa lista.
- A sessão real do GED não foi usada nos testes; as respostas e a grade foram simuladas.

Implementação: [acoes-lote-turmas.user.js](acoes-lote-turmas.user.js). O script separado de previsão das primeiras versões não é necessário e pode ser desativado no Tampermonkey.
