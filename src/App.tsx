import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonBadge,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactHashRouter } from '@ionic/react-router';
import { calendarOutline, documentTextOutline, personCircleOutline, settingsOutline } from 'ionicons/icons';

import { SessaoProvider, useSessao } from './sessao/SessaoContext';
import { FilaProvider, useFila } from './fila/FilaContext';
import Login from './telas/Login';
import Inicio from './telas/Inicio';
import Conta from './telas/Conta';
import Registrar from './telas/Registrar';
import MeusRegistros from './telas/MeusRegistros';
import EditarRegistro from './telas/EditarRegistro';
import Placar from './telas/Placar';
import AdminEventos from './telas/admin/AdminEventos';
import EventoDetalhe from './telas/admin/EventoDetalhe';

setupIonicReact({
  mode: 'md', // mesmo visual no Android e no iPhone
  swipeBackEnabled: true,
});

function Rotas() {
  const { carregando, usuario, admin } = useSessao();
  const { pendentes, comErro } = useFila();

  if (carregando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <IonSpinner name="crescent" color="primary" />
      </div>
    );
  }

  if (!usuario) return <Login />;

  return (
    // HashRouter: funciona igual no Capacitor (arquivo local) e no GitHub Pages.
    <IonReactHashRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/inicio" component={Inicio} />
          <Route exact path="/conta" component={Conta} />
          <Route exact path="/registros" component={MeusRegistros} />
          <Route exact path="/registros/:id" component={EditarRegistro} />
          <Route exact path="/registrar/:eventoId/:grupoId" component={Registrar} />
          <Route exact path="/placar/:eventoId" component={Placar} />
          {/* Rotas sempre declaradas (o Ionic não lida bem com rotas que aparecem e somem);
              quem não é admin é mandado para o início. */}
          <Route exact path="/admin" render={() => (admin ? <AdminEventos /> : <Redirect to="/inicio" />)} />
          <Route
            exact
            path="/admin/evento/:id"
            render={() => (admin ? <EventoDetalhe /> : <Redirect to="/inicio" />)}
          />
          <Route exact path="/">
            <Redirect to="/inicio" />
          </Route>
          <Route>
            <Redirect to="/inicio" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="inicio" href="/inicio">
            <IonIcon icon={calendarOutline} />
            <IonLabel>Eventos</IonLabel>
          </IonTabButton>
          <IonTabButton tab="registros" href="/registros">
            <IonIcon icon={documentTextOutline} />
            <IonLabel>Registros</IonLabel>
            {(pendentes > 0 || comErro > 0) && (
              <IonBadge color={comErro > 0 ? 'danger' : 'secondary'}>{comErro > 0 ? comErro : pendentes}</IonBadge>
            )}
          </IonTabButton>
          {admin && (
            <IonTabButton tab="admin" href="/admin">
              <IonIcon icon={settingsOutline} />
              <IonLabel>Admin</IonLabel>
            </IonTabButton>
          )}
          <IonTabButton tab="conta" href="/conta">
            <IonIcon icon={personCircleOutline} />
            <IonLabel>Conta</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactHashRouter>
  );
}

export default function App() {
  return (
    <IonApp>
      <SessaoProvider>
        <FilaProvider>
          <Rotas />
        </FilaProvider>
      </SessaoProvider>
    </IonApp>
  );
}
