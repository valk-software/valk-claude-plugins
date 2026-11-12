/**
 * Registra a conta do Claude logada AGORA nesta máquina para o gancho do consumo de IA (#1468).
 *
 *   node scripts/consumo-de-ia/registrar-esta-conta.mjs <codigo da conta no hub: felipe | vini | admin>
 *
 * Emite uma chave nova, guarda-a em ~/.claude/valk-consumo-de-ia.json sob a conta logada, e imprime SÓ o INSERT
 * com o SHA-256 dela, para rodar no editor do Supabase. A chave em claro não aparece na tela: ela vai direto do
 * script para o arquivo desta máquina, e não passa por chat, log nem histórico do terminal.
 *
 * Para registrar a outra conta: faça login nela no Claude Code (/login) e rode de novo com o código dela.
 * Rodar de novo para a mesma conta troca a chave dela no arquivo; revogue a anterior no banco.
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ARQUIVO_DAS_CHAVES, chavesRegistradas, contaLogadaAgora } from "./chave-da-conta.mjs";

const codigo = process.argv[2];
if (!codigo || !/^[a-z][a-z0-9-]{1,31}$/.test(codigo)) {
  process.stderr.write("Diga o código da conta no hub: node scripts/consumo-de-ia/registrar-esta-conta.mjs felipe\n");
  process.exit(1);
}

const conta = contaLogadaAgora();
if (!conta) {
  process.stderr.write("Não achei a conta logada no Claude Code desta máquina. Faça login (/login) e rode de novo.\n");
  process.exit(1);
}

const chave = `valk_ia_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(chave).digest("hex");

const contas = { ...chavesRegistradas(), [conta]: chave };
mkdirSync(dirname(ARQUIVO_DAS_CHAVES), { recursive: true });
writeFileSync(ARQUIVO_DAS_CHAVES, JSON.stringify({ contas }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });

process.stdout.write(
  [
    `A conta logada agora ficou registrada como "${codigo}" nesta máquina.`,
    "",
    "Rode no editor do Supabase:",
    "",
    `  insert into public.chaves_de_consumo_de_ia (conta_id, chave_hash)`,
    `    select id, '${hash}' from public.contas_de_ia where codigo = '${codigo}';`,
    "",
  ].join("\n")
);
