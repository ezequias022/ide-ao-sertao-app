import { IonBadge } from '@ionic/react';
import type { StatusEvento } from '../dados/tipos';
import { COR_STATUS, ROTULO_STATUS } from '../util/formatar';

export function StatusBadge({ status }: { status: StatusEvento }) {
  return <IonBadge color={COR_STATUS[status]}>{ROTULO_STATUS[status]}</IonBadge>;
}
