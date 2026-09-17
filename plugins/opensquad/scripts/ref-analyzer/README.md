# ref-analyzer — o "olho" da curadoria de referência de vídeo

Baixa um vídeo de referência (Instagram Reel / TikTok / YouTube Short ou vídeo)
e o **decompõe** em frames + áudio + metadados, montando um pacote que o Claude
(multimodal) lê pra destilar a **receita visual** num cartão.

Existe porque texto e áudio não enxergam paleta, grading, ritmo de corte nem
tipografia cinética. Isso só sai olhando os frames.

## Onde entra

```
alguém acha a referência que performou
   │  url
   ▼
ref_analyzer.py  ── baixa + quebra em frames/áudio/meta ──▶  ./ref-analyzer/<slug>/
   │                                                              │ (frames)
   ▼                                                              ▼
Claude multimodal  ── destila a receita ──▶  documento "Receitas visuais de vídeo" NO HUB
                                                              │
                                                              ▼
                                            pauteiro / designer, no próximo run
```

**Ferramenta, não squad.** Baixar e recortar vídeo é trabalho determinístico
(código), então é código. A *avaliação* (frames → receita) é do modelo.

## Uso

```bash
python ref_analyzer.py <url> [--out DIR] [--slug nome] [--frames 16] \
                             [--audio] [--cookies-from-browser chrome]
```

- `--out` onde o pacote é montado. **Default: `./ref-analyzer/` na pasta de
  onde você rodou** — nunca dentro do plugin (ver abaixo).
- `--slug` nomeia a pasta; sem ele, deriva do título do vídeo.
- `--frames` nº de frames uniformes (default 16; sobe pra vídeos longos).
- `--audio` extrai `audio.mp3` pra transcrever depois.
- `--cookies-from-browser chrome` necessário pra alguns Reels do Instagram
  (login/idade). TikTok e YouTube em geral não precisam.

Saída: `<out>/<slug>/` com `README.md`, `meta.json`, `frames/`, `subs.*.vtt`.
Abra o `README.md` do pacote e peça o cartão.

## ⚠️ O pacote fica no disco. O CARTÃO vai para o hub

A pasta de saída é **rascunho**: vídeo baixado, frames soltos, legenda bruta.
Não vale versionar nem sincronizar. O que vale é o cartão destilado, e ele vai
para o documento **"Receitas visuais de vídeo"** no Valk Hub.

**Esse documento é ACUMULADO.** Cada cartão novo se soma aos que já existem
(treze, em setembro de 2026). Para acrescentar:

1. `ler_documento` — o documento **inteiro**.
2. `corrigir_documento` com o texto TODO **mais** o cartão novo, e a seção
   "Padrões emergentes" atualizada.

`corrigir_documento` substitui o documento. Mandar só o cartão novo apaga os
outros. Não é zelo, é o procedimento — cada cartão custa um vídeo assistido
quadro a quadro.

## Por que a saída não fica ao lado do script

Este script mora dentro de um plugin, e **a pasta de um plugin é substituída a
cada atualização**. Qualquer coisa escrita aqui some sem aviso na próxima
versão. Por isso o `DEFAULT_OUT` segue o diretório de onde você rodou, e não o
do arquivo. Se você passar um `--out` apontando para dentro do plugin, o
trabalho vai junto no próximo `plugin update`.

## Dependências

```bash
pip install -r requirements.txt
```

`yt-dlp` (download) + `imageio-ffmpeg` (traz um ffmpeg embutido, sem instalar no
sistema). **Não usa nenhuma API de LLM** — a inteligência fica na sessão do
Claude, então não tem chave nem custo por chamada.

Precisa de Python na máquina. É a única peça do Opensquad que ainda depende
disso; o resto roda só com o conector do hub.
