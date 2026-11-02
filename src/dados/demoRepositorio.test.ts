import { beforeEach, describe, expect, it } from 'vitest';
import { DemoRepositorio } from './demoRepositorio';

describe('DemoRepositorio (mesmas regras do banco)', () => {
  let repo: DemoRepositorio;
  beforeEach(() => {
    repo = new DemoRepositorio();
  });

  it('recusa senha errada', async () => {
    await expect(repo.entrar('admin@demo', 'errada')).rejects.toThrow('E-mail ou senha incorretos.');
  });

  it('líder não acessa a área de admin', async () => {
    await repo.entrar('lider@demo', 'demo');
    expect(await repo.souAdmin()).toBe(false);
    await expect(repo.eventosSite()).rejects.toThrow(/admins/);
    await expect(repo.pessoas()).rejects.toThrow(/admins/);
  });

  it('líder vê os eventos em que foi escalado', async () => {
    await repo.entrar('lider@demo', 'demo');
    const eventos = await repo.meusEventos();
    expect(eventos.map((e) => e.grupoNome).sort()).toEqual(['Grupo 1', 'Grupo A']);
  });

  it('admin cria impacto, grupo e escala líder', async () => {
    await repo.entrar('admin@demo', 'demo');
    const site = await repo.eventosSite();
    const livre = site.find((e) => !e.appEventoId)!;
    const id = await repo.criarImpacto(livre.id);
    await expect(repo.criarImpacto(livre.id)).rejects.toThrow(/já foi criado/);

    const g = await repo.criarGrupo(id, 'Grupo 1');
    await expect(repo.criarGrupo(id, 'Grupo 1')).rejects.toThrow(/mesmo nome|com esse nome/);

    await repo.definirLider(g.id, 'p-maria');
    const g2 = await repo.criarGrupo(id, 'Grupo 2');
    await expect(repo.definirLider(g2.id, 'p-maria')).rejects.toThrow(/já lidera/);

    const grupos = await repo.grupos(id);
    expect(grupos.find((x) => x.id === g.id)?.liderId).toBe('p-maria');
  });

  it('líder substituído continua vendo o evento', async () => {
    await repo.entrar('admin@demo', 'demo');
    await repo.definirLider('g1', 'p-ana');
    await repo.sair();
    await repo.entrar('lider@demo', 'demo');
    const ev = (await repo.meusEventos()).find((e) => e.grupoId === 'g1');
    expect(ev?.liderAtual).toBe(false);
  });
});
