import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { repositorio, type Usuario } from '../dados';
import { apagarCachesDoUsuario, gravarCache, lerCache } from '../util/cacheLocal';

interface EstadoSessao {
  carregando: boolean;
  usuario: Usuario | null;
  admin: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const SessaoContext = createContext<EstadoSessao | null>(null);

// O papel de admin fica guardado no aparelho para o app abrir certo sem internet.
const chaveAdmin = (id: string) => `ias.admin.${id}`;
const lerAdminGuardado = (id: string) => {
  try {
    return localStorage.getItem(chaveAdmin(id)) === '1';
  } catch {
    return false;
  }
};
// Conta guardada para abrir o app sem internet (a sessão do Supabase pode ter
// vencido enquanto o líder está no campo; ela renova sozinha quando volta o sinal).
const CHAVE_CONTA = 'conta';

const guardarAdmin = (id: string, admin: boolean) => {
  try {
    localStorage.setItem(chaveAdmin(id), admin ? '1' : '0');
  } catch {
    /* armazenamento indisponível: segue sem cache */
  }
};

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [admin, setAdmin] = useState(false);

  const atualizarPapel = useCallback(async (u: Usuario | null) => {
    if (!u) {
      setAdmin(false);
      return;
    }
    setAdmin(lerAdminGuardado(u.id));
    try {
      const ehAdmin = await repositorio.souAdmin();
      setAdmin(ehAdmin);
      guardarAdmin(u.id, ehAdmin);
    } catch {
      // Sem internet: fica com o valor guardado.
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    repositorio
      .usuarioAtual()
      .catch(() => null)
      .then(async (u) => {
        if (!ativo) return;
        // Sem internet e sem sessão válida: usa a conta guardada no aparelho.
        const conta = u ?? (navigator.onLine ? null : (lerCache<Usuario>(CHAVE_CONTA)?.valor ?? null));
        setUsuario(conta);
        await atualizarPapel(conta);
      })
      .finally(() => ativo && setCarregando(false));

    const cancelar = repositorio.aoMudarSessao((u) => {
      setUsuario((anterior) => {
        // Sem internet a renovação da sessão falha; isso não é "sair".
        if (!u && anterior && !navigator.onLine) return anterior;
        if (anterior?.id !== u?.id) void atualizarPapel(u);
        return u;
      });
    });
    return () => {
      ativo = false;
      cancelar();
    };
  }, [atualizarPapel]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const u = await repositorio.entrar(email, senha);
      gravarCache(CHAVE_CONTA, u);
      setUsuario(u);
      await atualizarPapel(u);
    },
    [atualizarPapel],
  );

  const sair = useCallback(async () => {
    const id = (await repositorio.usuarioAtual().catch(() => null))?.id ?? lerCache<Usuario>(CHAVE_CONTA)?.valor.id;
    await repositorio.sair();
    if (id) apagarCachesDoUsuario(id);
    try {
      localStorage.removeItem('ias.cache.' + CHAVE_CONTA);
    } catch {
      /* ignora */
    }
    // Recarrega o app do zero: limpa da memória tudo o que era da conta
    // anterior e o próximo login começa pela tela inicial.
    window.location.hash = '#/inicio';
    window.location.reload();
  }, []);

  const valor = useMemo(
    () => ({ carregando, usuario, admin, entrar, sair }),
    [carregando, usuario, admin, entrar, sair],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao(): EstadoSessao {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return ctx;
}
