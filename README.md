# valk-claude-plugins

As ferramentas internas da VALK distribuídas para a organização no Claude.

## O que tem aqui

| Plugin | O que é |
|---|---|
| [`opensquad`](plugins/opensquad) | O motor de squads de agentes: cria e roda squads de conteúdo, pesquisa e operação. |

## A decisão que organiza este repositório

**O motor vive aqui. Os squads vivem no Valk Hub.**

O motor — o comando, as instruções de fase, os agentes, as best-practices — muda
uma vez por mês. Um squad muda toda semana. Amarrar os dois no mesmo ciclo de
release faz o rápido andar na velocidade do lento: cada ajuste de pauta viraria
PR, revisão, versão e sincronização, e a sincronização leva até 30 minutos.

Então o squad deixou de ser arquivo. Ele é dado publicado no hub, disponível na
hora para todo mundo, e este pacote só sabe como executá-lo. É o mesmo modelo
de molde e instância que o hub já usa para Solução de portfólio.

**Consequência prática:** você não vai achar pasta de squad neste repositório, e
isso não é falta — é o desenho.

## Como instalar

Enquanto a distribuição por organização não estiver ligada:

```
/plugin marketplace add valk-software/valk-claude-plugins
/plugin install opensquad@valk
```

Depois de ligada em *Organization settings > Plugins*, ele chega sozinho em
quem é da VALK.

## O conector

O plugin traz configurado o conector **valk-hub-squads**, apontando para a porta
enxuta do Valk Hub:

```
https://hub.valkbr.com/api/mcp/squads
```

São 14 ferramentas, contra as 70 da porta completa. A lista é curta de
propósito: para um fluxo de agentes, ferramenta que nunca vai ser chamada é
contexto gasto e escolha demais na frente do modelo.

Na primeira vez ele pede autorização. Sem ele, o motor não roda — e diz isso em
vez de tentar adivinhar.

## Por que não tem `bin/`

A distribuição por organização **recusa** um pacote com pasta de executáveis no
topo. O que houver de script mora em `scripts/`, referenciado por
`${CLAUDE_PLUGIN_ROOT}`. Isso está aqui escrito porque é o tipo de restrição que
custa retrabalho quando é descoberta no fim.
