"""Configuração que a biblioteca original (instagram/fetch.py) importa como
`config`. Versão da VALK: sem servidor, sem porta e SEM proxy próprio.

O original aceitava INSTAGRAM_PROXY e uma saída residencial de reserva para
quando o Instagram recusasse a conexão. Isso é rodar em volta do bloqueio, e
a VALK não faz: quando o Instagram bloqueia, a ferramenta para e diz. A rede
usada é a da máquina (ou a da rotina na nuvem), como qualquer programa.
"""

MAX_RETRIES = 2            # uma tentativa e, em falha passageira, mais uma
RETRY_BACKOFF = 2          # segundos, vezes o número da tentativa

INSTAGRAM_FALLBACK_PROXY_COUNTRY = None
INSTAGRAM_DIRECT_COOLDOWN = 0


def instagram_proxy():
    return None


def instagram_fallback_proxy():
    return None
