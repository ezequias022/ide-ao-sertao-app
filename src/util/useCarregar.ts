import { useCallback, useEffect, useRef, useState } from 'react';
import { traduzirErro } from '../dados/erros';

interface Carregamento<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/** Carrega dados de uma função assíncrona, com estado de carregamento e erro já traduzido. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: unknown[]): Carregamento<T> {
  const [dados, setDados] = useState<T>();
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
      if (montado.current) setDados(resultado);
    } catch (e) {
      if (montado.current) setErro(traduzirErro(e).message);
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, [executar]);

  useEffect(() => {
    montado.current = true;
    void recarregar();
    return () => {
      montado.current = false;
    };
  }, [recarregar]);

  return { dados, carregando, erro, recarregar };
}
