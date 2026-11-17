/**
 * O que mandar ao hub nesta chamada do gancho (#1468), em função pura.
 *
 * Por que existe: o envio só rodava no fim da sessão (`SessionEnd`). As sessões desta casa duram dias e
 * muitas fecham sem passar pelo fim normal, então de 12 a 17/11 o hub recebeu UM registro. Agora o gancho
 * também roda ao fim de cada resposta (`Stop`), em modo PARCIAL, e o fim da sessão continua mandando tudo.
 *
 * As regras do parcial:
 *   • no máximo uma vez a cada INTERVALO_DO_PARCIAL_MS por sessão (o gancho roda a cada resposta);
 *   • só o que ainda não foi mandado desta máquina (a lista de ids enviados fica num arquivo local);
 *   • trecho SEM tarefa só vai depois de ESPERA_SEM_TAREFA_MS: a tarefa de um trecho pode vir do `Ref #N` de
 *     um commit feito depois dele, e o hub ignora a mensagem que já tem. Mandar cedo gravaria "sem tarefa"
 *     para sempre. O fim da sessão manda tudo o que sobrou, com ou sem tarefa.
 */

export const INTERVALO_DO_PARCIAL_MS = 10 * 60 * 1000;
export const ESPERA_SEM_TAREFA_MS = 6 * 60 * 60 * 1000;

/**
 * Se o parcial deve rodar agora, pela hora do último envio desta sessão (nula: nunca mandou).
 * @param {number | null} ultimoEnvioMs
 * @param {number} agoraMs
 */
export function ehHoraDoParcial(ultimoEnvioMs, agoraMs) {
  if (ultimoEnvioMs === null || !Number.isFinite(ultimoEnvioMs)) return true;
  return agoraMs - ultimoEnvioMs >= INTERVALO_DO_PARCIAL_MS;
}

/**
 * Os trechos a mandar.
 * @template {{ mensagem: string, ocorreu_em: string, tarefa: number | null }} T
 * @param {T[]} trechos
 * @param {Set<string>} enviados os ids que esta máquina já mandou desta sessão
 * @param {{ parcial: boolean, agoraMs: number }} opcoes
 * @returns {T[]}
 */
export function escolherParaEnviar(trechos, enviados, { parcial, agoraMs }) {
  return trechos.filter((t) => {
    if (enviados.has(t.mensagem)) return false;
    if (!parcial) return true;
    if (t.tarefa !== null && t.tarefa !== undefined) return true;
    const quando = Date.parse(t.ocorreu_em);
    // Sem data legível não se sabe a idade: espera o fim da sessão.
    return Number.isFinite(quando) && agoraMs - quando >= ESPERA_SEM_TAREFA_MS;
  });
}

/**
 * O nome do arquivo local da sessão: só letras, números, hífen e sublinhado, para o id nunca virar caminho.
 * @param {string} sessao
 */
export function nomeDoArquivoDaSessao(sessao) {
  const limpo = String(sessao).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  return `${limpo || "sem-sessao"}.txt`;
}
