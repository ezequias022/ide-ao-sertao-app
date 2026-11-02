import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonActionSheet,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  documentTextOutline,
  logoWhatsapp,
  radioOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';
import { repositorio, type ConversaoAdmin, type FormatoExportacao } from '../../dados';
import { traduzirErro } from '../../dados/erros';
import { useCarregar } from '../../util/useCarregar';
import { dataHora, formatarTelefone, normalizar } from '../../util/formatar';
import { Carregando, ErroCarregar, Vazio } from '../../componentes/Estado';
import { gerarCSV, gerarTexto, gerarXlsx, montarLinhas, nomeArquivo } from '../../exportacao/montar';
import { compartilharArquivo, compartilharTexto, type ResultadoCompartilhar } from '../../exportacao/compartilhar';
import './Admin.css';
import './Conversoes.css';

/** Painel ao vivo do admin: todas as conversões do evento, com filtro, detalhe, exclusão e exportação. */
export default function Conversoes() {
  const { id } = useParams<{ id: string }>();
  const [acoes] = useIonActionSheet();
  const [alerta] = useIonAlert();
  const [toast] = useIonToast();
  const [grupoFiltro, setGrupoFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<ConversaoAdmin | null>(null);
  const [exportando, setExportando] = useState(false);

  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [conversoes, grupos, pessoas, eventos] = await Promise.all([
      repositorio.conversoesDoEvento(id),
      repositorio.grupos(id),
      repositorio.pessoas(),
      repositorio.eventosSite(),
    ]);
    const evento = eventos.find((e) => e.appEventoId === id);
    return { conversoes, grupos, pessoas, evento: { nome: evento?.nome ?? 'Evento', local: evento?.local ?? null } };
  }, [id]);

  // Ao vivo: qualquer conversão nova, corrigida ou apagada recarrega a lista.
  useEffect(() => {
    let espera: number | undefined;
    const parar = repositorio.ouvirPlacar(id, () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void recarregar(), 600);
    });
    return () => {
      window.clearTimeout(espera);
      parar();
    };
  }, [id, recarregar]);

  const nomeGrupo = useMemo(() => new Map(dados?.grupos.map((g) => [g.id, g.nome]) ?? []), [dados]);
  const nomePessoa = useMemo(() => new Map(dados?.pessoas.map((p) => [p.id, p.nome]) ?? []), [dados]);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    dados?.conversoes.forEach((c) => m.set(c.grupoId, (m.get(c.grupoId) ?? 0) + 1));
    return m;
  }, [dados]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (dados?.conversoes ?? []).filter(
      (c) =>
        (!grupoFiltro || c.grupoId === grupoFiltro) &&
        (!termo || normalizar(`${c.nome} ${c.apelido ?? ''} ${c.endereco}`).includes(termo)),
    );
  }, [dados, grupoFiltro, busca]);

  // ---------------- Apagar ----------------

  function apagar(c: ConversaoAdmin) {
    void alerta({
      header: 'Apagar esta conversão?',
      message: `${c.nome} sai da lista e do placar. Isso não pode ser desfeito.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Apagar',
          role: 'destructive',
          handler: () => {
            void (async () => {
              try {
                await repositorio.apagarConversao(c.id);
                setAberta(null);
                await recarregar();
                void toast({ message: 'Conversão apagada.', duration: 1800, color: 'success', position: 'top' });
              } catch (e) {
                void toast({ message: traduzirErro(e, 'apagar').message, duration: 3500, color: 'danger', position: 'top' });
              }
            })();
          },
        },
      ],
    });
  }

  // ---------------- Exportar ----------------

  function escolherExportacao() {
    if (!dados || visiveis.length === 0) {
      void toast({ message: 'Não há conversões para exportar.', duration: 2000, position: 'top' });
      return;
    }
    const escopo = grupoFiltro ? nomeGrupo.get(grupoFiltro) : 'todos os grupos';
    void acoes({
      header: `Exportar ${visiveis.length} ${visiveis.length === 1 ? 'pessoa' : 'pessoas'} (${escopo})`,
      subHeader: busca ? 'Atenção: a busca está filtrando a lista.' : undefined,
      buttons: [
        { text: 'Planilha Excel (.xlsx)', handler: () => void exportar('xlsx') },
        { text: 'Texto para o WhatsApp do pastor', handler: () => void exportar('texto') },
        { text: 'CSV (outros sistemas)', handler: () => void exportar('csv') },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
  }

  async function exportar(formato: FormatoExportacao) {
    if (!dados) return;
    setExportando(true);
    try {
      const linhas = montarLinhas(visiveis, dados.grupos, dados.pessoas);
      const titulo = `Conversões — ${dados.evento.nome}`;
      let resultado: ResultadoCompartilhar;
      if (formato === 'texto') {
        resultado = await compartilharTexto(gerarTexto(dados.evento, linhas), titulo);
      } else if (formato === 'csv') {
        const blob = new Blob([gerarCSV(linhas)], { type: 'text/csv;charset=utf-8' });
        resultado = await compartilharArquivo(nomeArquivo(dados.evento, 'csv'), blob, titulo);
      } else {
        resultado = await compartilharArquivo(nomeArquivo(dados.evento, 'xlsx'), await gerarXlsx(linhas), titulo);
      }
      if (resultado === 'cancelado') return;

      // Prestação de contas (LGPD): registra quem exportou o quê.
      repositorio
        .registrarExportacao(id, formato, linhas.length, { grupo: grupoFiltro, busca: busca || null })
        .catch(() => undefined);

      const msg: Record<Exclude<ResultadoCompartilhar, 'cancelado'>, string> = {
        compartilhado: 'Pronto.',
        baixado: 'Arquivo baixado.',
        copiado: 'Texto copiado. É só colar no WhatsApp.',
      };
      void toast({ message: msg[resultado], duration: 2200, color: 'success', position: 'top' });
    } catch (e) {
      void toast({ message: traduzirErro(e, 'exportar').message, duration: 3500, color: 'danger', position: 'top' });
    } finally {
      setExportando(false);
    }
  }

  // ---------------- Tela ----------------

  const total = dados?.conversoes.length ?? 0;
  const zapLink = (d: string) => `https://wa.me/55${d}`;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/admin/evento/${id}`} text="" />
          </IonButtons>
          <IonTitle>Conversões</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={escolherExportacao} disabled={exportando || !dados} aria-label="Exportar">
              {exportando ? <IonSpinner name="crescent" /> : <IonIcon icon={shareOutline} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {dados && total > 0 && (
          <IonToolbar>
            <IonSearchbar
              placeholder="Buscar nome, apelido ou endereço"
              value={busca}
              debounce={150}
              onIonInput={(e) => setBusca(String(e.detail.value ?? ''))}
            />
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void recarregar().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {carregando && !dados && <Carregando />}
        {erro && !dados && <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />}

        {dados && (
          <>
            <div className="conv-resumo">
              <div>
                <strong>{total}</strong> {total === 1 ? 'conversão' : 'conversões'} em {dados.evento.nome}
              </div>
              <span className="conv-ao-vivo">
                <IonIcon icon={radioOutline} /> ao vivo
              </span>
            </div>

            {dados.grupos.length > 0 && total > 0 && (
              <div className="conv-filtros">
                <IonChip outline={grupoFiltro !== null} color="primary" onClick={() => setGrupoFiltro(null)}>
                  Todos ({total})
                </IonChip>
                {dados.grupos.map((g) => (
                  <IonChip
                    key={g.id}
                    outline={grupoFiltro !== g.id}
                    color="primary"
                    onClick={() => setGrupoFiltro(grupoFiltro === g.id ? null : g.id)}
                  >
                    {g.nome} ({contagem.get(g.id) ?? 0})
                  </IonChip>
                ))}
              </div>
            )}

            {total === 0 ? (
              <Vazio icone={documentTextOutline} titulo="Nenhuma conversão ainda">
                <p>Assim que os líderes registrarem, as pessoas aparecem aqui na hora.</p>
              </Vazio>
            ) : visiveis.length === 0 ? (
              <div className="ias-vazio">
                <p>Nada encontrado com esse filtro.</p>
              </div>
            ) : (
              <IonList inset lines="full" className="admin-lista">
                {visiveis.map((c) => (
                  <IonItem key={c.id} button detail={false} onClick={() => setAberta(c)}>
                    <IonLabel>
                      <h2>
                        {c.nome}
                        {c.apelido && <span className="conv-apelido"> “{c.apelido}”</span>}
                      </h2>
                      <p>
                        {nomeGrupo.get(c.grupoId) ?? 'Grupo removido'} · {dataHora(c.registradoEm)}
                        {nomePessoa.get(c.registradoPor) ? ` · ${nomePessoa.get(c.registradoPor)}` : ''}
                      </p>
                    </IonLabel>
                    {c.idade !== null && c.idade < 18 && (
                      <span className="conv-menor" slot="end">
                        menor
                      </span>
                    )}
                  </IonItem>
                ))}
              </IonList>
            )}
            <div style={{ height: 24 }} />
          </>
        )}

        <IonModal
          isOpen={aberta !== null}
          onDidDismiss={() => setAberta(null)}
          initialBreakpoint={0.85}
          breakpoints={[0, 0.85, 1]}
        >
          {aberta && (
            <IonContent className="conv-detalhe">
              <h2 className="ias-titulo">{aberta.nome}</h2>
              {aberta.apelido && <p className="conv-detalhe-apelido">Conhecido como “{aberta.apelido}”</p>}
              <dl>
                <dt>Idade</dt>
                <dd>{aberta.idade !== null ? `${aberta.idade} anos` : '—'}</dd>
                <dt>WhatsApp</dt>
                <dd>{aberta.whatsapp ? formatarTelefone(aberta.whatsapp) : '—'}</dd>
                <dt>Endereço</dt>
                <dd>{aberta.endereco}</dd>
                {(aberta.responsavelNome || aberta.responsavelTelefone) && (
                  <>
                    <dt>Responsável</dt>
                    <dd>
                      {[aberta.responsavelNome, aberta.responsavelTelefone && formatarTelefone(aberta.responsavelTelefone)]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </>
                )}
                <dt>Grupo</dt>
                <dd>{nomeGrupo.get(aberta.grupoId) ?? 'Grupo removido'}</dd>
                <dt>Registrado</dt>
                <dd>
                  {dataHora(aberta.registradoEm)}
                  {nomePessoa.get(aberta.registradoPor) ? ` por ${nomePessoa.get(aberta.registradoPor)}` : ''}
                </dd>
                <dt>Permissão</dt>
                <dd>Autorizou o contato de um pastor local</dd>
              </dl>
              {aberta.whatsapp && (
                <IonButton expand="block" href={zapLink(aberta.whatsapp)} target="_blank" color="success">
                  <IonIcon icon={logoWhatsapp} slot="start" /> Abrir no WhatsApp
                </IonButton>
              )}
              <IonButton expand="block" fill="outline" color="danger" onClick={() => apagar(aberta)}>
                <IonIcon icon={trashOutline} slot="start" /> Apagar conversão
              </IonButton>
            </IonContent>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
