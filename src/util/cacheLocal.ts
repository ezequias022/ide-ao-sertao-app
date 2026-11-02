/**
 * Cache simples no aparelho (localStorage) para o app abrir sem internet:
 * eventos do líder, placar e a conta logada. Nada de dados pessoais de terceiros aqui.
 */

const PREFIXO = 'ias.cache.';

interface Embrulho<T> {
  salvoEm: string;
  valor: T;
}

export function lerCache<T>(chave: string): { valor: T; salvoEm: Date } | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const e = JSON.parse(bruto) as Embrulho<T>;
    return { valor: e.valor, salvoEm: new Date(e.salvoEm) };
  } catch {
    return null;
  }
}

export function gravarCache<T>(chave: string, valor: T): void {
  try {
    const e: Embrulho<T> = { salvoEm: new Date().toISOString(), valor };
    localStorage.setItem(PREFIXO + chave, JSON.stringify(e));
  } catch {
    /* sem espaço ou indisponível: segue sem cache */
  }
}

export function apagarCachesDoUsuario(usuarioId: string): void {
  try {
    for (const chave of Object.keys(localStorage)) {
      if (chave.startsWith(PREFIXO) && chave.includes(usuarioId)) localStorage.removeItem(chave);
    }
  } catch {
    /* ignora */
  }
}
