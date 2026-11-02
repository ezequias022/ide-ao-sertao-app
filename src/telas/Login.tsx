import { useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonSpinner } from '@ionic/react';
import { alertCircleOutline, eyeOffOutline, eyeOutline, informationCircleOutline } from 'ionicons/icons';
import { useSessao } from '../sessao/SessaoContext';
import { modoDemo } from '../dados';
import { traduzirErro } from '../dados/erros';
import './Login.css';

export default function Login() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(traduzirErro(err, 'entrar').message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="login" scrollY>
        <div className="login-topo">
          <img src="logo.png" alt="Missão Ide ao Sertão" className="login-logo" />
          <h1 className="ias-titulo">Registro de Conversões</h1>
          <p>Entre com a mesma conta que você usa no site da missão.</p>
        </div>

        <form className="login-form" onSubmit={enviar} noValidate>
          <label className="login-rotulo" htmlFor="email">
            E-mail
          </label>
          <IonInput
            id="email"
            className="login-campo"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            placeholder="seuemail@exemplo.com"
            value={email}
            onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
            fill="outline"
          />

          <label className="login-rotulo" htmlFor="senha">
            Senha
          </label>
          <div className="login-senha">
            <IonInput
              id="senha"
              className="login-campo"
              type={verSenha ? 'text' : 'password'}
              autocomplete="current-password"
              placeholder="Sua senha do site"
              value={senha}
              onIonInput={(e) => setSenha(String(e.detail.value ?? ''))}
              fill="outline"
            />
            <button
              type="button"
              className="login-olho"
              aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              onClick={() => setVerSenha((v) => !v)}
            >
              <IonIcon icon={verSenha ? eyeOffOutline : eyeOutline} />
            </button>
          </div>

          {erro && (
            <div className="ias-aviso erro" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>{erro}</span>
            </div>
          )}

          <IonButton type="submit" expand="block" size="large" disabled={enviando} className="login-botao">
            {enviando ? <IonSpinner name="crescent" /> : 'Entrar'}
          </IonButton>

          <p className="login-ajuda">
            Esqueceu a senha? Recupere pelo site <strong>missaoideaosertao.com.br</strong>.
          </p>
        </form>

        {modoDemo && (
          <div className="ias-aviso login-demo">
            <IonIcon icon={informationCircleOutline} />
            <span>
              <strong>Modo demonstração.</strong> Use <code>admin@demo</code> ou <code>lider@demo</code> com a
              senha <code>demo</code>. Nada aqui vai para o banco de verdade.
            </span>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
