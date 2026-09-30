#!/usr/bin/env node
// SessionStart: lembra a sessão de seguir a skill fluxo-de-codificacao e, se a
// entrada trouxer o modelo e ele não for Opus 5.5, pede para avisar o usuário.
//
// O campo `model` pode faltar (depois de /clear, por exemplo). Sem ele, não há
// aviso: melhor calar do que acusar um modelo que não foi informado.
//
// Só adiciona contexto. Nunca bloqueia: sai sempre com 0 e sem campo de decisão.

const ESPERADO = "claude-opus-5-5";

let raw = "";
let done = false;

function finish() {
  if (done) return;
  done = true;

  let model = "";
  try {
    model = (JSON.parse(raw) || {}).model || "";
  } catch {
    model = "";
  }

  const linhas = [
    "Siga a skill fluxo-de-codificacao do plugin fluxo-codificacao em qualquer tarefa de código:",
    "planeje, delegue a fluxo-codificacao:explorer, :worker e :researcher, revise o que voltar",
    "e consulte o advisor antes do plano, no erro repetido e antes de concluir."
  ];

  if (model && !model.startsWith(ESPERADO)) {
    linhas.push(
      "",
      `Atenção: esta sessão está em ${model}, e o fluxo pede Opus 5.5 com esforço high.`,
      "Na primeira resposta, avise o usuário e peça para trocar com /model claude-opus-5-5 e /effort high."
    );
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: linhas.join("\n")
    }
  }));
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", finish);
process.stdin.on("error", finish);
setTimeout(finish, 1500);
