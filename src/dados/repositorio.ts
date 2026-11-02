import type { EventoSite, Grupo, MeuEvento, Pessoa, StatusEvento, Usuario } from './tipos';

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
