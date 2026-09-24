# Arquivo Digital 0.11.0

A versão 0.11.0 exige um aluno selecionado da planilha antes de enviar ao Drive ou ao GED. Se ainda não existir, use **Cadastrar aluno**: informe nome e nascimento, escolha uma caixa da inicial do nome ou **Abrir nova caixa**. Todas as caixas ficam disponíveis; o técnico escolhe conforme o espaço físico. O serviço confere duplicidade, insere o cadastro e prepara a pasta digital com seu vínculo. Se a preparação da pasta falhar, o cadastro é preservado e uma nova tentativa conclui o vínculo.

**Duplicar página** cria uma cópia independente para classificar dois documentos digitalizados na mesma folha. A cópia contém a folha inteira, sem recorte automático, e pode receber outro tipo e outra rotação. A lista de classificação agora é única, com nomes como RG/CPF Aluno, RG/CPF Responsável, Cartão de Vacina, Tipo Sanguíneo e Certidão de Nascimento.

Novas caixas usam título na linha 1 e as colunas Nº, Nome, Data de nascimento, Pasta Digital e Observações na linha 2, com cabeçalho fixo. O cadastro e a criação de caixas são coordenados pelo serviço para evitar duplicação em acessos simultâneos. Os uploads de pastas diferentes continuam em paralelo.

A versão 0.10.2 usa IndexedDB para guardar o modelo quando a Cache API está indisponível, como em HTTP. Se o armazenamento for recusado ou estiver cheio, o modelo ainda pode ser usado, mas poderá precisar de novo download. As chamadas ao Web App usam a chave configurada, sem cookies de sessões Google. Erros HTTP aparecem como mensagens curtas, sem despejar páginas HTML na interface.

A versão 0.10.1 corrige a inicialização da IA, a consulta e a identificação dos arquivos quando `crypto.randomUUID` e `crypto.subtle` não estão disponíveis (como em páginas HTTP). A tela de carregamento preserva a causa de cada falha, em vez de exibir somente uma mensagem genérica.

O script reúne consulta de alunos e organização de documentos. Instale ou atualize `arquivo-digital-aluno.user.js` no Tampermonkey.

## Organização e envio

- Adicione vários PDFs, JPGs e PNGs, até 120 MB no conjunto. Novos arquivos são acrescentados às páginas existentes. Uma importação inválida preserva o trabalho aberto.
- Marque páginas para classificar, girar ou ignorar em lote. Use os filtros e Desfazer para revisar a organização.
- Identificar documentos executa leitura de texto/OCR e IA local em um clique. Escolhas manuais são preservadas; evidências fracas ou discordantes exigem revisão. As pontuações não representam probabilidades.
- O rascunho automático guarda os documentos e a organização no navegador. Aguarde a indicação de salvamento, ou use Rascunho → Salvar rascunho agora. Limpar remove o rascunho. Os dados não são enviados ao GitHub.
- Revise aluno, código, destinos, tipos e páginas ignoradas antes de confirmar. O download local contém as páginas selecionadas na ordem atual.
- Para GED, documentos acima de 5 MB precisam de redução aprovada na prévia. A redução rasteriza as páginas e pode remover texto pesquisável/assinaturas; o PDF único local mantém a cópia original das páginas.
- O resultado aparece por documento e por destino. Reenviar somente pendentes preserva os envios confirmados no lote atual. O navegador só informa que solicitou um download, não comprova a gravação em disco.

## Busca rápida

Consultas repetidas ficam em cache por 15 minutos, separadas por serviço, chave, arquivo, nome e nascimento. Opções de busca → Atualizar busca ignora o cache e solicita uma nova leitura ao serviço. Limpar cache remove os resultados e índices locais da configuração atual.

Com o backend 1.2.0, a sincronização baixa um índice de PERMANENTE ou FORMANDOS, também disponível em Opções de busca → Sincronizar nomes. Durante a validade do índice (15 minutos desde a leitura no servidor), novos nomes são pesquisados localmente. Índices incompletos não são ativados. Quando expiram, são renovados na próxima consulta. A primeira leitura de uma planilha grande ainda pode levar tempo e é feita em blocos de 20 abas.

Durante a consulta ou sincronização, a seleção de arquivo fica bloqueada. Ao trocar de arquivo depois da conclusão, a seleção anterior do aluno é descartada. Digite apenas os números do nascimento: `25032010` vira `25/03/2010`. Datas impossíveis, futuras ou incompletas são recusadas.

## Carregamento e IA local

Ao abrir a tela de upload, “Carregando o sistema” prepara PDF, OCR em português, IA e o índice do arquivo selecionado, quando o serviço está configurado. Há opção de tentar novamente ou continuar com classificação manual se algum recurso falhar.

O modelo gratuito [mDeBERTa multilíngue para classificação](https://huggingface.co/onnx-community/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7-ONNX) substitui a comparação de similaridade do MiniLM anterior. O download automático tem aproximadamente 338 MB na versão quantizada, além do leitor de texto e arquivos de execução, e fica no cache do navegador. O primeiro carregamento exige internet e pode demorar. Limpeza do cache ou outro navegador pode exigir novo download. O processamento ocorre no computador, sem enviar documentos ao provedor da IA.

A identificação combina títulos, conjuntos de campos característicos e o classificador. Quando o OCR fica fraco, tenta outras orientações de leitura. Folhas com evidências de mais de um tipo pedem revisão e sugerem duplicação. RG/CPF exige confirmar a titularidade (aluno ou responsável); a IA não decide isso sozinha. Resultados pouco discriminativos ficam como Diversos/revisar. Pontuações não são uma taxa de acerto, e o modelo não foi treinado nos documentos da escola.

Validação da versão: 26 testes do script e 16 do serviço, além de 16 verificações de PDF, imagem, rascunho e duplicação no navegador. O fluxo de cadastro foi conferido com serviço simulado e a listagem de caixas com leitura nas planilhas reais. O classificador foi executado em HTTP sem Web Crypto/Cache API: em 14 textos sintéticos sem títulos explícitos, escolheu o tipo esperado em 11; isso não mede precisão em digitalizações reais. Os erros motivaram regras para campos característicos e critérios conservadores de revisão. Nenhum aluno fictício foi cadastrado nas planilhas reais.

O código do SIGEDUCA aparece somente quando o destino GED está selecionado.

O servidor lê intervalos inteiros, mantém um índice compartilhado comprimido e valida a versão entre páginas de sincronização. Antes de gravar vínculos ou arquivos, confere novamente a identidade e a linha atual do aluno. Não depende do número de linha salvo no cache para decidir onde escrever.

## Backend Google Apps Script

O arquivo `arquivo-digital-backend.gs` contém o serviço 1.3.0, necessário para cadastro e verificação do aluno selecionado. A publicação no GitHub não atualiza automaticamente uma implantação do Apps Script. Nesta atualização, mantenha o endereço da implantação existente e publique uma nova versão do serviço.

Na instalação nova, configure nas **Propriedades do script**:

| Propriedade | Conteúdo |
| --- | --- |
| API_TOKEN | Chave compartilhada com os usuários autorizados |
| ROOT_PERMANENTE | ID da pasta raiz PERMANENTE |
| ROOT_FORMANDOS | ID da pasta raiz FORMANDOS |
| SHEET_PERMANENTE | ID da planilha PERMANENTE |
| SHEET_FORMANDOS | ID da planilha FORMANDOS |

Na migração de um projeto existente, preserve os IDs e a chave da configuração privada. O serviço aceita o bloco CONFIG anterior durante a migração; o restante deve ser substituído integralmente para evitar funções duplicadas. Não copie configurações privadas para o GitHub.

Atualize a implantação existente como Web App, mantendo o endereço e as permissões já utilizadas. Teste a ação `ping`: a resposta deve indicar versão `1.2.0` e capacidades `studentIndex`, `idempotentUpload` e `parallelFolders`.

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
