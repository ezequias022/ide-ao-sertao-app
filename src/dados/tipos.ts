// Tipos do domínio do app. Os nomes seguem o banco (tabelas app_*).

export type StatusEvento = 'planejado' | 'ativo' | 'encerrado';

export interface Usuario {
  id: string;
  email: string;
}

/** Evento cadastrado no site (public.eventos), visto pelo admin. */
export interface EventoSite {
  id: string;
  nome: string;
  local: string | null;
  dataInicio: string | null; // AAAA-MM-DD
  dataFim: string | null;
  ativoNoSite: boolean;
  /** Preenchido quando o evento já virou um impacto no app. */
  appEventoId: string | null;
  appStatus: StatusEvento | null;
}

/** Evento em que o usuário logado é ou foi líder. */
export interface MeuEvento {
  eventoId: string;
  status: StatusEvento;
  nome: string;
  local: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  grupoId: string;
  grupoNome: string;
  liderAtual: boolean;
}

export interface Grupo {
  id: string;
  eventoId: string;
  nome: string;
  liderId: string | null;
}

/** Pessoa cadastrada no site, para o admin escalar como líder. */
export interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  adminApp: boolean;
}

/** Erro já traduzido para mostrar ao usuário. */
export class ErroApp extends Error {
  constructor(
    message: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'ErroApp';
  }
}
