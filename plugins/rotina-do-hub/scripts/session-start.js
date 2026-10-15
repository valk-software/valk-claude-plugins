#!/usr/bin/env node
// SessionStart: entrega à sessão a rotina do agente no Valk Hub, lida de
// rotina.md (ao lado deste script, em ../rotina.md).
//
// O texto vem de valk-hub/docs/rotina-do-agente-no-hub.md. A primeira linha do
// arquivo é um comentário HTML com a fonte; ela sai antes de enviar.
//
// Se rotina.md não puder ser lido, não escreve nada: melhor calar do que
// entregar um contexto quebrado.
//
// Só adiciona contexto. Nunca bloqueia: sai sempre com 0 e sem campo de decisão.

const fs = require("fs");
const path = require("path");

const PREFIXO = "Siga a rotina abaixo em toda sessão de desenvolvimento (vem do plugin rotina-do-hub da VALK):";

let done = false;

function finish() {
  if (done) return;
  done = true;

  try {
    const bruto = fs.readFileSync(path.join(__dirname, "..", "rotina.md"), "utf8");
    const texto = bruto.replace(/^\s*<!--[\s\S]*?-->[ \t]*\r?\n?/, "").trim();
    if (!texto) return;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `${PREFIXO}\n\n${texto}`
      }
    }));
  } catch {
    // Sem arquivo, sem contexto. A sessão segue normal.
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", () => {});
process.stdin.on("end", finish);
process.stdin.on("error", finish);
setTimeout(finish, 1500);
