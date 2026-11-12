/**
 * SEM shebang, de propósito: o vitest importa este arquivo, e shebang com CRLF derruba o leitor dele.
 *
 * A extração do consumo de IA de um transcript do Claude Code (#1468). Pura: recebe as LINHAS dos arquivos e
 * devolve os trechos. Quem lê o disco e manda ao hub é `enviar.mjs`.
 *
 * ── O que sai daqui, e o que nunca sai ───────────────────────────────────
 * Sai: o id da sessão, o id de cada resposta do modelo, o modelo, os quatro números de tokens que o Claude Code
 * guarda (`usage`), o instante e a tarefa. Nunca sai texto de conversa, caminho de pasta (`cwd`), e-mail, nome de
 * branch nem o comando que rodou: o leitor olha esses campos para achar a tarefa, e não os copia.
 *
 * ── Uma resposta aparece em várias linhas ────────────────────────────────
 * O Claude Code grava uma linha por bloco da resposta (pensamento, texto, cada ferramenta), todas com o MESMO
 * `message.id` e o MESMO `usage`. Somar as linhas contaria a mesma resposta duas, três vezes. Vale a primeira.
 *
 * ── O conselheiro mora nas iterações ─────────────────────────────────────
 * Quando a sessão consulta o advisor, o consumo dele vem em `usage.iterations` (tipo `advisor_message`, com o modelo
 * dele), FORA do `usage` de cima. Ele vira um trecho próprio, `<message.id>:i<n>`, com a tarefa do instante.
 *
 * ── Os subagentes moram em outro arquivo ─────────────────────────────────
 * `<sessão>/subagents/agent-*.jsonl`, ao lado do transcript. Sem eles, a sessão que delega sai barata.
 *
 * ── A tarefa de cada trecho ──────────────────────────────────────────────
 * 1. A tarefa em DOING naquele instante: a última que `mover_tarefa` levou a doing e ainda não saiu (para done ou
 *    todo). O número vem da RESPOSTA da ferramenta (`atualizadas[].ref`), porque a chamada leva o uuid. Várias de uma
 *    vez (`tarefa_ids`): a última da lista é a corrente, e as outras continuam abertas por baixo.
 * 2. Sem tarefa em doing: a do próximo commit da sessão com `Ref #N` (o trabalho que leva a um commit é dele).
 * 3. Sem as duas: "sem tarefa" (nulo).
 * O nome da ferramenta casa pelo FIM (`__mover_tarefa`), porque o prefixo do conector muda (`mcp__claude_ai_Valk_Hub__`,
 * `mcp__Valk_Hub__`).
 */

const FERRAMENTAS_DE_TAREFA = ["__mover_tarefa", "__criar_tarefa", "__criar_tarefas"];

/** @param {string} linha */
function lerLinha(linha) {
  try {
    const o = JSON.parse(linha);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

/** @param {unknown} n */
const inteiro = (n) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * Os números que a resposta do modelo contou.
 * @param {any} usage
 */
function tokensDe(usage) {
  return {
    entrada: inteiro(usage?.input_tokens),
    saida: inteiro(usage?.output_tokens),
    cache_leitura: inteiro(usage?.cache_read_input_tokens),
    cache_escrita: inteiro(usage?.cache_creation_input_tokens),
  };
}

/**
 * O texto de um resultado de ferramenta, venha ele como texto ou como lista de blocos.
 * @param {any} conteudo
 * @returns {string}
 */
function textoDoResultado(conteudo) {
  if (typeof conteudo === "string") return conteudo;
  if (Array.isArray(conteudo)) return conteudo.map((b) => (b && typeof b.text === "string" ? b.text : "")).join("\n");
  return "";
}

/**
 * Os números das tarefas que a resposta da ferramenta diz ter mexido, com a situação de cada uma quando ela diz.
 * @param {string} texto
 * @returns {{ ref: number, situacao: string | null }[]}
 */
export function tarefasDoResultado(texto) {
  const json = lerLinha(texto);
  /** @type {{ ref: number, situacao: string | null }[]} */
  const out = [];
  if (json) {
    const listas = [json.atualizadas, json.criadas, json.tarefas].filter(Array.isArray);
    for (const lista of listas)
      for (const t of lista) if (t && Number.isSafeInteger(t.ref) && t.ref > 0) out.push({ ref: t.ref, situacao: typeof t.work_status === "string" ? t.work_status : null });
    if (out.length === 0 && Number.isSafeInteger(json.ref) && json.ref > 0) out.push({ ref: json.ref, situacao: typeof json.work_status === "string" ? json.work_status : null });
    if (out.length === 0 && json.tarefa && Number.isSafeInteger(json.tarefa.ref)) out.push({ ref: json.tarefa.ref, situacao: null });
    return out;
  }
  for (const m of texto.matchAll(/"ref"\s*:\s*(\d+)/g)) out.push({ ref: Number(m[1]), situacao: null });
  return out;
}

/** @param {string} nome */
const ehDeTarefa = (nome) => typeof nome === "string" && FERRAMENTAS_DE_TAREFA.some((f) => nome.endsWith(f));

/**
 * @typedef {{ mensagem: string, modelo: string, ocorreu_em: string, entrada: number, saida: number, cache_leitura: number, cache_escrita: number, tarefa: number | null }} Trecho
 * @typedef {{ instante: string, tipo: "comeca" | "para", refs: number[] }} Mudanca
 */

/**
 * O consumo de uma sessão.
 * @param {{ principal: string[], subagentes?: string[][] }} arquivos as linhas de cada arquivo
 * @returns {{ sessao: string | null, trechos: Trecho[] }}
 */
export function extrairConsumo(arquivos) {
  const todos = [arquivos.principal, ...(arquivos.subagentes ?? [])];
  /** @type {string | null} */
  let sessao = null;
  /** @type {Map<string, Trecho & { ordem: number }>} */
  const respostas = new Map();
  /** @type {Map<string, { nome: string, entrada: any }>} */
  const chamadas = new Map();
  /** @type {Mudanca[]} */
  const mudancas = [];
  /** @type {{ instante: string, ref: number }[]} */
  const commits = [];
  let ordem = 0;

  for (const linhas of todos) {
    for (const bruta of linhas) {
      const o = lerLinha(bruta);
      if (!o) continue;
      if (!sessao && typeof o.sessionId === "string") sessao = o.sessionId;
      const instante = typeof o.timestamp === "string" ? o.timestamp : null;
      const msg = o.message;

      if (o.type === "assistant" && msg && typeof msg === "object") {
        // As chamadas de ferramenta: as de tarefa esperam a resposta; o commit vale na hora.
        for (const b of Array.isArray(msg.content) ? msg.content : []) {
          if (!b || b.type !== "tool_use" || typeof b.id !== "string") continue;
          if (ehDeTarefa(b.name)) chamadas.set(b.id, { nome: b.name, entrada: b.input ?? {} });
          const comando = b.name === "Bash" && typeof b.input?.command === "string" ? b.input.command : "";
          if (instante && /\bgit\s+commit\b/.test(comando)) {
            const m = /Ref\s+#(\d+)/i.exec(comando);
            if (m) commits.push({ instante, ref: Number(m[1]) });
          }
        }
        // O consumo: uma vez por resposta.
        const id = typeof msg.id === "string" ? msg.id : null;
        const modelo = typeof msg.model === "string" ? msg.model : null;
        if (!id || !modelo || modelo.startsWith("<") || !msg.usage || !instante || respostas.has(id)) continue;
        const t = tokensDe(msg.usage);
        if (t.entrada + t.saida + t.cache_leitura + t.cache_escrita > 0) {
          respostas.set(id, { mensagem: id, modelo, ocorreu_em: instante, ...t, tarefa: null, ordem: ordem++ });
        }
        // O conselheiro (advisor) roda DENTRO da resposta, com o modelo dele, e o `usage` de cima NÃO o soma: ele mora
        // em `usage.iterations`, como `advisor_message`. Medido em 12/11/2026 em 61 respostas com conselheiro: o de
        // cima é exatamente a soma das iterações `message`. Cada iteração que não é `message` vira um trecho próprio.
        const iteracoes = Array.isArray(msg.usage.iterations) ? msg.usage.iterations : [];
        iteracoes.forEach((it, n) => {
          if (!it || it.type === "message" || typeof it.model !== "string" || it.model.startsWith("<")) return;
          const ti = tokensDe(it);
          if (ti.entrada + ti.saida + ti.cache_leitura + ti.cache_escrita === 0) return;
          const idDaIteracao = `${id}:i${n}`;
          if (!respostas.has(idDaIteracao)) respostas.set(idDaIteracao, { mensagem: idDaIteracao, modelo: it.model, ocorreu_em: instante, ...ti, tarefa: null, ordem: ordem++ });
        });
        continue;
      }

      if (o.type === "user" && msg && Array.isArray(msg.content) && instante) {
        for (const b of msg.content) {
          if (!b || b.type !== "tool_result" || b.is_error) continue;
          const chamada = chamadas.get(b.tool_use_id);
          if (!chamada) continue;
          const pedida = typeof chamada.entrada.status === "string" ? chamada.entrada.status : null;
          const tarefas = tarefasDoResultado(textoDoResultado(b.content));
          const comecam = tarefas.filter((t) => (t.situacao ?? pedida) === "doing").map((t) => t.ref);
          const param = tarefas.filter((t) => ["done", "todo"].includes(t.situacao ?? pedida ?? "")).map((t) => t.ref);
          if (comecam.length) mudancas.push({ instante, tipo: "comeca", refs: comecam });
          if (param.length) mudancas.push({ instante, tipo: "para", refs: param });
        }
      }
    }
  }

  // ── A tarefa de cada trecho, na ordem do tempo ──
  const porTempo = (/** @type {string} */ a, /** @type {string} */ b) => Date.parse(a) - Date.parse(b);
  mudancas.sort((a, b) => porTempo(a.instante, b.instante));
  commits.sort((a, b) => porTempo(a.instante, b.instante));
  const trechos = [...respostas.values()].sort((a, b) => porTempo(a.ocorreu_em, b.ocorreu_em) || a.ordem - b.ordem);

  /** @type {number[]} */
  const emDoing = [];
  let i = 0;
  for (const t of trechos) {
    while (i < mudancas.length && porTempo(mudancas[i].instante, t.ocorreu_em) <= 0) {
      const m = mudancas[i];
      for (const ref of m.refs) {
        const onde = emDoing.indexOf(ref);
        if (onde >= 0) emDoing.splice(onde, 1);
        if (m.tipo === "comeca") emDoing.push(ref);
      }
      i += 1;
    }
    if (emDoing.length) t.tarefa = emDoing[emDoing.length - 1];
    else t.tarefa = commits.find((c) => porTempo(c.instante, t.ocorreu_em) >= 0)?.ref ?? null;
  }

  return {
    sessao,
    trechos: trechos.map(({ ordem: _o, ...t }) => {
      void _o;
      return t;
    }),
  };
}

/**
 * Parte os trechos em lotes do tamanho que a rota aceita.
 * @template T
 * @param {T[]} itens
 * @param {number} tamanho
 * @returns {T[][]}
 */
export function emLotes(itens, tamanho) {
  const out = [];
  for (let k = 0; k < itens.length; k += tamanho) out.push(itens.slice(k, k + tamanho));
  return out;
}
