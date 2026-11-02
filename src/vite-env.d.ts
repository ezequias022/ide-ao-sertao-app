/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODO?: 'supabase' | 'demo';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
  readonly PACKAGE_VERSION?: string;
}
