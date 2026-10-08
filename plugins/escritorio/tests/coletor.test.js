"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const c = require("../scripts/coletor.js");

const UUID = "123e4567-e89b-42d3-a456-426614174000";

// ------------------------------------------------------------ sanitizador

test("sanitizar: arquivos viram só o nome, com as duas barras", () => {
  assert.deepEqual(c.sanitizar("Read", { file_path: "C:\\Users\\ana\\segredo\\estado.ts" }), {
    tipo: "read",
    rotulo: "Lendo estado.ts"
  });
  assert.deepEqual(c.sanitizar("Edit", { file_path: "/home/ana/app/route.ts" }), { tipo: "edit", rotulo: "Editando route.ts" });
  assert.equal(c.sanitizar("MultiEdit", { file_path: "a/b/c.md" }).tipo, "edit");
  assert.deepEqual(c.sanitizar("Write", { file_path: "/x/y/novo.js" }), { tipo: "write", rotulo: "Escrevendo novo.js" });
  assert.equal(c.sanitizar("Read", {}).rotulo, "Lendo um arquivo");
});

test("sanitizar: busca, web, agentes, skills, planos, perguntas", () => {
  assert.deepEqual(c.sanitizar("Grep", { pattern: "senha=abc", path: "/x" }), { tipo: "search", rotulo: "Procurando no código" });
  assert.equal(c.sanitizar("Glob", { pattern: "**/*.env" }).rotulo, "Procurando no código");
  assert.deepEqual(c.sanitizar("WebFetch", { url: "https://api.exemplo.com/caminho/x?token=y" }), {
    tipo: "web",
    rotulo: "Lendo api.exemplo.com"
  });
  assert.deepEqual(c.sanitizar("WebSearch", { query: "meu segredo" }), { tipo: "web", rotulo: "Pesquisando na web" });
  assert.deepEqual(c.sanitizar("Agent", { subagent_type: "Explore", prompt: "texto longo" }), {
    tipo: "delegate",
    rotulo: "Chamando Explore"
  });
  assert.equal(c.sanitizar("Task", { subagent_type: "worker" }).rotulo, "Chamando worker");
  assert.deepEqual(c.sanitizar("Skill", { skill: "fluxo-de-codificacao", args: "x" }), {
    tipo: "skill",
    rotulo: "Usando a skill fluxo-de-codificacao"
  });
  for (const t of ["TodoWrite", "TaskCreate", "TaskUpdate"]) {
    assert.deepEqual(c.sanitizar(t, {}), { tipo: "plan", rotulo: "Organizando as tarefas" });
  }
  assert.deepEqual(c.sanitizar("AskUserQuestion", {}), { tipo: "ask", rotulo: "Fazendo uma pergunta" });
});

test("sanitizar: mcp e o resto", () => {
  assert.deepEqual(c.sanitizar("mcp__claude_ai_Valk_Hub__listar_tarefas", { x: 1 }), {
    tipo: "mcp",
    rotulo: "claude_ai_Valk_Hub: listar_tarefas"
  });
  assert.deepEqual(c.sanitizar("NotebookRead", {}), { tipo: "other", rotulo: "Usando NotebookRead" });
  assert.equal(c.sanitizar(undefined, undefined).tipo, "other");
});

test("sanitizar: Bash classifica pelo primeiro programa", () => {
  const b = (command) => c.sanitizar("Bash", { command });
  const teste = { tipo: "test", rotulo: "Rodando os testes" };
  for (const cmd of [
    "npm test",
    "npm run test:unit",
    "pnpm test -- --watch",
    "yarn test",
    "npx vitest run",
    "vitest",
    "jest --ci",
    "pytest -q",
    "python -m pytest",
    "node --test plugins/x",
    "go test ./...",
    "cargo test",
    "cd /repo && npm test",
    "CI=1 NODE_ENV=test npm test",
    'cd "C:/meu repo" && CI=1 vitest run'
  ]) {
    assert.deepEqual(b(cmd), teste, cmd);
  }
  assert.deepEqual(b("git status"), { tipo: "git", rotulo: "Git: status" });
  assert.deepEqual(b("git -C /x/y commit -m 'segredo'"), { tipo: "git", rotulo: "Git: commit" });
  assert.deepEqual(b("cd /r && git push origin main"), { tipo: "git", rotulo: "Git: push" });
  assert.deepEqual(b("npm run build"), { tipo: "run", rotulo: "Rodando o build" });
  assert.deepEqual(b("npm install"), { tipo: "run", rotulo: "Instalando dependências" });
  assert.deepEqual(b("pnpm i"), { tipo: "run", rotulo: "Instalando dependências" });
  assert.deepEqual(b("npm run lint"), { tipo: "run", rotulo: "Rodando o lint" });
  assert.deepEqual(b("npx eslint ."), { tipo: "run", rotulo: "Rodando o lint" });
  assert.deepEqual(b("npm run typecheck"), { tipo: "run", rotulo: "Checando os tipos" });
  assert.deepEqual(b("npx tsc --noEmit"), { tipo: "run", rotulo: "Checando os tipos" });
  assert.deepEqual(b("ls -la"), { tipo: "run", rotulo: "Rodando um comando" });
  assert.deepEqual(b(""), { tipo: "run", rotulo: "Rodando um comando" });
  assert.deepEqual(c.sanitizar("PowerShell", { command: "git log --oneline" }), { tipo: "git", rotulo: "Git: log" });
  assert.deepEqual(c.sanitizar("PowerShell", { command: "C:\\Program Files\\nodejs\\npm.cmd test" }).tipo, "run");
});

test("sanitizar: comando com segredo não vaza cabeçalho, token nem caminho", () => {
  const cmds = [
    'curl -H "Authorization: Bearer x" https://a.b/c?token=y',
    "API_KEY=sk-123 curl https://a.b/caminho/secreto?token=y",
    "git commit -m 'senha do banco é 1234'",
    "cd /home/ana/projeto-secreto && ./deploy.sh --token=abc"
  ];
  for (const cmd of cmds) {
    const r = c.sanitizar("Bash", { command: cmd });
    const json = JSON.stringify(r);
    for (const proibido of ["Authorization", "Bearer", "token", "a.b", "secreto", "sk-123", "1234", "senha", "ana", "abc"]) {
      assert.ok(!json.includes(proibido), `${cmd} vazou ${proibido}: ${json}`);
    }
  }
  assert.deepEqual(c.sanitizar("Bash", { command: cmds[0] }), { tipo: "run", rotulo: "Rodando um comando" });
});

test("sanitizar: subcomando git estranho não vaza e o rótulo é cortado em 140", () => {
  assert.deepEqual(c.sanitizar("Bash", { command: 'git "meu segredo"' }), { tipo: "git", rotulo: "Git" });
  const longo = c.sanitizar("Read", { file_path: "/x/" + "a".repeat(400) + ".ts" });
  assert.ok(longo.rotulo.length <= 140);
  assert.ok(c.sanitizar("Skill", { skill: "s".repeat(500) }).rotulo.length <= 140);
});

// ---------------------------------------------------------------- projeto

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "escritorio-"));
}

test("projeto: pasta com .git diretório, subindo de uma subpasta", () => {
  const raiz = tmp();
  const repo = path.join(raiz, "valk-hub");
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(path.join(repo, "src", "app"), { recursive: true });
  assert.equal(c.nomeDoProjeto(path.join(repo, "src", "app")), "valk-hub");
});

test("projeto: worktree com .git arquivo aponta para o repositório principal", () => {
  const raiz = tmp();
  const wt = path.join(raiz, "worktrees", "feature-x");
  fs.mkdirSync(wt, { recursive: true });
  fs.writeFileSync(path.join(wt, ".git"), "gitdir: C:/Repos/Valk/valk-hub/.git/worktrees/x\n");
  assert.equal(c.nomeDoProjeto(wt), "valk-hub");
  fs.writeFileSync(path.join(wt, ".git"), "gitdir: C:\\Repos\\Valk\\valk-hub\\.git\\worktrees\\x\r\n");
  assert.equal(c.nomeDoProjeto(wt), "valk-hub");
});

test("projeto: gitdir em barras Windows e variações", () => {
  assert.equal(c.projetoDoGitdir("C:\\Users\\ana\\orca\\valk-claude-plugins\\.git\\worktrees\\escritorio", "/w"), "valk-claude-plugins");
  assert.equal(c.projetoDoGitdir("/srv/repos/app.git/worktrees/x", "/w"), "app");
  assert.equal(c.projetoDoGitdir("../.git/modules/lib", "/w/lib"), "..");
  assert.equal(c.projetoDoGitdir("coisa-estranha", "/w/pasta-do-ponteiro"), "pasta-do-ponteiro");
});

test("projeto: sem git, usa o nome da pasta", () => {
  // Pasta que não existe, na raiz do disco: nenhum ancestral tem .git.
  const sem = path.join(path.parse(os.tmpdir()).root, "escritorio-inexistente", "minha-pasta");
  assert.equal(c.nomeDoProjeto(sem), "minha-pasta");
  assert.equal(c.nomeDoProjeto(""), "");
});

// ----------------------------------------------------- execucao_id (squad)

test("registrar_execucao: acha o id em objeto, string JSON e conteúdo MCP", () => {
  assert.equal(c.acharIdDaExecucao({ id: UUID }), UUID);
  assert.equal(c.acharIdDaExecucao({ execucao_id: UUID, id: "123e4567-e89b-42d3-a456-426614174999" }), UUID);
  assert.equal(c.acharIdDaExecucao(JSON.stringify({ execucao: { id: UUID, status: "aberta" } })), UUID);
  assert.equal(
    c.acharIdDaExecucao({ content: [{ type: "text", text: JSON.stringify({ ok: true, execucao_id: UUID }) }] }),
    UUID
  );
  assert.equal(c.acharIdDaExecucao([{ type: "text", text: `Execução aberta. "id": "${UUID}"` }]), UUID);
  assert.equal(c.acharIdDaExecucao({ id: "nao-e-uuid" }), null);
  assert.equal(c.acharIdDaExecucao(undefined), null);
});

// ------------------------------------------------------------------ corpo

const base = { session_id: "s1", cwd: "/nao/existe/valk-hub" };
const op = { instante: "2026-10-08T12:00:00.000Z", projeto: "valk-hub" };

test("corpo: um por evento", () => {
  const m = (hook, extra) => c.montarCorpo(hook, { ...base, ...extra }, op);
  const comum = { sessao: "s1", instante: op.instante, projeto: "valk-hub" };

  assert.deepEqual(m("SessionStart", { model: "claude-opus-5-5" }), { ...comum, evento: "inicio", modelo: "claude-opus-5-5" });
  assert.deepEqual(m("SessionStart", {}), { ...comum, evento: "inicio" });
  assert.deepEqual(m("UserPromptSubmit", { prompt: "segredo" }), {
    ...comum,
    evento: "prompt",
    atividade: { tipo: "prompt", rotulo: "Recebeu um pedido" }
  });
  assert.deepEqual(m("PreToolUse", { tool_name: "Read", tool_input: { file_path: "/a/b.ts" } }), {
    ...comum,
    evento: "ferramenta",
    atividade: { tipo: "read", rotulo: "Lendo b.ts" }
  });
  assert.deepEqual(
    m("PreToolUse", { tool_name: "Grep", tool_input: {}, agent_id: "ag1", agent_type: "Explore" }).subagente,
    { id: "ag1", tipo: "Explore" }
  );
  assert.deepEqual(m("Notification", { notification_type: "permission_prompt", message: "texto" }), {
    ...comum,
    evento: "precisa_de_voce",
    atividade: { tipo: "ask", rotulo: "Precisa de você" }
  });
  assert.equal(m("Notification", { notification_type: "idle_prompt" }), null);
  assert.deepEqual(m("Stop", {}), { ...comum, evento: "parou", atividade: { tipo: "done", rotulo: "Terminou a vez" } });
  assert.deepEqual(m("SubagentStart", { agent_id: "ag1", agent_type: "Explore" }), {
    ...comum,
    evento: "subagente_inicio",
    subagente: { id: "ag1", tipo: "Explore" }
  });
  assert.equal(m("SubagentStop", { agent_id: "ag1", agent_type: "Explore" }).evento, "subagente_fim");
  assert.equal(m("SubagentStop", {}), null);
  assert.deepEqual(m("SessionEnd", { reason: "exit" }), { ...comum, evento: "fim" });
  assert.equal(m("SessionStart", { session_id: "" }), null);
  assert.equal(m("Outro", {}), null);
});

test("corpo: só os campos do contrato, sem texto de prompt nem saída", () => {
  const corpo = c.montarCorpo(
    "PreToolUse",
    { ...base, prompt: "SEGREDO", tool_name: "Bash", tool_input: { command: "echo SEGREDO" }, tool_response: "SEGREDO" },
    op
  );
  assert.ok(!JSON.stringify(corpo).includes("SEGREDO"));
  const campos = ["sessao", "evento", "instante", "projeto", "atividade", "subagente", "execucao_id", "modelo"];
  for (const k of Object.keys(corpo)) assert.ok(campos.includes(k), k);
});

test("corpo: PostToolUse só na chamada que abre a execução", () => {
  const m = (extra) =>
    c.montarCorpo("PostToolUse", { ...base, tool_name: "mcp__claude_ai_Valk_Squads__registrar_execucao", ...extra }, op);
  const resposta = { content: [{ type: "text", text: JSON.stringify({ id: UUID }) }] };
  const aberta = m({ tool_input: { squad: "x", status: "rodando" }, tool_response: resposta });
  assert.equal(aberta.evento, "execucao");
  assert.equal(aberta.execucao_id, UUID);
  assert.equal(m({ tool_input: { id: UUID, status: "concluida" }, tool_response: resposta }), null);
  assert.equal(m({ tool_input: { execucao_id: UUID }, tool_response: resposta }), null);
  assert.equal(m({ tool_input: {}, tool_response: "sem id" }), null);
  assert.equal(
    c.montarCorpo("PostToolUse", { ...base, tool_name: "mcp__x__outra", tool_input: {}, tool_response: resposta }, op),
    null
  );
});

// -------------------------------------------------------------- rodar/rede

function ambiente(extra) {
  return { CLAUDE_PLUGIN_DATA: tmp(), ...extra };
}

test("rodar: sem chave não toca na rede nem no disco", async () => {
  let chamadas = 0;
  const dados = tmp();
  const r = await c.rodar(["SessionStart"], JSON.stringify(base), { CLAUDE_PLUGIN_DATA: dados }, () => {
    chamadas++;
  });
  assert.equal(r.motivo, "sem_chave");
  assert.equal(chamadas, 0);
  assert.deepEqual(fs.readdirSync(dados), []);
  const r2 = await c.rodar(["Stop"], "{}", { CLAUDE_PLUGIN_OPTION_CHAVE: "   " }, () => chamadas++);
  assert.equal(r2.motivo, "sem_chave");
  assert.equal(chamadas, 0);
});

test("rodar: manda o POST com cabeçalhos, URL e corpo certos", async () => {
  const pedidos = [];
  const fetchFalso = async (url, init) => {
    pedidos.push({ url, init });
    return { ok: true, status: 204 };
  };
  const env = ambiente({ CLAUDE_PLUGIN_OPTION_CHAVE: "valk_coletor_abc", CLAUDE_PLUGIN_OPTION_HUB_URL: "https://hub.exemplo.com/" });
  const r = await c.rodar(["Stop"], JSON.stringify({ session_id: "s9", cwd: tmp() }), env, fetchFalso);
  assert.equal(r.enviado, true);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, "https://hub.exemplo.com/api/escritorio/coletor");
  assert.equal(pedidos[0].init.method, "POST");
  assert.equal(pedidos[0].init.headers.Authorization, "Bearer valk_coletor_abc");
  assert.equal(pedidos[0].init.headers["Content-Type"], "application/json");
  assert.ok(pedidos[0].init.signal instanceof AbortSignal);
  const corpo = JSON.parse(pedidos[0].init.body);
  assert.equal(corpo.sessao, "s9");
  assert.equal(corpo.evento, "parou");
  assert.ok(!Number.isNaN(Date.parse(corpo.instante)));
});

test("rodar: URL padrão, erro de rede e HTTP ruim saem calados", async () => {
  const env = ambiente({ CLAUDE_PLUGIN_OPTION_CHAVE: "k" });
  let url = "";
  await c.rodar(["Stop"], JSON.stringify({ session_id: "s" }), env, async (u) => {
    url = u;
    return { ok: true };
  });
  assert.equal(url, "https://hub.valkbr.com/api/escritorio/coletor");

  const r1 = await c.rodar(["Stop"], JSON.stringify({ session_id: "s" }), env, async () => {
    throw new Error("rede caiu");
  });
  assert.equal(r1.motivo, "erro");
  const r2 = await c.rodar(["Stop"], JSON.stringify({ session_id: "s" }), env, async () => ({ ok: false, status: 401 }));
  assert.equal(r2.motivo, "http_401");
  const r3 = await c.rodar(["Stop"], "isso não é json", env, async () => ({ ok: true }));
  assert.equal(r3.motivo, "entrada_invalida");
  const log = fs.readFileSync(path.join(env.CLAUDE_PLUGIN_DATA, "coletor.log"), "utf8");
  assert.ok(log.includes("rede caiu") && log.includes("HTTP 401"));
  assert.ok(!log.includes("Bearer"));
});

test("rodar: throttle só em ferramenta repetida, e só dentro de 1,5 s", async () => {
  const env = ambiente({ CLAUDE_PLUGIN_OPTION_CHAVE: "k" });
  let n = 0;
  const f = async () => {
    n++;
    return { ok: true };
  };
  const ler = (file) => JSON.stringify({ session_id: "t1", tool_name: "Read", tool_input: { file_path: file } });

  assert.equal((await c.rodar(["PreToolUse"], ler("/a/x.ts"), env, f)).enviado, true);
  assert.equal((await c.rodar(["PreToolUse"], ler("/a/x.ts"), env, f)).motivo, "throttle");
  assert.equal((await c.rodar(["PreToolUse"], ler("/a/y.ts"), env, f)).enviado, true); // rótulo diferente
  assert.equal(n, 2);

  // outros eventos nunca sofrem throttle
  for (let i = 0; i < 3; i++) {
    assert.equal((await c.rodar(["Stop"], JSON.stringify({ session_id: "t1" }), env, f)).enviado, true);
  }
  assert.equal(n, 5);

  // outra sessão não é afetada
  const outra = JSON.stringify({ session_id: "t2", tool_name: "Read", tool_input: { file_path: "/a/y.ts" } });
  assert.equal((await c.rodar(["PreToolUse"], outra, env, f)).enviado, true);

  // passada a janela, manda de novo
  const corpo = { sessao: "t3", atividade: { tipo: "read", rotulo: "Lendo z" } };
  assert.equal(c.throttled(env, corpo, 1000), false);
  assert.equal(c.throttled(env, corpo, 1500), true);
  assert.equal(c.throttled(env, corpo, 2600), false);
});
