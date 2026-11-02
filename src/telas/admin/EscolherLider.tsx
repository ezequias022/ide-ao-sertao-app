import { useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { Grupo, Pessoa } from '../../dados';
import { iniciais, normalizar } from '../../util/formatar';

interface Props {
  aberto: boolean;
  grupo: Grupo | null;
  grupos: Grupo[];
  pessoas: Pessoa[];
  aoFechar: () => void;
  aoEscolher: (pessoa: Pessoa) => void;
}

/** Lista pesquisável das pessoas cadastradas no site, para escalar como líder. */
export function EscolherLider({ aberto, grupo, grupos, pessoas, aoFechar, aoEscolher }: Props) {
  const [busca, setBusca] = useState('');

  // Quem já lidera outro grupo deste evento.
  const ocupados = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const g of grupos) if (g.liderId && g.id !== grupo?.id) mapa.set(g.liderId, g.nome);
    return mapa;
  }, [grupos, grupo]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return pessoas;
    return pessoas.filter((p) =>
      normalizar(`${p.nome} ${p.email ?? ''} ${p.cidade ?? ''}`).includes(termo),
    );
  }, [busca, pessoas]);

  return (
    <IonModal isOpen={aberto} onDidDismiss={() => { setBusca(''); aoFechar(); }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Líder do {grupo?.nome ?? 'grupo'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={aoFechar}>Fechar</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            placeholder="Buscar por nome, e-mail ou cidade"
            value={busca}
            onIonInput={(e) => setBusca(String(e.detail.value ?? ''))}
            debounce={150}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {filtradas.length === 0 ? (
          <div className="ias-vazio">
            <p>
              Ninguém encontrado. A pessoa precisa ter conta no site da missão para ser escalada.
            </p>
          </div>
        ) : (
          <IonList lines="full">
            {filtradas.map((p) => {
              const outroGrupo = ocupados.get(p.id);
              const atual = grupo?.liderId === p.id;
              return (
                <IonItem
                  key={p.id}
                  button={!outroGrupo && !atual}
                  disabled={Boolean(outroGrupo)}
                  detail={false}
                  onClick={() => !outroGrupo && !atual && aoEscolher(p)}
                >
                  <div className="ias-avatar" slot="start">
                    {iniciais(p.nome)}
                  </div>
                  <IonLabel>
                    <h2>{p.nome}</h2>
                    <p>{[p.cidade, p.email].filter(Boolean).join(' · ')}</p>
                  </IonLabel>
                  {atual && <IonNote slot="end">Líder atual</IonNote>}
                  {outroGrupo && <IonNote slot="end">Lidera o {outroGrupo}</IonNote>}
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonContent>
    </IonModal>
  );
}
