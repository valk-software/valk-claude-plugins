# nome-da-sessao

Dá a cada sessão do Claude Code o nome no padrão da VALK, para a lista de
sessões dizer de cara quem orquestra e quem foi aberta por quem.

| Sessão | Nome |
|---|---|
| A que uma pessoa abriu, que orquestra e delega | `[Principal] <assunto>` |
| A aberta por outra sessão | `[Secundária] <assunto> · de <nome da sessão pai>` |

## Como funciona

Um gancho roda quando a sessão começa (`scripts/session-start.js`). Ele faz
duas coisas:

1. **Entrega a regra como contexto**, para o Claude usar o padrão quando abrir
   outra sessão: `title` no `create_session`, ou `claude -n` no terminal.
2. **Dá o nome, quando consegue saber sozinho.** Isso depende de onde a sessão
   roda:

| Onde | Quem dá o nome |
|---|---|
| No computador, aberta por uma pessoa | O gancho: `[Principal] <pasta> · <dia e hora>` |
| No computador, aberta por outra sessão | O gancho: `[Secundária] ...`, com o pai lido de `VALK_SESSAO_PAI` |
| Com nome dado por `claude -n` | O gancho só põe o prefixo na frente |
| Na nuvem | O Claude, com `set_session_title`, depois de entender o primeiro pedido |

### Por que na nuvem é o Claude, e não o gancho

Uma sessão da nuvem criada por outra não herda variável nenhuma do pai, então o
gancho não tem como saber que ela é secundária. Quem sabe é a ferramenta
`get_session`, que devolve `parent_session_id`. E, no começo da sessão, ainda
não há pedido: quem sabe o assunto é o Claude, depois da primeira mensagem.

### Por que no computador o assunto é a pasta e a hora

O nome só pode ser dado pelo gancho no começo da sessão, antes de existir
pedido. Para ter um assunto melhor, abra com `claude -n "o assunto"`: o gancho
guarda o nome e só põe o prefixo. `/rename` muda depois, a qualquer hora.

## O que ele não faz

- **Não troca nome que já está no padrão**, nem ao retomar, limpar ou compactar.
- **Não nomeia os ajudantes de dentro de uma sessão** (os agentes chamados pela
  ferramenta Agent): eles não são sessões e não aparecem na lista.
- **Não bloqueia nada.** Se der erro, a sessão segue sem nome novo.

## Para abrir uma secundária no computador

    VALK_SESSAO_PAI="[Principal] Central de IA" claude -n "Radar de aplicações"

vira `[Secundária] Radar de aplicações · de Central de IA`.

## Testes

    node --test plugins/nome-da-sessao/tests/*.test.js
