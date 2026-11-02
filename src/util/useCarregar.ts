import { useCallback, useEffect, useRef, useState } from 'react';
import { traduzirErro } from '../dados/erros';
import { gravarCache, lerCache } from './cacheLocal';

interface Carregamento<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: string | null;
  /** Quando os dados vieram do cache do aparelho (sem internet), a hora em que foram salvos. */
  doCacheDe: Date | null;
  recarregar: () => Promise<void>;
}

interface Opcoes {
  /** Guarda o resultado no aparelho e usa quando não houver internet. */
  cache?: string | null;
}

/** Carrega dados de uma função assíncrona, com carregamento, erro traduzido e cache opcional. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: unknown[], opcoes: Opcoes = {}): Carregamento<T> {
  const chave = opcoes.cache ?? null;
  const [dados, setDados] = useState<T | undefined>(() => (chave ? lerCache<T>(chave)?.valor : undefined));
  const [doCacheDe, setDoCacheDe] = useState<Date | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const montado = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(buscar, deps);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await executar();
      if (!montado.current) return;
      setDados(resultado);
      setDoCacheDe(null);
      if (chave) gravarCache(chave, resultado);
    } catch (e) {
      if (!montado.current) return;
      const guardado = chave ? lerCache<T>(chave) : null;
      if (guardado) {
        setDados(guardado.valor);
        setDoCacheDe(guardado.salvoEm);
      } else {
        setErro(traduzirErro(e).message);
      }
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, [executar, chave]);

  useEffect(() => {
    montado.current = true;
    void recarregar();
    return () => {
      montado.current = false;
    };
  }, [recarregar]);

  return { dados, carregando, erro, doCacheDe, recarregar };
}
