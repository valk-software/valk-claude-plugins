# Onde as coisas moram

> **Este é o contrato de armazenamento do Opensquad, e ele mora aqui, num lugar
> só.** Nenhum outro arquivo do motor nomeia caminho de pasta. Se você está
> escrevendo um prompt e precisa dizer onde algo fica, aponte para cá em vez de
> escrever o caminho — foi por espalhar 141 referências de caminho por dez
> arquivos que a versão anterior deste motor não sobreviveu a sair do
> repositório onde nasceu.

## A regra, em uma frase

**Nada do que um squad produz mora na máquina de quem rodou.** A definição vem
do hub, o conhecimento vem do hub, e cada passo é gravado no hub, amarrado a uma
execução. A pasta de saída local não existe mais.

## O que vem do PACOTE (fixo, versionado, igual para todo mundo)

Isto é motor. Muda uma vez por mês, e chega por atualização do plugin.

| O quê | Onde |
|---|---|
| Instruções das fases de criação | `${CLAUDE_PLUGIN_ROOT}/reference/prompts/` |
| Instruções do executor | `${CLAUDE_PLUGIN_ROOT}/reference/runner.pipeline.md` |
| Motor de skills | `${CLAUDE_PLUGIN_ROOT}/reference/skills.engine.md` |
| Persona do arquiteto | `${CLAUDE_PLUGIN_ROOT}/reference/architect.agent.yaml` |
| Best-practices por formato | `${CLAUDE_PLUGIN_ROOT}/reference/best-practices/{formato}.md` |
| Analisador de vídeo de referência | `${CLAUDE_PLUGIN_ROOT}/scripts/ref-analyzer/` |

Sempre `${CLAUDE_PLUGIN_ROOT}`, nunca caminho relativo ao projeto: um plugin roda
a partir de qualquer pasta, inclusive de uma pasta vazia.

## O que vem da SUA SESSÃO, e não do pacote nem do hub

Uma coisa só, e ela é exceção de propósito: **o navegador**.

| O quê | De onde |
|---|---|
| Investigar perfil de referência | `mcp__claude-in-chrome__*`, ou `mcp__playwright__*` de reserva |

Só o navegador logado alcança perfil privado e lê o texto de um slide como texto
renderizado. Isso não contradiz a regra do alto: ela é sobre onde o trabalho é
GUARDADO, e o resultado da investigação vai para o hub como documento. O
navegador é o olho; o arquivo é da casa.

**Sessão sem navegador não investiga**, e dizer isso é desfecho legítimo.

**Leia, nunca escreva.** A pasta do plugin é substituída inteira a cada
atualização: o que você gravar aqui some sem aviso na próxima versão. Isso vale
inclusive para a saída do `ref-analyzer`, que por isso cai na pasta de onde
você rodou (`./ref-analyzer/`) e não ao lado do script.

## O que vem do HUB (muda toda semana, igual para todo mundo, na hora)

Pelo conector **valk-hub-squads**.

| O quê | Como pegar |
|---|---|
| Perfil da VALK | `contexto_da_empresa` |
| Quais squads existem | `listar_squads` |
| A definição de um squad | `ver_squad` (código) → campo `definicao` |
| Quantas vezes rodou, e o quê | `ver_squad` → campo `execucoes_recentes` |
| Banco de conhecimento | `listar_documentos` por etiqueta, depois `ler_documento` |
| Memória de um squad | `listar_documentos` com as etiquetas `squad:{codigo}` e `memoria` |

## O que VOCÊ grava no hub

| O quê | Como |
|---|---|
| Abrir a execução | `registrar_execucao` sem `execucao_id`, com `squad` |
| Artefato de texto de um passo | `escrever_documento` com `execucao_id` e `passo` |
| Artefato que não é texto | `gravar_arquivo_da_execucao` com `execucao_id` e `passo` |
| Corrigir um passo | `corrigir_documento` — **nunca** um documento novo |
| CRIAR uma imagem | `gerar_imagem` (ela já grava no passo, sem `gravar_arquivo` depois) |
| Publicar um carrossel | `publicar_no_instagram`, e sem `confirmar: true` é só preview |
| Publicar ou corrigir um squad | `publicar_squad` |
| Trabalho para uma pessoa | `criar_tarefa` |
| Fechar a execução | `registrar_execucao` **com** `execucao_id`, tokens e custo |

## As quatro coisas que sumiram, e o que ficou no lugar

Cada uma existia por um motivo, e o motivo continua existindo — o que mudou foi
quem cuida dele.

**1. A pasta `output/{run_id}/`.** O agrupamento por run virou o `execucao_id`.
Não invente run id: quem gera é o hub, quando você abre a execução.

**2. As pastas de versão `v1/`, `v2/`.** Quem versiona agora é o banco:
`corrigir_documento` guarda a versão anterior sozinho e devolve o número novo.
Isto é mais forte do que era — a pasta `v2/` te dava o arquivo novo e te deixava
adivinhar o que mudou; a correção devolve quantos caracteres entraram e saíram,
e avisa quando o texto encolhe pela metade.

**3. O `state.json` e o painel local.** O painel desenhava mesas e agentes numa
tela que só quem rodava via. Quem mostra agora é a tela de squads do hub, que
qualquer pessoa da VALK abre — e ela lê a execução e os artefatos, que você já
está gravando. Durante o run, informe o progresso na conversa; não escreva
arquivo de estado.

**4. O `runs.md`.** O log de execuções virou consulta: `ver_squad` devolve as
execuções recentes com custo e desfecho. Uma tabela escrita à mão envelhece e
diverge; a consulta não.

## As duas guardas, traduzidas

O executor antigo não confiava na própria memória: ele rodava `test -s` e só
andava com a saída do bash na mão, porque "saída de comando não pode ser
alucinada". A regra continua, e a ferramenta é ainda melhor que o bash:

- **Gravou?** `escrever_documento` devolve o `criado` com o uuid, ou estoura.
  Um uuid na mão é prova; "acho que gravei" não é. **Nunca diga que gravou sem
  o uuid de volta.**
- **Existe?** `ler_documento` devolve o texto inteiro, ou diz que não achou.

Nenhuma das duas pede `test -s`, e nenhuma das duas aceita suposição.

## Escrever no banco de conhecimento: um documento não escreve como o outro

`corrigir_documento` **substitui o documento inteiro**. Por isso, antes de
escrever em qualquer documento de conhecimento, pergunte de que tipo ele é — a
resposta está no cabeçalho do próprio documento, que diz qual é o contrato.

| Tipo | O que significa | Como escrever |
|---|---|---|
| **ACUMULADO** | cada run ACRESCENTA, nada some | `ler_documento` inteiro → `corrigir_documento` com o texto TODO **mais** o novo |
| **REESCRITO** | o conteúdo do momento substitui o anterior | `corrigir_documento` com o estado atual, preservando as colunas de histórico |

O exemplo que justifica esta seção: "Receitas visuais de vídeo" é acumulado (13
cartões destilados de 13 vídeos assistidos quadro a quadro) e "Repertório
cultural" é reescrito (as pautas do momento substituem as antigas, mas a coluna
"Usado" nunca é apagada, porque é ela que impede repetir pauta). Tratar os dois
como "sobrescreve" apagaria meses de trabalho, e ninguém perceberia até alguém
procurar um cartão que não está mais lá.

Na dúvida, leia primeiro. Ler custa uma chamada; reescrever por cima custa o que
não dá para refazer.

## A memória do squad

Mora como documento no hub, com as etiquetas `squad:{codigo}` e `memoria`.
Uma por squad.

Vale a mesma regra de sempre, e ela ficou mais importante agora que a memória é
da casa e não da máquina: **só entra feedback EXPLÍCITO da pessoa** — aprovação
com comentário, recusa com motivo, pedido direto. Nunca inferência sua sobre o
que ela pareceu preferir. Uma inferência errada escrita na memória de um squad
que todo mundo usa contamina o trabalho de quem nunca esteve naquela conversa.

Para corrigir, `corrigir_documento` com o texto completo. Lembre que ele
SUBSTITUI: leia antes com `ler_documento`.
