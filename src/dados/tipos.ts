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

/** Uma pessoa alcançada, como o líder preenche no formulário. */
export interface Conversao {
  id: string; // gerado no aparelho: reenviar não duplica
  eventoId: string;
  grupoId: string;
  nome: string;
  apelido: string | null;
  idade: number | null;
  whatsapp: string | null; // só dígitos: DDD + número
  endereco: string;
  responsavelNome: string | null;
  responsavelTelefone: string | null;
  consentimento: boolean;
  registradoEm: string; // ISO, hora do aparelho
  atualizadoEm: string; // ISO, última correção
}

/** Linha do placar: só contagem, sem dados pessoais. */
export interface LinhaPlacar {
  grupoId: string;
  grupoNome: string;
  total: number;
}

/** Erro que o servidor recusou de propósito (não adianta tentar de novo). */
export class ErroRecusado extends ErroApp {
  constructor(message: string, causa?: unknown) {
    super(message, causa);
    this.name = 'ErroRecusado';
  }
}

/** Sem conexão: o registro fica na fila e é reenviado depois. */
export class ErroSemConexao extends ErroApp {
  constructor(causa?: unknown) {
    super('Sem conexão com a internet.', causa);
    this.name = 'ErroSemConexao';
  }
}

/** Conversão como o admin vê: com quem registrou e quando chegou ao servidor. */
export interface ConversaoAdmin extends Conversao {
  registradoPor: string;
  recebidoEm: string;
}

export type FormatoExportacao = 'xlsx' | 'csv' | 'texto';
