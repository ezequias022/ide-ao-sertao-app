import type { Repositorio } from '../dados/repositorio';
import { ErroRecusado, ErroSemConexao, type Conversao } from '../dados/tipos';
import { ehErroPassageiro, motivoRecusa } from '../dados/erros';
import type { BancoLocal, ItemFila } from './bancoLocal';

export interface ResultadoEnvio {
  enviados: number;
  recusados: number;
  pendentes: number;
  semConexao: boolean;
}

/**
 * Fila de envio das conversões.
 *
 * 1. Salvar sempre grava primeiro no aparelho (funciona sem internet).
 * 2. O envio tenta um por um, na ordem em que foram registrados.
 * 3. Sem conexão: para e deixa o resto para a próxima tentativa.
 * 4. Recusado pelo servidor: marca com erro e segue para o próximo.
 * 5. Confirmado: tira os dados pessoais do aparelho, fica só o nome.
 */
export class Sincronizador {
  private enviando: Promise<ResultadoEnvio> | null = null;

  constructor(
    private readonly banco: BancoLocal,
    private readonly repo: Repositorio,
  ) {}

  /** Guarda uma conversão nova no aparelho. */
  async registrar(usuarioId: string, c: Conversao): Promise<void> {
    await this.banco.fila.put({
      id: c.id,
      usuarioId,
      operacao: 'inserir',
      dados: c,
      status: 'pendente',
      erro: null,
      tentativas: 0,
      criadoEm: new Date().toISOString(),
    });
  }

  /**
   * Guarda uma correção. Se o registro ainda não subiu, só troca os dados
   * na fila (ele sobe já corrigido). Se já subiu, entra como atualização.
   */
  async corrigir(usuarioId: string, c: Conversao): Promise<void> {
    await this.banco.transaction('rw', this.banco.fila, async () => {
      const existente = await this.banco.fila.get(c.id);
      await this.banco.fila.put({
        id: c.id,
        usuarioId,
        operacao: existente?.operacao === 'inserir' ? 'inserir' : 'atualizar',
        dados: c,
        status: 'pendente',
        erro: null,
        tentativas: 0,
        criadoEm: existente?.criadoEm ?? new Date().toISOString(),
      });
    });
  }

  /** Descarta um item recusado (o admin vai lançar pelo painel). */
  async descartar(id: string): Promise<void> {
    await this.banco.fila.delete(id);
  }

  /** Volta um item recusado para a fila, para tentar de novo. */
  async tentarDeNovo(id: string): Promise<void> {
    await this.banco.fila.update(id, { status: 'pendente', erro: null });
  }

  /** Envia o que estiver pendente. Chamadas simultâneas reaproveitam o mesmo envio. */
  enviarPendentes(usuarioId: string): Promise<ResultadoEnvio> {
    if (!this.enviando) {
      this.enviando = this.executar(usuarioId).finally(() => {
        this.enviando = null;
      });
    }
    return this.enviando;
  }

  private async executar(usuarioId: string): Promise<ResultadoEnvio> {
    const resultado: ResultadoEnvio = { enviados: 0, recusados: 0, pendentes: 0, semConexao: false };

    const itens = await this.banco.fila
      .where('[usuarioId+status]')
      .equals([usuarioId, 'pendente'])
      .sortBy('criadoEm');

    for (const item of itens) {
      try {
        if (item.operacao === 'inserir') await this.repo.enviarConversao(item.dados);
        else await this.repo.atualizarConversao(item.dados);
        await this.confirmar(item);
        resultado.enviados++;
      } catch (erro) {
        if (erro instanceof ErroSemConexao || (!(erro instanceof ErroRecusado) && ehErroPassageiro(erro))) {
          await this.banco.fila.update(item.id, { tentativas: item.tentativas + 1 });
          resultado.semConexao = true;
          break; // sem internet: não adianta tentar os próximos agora
        }
        await this.banco.fila.update(item.id, {
          status: 'erro',
          erro: erro instanceof ErroRecusado ? erro.message : motivoRecusa(erro),
          tentativas: item.tentativas + 1,
        });
        resultado.recusados++;
      }
    }

    resultado.pendentes = await this.banco.fila
      .where('[usuarioId+status]')
      .equals([usuarioId, 'pendente'])
      .count();
    return resultado;
  }

  /** Servidor confirmou: tira da fila e guarda só o nome. */
  private async confirmar(item: ItemFila): Promise<void> {
    await this.banco.transaction('rw', this.banco.fila, this.banco.enviados, async () => {
      // Se o líder corrigiu enquanto este envio estava a caminho, a versão nova fica na fila.
      const atual = await this.banco.fila.get(item.id);
      if (atual && atual.dados.atualizadoEm === item.dados.atualizadoEm) {
        await this.banco.fila.delete(item.id);
      } else if (atual && atual.operacao === 'inserir') {
        await this.banco.fila.update(item.id, { operacao: 'atualizar' });
      }
      const anterior = await this.banco.enviados.get(item.id);
      await this.banco.enviados.put({
        id: item.id,
        usuarioId: item.usuarioId,
        eventoId: item.dados.eventoId,
        grupoId: item.dados.grupoId,
        nome: item.dados.nome,
        registradoEm: item.dados.registradoEm,
        enviadoEm: anterior?.enviadoEm ?? new Date().toISOString(),
      });
    });
  }
}
