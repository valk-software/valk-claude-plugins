"""Pesquisa de pauta e de referência no Instagram, para os squads da VALK.

Uma consulta por chamada, resposta em JSON na saída padrão:

    python pesquisa_instagram.py perfil viverdeia.ai
    python pesquisa_instagram.py reels @gestaoai
    python pesquisa_instagram.py hashtag inteligenciaartificial
    python pesquisa_instagram.py musica 442245453190058
    python pesquisa_instagram.py lote consultas.json

Lê o Instagram pelo lado de quem NÃO entrou na conta, com a biblioteca da
omkarcloud (instagram/, licença MIT em LICENSE). Nunca usa login, senha,
cookie de conta nem token da Meta. Detalhes, riscos e regras no README.md.
"""
import argparse
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import controle  # noqa: E402

PASTA_CACHE_PADRAO = os.path.join(os.getcwd(), "pesquisa-instagram-cache")

# comando -> (o que o alvo é, aceita cursor)
COMANDOS = {
    "perfil": ("usuario", False),
    "posts": ("usuario", True),
    "reels": ("usuario", True),
    "parecidas": ("usuario", False),
    "post": ("post", False),
    "comentarios": ("post", True),
    "hashtag": ("hashtag", True),
    "palavra-chave": ("texto", True),
    "musica": ("musica", False),
    "musica-reels": ("musica", True),
    "em-alta": (None, False),
    "em-alta-secao": ("secao", True),
}


# ---- o encaixe com a biblioteca original ----------------------------------------------
# Feito por fora, sem editar o código da omkarcloud: cada sessão HTTP que ela
# abre passa pelo teto e pela pausa, e a última resposta fica guardada para o
# erro poder mostrá-la.

class Encaixe:
    def __init__(self, teto):
        self.teto = teto
        self.ultima_resposta = None
        self._ligado = False

    def _chamar(self, metodo, url, *args, **kwargs):
        onde = str(url).split("?")[0]
        self.teto.antes_de_chamar(onde)
        resp = metodo(url, *args, **kwargs)
        texto = getattr(resp, "text", "") or ""
        self.ultima_resposta = {
            "onde": onde,
            "status": getattr(resp, "status_code", None),
            "trecho": texto[:400],
        }
        return resp

    def ligar(self):
        if self._ligado:
            return
        from instagram import fetch

        original = fetch._new_session
        encaixe = self

        def nova_sessao(proxy=None):
            # proxy é sempre None: ver config.py
            sess = original(None)
            get, post = sess.get, sess.post
            sess.get = lambda url, *a, **k: encaixe._chamar(get, url, *a, **k)
            sess.post = lambda url, *a, **k: encaixe._chamar(post, url, *a, **k)
            return sess

        def tentando(fn, no_retry=()):
            # Bloqueio e muro de login não se repetem: a VALK para e diz.
            terminais = tuple(no_retry) + (fetch.InstagramBlocked, fetch.InstagramGated, controle.TetoAtingido)
            ultima = None
            for tentativa in range(1, fetch.config.MAX_RETRIES + 1):
                try:
                    return fn()
                except terminais:
                    raise
                except fetch.InstagramUpstreamError as e:
                    ultima = e
                    fetch._drop_session()
                if tentativa < fetch.config.MAX_RETRIES:
                    time.sleep(fetch.config.RETRY_BACKOFF * tentativa)
            raise ultima

        fetch._new_session = nova_sessao
        fetch._retrying = tentando
        fetch.FANOUT_WORKERS = 1          # uma requisição por vez, para a pausa valer
        self._ligado = True


def executar_consulta(comando, alvo, cursor=None):
    """Chama a função da biblioteca original que responde ao comando."""
    from instagram import refs
    from instagram.discovery import (audio_details, audio_reels, explore_section, explore_trending,
                                     hashtag_posts, search_keyword)
    from instagram.posts import get_comments, get_details
    from instagram.users import get_posts, get_profile, get_reels, get_similar

    if comando == "perfil":
        return get_profile(refs.resolve_user(alvo))
    if comando == "posts":
        return get_posts(refs.resolve_user(alvo), cursor=cursor)
    if comando == "reels":
        return get_reels(refs.resolve_user(alvo), cursor=cursor)
    if comando == "parecidas":
        return get_similar(refs.resolve_user(alvo))
    if comando == "post":
        return get_details(refs.resolve_post(alvo))
    if comando == "comentarios":
        return get_comments(refs.resolve_post(alvo), cursor=cursor)
    if comando == "hashtag":
        return hashtag_posts(refs.resolve_tag(alvo), cursor=cursor)
    if comando == "palavra-chave":
        return search_keyword(" ".join(alvo.split()), cursor=cursor)
    if comando == "musica":
        return audio_details(refs.resolve_audio(alvo))
    if comando == "musica-reels":
        return audio_reels(refs.resolve_audio(alvo), cursor=cursor)
    if comando == "em-alta":
        return explore_trending()
    if comando == "em-alta-secao":
        return explore_section(alvo or "trending_now", cursor=cursor)
    raise ValueError(f"comando desconhecido: {comando}")


def consultar(comando, alvo, cursor, cache, teto, encaixe, executor=executar_consulta):
    """Uma consulta, com cache e teto. Devolve sempre um envelope (dict)."""
    registro = cache.ler(comando, alvo, cursor)
    if registro is not None:
        return controle.envelope_ok(comando, alvo, registro["dados"], True, registro.get("guardado_em"), teto)
    if encaixe is not None:
        encaixe.ultima_resposta = None
    try:
        if encaixe is not None:
            encaixe.ligar()
        dados = executor(comando, alvo, cursor)
    except Exception as e:  # noqa: BLE001 — todo erro vira envelope, nunca dado inventado
        return controle.envelope_erro(comando, alvo, e, getattr(encaixe, "ultima_resposta", None), teto)
    cache.gravar(comando, alvo, cursor, dados)
    return controle.envelope_ok(comando, alvo, dados, False, controle.agora_iso(), teto)


def _args():
    p = argparse.ArgumentParser(
        prog="pesquisa_instagram.py",
        description="Pesquisa de pauta e referência no Instagram, sem login. Saída em JSON.",
    )
    p.add_argument("comando", choices=sorted(list(COMANDOS) + ["lote"]))
    p.add_argument("alvo", nargs="?", default=None,
                   help="usuário, link de post, hashtag, texto, id ou link de música, seção, ou o arquivo do lote")
    p.add_argument("--cursor", default=None, help="o next_cursor da página anterior")
    p.add_argument("--cache", default=os.environ.get("PESQUISA_INSTAGRAM_CACHE", PASTA_CACHE_PADRAO),
                   help="pasta do cache e do contador do dia (padrão: ./pesquisa-instagram-cache)")
    p.add_argument("--sem-cache", action="store_true", help="não lê nem grava cache (o contador do dia continua)")
    p.add_argument("--teto", type=int, default=controle.TETO_POR_EXECUCAO,
                   help=f"requisições por execução (padrão {controle.TETO_POR_EXECUCAO})")
    p.add_argument("--teto-dia", type=int, default=controle.TETO_POR_DIA,
                   help=f"requisições por dia, nesta pasta de cache (padrão {controle.TETO_POR_DIA})")
    p.add_argument("--pausa", type=float, default=controle.PAUSA_SEGUNDOS,
                   help=f"segundos entre requisições (padrão {controle.PAUSA_SEGUNDOS}; mínimo 1)")
    return p.parse_args()


def _ler_lote(caminho):
    with open(caminho, encoding="utf-8") as f:
        itens = json.load(f)
    if not isinstance(itens, list):
        raise ValueError("o lote é uma lista de {\"comando\": ..., \"alvo\": ...}")
    return itens


def main():
    a = _args()
    pausa = max(1.0, a.pausa)
    teto = controle.Teto(por_execucao=a.teto, por_dia=a.teto_dia, pausa=pausa, pasta=a.cache)
    cache = controle.Cache(None if a.sem_cache else a.cache)
    encaixe = Encaixe(teto)

    if a.comando == "lote":
        inicio = time.time()
        resultados = []
        for item in _ler_lote(a.alvo):
            comando, alvo = item.get("comando"), item.get("alvo")
            if comando not in COMANDOS:
                resultados.append(controle.envelope_erro(comando, alvo, ValueError(f"comando desconhecido: {comando}")))
                continue
            t = time.time()
            r = consultar(comando, alvo, item.get("cursor"), cache, teto, encaixe)
            r["segundos"] = round(time.time() - t, 1)
            resultados.append(r)
        saida = {
            "ok": all(r["ok"] for r in resultados),
            "aviso": controle.AVISO_TERCEIROS,
            "chamadas": teto.resumo(),
            "segundos": round(time.time() - inicio, 1),
            "resultados": resultados,
        }
    else:
        precisa, _ = COMANDOS[a.comando]
        if precisa and a.comando != "em-alta-secao" and not a.alvo:
            print(json.dumps(controle.envelope_erro(a.comando, None, ValueError("falta o alvo")), ensure_ascii=False))
            return 2
        saida = consultar(a.comando, a.alvo, a.cursor, cache, teto, encaixe)

    print(json.dumps(saida, ensure_ascii=False, indent=2))
    return 0 if saida["ok"] else 3


if __name__ == "__main__":
    sys.exit(main())
