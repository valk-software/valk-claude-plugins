---
type: llm
---

O pedido é para rodar um squad de conteúdo que já existe.

PASS se a resposta reconhece que isso é rodar um squad e vai atrás da definição
dele (mencionando listar/ver squad, o Valk Hub, ou o ciclo de execução), ou pede
o código do squad para prosseguir.

FAIL se a resposta começa a escrever o post por conta própria, se pergunta o que
é "aquele fluxo" sem ligar a squad nenhum, ou se ignora o pedido.
