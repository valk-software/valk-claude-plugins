#!/usr/bin/env node
// PostToolUse na ferramenta Agent: lembra a sessão principal de revisar o que
// um dos três subagentes do plugin devolveu.
//
// Por que aqui e não em SubagentStop: o additionalContext do SubagentStop vai
// para o PRÓPRIO subagente, que volta a rodar e para de novo, em laço. Medido
// em 2026-09-30 no Claude Code 2.1.285: 9 disparos para uma delegação ao
// explorer, o lembrete 18 vezes na transcrição do subagente e nenhuma na
// sessão principal.
//
// Só vale quando o subagente voltou (status "completed"). No lançamento em
// segundo plano o status é "async_launched" e ainda não há o que revisar.
//
// Só adiciona contexto. Nunca bloqueia: sai sempre com 0 e sem campo de decisão.

const NOSSOS = new Set([
  "fluxo-codificacao:explorer",
  "fluxo-codificacao:worker",
  "fluxo-codificacao:researcher"
]);

let raw = "";
let done = false;

function finish() {
  if (done) return;
  done = true;

  let agent = "";
  let status = "";
  try {
    const input = JSON.parse(raw) || {};
    agent = (input.tool_input || {}).subagent_type || "";
    status = (input.tool_response || {}).status || "";
  } catch {
    agent = "";
  }

  if (!NOSSOS.has(agent) || status !== "completed") {
    process.stdout.write("{}");
    return;
  }

  const context = [
    `O subagente ${agent} terminou. Antes de seguir:`,
    "",
    "- Confira se o resumo responde ao que foi pedido, e não a uma versão mais fácil da pergunta.",
    "- Verifique por conta própria as afirmações em que você vai se apoiar. Leia o arquivo citado, rode o teste, confira a fonte.",
    "- Trate o que voltou como material bruto. Não repasse como verificado o que você não conferiu.",
    "- Se o resultado não fecha, diga o que ficou em aberto em vez de completar a lacuna por dedução."
  ].join("\n");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: context
    }
  }));
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", finish);
process.stdin.on("error", finish);
setTimeout(finish, 1500);
