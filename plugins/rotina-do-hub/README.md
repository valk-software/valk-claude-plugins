# rotina-do-hub

Lembra toda sessão do Claude Code de registrar no Valk Hub o trabalho que vira
commit: tarefa em `doing` antes de editar, `done` com horas quando está no ar.

## Por que existe

Sessões na nuvem nascem sem o `CLAUDE.md` pessoal de ninguém. A rotina ficava só
no de um computador, então fora dele ninguém a recebia. Com o plugin, toda
sessão, local ou na nuvem, começa com ela como contexto.

## O que vem no pacote

| Peça | O que faz |
|---|---|
| `rotina.md` | O texto da rotina, cópia literal da fonte. |
| `hooks/hooks.json` | Um hook de SessionStart que só adiciona contexto, nunca bloqueia. |
| `scripts/session-start.js` | Lê `rotina.md`, tira o comentário de fonte e entrega o texto. |
| `tests/session-start.test.js` | Confere a saída do hook. |

Se `rotina.md` não puder ser lido, o hook não escreve nada e a sessão segue.

## De onde vem o texto e como atualizar

A fonte é `valk-hub/docs/rotina-do-agente-no-hub.md`. Para atualizar: edite lá,
copie para `rotina.md` e suba a `version` nos dois manifestos
(`.claude-plugin/plugin.json` e `.claude-plugin/marketplace.json`). Sem versão
nova, a atualização não chega.

## Conflito com configuração local

Quem já tem a rotina no `CLAUDE.md` pessoal pode tirá-la depois de instalar o
plugin. Deixar as duas faz o texto aparecer em dobro.

## Instalar

```
/plugin marketplace add valk-software/valk-claude-plugins
/plugin install rotina-do-hub@valk
```

Depois, `/reload-plugins` ou abra uma sessão nova.

## Testar

```
node --test "plugins/rotina-do-hub/tests/*.test.js"
```
