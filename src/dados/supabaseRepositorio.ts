import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Repositorio } from './repositorio';
import { ehErroPassageiro, motivoRecusa, traduzirErro } from './erros';
import {
  ErroApp,
  ErroRecusado,
  ErroSemConexao,
  type Conversao,
  type ConversaoAdmin,
  type FormatoExportacao,
  type EventoSite,
  type Grupo,
  type LinhaPlacar,
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

const COLUNAS_CONVERSAO =
  'id, evento_id, grupo_id, nome, apelido, idade, whatsapp, endereco, responsavel_nome, responsavel_telefone, consentimento, registrado_em, atualizado_em';

interface LinhaConversao {
  id: string;
  evento_id: string;
  grupo_id: string;
  nome: string;
  apelido: string | null;
  idade: number | null;
  whatsapp: string | null;
  endereco: string;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  consentimento: boolean;
  registrado_em: string;
  atualizado_em: string;
}

function paraLinha(c: Conversao): LinhaConversao {
  return {
    id: c.id,
    evento_id: c.eventoId,
    grupo_id: c.grupoId,
    nome: c.nome,
    apelido: c.apelido,
    idade: c.idade,
    whatsapp: c.whatsapp,
    endereco: c.endereco,
    responsavel_nome: c.responsavelNome,
    responsavel_telefone: c.responsavelTelefone,
    consentimento: c.consentimento,
    registrado_em: c.registradoEm,
    atualizado_em: c.atualizadoEm,
  };
}

function paraConversao(l: LinhaConversao): Conversao {
  return {
    id: l.id,
    eventoId: l.evento_id,
    grupoId: l.grupo_id,
    nome: l.nome,
    apelido: l.apelido,
    idade: l.idade,
    whatsapp: l.whatsapp,
    endereco: l.endereco,
    responsavelNome: l.responsavel_nome,
    responsavelTelefone: l.responsavel_telefone,
    consentimento: l.consentimento,
    registradoEm: l.registrado_em,
    atualizadoEm: l.atualizado_em,
  };
}

/** Converte a falha de envio em ErroSemConexao (tentar depois) ou ErroRecusado. */
function erroDeEnvio(erro: unknown, status?: number): ErroApp {
  const comStatus = { ...(erro as object), status };
  if (ehErroPassageiro(comStatus)) return new ErroSemConexao(erro);
  return new ErroRecusado(motivoRecusa(erro), erro);
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

  // ---------------- Conversões ----------------

  async enviarConversao(c: Conversao): Promise<void> {
    let resposta;
    try {
      resposta = await this.db.from('app_conversoes').insert(paraLinha(c));
    } catch (e) {
      throw new ErroSemConexao(e);
    }
    const { error, status } = resposta;
    if (!error) return;

    // Mesmo id já no servidor: a confirmação anterior se perdeu. Já está salvo.
    if (error.code === '23505' && /app_conversoes_pkey/.test(error.message)) {
      const { data } = await this.db.from('app_conversoes').select('id').eq('id', c.id).maybeSingle();
      if (data) return;
    }
    throw erroDeEnvio(error, status);
  }

  async atualizarConversao(c: Conversao): Promise<void> {
    const { id, registrado_em: _r, ...campos } = paraLinha(c);
    let resposta;
    try {
      resposta = await this.db.from('app_conversoes').update(campos).eq('id', id).select('id');
    } catch (e) {
      throw new ErroSemConexao(e);
    }
    const { data, error, status } = resposta;
    if (error) throw erroDeEnvio(error, status);
    if (!data || data.length === 0) {
      throw new ErroRecusado('O servidor não aceitou a correção: o evento pode ter sido encerrado.');
    }
  }

  async idsDasMinhasConversoes(): Promise<string[]> {
    const { data: sessao } = await this.db.auth.getSession();
    const eu = sessao.session?.user.id;
    if (!eu) throw new ErroSemConexao();
    const ids: string[] = [];
    const PAGINA = 1000;
    for (let inicio = 0; ; inicio += PAGINA) {
      const data = conferir(
        await this.db
          .from('app_conversoes')
          .select('id')
          .eq('registrado_por', eu)
          .order('id')
          .range(inicio, inicio + PAGINA - 1),
        'conferir seus registros',
      ) as Array<{ id: string }>;
      ids.push(...data.map((l) => l.id));
      if (data.length < PAGINA) break;
    }
    return ids;
  }

  async buscarConversao(id: string): Promise<Conversao | null> {
    const data = conferir(
      await this.db.from('app_conversoes').select(COLUNAS_CONVERSAO).eq('id', id).maybeSingle(),
      'carregar o registro',
    ) as LinhaConversao | null;
    return data ? paraConversao(data) : null;
  }

  // ---------------- Placar ----------------

  async placar(eventoId: string): Promise<LinhaPlacar[]> {
    const data = conferir(
      await this.db.rpc('app_placar', { p_evento_id: eventoId }),
      'carregar o placar',
    ) as Array<{ grupo_id: string; grupo_nome: string; total: number | string }>;
    return data.map((l) => ({ grupoId: l.grupo_id, grupoNome: l.grupo_nome, total: Number(l.total) }));
  }

  ouvirPlacar(eventoId: string, aoMudar: () => void): () => void {
    let canal: ReturnType<SupabaseClient['channel']> | null = null;
    let parado = false;

    void (async () => {
      // Canal privado: o token da sessão é exigido pelas regras do banco.
      await this.db.realtime.setAuth();
      if (parado) return;
      canal = this.db
        .channel(`placar:${eventoId}`, { config: { private: true } })
        .on('broadcast', { event: 'nova_conversao' }, () => aoMudar())
        .on('broadcast', { event: 'conversao_atualizada' }, () => aoMudar())
        .on('broadcast', { event: 'conversao_apagada' }, () => aoMudar())
        .subscribe((estado) => {
          // Ao reconectar, pode ter chegado coisa enquanto estava fora.
          if (estado === 'SUBSCRIBED') aoMudar();
        });
    })();

    return () => {
      parado = true;
      if (canal) void this.db.removeChannel(canal);
    };
  }

  // ---------------- Admin: conversões ----------------

  async conversoesDoEvento(eventoId: string): Promise<ConversaoAdmin[]> {
    const data = conferir(
      await this.db
        .from('app_conversoes')
        .select(`${COLUNAS_CONVERSAO}, registrado_por, recebido_em`)
        .eq('evento_id', eventoId)
        .order('registrado_em', { ascending: false }),
      'carregar as conversões',
    ) as Array<LinhaConversao & { registrado_por: string; recebido_em: string }>;
    return data.map((l) => ({ ...paraConversao(l), registradoPor: l.registrado_por, recebidoEm: l.recebido_em }));
  }

  async apagarConversao(id: string): Promise<void> {
    const data = conferir(
      await this.db.from('app_conversoes').delete().eq('id', id).select('id'),
      'apagar a conversão',
    ) as Array<{ id: string }>;
    if (data.length === 0) throw new ErroApp('Não foi possível apagar: você precisa ser admin.');
  }

  async apagarConversoesDoGrupo(grupoId: string): Promise<number> {
    const data = conferir(
      await this.db.from('app_conversoes').delete().eq('grupo_id', grupoId).select('id'),
      'apagar as conversões do grupo',
    ) as Array<{ id: string }>;
    return data.length;
  }

  async registrarExportacao(
    eventoId: string,
    formato: FormatoExportacao,
    quantidade: number,
    filtro: object | null,
  ): Promise<void> {
    conferir(
      await this.db.from('app_exportacoes').insert({ evento_id: eventoId, formato, quantidade, filtro }),
      'registrar a exportação',
    );
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
