<!-- Fonte: valk-hub/docs/rotina-do-agente-no-hub.md — edite lá e recopie. -->

# Rotina do agente no Valk Hub

Vale para QUALQUER sessão de desenvolvimento — qualquer repo, qualquer worktree,
qualquer agente. O trabalho que vira commit existe no hub antes de existir no
código.

Se o conector do Valk Hub não estiver na sessão, **diga isso na primeira
resposta** e siga o trabalho sem ele. Nunca relate como registrado o que não foi.

## A regra

Toda unidade de trabalho que vai gerar commit tem uma tarefa no hub, e ela
atravessa três momentos:

1. **Antes de editar arquivo** — a tarefa existe e está em `doing`.
2. **Enquanto anda** — cada transição é relatada ao usuário, com o `ref`.
3. **Quando entrega** — vai para `done`, com `horas_gastas`.

`done` é quando o trabalho está **no ar**, não quando o código compila. Se está
em PR aberto, ainda é `doing`.

## Quando NÃO abrir tarefa

- Responder pergunta, ler código, investigar sem mudar nada.
- Typo, formatação, renomear variável — a menos que o usuário peça.
- Trabalho que o usuário já mandou registrar em outra tarefa.

Uma tarefa por unidade **entregável**, não por arquivo tocado. Três arquivos
para o mesmo efeito são uma tarefa; um refactor e um bug corrigido de passagem
são duas.

## Antes de criar, PROCURE

`listar_tarefas` com a etiqueta do projeto e `status: "todo"`. Várias sessões
rodam em paralelo em worktrees diferentes, e duas tarefas para o mesmo trabalho
é o erro mais caro desta rotina — porque ninguém percebe. Achou uma que já
cobre? Use ela.

## O título é para quem não escreveu o código

Quem lê é sócio, cliente, alguém voltando de férias. O título nomeia **o
problema ou o resultado, em português de gente**. O detalhe técnico vai na
descrição.

Nunca no título: nome de coluna, tabela, migration, arquivo, rota, tool, nem
jargão (`enum`, `RLS`, `SECURITY DEFINER`, `p0`, `CHECK`).

| Não | Sim |
| --- | --- |
| MCP: buscar_cliente quebrada — clients.cnpj não existe, é tax_id | MCP: busca de cliente por CNPJ não funciona |
| Corrigir revalidacao.test.ts — a guarda está vermelha | Reativar a proteção contra a tela que reinicia sozinha |
| Ligar a faxina do OAuth no cron | MCP: limpar automaticamente os acessos expirados |

Teste rápido: se a pessoa não consegue dizer **por que aquilo importa** só lendo
o título, o título está técnico demais.

## Os campos, na criação

- **Nó e etiqueta.** Tarefa do próprio hub: etiqueta `ValkHub`, nó
  **Administrativo**. Tarefa de produto/cliente: etiqueta com o nome do projeto,
  no nó dele. **Sempre confirme o `node_id` com `listar_nos`** — nunca colha o
  uuid de uma tarefa antiga para adivinhar onde criar a próxima.
- **Responsável padrão: Felipe Alves.** Só use outro quando ficou combinado.
- **Prioridade** é `p1`, `p2` ou `p3`. **Não existe `p0`** — o banco recusa.
- **Prazo sempre.** Data absoluta, `AAAA-MM-DD`.
- **Descrição sempre, e completa de uma vez.** Toda escrita em `descricao`
  SUBSTITUI o que estava lá. Antes de reescrever, LEIA com `ver_tarefa` e mande
  o texto completo, não só a parte nova.
- **Para ler a descrição: `ver_tarefa`.** Conferido em 2026-09-09.
  Ela devolve a descrição inteira sem corte, mais `descricao_caracteres`, os
  comentários, o histórico e as dependências. `listar_tarefas` é que não
  devolve esse campo, e confundir as duas é o que fez esta linha dizer por
  semanas que "o MCP não lê a descrição de volta". Não lia por `listar_tarefas`;
  lê por `ver_tarefa`. Ela aceita os DOIS: `tarefa_id` com o uuid, ou `ref` com o
  número. Conferido em 2026-09-09, chamando com `ref` e recebendo a descrição
  inteira.
- **Plano com vários passos:** `criar_tarefas` (até 50 numa chamada), com
  `depende_de` citando o NÚMERO do item anterior do lote para declarar a ordem.

Caminho rápido, conferido em 2026-08-27 — se falhar, resolva pelo nome:

- Nó Administrativo: `e4ff17c2-a0ba-49cb-b323-925064c6b9c1`
- Felipe Alves: `2d3f0252-69ab-4505-8e93-14f18b713fee`

## As transições

Só `mover_tarefa` mexe em status — `criar_tarefa` nasce sempre em `todo`, não
aceita status.

- Começou: `mover_tarefa` com `status: "doing"` e `justificativa` dizendo por
  onde você vai começar.
- Entregou: `mover_tarefa` com `status: "done"`, `horas_gastas` e
  `justificativa` dizendo o que entrou e onde. A data de conclusão é do banco,
  não sua.

## Errou? Arquive ou mova. Nunca recrie

- **Nó errado:** `mover_tarefa` com `node_id` e `justificativa`. O escopo que
  contrata a tarefa é revalidado junto, e a justificativa vira comentário NA
  TAREFA.
- **Criada por engano:** `arquivar_tarefa` com `justificativa`. Sai das listas e
  das contagens sem ser apagada; volta com `desarquivar: true`.
- **Apagar não existe pelo MCP, de propósito** — apagar leva junto comentários,
  anexos e horas, e é ato de pessoa na tela.

## O que relatar ao usuário

Uma linha por transição, com o `ref` e o título curto:

    #387 aberta → doing — busca de cliente por CNPJ não funciona
    #387 → done (2,5h) — corrigido e no ar em <commit ou PR>

No commit, cite a tarefa: `Ref #387`. É o que liga o código ao histórico do hub.

## O andamento vai para a tarefa, não só para o chat

Quem quiser saber o que aconteceu vai abrir a tarefa, não reabrir a conversa.
Então o relato mora lá.

- **Mudou alguma coisa?** Mande `justificativa` junto no `mover_tarefa`. O hub
  escreve um comentário com **o que mudou e o porquê**, em uma frase por campo
  ("Situação: A fazer → Fazendo. Motivo: ..."). Vale para status, prazo,
  prioridade, horas, título, etiqueta e nó. Um comentário por chamada, mesmo
  quando muda várias coisas de uma vez.
- **Só quer deixar recado?** `comentar_tarefa`, com `tarefa_id` ou
  `tarefa_ids`. É para o andamento que não muda campo nenhum: onde você
  esbarrou, o que decidiu, em que commit entrou.
- **Não comente o óbvio.** "ok", "feito", "iniciando" não valem o espaço.
  Comentário é para quem for ler daqui a três meses.

