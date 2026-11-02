import Dexie, { type EntityTable } from 'dexie';
import type { Conversao } from '../dados/tipos';

/**
 * Banco local do aparelho (IndexedDB). No Android ele fica na pasta do app
 * e só é apagado se o app for desinstalado ou os dados limpos.
 */

export type Operacao = 'inserir' | 'atualizar';
export type StatusFila = 'pendente' | 'erro';

/** Registro esperando para subir. Guarda os dados completos até o servidor confirmar. */
export interface ItemFila {
  id: string; // mesmo id da conversão
  usuarioId: string;
  operacao: Operacao;
  dados: Conversao;
  status: StatusFila;
  erro: string | null;
  tentativas: number;
  criadoEm: string;
}

/**
 * Registro já confirmado pelo servidor. Por segurança (LGPD), aqui fica
 * só o nome — os dados pessoais saem do aparelho assim que sobem.
 */
export interface ItemEnviado {
  id: string;
  usuarioId: string;
  eventoId: string;
  grupoId: string;
  nome: string;
  registradoEm: string;
  enviadoEm: string;
}

export class BancoLocal extends Dexie {
  fila!: EntityTable<ItemFila, 'id'>;
  enviados!: EntityTable<ItemEnviado, 'id'>;

  constructor(nome = 'ide-ao-sertao') {
    super(nome);
    this.version(1).stores({
      fila: 'id, usuarioId, status, criadoEm, [usuarioId+status]',
      enviados: 'id, usuarioId, eventoId, [usuarioId+eventoId]',
    });
  }
}

export const bancoLocal = new BancoLocal();

/** Pede ao navegador para não apagar o banco local por falta de espaço (importante no iPhone). */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
