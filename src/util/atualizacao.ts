import { Capacitor } from '@capacitor/core';

const REPO = 'ezequias022/ide-ao-sertao-app';
export const VERSAO_APP: string = import.meta.env.PACKAGE_VERSION ?? '0.0.0';

export interface VersaoNova {
  versao: string;
  urlApk: string;
}

/** "0.10.2" > "0.9.9" */
export function ehMaisNova(candidata: string, atual: string): boolean {
  const a = candidata.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const b = atual.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/**
 * Só no app Android: confere no GitHub se saiu APK novo.
 * (A versão iPhone/navegador se atualiza sozinha pelo service worker.)
 */
export async function procurarAtualizacao(): Promise<VersaoNova | null> {
  if (!Capacitor.isNativePlatform() || !navigator.onLine) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return null;
    const rel = (await r.json()) as { tag_name: string; assets: Array<{ name: string; browser_download_url: string }> };
    const apk = rel.assets.find((a) => a.name.endsWith('.apk'));
    if (!apk || !ehMaisNova(rel.tag_name, VERSAO_APP)) return null;
    return { versao: rel.tag_name.replace(/^v/, ''), urlApk: apk.browser_download_url };
  } catch {
    return null;
  }
}
