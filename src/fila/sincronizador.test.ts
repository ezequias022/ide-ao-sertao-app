import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BancoLocal } from './bancoLocal';
import { Sincronizador } from './sincronizador';
import { ErroRecusado, ErroSemConexao, type Conversao } from '../dados/tipos';
import type { Repositorio } from '../dados/repositorio';

const U = 'usuario-1';

function conversao(nome: string, minuto = 0): Conversao {
  const t = new Date(Date.UTC(2026, 11, 5, 10, minuto)).toISOString();
  return {
    id: crypto.randomUUID(),
    eventoId: 'e1',
    grupoId: 'g1',
    nome,
    apelido: null,
    idade: 30,
    whatsapp: '87999998888',
    endereco: 'Rua A, 1',
    responsavelNome: null,
    responsavelTelefone: null,
    consentimento: true,
    registradoEm: t,
    atualizadoEm: t,
  };
}

/** Servidor falso: guarda o que recebe e pode simular falhas. */
function servidorFalso() {
  const recebidos = new Map<string, Conversao>();
  let modo: 'ok' | 'offline' | 'recusar' = 'ok';
  const repo = {
    enviarConversao: vi.fn(async (c: Conversao) => {
      if (modo === 'offline') throw new ErroSemConexao();
      if (modo === 'recusar') throw new ErroRecusado('Evento encerrado');
      recebidos.set(c.id, { ...c });
    }),
    atualizarConversao: vi.fn(async (c: Conversao) => {
      if (modo === 'offline') throw new ErroSemConexao();
      recebidos.set(c.id, { ...c });
    }),
  } as unknown as Repositorio;
  return { repo, recebidos, setModo: (m: typeof modo) => (modo = m) };
}

describe('Sincronizador (fila offline)', () => {
  let banco: BancoLocal;
  beforeEach(async () => {
    banco = new BancoLocal(`teste-${crypto.randomUUID()}`);
    await banco.open();
  });
  afterEach(async () => {
    await banco.delete();
  });

  it('envia na ordem e tira os dados pessoais do aparelho', async () => {
    const s = servidorFalso();
    const sync = new Sincronizador(banco, s.repo);
    await sync.registrar(U, conversao('Primeiro', 1));
    await new Promise((r) => setTimeout(r, 5));
    await sync.registrar(U, conversao('Segundo', 2));

    const r = await sync.enviarPendentes(U);
    expect(r).toMatchObject({ enviados: 2, recusados: 0, pendentes: 0, semConexao: false });
    expect([...s.recebidos.values()].map((c) => c.nome)).toEqual(['Primeiro', 'Segundo']);

    expect(await banco.fila.count()).toBe(0);
    const enviados = await banco.enviados.toArray();
    expect(enviados).toHaveLength(2);
    // Só o nome fica no aparelho, nada de endereço ou WhatsApp.
    expect(Object.keys(enviados[0]!)).not.toContain('endereco');
    expect(JSON.stringify(enviados)).not.toContain('87999998888');
  });

  it('sem internet: guarda tudo e para de tentar até a próxima vez', async () => {
    const s = servidorFalso();
    s.setModo('offline');
    const sync = new Sincronizador(banco, s.repo);
    await sync.registrar(U, conversao('A', 1));
    await sync.registrar(U, conversao('B', 2));

    const r = await sync.enviarPendentes(U);
    expect(r).toMatchObject({ enviados: 0, pendentes: 2, semConexao: true });
    expect(s.repo.enviarConversao).toHaveBeenCalledTimes(1); // parou no primeiro

    s.setModo('ok');
    const r2 = await sync.enviarPendentes(U);
    expect(r2).toMatchObject({ enviados: 2, pendentes: 0 });
  });

  it('recusado pelo servidor: marca com erro e segue com os outros', async () => {
    const s = servidorFalso();
    const sync = new Sincronizador(banco, s.repo);
    const a = conversao('A', 1);
    await sync.registrar(U, a);
    s.setModo('recusar');
    const r = await sync.enviarPendentes(U);
    expect(r).toMatchObject({ enviados: 0, recusados: 1, pendentes: 0 });

    const item = await banco.fila.get(a.id);
    expect(item?.status).toBe('erro');
    expect(item?.erro).toBe('Evento encerrado');

    // Tentar de novo depois que o admin resolver
    s.setModo('ok');
    await sync.tentarDeNovo(a.id);
    expect((await sync.enviarPendentes(U)).enviados).toBe(1);
  });

  it('correção antes de enviar: sobe já corrigido, como registro novo', async () => {
    const s = servidorFalso();
    s.setModo('offline');
    const sync = new Sincronizador(banco, s.repo);
    const a = conversao('Jose', 1);
    await sync.registrar(U, a);
    await sync.corrigir(U, { ...a, nome: 'José', atualizadoEm: new Date().toISOString() });

    s.setModo('ok');
    await sync.enviarPendentes(U);
    expect(s.repo.enviarConversao).toHaveBeenLastCalledWith(expect.objectContaining({ nome: 'José' }));
    expect(s.repo.atualizarConversao).not.toHaveBeenCalled();
    expect(s.recebidos.get(a.id)?.nome).toBe('José');
  });

  it('correção depois de enviado: sobe como atualização', async () => {
    const s = servidorFalso();
    const sync = new Sincronizador(banco, s.repo);
    const a = conversao('Maria', 1);
    await sync.registrar(U, a);
    await sync.enviarPendentes(U);

    await sync.corrigir(U, { ...a, apelido: 'Lia', atualizadoEm: new Date().toISOString() });
    await sync.enviarPendentes(U);
    expect(s.repo.atualizarConversao).toHaveBeenCalledTimes(1);
    expect(s.recebidos.get(a.id)?.apelido).toBe('Lia');
    expect(await banco.fila.count()).toBe(0);
  });

  it('dois envios ao mesmo tempo não mandam o mesmo registro duas vezes', async () => {
    const s = servidorFalso();
    const sync = new Sincronizador(banco, s.repo);
    await sync.registrar(U, conversao('A', 1));
    await Promise.all([sync.enviarPendentes(U), sync.enviarPendentes(U), sync.enviarPendentes(U)]);
    expect(s.repo.enviarConversao).toHaveBeenCalledTimes(1);
  });

  it('cada conta só envia os próprios registros', async () => {
    const s = servidorFalso();
    const sync = new Sincronizador(banco, s.repo);
    await sync.registrar(U, conversao('Meu', 1));
    await sync.registrar('outra-conta', conversao('De outro', 2));
    const r = await sync.enviarPendentes(U);
    expect(r.enviados).toBe(1);
    expect(await banco.fila.count()).toBe(1);
  });
});
