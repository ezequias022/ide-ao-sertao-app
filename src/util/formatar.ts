import type { StatusEvento } from '../dados/tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-12-05" → "5 dez 2026". Lê a string direto, sem fuso horário. */
export function dataCurta(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return '';
  return `${d} ${MESES[m - 1]} ${a}`;
}

/** Intervalo compacto: "5 a 8 dez 2026", "28 nov a 2 dez 2026". */
export function periodo(inicio: string | null, fim: string | null): string {
  if (!inicio) return '';
  if (!fim || fim === inicio) return dataCurta(inicio);
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);
  if (ai === af && mi === mf) return `${di} a ${df} ${MESES[(mf ?? 1) - 1]} ${af}`;
  if (ai === af) return `${di} ${MESES[(mi ?? 1) - 1]} a ${df} ${MESES[(mf ?? 1) - 1]} ${af}`;
  return `${dataCurta(inicio)} a ${dataCurta(fim)}`;
}

export const ROTULO_STATUS: Record<StatusEvento, string> = {
  planejado: 'Planejado',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
};

export const COR_STATUS: Record<StatusEvento, string> = {
  planejado: 'medium',
  ativo: 'success',
  encerrado: 'dark',
};

/** "João Batista da Silva" → "JB" */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const a = partes[0]?.[0] ?? '';
  const b = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : '';
  return (a + b).toUpperCase();
}

/** Busca sem diferenciar acentos e maiúsculas. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
