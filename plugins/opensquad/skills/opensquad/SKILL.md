---
name: opensquad
description: "Opensquad — o motor de squads de agentes da VALK. Cria e roda squads de conteúdo, pesquisa e operação. Use quando pedirem para criar um squad, rodar um squad, listar squads, ou quando alguém descrever um trabalho repetitivo que várias pessoas-agente fariam em sequência."
---

# Opensquad — o motor

Você está operando o Opensquad. Seu papel é ajudar a criar e rodar squads de
agentes da VALK.

> **O que mudou na versão 2.** O motor virou pacote e as DEFINIÇÕES dos squads
> saíram do disco: elas vivem no Valk Hub, publicadas. Motor muda uma vez por
> mês, squad muda toda semana — amarrar os dois no mesmo ciclo de release fazia
> o rápido andar na velocidade do lento.
>
> Na prática: você não procura squad em pasta nenhuma. Você chama
> `listar_squads` e `ver_squad`, do conector `valk-hub-squads`, que este pacote
> já traz configurado.

## Antes de qualquer coisa: o conector

Tudo que este motor faz depende do conector **valk-hub-squads**
(`https://hub.valkbr.com/api/mcp/squads`). Ele vem no pacote e pede autorização
na primeira vez.

**Se as ferramentas do hub não estiverem na sessão, PARE e diga isso.** Não
tente adivinhar o que um squad faz, não leia pasta local procurando squad, e
não invente contexto de empresa. Um squad rodado sem o hub produz trabalho que
morre na máquina de quem rodou, que é exatamente o que este desenho existe para
acabar.

## Início

Ao ser acionado:

1. Chame `guia_dos_squads` se você não souber por onde começar. Ele traz a ordem
   do ciclo, que os nomes das ferramentas não carregam.
2. Chame `contexto_da_empresa` **antes de produzir qualquer coisa**. Peça escrita
   sem isso inventa tom, público e produto, e o erro só aparece na peça pronta.
3. Mostre o MENU PRINCIPAL.

## Menu principal

Quando a pessoa digita `/opensquad` ou pede o menu, use AskUserQuestion:

- **Rodar um squad** — executa o pipeline de um squad publicado
- **Criar um squad** — descreva o que precisa e eu construo
- **Meus squads** — ver, editar ou despublicar
- **Mais opções** — skills, perfil da empresa, ajuda

## Roteamento de comandos

| Entrada | Ação |
|---------|------|
| `/opensquad` ou `/opensquad menu` | Menu principal |
| `/opensquad help` | Texto de ajuda |
| `/opensquad create <descrição>` | Criar squad — orquestração por fases |
| `/opensquad list` | `listar_squads` |
| `/opensquad run <nome>` | `ver_squad` → executar o pipeline |
| `/opensquad edit <nome> <mudanças>` | Arquiteto → editar → `publicar_squad` |
| `/opensquad skills` | Motor de skills |
| `/opensquad show-company` | `contexto_da_empresa` |
| Linguagem natural sobre squads | Inferir a intenção e rotear |

## Criar squad — orquestração por fases

### Fase 1: Descoberta

1. **Guarda de colisão:** chame `listar_squads` e passe os códigos existentes
   para o subagente de descoberta. Isto é obrigatório — squad com código repetido
   é o erro que ninguém percebe até dois rodarem diferente com o mesmo nome.
2. Despache o subagente de Descoberta:
   - Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/discovery.prompt.md`
   - Forneça o contexto da empresa (de `contexto_da_empresa`) e os códigos em uso
   - Siga o prompt: assistente inteligente, uma pergunta por vez

### Fase 2: Investigação (opcional)

Se a descoberta pedir investigação de perfis de referência, leia
`${CLAUDE_PLUGIN_ROOT}/reference/prompts/sherlock-shared.md` mais o extrator da
plataforma (`sherlock-instagram.md`, `sherlock-youtube.md`, `sherlock-twitter.md`,
`sherlock-linkedin.md`).

> **Modo degradado, dito em voz alta.** A investigação original rodava um
> navegador com sessão logada na máquina de quem executava, e isso não atravessa
> para um pacote distribuído. Enquanto a tarefa #951 não entregar o substituto,
> a investigação cobre o que é público e **diz o que não conseguiu ver**, em vez
> de entregar um retrato parcial como se fosse inteiro.

### Fase 3: Desenho

Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/design.prompt.md`. As
best-practices por formato estão em
`${CLAUDE_PLUGIN_ROOT}/reference/best-practices/`, com o índice em
`_catalog.yaml`.

### Fase 4: Construção

Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/build.prompt.md`.

**O resultado NÃO é arquivo em pasta.** O squad construído vira uma chamada de
`publicar_squad`, com o código, o nome, a descrição e a definição. Sem
`publicar: true` ele nasce rascunho, e rascunho só quem escreveu enxerga — é
assim que se testa um squad sem empurrá-lo para a organização inteira.

## Rodar um squad

1. `contexto_da_empresa` — sempre, antes de tudo.
2. `ver_squad` com o código: traz a definição inteira e as execuções recentes.
3. `listar_documentos` pelas etiquetas de conhecimento que o squad usa, e
   `ler_documento` no que interessar.
4. `registrar_execucao` **sem** `execucao_id` e **com** o código do squad. Guarde
   o id.
5. Leia as instruções do executor em
   `${CLAUDE_PLUGIN_ROOT}/reference/runner.pipeline.md`.
6. Execute passo a passo. **Cada passo grava o que saiu:**
   - texto → `escrever_documento`, com `execucao_id` e `passo`
   - imagem, peça pronta, PDF → `gravar_arquivo_da_execucao`, com os mesmos dois
   - um passo voltou atrás → `corrigir_documento`, **nunca** um documento novo
     sobre a mesma coisa
7. `registrar_execucao` **com** o `execucao_id`, no fim, com tokens, custo e o
   que sobrou.

### O passo é inteiro, e checkpoint também é passo

`passo` é número, porque a tela ordena por ele. E **checkpoint humano é passo
como qualquer outro**: se uma pessoa aprovou ou recusou alguma coisa no meio,
grave isso — quem aprovou, quando, e o que foi recusado no caminho. É a
informação que mais importa reconstituir depois, e era a única que o desenho
antigo deixava sumir.

## Regras críticas

- **Nunca pule um checkpoint.** Ação irreversível e para fora — publicar,
  mandar mensagem, gastar dinheiro — só depois de uma PESSOA aprovar. Sem humano
  na mesa, o run para ali, e isso é desfecho legítimo, não falha.
- **AskUserQuestion precisa de 2 a 4 opções.** Lista dinâmica com 1 item ganha um
  "Cancelar"; com 0 itens, não use AskUserQuestion — diga direto.
- **Sempre carregue o contexto da empresa antes de produzir.**
- **Nunca invente número.** Estatística em peça pública sai com fonte,
  reconfirmada antes de publicar, e o sujeito do número tem que estar certo.
- Ao trocar de persona, diga qual agente está falando.
- O custo que você declara é ESTIMATIVA, e fica marcado como tal. Declarar número
  que você não calculou é pior do que não declarar nenhum.

## Ajuda

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Opensquad — ajuda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQUADS
  /opensquad                  menu
  /opensquad list             os squads publicados no hub
  /opensquad run <nome>       roda o pipeline de um squad
  /opensquad create           cria um squad novo
  /opensquad edit <nome>      muda um squad que existe

EMPRESA
  /opensquad show-company     o perfil da VALK que todo squad carrega

ONDE AS COISAS MORAM
  O motor está neste pacote. Os squads e o que eles produzem estão no
  Valk Hub — nada fica na sua pasta, e nada depende da sua máquina.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Idioma

Tudo que a pessoa lê sai em português do Brasil. Nome de arquivo e código
seguem em inglês.
