# Ferramentas para o SigEduca

Userscripts de Elder Martins para uso com o Tampermonkey.

<a id="instalacao"></a>
## Organização por módulo

- [GED — Gestão Escolar](ged/): ferramentas usadas em `/ged`, menu azul.
- [GPE — Gestão de Pessoas](gpe/): pasta para as futuras ferramentas usadas em `/grh`, menu vermelho.
- [GPO](gpo/): exportador de notas fiscais, menu marrom.

O menu base e o catálogo ficam na raiz. As ferramentas ficam exclusivamente nas pastas de seus módulos. Os endereços antigos da raiz foram removidos. Quem instalou antes da reorganização deve atualizar o menu para 2.8.2 e reinstalar as ferramentas pela central uma vez para receber os novos endereços de atualização.

**Atualize o menu para 2.8.2** para ler os novos caminhos do catálogo.

## Instalação

1. Instale o [Tampermonkey](https://www.tampermonkey.net/) no navegador e habilite a execução de userscripts conforme as instruções da extensão.
2. Instale primeiro o **Menu Lateral de Ferramentas** pelo primeiro link da tabela.
3. Abra o SigEduca e clique em **Ferramentas → Adicionar ferramentas**. Se só o menu estiver instalado, a central aparece automaticamente ao abrir o painel.
4. Escolha uma ferramenta, clique em **Instalar** e confirme no Tampermonkey. Recarregue o SigEduca depois de instalar.

**Basta distribuir o link do menu.** As demais ferramentas e as futuras novidades aparecem na central dentro do SigEduca, sem precisar visitar este repositório. A lista abaixo continua disponível como alternativa.

Se você já usava os scripts antigos, instale estas versões uma vez para receber os endereços de atualização. Os nomes e namespaces foram preservados para permitir a atualização das instalações existentes. Confira se não ficaram cópias duplicadas ativas.

| Ferramenta | Instalação | Onde aparece |
| --- | --- | --- |
| Menu Lateral de Ferramentas (Base) | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/menu-ferramentas.user.js) | Menu Ferramentas |
| Termos de Compromisso | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/termos-compromisso.user.js) | Menu Ferramentas |
| Requerimentos | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/requerimentos.user.js) | Menu Ferramentas |
| Extrator de Matrículas | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrator-matriculas.user.js) | Menu Ferramentas |
| Analisador de Dependências Integrado | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/analisador-dependencias.user.js) | Menu Ferramentas |
| Lançador de Históricos | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/lancador-historicos.user.js) | Menu Ferramentas |
| Ações em Lote (Turmas) | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/acoes-lote-turmas.user.js) | Menu Ferramentas |
| Consulta Alunos em Lote | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/consulta-alunos-lote.user.js) | Menu Ferramentas |
| Extrair Dados Pessoais | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrair-dados-pessoais.user.js) | Menu Ferramentas |
| Arquivo Digital do Aluno | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/arquivo-digital-aluno.user.js) | Menu Ferramentas |
| Relação de Alunos e Planilha Online - Por Turma (Com Atestados) | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/relacao-alunos-planilha.user.js) | Tela específica |
| Extrator de Matrícula Certidão | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/ged/extrator-certidao.user.js) | Tela específica |
| Exportar notas fiscais para CSV | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/gpo/notas-fiscais-csv.user.js) | Tela específica |

O Arquivo Digital registra duas entradas no menu (consulta e upload), mas é um único script. Os scripts de tela específica recebem atualização automática pelo Tampermonkey; não se registram no menu lateral e não aparecem na verificação dele. O arquivo modelo-novo-modulo.js é um exemplo para desenvolvimento, não uma ferramenta para instalar.

## Termos de Compromisso

Consulte também as [novidades e orientações do Arquivo Digital 0.12.0](ged/arquivo-digital.md): cadastro em caixas, seleção obrigatória antes do envio, duplicação de páginas, lista única e identificação local de documentos.

Disponível em **Ferramentas → Adicionar ferramentas → Termos de Compromisso**. Usa a mesma página-base de Requerimentos, preservando o campo de código e a lupa nativa do aluno, com uma página separada para emissão de termos.

1. Selecione o aluno pela lupa ou informe o código. Aguarde a consulta automática ou use **Carregar dados**.
2. Confira os dados do aluno, responsável e matrícula. Dados ausentes podem ser completados na tela, sem alterar o cadastro do SigEduca.
3. Escolha o tipo de termo. **Uso de imagem e voz** seleciona automaticamente o modelo de menor ou maior de idade pela idade completa na data de emissão. Nascimento ausente, inválido ou futuro impede essa emissão até ser corrigido.
4. Em **Entrega de documentos pendentes**, marque os documentos faltantes, informe o prazo e quem assume o compromisso. A impressão mantém os 12 itens do modelo fornecido e marca com X apenas os selecionados.
5. Clique em **Visualizar e imprimir**, confira o documento e use **Imprimir / Salvar em PDF**. Na impressão A4, desative cabeçalhos e rodapés do navegador e mantenha escala de 100%.

Também inclui ciência do tratamento de dados pessoais, compromisso familiar para menor (ano letivo subsequente, conforme o script fornecido) e autorização de matrícula/retirada de documentos. O termo militar foi removido. Dados complementares da escola podem ser preenchidos na seção correspondente. O texto e as referências do termo de documentos seguem o modelo de 2026 da Escola Estadual Onze de Março enviado para esta adaptação; os campos de escola, ano, matrícula e datas são preenchidos na emissão.

As imagens ficam no próprio script, sem depender de carregamento externo durante a impressão. Dados dos alunos permanecem na página e nas consultas ao próprio SigEduca; não são publicados no GitHub nem gravados pelo script. Se o antigo script **SIGEDUCA - Emissão de Termos** estiver ativo, desative-o para evitar o painel antigo junto da nova central.

Testes do módulo: `node termos-compromisso.test.cjs`. Interface e documentos foram conferidos com dados fictícios; a consulta em sessão real do SigEduca precisa de validação no ambiente da escola.

## Atualizações

- **Automáticas:** habilite as atualizações de scripts nas configurações do Tampermonkey. A extensão consulta os endereços deste repositório no intervalo configurado; a atualização não é instantânea e mudanças de permissões podem exigir confirmação.
- **Pelo SigEduca:** abra Ferramentas e clique em **↻ Verificar atualizações**. O menu confere a própria versão e os módulos registrados na página. Quando houver uma versão nova, clique no botão de atualização e confirme no Tampermonkey; depois recarregue o SigEduca.
- O menu também consulta as versões ao ser aberto, respeitando um intervalo mínimo de 15 minutos na página atual. Falhas de conexão são informadas, sem afirmar que os itens com erro estão atualizados.
- **Adicionar ferramentas** abre a central dentro do próprio SigEduca. A lista é consultada ao abrir o menu (com intervalo mínimo de 15 minutos na página atual); o botão ↻ e a abertura da central também permitem buscar novidades imediatamente.
- A central marca os módulos registrados como **Ativa nesta página**. Módulos desativados ou que não executam na página atual podem aparecer como disponíveis; a instalação só é confirmada pelo Tampermonkey, nunca pelo simples clique no botão.

## Como liberar uma nova versão

1. Edite o arquivo .user.js correspondente na pasta do módulo.
2. Aumente o número no cabeçalho @version, por exemplo de 3.0.1 para 3.0.2. Mantenha @name, @namespace e os endereços @updateURL / @downloadURL.
3. Confira o código com Node.js: `node --check nome-do-script.user.js`. Teste a ferramenta no SigEduca.
4. Envie o arquivo atualizado para a branch **main** deste repositório. O commit na main é a liberação para os usuários. Use uma branch separada para testes.
5. No SigEduca, use o botão de verificação para conferir a nova versão. O cache do GitHub pode levar alguns minutos para refletir a publicação.

Não é necessário criar uma GitHub Release para distribuir a atualização: neste projeto os endereços apontam para a main. Criar uma Release sozinha, sem alterar os arquivos e o @version na main, não atualiza os scripts.

## Como publicar uma ferramenta nova na central

1. Publique o novo arquivo `.user.js` na pasta do módulo da `main`, com nome estável, por exemplo `nova-ferramenta.user.js`. Configure os metadados `@version`, `@updateURL` e `@downloadURL`, como nos scripts existentes.
2. Acrescente uma entrada à lista `ferramentas` de `catalogo.json`:

```json
{
  "id": "nova-ferramenta",
  "titulo": "Nova ferramenta",
  "descricao": "Explique brevemente o que ela faz.",
  "arquivo": "ged/nova-ferramenta.user.js",
  "registros": ["id-usado-no-registro-do-menu"],
  "modulos": ["ged"]
}
```

3. Use em `registros` os IDs enviados pelo script no evento `sigeduca:ferramentas:registrar`. Para scripts que não se registram no menu, use `[]`. Para receber verificação de versões pelo menu, envie também `versao`, `updateUrl` e `installUrl` no registro, como nos módulos publicados.
4. Publique o script e o catálogo juntos, ou publique o script primeiro. Os usuários verão a novidade na próxima consulta da central, sem reinstalar o menu. A nova ferramenta só executará após a instalação confirmada no Tampermonkey.

O catálogo aceita somente arquivos `.user.js` deste repositório. Não inclua dados de alunos nem configurações particulares. Para testar a atualização e o catálogo localmente: `node verificar-atualizacoes.test.cjs`.

## Configurações particulares

A Relação de Alunos precisa dos seus próprios links de planilha e Apps Script, configurados na engrenagem da ferramenta. Links já salvos no navegador continuam sendo usados. O Arquivo Digital também exige a configuração dos serviços usados pela escola. Não publique links particulares, tokens, relações de alunos, PDFs ou arquivos de configuração de turmas neste repositório.

A automação de turmas em sigeduca-automatico é um projeto separado e não faz parte desta distribuição. As bibliotecas externas continuam sendo carregadas pelos @require originais.

[Referência de atualização do Tampermonkey](https://www.tampermonkey.net/documentation.php#meta:updateURL).

## GED e Gestão de Pessoas

O menu 2.8.0 identifica o módulo pelo endereço: `/ged` exibe GED em azul; `/grh` exibe GPE em vermelho. O catálogo e os links registrados são filtrados pelo módulo atual. Ainda não há ferramentas GPE publicadas.

Para uma nova ferramenta GPE, use `modulos: ["grh"]` no catálogo, `@match *://sigeduca.seduc.mt.gov.br/grh/*` no userscript e uma URL dentro de `/grh/` no registro. Para GED, use `ged`. Entradas antigas sem `modulos` continuam sendo GED. A ferramenta de notas fiscais é marcada como `gpo`, seu módulo de origem, e não aparece na central GED/GPE. O menu também identifica `/gpo` e usa marrom nessa área. Categorias serão definidas posteriormente.

O Lançador de Históricos 5.1.0 usa um painel mais próximo do GED, com cabeçalho azul, campos e ações organizados e tabela com rolagem horizontal em telas menores. A lógica de lançamento foi preservada.

