import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import { addCircleOutline, calendarOutline, chevronForward, informationCircleOutline } from 'ionicons/icons';
import { repositorio, type EventoSite } from '../../dados';
import { traduzirErro } from '../../dados/erros';
import { useCarregar } from '../../util/useCarregar';
import { periodo } from '../../util/formatar';
import { Carregando, ErroCarregar, Vazio } from '../../componentes/Estado';
import { StatusBadge } from '../../componentes/StatusBadge';
import './Admin.css';

export default function AdminEventos() {
  const router = useIonRouter();
  const [alerta] = useIonAlert();
  const [toast] = useIonToast();
  const [criando, setCriando] = useState<string | null>(null);
  const { dados, carregando, erro, recarregar } = useCarregar(() => repositorio.eventosSite(), []);

  const noApp = dados?.filter((e) => e.appEventoId) ?? [];
  const foraDoApp = dados?.filter((e) => !e.appEventoId) ?? [];

  function confirmarCriacao(ev: EventoSite) {
    void alerta({
      header: 'Criar no app?',
      message: `"${ev.nome}" vai virar um impacto no app, com status Planejado. Depois você monta os grupos e escala os líderes.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Criar', handler: () => void criar(ev) },
      ],
    });
  }

  async function criar(ev: EventoSite) {
    setCriando(ev.id);
    try {
      const id = await repositorio.criarImpacto(ev.id);
      await recarregar();
      router.push(`/admin/evento/${id}`);
    } catch (e) {
      void toast({ message: traduzirErro(e, 'criar o impacto').message, duration: 3500, color: 'danger' });
    } finally {
      setCriando(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Admin</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void recarregar().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {carregando && !dados && <Carregando texto="Carregando eventos do site…" />}
        {erro && !dados && <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />}

        {dados && dados.length === 0 && (
          <Vazio icone={calendarOutline} titulo="Nenhum evento no site">
            <p>Cadastre o evento primeiro no painel admin do site. Depois ele aparece aqui.</p>
          </Vazio>
        )}

        {noApp.length > 0 && (
          <>
            <h3 className="ias-secao">Impactos no app</h3>
            <IonList inset lines="full" className="admin-lista">
              {noApp.map((ev) => (
                <IonItem
                  key={ev.id}
                  button
                  detail={false}
                  routerLink={`/admin/evento/${ev.appEventoId}`}
                  className="admin-evento"
                >
                  <IonLabel>
                    <h2>{ev.nome}</h2>
                    <p>
                      {[ev.local, periodo(ev.dataInicio, ev.dataFim)].filter(Boolean).join(' · ')}
                    </p>
                  </IonLabel>
                  {ev.appStatus && <StatusBadge status={ev.appStatus} />}
                  <IonIcon icon={chevronForward} slot="end" color="medium" />
                </IonItem>
              ))}
            </IonList>
          </>
        )}

        {foraDoApp.length > 0 && (
          <>
            <h3 className="ias-secao">Eventos do site</h3>
            <div className="ias-aviso">
              <IonIcon icon={informationCircleOutline} />
              <span>Estes eventos estão cadastrados no site, mas ainda não foram criados no app.</span>
            </div>
            <IonList inset lines="full" className="admin-lista">
              {foraDoApp.map((ev) => (
                <IonItem key={ev.id} className="admin-evento">
                  <IonLabel>
                    <h2>{ev.nome}</h2>
                    <p>
                      {[ev.local, periodo(ev.dataInicio, ev.dataFim)].filter(Boolean).join(' · ')}
                    </p>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    fill="outline"
                    size="default"
                    disabled={criando !== null}
                    onClick={() => confirmarCriacao(ev)}
                  >
                    {criando === ev.id ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon icon={addCircleOutline} slot="start" /> Criar
                      </>
                    )}
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
          </>
        )}
        <div style={{ height: 24 }} />
      </IonContent>
    </IonPage>
  );
}
