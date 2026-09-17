---
description: Abre o Opensquad — cria e roda squads de agentes da VALK
---

Acione a skill `opensquad` e siga as instruções dela.

Argumentos recebidos: `$ARGUMENTS`

Se vierem vazios, mostre o menu principal. Se vierem com um subcomando
(`create`, `list`, `run <nome>`, `edit <nome>`, `skills`, `help`,
`show-company`), roteie conforme a tabela da skill.

Se a pessoa descreveu em linguagem natural o que quer, infira a intenção em vez
de cobrar o comando exato.
