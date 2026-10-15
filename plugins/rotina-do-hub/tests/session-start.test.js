"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const SCRIPT = path.join(__dirname, "..", "scripts", "session-start.js");

test("session-start: entrega a rotina como contexto, sem o comentário de fonte", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { input: "{}", encoding: "utf8" });
  assert.equal(r.status, 0);

  const saida = JSON.parse(r.stdout);
  const h = saida.hookSpecificOutput;
  assert.equal(h.hookEventName, "SessionStart");
  assert.ok(h.additionalContext.includes("Rotina do agente no Valk Hub"));
  assert.ok(h.additionalContext.includes("mover_tarefa"));
  assert.ok(!h.additionalContext.includes("<!--"));
});
