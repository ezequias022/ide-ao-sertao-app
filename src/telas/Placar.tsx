import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cloudOfflineOutline, peopleOutline, radioOutline } from 'ionicons/icons';
import { repositorio, type EventoSite, type MeuEvento } from '../dados';
import { useSessao } from '../sessao/SessaoContext';
import { useFila } from '../fila/FilaContext';
import { bancoLocal } from '../fila/bancoLocal';
import { useCarregar } from '../util/useCarregar';
import { lerCache } from '../util/cacheLocal';
import { hora } from '../util/formatar';
import { Carregando, ErroCarregar, Vazio } from '../componentes/Estado';
import { BarraSync } from '../componentes/BarraSync';
import './Placar.css';

export default function Placar() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { usuario } = useSessao();
  const { online } = useFila();

  const { dados, carregando, erro, doCacheDe, recarregar } = useCarregar(
    () => repositorio.placar(eventoId),
    [eventoId],
    { cache: `placar.${eventoId}` },
  );
  const atualizadoEm = useRef<Date>(new Date());
  if (dados && !doCacheDe && !carregando) atualizadoEm.current = new Date();

  // Ao vivo: cada conversão nova no evento atualiza o placar (com um pequeno atraso
  // para juntar várias que chegam juntas).
  useEffect(() => {
    let espera: number | undefined;
    const parar = repositorio.ouvirPlacar(eventoId, () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void recarregar(), 600);
    });
    return () => {
      window.clearTimeout(espera);
      parar();
    };
  }, [eventoId, recarregar]);

  // Voltou a internet: busca o placar atualizado.
  useEffect(() => {
    if (online) void recarregar();
  }, [online, recarregar]);

  // Registros deste celular que ainda não subiram, por grupo.
  const meusPendentes = useLiveQuery(async () => {
    if (!usuario) return new Map<string, number>();
    const itens = await bancoLocal.fila
      .where('usuarioId')
      .equals(usuario.id)
      .filter((i) => i.operacao === 'inserir' && i.dados.eventoId === eventoId)
      .toArray();
    const mapa = new Map<string, number>();
    for (const i of itens) mapa.set(i.dados.grupoId, (mapa.get(i.dados.grupoId) ?? 0) + 1);
    return mapa;
  }, [usuario?.id, eventoId]);

  const nomeEvento = useMemo(() => {
    const meus = lerCache<MeuEvento[]>(`meusEventos.${usuario?.id}`)?.valor ?? [];
    const site = lerCache<EventoSite[]>(`eventosSite.${usuario?.id}`)?.valor ?? [];
    return meus.find((e) => e.eventoId === eventoId)?.nome ?? site.find((e) => e.appEventoId === eventoId)?.nome ?? '';
  }, [eventoId, usuario?.id]);

  const totalMeusPendentes = [...(meusPendentes?.values() ?? [])].reduce((a, b) => a + b, 0);
  const linhas = (dados ?? []).map((l) => ({ ...l, pendentes: meusPendentes?.get(l.grupoId) ?? 0 }));
  const totalServidor = linhas.reduce((s, l) => s + l.total, 0);
  const totalPendente = linhas.reduce((s, l) => s + l.pendentes, 0);
  const maior = Math.max(1, ...linhas.map((l) => l.total + l.pendentes));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inicio" text="" />
          </IonButtons>
          <IonTitle>Placar</IonTitle>
        </IonToolbar>
        <BarraSync />
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void recarregar().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {carregando && !dados && <Carregando texto="Carregando o placar…" />}
        {erro && !dados && !online && (
          <Vazio icone={cloudOfflineOutline} titulo="Placar sem internet">
            <p>
              O placar aparece quando o celular conectar.
              {totalMeusPendentes > 0 &&
                ` Você tem ${totalMeusPendentes === 1 ? '1 registro guardado' : `${totalMeusPendentes} registros guardados`} esperando para subir.`}
            </p>
          </Vazio>
        )}
        {erro && !dados && online && <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />}
        {dados && dados.length === 0 && (
          <Vazio icone={peopleOutline} titulo="Nenhum grupo ainda">
            <p>O placar aparece quando a liderança montar os grupos deste evento.</p>
          </Vazio>
        )}

        {dados && dados.length > 0 && (
          <>
            <div className="placar-total">
              {nomeEvento && <p className="placar-evento">{nomeEvento}</p>}
              <strong>{totalServidor + totalPendente}</strong>
              <span>{totalServidor + totalPendente === 1 ? 'vida alcançada' : 'vidas alcançadas'}</span>
              <p className={`placar-ao-vivo${doCacheDe ? ' off' : ''}`}>
                <IonIcon icon={doCacheDe ? cloudOfflineOutline : radioOutline} />
                {doCacheDe
                  ? `Sem internet · placar de ${hora(doCacheDe)}`
                  : `Ao vivo · atualizado às ${hora(atualizadoEm.current)}`}
              </p>
            </div>

            <ol className="placar-lista">
              {linhas.map((l, i) => {
                const total = l.total + l.pendentes;
                return (
                  <li key={l.grupoId} className={i === 0 && total > 0 ? 'primeiro' : ''}>
                    <span className="placar-pos">{i + 1}º</span>
                    <div className="placar-grupo">
                      <div className="placar-linha">
                        <span className="placar-nome">{l.grupoNome}</span>
                        <span className="placar-num">{total}</span>
                      </div>
                      <div className="placar-barra" aria-hidden="true">
                        <span style={{ width: `${(l.total / maior) * 100}%` }} />
                        <span className="pendente" style={{ width: `${(l.pendentes / maior) * 100}%` }} />
                      </div>
                      {l.pendentes > 0 && (
                        <span className="placar-pendente">
                          +{l.pendentes} deste celular aguardando envio
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
