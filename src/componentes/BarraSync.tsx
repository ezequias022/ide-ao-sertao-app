import { IonIcon, IonSpinner } from '@ionic/react';
import { alertCircle, cloudOfflineOutline, cloudUploadOutline } from 'ionicons/icons';
import { useFila } from '../fila/FilaContext';
import './BarraSync.css';

/**
 * Faixa fixa no topo das telas do líder: avisa quando está sem internet,
 * quantos registros estão guardados no celular e se algum foi recusado.
 * Some quando está tudo enviado.
 */
export function BarraSync() {
  const { online, enviando, pendentes, comErro, enviarAgora } = useFila();

  if (comErro > 0) {
    return (
      <a className="barra-sync erro" href="#/registros" role="status">
        <IonIcon icon={alertCircle} />
        <span>
          {comErro === 1 ? '1 registro foi recusado' : `${comErro} registros foram recusados`}. Toque para ver.
        </span>
      </a>
    );
  }

  if (!online) {
    return (
      <div className="barra-sync offline" role="status">
        <IonIcon icon={cloudOfflineOutline} />
        <span>
          <strong>Sem internet.</strong>{' '}
          {pendentes > 0
            ? `${pendentes === 1 ? '1 registro guardado' : `${pendentes} registros guardados`} no celular. Sobe sozinho quando voltar o sinal.`
            : 'Pode registrar normalmente: fica guardado no celular.'}
        </span>
      </div>
    );
  }

  if (pendentes > 0) {
    return (
      <button type="button" className="barra-sync pendente" onClick={() => void enviarAgora()} role="status">
        {enviando ? <IonSpinner name="crescent" /> : <IonIcon icon={cloudUploadOutline} />}
        <span>
          {enviando
            ? `Enviando ${pendentes === 1 ? '1 registro' : `${pendentes} registros`}…`
            : `${pendentes === 1 ? '1 registro aguardando' : `${pendentes} registros aguardando`} envio. Toque para enviar.`}
        </span>
      </button>
    );
  }

  return null;
}
