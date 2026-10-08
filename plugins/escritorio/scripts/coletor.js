#!/usr/bin/env node
// Coletor do escritório: recebe o evento do hook pelo stdin, limpa TUDO no
// computador e manda só o estado e um rótulo curto ao Valk Hub.
//
// Nunca sai do computador: texto do prompt, comando inteiro, caminho completo,
// consulta de busca, URL completa, conteúdo de arquivo, entrada ou saída de
// ferramenta. Nunca bloqueia: sai sempre com 0 e não escreve nada no stdout.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MAX_ROTULO = 140;
const JANELA_THROTTLE_MS = 1500;
const LOG_MAX_BYTES = 200 * 1024;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const EVENTOS = {
  SessionStart: "inicio",
  UserPromptSubmit: "prompt",
  PreToolUse: "ferramenta",
  Notification: "precisa_de_voce",
  Stop: "parou",
  SubagentStart: "subagente_inicio",
  SubagentStop: "subagente_fim",
  PostToolUse: "execucao",
  SessionEnd: "fim"
};

const NOTIFICACOES = ["permission_prompt", "elicitation_dialog", "agent_needs_input"];

// ---------------------------------------------------------------- texto

function limpar(texto) {
  return String(texto == null ? "" : texto)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cortar(texto, max) {
  const t = limpar(texto);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// Só o nome, com as duas barras.
function nomeDoArquivo(caminho) {
  const partes = limpar(caminho).split(/[\\/]/).filter(Boolean);
  return partes.length ? partes[partes.length - 1] : "";
}

function dominio(url) {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return "";
  }
}

// ------------------------------------------------------- classificar shell

const RE_ENV = /^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+/;
const RE_CD = /^(?:cd|pushd|Set-Location|sl)\s+(?:"[^"]*"|'[^']*'|[^&;|\s]+)\s*(?:&&|;)\s*/i;

// Tira `FOO=bar` e `cd x &&` do começo, quantas vezes houver.
function inicioDoComando(comando) {
  let c = limpar(comando);
  for (let i = 0; i < 10; i++) {
    const antes = c;
    c = c.replace(RE_ENV, "").replace(RE_CD, "");
    if (c === antes) break;
  }
  return c;
}

function programa(palavra) {
  return nomeDoArquivo(palavra).replace(/\.(exe|cmd|bat|ps1)$/i, "").toLowerCase();
}

const TESTE = { tipo: "test", rotulo: "Rodando os testes" };
const BUILD = { tipo: "run", rotulo: "Rodando o build" };
const LINT = { tipo: "run", rotulo: "Rodando o lint" };
const TIPOS = { tipo: "run", rotulo: "Checando os tipos" };
const INSTALAR = { tipo: "run", rotulo: "Instalando dependências" };
const OUTRO = { tipo: "run", rotulo: "Rodando um comando" };

function classificarShell(comando) {
  const c = inicioDoComando(comando);
  const palavras = c.split(/\s+/).filter(Boolean);
  const prog = programa(palavras[0] || "");
  const resto = palavras.slice(1).map((p) => p.toLowerCase());
  if (!prog) return OUTRO;

  if (prog === "git") {
    // pula opções (-C dir, -c k=v, --no-pager) até o subcomando
    let i = 0;
    while (i < resto.length && resto[i].startsWith("-")) {
      i += resto[i] === "-c" || resto[i] === "-C" ? 2 : 1;
    }
    const sub = resto[i] || "";
    return /^[a-z][a-z-]{0,29}$/.test(sub) ? { tipo: "git", rotulo: "Git: " + sub } : { tipo: "git", rotulo: "Git" };
  }

  if (["vitest", "jest", "pytest", "mocha", "phpunit", "rspec"].includes(prog)) return TESTE;
  if (prog === "node" && resto.includes("--test")) return TESTE;
  if (["go", "cargo", "dotnet", "deno", "bun"].includes(prog) && resto[0] === "test") return TESTE;
  if (["python", "python3", "py"].includes(prog) && resto[0] === "-m" && ["pytest", "unittest"].includes(resto[1])) {
    return TESTE;
  }

  // Gerenciadores de pacote: o que importa é o script, não o gerenciador.
  let acao = prog;
  if (["npm", "pnpm", "yarn", "bun"].includes(prog)) {
    const i = resto[0] === "run" || resto[0] === "run-script" ? 1 : 0;
    acao = resto[i] || "";
    if (["install", "i", "ci", "add"].includes(acao) && i === 0) return INSTALAR;
  } else if (["npx", "pnpx", "bunx"].includes(prog)) {
    acao = programa(resto.find((p) => !p.startsWith("-")) || "");
    if (["vitest", "jest", "playwright", "mocha"].includes(acao)) return TESTE;
  }

  if (acao === "test" || acao === "t" || acao.startsWith("test:") || acao.startsWith("test-")) return TESTE;
  if (acao === "tsc" || /^(typecheck|type-check|check-types)/.test(acao)) return TIPOS;
  if (/^(lint|eslint|prettier|format|biome)/.test(acao)) return LINT;
  if (/^(build|compile|bundle|vite|webpack|esbuild|make)/.test(acao)) return BUILD;
  return OUTRO;
}

// -------------------------------------------------------------- sanitizador

// tool_name + tool_input -> { tipo, rotulo }. Nunca devolve comando, caminho
// completo, consulta ou URL: só nome de arquivo, domínio e nomes de ferramenta.
function sanitizar(toolName, toolInput) {
  const nome = limpar(toolName);
  const entrada = toolInput && typeof toolInput === "object" ? toolInput : {};
  const arquivo = nomeDoArquivo(entrada.file_path || entrada.notebook_path || "");
  let r;

  switch (nome) {
    case "Read":
      r = { tipo: "read", rotulo: arquivo ? "Lendo " + arquivo : "Lendo um arquivo" };
      break;
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      r = { tipo: "edit", rotulo: arquivo ? "Editando " + arquivo : "Editando um arquivo" };
      break;
    case "Write":
      r = { tipo: "write", rotulo: arquivo ? "Escrevendo " + arquivo : "Escrevendo um arquivo" };
      break;
    case "Grep":
    case "Glob":
      r = { tipo: "search", rotulo: "Procurando no código" };
      break;
    case "Bash":
    case "PowerShell":
      r = classificarShell(entrada.command);
      break;
    case "WebFetch": {
      const d = dominio(entrada.url);
      r = { tipo: "web", rotulo: d ? "Lendo " + d : "Lendo uma página" };
      break;
    }
    case "WebSearch":
      r = { tipo: "web", rotulo: "Pesquisando na web" };
      break;
    case "Agent":
    case "Task": {
      const t = limpar(entrada.subagent_type);
      r = { tipo: "delegate", rotulo: t ? "Chamando " + t : "Chamando um subagente" };
      break;
    }
    case "Skill": {
      const s = limpar(entrada.skill || entrada.name);
      r = { tipo: "skill", rotulo: s ? "Usando a skill " + s : "Usando uma skill" };
      break;
    }
    case "TodoWrite":
    case "TaskCreate":
    case "TaskUpdate":
      r = { tipo: "plan", rotulo: "Organizando as tarefas" };
      break;
    case "AskUserQuestion":
      r = { tipo: "ask", rotulo: "Fazendo uma pergunta" };
      break;
    default: {
      const m = /^mcp__(.+?)__(.+)$/.exec(nome);
      r = m
        ? { tipo: "mcp", rotulo: m[1] + ": " + m[2] }
        : { tipo: "other", rotulo: "Usando " + (nome || "uma ferramenta") };
    }
  }
  return { tipo: r.tipo, rotulo: cortar(r.rotulo, MAX_ROTULO) };
}

// ------------------------------------------------------------------ projeto

// gitdir de worktree/submódulo -> nome do repositório principal.
function projetoDoGitdir(gitdir, pastaDoPonteiro) {
  const partes = limpar(gitdir).split(/[\\/]/).filter(Boolean);
  let i = partes.lastIndexOf(".git");
  if (i > 0) return partes[i - 1];
  i = Math.max(partes.lastIndexOf("worktrees"), partes.lastIndexOf("modules"));
  if (i > 0) return partes[i - 1].replace(/\.git$/, "");
  return nomeDoArquivo(pastaDoPonteiro);
}

function nomeDoProjeto(cwd) {
  const base = String(cwd || "");
  if (!base) return "";
  try {
    let dir = path.resolve(base);
    for (let i = 0; i < 64; i++) {
      const g = path.join(dir, ".git");
      let st = null;
      try {
        st = fs.statSync(g);
      } catch {
        st = null;
      }
      if (st && st.isDirectory()) return nomeDoArquivo(dir);
      if (st && st.isFile()) {
        const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(g, "utf8"));
        return m ? projetoDoGitdir(m[1], dir) : nomeDoArquivo(dir);
      }
      const pai = path.dirname(dir);
      if (pai === dir) break;
      dir = pai;
    }
  } catch {
    // cai no nome da pasta
  }
  return nomeDoArquivo(base);
}

// ---------------------------------------------------------- execução (squad)

// Acha o id da execução na resposta de registrar_execucao: objeto, string JSON
// ou lista de conteúdo MCP com texto em JSON. Prefere `execucao_id` a `id`.
function acharIdDaExecucao(resposta) {
  const achados = { execucao_id: null, id: null };
  const visitados = new Set();

  function ver(valor, fundo) {
    if (fundo > 8 || valor == null) return;
    if (typeof valor === "string") {
      const t = valor.trim();
      if (t.startsWith("{") || t.startsWith("[")) {
        try {
          ver(JSON.parse(t), fundo + 1);
          return;
        } catch {
          // texto solto: tenta o padrão "id": "uuid"
        }
      }
      const m = /"?(execucao_id|id)"?\s*[:=]\s*"?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(t);
      if (m && !achados[m[1].toLowerCase()]) achados[m[1].toLowerCase()] = m[2];
      return;
    }
    if (typeof valor !== "object" || visitados.has(valor)) return;
    visitados.add(valor);
    if (Array.isArray(valor)) {
      for (const v of valor) ver(v, fundo + 1);
      return;
    }
    for (const chave of ["execucao_id", "id"]) {
      const v = valor[chave];
      if (typeof v === "string" && UUID.test(v) && !achados[chave]) achados[chave] = v.match(UUID)[0];
    }
    for (const v of Object.values(valor)) {
      if (v && (typeof v === "object" || typeof v === "string")) ver(v, fundo + 1);
    }
  }

  ver(resposta, 0);
  return achados.execucao_id || achados.id || null;
}

// -------------------------------------------------------------------- corpo

// Monta o corpo do POST. Devolve null quando o evento não deve ser enviado.
function montarCorpo(nomeDoHook, entrada, opcoes) {
  const o = opcoes || {};
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const hook = nomeDoHook || e.hook_event_name;
  const evento = EVENTOS[hook];
  const sessao = limpar(e.session_id).slice(0, 100);
  if (!evento || !sessao) return null;

  const corpo = {
    sessao,
    evento,
    instante: o.instante || new Date().toISOString()
  };
  const projeto = o.projeto !== undefined ? o.projeto : nomeDoProjeto(e.cwd || process.cwd());
  if (projeto) corpo.projeto = cortar(projeto, 80);

  const agente = limpar(e.agent_id)
    ? { id: limpar(e.agent_id).slice(0, 100), tipo: cortar(e.agent_type || "agente", 60) }
    : null;

  switch (hook) {
    case "SessionStart":
      if (limpar(e.model)) corpo.modelo = cortar(e.model, 60);
      break;
    case "UserPromptSubmit":
      corpo.atividade = { tipo: "prompt", rotulo: "Recebeu um pedido" };
      break;
    case "PreToolUse":
      if (limpar(e.tool_name) === "AskUserQuestion") {
        // Uma pergunta ao usuário é a mão levantada, não só uma ferramenta.
        corpo.evento = "precisa_de_voce";
        corpo.atividade = { tipo: "ask", rotulo: "Fazendo uma pergunta" };
        break;
      }
      corpo.atividade = sanitizar(e.tool_name, e.tool_input);
      if (agente) corpo.subagente = agente;
      break;
    case "Notification": {
      const t = limpar(e.notification_type);
      if (t && !NOTIFICACOES.includes(t)) return null;
      corpo.atividade = { tipo: "ask", rotulo: "Precisa de você" };
      break;
    }
    case "Stop":
      corpo.atividade = { tipo: "done", rotulo: "Terminou a vez" };
      break;
    case "SubagentStart":
    case "SubagentStop":
      if (!agente) return null;
      corpo.subagente = agente;
      break;
    case "PostToolUse": {
      if (!/^mcp__.*registrar_execucao$/.test(limpar(e.tool_name))) return null;
      const ent = e.tool_input && typeof e.tool_input === "object" ? e.tool_input : {};
      if (ent.id != null || ent.execucao_id != null) return null;
      const id = acharIdDaExecucao(e.tool_response);
      if (!id) return null;
      corpo.execucao_id = id;
      break;
    }
    default:
      break;
  }
  return corpo;
}

// ----------------------------------------------------------------- estado

function pastaDeDados(env) {
  return env.CLAUDE_PLUGIN_DATA || os.tmpdir();
}

// true quando o mesmo `ferramenta` (tipo+rotulo) saiu há menos de 1,5 s.
function throttled(env, corpo, agora) {
  try {
    const h = crypto.createHash("sha1").update(corpo.sessao).digest("hex").slice(0, 16);
    const arq = path.join(pastaDeDados(env), "escritorio-" + h + ".json");
    const chave = corpo.atividade.tipo + "|" + corpo.atividade.rotulo + "|" + (corpo.subagente ? corpo.subagente.id : "");
    let ant = null;
    try {
      ant = JSON.parse(fs.readFileSync(arq, "utf8"));
    } catch {
      ant = null;
    }
    if (ant && ant.chave === chave && agora - ant.em >= 0 && agora - ant.em < JANELA_THROTTLE_MS) return true;
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, JSON.stringify({ chave, em: agora }));
  } catch {
    // melhor mandar de novo do que travar
  }
  return false;
}

// A "mão levantada": existe enquanto o último aviso da sessão foi precisa_de_voce.
function arquivoDaMao(env, sessao) {
  const h = crypto.createHash("sha1").update(sessao).digest("hex").slice(0, 16);
  return path.join(pastaDeDados(env), "escritorio-" + h + ".mao");
}

function levantarMao(env, sessao) {
  try {
    const arq = arquivoDaMao(env, sessao);
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, "1");
  } catch {
    // sem estado, o próximo PreToolUse ainda devolve a sessão a "trabalhando"
  }
}

// Abaixa a mão; true se ela estava levantada.
function baixarMao(env, sessao) {
  try {
    fs.unlinkSync(arquivoDaMao(env, sessao));
    return true;
  } catch {
    return false;
  }
}

function registrar(env, linha) {
  try {
    if (!env.CLAUDE_PLUGIN_DATA) return;
    fs.mkdirSync(env.CLAUDE_PLUGIN_DATA, { recursive: true });
    const arq = path.join(env.CLAUDE_PLUGIN_DATA, "coletor.log");
    let tamanho = 0;
    try {
      tamanho = fs.statSync(arq).size;
    } catch {
      tamanho = 0;
    }
    if (tamanho > LOG_MAX_BYTES) fs.writeFileSync(arq, "");
    fs.appendFileSync(arq, new Date().toISOString() + " " + cortar(linha, 200) + "\n");
  } catch {
    // o log é um luxo
  }
}

// ---------------------------------------------------------------- execução

// Roda o coletor inteiro. Nunca lança; devolve o que fez (para os testes).
async function rodar(argv, stdin, env, fetchImpl) {
  const instante = new Date().toISOString();
  try {
    const chave = limpar(env.CLAUDE_PLUGIN_OPTION_CHAVE);
    if (!chave) return { enviado: false, motivo: "sem_chave" };

    let entrada;
    try {
      entrada = JSON.parse(stdin || "{}");
    } catch {
      return { enviado: false, motivo: "entrada_invalida" };
    }

    const hook = argv[0] || (entrada && entrada.hook_event_name);
    const sessao = limpar(entrada && entrada.session_id).slice(0, 100);
    const base = (limpar(env.CLAUDE_PLUGIN_OPTION_HUB_URL) || "https://hub.valkbr.com").replace(/[/]+$/, "");

    async function enviar(corpo) {
      const resp = await fetchImpl(base + "/api/escritorio/coletor", {
        method: "POST",
        headers: { Authorization: "Bearer " + chave, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(corpo.evento === "fim" ? 1500 : 4000)
      });
      if (!resp.ok) registrar(env, corpo.evento + " -> HTTP " + resp.status);
      return resp.ok;
    }

    if (hook === "PostToolUse") {
      // Ferramenta terminou: se a mão estava levantada, avisa que voltou a trabalhar.
      const retomada = sessao && baixarMao(env, sessao);
      const execucao = montarCorpo(hook, entrada, { instante });
      if (!retomada && !execucao) return { enviado: false, motivo: "ignorado" };
      let ultimo = null;
      if (retomada) {
        // Sem atividade: o hub só move a sessão para "trabalhando".
        const corpo = { sessao, evento: "ferramenta", instante };
        const projeto = nomeDoProjeto(entrada.cwd || process.cwd());
        if (projeto) corpo.projeto = cortar(projeto, 80);
        ultimo = { enviado: await enviar(corpo), corpo };
      }
      if (execucao) ultimo = { enviado: await enviar(execucao), corpo: execucao };
      return ultimo;
    }

    const corpo = montarCorpo(hook, entrada, { instante });
    if (!corpo) return { enviado: false, motivo: "ignorado" };

    if (["prompt", "parou", "fim"].includes(corpo.evento)) baixarMao(env, corpo.sessao);
    if (corpo.evento === "ferramenta" && throttled(env, corpo, Date.parse(instante))) {
      return { enviado: false, motivo: "throttle" };
    }
    if (corpo.evento === "precisa_de_voce") levantarMao(env, corpo.sessao);

    const ok = await enviar(corpo);
    return ok ? { enviado: true, corpo } : { enviado: false, motivo: "http", corpo };
  } catch (erro) {
    registrar(env, "erro: " + (erro && erro.message));
    return { enviado: false, motivo: "erro" };
  }
}

function lerStdin() {
  return new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", () => resolve(raw));
  });
}

module.exports = {
  sanitizar,
  classificarShell,
  nomeDoProjeto,
  projetoDoGitdir,
  acharIdDaExecucao,
  montarCorpo,
  throttled,
  rodar
};

if (require.main === module) {
  lerStdin()
    .then((raw) => rodar(process.argv.slice(2), raw, process.env, fetch))
    .catch(() => {})
    .finally(() => process.exit(0));
}
