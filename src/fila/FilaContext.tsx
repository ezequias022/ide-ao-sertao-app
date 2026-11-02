import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repositorio, type Conversao } from '../dados';
import { useSessao } from '../sessao/SessaoContext';
import { bancoLocal, pedirArmazenamentoPersistente } from './bancoLocal';
import { Sincronizador } from './sincronizador';

const INTERVALO_MS = 30_000;

interface EstadoFila {
  online: boolean;
  enviando: boolean;
  pendentes: number;
  comErro: number;
  ultimoEnvio: Date | null;
  registrar: (c: Conversao) => Promise<void>;
  corrigir: (c: Conversao) => Promise<void>;
  enviarAgora: () => Promise<void>;
  tentarDeNovo: (id: string) => Promise<void>;
  descartar: (id: string) => Promise<void>;
}

const FilaContext = createContext<EstadoFila | null>(null);

export const sincronizador = new Sincronizador(bancoLocal, repositorio);

export function FilaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useSessao();
  const usuarioId = usuario?.id ?? null;
  const [online, setOnline] = useState(() => navigator.onLine);
  const [enviando, setEnviando] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null);
  const usuarioRef = useRef(usuarioId);
  usuarioRef.current = usuarioId;

  const contagem = useLiveQuery(async () => {
    if (!usuarioId) return { pendentes: 0, comErro: 0 };
    const [pendentes, comErro] = await Promise.all([
      bancoLocal.fila.where('[usuarioId+status]').equals([usuarioId, 'pendente']).count(),
      bancoLocal.fila.where('[usuarioId+status]').equals([usuarioId, 'erro']).count(),
    ]);
    return { pendentes, comErro };
  }, [usuarioId]);

  const pendentes = contagem?.pendentes ?? 0;
  const comErro = contagem?.comErro ?? 0;

  const enviarAgora = useCallback(async () => {
    const id = usuarioRef.current;
    if (!id) return;
    setEnviando(true);
    try {
      const r = await sincronizador.enviarPendentes(id);
      if (r.enviados > 0) setUltimoEnvio(new Date());
      if (!r.semConexao) setOnline(navigator.onLine);
    } finally {
      setEnviando(false);
    }
  }, []);

  // Gatilhos de envio: ao abrir, ao voltar a internet, ao voltar para o app, e de tempos em tempos.
  useEffect(() => {
    if (!usuarioId) return;
    void pedirArmazenamentoPersistente();
    void enviarAgora();

    const aoFicarOnline = () => {
      setOnline(true);
      void enviarAgora();
    };
    const aoFicarOffline = () => setOnline(false);
    const aoVoltarParaApp = () => {
      if (document.visibilityState === 'visible') void enviarAgora();
    };
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    document.addEventListener('visibilitychange', aoVoltarParaApp);
    return () => {
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
      document.removeEventListener('visibilitychange', aoVoltarParaApp);
    };
  }, [usuarioId, enviarAgora]);

  useEffect(() => {
    if (!usuarioId || pendentes === 0) return;
    const t = window.setInterval(() => void enviarAgora(), INTERVALO_MS);
    return () => window.clearInterval(t);
  }, [usuarioId, pendentes, enviarAgora]);

  const registrar = useCallback(
    async (c: Conversao) => {
      if (!usuarioRef.current) throw new Error('Sem usuário logado');
      await sincronizador.registrar(usuarioRef.current, c);
      void enviarAgora();
    },
    [enviarAgora],
  );

  const corrigir = useCallback(
    async (c: Conversao) => {
      if (!usuarioRef.current) throw new Error('Sem usuário logado');
      await sincronizador.corrigir(usuarioRef.current, c);
      void enviarAgora();
    },
    [enviarAgora],
  );

  const tentarDeNovo = useCallback(
    async (id: string) => {
      await sincronizador.tentarDeNovo(id);
      void enviarAgora();
    },
    [enviarAgora],
  );

  const descartar = useCallback((id: string) => sincronizador.descartar(id), []);

  const valor = useMemo(
    () => ({ online, enviando, pendentes, comErro, ultimoEnvio, registrar, corrigir, enviarAgora, tentarDeNovo, descartar }),
    [online, enviando, pendentes, comErro, ultimoEnvio, registrar, corrigir, enviarAgora, tentarDeNovo, descartar],
  );

  return <FilaContext.Provider value={valor}>{children}</FilaContext.Provider>;
}

export function useFila(): EstadoFila {
  const ctx = useContext(FilaContext);
  if (!ctx) throw new Error('useFila precisa estar dentro de <FilaProvider>');
  return ctx;
}
