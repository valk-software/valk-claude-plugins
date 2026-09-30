---
name: fluxo-de-codificacao
description: Regras de como conduzir qualquer tarefa de codificação com os subagentes do plugin fluxo-codificacao e o advisor. Use sempre que a tarefa envolver ler, mudar, corrigir, testar ou revisar código, em qualquer repositório, mesmo que o pedido não cite agentes nem o fluxo.
---

# Fluxo de codificação

## Quem faz o quê

A sessão principal roda em Opus 5.5 com esforço high. Ela planeja, delega,
revisa e verifica. Não faz o trabalho braçal quando um subagente resolve.

Os subagentes rodam em Sonnet 5.5 com esforço medium e devolvem um resumo curto:

- `fluxo-codificacao:explorer` mapeia código e responde onde as coisas estão.
  Só leitura.
- `fluxo-codificacao:worker` aplica as edições e roda os testes que as comprovam.
- `fluxo-codificacao:researcher` confere documentação externa de biblioteca e de
  API. Só leitura.

Chame pelo nome com escopo, como está acima. Prefira os três ao Explore
embutido. O Explore só entra quando nenhum dos três serve.

Tarefas independentes vão em paralelo, numa mesma mensagem.

## Revise tudo o que volta

Delegar não transfere a responsabilidade. O resumo do subagente é material
bruto, não resultado verificado.

Antes de seguir, confira as afirmações em que você vai se apoiar: leia o arquivo
citado, rode o teste, abra a fonte. Se o resumo respondeu a uma versão mais
fácil da pergunta, ou deixou lacuna, diga o que ficou em aberto em vez de
completar por dedução.

## Os três momentos do Fable

O consultor é o Fable, ligado com `/advisor fable`. Chame nestes três momentos:

1. Antes de escolher o plano, enquanto trocar de abordagem ainda é barato.
2. Quando o mesmo erro se repetir. Insistir sozinho costuma custar mais que uma
   segunda opinião.
3. Antes de dar a tarefa por concluída.

## Se o advisor não estiver ativo

Se a ferramenta advisor não estiver disponível na sessão, faça a consulta por
subagente: chame `fluxo-codificacao:explorer` com `model: fable`. Ele continua
só de leitura. Passe no prompt o objetivo, o plano ou o erro, e os arquivos que
importam, porque ele não vê a conversa. Peça uma opinião curta e objetiva.

Avise o usuário que o advisor estava desligado e que a consulta foi por
subagente.
