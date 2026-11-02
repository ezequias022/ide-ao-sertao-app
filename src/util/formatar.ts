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

/** Só os dígitos de um telefone digitado. Tira o 55 do país se vier junto. */
export function somenteDigitos(texto: string): string {
  let d = texto.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

/** "87999998888" → "(87) 99999-8888" (vai formatando enquanto digita). */
export function formatarTelefone(digitos: string): string {
  const d = somenteDigitos(digitos);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  // Fixo/digitando: 4 + resto; celular completo (9 dígitos): 5 + 4.
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Telefone completo: DDD + 8 ou 9 dígitos. */
export function telefoneValido(digitos: string): boolean {
  return /^[1-9][0-9]9?[0-9]{8}$/.test(digitos) && (digitos.length === 10 || digitos.length === 11);
}

/** "2026-12-05T13:07:00Z" → "10:07" na hora do aparelho. */
export function hora(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Data e hora curtas: "5 dez, 10:07". */
export function dataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${hora(d)}`;
}
