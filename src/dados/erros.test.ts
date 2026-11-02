import { describe, expect, it } from 'vitest';
import { traduzirErro } from './erros';
import { ErroApp } from './tipos';

describe('traduzirErro', () => {
  it('traduz restrições conhecidas do banco', () => {
    const e = traduzirErro({
      message: 'duplicate key value violates unique constraint "app_grupos_evento_id_lider_id_key"',
    });
    expect(e.message).toBe('Essa pessoa já lidera outro grupo neste evento.');
  });

  it('traduz login inválido', () => {
    expect(traduzirErro({ message: 'Invalid login credentials' }).message).toBe('E-mail ou senha incorretos.');
  });

  it('reconhece falta de internet', () => {
    expect(traduzirErro(new TypeError('Failed to fetch')).message).toMatch(/Sem conexão/);
  });

  it('reconhece falta de permissão', () => {
    expect(traduzirErro({ message: 'new row violates row-level security policy' }).message).toMatch(/permissão/);
  });

  it('usa o contexto quando o erro é desconhecido', () => {
    expect(traduzirErro({ message: 'xyz' }, 'criar o grupo').message).toBe(
      'Não foi possível criar o grupo. Tente de novo em instantes.',
    );
  });

  it('mantém ErroApp como está', () => {
    const original = new ErroApp('Mensagem pronta');
    expect(traduzirErro(original)).toBe(original);
  });
});
