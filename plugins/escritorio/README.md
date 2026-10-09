# escritorio

Mostra no escritório do Valk Hub o que o Claude Code do seu computador está
fazendo, numa sala própria ("Ao vivo / Código"). Todo mundo que entra no
escritório vê as sessões de todo mundo. O escritório só mostra: não aprova
permissão nem manda comando para a máquina de ninguém.

## Como instalar

O plugin vem ligado para todo o time da VALK pela sincronização da organização, mas
fica quieto até ganhar uma chave. Para começar a aparecer no escritório, rode `/plugin`,
abra **Instalados** → **Escritório dos agentes** → **Configurar opções**, preencha a
**Chave do escritório**, feche o Claude Code e abra de novo. Pela linha de comando, use o id
que `claude plugin list` mostra (`escritorio@synced` quando veio da organização,
`escritorio@valk` quando foi instalado na mão):
`echo '{"chave":"valk_coletor_..."}' | claude plugin configure escritorio@synced --values-stdin`.
Fora da organização, instale na mão:

```
/plugin marketplace add valk-software/valk-claude-plugins
/plugin install escritorio@valk
```

Na instalação manual, o Claude Code pede a **Chave do escritório** na hora. Gere uma no Valk Hub, em
**Configurações › Meu Claude Code**, e cole. Ela aparece uma única vez; tem o
formato `valk_coletor_...`, é de um computador só e vence com 30 dias sem uso.
O campo "Endereço do Valk Hub" já vem com `https://hub.valkbr.com`.

Sem chave, o plugin não faz nada: não lê nada, não grava nada, não abre conexão.

## O que é enviado

Um aviso curto a cada acontecimento da sessão:

| Quando | O que vai |
| --- | --- |
| A sessão começa | o id da sessão, o nome do repositório e o modelo |
| Você manda um pedido | só "Recebeu um pedido" |
| O Claude usa uma ferramenta | um rótulo limpo, como "Lendo estado.ts", "Rodando os testes", "Git: commit" |
| O Claude precisa de você (permissão, pergunta, ou sessão em segundo plano esperando resposta) | só "Precisa de você" (ou "Fazendo uma pergunta", quando é uma pergunta direta) |
| A ferramenta que esperava você termina | só o aviso de que a sessão voltou a trabalhar, sem rótulo |
| O Claude termina a vez | só "Terminou a vez" |
| Um subagente começa ou termina | o id e o tipo dele (por exemplo `Explore`) |
| Um squad abre uma execução | o id da execução, para o escritório não desenhar a mesma pessoa duas vezes |
| A sessão termina | o aviso de fim |

Todo aviso leva também a hora em que aconteceu.

Os rótulos são montados no seu computador, antes de enviar:

| Ferramenta | Rótulo |
| --- | --- |
| Read, Edit/MultiEdit, Write | "Lendo / Editando / Escrevendo" + **só o nome do arquivo** |
| Grep, Glob | "Procurando no código" |
| Bash, PowerShell | pelo primeiro programa: "Rodando os testes", "Git: <subcomando>", "Rodando o build", "Rodando o lint", "Checando os tipos", "Instalando dependências" ou "Rodando um comando" |
| WebFetch | "Lendo" + **só o domínio** |
| WebSearch | "Pesquisando na web" |
| Agent/Task | "Chamando" + tipo do subagente |
| Skill | "Usando a skill" + nome |
| ferramentas MCP | "servidor: ferramenta" |
| TodoWrite, TaskCreate, TaskUpdate | "Organizando as tarefas" |
| AskUserQuestion | "Fazendo uma pergunta" (e a sessão aparece como precisando de você) |
| o resto | "Usando" + nome da ferramenta |

## O que nunca é enviado

- o texto dos seus pedidos;
- o comando inteiro, os argumentos e o que ele imprimiu;
- caminhos completos (só o nome do arquivo);
- o conteúdo de arquivos, o que foi editado ou escrito;
- consultas de busca e URLs completas (só o domínio);
- a entrada e a saída de qualquer ferramenta;
- tokens e custo.

Se o hub estiver fora do ar ou recusar o aviso, o plugin segue calado: nunca
bloqueia nem atrasa o Claude Code. Nos erros, ele guarda uma linha (sem a chave)
em `coletor.log` na pasta de dados do plugin, limitada a cerca de 200 KB.

## Como desligar

- Desligar só o envio: `/plugin` e desative o `escritorio`, ou apague a chave nas
  opções do plugin.
- Cortar o acesso de vez: revogue a chave em **Configurações › Meu Claude Code**
  no hub.
- Remover: `/plugin uninstall escritorio@valk`.

## Para quem mexe no plugin

```
node --test "plugins/escritorio/tests/*.test.js"
claude plugin validate plugins/escritorio
```

Sem dependências; precisa de Node 18 ou mais novo. O coletor está em
`scripts/coletor.js`; os hooks, em `hooks/hooks.json`, todos assíncronos, menos o
`SessionEnd`, que espera no máximo 2 segundos.
