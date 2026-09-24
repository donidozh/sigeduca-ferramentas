# Ferramentas para o SigEduca

Userscripts de Elder Martins para uso com o Tampermonkey.

<a id="instalacao"></a>
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
| Requerimentos | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/requerimentos.user.js) | Menu Ferramentas |
| Extrator de Matrículas | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-matriculas.user.js) | Menu Ferramentas |
| Analisador de Dependências Integrado | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/analisador-dependencias.user.js) | Menu Ferramentas |
| Lançador de Históricos | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/lancador-historicos.user.js) | Menu Ferramentas |
| Ações em Lote (Turmas) | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/acoes-lote-turmas.user.js) | Menu Ferramentas |
| Consulta Alunos em Lote | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/consulta-alunos-lote.user.js) | Menu Ferramentas |
| Extrair Dados Pessoais | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrair-dados-pessoais.user.js) | Menu Ferramentas |
| Arquivo Digital do Aluno | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/arquivo-digital-aluno.user.js) | Menu Ferramentas |
| Relação de Alunos e Planilha Online - Por Turma (Com Atestados) | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/relacao-alunos-planilha.user.js) | Tela específica |
| Extrator de Matrícula Certidão | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/extrator-certidao.user.js) | Tela específica |
| Exportar notas fiscais para CSV | [Instalar / atualizar](https://raw.githubusercontent.com/donidozh/sigeduca-ferramentas/main/notas-fiscais-csv.user.js) | Tela específica |

O Arquivo Digital registra duas entradas no menu (consulta e upload), mas é um único script. Os scripts de tela específica recebem atualização automática pelo Tampermonkey; não se registram no menu lateral e não aparecem na verificação dele. O arquivo modelo-novo-modulo.js é um exemplo para desenvolvimento, não uma ferramenta para instalar.

## Atualizações

- **Automáticas:** habilite as atualizações de scripts nas configurações do Tampermonkey. A extensão consulta os endereços deste repositório no intervalo configurado; a atualização não é instantânea e mudanças de permissões podem exigir confirmação.
- **Pelo SigEduca:** abra Ferramentas e clique em **↻ Verificar atualizações**. O menu confere a própria versão e os módulos registrados na página. Quando houver uma versão nova, clique no botão de atualização e confirme no Tampermonkey; depois recarregue o SigEduca.
- O menu também consulta as versões ao ser aberto, respeitando um intervalo mínimo de 15 minutos na página atual. Falhas de conexão são informadas, sem afirmar que os itens com erro estão atualizados.
- **Adicionar ferramentas** abre a central dentro do próprio SigEduca. A lista é consultada ao abrir o menu (com intervalo mínimo de 15 minutos na página atual); o botão ↻ e a abertura da central também permitem buscar novidades imediatamente.
- A central marca os módulos registrados como **Ativa nesta página**. Módulos desativados ou que não executam na página atual podem aparecer como disponíveis; a instalação só é confirmada pelo Tampermonkey, nunca pelo simples clique no botão.

## Como liberar uma nova versão

1. Edite o arquivo .user.js correspondente.
2. Aumente o número no cabeçalho @version, por exemplo de 3.0.1 para 3.0.2. Mantenha @name, @namespace e os endereços @updateURL / @downloadURL.
3. Confira o código com Node.js: `node --check nome-do-script.user.js`. Teste a ferramenta no SigEduca.
4. Envie o arquivo atualizado para a branch **main** deste repositório. O commit na main é a liberação para os usuários. Use uma branch separada para testes.
5. No SigEduca, use o botão de verificação para conferir a nova versão. O cache do GitHub pode levar alguns minutos para refletir a publicação.

Não é necessário criar uma GitHub Release para distribuir a atualização: neste projeto os endereços apontam para a main. Criar uma Release sozinha, sem alterar os arquivos e o @version na main, não atualiza os scripts.

## Como publicar uma ferramenta nova na central

1. Publique o novo arquivo `.user.js` na raiz da `main`, com nome estável, por exemplo `nova-ferramenta.user.js`. Configure os metadados `@version`, `@updateURL` e `@downloadURL`, como nos scripts existentes.
2. Acrescente uma entrada à lista `ferramentas` de `catalogo.json`:

```json
{
  "id": "nova-ferramenta",
  "titulo": "Nova ferramenta",
  "descricao": "Explique brevemente o que ela faz.",
  "arquivo": "nova-ferramenta.user.js",
  "registros": ["id-usado-no-registro-do-menu"]
}
```

3. Use em `registros` os IDs enviados pelo script no evento `sigeduca:ferramentas:registrar`. Para scripts que não se registram no menu, use `[]`. Para receber verificação de versões pelo menu, envie também `versao`, `updateUrl` e `installUrl` no registro, como nos módulos publicados.
4. Publique o script e o catálogo juntos, ou publique o script primeiro. Os usuários verão a novidade na próxima consulta da central, sem reinstalar o menu. A nova ferramenta só executará após a instalação confirmada no Tampermonkey.

O catálogo aceita somente arquivos `.user.js` deste repositório. Não inclua dados de alunos nem configurações particulares. Para testar a atualização e o catálogo localmente: `node verificar-atualizacoes.test.cjs`.

## Configurações particulares

A Relação de Alunos precisa dos seus próprios links de planilha e Apps Script, configurados na engrenagem da ferramenta. Links já salvos no navegador continuam sendo usados. O Arquivo Digital também exige a configuração dos serviços usados pela escola. Não publique links particulares, tokens, relações de alunos, PDFs ou arquivos de configuração de turmas neste repositório.

A automação de turmas em sigeduca-automatico é um projeto separado e não faz parte desta distribuição. As bibliotecas externas continuam sendo carregadas pelos @require originais.

[Referência de atualização do Tampermonkey](https://www.tampermonkey.net/documentation.php#meta:updateURL).
