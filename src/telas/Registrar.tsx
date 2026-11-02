import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MeuEvento } from '../dados';
import { useSessao } from '../sessao/SessaoContext';
import { useFila } from '../fila/FilaContext';
import { bancoLocal } from '../fila/bancoLocal';
import { lerCache } from '../util/cacheLocal';
import { BarraSync } from '../componentes/BarraSync';
import { FormConversao, paraConversao, type FormConversaoRef } from '../componentes/FormConversao';
import './Registrar.css';

export default function Registrar() {
  const { eventoId, grupoId } = useParams<{ eventoId: string; grupoId: string }>();
  const { usuario } = useSessao();
  const { registrar, online } = useFila();
  const [toast] = useIonToast();
  const form = useRef<FormConversaoRef>(null);
  const conteudo = useRef<HTMLIonContentElement>(null);

  const evento = lerCache<MeuEvento[]>(`meusEventos.${usuario?.id}`)?.valor.find(
    (e) => e.eventoId === eventoId && e.grupoId === grupoId,
  );

  // Quantas pessoas este líder já registrou neste evento (no aparelho).
  const total = useLiveQuery(async () => {
    if (!usuario) return 0;
    const [naFila, enviados] = await Promise.all([
      bancoLocal.fila.where('usuarioId').equals(usuario.id).filter((i) => i.dados.eventoId === eventoId && i.operacao === 'inserir').count(),
      bancoLocal.enviados.where('[usuarioId+eventoId]').equals([usuario.id, eventoId]).count(),
    ]);
    return naFila + enviados;
  }, [usuario?.id, eventoId]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inicio" text="" />
          </IonButtons>
          <IonTitle>Nova conversão</IonTitle>
        </IonToolbar>
        <BarraSync />
      </IonHeader>
      <IonContent ref={conteudo}>
        <div className="registrar-topo">
          <div>
            <p className="registrar-evento">{evento?.nome ?? 'Evento'}</p>
            <p className="registrar-grupo">{evento?.grupoNome ?? ''}</p>
          </div>
          <div className="registrar-contador" aria-label="Pessoas registradas por você neste evento">
            <strong>{total ?? 0}</strong>
            <span>{total === 1 ? 'registrada' : 'registradas'}</span>
          </div>
        </div>

        <FormConversao
          ref={form}
          textoBotao="Salvar e registrar outra"
          aoSalvar={async (campos) => {
            const agora = new Date().toISOString();
            await registrar(
              paraConversao(campos, { id: crypto.randomUUID(), eventoId, grupoId, registradoEm: agora }),
            );
            form.current?.limpar();
            void conteudo.current?.scrollToTop(250);
            void toast({
              message: online
                ? `${campos.nome.trim().split(' ')[0]} registrado com sucesso.`
                : `${campos.nome.trim().split(' ')[0]} guardado no celular. Sobe quando voltar a internet.`,
              duration: 2200,
              color: 'success',
              position: 'top',
            });
          }}
        />
      </IonContent>
    </IonPage>
  );
}
