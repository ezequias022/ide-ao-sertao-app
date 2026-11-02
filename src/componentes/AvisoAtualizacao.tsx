import { useEffect, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { arrowDownCircleOutline } from 'ionicons/icons';
import { procurarAtualizacao, type VersaoNova } from '../util/atualizacao';

/** Cartão no topo do início quando há APK novo (só no Android). */
export function AvisoAtualizacao() {
  const [nova, setNova] = useState<VersaoNova | null>(null);

  useEffect(() => {
    void procurarAtualizacao().then(setNova);
  }, []);

  if (!nova) return null;
  return (
    <div className="ias-aviso" role="status">
      <IonIcon icon={arrowDownCircleOutline} />
      <div style={{ flex: 1 }}>
        <strong>Versão {nova.versao} disponível.</strong> Baixe e instale por cima: seus registros continuam no
        celular.
        <IonButton size="small" href={nova.urlApk} target="_blank" style={{ marginTop: 8, display: 'block' }}>
          Baixar atualização
        </IonButton>
      </div>
    </div>
  );
}
