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
