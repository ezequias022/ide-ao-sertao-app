import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { logOutOutline, mailOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { useSessao } from '../sessao/SessaoContext';
import { modoDemo } from '../dados';

const VERSAO = import.meta.env.PACKAGE_VERSION ?? '0.1.0';

export default function Conta() {
  const { usuario, admin, sair } = useSessao();
  const [alerta] = useIonAlert();

  function confirmarSaida() {
    void alerta({
      header: 'Sair do app?',
      message: 'Para entrar de novo você vai precisar de internet e da sua senha do site.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sair', role: 'destructive', handler: () => void sair() },
      ],
    });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Conta</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <h3 className="ias-secao">Você</h3>
        <IonList inset lines="full" className="admin-lista">
          <IonItem>
            <IonIcon icon={mailOutline} slot="start" color="primary" />
            <IonLabel>
              <p>E-mail</p>
              <h2>{usuario?.email}</h2>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonIcon icon={shieldCheckmarkOutline} slot="start" color="primary" />
            <IonLabel>
              <p>Acesso</p>
              <h2>{admin ? 'Admin da missão' : 'Líder de grupo'}</h2>
            </IonLabel>
            {admin && <IonBadge color="secondary">Admin</IonBadge>}
          </IonItem>
        </IonList>

        <div style={{ padding: '8px 16px' }}>
          <IonButton expand="block" fill="outline" color="danger" onClick={confirmarSaida}>
            <IonIcon icon={logOutOutline} slot="start" /> Sair
          </IonButton>
        </div>

        <p className="conta-rodape">
          Missão Ide ao Sertão · Registro de Conversões
          <br />
          Versão {VERSAO}
          {modoDemo && ' · modo demonstração'}
        </p>
      </IonContent>
    </IonPage>
  );
}
