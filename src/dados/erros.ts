import { ErroApp } from './tipos';

interface ErroBruto {
  message?: string;
  code?: string;
  details?: string;
  status?: number;
}

/** Mensagens para restrições e erros conhecidos do banco. */
const POR_RESTRICAO: Record<string, string> = {
  app_grupos_evento_id_lider_id_key: 'Essa pessoa já lidera outro grupo neste evento.',
  app_grupos_evento_id_nome_key: 'Já existe um grupo com esse nome neste evento.',
  app_eventos_evento_site_id_key: 'Este evento do site já foi criado no app.',
  app_grupos_nome_check: 'O nome do grupo precisa ter de 1 a 60 caracteres.',
  app_conversoes_grupo_id_fkey: 'Este grupo tem conversões. Para remover, use antes a opção "Apagar conversões do grupo".',
};

const POR_TEXTO: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).'],
  [/failed to fetch|network|fetch failed|load failed/i, 'Sem conexão com a internet. Tente de novo quando tiver sinal.'],
  [/row-level security|permission denied/i, 'Você não tem permissão para fazer isso.'],
  [/Acesso restrito aos admins/i, 'Esta área é só para os admins do app.'],
  [/violates foreign key constraint/i, 'Não dá para apagar: existem registros ligados a este item.'],
  [/Um grupo não pode mudar de evento/i, 'Um grupo não pode mudar de evento.'],
];

/** Converte qualquer erro do Supabase/rede numa mensagem em português. */
export function traduzirErro(erro: unknown, contexto?: string): ErroApp {
  if (erro instanceof ErroApp) return erro;

  const bruto = (erro ?? {}) as ErroBruto;
  const texto = `${bruto.message ?? ''} ${bruto.details ?? ''}`;

  for (const [restricao, mensagem] of Object.entries(POR_RESTRICAO)) {
    if (texto.includes(restricao)) return new ErroApp(mensagem, erro);
  }
  for (const [padrao, mensagem] of POR_TEXTO) {
    if (padrao.test(texto)) return new ErroApp(mensagem, erro);
  }

  const base = contexto ? `Não foi possível ${contexto}.` : 'Algo deu errado.';
  return new ErroApp(`${base} Tente de novo em instantes.`, erro);
}

const REDE = /failed to fetch|network|fetch failed|load failed|networkerror|timeout|aborted|ERR_INTERNET/i;
const SESSAO = /jwt expired|invalid jwt|refresh token|not authenticated|auth session missing/i;

/**
 * Para a fila de envio: o erro é passageiro (tentar de novo depois)?
 * Sem internet, servidor fora do ar ou sessão vencida = sim.
 * Regra do banco recusou (permissão, evento encerrado, dado inválido) = não.
 */
export function ehErroPassageiro(erro: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const bruto = (erro ?? {}) as ErroBruto & { name?: string };
  const texto = `${bruto.name ?? ''} ${bruto.message ?? ''} ${bruto.details ?? ''}`;
  if (REDE.test(texto) || SESSAO.test(texto)) return true;
  const status = bruto.status ?? 0;
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

/** Mensagem para quando o servidor recusa uma conversão. */
export function motivoRecusa(erro: unknown): string {
  const bruto = (erro ?? {}) as ErroBruto;
  const texto = `${bruto.message ?? ''} ${bruto.details ?? ''}`;
  if (/row-level security/i.test(texto)) {
    return 'O servidor recusou: o evento pode ter sido encerrado ou você não é mais líder deste grupo. Avise um admin.';
  }
  if (/consentimento/i.test(texto)) return 'Falta marcar o consentimento.';
  if (/whatsapp/i.test(texto)) return 'WhatsApp em formato inválido.';
  if (/endereco/i.test(texto)) return 'Endereço inválido.';
  if (/nome/i.test(texto)) return 'Nome inválido.';
  if (/grupo informado não pertence/i.test(texto)) return 'O grupo não pertence a este evento.';
  return traduzirErro(erro, 'enviar').message;
}
