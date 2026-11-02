import type { ConversaoAdmin, Grupo, Pessoa } from '../dados/tipos';
import { formatarTelefone, normalizar } from '../util/formatar';

/** Uma linha da lista para o pastor local, já formatada. */
export interface LinhaExport {
  grupo: string;
  nome: string;
  apelido: string;
  idade: number | null;
  whatsapp: string;
  endereco: string;
  responsavel: string;
  telefoneResponsavel: string;
  registradoEm: Date;
  lider: string;
}

export interface EventoExport {
  nome: string;
  local: string | null;
}

/** Junta conversões com nomes de grupos e líderes. Ordena por grupo e depois por nome. */
export function montarLinhas(conversoes: ConversaoAdmin[], grupos: Grupo[], pessoas: Pessoa[]): LinhaExport[] {
  const grupoPorId = new Map(grupos.map((g) => [g.id, g.nome]));
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p.nome]));
  return conversoes
    .map((c) => ({
      grupo: grupoPorId.get(c.grupoId) ?? 'Grupo removido',
      nome: c.nome,
      apelido: c.apelido ?? '',
      idade: c.idade,
      whatsapp: c.whatsapp ? formatarTelefone(c.whatsapp) : '',
      endereco: c.endereco,
      responsavel: c.responsavelNome ?? '',
      telefoneResponsavel: c.responsavelTelefone ? formatarTelefone(c.responsavelTelefone) : '',
      registradoEm: new Date(c.registradoEm),
      lider: pessoaPorId.get(c.registradoPor) ?? '',
    }))
    .sort(
      (a, b) =>
        a.grupo.localeCompare(b.grupo, 'pt-BR', { numeric: true }) || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

const CABECALHO = [
  'Grupo',
  'Nome',
  'Apelido',
  'Idade',
  'WhatsApp',
  'Endereço',
  'Responsável',
  'Telefone do responsável',
  'Registrado em',
  'Registrado por',
] as const;

function dataHoraBR(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function valores(l: LinhaExport): Array<string | number> {
  return [
    l.grupo,
    l.nome,
    l.apelido,
    l.idade ?? '',
    l.whatsapp,
    l.endereco,
    l.responsavel,
    l.telefoneResponsavel,
    dataHoraBR(l.registradoEm),
    l.lider,
  ];
}

/** CSV no padrão do Excel brasileiro: separador ";" e BOM para os acentos abrirem certo. */
export function gerarCSV(linhas: LinhaExport[]): string {
  const celula = (v: string | number) => {
    const t = String(v);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = [CABECALHO as readonly string[], ...linhas.map(valores)]
    .map((r) => r.map(celula).join(';'))
    .join('\r\n');
  return '﻿' + corpo + '\r\n';
}

/** Texto pronto para colar no WhatsApp do pastor local. */
export function gerarTexto(evento: EventoExport, linhas: LinhaExport[]): string {
  const titulo = `*${evento.nome}*${evento.local ? ` — ${evento.local}` : ''}`;
  const total = linhas.length === 1 ? '1 pessoa' : `${linhas.length} pessoas`;
  const blocos = linhas.map((l, i) => {
    const partes = [
      `${i + 1}. *${l.nome}*${l.apelido ? ` ("${l.apelido}")` : ''}${l.idade !== null ? `, ${l.idade} anos` : ''}`,
    ];
    if (l.whatsapp) partes.push(`   WhatsApp: ${l.whatsapp}`);
    partes.push(`   Endereço: ${l.endereco}`);
    if (l.responsavel || l.telefoneResponsavel) {
      partes.push(`   Responsável: ${[l.responsavel, l.telefoneResponsavel].filter(Boolean).join(' · ')}`);
    }
    return partes.join('\n');
  });
  return [
    titulo,
    `Pessoas alcançadas para acompanhamento: ${total}`,
    '',
    blocos.join('\n\n'),
    '',
    '_Missão Ide ao Sertão. Dados compartilhados com consentimento, só para acompanhamento pastoral._',
  ].join('\n');
}

/** Nome de aba do Excel: até 31 caracteres, sem : \ / ? * [ ] */
export function nomeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Grupo';
  let final = base;
  let n = 2;
  while (usados.has(final.toLowerCase())) {
    const sufixo = ` (${n++})`;
    final = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(final.toLowerCase());
  return final;
}

/** Planilha Excel: uma aba com todos e uma aba por grupo. */
export async function gerarXlsx(linhas: LinhaExport[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const cabecalho = CABECALHO.map((t) => ({ value: t, fontWeight: 'bold' as const, backgroundColor: '#F0E9DC' }));
  const larguras = [12, 28, 18, 7, 17, 44, 24, 20, 17, 24].map((width) => ({ width }));
  const aba = (nome: string, itens: LinhaExport[]) => ({
    sheet: nome,
    data: [cabecalho, ...itens.map((l) => valores(l).map((v) => ({ value: v })))],
    columns: larguras,
    stickyRowsCount: 1,
  });

  const usados = new Set<string>();
  const abas = [aba(nomeAba('Todos', usados), linhas)];
  const grupos = [...new Set(linhas.map((l) => l.grupo))];
  for (const g of grupos) abas.push(aba(nomeAba(g, usados), linhas.filter((l) => l.grupo === g)));

  return writeXlsxFile(abas, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
}

/** "Impacto Pilão Arcado" → "conversoes_impacto-pilao-arcado_2026-12-05" */
export function nomeArquivo(evento: EventoExport, extensao: string, hoje = new Date()): string {
  const slug = normalizar(evento.nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const p = (n: number) => String(n).padStart(2, '0');
  const data = `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;
  return `conversoes_${slug || 'evento'}_${data}.${extensao}`;
}
