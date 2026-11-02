import { useParams } from 'react-router-dom';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import { cloudOfflineOutline, searchOutline } from 'ionicons/icons';
import { repositorio, type Conversao } from '../dados';
import { useSessao } from '../sessao/SessaoContext';
import { useFila } from '../fila/FilaContext';
import { bancoLocal } from '../fila/bancoLocal';
import { useCarregar } from '../util/useCarregar';
import { Carregando, ErroCarregar, Vazio } from '../componentes/Estado';
import { BarraSync } from '../componentes/BarraSync';
import { FormConversao, camposDe, paraConversao } from '../componentes/FormConversao';

/** Corrige um registro: usa a cópia do aparelho se ainda não subiu; senão busca no servidor. */
export default function EditarRegistro() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useSessao();
  const { corrigir } = useFila();
  const router = useIonRouter();
  const [toast] = useIonToast();

  const { dados, carregando, erro, recarregar } = useCarregar(async (): Promise<Conversao | null> => {
    const naFila = await bancoLocal.fila.get(id);
    if (naFila && naFila.usuarioId === usuario?.id) return naFila.dados;
    return repositorio.buscarConversao(id);
  }, [id, usuario?.id]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/registros" text="" />
          </IonButtons>
          <IonTitle>Corrigir registro</IonTitle>
        </IonToolbar>
        <BarraSync />
      </IonHeader>
      <IonContent>
        {carregando && !dados && <Carregando />}
        {erro && !dados && /internet|conexão/i.test(erro) && (
          <Vazio icone={cloudOfflineOutline} titulo="Precisa de internet">
            <p>Este registro já foi enviado, e os dados dele não ficam no celular. Tente de novo quando tiver sinal.</p>
          </Vazio>
        )}
        {erro && !dados && !/internet|conexão/i.test(erro) && (
          <ErroCarregar mensagem={erro} tentar={() => void recarregar()} />
        )}
        {!carregando && !erro && dados === null && (
          <Vazio icone={searchOutline} titulo="Registro não encontrado" />
        )}
        {dados && (
          <FormConversao
            inicial={camposDe(dados)}
            textoBotao="Salvar correção"
            aoSalvar={async (campos) => {
              await corrigir(paraConversao(campos, dados));
              void toast({ message: 'Correção salva.', duration: 1800, color: 'success', position: 'top' });
              router.goBack();
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
