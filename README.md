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

Depois de ligada, ele chega sozinho em quem é da VALK.

## Como ligar a distribuição para a organização

Ato de tela, feito uma vez, por quem é **Owner** da organização no Claude.

1. Abrir **Organization settings > Plugins**.
2. Apontar para este repositório: `valk-software/valk-claude-plugins`.
3. Deixar o `opensquad` como **instalado por padrão**, e **não** como
   obrigatório.
4. Esperar a sincronização. Ela dispara quando uma versão nova entra na `main` e
   leva **até 30 minutos** para chegar em todo mundo.

### Por que instalado por padrão e não obrigatório

Obrigatório tira da pessoa a saída quando alguma coisa quebra. Um pacote que
chega ligado e pode ser desligado é um pacote que alguém consegue contornar às
oito da noite de uma sexta; um obrigatório é um chamado para o Owner. Depois de
algumas semanas rodando sem susto, a conversa pode ser outra.

### O que este repositório já garante

A distribuição por organização impõe restrições que custam retrabalho quando
descobertas no fim. As três estão atendidas, e ficam escritas aqui para
continuarem atendidas:

| Exigência | Como está aqui |
|---|---|
| Plugin privado usa caminho **relativo** dentro do repositório do marketplace | `"source": "./plugins/opensquad"` |
| Pacote **não** pode ter pasta de executáveis no topo | não existe `bin/`; o que houver de script vai para `scripts/` |
| Atualização só chega quando a **versão muda** | `version` declarada nos dois manifestos, e `claude plugin tag` recusa publicar se eles discordarem |

### O conector vem junto

Não é preciso distribuir o conector do hub separadamente nem pedir para ninguém
conectar à mão: o plugin carrega o próprio `.mcp.json` apontando para a porta
enxuta. Instalou o plugin, tem o conector — ele pede autorização na primeira vez
e pronto.

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
