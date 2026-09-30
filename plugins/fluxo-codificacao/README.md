# fluxo-codificacao

O jeito VALK de programar com agentes, em qualquer máquina.

A sessão principal roda em Opus 5.5 com esforço high: planeja, delega, revisa e
verifica. O trabalho braçal vai para três subagentes em Sonnet 5.5 com esforço
medium, que devolvem um resumo curto. O Fable entra como advisor antes do plano,
no erro repetido e antes de concluir.

## O que vem no pacote

| Peça | O que faz |
|---|---|
| `agents/explorer.md` | Mapeia código. Só leitura: Read, Grep, Glob. |
| `agents/worker.md` | Edita e roda os testes: Read, Edit, Write, Bash, Grep, Glob. |
| `agents/researcher.md` | Confere documentação externa: WebSearch, WebFetch, Read, Grep, Glob. |
| `skills/fluxo-de-codificacao` | As regras do fluxo. Entra em qualquer tarefa de código. |
| `hooks/hooks.json` | Dois lembretes que só adicionam contexto, nunca bloqueiam. |

Os agentes aparecem com o nome do plugin na frente:
`fluxo-codificacao:explorer`, `fluxo-codificacao:worker` e
`fluxo-codificacao:researcher`.

Os hooks:

- **SessionStart** lembra a sessão de seguir a skill. Se a entrada do hook
  trouxer o modelo e ele não for Opus 5.5, pede para avisar você na primeira
  resposta. O campo `model` pode faltar (não veio em `claude -p` no teste de
  2026-09-30), e aí não há aviso.
- **PostToolUse no Agent** lembra a sessão principal de revisar o que um dos três
  agentes devolveu. Só dispara quando o agente voltou em primeiro plano.

### Por que o lembrete não fica no SubagentStop

Testado em 2026-09-30, Claude Code 2.1.285: o contexto que um hook de
SubagentStop adiciona vai para o **próprio subagente**, que volta a rodar e para
de novo. Uma delegação ao explorer gerou 9 disparos, o lembrete 18 vezes na
transcrição do subagente e nenhuma na sessão principal.

Limite do desenho atual: agente lançado em segundo plano não ganha lembrete na
volta, porque não existe hook para a notificação de término. Nesse caso vale a
regra escrita na skill.

## O que o plugin não configura sozinho

**Modelo e esforço da sessão principal.** Plugin não define isso: o
`settings.json` de um plugin só aproveita `agent` e `subagentStatusLine`, e
descarta o resto. Em cada máquina, ponha no `~/.claude/settings.json`:

```json
{
  "model": "claude-opus-5-5",
  "effortLevel": "high",
  "modelSettings": {
    "claude-opus-5-5": { "effortLevel": "high" }
  },
  "advisorModel": "fable"
}
```

O esforço do Opus 5.5 vai dentro de `modelSettings`. No settings do usuário, o
`effortLevel` de topo não vale para o Opus 5.5, que começa em medium quando não
há ajuste por modelo. O de topo fica para os outros modelos.

Na sessão, o mesmo efeito sai de `/model claude-opus-5-5`, `/effort high` e
`/advisor fable`.

**O Fable como advisor.** Em alguns planos o Fable cobra em créditos de uso e
pede um consentimento único. Enquanto ele não existir, `/advisor fable` não
salva nada, e um `advisorModel: "fable"` já salvo fica sem efeito: a sessão
roda sem advisor e mostra um aviso apontando para `/model fable`. Para dar o
consentimento, rode `/model fable`, aceite, e volte com
`/model claude-opus-5-5`. Os subagentes herdam o advisor da sessão.

Se o advisor não estiver ativo, a skill manda consultar o Fable por subagente:
`fluxo-codificacao:explorer` com `model: fable`, que continua só de leitura.

**Node.** Os hooks rodam com `node`. Sem ele no PATH, os lembretes não aparecem,
e o resto do plugin segue funcionando.

## Conflito com configuração local

Se a máquina já tem `explorer`, `worker` ou `researcher` em `~/.claude/agents/`,
hooks de lembrete equivalentes no `settings.json` ou uma seção "Fluxo de
codificação" no `CLAUDE.md`, tudo roda em dobro. Tire a versão local depois de
instalar o plugin.

## Instalar

```
/plugin marketplace add valk-software/valk-claude-plugins
/plugin install fluxo-codificacao@valk
```

Depois, `/reload-plugins` ou abra uma sessão nova.

## Testar

1. Abra uma sessão num repositório qualquer.
2. Peça uma tarefa pequena que precise de leitura, por exemplo "onde está
   definida a função X?".
3. Em `/tasks`, confira que o subagente é `fluxo-codificacao:explorer`, em
   `claude-sonnet-5-5` com esforço medium.
4. Quando ele voltar, o lembrete de revisar aparece como contexto da sessão
   principal.
