import { Capacitor } from '@capacitor/core';

export type ResultadoCompartilhar = 'compartilhado' | 'baixado' | 'copiado' | 'cancelado';

function paraBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

function cancelou(e: unknown): boolean {
  const msg = String((e as { message?: string; name?: string })?.message ?? e);
  return (e as { name?: string })?.name === 'AbortError' || /cancel|abort|dismiss/i.test(msg);
}

/**
 * Abre o menu de compartilhar do celular com o arquivo (WhatsApp, e-mail, Arquivos…).
 * - App Android: grava na pasta temporária do app e usa o compartilhar nativo.
 * - iPhone/navegador: usa o compartilhar do navegador; se não houver, baixa o arquivo.
 */
export async function compartilharArquivo(nome: string, blob: Blob, titulo: string): Promise<ResultadoCompartilhar> {
  try {
    if (Capacitor.isNativePlatform()) {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const gravado = await Filesystem.writeFile({
        path: nome,
        data: await paraBase64(blob),
        directory: Directory.Cache,
      });
      await Share.share({ title: titulo, files: [gravado.uri], dialogTitle: titulo });
      return 'compartilhado';
    }

    const arquivo = new File([blob], nome, { type: blob.type });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: titulo });
      return 'compartilhado';
    }
  } catch (e) {
    if (cancelou(e)) return 'cancelado';
    // Se o compartilhar falhar por outro motivo, cai no download abaixo.
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}

/** Compartilha um texto (para colar no WhatsApp). Sem compartilhar disponível, copia. */
export async function compartilharTexto(texto: string, titulo: string): Promise<ResultadoCompartilhar> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: titulo, text: texto, dialogTitle: titulo });
      return 'compartilhado';
    }
    if (navigator.share) {
      await navigator.share({ title: titulo, text: texto });
      return 'compartilhado';
    }
  } catch (e) {
    if (cancelou(e)) return 'cancelado';
  }
  await navigator.clipboard.writeText(texto);
  return 'copiado';
}
