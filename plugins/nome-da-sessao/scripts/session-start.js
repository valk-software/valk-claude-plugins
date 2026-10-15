#!/usr/bin/env node
// SessionStart: dá à sessão o nome no padrão da VALK.
//
//   [Principal] <assunto>                  a sessão que uma pessoa abriu
//   [Secundária] <assunto> · de <pai>      a sessão aberta por outra sessão
//
// O que este gancho consegue saber sozinho, e o que não consegue:
//
// - Sessão aberta por outra no mesmo computador (pelo Bash, com `claude`) nasce
//   com CLAUDE_CODE_CHILD_SESSION=1. Quem abre pode mandar o nome do pai em
//   VALK_SESSAO_PAI, ou já dar o nome inteiro com `claude -n`.
// - Sessão na nuvem criada por outra (create_session) NÃO herda variável
//   nenhuma do pai. Quem sabe disso é o próprio Claude, pela ferramenta
//   get_session, que devolve parent_session_id. Por isso, na nuvem, o gancho
//   não dá nome: ele entrega a regra como contexto e o Claude nomeia com
//   set_session_title, já sabendo o assunto.
// - No começo da sessão ainda não há pedido, então o assunto que o gancho
//   conhece é a pasta do projeto e a hora. Nome dado com `-n` ou /rename vale
//   mais: o gancho só põe o prefixo na frente dele.
//
// Só adiciona contexto e nome. Nunca bloqueia: sai sempre com 0.

const path = require("path");

const PRINCIPAL = "[Principal]";
const SECUNDARIA = "[Secundária]";

const REGRA = [
  "Nome da sessão no padrão da VALK (plugin nome-da-sessao):",
  `- ${PRINCIPAL} <assunto> para a sessão que uma pessoa abriu e que orquestra e delega.`,
  `- ${SECUNDARIA} <assunto> · de <nome da sessão pai, sem o prefixo> para a sessão aberta por outra.`,
  "- Assunto em português de gente, curto: o que a sessão resolve, e não o nome de arquivo ou de ferramenta.",
  `- Ao criar sessão com create_session, passe title já no padrão ${SECUNDARIA}, com o nome desta sessão depois de "de".`,
  `- Ao abrir uma sessão local pelo terminal, use claude -n "${SECUNDARIA} <assunto> · de <esta sessão>".`
];

const REGRA_NUVEM = [
  "Esta sessão está na nuvem, e quem dá o nome é você. Assim que entender o primeiro pedido:",
  "chame get_session sem session_id. Se vier parent_session_id, a sessão é secundária: leia o",
  "nome do pai com get_session(parent_session_id). Depois chame set_session_title com o nome no",
  "padrão. Se o nome já começar com o prefixo certo, não troque."
];

function temPrefixo(titulo) {
  return titulo.startsWith(PRINCIPAL) || titulo.startsWith(SECUNDARIA);
}

function horaDeBrasilia(agora) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(agora);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}h${p.minute}`;
}

// Decide o que o gancho devolve. Pura, para o teste chamar direto.
function decidir(entrada, env, agora) {
  const fonte = entrada.source || "startup";
  const tituloAtual = (entrada.session_title || "").trim();
  const naNuvem = env.CLAUDE_CODE_REMOTE === "true";
  const filha = env.CLAUDE_CODE_CHILD_SESSION === "1";
  const pai = (env.VALK_SESSAO_PAI || "").trim();

  const contexto = naNuvem ? [...REGRA, "", ...REGRA_NUVEM] : REGRA;
  const saida = { hookEventName: "SessionStart", additionalContext: contexto.join("\n") };

  // Retomar, limpar e compactar continuam a mesma sessão: o nome fica.
  // Na nuvem, o nome é do Claude, que sabe o assunto e o pai.
  if (fonte !== "startup" || naNuvem) return saida;
  if (tituloAtual && temPrefixo(tituloAtual)) return saida;

  const pasta = path.basename(entrada.cwd || "") || "sessão";
  const assunto = tituloAtual || `${pasta} · ${horaDeBrasilia(agora)}`;

  if (filha) {
    const de = pai.replace(/^\[(Principal|Secundária)\]\s*/, "");
    saida.sessionTitle = de ? `${SECUNDARIA} ${assunto} · de ${de}` : `${SECUNDARIA} ${assunto}`;
  } else {
    saida.sessionTitle = `${PRINCIPAL} ${assunto}`;
  }
  return saida;
}

module.exports = { decidir, horaDeBrasilia };

if (require.main === module) {
  let raw = "";
  let feito = false;

  const terminar = () => {
    if (feito) return;
    feito = true;
    let entrada = {};
    try {
      entrada = JSON.parse(raw) || {};
    } catch {
      entrada = {};
    }
    try {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: decidir(entrada, process.env, new Date()) }));
    } catch {
      // Se algo der errado, a sessão segue sem nome novo.
    }
  };

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { raw += c; });
  process.stdin.on("end", terminar);
  process.stdin.on("error", terminar);
  setTimeout(terminar, 1500);
}
