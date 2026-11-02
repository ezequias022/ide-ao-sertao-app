import type { Repositorio } from './repositorio';
import {
  ErroApp,
  type EventoSite,
  type Grupo,
  type MeuEvento,
  type Pessoa,
  type StatusEvento,
  type Usuario,
} from './tipos';

/**
 * Modo demonstração: tudo em memória, com dados fictícios.
 * Serve para mostrar o app e testar as telas sem tocar no Supabase.
 *
 * Contas: admin@demo (admin) e lider@demo (líder). Senha: demo
 */

interface EventoAppDemo {
  id: string;
  eventoSiteId: string;
  status: StatusEvento;
}

const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const novoId = () => crypto.randomUUID();

export class DemoRepositorio implements Repositorio {
  private usuario: Usuario | null = null;
  private ouvintes = new Set<(u: Usuario | null) => void>();

  private readonly contas: Record<string, Usuario & { admin: boolean }> = {
    'admin@demo': { id: 'u-admin', email: 'admin@demo', admin: true },
    'lider@demo': { id: 'u-lider', email: 'lider@demo', admin: false },
  };

  private readonly site: Omit<EventoSite, 'appEventoId' | 'appStatus'>[] = [
    { id: 's1', nome: 'Impacto Pilão Arcado', local: 'Pilão Arcado - BA', dataInicio: '2026-12-05', dataFim: '2026-12-08', ativoNoSite: true },
    { id: 's2', nome: 'Impacto Campo Alegre', local: 'Campo Alegre - BA', dataInicio: '2027-02-14', dataFim: '2027-02-17', ativoNoSite: true },
    { id: 's3', nome: 'Impacto Mandarino', local: 'Mandarino', dataInicio: '2026-07-10', dataFim: '2026-07-13', ativoNoSite: false },
  ];

  private eventos: EventoAppDemo[] = [
    { id: 'e1', eventoSiteId: 's1', status: 'ativo' },
    { id: 'e3', eventoSiteId: 's3', status: 'encerrado' },
  ];

  private gruposDemo: Grupo[] = [
    { id: 'g1', eventoId: 'e1', nome: 'Grupo 1', liderId: 'u-lider' },
    { id: 'g2', eventoId: 'e1', nome: 'Grupo 2', liderId: 'p-joao' },
    { id: 'g3', eventoId: 'e1', nome: 'Grupo 3', liderId: null },
    { id: 'g4', eventoId: 'e3', nome: 'Grupo A', liderId: 'u-lider' },
  ];

  private readonly historico = new Set(['g1:u-lider', 'g2:p-joao', 'g4:u-lider']);

  private readonly pessoasDemo: Pessoa[] = [
    { id: 'u-admin', nome: 'Admin Demonstração', email: 'admin@demo', telefone: null, cidade: 'Petrolina', adminApp: true },
    { id: 'u-lider', nome: 'Líder Demonstração', email: 'lider@demo', telefone: null, cidade: 'Petrolina', adminApp: false },
    { id: 'p-joao', nome: 'João Batista', email: 'joao@exemplo.com', telefone: '87999990001', cidade: 'Juazeiro', adminApp: false },
    { id: 'p-maria', nome: 'Maria de Lourdes', email: 'maria@exemplo.com', telefone: '87999990002', cidade: 'Petrolina', adminApp: false },
    { id: 'p-pedro', nome: 'Pedro Henrique', email: 'pedro@exemplo.com', telefone: '87999990003', cidade: 'Remanso', adminApp: false },
    { id: 'p-ana', nome: 'Ana Clara', email: 'ana@exemplo.com', telefone: '87999990004', cidade: 'Petrolina', adminApp: false },
  ];

  // ---------------- Sessão ----------------

  async entrar(email: string, senha: string): Promise<Usuario> {
    await espera(500);
    const conta = this.contas[email.trim().toLowerCase()];
    if (!conta || senha !== 'demo') throw new ErroApp('E-mail ou senha incorretos.');
    this.usuario = { id: conta.id, email: conta.email };
    this.ouvintes.forEach((f) => f(this.usuario));
    return this.usuario;
  }

  async sair(): Promise<void> {
    this.usuario = null;
    this.ouvintes.forEach((f) => f(null));
  }

  async usuarioAtual(): Promise<Usuario | null> {
    return this.usuario;
  }

  aoMudarSessao(callback: (usuario: Usuario | null) => void): () => void {
    this.ouvintes.add(callback);
    return () => this.ouvintes.delete(callback);
  }

  async souAdmin(): Promise<boolean> {
    return this.usuario ? Boolean(this.contas[this.usuario.email]?.admin) : false;
  }

  private exigirAdmin() {
    if (!this.usuario || !this.contas[this.usuario.email]?.admin) {
      throw new ErroApp('Esta área é só para os admins do app.');
    }
  }

  // ---------------- Líder ----------------

  async meusEventos(): Promise<MeuEvento[]> {
    await espera();
    const eu = this.usuario?.id;
    if (!eu) return [];
    return this.gruposDemo
      .filter((g) => this.historico.has(`${g.id}:${eu}`))
      .map((g) => {
        const ev = this.eventos.find((e) => e.id === g.eventoId)!;
        const s = this.site.find((x) => x.id === ev.eventoSiteId)!;
        return {
          eventoId: ev.id,
          status: ev.status,
          nome: s.nome,
          local: s.local,
          dataInicio: s.dataInicio,
          dataFim: s.dataFim,
          grupoId: g.id,
          grupoNome: g.nome,
          liderAtual: g.liderId === eu,
        };
      })
      .sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? ''));
  }

  // ---------------- Admin: eventos ----------------

  async eventosSite(): Promise<EventoSite[]> {
    await espera();
    this.exigirAdmin();
    return this.site
      .map((s) => {
        const ev = this.eventos.find((e) => e.eventoSiteId === s.id);
        return { ...s, appEventoId: ev?.id ?? null, appStatus: ev?.status ?? null };
      })
      .sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? ''));
  }

  async criarImpacto(eventoSiteId: string): Promise<string> {
    await espera();
    this.exigirAdmin();
    if (this.eventos.some((e) => e.eventoSiteId === eventoSiteId)) {
      throw new ErroApp('Este evento do site já foi criado no app.');
    }
    const ev: EventoAppDemo = { id: novoId(), eventoSiteId, status: 'planejado' };
    this.eventos.push(ev);
    return ev.id;
  }

  async alterarStatus(appEventoId: string, status: StatusEvento): Promise<void> {
    await espera();
    this.exigirAdmin();
    const ev = this.eventos.find((e) => e.id === appEventoId);
    if (ev) ev.status = status;
  }

  // ---------------- Admin: grupos ----------------

  async grupos(appEventoId: string): Promise<Grupo[]> {
    await espera();
    return this.gruposDemo
      .filter((g) => g.eventoId === appEventoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
      .map((g) => ({ ...g }));
  }

  async criarGrupo(appEventoId: string, nome: string): Promise<Grupo> {
    await espera();
    this.exigirAdmin();
    const limpo = nome.trim();
    if (!limpo || limpo.length > 60) throw new ErroApp('O nome do grupo precisa ter de 1 a 60 caracteres.');
    if (this.gruposDemo.some((g) => g.eventoId === appEventoId && g.nome === limpo)) {
      throw new ErroApp('Já existe um grupo com esse nome neste evento.');
    }
    const g: Grupo = { id: novoId(), eventoId: appEventoId, nome: limpo, liderId: null };
    this.gruposDemo.push(g);
    return { ...g };
  }

  async renomearGrupo(grupoId: string, nome: string): Promise<void> {
    await espera();
    this.exigirAdmin();
    const g = this.gruposDemo.find((x) => x.id === grupoId);
    const limpo = nome.trim();
    if (!g) return;
    if (this.gruposDemo.some((x) => x.eventoId === g.eventoId && x.id !== g.id && x.nome === limpo)) {
      throw new ErroApp('Já existe um grupo com esse nome neste evento.');
    }
    g.nome = limpo;
  }

  async definirLider(grupoId: string, liderId: string | null): Promise<void> {
    await espera();
    this.exigirAdmin();
    const g = this.gruposDemo.find((x) => x.id === grupoId);
    if (!g) return;
    if (liderId && this.gruposDemo.some((x) => x.eventoId === g.eventoId && x.id !== g.id && x.liderId === liderId)) {
      throw new ErroApp('Essa pessoa já lidera outro grupo neste evento.');
    }
    g.liderId = liderId;
    if (liderId) this.historico.add(`${g.id}:${liderId}`);
  }

  async removerGrupo(grupoId: string): Promise<void> {
    await espera();
    this.exigirAdmin();
    this.gruposDemo = this.gruposDemo.filter((g) => g.id !== grupoId);
  }

  async pessoas(): Promise<Pessoa[]> {
    await espera();
    this.exigirAdmin();
    return [...this.pessoasDemo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}
