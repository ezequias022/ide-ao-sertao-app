import type {
  Conversao,
  ConversaoAdmin,
  FormatoExportacao,
  EventoSite,
  Grupo,
  LinhaPlacar,
  MeuEvento,
  Pessoa,
  StatusEvento,
  Usuario,
} from './tipos';

/**
 * Contrato único de acesso a dados. As telas só conhecem esta interface,
 * então dá para trocar o Supabase pelo modo demonstração (ou por testes)
 * sem mexer em nenhuma tela.
 */
export interface Repositorio {
  // Sessão
  entrar(email: string, senha: string): Promise<Usuario>;
  sair(): Promise<void>;
  usuarioAtual(): Promise<Usuario | null>;
  aoMudarSessao(callback: (usuario: Usuario | null) => void): () => void;
  souAdmin(): Promise<boolean>;

  // Líder
  meusEventos(): Promise<MeuEvento[]>;

  /**
   * Envia uma conversão nova. Se o mesmo id já estiver no servidor
   * (confirmação perdida), trata como enviada.
   * Lança ErroSemConexao (tentar depois) ou ErroRecusado (não adianta tentar).
   */
  enviarConversao(c: Conversao): Promise<void>;
  /** Envia uma correção. Mesmas regras de erro de enviarConversao. */
  atualizarConversao(c: Conversao): Promise<void>;
  /**
   * Ids de todas as conversões que o usuário logado registrou e que ainda existem no servidor.
   * Serve para tirar do histórico do celular o que o admin apagou. Precisa de internet.
   */
  idsDasMinhasConversoes(): Promise<string[]>;
  /** Busca uma conversão já enviada (para corrigir). Precisa de internet. */
  buscarConversao(id: string): Promise<Conversao | null>;

  // Placar
  placar(eventoId: string): Promise<LinhaPlacar[]>;
  /** Avisa quando uma conversão do evento entra, é corrigida ou apagada. Devolve a função para parar de ouvir. */
  ouvirPlacar(eventoId: string, aoMudar: () => void): () => void;

  // Admin: conversões
  conversoesDoEvento(eventoId: string): Promise<ConversaoAdmin[]>;
  apagarConversao(id: string): Promise<void>;
  /** Apaga todas as conversões de um grupo. Devolve quantas foram apagadas. */
  apagarConversoesDoGrupo(grupoId: string): Promise<number>;
  registrarExportacao(eventoId: string, formato: FormatoExportacao, quantidade: number, filtro: object | null): Promise<void>;

  // Admin: eventos
  eventosSite(): Promise<EventoSite[]>;
  criarImpacto(eventoSiteId: string): Promise<string>;
  alterarStatus(appEventoId: string, status: StatusEvento): Promise<void>;

  // Admin: grupos e escalação
  grupos(appEventoId: string): Promise<Grupo[]>;
  criarGrupo(appEventoId: string, nome: string): Promise<Grupo>;
  renomearGrupo(grupoId: string, nome: string): Promise<void>;
  definirLider(grupoId: string, liderId: string | null): Promise<void>;
  removerGrupo(grupoId: string): Promise<void>;
  pessoas(): Promise<Pessoa[]>;
}
