import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Repositorio } from './repositorio';
import { traduzirErro } from './erros';
import {
  ErroApp,
  type EventoSite,
  type Grupo,
  type MeuEvento,
  type Pessoa,
  type StatusEvento,
  type Usuario,
} from './tipos';

function paraUsuario(user: User | null | undefined): Usuario | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? '' };
}

/** Lança o erro traduzido quando a chamada ao Supabase falha. */
function conferir<T>(resposta: { data: T; error: unknown }, contexto: string): T {
  if (resposta.error) throw traduzirErro(resposta.error, contexto);
  return resposta.data;
}

interface LinhaGrupo {
  id: string;
  evento_id: string;
  nome: string;
  lider_id: string | null;
}

function paraGrupo(l: LinhaGrupo): Grupo {
  return { id: l.id, eventoId: l.evento_id, nome: l.nome, liderId: l.lider_id };
}

export class SupabaseRepositorio implements Repositorio {
  private readonly db: SupabaseClient;

  constructor(url: string, chave: string) {
    if (!url || !chave) {
      throw new ErroApp('Configuração do Supabase ausente (veja o arquivo .env).');
    }
    this.db = createClient(url, chave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  // ---------------- Sessão ----------------

  async entrar(email: string, senha: string): Promise<Usuario> {
    const { data, error } = await this.db.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) throw traduzirErro(error, 'entrar');
    const usuario = paraUsuario(data.user);
    if (!usuario) throw new ErroApp('Não foi possível entrar. Tente de novo.');
    return usuario;
  }

  async sair(): Promise<void> {
    // scope local: sai deste aparelho mesmo sem internet.
    await this.db.auth.signOut({ scope: 'local' });
  }

  async usuarioAtual(): Promise<Usuario | null> {
    // getSession lê a sessão guardada no aparelho (funciona offline).
    const { data } = await this.db.auth.getSession();
    return paraUsuario(data.session?.user);
  }

  aoMudarSessao(callback: (usuario: Usuario | null) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((_evento, sessao) => {
      callback(paraUsuario(sessao?.user));
    });
    return () => data.subscription.unsubscribe();
  }

  async souAdmin(): Promise<boolean> {
    const data = conferir(await this.db.rpc('app_is_admin'), 'verificar seu acesso');
    return data === true;
  }

  // ---------------- Líder ----------------

  async meusEventos(): Promise<MeuEvento[]> {
    const data = conferir(
      await this.db.rpc('app_meus_eventos'),
      'carregar seus eventos',
    ) as Array<Record<string, unknown>>;
    return data.map((l) => ({
      eventoId: String(l.evento_id),
      status: l.status as StatusEvento,
      nome: String(l.nome ?? ''),
      local: (l.local as string | null) ?? null,
      dataInicio: (l.data_inicio as string | null) ?? null,
      dataFim: (l.data_fim as string | null) ?? null,
      grupoId: String(l.grupo_id),
      grupoNome: String(l.grupo_nome ?? ''),
      liderAtual: Boolean(l.lider_atual),
    }));
  }

  // ---------------- Admin: eventos ----------------

  async eventosSite(): Promise<EventoSite[]> {
    const data = conferir(
      await this.db.rpc('app_eventos_site'),
      'carregar os eventos do site',
    ) as Array<Record<string, unknown>>;
    return data.map((l) => ({
      id: String(l.id),
      nome: String(l.nome ?? ''),
      local: (l.local as string | null) ?? null,
      dataInicio: (l.data_inicio as string | null) ?? null,
      dataFim: (l.data_fim as string | null) ?? null,
      ativoNoSite: Boolean(l.ativo),
      appEventoId: (l.app_evento_id as string | null) ?? null,
      appStatus: (l.app_status as StatusEvento | null) ?? null,
    }));
  }

  async criarImpacto(eventoSiteId: string): Promise<string> {
    const data = conferir(
      await this.db
        .from('app_eventos')
        .insert({ evento_site_id: eventoSiteId })
        .select('id')
        .single(),
      'criar o impacto',
    ) as { id: string };
    return data.id;
  }

  async alterarStatus(appEventoId: string, status: StatusEvento): Promise<void> {
    conferir(
      await this.db.from('app_eventos').update({ status }).eq('id', appEventoId),
      'alterar o status do evento',
    );
  }

  // ---------------- Admin: grupos ----------------

  async grupos(appEventoId: string): Promise<Grupo[]> {
    const data = conferir(
      await this.db
        .from('app_grupos')
        .select('id, evento_id, nome, lider_id')
        .eq('evento_id', appEventoId)
        .order('nome'),
      'carregar os grupos',
    ) as LinhaGrupo[];
    return data.map(paraGrupo);
  }

  async criarGrupo(appEventoId: string, nome: string): Promise<Grupo> {
    const data = conferir(
      await this.db
        .from('app_grupos')
        .insert({ evento_id: appEventoId, nome: nome.trim() })
        .select('id, evento_id, nome, lider_id')
        .single(),
      'criar o grupo',
    ) as LinhaGrupo;
    return paraGrupo(data);
  }

  async renomearGrupo(grupoId: string, nome: string): Promise<void> {
    conferir(
      await this.db.from('app_grupos').update({ nome: nome.trim() }).eq('id', grupoId),
      'renomear o grupo',
    );
  }

  async definirLider(grupoId: string, liderId: string | null): Promise<void> {
    conferir(
      await this.db.from('app_grupos').update({ lider_id: liderId }).eq('id', grupoId),
      'escalar o líder',
    );
  }

  async removerGrupo(grupoId: string): Promise<void> {
    conferir(await this.db.from('app_grupos').delete().eq('id', grupoId), 'remover o grupo');
  }

  async pessoas(): Promise<Pessoa[]> {
    const data = conferir(
      await this.db.rpc('app_pessoas'),
      'carregar as pessoas',
    ) as Array<Record<string, unknown>>;
    return data.map((l) => ({
      id: String(l.id),
      nome: String(l.nome ?? 'Sem nome'),
      email: (l.email as string | null) ?? null,
      telefone: (l.telefone as string | null) ?? null,
      cidade: (l.cidade as string | null) ?? null,
      adminApp: Boolean(l.is_admin_app),
    }));
  }
}
