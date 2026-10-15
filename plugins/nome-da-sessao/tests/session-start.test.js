"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");
const { decidir } = require("../scripts/session-start.js");

const SCRIPT = path.join(__dirname, "..", "scripts", "session-start.js");
// 15/10/2026 às 17h20 em Brasília.
const AGORA = new Date("2026-10-15T20:20:00Z");
const NOVA = { source: "startup", cwd: "/home/felipe/valk-hub" };

test("sessão aberta por uma pessoa vira [Principal], com a pasta e a hora de Brasília", () => {
  const s = decidir(NOVA, {}, AGORA);
  assert.equal(s.sessionTitle, "[Principal] valk-hub · 15/10 17h20");
  assert.match(s.additionalContext, /\[Secundária\] <assunto> · de/);
});

test("nome dado com -n ganha o prefixo e não é trocado", () => {
  const s = decidir({ ...NOVA, session_title: "Central de IA" }, {}, AGORA);
  assert.equal(s.sessionTitle, "[Principal] Central de IA");
});

test("sessão aberta por outra vira [Secundária] com o nome do pai, sem o prefixo dele", () => {
  const env = { CLAUDE_CODE_CHILD_SESSION: "1", VALK_SESSAO_PAI: "[Principal] Central de IA" };
  const s = decidir({ ...NOVA, session_title: "Radar de aplicações" }, env, AGORA);
  assert.equal(s.sessionTitle, "[Secundária] Radar de aplicações · de Central de IA");
});

test("filha sem o nome do pai ainda é [Secundária]", () => {
  const s = decidir(NOVA, { CLAUDE_CODE_CHILD_SESSION: "1" }, AGORA);
  assert.equal(s.sessionTitle, "[Secundária] valk-hub · 15/10 17h20");
});

test("nome que já está no padrão fica como está", () => {
  const s = decidir({ ...NOVA, session_title: "[Secundária] Reel · de Central" }, { CLAUDE_CODE_CHILD_SESSION: "1" }, AGORA);
  assert.equal(s.sessionTitle, undefined);
});

test("retomar, limpar e compactar não mexem no nome", () => {
  for (const source of ["resume", "clear", "compact"]) {
    assert.equal(decidir({ ...NOVA, source }, {}, AGORA).sessionTitle, undefined);
  }
});

test("na nuvem o gancho não nomeia: entrega a regra para o Claude nomear", () => {
  const s = decidir(NOVA, { CLAUDE_CODE_REMOTE: "true" }, AGORA);
  assert.equal(s.sessionTitle, undefined);
  assert.match(s.additionalContext, /set_session_title/);
  assert.match(s.additionalContext, /parent_session_id/);
});

test("o script roda de ponta a ponta e devolve JSON válido, mesmo com entrada quebrada", () => {
  for (const input of [JSON.stringify(NOVA), "não é json"]) {
    const r = spawnSync(process.execPath, [SCRIPT], { input, encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(r.status, 0);
    const h = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(h.hookEventName, "SessionStart");
    assert.ok(h.sessionTitle.startsWith("[Principal] "));
  }
});
