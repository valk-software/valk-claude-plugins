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
>
> **De onde vem e para onde vai cada coisa está em
> `${CLAUDE_PLUGIN_ROOT}/reference/onde-as-coisas-moram.md`.** Esse é o único
> arquivo que nomeia lugar; os outros apontam para ele. Se você precisar dizer
> onde algo fica, leia de lá em vez de inventar um caminho.

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

Se a descoberta pedir investigação de perfis de referência, ela acontece **no
navegador da sua sessão**, com a sessão logada de quem está rodando. Não é
ferramenta do conector.

Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/sherlock-shared.md` mais o extrator
da plataforma (`sherlock-instagram.md`, `sherlock-youtube.md`,
`sherlock-twitter.md`, `sherlock-linkedin.md`).

**A ordem é obrigatória: Claude in Chrome primeiro, Playwright se ele não
estiver.** O Chrome da pessoa já está logado, então não há sessão para guardar
nem expirar; o Playwright abre um navegador limpo e exige login, com credencial
em disco e aviso antes.

**Por que navegador e não raspagem por API:** só o navegador logado alcança
perfil privado, e só ele lê o texto de um slide de carrossel **como texto
renderizado** em vez de adivinhá-lo de uma imagem. Um coletor por API entrega
menos e cobra por item. Isto já foi construído e desfeito em 17/09/2026 — não
reconstrua.

**Três regras, porque você está no navegador de uma pessoa:**

- Investigação é **leitura**. Não curta, não siga, não comente, não mande
  mensagem. Qualquer coisa que deixe rastro na conta dela precisa de autorização
  explícita, na conversa.
- **Diga antes** que vai abrir uma aba e em qual perfil vai entrar.
- Não resolva CAPTCHA nem dispare caixa de diálogo do navegador — a segunda
  trava a extensão até alguém fechar à mão.

**O resultado vai para o hub**, por `escrever_documento`, como todo artefato. O
navegador é o olho; o arquivo é da casa.

> **Sem navegador nenhum na sessão, a investigação NÃO acontece.** Diga isso e
> pare. Não reconstrua o perfil por busca na web nem por memória: um perfil
> analisado pela metade, sem aviso, vira referência errada dentro de um squad que
> muita gente vai rodar. Declarar a falta é desfecho legítimo.

### Fase 3: Desenho

Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/design.prompt.md`. As
best-practices por formato estão em
`${CLAUDE_PLUGIN_ROOT}/reference/best-practices/`, com o índice em
`_catalog.yaml`.

**No fim desta fase o squad já nasce, como RASCUNHO**, com `publicar_squad` sem
`publicar: true`. É o que permite retomar uma criação interrompida de qualquer
máquina — antes o desenho ficava num arquivo na pasta de quem estava criando, e
trocar de computador perdia o trabalho.

### Fase 4: Construção

Leia `${CLAUDE_PLUGIN_ROOT}/reference/prompts/build.prompt.md`.

Ela lê o rascunho com `ver_squad`, preenche os corpos dos agentes e dos passos,
e chama `publicar_squad` de novo no mesmo código. **Nenhum arquivo é escrito em
pasta.**

Publique para a organização só depois de rodar uma vez e ver que presta.
Publicar um squad que nunca rodou é empurrar para todo mundo um trabalho que
ninguém conferiu.

### Retomar uma criação

`listar_squads` com `incluir_rascunhos: true`. Rascunho é exatamente o estado
"comecei e não terminei", e ele está no hub, não na máquina.

## Rodar um squad

1. `contexto_da_empresa` — sempre, antes de tudo.
2. `ver_squad` com o código: traz a definição inteira e as execuções recentes.
3. `listar_documentos` pelas etiquetas de conhecimento que o squad usa, e
   `ler_documento` no que interessar.
4. `registrar_execucao` **sem** `execucao_id` e **com** o código do squad. Guarde
   o id.
5. Leia as instruções do executor em
   `${CLAUDE_PLUGIN_ROOT}/reference/runner.pipeline.md`.
6. Execute passo a passo. **Cada passo avisa quando começa e quando termina:**
   `marcar_passo` com `comecou` antes do trabalho do passo, e com `terminou` (ou
   `erro`) quando ele acaba. No checkpoint, `aguardando_aprovacao` antes de
   perguntar à pessoa, e `terminou` depois da resposta. É o que faz o passo
   aparecer ao vivo no hub: o documento é gravado em rajada, e o horário dele
   não diz quando o passo aconteceu. A hora e o agente quem decide é o hub.
   **E cada passo grava o que saiu:**
   - texto → `escrever_documento`, com `execucao_id` e `passo`
   - peça pronta, PDF, export → `gravar_arquivo_da_execucao`, com os mesmos dois
   - **criar** uma imagem → `gerar_imagem`. Ela gera e **já grava no passo**, então
     não chame `gravar_arquivo` depois. A chave é do hub, e o gasto entra no
     painel de IA
   - um passo voltou atrás → `corrigir_documento`, **nunca** um documento novo
     sobre a mesma coisa
7. Se o squad **publica**: `ver_conta_do_instagram` antes de montar a peça, e
   `publicar_no_instagram` no fim. Ver abaixo — publicar é diferente de tudo.
8. `registrar_execucao` **com** o `execucao_id`, no fim, com tokens, custo e o
   que sobrou.

### Publicar é o único ato que não volta

`publicar_no_instagram` **sem `confirmar: true` devolve o preview e não publica
nada.** Mostre esse preview a uma pessoa. Só chame de novo com `confirmar`
depois de ela aprovar.

Se não houver ninguém para aprovar, **pare ali** e grave que a publicação não
aconteceu, com o motivo. Isso é desfecho legítimo, não falha — e é exatamente o
que a prova de 16/09/2026 fez no passo 11.

O primeiro id da lista é a **capa**: a ordem que você mandar é a ordem dos
slides.

### Gerar imagem custa dinheiro de verdade

Antes de gerar, confira se já não existe uma peça que sirva. Um carrossel de
sete imagens custa o mesmo que uma conferência de contrato inteira, e "deixa eu
gerar umas variações para testar" é como uma conta de centavos vira uma conta de
dezenas de reais.

### O passo é inteiro, e checkpoint também é passo

`passo` é número, porque a tela ordena por ele. E **checkpoint humano é passo
como qualquer outro**: se uma pessoa aprovou ou recusou alguma coisa no meio,
grave isso — quem aprovou, quando, e o que foi recusado no caminho. É a
informação que mais importa reconstituir depois, e era a única que o desenho
antigo deixava sumir.

## Analisar um vídeo de referência

Quando alguém manda um link de Reel / TikTok / Short e quer saber **por que
aquilo funcionou** — paleta, ritmo de corte, tipografia, timing do gancho —, não
adianta ler a legenda. Isso só sai olhando os frames.

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/ref-analyzer/ref_analyzer.py <url> --frames 16
```

Ele baixa o vídeo e monta um pacote em `./ref-analyzer/<slug>/` com frames,
metadados e legenda. Você lê o `README.md` do pacote **mais os frames** e
escreve o cartão.

**O cartão vai para o documento "Receitas visuais de vídeo" no hub, e ele é
ACUMULADO** — leia o documento inteiro e devolva o texto todo mais o cartão
novo. Detalhes em `${CLAUDE_PLUGIN_ROOT}/scripts/ref-analyzer/README.md`.

> É a única peça do Opensquad que pede Python na máquina. Se não tiver, diga
> isso em vez de tentar descrever o vídeo pelo título — um cartão inventado
> contamina todo run que ler o banco depois.

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

FERRAMENTAS
  ref-analyzer                manda um link de vídeo e eu destilo a receita
                              visual (paleta, corte, tipografia, gancho)
  investigação de perfil      no NAVEGADOR da sessão, logado. Chrome
                              primeiro, Playwright de reserva
  gerar_imagem                cria imagem e já grava no passo
  publicar_no_instagram       publica carrossel. Pede confirmação

ONDE AS COISAS MORAM
  O motor está neste pacote. Os squads e o que eles produzem estão no
  Valk Hub — nada fica na sua pasta, e nada depende da sua máquina.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Idioma

Tudo que a pessoa lê sai em português do Brasil. Nome de arquivo e código
seguem em inglês.
