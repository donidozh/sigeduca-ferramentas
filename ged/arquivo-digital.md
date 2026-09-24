# Arquivo Digital 0.15.0

**Teste de busca no servidor (padrão na 0.15.0):** a tela abre sem construir ou baixar índices locais. Cada pesquisa envia somente nome, nascimento e arquivo ao Apps Script e recebe até 150 candidatos. O servidor calcula a semelhança do nome (incluindo pequenos erros de digitação), prioriza nome exato e nascimento correspondente e devolve as pontuações. A porcentagem não é uma probabilidade de identidade.

Em **Configurações → Modo de pesquisa**, é possível voltar a **Índices neste computador (modo anterior)**. Os índices locais anteriores são preservados. No modo servidor, o tempo total da requisição e o tempo interno do Google aparecem nas configurações e no registro de processamento.

Este primeiro teste reaproveita o índice compartilhado do Apps Script, com validade de 15 minutos. A primeira consulta após perda/expiração desse cache ainda precisa preparar o índice no Google e pode demorar. Ainda não foi instalado um agendamento de pré-aquecimento; a comparação entre a primeira consulta e as seguintes orientará essa próxima decisão.

Uma única entrada **Arquivo Digital** reúne as abas **Consultar Pasta**, **Incluir Pasta**, **Documentos Internos**, **Configurações** e **Ajuda**. Consulta e inclusão compartilham a busca e a pasta selecionada. Alternar abas mantém as páginas e classificações. Os atalhos antigos continuam compatíveis.

Servidores contratados, efetivos e documentos internos estão apenas sinalizados como áreas em preparação; seu acesso ainda depende das futuras planilhas e da proteção no serviço.

Em **Configurações → Listas e pesquisa → Reconstruir índice completo**, escolha Permanente ou Formandos. A reconstrução ignora o cache do serviço, relê todas as caixas e só substitui o índice local após concluir. Se falhar, o índice anterior é preservado. O andamento aparece na mesma seção. Isso não altera a pasta selecionada.

O sistema exige um aluno selecionado da planilha antes de enviar ao Drive ou ao GED. Se ainda não existir, use **Cadastrar aluno**: informe nome e nascimento, escolha uma caixa da inicial do nome ou **Abrir nova caixa**. Todas as caixas ficam disponíveis; o técnico escolhe conforme o espaço físico. O serviço confere duplicidade, insere o cadastro e prepara a pasta digital com seu vínculo. Se a preparação da pasta falhar, o cadastro é preservado e uma nova tentativa conclui o vínculo.

**Duplicar página** cria uma cópia independente para classificar dois documentos digitalizados na mesma folha. A cópia contém a folha inteira, sem recorte automático, e pode receber outro tipo e outra rotação. A lista de classificação agora é única, com nomes como RG/CPF Aluno, RG/CPF Responsável, Cartão de Vacina, Tipo Sanguíneo e Certidão de Nascimento.

Novas caixas usam título na linha 1 e as colunas Nº, Nome, Data de nascimento, Pasta Digital e Observações na linha 2, com cabeçalho fixo. O cadastro e a criação de caixas são coordenados pelo serviço para evitar duplicação em acessos simultâneos. Os uploads de pastas diferentes continuam em paralelo.

O script reúne consulta de alunos e organização de documentos. Instale ou atualize `arquivo-digital-aluno.user.js` no Tampermonkey.

## Organização e envio

- Adicione vários PDFs, JPGs e PNGs, até 120 MB no conjunto. Novos arquivos são acrescentados às páginas existentes. Uma importação inválida preserva o trabalho aberto.
- Marque páginas para classificar, girar ou ignorar em lote. Use os filtros e Desfazer para revisar a organização.
- Identificar documentos executa leitura de texto/OCR em um clique. Escolhas manuais são preservadas; evidências fracas ou discordantes exigem revisão.
- O rascunho automático guarda os documentos e a organização no navegador. Aguarde a indicação de salvamento, ou use Rascunho → Salvar rascunho agora. Limpar remove o rascunho. Os dados não são enviados ao GitHub.
- Revise aluno, código, destinos, tipos e páginas ignoradas antes de confirmar. O download local contém as páginas selecionadas na ordem atual.
- Para GED, documentos acima de 5 MB precisam de redução aprovada na prévia. A redução rasteriza as páginas e pode remover texto pesquisável/assinaturas; o PDF único local mantém a cópia original das páginas.
- O resultado aparece por documento e por destino. Reenviar somente pendentes preserva os envios confirmados no lote atual. O navegador só informa que solicitou um download, não comprova a gravação em disco.

## Busca rápida

A versão 0.13.0 mantém o índice de nomes neste navegador entre recarregamentos. Ao abrir Incluir Pasta pela primeira vez, a tela de carregamento prepara PDF e OCR; a busca de nomes se prepara em segundo plano. Quando já existe um índice, as consultas usam os dados locais imediatamente, inclusive durante atualização ou falha de conexão. Antes de enviar, o serviço continua conferindo a identidade e a posição atual do aluno na planilha.

Cadastrar um aluno acrescenta ou atualiza somente esse registro no cache. Com o backend 1.4.0, cada computador confere alterações do serviço a cada dois minutos enquanto a tela está aberta e o usuário não está processando documentos. Sem novidades, a resposta não lê planilhas. Com novidades, baixa as caixas alteradas e preserva as demais. A atualização não substitui a seleção que o técnico está usando.

Edições feitas diretamente no Google Sheets entram em uma conferência completa após uma hora desde a última leitura completa, em segundo plano. Para antecipar, use **Configurações → Opções de busca → Atualizar busca** ou **Reconstruir índice completo**. A primeira sincronização, um histórico de alterações perdido, muitas caixas alteradas ou a limpeza do cache ainda exigem uma leitura completa. O índice antigo permanece disponível até o novo terminar, e dados parciais não substituem o cache. O primeiro uso sem índice precisa aguardar essa leitura para pesquisar localmente.

Consultas avulsas, usadas quando o serviço não oferece índice, continuam em cache por 15 minutos. **Limpar cache** apaga os índices e consultas locais da configuração atual. Serviço e chave de acesso diferentes usam caches separados.

Durante a consulta ou sincronização manual, a seleção de arquivo fica bloqueada. Ao trocar de arquivo depois da conclusão, a seleção anterior do aluno é descartada. Digite apenas os números do nascimento: `25032010` vira `25/03/2010`. Datas impossíveis, futuras ou incompletas são recusadas.

## Carregamento e OCR

A versão 0.12.0 remove a IA, seu modelo e seu pré-carregamento. A tela prepara somente PDF, OCR em português e a busca de alunos quando configurada. O Tesseract ainda pode baixar os arquivos necessários ao OCR no primeiro uso.

**Identificar documentos** lê o texto do PDF ou executa OCR. Títulos e conjuntos de campos característicos identificam o tipo; palavras-chave isoladas exigem revisão. A classificação manual é preservada. RG/CPF sempre pede confirmar se pertence ao aluno ou ao responsável. Folhas com dois tipos identificados sugerem duplicação.

A lista inclui **NIS/CadÚnico**, **Declaração Vacinal** (separada do Cartão de Vacina) e **Atestados Médicos**. O nome plural substitui Atestado Médico mantendo a categoria existente e a compatibilidade dos rascunhos. Os dois novos tipos podem ser arquivados no Drive e baixados; não têm código de anexo GED associado.

O código do SIGEDUCA aparece somente quando o destino GED está selecionado.

O servidor lê intervalos inteiros, mantém um índice compartilhado comprimido e valida a versão entre páginas de sincronização. Antes de gravar vínculos ou arquivos, confere novamente a identidade e a linha atual do aluno. Não depende do número de linha salvo no cache para decidir onde escrever.

## Backend Google Apps Script

O arquivo `arquivo-digital-backend.gs` contém o serviço 1.4.0, necessário para cadastro e verificação do aluno selecionado. A publicação no GitHub não atualiza automaticamente uma implantação do Apps Script. Nesta atualização, mantenha o endereço da implantação existente e publique uma nova versão do serviço.

Na instalação nova, configure nas **Propriedades do script**:

| Propriedade | Conteúdo |
| --- | --- |
| API_TOKEN | Chave compartilhada com os usuários autorizados |
| ROOT_PERMANENTE | ID da pasta raiz PERMANENTE |
| ROOT_FORMANDOS | ID da pasta raiz FORMANDOS |
| SHEET_PERMANENTE | ID da planilha PERMANENTE |
| SHEET_FORMANDOS | ID da planilha FORMANDOS |

Na migração de um projeto existente, preserve os IDs e a chave da configuração privada. O serviço aceita o bloco CONFIG anterior durante a migração; o restante deve ser substituído integralmente para evitar funções duplicadas. Não copie configurações privadas para o GitHub.

Atualize a implantação existente como Web App, mantendo o endereço e as permissões já utilizadas. Teste a ação `ping`: a resposta deve indicar versão `1.4.0` e capacidades `studentIndex`, `idempotentUpload`, `parallelFolders` `studentRegistration` e `studentChanges`.

## Trabalho simultâneo

- Cada computador organiza e classifica seus próprios arquivos localmente.
- Criação de pastas e vínculo na planilha usam uma seção curta protegida pelo bloqueio do script.
- Os uploads usam uma reserva por pasta: pastas distintas prosseguem em paralelo; uma pasta ocupada informa que o usuário deve tentar novamente.
- Uma reserva interrompida por encerramento abrupto expira em 15 minutos. Reservas concluídas são liberadas imediatamente.
- Arquivos recebem um sufixo de identificação pelo conteúdo. Um reenvio idêntico ao mesmo nome e pasta retorna o arquivo existente; conteúdos diferentes são preservados em arquivos distintos.
- Linhas que mudaram, datas divergentes, homônimos ambíguos e pastas de outro aluno bloqueiam a gravação. Essa proteção depende do backend 1.2.0 estar implantado.
- O bloqueio só coordena gravações feitas por este serviço. Edições manuais simultâneas da estrutura da planilha e uploads externos não participam da reserva.

## Verificação

Execute `node arquivo-digital.test.cjs`, `node arquivo-digital-backend.test.cjs`, `node verificar-atualizacoes.test.cjs` e `node termos-compromisso.test.cjs`.

Os testes do backend simulam Sheets/Drive e verificam concorrência, retomada, identidade e repetição de arquivos. A integração final precisa de validação na implantação Google e no SIGEDUCA reais. O OCR usa o Tesseract já configurado pelo script; resultados de documentos escaneados dependem da qualidade das imagens.

## Posição das novas caixas — serviço 1.4.1

Uma nova caixa é inserida após a anterior na ordem de letra e número: A6 após A5, J9 após J8 e A11 após A10. Se a letra ainda não tiver caixas, a aba entra na posição alfabética correspondente. As abas existentes mantêm sua ordem. A correção é no Apps Script e não exige atualizar o userscript.

## Primeiro carregamento no modo local — 0.14.1

No modo local, no primeiro uso de cada computador/configuração, a tela permanece bloqueada até concluir os índices de Permanente e Formandos. A tela mostra um indicador circular e a contagem de nomes por arquivo. Se ocorrer uma falha, permite configurar a conexão ou tentar novamente, aproveitando o índice que já terminou; não há botão para ignorar essa etapa. Com os dois índices salvos, as próximas aberturas usam o cache imediatamente. A interface tem hover e transições suaves entre abas, respeitando a preferência de movimento reduzido do sistema.

## Visualização de arquivos privados e consulta

O botão **Visualizar** solicita o PDF autenticado ao Apps Script, que confere o vínculo com a pasta selecionada e devolve o conteúdo. O leitor do sistema usa PDF.js com navegação entre páginas, sem depender do login do Drive no navegador. Nenhuma permissão de compartilhamento é alterada. O limite desta visualização é 20 MB. **Abrir no Drive** continua exigindo acesso pela conta Google; **Abrir PDF em nova guia** usa a cópia temporária carregada no navegador. A chave de conexão autoriza o acesso no sistema; ainda não há contas individuais nem acesso a servidores.

A consulta mostra uma camada semitransparente enquanto aguarda. Nas correspondências, clique em qualquer ponto da linha ou use Enter/Espaço na linha focada. O botão Selecionar continua disponível.

Teste real de Permanente: preparação inicial do índice no servidor em 326,07 s; consultas seguintes em 0,925 s e 0,984 s internos. Esses tempos não incluem rede/navegador e não garantem o mesmo tempo em outros arquivos. O modo experimental aguarda até 390 s na requisição; continua sujeito ao limite de execução do Apps Script.
