/**
 * Qual chave o gancho usa: a da conta do Claude que está logada AGORA nesta máquina (#1468).
 *
 * Uma máquina pode usar mais de uma conta. A do Felipe usa a dele e, quando as duas da casa estouram, a do Vini.
 * Uma chave só na variável de ambiente lançaria o uso das duas na mesma conta, e o custo das tarefas sairia do
 * dinheiro errado. Por isso a chave é escolhida pela conta logada:
 *
 *   ~/.claude/valk-consumo-de-ia.json   { "contas": { "<accountUuid>": "valk_ia_..." } }
 *
 * O `accountUuid` é o que o Claude Code grava em ~/.claude.json, em `oauthAccount`. Ele só é lido AQUI, nesta
 * máquina, para escolher a chave: nunca é mandado ao hub, nem o e-mail. Quem diz ao hub de que conta é o uso é a
 * chave, e só ela (a rota recusa conta no corpo).
 *
 * A variável VALK_CONSUMO_DE_IA_CHAVE continua valendo, e GANHA do arquivo: é o caminho das rotinas da nuvem, onde
 * não há ~/.claude.json da pessoa e a conta é sempre a mesma.
 *
 * Registrar a conta logada: node scripts/consumo-de-ia/registrar-esta-conta.mjs <felipe|vini|admin>
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ARQUIVO_DAS_CHAVES = join(homedir(), ".claude", "valk-consumo-de-ia.json");
const PERFIL_DO_CLAUDE = join(homedir(), ".claude.json");

/**
 * A regra, pura: a variável primeiro; depois a chave da conta logada no arquivo. Sem as duas, `null`, e o gancho
 * sai calado. Chave que não tem a forma da emitida é ignorada: o arquivo é editável à mão, e mandar lixo ao hub
 * só geraria recusa.
 */
export function escolherChave({ variavel, contaLogada, chaves }) {
  const daVariavel = typeof variavel === "string" ? variavel.trim() : "";
  if (daVariavel) return { chave: daVariavel, de: "variavel" };
  if (typeof contaLogada !== "string" || !contaLogada) return { chave: null, de: "sem conta logada" };
  const doArquivo = chaves && typeof chaves === "object" ? chaves[contaLogada] : undefined;
  if (typeof doArquivo !== "string" || !/^valk_ia_[A-Za-z0-9_-]{20,}$/.test(doArquivo)) {
    return { chave: null, de: "conta sem chave registrada" };
  }
  return { chave: doArquivo, de: "arquivo" };
}

function lerJson(caminho) {
  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch {
    return null;
  }
}

/** O `accountUuid` da conta logada no Claude Code desta máquina, ou `null`. */
export function contaLogadaAgora() {
  const perfil = lerJson(PERFIL_DO_CLAUDE);
  const uuid = perfil?.oauthAccount?.accountUuid;
  return typeof uuid === "string" && uuid ? uuid : null;
}

/** O mapa conta → chave do arquivo local, ou um mapa vazio. */
export function chavesRegistradas() {
  const arquivo = lerJson(ARQUIVO_DAS_CHAVES);
  return arquivo && typeof arquivo.contas === "object" && arquivo.contas !== null ? arquivo.contas : {};
}

/** O que o gancho chama. */
export function chaveDestaSessao() {
  return escolherChave({
    variavel: process.env.VALK_CONSUMO_DE_IA_CHAVE,
    contaLogada: contaLogadaAgora(),
    chaves: chavesRegistradas(),
  });
}
