import {
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
  useIonActionSheet,
  useIonAlert,
  useIonRouter,
} from '@ionic/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { alertCircle, checkmarkCircle, documentTextOutline, timeOutline } from 'ionicons/icons';
import { useSessao } from '../sessao/SessaoContext';
import { useFila } from '../fila/FilaContext';
import { bancoLocal } from '../fila/bancoLocal';
import { BarraSync } from '../componentes/BarraSync';
import { Vazio } from '../componentes/Estado';
import { dataHora } from '../util/formatar';
import './MeusRegistros.css';

type Status = 'enviado' | 'pendente' | 'erro';

interface Linha {
  id: string;
  nome: string;
  registradoEm: string;
  status: Status;
  erro: string | null;
  correcaoPendente: boolean;
}

const ICONE: Record<Status, string> = { enviado: checkmarkCircle, pendente: timeOutline, erro: alertCircle };
const ROTULO: Record<Status, string> = { enviado: 'Enviado', pendente: 'Aguardando envio', erro: 'Recusado' };

export default function MeusRegistros() {
  const { usuario } = useSessao();
  const { tentarDeNovo, descartar } = useFila();
  const [acoes] = useIonActionSheet();
  const [alerta] = useIonAlert();
  const router = useIonRouter();

  const linhas = useLiveQuery(async (): Promise<Linha[]> => {
    if (!usuario) return [];
    const [fila, enviados] = await Promise.all([
      bancoLocal.fila.where('usuarioId').equals(usuario.id).toArray(),
      bancoLocal.enviados.where('usuarioId').equals(usuario.id).toArray(),
    ]);
    const porId = new Map<string, Linha>();
    for (const e of enviados) {
      porId.set(e.id, { id: e.id, nome: e.nome, registradoEm: e.registradoEm, status: 'enviado', erro: null, correcaoPendente: false });
    }
    for (const f of fila) {
      porId.set(f.id, {
        id: f.id,
        nome: f.dados.nome,
        registradoEm: f.dados.registradoEm,
        status: f.status,
        erro: f.erro,
        correcaoPendente: f.operacao === 'atualizar',
      });
    }
    return [...porId.values()].sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));
  }, [usuario?.id]);

  function opcoes(l: Linha) {
    void acoes({
      header: l.nome,
      subHeader: l.erro ?? undefined,
      buttons: [
        { text: 'Corrigir dados', handler: () => router.push(`/registros/${l.id}`) },
        ...(l.status === 'erro'
          ? [
              { text: 'Tentar enviar de novo', handler: () => void tentarDeNovo(l.id) },
              { text: 'Descartar este registro', role: 'destructive', handler: () => confirmarDescarte(l) },
            ]
          : []),
        { text: 'Fechar', role: 'cancel' },
      ],
    });
  }

  function confirmarDescarte(l: Linha) {
    void alerta({
      header: 'Descartar registro?',
      message: `Os dados de ${l.nome} serão apagados deste celular. Antes, passe as informações para um admin lançar pelo painel.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Descartar', role: 'destructive', handler: () => void descartar(l.id) },
      ],
    });
  }

  const enviados = linhas?.filter((l) => l.status === 'enviado').length ?? 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Meus registros</IonTitle>
        </IonToolbar>
        <BarraSync />
      </IonHeader>
      <IonContent>
        {linhas && linhas.length === 0 && (
          <Vazio icone={documentTextOutline} titulo="Nenhum registro ainda">
            <p>As pessoas que você registrar aparecem aqui, com a situação do envio de cada uma.</p>
          </Vazio>
        )}

        {linhas && linhas.length > 0 && (
          <>
            <p className="registros-resumo">
              <strong>{linhas.length}</strong> {linhas.length === 1 ? 'pessoa registrada' : 'pessoas registradas'} neste
              celular · {enviados} {enviados === 1 ? 'enviada' : 'enviadas'}
            </p>
            <IonList inset lines="full" className="admin-lista">
              {linhas.map((l) => (
                <IonItem key={l.id} button detail={false} onClick={() => opcoes(l)} className={`registro ${l.status}`}>
                  <IonIcon icon={ICONE[l.status]} slot="start" className="registro-icone" />
                  <IonLabel>
                    <h2>{l.nome}</h2>
                    <p>
                      {dataHora(l.registradoEm)} · {l.correcaoPendente && l.status === 'pendente' ? 'Correção aguardando envio' : ROTULO[l.status]}
                    </p>
                    {l.erro && <p className="registro-erro">{l.erro}</p>}
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
            <p className="registros-nota">
              Depois de enviados, os endereços e telefones saem do celular por segurança. Para corrigir um registro já
              enviado, é preciso internet.
            </p>
          </>
        )}
        {linhas?.some((l) => l.status === 'erro') && (
          <div style={{ padding: '0 16px 16px' }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => linhas.filter((l) => l.status === 'erro').forEach((l) => void tentarDeNovo(l.id))}
            >
              Tentar enviar os recusados de novo
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
