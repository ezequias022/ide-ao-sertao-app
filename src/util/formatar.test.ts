import { describe, expect, it } from 'vitest';
import { dataCurta, iniciais, normalizar, periodo } from './formatar';

describe('formatar', () => {
  it('formata data sem depender do fuso horário', () => {
    expect(dataCurta('2026-12-05')).toBe('5 dez 2026');
    expect(dataCurta('2026-01-01')).toBe('1 jan 2026');
    expect(dataCurta(null)).toBe('');
  });

  it('formata períodos de forma compacta', () => {
    expect(periodo('2026-12-05', '2026-12-08')).toBe('5 a 8 dez 2026');
    expect(periodo('2026-11-28', '2026-12-02')).toBe('28 nov a 2 dez 2026');
    expect(periodo('2026-12-30', '2027-01-02')).toBe('30 dez 2026 a 2 jan 2027');
    expect(periodo('2026-12-05', null)).toBe('5 dez 2026');
    expect(periodo('2026-12-05', '2026-12-05')).toBe('5 dez 2026');
  });

  it('gera iniciais ignorando preposições', () => {
    expect(iniciais('João Batista da Silva')).toBe('JS');
    expect(iniciais('Maria')).toBe('M');
    expect(iniciais('  ana   de lourdes ')).toBe('AL');
  });

  it('busca sem acento e sem maiúscula', () => {
    expect(normalizar('Petrolina São JOSÉ')).toBe('petrolina sao jose');
  });
});

import { formatarTelefone, somenteDigitos, telefoneValido } from './formatar';

describe('telefone', () => {
  it('formata enquanto digita', () => {
    expect(formatarTelefone('8')).toBe('(8');
    expect(formatarTelefone('87')).toBe('(87');
    expect(formatarTelefone('879')).toBe('(87) 9');
    expect(formatarTelefone('879999')).toBe('(87) 9999');
    expect(formatarTelefone('8799998')).toBe('(87) 9999-8');
    expect(formatarTelefone('8738611234')).toBe('(87) 3861-1234');
    expect(formatarTelefone('87999998888')).toBe('(87) 99999-8888');
  });

  it('limpa o que foi colado', () => {
    expect(somenteDigitos('+55 (87) 99999-8888')).toBe('87999998888');
    expect(somenteDigitos('87 9 9999 8888 ramal')).toBe('87999998888');
  });

  it('valida DDD + número', () => {
    expect(telefoneValido('87999998888')).toBe(true);
    expect(telefoneValido('8738611234')).toBe(true);
    expect(telefoneValido('8799999888')).toBe(true);
    expect(telefoneValido('879999')).toBe(false);
    expect(telefoneValido('07999998888')).toBe(false);
  });
});
