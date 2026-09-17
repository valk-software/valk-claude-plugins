#!/usr/bin/env python3
"""ref_analyzer.py -- the "eye" of the video-reference curation front.

Downloads a reference video (Instagram Reel / TikTok / YouTube Short or video),
extracts representative frames + metadata (+ optional audio and auto-subtitles),
and assembles an analysis package in a local folder.

The package is meant to be read by Claude (multimodal): Claude looks at the
frames + reads the metadata/transcript and distills the *visual recipe*
(palette, typography, cut rhythm, footage type, grading, caption style, hook
timing, structure) into a card.

The package is scratch material and stays on disk. The CARD goes to the Valk
Hub, appended to the "Receitas visuais de video" document -- read it whole with
ler_documento, then corrigir_documento with the full text plus the new card.
That document is ACCUMULATED: sending only the new card erases the others.

This script does NOT call any LLM API -- it only prepares the material. The
intelligence stays with the Claude session that reads the package. A stub for
an autonomous API path is left in `analyze_with_api()` for later.

Usage:
    python ref_analyzer.py <url> [--out DIR] [--slug name] [--frames 16]
                                 [--audio] [--cookies-from-browser chrome]

Output tree (default: ./ref-analyzer/ under the current directory):
    <out>/<slug>/
        video.<ext>          downloaded video (git-ignored, heavy)
        audio.mp3            only with --audio (for later Whisper transcript)
        frames/NN_TTTs.jpg   uniform frames, timestamp encoded in the name
        subs.<lang>.vtt      auto/manual subtitles, when the platform has them
        meta.json            title, author, duration, metrics, platform
        README.md            package index -- Claude reads THIS + the frames
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import yt_dlp

# The packages are scratch material, so they land under wherever the tool is
# run from -- NOT next to the script. The script ships inside a plugin, and a
# plugin folder is replaced on every update: anything written there would be
# lost without warning.
HERE = Path(__file__).resolve().parent
DEFAULT_OUT = Path.cwd() / "ref-analyzer"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def ensure_ffmpeg_dir() -> str:
    """yt-dlp needs a binary literally named ffmpeg(.exe) to merge streams.

    imageio-ffmpeg ships one under a versioned name, so expose a copy with the
    canonical name in a local (git-ignored) _bin dir and hand that dir to yt-dlp.
    """
    d = HERE / "_bin"
    d.mkdir(exist_ok=True)
    target = d / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if not target.exists():
        shutil.copy2(FFMPEG, target)
    return str(d)

FRAME_CHECKLIST = """\
Ao destilar a receita visual (frames + metadados abaixo), cubra:
- **Gancho (0-3s):** o que aparece/é dito nos primeiros frames? Por que segura o scroll?
- **Estrutura:** quantos beats, que arco (HPP, loop, antes/depois, POV, listicle...).
- **Footage:** stock cinematográfico, arquivo, tela gravada, elenco, motion graphics?
- **Paleta + grading:** cores dominantes, temperatura, contraste, mood.
- **Tipografia da legenda:** serif/sans, peso, tamanho, 1-2 palavras vs frase, cor, realce.
- **Ritmo de corte:** cortes por segundo, sincronia legenda<->voz<->footage.
- **Locução:** tom (calmo/energético), cadência, presença de música.
- **Fecho:** como termina (payoff, CTA, marca). O nosso NÃO usa CTA (topo de funil).
- **Como vira nosso:** que pilar/pauta esse formato serve, com cara própria.
- **Confiança:** alta/média/baixa, e quantas refs já confirmaram esse padrão."""


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[\s_-]+", "-", text)[:60] or "ref"


def run_ffmpeg(args: list[str]) -> None:
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args],
        check=True,
    )


def download(url: str, outdir: Path, cookies_browser: str | None) -> dict:
    """Download the video (critical) then subtitles (best-effort).

    Subtitles live behind a stricter rate limit (429 is common). A subtitle
    failure must never abort the video download, so they run as a separate,
    swallowed pass.
    """
    base = {
        "outtmpl": str(outdir / "video.%(ext)s"),
        "format": "bv*[ext=mp4]+ba/b[ext=mp4]/b",
        "noplaylist": True,  # &list=WL etc. must not drag the whole playlist
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "retries": 5,
        "fragment_retries": 5,
        "sleep_interval_requests": 1,  # gentle pacing to dodge 429s
        "ffmpeg_location": ensure_ffmpeg_dir(),  # for stream merging
    }
    if cookies_browser:
        base["cookiesfrombrowser"] = (cookies_browser,)

    with yt_dlp.YoutubeDL({**base, "writeinfojson": True}) as ydl:
        info = ydl.extract_info(url, download=True)

    # subtitles: separate, best-effort pass — a 429 here is non-fatal
    try:
        sub_opts = {**base, "skip_download": True, "writesubtitles": True,
                    "writeautomaticsub": True, "subtitleslangs": ["pt", "pt-BR", "en"],
                    "subtitlesformat": "vtt"}
        with yt_dlp.YoutubeDL(sub_opts) as ydl:
            ydl.download([url])
    except Exception as exc:  # noqa: BLE001
        print(f"  (legendas indisponíveis: {str(exc)[:70]})")

    # normalize subtitle file names to subs.<lang>.vtt for readability
    for vtt in outdir.glob("video*.vtt"):
        lang = vtt.stem.split(".")[-1] if "." in vtt.stem else "auto"
        vtt.rename(outdir / f"subs.{lang}.vtt")
    return info


def find_video(outdir: Path) -> Path:
    for ext in ("mp4", "mkv", "webm", "mov"):
        hits = list(outdir.glob(f"video.{ext}"))
        if hits:
            return hits[0]
    raise FileNotFoundError("nenhum arquivo de video baixado em " + str(outdir))


def extract_frames(video: Path, frames_dir: Path, n: int, duration: float) -> list[float]:
    """Extract n uniform frames across the video.

    Uses a small ABSOLUTE padding (not a percentage) so the hook — the first
    seconds, which carry most of the viral signal — is always sampled, even on
    a 17-minute video where 5% would swallow the whole opening.
    """
    frames_dir.mkdir(parents=True, exist_ok=True)
    pad = min(1.5, duration * 0.03)
    start, end = pad, duration - pad
    span = max(end - start, 0.1)
    stamps = [round(start + span * i / max(n - 1, 1), 2) for i in range(n)]
    for idx, t in enumerate(stamps):
        out = frames_dir / f"{idx:02d}_{t:g}s.jpg"
        # -ss before -i = fast seek; -q:v 2 = high-quality jpeg
        run_ffmpeg(["-ss", str(t), "-i", str(video), "-frames:v", "1", "-q:v", "2", str(out)])
    return stamps


def extract_audio(video: Path, out: Path) -> None:
    run_ffmpeg(["-i", str(video), "-vn", "-acodec", "libmp3lame", "-q:a", "4", str(out)])


def build_meta(info: dict, url: str) -> dict:
    keys = ("title", "uploader", "channel", "duration", "view_count",
            "like_count", "comment_count", "repost_count", "width", "height",
            "fps", "extractor_key", "description", "upload_date")
    meta = {k: info.get(k) for k in keys}
    meta["url"] = url
    return meta


def write_readme(outdir: Path, meta: dict, stamps: list[float], subs: list[Path],
                 has_audio: bool) -> None:
    dur = meta.get("duration") or 0
    frame_lines = "\n".join(
        f"- `frames/{i:02d}_{t:g}s.jpg` — {t:g}s" for i, t in enumerate(stamps)
    )
    sub_lines = "\n".join(f"- `{s.name}`" for s in subs) or "- (a plataforma não expôs legenda)"
    desc = (meta.get("description") or "").strip()
    if len(desc) > 800:
        desc = desc[:800] + " […]"
    readme = f"""\
# Pacote de análise — {meta.get('title') or outdir.name}

> Gerado por `ref_analyzer.py`. **Este é o material bruto pro Claude destilar a
> receita visual.** Esta pasta é rascunho e fica no disco.
>
> **O CARTÃO vai para o Valk Hub**, acrescentado ao documento "Receitas visuais
> de vídeo". Ele é ACUMULADO: leia o documento inteiro com `ler_documento` e
> mande `corrigir_documento` com o texto TODO mais o cartão novo. Mandar só o
> cartão novo apaga os doze que já estavam lá.

## Metadados

| campo | valor |
|---|---|
| Plataforma | {meta.get('extractor_key')} |
| Autor | {meta.get('uploader') or meta.get('channel')} |
| Duração | {dur:g}s |
| Dimensões | {meta.get('width')}x{meta.get('height')} @ {meta.get('fps')}fps |
| Views | {meta.get('view_count')} |
| Likes | {meta.get('like_count')} |
| Comentários | {meta.get('comment_count')} |
| URL | {meta.get('url')} |

### Descrição / caption
{desc or '(vazia)'}

## Frames ({len(stamps)}), em ordem cronológica
{frame_lines}

## Transcrição / legenda
{sub_lines}

## Áudio
{'- `audio.mp3` (extraído; transcrever com Whisper se precisar da voz)' if has_audio else '- (não extraído; rode com --audio se quiser a voz)'}

## O que destilar

{FRAME_CHECKLIST}
"""
    (outdir / "README.md").write_text(readme, encoding="utf-8")


def analyze_with_api(outdir: Path) -> None:
    """Stub: autonomous path (Anthropic API reads frames -> writes card).

    Left unimplemented on purpose. v1 keeps the intelligence in the Claude
    session that reads the package, so there is no API key / per-call cost.
    """
    raise NotImplementedError("v1 usa o Claude do chat; a rota autônoma via API fica pra depois")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows console defaults to cp1252
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description="Baixa e prepara um vídeo de referência pra análise visual.")
    ap.add_argument("url")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help="pasta onde o pacote é montado (default: ./ref-analyzer)")
    ap.add_argument("--slug", help="nome da pasta (default: derivado do título)")
    ap.add_argument("--frames", type=int, default=16, help="nº de frames uniformes (default 16)")
    ap.add_argument("--audio", action="store_true", help="também extrai o áudio (mp3)")
    ap.add_argument("--cookies-from-browser", dest="cookies", default=None,
                    help="ex: chrome/edge/firefox — necessário pra alguns Reels do Instagram")
    args = ap.parse_args()

    sources = args.out.resolve()
    tmp_slug = args.slug or "tmp-ref"
    outdir = sources / slugify(tmp_slug)
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"[1/4] baixando {args.url} …")
    try:
        info = download(args.url, outdir, args.cookies)
    except Exception as exc:  # noqa: BLE001 — yt-dlp raises many types
        print(f"  ✗ falha no download: {exc}", file=sys.stderr)
        if "login" in str(exc).lower() or "cookies" in str(exc).lower():
            print("  → tente --cookies-from-browser chrome (Reels privados/limitados)", file=sys.stderr)
        return 1

    # if no explicit slug, rename the folder to the real title now that we know it
    if not args.slug:
        final = sources / slugify(info.get("title") or tmp_slug)
        if final != outdir and not final.exists():
            outdir = outdir.rename(final)

    video = find_video(outdir)
    duration = float(info.get("duration") or 0) or 30.0
    meta = build_meta(info, args.url)
    (outdir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[2/4] extraindo {args.frames} frames …")
    stamps = extract_frames(video, outdir / "frames", args.frames, duration)

    if args.audio:
        print("[3/4] extraindo áudio …")
        extract_audio(video, outdir / "audio.mp3")
    else:
        print("[3/4] áudio pulado (use --audio pra extrair)")

    subs = sorted(outdir.glob("subs.*.vtt"))
    write_readme(outdir, meta, stamps, subs, args.audio)

    print(f"[4/4] pacote pronto: {outdir}")
    print("      → abra o README.md e peça pro Claude destilar o cartão.")
    print("      → o cartão vai ACRESCENTADO ao documento de receitas no hub.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
