/**
 * O gancho do fim de sessão: manda ao Valk Hub o consumo de IA da sessão (#1468).
 *
 *   node scripts/consumo-de-ia/enviar.mjs [sessao_claude_code|rotina]
 *
 * Quem chama é o Claude Code, com o JSON do gancho na entrada padrão (`session_id`, `transcript_path`), em dois
 * ganchos: `Stop` (ao fim de cada resposta, com `--parcial`) e `SessionEnd` (o fim da sessão, que manda tudo). Só o
 * fim da sessão não bastava: as sessões duram dias e muitas fecham sem ele, e de 12 a 17/11 o hub recebeu um
 * registro. As regras do parcial estão em selecao.mjs. Como instalar: docs/consumo-de-ia.md.
 *
 * ── O que ele precisa ────────────────────────────────────────────────────
 * A chave da conta de IA (valk_ia_...): a de VALK_CONSUMO_DE_IA_CHAVE ou, sem ela, a da conta do Claude logada
 * agora, em ~/.claude/valk-consumo-de-ia.json (chave-da-conta.mjs). Sem chave, sai calado: a sessão não é medida,
 * e não pode travar.
 * VALK_CONSUMO_DE_IA_URL (opcional): outro endereço para a rota. O padrão é o do hub.
 * VALK_CONSUMO_DE_IA_ORIGEM (opcional): `rotina` nas rotinas da nuvem, quando o argumento não vem.
 *
 * ── O que ele NUNCA manda ────────────────────────────────────────────────
 * Texto de conversa, e-mail da conta, caminho de pasta (nem o do transcript), nome de branch. Só o que
 * `extrair.mjs` devolve: ids, modelo, números e a tarefa.
 *
 * ── Ele nunca trava o fim da sessão ──────────────────────────────────────
 * Sai sempre com 0, com um tempo curto por envio, e escreve uma linha no erro padrão dizendo o que fez. Mandar a
 * mesma sessão de novo não conta duas vezes: o hub ignora a mensagem que já tem.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, appendFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emLotes, extrairConsumo } from "./extrair.mjs";
import { chaveDestaSessao } from "./chave-da-conta.mjs";
import { ehHoraDoParcial, escolherParaEnviar, nomeDoArquivoDaSessao } from "./selecao.mjs";

// `--parcial` é o gancho `Stop` (ao fim de cada resposta); sem ele, é o fim da sessão, que manda tudo.
const PARCIAL = process.argv.includes("--parcial");
// Os ids já mandados desta máquina, um arquivo por sessão. Só ids: nada de conversa.
const PASTA_DOS_ENVIADOS = join(homedir(), ".claude", "valk-consumo-de-ia-enviados");

const ENDERECO_PADRAO = "https://hub.valkbr.com/api/consumo-de-ia";
const POR_ENVIO = 2000; // o teto da rota (MAXIMO_DE_TRECHOS, em src/lib/consumo-de-ia/envio.ts)
const TEMPO_POR_ENVIO_MS = 15000;

function avisar(frase) {
  process.stderr.write(`[consumo de IA] ${frase}\n`);
}

function lerEntrada() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

function linhasDe(caminho) {
  try {
    return readFileSync(caminho, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/** Os transcripts dos subagentes, em `<sessão>/subagents/*.jsonl`, ao lado do principal. */
function arquivosDosSubagentes(transcript) {
  const pasta = join(transcript.replace(/\.jsonl$/, ""), "subagents");
  if (!existsSync(pasta)) return [];
  try {
    return readdirSync(pasta)
      .filter((n) => n.endsWith(".jsonl"))
      .map((n) => linhasDe(join(pasta, n)));
  } catch {
    return [];
  }
}

/** Guarda, no arquivo local da sessão, os ids que o hub aceitou. Falha aqui não trava nada: o hub não duplica. */
function lembrarEnviados(arquivo, lote) {
  if (!arquivo) return;
  try {
    mkdirSync(PASTA_DOS_ENVIADOS, { recursive: true });
    appendFileSync(arquivo, lote.map((t) => t.mensagem).join("\n") + "\n");
  } catch {
    // sem lista local, o próximo envio manda de novo e o hub responde "já existia"
  }
}

/** A hora do arquivo é a do último envio: é ela que espaça o parcial. */
function marcarAgora(arquivo) {
  if (!arquivo) return;
  try {
    mkdirSync(PASTA_DOS_ENVIADOS, { recursive: true });
    if (!existsSync(arquivo)) writeFileSync(arquivo, "");
    const agora = new Date();
    utimesSync(arquivo, agora, agora);
  } catch {
    // sem a marca, o parcial roda de novo na próxima resposta; nada quebra
  }
}

async function principal() {
  // A chave da conta logada agora (chave-da-conta.mjs): a variável, ou a do arquivo local pela conta do Claude.
  const { chave, de } = chaveDestaSessao();
  // No parcial, sem chave é o normal de quem não mede: calado, para não poluir cada resposta.
  if (!chave) return PARCIAL ? undefined : avisar(`sem chave (${de}): esta sessão não foi medida.`);
  // A origem é dita por quem instala, e não adivinhada: o argumento, ou VALK_CONSUMO_DE_IA_ORIGEM no ambiente da rotina.
  const pedida = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? process.env.VALK_CONSUMO_DE_IA_ORIGEM;
  const origem = pedida === "rotina" ? "rotina" : "sessao_claude_code";
  const entrada = lerEntrada();
  const transcript = entrada && typeof entrada.transcript_path === "string" ? entrada.transcript_path : null;
  if (!transcript) return avisar("o gancho não trouxe o transcript.");

  const sessaoDoGancho = typeof entrada.session_id === "string" && entrada.session_id ? entrada.session_id : null;
  const arquivo = sessaoDoGancho ? join(PASTA_DOS_ENVIADOS, nomeDoArquivoDaSessao(sessaoDoGancho)) : null;
  const agoraMs = Date.now();
  // O parcial roda a cada resposta: só de tempos em tempos lê o transcript inteiro.
  if (PARCIAL && arquivo && !ehHoraDoParcial(existsSync(arquivo) ? statSync(arquivo).mtimeMs : null, agoraMs)) return;

  const { sessao: daLinha, trechos: todos } = extrairConsumo({ principal: linhasDe(transcript), subagentes: arquivosDosSubagentes(transcript) });
  const sessao = sessaoDoGancho ?? daLinha;
  const enviados = new Set(arquivo ? linhasDe(arquivo) : []);
  const trechos = escolherParaEnviar(todos, enviados, { parcial: PARCIAL, agoraMs });
  marcarAgora(arquivo);
  if (!sessao || trechos.length === 0) return PARCIAL ? undefined : avisar("nada para mandar.");

  const endereco = process.env.VALK_CONSUMO_DE_IA_URL?.trim() || ENDERECO_PADRAO;
  let gravados = 0;
  let jaExistiam = 0;
  for (const lote of emLotes(trechos, POR_ENVIO)) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TEMPO_POR_ENVIO_MS);
    try {
      const r = await fetch(endereco, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
        body: JSON.stringify({ sessao, origem, trechos: lote }),
        signal: controle.signal,
      });
      const resposta = await r.json().catch(() => ({}));
      if (!r.ok) return avisar(`o hub recusou (${r.status}): ${resposta.erro ?? "sem frase"}.`);
      gravados += resposta.gravados ?? 0;
      jaExistiam += resposta.ja_existiam ?? 0;
      lembrarEnviados(arquivo, lote);
    } catch (erro) {
      return avisar(`não deu para mandar: ${erro instanceof Error ? erro.message : String(erro)}.`);
    } finally {
      clearTimeout(relogio);
    }
  }
  avisar(`${trechos.length} respostas lidas, ${gravados} novas no hub, ${jaExistiam} já estavam lá.`);
}

principal()
  .catch((erro) => avisar(`falhou: ${erro instanceof Error ? erro.message : String(erro)}.`))
  // Sai com 0 deixando o processo terminar sozinho. `process.exit()` com a conexão do fetch ainda fechando derruba o
  // Node no Windows (assertion em src\win\async.c, código 127), e o gancho promete nunca sair com erro.
  .finally(() => {
    process.exitCode = 0;
  });
