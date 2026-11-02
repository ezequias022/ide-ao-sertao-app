import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { calendarOutline, locationOutline, peopleOutline, personAddOutline, podiumOutline, timeOutline } from 'ionicons/icons';
import { repositorio, type MeuEvento } from '../dados';
import { useCarregar } from '../util/useCarregar';
import { periodo } from '../util/formatar';
import { Carregando, ErroCarregar, Vazio } from '../componentes/Estado';
import { StatusBadge } from '../componentes/StatusBadge';
import { useSessao } from '../sessao/SessaoContext';
import { BarraSync } from '../componentes/BarraSync';
import { dataHora } from '../util/formatar';
import { gravarCache } from '../util/cacheLocal';
import { useEffect } from 'react';
import './Inicio.css';

function CartaoEvento({ ev, destaque }: { ev: MeuEvento; destaque?: boolean }) {
  return (
    <IonCard className={`evento-cartao${destaque ? ' destaque' : ''}`}>
      <IonCardContent>
        <div className="evento-linha-topo">
          <StatusBadge status={ev.status} />
          {!ev.liderAtual && <span className="evento-ex">Você foi substituído neste grupo</span>}
        </div>
        <h2 className="ias-titulo evento-nome">{ev.nome}</h2>
        <div className="evento-info">
          {ev.local && (
            <span>
              <IonIcon icon={locationOutline} /> {ev.local}
            </span>
          )}
          {ev.dataInicio && (
            <span>
              <IonIcon icon={calendarOutline} /> {periodo(ev.dataInicio, ev.dataFim)}
            </span>
          )}
          <span>
            <IonIcon icon={peopleOutline} /> Seu grupo: <strong>{ev.grupoNome}</strong>
          </span>
        </div>
        {ev.status === 'ativo' && ev.liderAtual && (
          <IonButton
            expand="block"
            size="large"
            routerLink={`/registrar/${ev.eventoId}/${ev.grupoId}`}
            className="evento-registrar"
          >
            <IonIcon icon={personAddOutline} slot="start" /> Registrar conversão
          </IonButton>
        )}
        {ev.status === 'planejado' && (
          <p className="evento-proximo">
            <IonIcon icon={timeOutline} /> O registro abre quando a liderança ativar o evento.
          </p>
        )}
        {ev.status !== 'planejado' && (
          <IonButton expand="block" fill="outline" routerLink={`/placar/${ev.eventoId}`}>
            <IonIcon icon={podiumOutline} slot="start" /> Ver placar
          </IonButton>
        )}
      </IonCardContent>
    </IonCard>
  );
}

export default function Inicio() {
  const { admin, usuario } = useSessao();
  const { dados, carregando, erro, doCacheDe, recarregar } = useCarregar(() => repositorio.meusEventos(), [], {
    cache: usuario ? `meusEventos.${usuario.id}` : null,
  });

  // Com internet, já guarda o placar dos eventos ativos para ele abrir mesmo sem sinal depois.
  useEffect(() => {
    if (!dados || doCacheDe) return;
    for (const ev of dados.filter((e) => e.status === 'ativo')) {
      repositorio
        .placar(ev.eventoId)
        .then((p) => gravarCache(`placar.${ev.eventoId}`, p))
        .catch(() => undefined);
    }
  }, [dados, doCacheDe]);

  const ativos = dados?.filter((e) => e.status === 'ativo') ?? [];
  const proximos = dados?.filter((e) => e.status === 'planejado') ?? [];
  const anteriores = dados?.filter((e) => e.status === 'encerrado') ?? [];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Meus eventos</IonTitle>
        </IonToolbar>
        <BarraSync />
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void recarregar().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {carregando && !dados && <Carregando texto="Carregando seus eventos…" />}
        {doCacheDe && (
          <p className="inicio-cache">Mostrando os eventos salvos no celular em {dataHora(doCacheDe.toISOString())}.</p>
        )}
        {erro && !dados && <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />}

        {dados && dados.length === 0 && (
          <Vazio icone={calendarOutline} titulo="Nenhum evento ainda">
            <p>
              Quando a liderança escalar você como líder de um grupo, o evento aparece aqui.
              {admin && ' Como admin, você monta os eventos na aba Admin.'}
            </p>
          </Vazio>
        )}

        {ativos.length > 0 && (
          <>
            <h3 className="ias-secao">Acontecendo agora</h3>
            {ativos.map((ev) => (
              <CartaoEvento key={`${ev.eventoId}-${ev.grupoId}`} ev={ev} destaque={ev.liderAtual} />
            ))}
          </>
        )}
        {proximos.length > 0 && (
          <>
            <h3 className="ias-secao">Próximos</h3>
            {proximos.map((ev) => (
              <CartaoEvento key={`${ev.eventoId}-${ev.grupoId}`} ev={ev} />
            ))}
          </>
        )}
        {anteriores.length > 0 && (
          <>
            <h3 className="ias-secao">Anteriores</h3>
            {anteriores.map((ev) => (
              <CartaoEvento key={`${ev.eventoId}-${ev.grupoId}`} ev={ev} />
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </IonContent>
    </IonPage>
  );
}
