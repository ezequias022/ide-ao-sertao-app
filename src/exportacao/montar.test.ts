import { describe, expect, it } from 'vitest';
import type { ConversaoAdmin, Grupo, Pessoa } from '../dados/tipos';
import { gerarCSV, gerarTexto, gerarXlsx, montarLinhas, nomeAba, nomeArquivo } from './montar';

const grupos: Grupo[] = [
  { id: 'g2', eventoId: 'e', nome: 'Grupo 2', liderId: 'p1' },
  { id: 'g10', eventoId: 'e', nome: 'Grupo 10', liderId: 'p2' },
];
const pessoas: Pessoa[] = [
  { id: 'p1', nome: 'Líder Um', email: null, telefone: null, cidade: null, adminApp: false },
];

function conv(over: Partial<ConversaoAdmin>): ConversaoAdmin {
  return {
    id: crypto.randomUUID(),
    eventoId: 'e',
    grupoId: 'g2',
    nome: 'Fulano',
    apelido: null,
    idade: null,
    whatsapp: null,
    endereco: 'Rua A',
    responsavelNome: null,
    responsavelTelefone: null,
    consentimento: true,
    registradoEm: '2026-12-05T13:07:00.000Z',
    atualizadoEm: '2026-12-05T13:07:00.000Z',
    registradoPor: 'p1',
    recebidoEm: '2026-12-05T13:07:00.000Z',
    ...over,
  };
}

const linhas = montarLinhas(
  [
    conv({ nome: 'Zé', grupoId: 'g10', registradoPor: 'p2' }),
    conv({ nome: 'Maria', apelido: 'Lia', idade: 12, whatsapp: '87999998888', responsavelNome: 'Ana', responsavelTelefone: '8738611234' }),
    conv({ nome: 'Ana; "Aninha"', endereco: 'Sítio Boa Vista\nperto da escola', grupoId: 'gx' }),
  ],
  grupos,
  pessoas,
);

describe('exportação', () => {
  it('ordena por grupo (2 antes de 10) e formata telefones', () => {
    expect(linhas.map((l) => l.grupo)).toEqual(['Grupo 2', 'Grupo 10', 'Grupo removido']);
    const maria = linhas.find((l) => l.nome === 'Maria')!;
    expect(maria.whatsapp).toBe('(87) 99999-8888');
    expect(maria.telefoneResponsavel).toBe('(87) 3861-1234');
    expect(maria.lider).toBe('Líder Um');
  });

  it('CSV com ; e BOM, escapando aspas e quebras de linha', () => {
    const csv = gerarCSV(linhas);
    expect(csv.startsWith('﻿Grupo;Nome;')).toBe(true);
    expect(csv).toContain('"Ana; ""Aninha"""');
    expect(csv).toContain('"Sítio Boa Vista\nperto da escola"');
    expect(csv.trim().split('\r\n')).toHaveLength(4);
  });

  it('texto para WhatsApp com numeração e responsável', () => {
    const t = gerarTexto({ nome: 'Impacto Teste', local: 'Cidade - PI' }, linhas);
    expect(t).toContain('*Impacto Teste* — Cidade - PI');
    expect(t).toContain('Pessoas alcançadas para acompanhamento: 3 pessoas');
    expect(t).toMatch(/\d\. \*Maria\* \("Lia"\), 12 anos/);
    expect(t).toContain('Responsável: Ana · (87) 3861-1234');
  });

  it('nome de aba válido e sem repetir', () => {
    const usados = new Set<string>();
    expect(nomeAba('Grupo 1', usados)).toBe('Grupo 1');
    expect(nomeAba('Grupo 1', usados)).toBe('Grupo 1 (2)');
    expect(nomeAba('A/B:C*[x]', usados)).toBe('A B C  x');
    expect(nomeAba('x'.repeat(40), usados)).toHaveLength(31);
  });

  it('nome de arquivo sem acento', () => {
    expect(nomeArquivo({ nome: 'Impacto Pilão Arcado', local: null }, 'xlsx', new Date(2026, 11, 5))).toBe(
      'conversoes_impacto-pilao-arcado_2026-12-05.xlsx',
    );
  });

  it('gera um .xlsx válido (zip)', async () => {
    const blob = await gerarXlsx(linhas);
    const buffer = await new Promise<ArrayBuffer>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as ArrayBuffer);
      r.readAsArrayBuffer(blob);
    });
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0x50); // "PK": arquivo zip, formato do .xlsx
    expect(bytes[1]).toBe(0x4b);
    expect(blob.size).toBeGreaterThan(2000);
  });
});
