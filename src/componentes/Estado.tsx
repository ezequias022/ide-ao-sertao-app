import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, cloudOfflineOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';

/** Carregando, erro ou vazio: o mesmo visual em todas as telas. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="ias-vazio" aria-busy="true">
      <IonSpinner name="crescent" color="primary" />
      <p>{texto}</p>
    </div>
  );
}

export function ErroCarregar({ mensagem, tentar }: { mensagem: string; tentar: () => void }) {
  const semInternet = /internet|conexão/i.test(mensagem);
  return (
    <div className="ias-vazio" role="alert">
      <IonIcon icon={semInternet ? cloudOfflineOutline : alertCircleOutline} />
      <h2>{semInternet ? 'Sem conexão' : 'Não deu certo'}</h2>
      <p>{mensagem}</p>
      <IonButton fill="outline" onClick={tentar}>
        Tentar de novo
      </IonButton>
    </div>
  );
}

export function Vazio({ icone, titulo, children }: { icone: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="ias-vazio">
      <IonIcon icon={icone} />
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}
