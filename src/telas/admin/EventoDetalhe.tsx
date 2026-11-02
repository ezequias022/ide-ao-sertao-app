import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonActionSheet,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  addOutline,
  alertCircleOutline,
  calendarOutline,
  ellipsisVertical,
  locationOutline,
  peopleOutline,
  podiumOutline,
} from 'ionicons/icons';
import { repositorio, type Grupo, type Pessoa, type StatusEvento } from '../../dados';
import { traduzirErro } from '../../dados/erros';
import { useCarregar } from '../../util/useCarregar';
import { iniciais, periodo } from '../../util/formatar';
import { Carregando, ErroCarregar, Vazio } from '../../componentes/Estado';
import { EscolherLider } from './EscolherLider';
import './Admin.css';

const DICA_STATUS: Record<StatusEvento, string> = {
  planejado: 'Os líderes já veem o evento, mas ainda não conseguem registrar.',
  ativo: 'Os líderes escalados podem registrar conversões agora.',
  encerrado: 'Registros fechados. Só os admins podem corrigir ou exportar.',
};

/** Próximo nome livre: "Grupo 1", "Grupo 2"… */
function sugerirNome(grupos: Grupo[]): string {
  const usados = new Set(grupos.map((g) => g.nome));
  let n = grupos.length + 1;
  while (usados.has(`Grupo ${n}`)) n++;
  return `Grupo ${n}`;
}

export default function EventoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [alerta] = useIonAlert();
  const [acoes] = useIonActionSheet();
  const [toast] = useIonToast();
  const [grupoEscolhendo, setGrupoEscolhendo] = useState<Grupo | null>(null);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  // Remonta o seletor de status quando a troca é cancelada ou falha,
  // para ele voltar a mostrar o status real.
  const [chaveStatus, setChaveStatus] = useState(0);

  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [eventos, grupos, pessoas] = await Promise.all([
      repositorio.eventosSite(),
      repositorio.grupos(id),
      repositorio.pessoas(),
    ]);
    const evento = eventos.find((e) => e.appEventoId === id) ?? null;
    return { evento, grupos, pessoas };
  }, [id]);

  const pessoaPorId = useMemo(() => {
    const mapa = new Map<string, Pessoa>();
    dados?.pessoas.forEach((p) => mapa.set(p.id, p));
    return mapa;
  }, [dados]);

  const avisar = useCallback(
    (mensagem: string, cor: 'success' | 'danger' = 'success') =>
      void toast({ message: mensagem, duration: cor === 'danger' ? 3500 : 1800, color: cor, position: 'top' }),
    [toast],
  );

  async function executar(acao: () => Promise<unknown>, sucesso: string, contexto: string): Promise<boolean> {
    try {
      await acao();
      await recarregar();
      avisar(sucesso);
      return true;
    } catch (e) {
      avisar(traduzirErro(e, contexto).message, 'danger');
      return false;
    }
  }

  // ---------------- Status ----------------

  async function salvarStatus(novo: StatusEvento) {
    setSalvandoStatus(true);
    const ok = await executar(
      () => repositorio.alterarStatus(id, novo),
      novo === 'ativo' ? 'Evento ativado. Os líderes já podem registrar.' : 'Status atualizado.',
      'alterar o status',
    );
    if (!ok) setChaveStatus((k) => k + 1);
    setSalvandoStatus(false);
  }

  function pedirStatus(novo: StatusEvento) {
    const atual = dados?.evento?.appStatus;
    if (!novo || novo === atual) return;
    if (novo === 'encerrado') {
      void alerta({
        header: 'Encerrar o evento?',
        message: 'Os líderes não vão mais conseguir registrar nem corrigir. Você pode reabrir depois, se precisar.',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Encerrar', role: 'destructive', handler: () => void salvarStatus('encerrado') },
        ],
        // Cancelar ou tocar fora: o seletor volta para o status real.
        onDidDismiss: (e) => {
          if (e.detail.role !== 'destructive') setChaveStatus((k) => k + 1);
        },
      });
      return;
    }
    void salvarStatus(novo);
  }

  // ---------------- Grupos ----------------

  function novoGrupo() {
    const grupos = dados?.grupos ?? [];
    void alerta({
      header: 'Novo grupo',
      inputs: [{ name: 'nome', type: 'text', value: sugerirNome(grupos), attributes: { maxlength: 60 } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Criar',
          handler: (valores: { nome?: string }) => {
            const nome = (valores.nome ?? '').trim();
            if (!nome) return false;
            void executar(() => repositorio.criarGrupo(id, nome), `${nome} criado.`, 'criar o grupo');
            return true;
          },
        },
      ],
    });
  }

  function renomear(grupo: Grupo) {
    void alerta({
      header: 'Renomear grupo',
      inputs: [{ name: 'nome', type: 'text', value: grupo.nome, attributes: { maxlength: 60 } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: (valores: { nome?: string }) => {
            const nome = (valores.nome ?? '').trim();
            if (!nome || nome === grupo.nome) return true;
            void executar(() => repositorio.renomearGrupo(grupo.id, nome), 'Grupo renomeado.', 'renomear o grupo');
            return true;
          },
        },
      ],
    });
  }

  function remover(grupo: Grupo) {
    void alerta({
      header: `Remover o ${grupo.nome}?`,
      message: 'Só dá para remover um grupo que ainda não tem conversões registradas.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover',
          role: 'destructive',
          handler: () => void executar(() => repositorio.removerGrupo(grupo.id), 'Grupo removido.', 'remover o grupo'),
        },
      ],
    });
  }

  function tirarLider(grupo: Grupo) {
    const nome = grupo.liderId ? pessoaPorId.get(grupo.liderId)?.nome : undefined;
    void alerta({
      header: 'Tirar o líder?',
      message: `${nome ?? 'O líder'} deixa de liderar o ${grupo.nome}. Os registros que ele já fez continuam no nome dele, e o que estiver pendente no celular dele ainda pode ser enviado enquanto o evento estiver ativo.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Tirar',
          role: 'destructive',
          handler: () => void executar(() => repositorio.definirLider(grupo.id, null), 'Líder removido.', 'tirar o líder'),
        },
      ],
    });
  }

  function opcoes(grupo: Grupo) {
    void acoes({
      header: grupo.nome,
      buttons: [
        { text: grupo.liderId ? 'Trocar líder' : 'Escalar líder', handler: () => setGrupoEscolhendo(grupo) },
        ...(grupo.liderId ? [{ text: 'Tirar líder', handler: () => tirarLider(grupo) }] : []),
        { text: 'Renomear', handler: () => renomear(grupo) },
        { text: 'Remover grupo', role: 'destructive', handler: () => remover(grupo) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
  }

  async function escolher(pessoa: Pessoa) {
    const grupo = grupoEscolhendo;
    setGrupoEscolhendo(null);
    if (!grupo) return;
    await executar(
      () => repositorio.definirLider(grupo.id, pessoa.id),
      `${pessoa.nome} agora lidera o ${grupo.nome}.`,
      'escalar o líder',
    );
  }

  // ---------------- Tela ----------------

  const evento = dados?.evento;
  const grupos = dados?.grupos ?? [];
  const semLider = grupos.filter((g) => !g.liderId).length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin" text="Admin" />
          </IonButtons>
          <IonTitle>Montar evento</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void recarregar().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {carregando && !dados && <Carregando />}
        {erro && !dados && <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />}

        {dados && !evento && (
          <Vazio icone={alertCircleOutline} titulo="Evento não encontrado">
            <p>Ele pode ter sido removido do site.</p>
          </Vazio>
        )}

        {evento && (
          <>
            <div className="detalhe-topo">
              <h1 className="ias-titulo">{evento.nome}</h1>
              <div className="evento-info">
                {evento.local && (
                  <span>
                    <IonIcon icon={locationOutline} /> {evento.local}
                  </span>
                )}
                {evento.dataInicio && (
                  <span>
                    <IonIcon icon={calendarOutline} /> {periodo(evento.dataInicio, evento.dataFim)}
                  </span>
                )}
              </div>
            </div>

            <h3 className="ias-secao">Status</h3>
            <div className="detalhe-status">
              <IonSegment
                key={chaveStatus}
                value={evento.appStatus ?? 'planejado'}
                disabled={salvandoStatus}
                onIonChange={(e) => pedirStatus(e.detail.value as StatusEvento)}
              >
                <IonSegmentButton value="planejado">
                  <IonLabel>Planejado</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="ativo">
                  <IonLabel>Ativo</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="encerrado">
                  <IonLabel>Encerrado</IonLabel>
                </IonSegmentButton>
              </IonSegment>
              {evento.appStatus && <p className="detalhe-dica">{DICA_STATUS[evento.appStatus]}</p>}
              <IonButton expand="block" fill="outline" routerLink={`/placar/${id}`} className="detalhe-placar">
                <IonIcon icon={podiumOutline} slot="start" /> Ver placar ao vivo
              </IonButton>
            </div>

            <div className="detalhe-grupos-cab">
              <h3 className="ias-secao">
                Grupos {grupos.length > 0 && `(${grupos.length})`}
              </h3>
              <IonButton fill="clear" onClick={novoGrupo}>
                <IonIcon icon={addOutline} slot="start" /> Novo grupo
              </IonButton>
            </div>

            {semLider > 0 && (
              <div className="ias-aviso">
                <IonIcon icon={alertCircleOutline} />
                <span>
                  {semLider === 1 ? '1 grupo está sem líder.' : `${semLider} grupos estão sem líder.`} Grupo
                  sem líder não consegue registrar.
                </span>
              </div>
            )}

            {grupos.length === 0 ? (
              <Vazio icone={peopleOutline} titulo="Nenhum grupo ainda">
                <p>Crie os grupos de missionários e escale um líder para cada um.</p>
                <IonButton onClick={novoGrupo}>
                  <IonIcon icon={addOutline} slot="start" /> Criar o primeiro grupo
                </IonButton>
              </Vazio>
            ) : (
              <IonList inset lines="full" className="admin-lista">
                {grupos.map((g) => {
                  const lider = g.liderId ? pessoaPorId.get(g.liderId) : undefined;
                  return (
                    <IonItem key={g.id} button detail={false} onClick={() => opcoes(g)} className="grupo-item">
                      <div className={`ias-avatar${lider ? '' : ' vazio'}`} slot="start">
                        {lider ? iniciais(lider.nome) : '?'}
                      </div>
                      <IonLabel>
                        <h2>{g.nome}</h2>
                        <p className={lider ? '' : 'grupo-sem-lider'}>
                          {lider ? lider.nome : g.liderId ? 'Líder (conta não encontrada)' : 'Sem líder — toque para escalar'}
                        </p>
                      </IonLabel>
                      <IonIcon icon={ellipsisVertical} slot="end" color="medium" aria-label="Opções" />
                    </IonItem>
                  );
                })}
              </IonList>
            )}
          </>
        )}
        <div style={{ height: 32 }} />

        <EscolherLider
          aberto={grupoEscolhendo !== null}
          grupo={grupoEscolhendo}
          grupos={grupos}
          pessoas={dados?.pessoas ?? []}
          aoFechar={() => setGrupoEscolhendo(null)}
          aoEscolher={(p) => void escolher(p)}
        />
      </IonContent>
    </IonPage>
  );
}
