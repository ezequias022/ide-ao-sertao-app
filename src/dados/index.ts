import type { Repositorio } from './repositorio';
import { DemoRepositorio } from './demoRepositorio';
import { SupabaseRepositorio } from './supabaseRepositorio';

export const modoDemo = import.meta.env.VITE_MODO === 'demo';

/** Instância única usada por todo o app. */
export const repositorio: Repositorio = modoDemo
  ? new DemoRepositorio()
  : new SupabaseRepositorio(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_KEY as string,
    );

export * from './tipos';
export type { Repositorio } from './repositorio';
