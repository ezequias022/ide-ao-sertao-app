import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from 'react';
import { IonButton, IonCheckbox, IonIcon, IonInput, IonSpinner, IonTextarea } from '@ionic/react';
import { alertCircleOutline, personAddOutline, saveOutline } from 'ionicons/icons';
import type { Conversao } from '../dados/tipos';
import { formatarTelefone, somenteDigitos, telefoneValido } from '../util/formatar';
import './FormConversao.css';

export interface CamposConversao {
  nome: string;
  apelido: string;
  idade: string;
  whatsapp: string; // só dígitos
  endereco: string;
  responsavelNome: string;
  responsavelTelefone: string; // só dígitos
  consentimento: boolean;
}

export const CAMPOS_VAZIOS: CamposConversao = {
  nome: '',
  apelido: '',
  idade: '',
  whatsapp: '',
  endereco: '',
  responsavelNome: '',
  responsavelTelefone: '',
  consentimento: false,
};

export function camposDe(c: Conversao): CamposConversao {
  return {
    nome: c.nome,
    apelido: c.apelido ?? '',
    idade: c.idade === null ? '' : String(c.idade),
    whatsapp: c.whatsapp ?? '',
    endereco: c.endereco,
    responsavelNome: c.responsavelNome ?? '',
    responsavelTelefone: c.responsavelTelefone ?? '',
    consentimento: c.consentimento,
  };
}

type Erros = Partial<Record<keyof CamposConversao, string>>;

export function validar(c: CamposConversao): Erros {
  const erros: Erros = {};
  if (c.nome.trim().length < 2) erros.nome = 'Escreva o nome da pessoa.';
  if (c.endereco.trim().length < 3) erros.endereco = 'Escreva o endereço, com um ponto de referência.';
  if (c.idade && (!/^\d{1,3}$/.test(c.idade) || Number(c.idade) > 120)) erros.idade = 'Idade inválida.';
  if (c.whatsapp && !telefoneValido(c.whatsapp)) erros.whatsapp = 'Confira o número: DDD + número.';
  if (menorDeIdade(c) && c.responsavelTelefone && !telefoneValido(c.responsavelTelefone)) {
    erros.responsavelTelefone = 'Confira o número: DDD + número.';
  }
  if (!c.consentimento) erros.consentimento = 'Peça a permissão da pessoa e marque aqui.';
  return erros;
}

export function menorDeIdade(c: CamposConversao): boolean {
  return c.idade !== '' && Number(c.idade) < 18;
}

/** Monta a conversão final, limpando espaços e campos vazios. */
export function paraConversao(
  campos: CamposConversao,
  base: Pick<Conversao, 'id' | 'eventoId' | 'grupoId' | 'registradoEm'>,
): Conversao {
  const texto = (v: string) => (v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
  const menor = menorDeIdade(campos);
  return {
    ...base,
    nome: campos.nome.trim().replace(/\s+/g, ' '),
    apelido: texto(campos.apelido),
    idade: campos.idade === '' ? null : Number(campos.idade),
    whatsapp: campos.whatsapp || null,
    endereco: campos.endereco.trim(),
    responsavelNome: menor ? texto(campos.responsavelNome) : null,
    responsavelTelefone: menor ? campos.responsavelTelefone || null : null,
    consentimento: campos.consentimento,
    atualizadoEm: new Date().toISOString(),
  };
}

export interface FormConversaoRef {
  limpar: () => void;
}

interface Props {
  inicial?: CamposConversao;
  textoBotao: string;
  aoSalvar: (campos: CamposConversao) => Promise<void>;
}

/** Formulário de registro: rápido de preencher na rua, com uma mão. */
export const FormConversao = forwardRef<FormConversaoRef, Props>(function FormConversao(
  { inicial = CAMPOS_VAZIOS, textoBotao, aoSalvar },
  ref,
) {
  const [c, setC] = useState<CamposConversao>(inicial);
  const [erros, setErros] = useState<Erros>({});
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLIonInputElement>(null);

  useImperativeHandle(ref, () => ({
    limpar: () => {
      setC(CAMPOS_VAZIOS);
      setErros({});
      setTentou(false);
      void nomeRef.current?.setFocus();
    },
  }));

  function mudar<K extends keyof CamposConversao>(campo: K, valor: CamposConversao[K]) {
    const novo = { ...c, [campo]: valor };
    setC(novo);
    if (tentou) setErros(validar(novo));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    const encontrados = validar(c);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    setSalvando(true);
    try {
      await aoSalvar(c);
    } finally {
      setSalvando(false);
    }
  }

  const menor = menorDeIdade(c);
  const qtdErros = Object.keys(erros).length;

  return (
    <form className="form-conv" onSubmit={enviar} noValidate>
      <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
        <IonInput
          ref={nomeRef}
          fill="outline"
          autocapitalize="words"
          autocomplete="off"
          enterkeyhint="next"
          maxlength={120}
          placeholder="Nome completo"
          value={c.nome}
          onIonInput={(e) => mudar('nome', String(e.detail.value ?? ''))}
        />
      </Campo>

      <Campo rotulo="Apelido" dica="Como a pessoa é conhecida na comunidade" erro={erros.apelido}>
        <IonInput
          fill="outline"
          autocapitalize="words"
          autocomplete="off"
          maxlength={60}
          placeholder="Ex.: Zé do Bode"
          value={c.apelido}
          onIonInput={(e) => mudar('apelido', String(e.detail.value ?? ''))}
        />
      </Campo>

      <div className="form-conv-linha">
        <Campo rotulo="Idade" erro={erros.idade} className="form-conv-idade">
          <IonInput
            fill="outline"
            inputmode="numeric"
            maxlength={3}
            placeholder="Anos"
            value={c.idade}
            onIonInput={(e) => mudar('idade', String(e.detail.value ?? '').replace(/\D/g, '').slice(0, 3))}
          />
        </Campo>
        <Campo rotulo="WhatsApp" erro={erros.whatsapp} className="form-conv-zap">
          <IonInput
            fill="outline"
            type="tel"
            inputmode="tel"
            autocomplete="off"
            placeholder="(87) 99999-9999"
            value={formatarTelefone(c.whatsapp)}
            onIonInput={(e) => mudar('whatsapp', somenteDigitos(String(e.detail.value ?? '')))}
          />
        </Campo>
      </div>

      <Campo rotulo="Endereço" obrigatorio dica="Rua, número, sítio, ponto de referência" erro={erros.endereco}>
        <IonTextarea
          fill="outline"
          autoGrow
          rows={2}
          maxlength={300}
          autocapitalize="sentences"
          placeholder="Ex.: Rua da Igreja, 10, perto do mercadinho"
          value={c.endereco}
          onIonInput={(e) => mudar('endereco', String(e.detail.value ?? ''))}
        />
      </Campo>

      {menor && (
        <fieldset className="form-conv-responsavel">
          <legend>Responsável (menor de 18 anos)</legend>
          <p>Opcional, mas ajuda o pastor local a procurar também a família.</p>
          <Campo rotulo="Nome do responsável" erro={erros.responsavelNome}>
            <IonInput
              fill="outline"
              autocapitalize="words"
              maxlength={120}
              value={c.responsavelNome}
              onIonInput={(e) => mudar('responsavelNome', String(e.detail.value ?? ''))}
            />
          </Campo>
          <Campo rotulo="Telefone do responsável" erro={erros.responsavelTelefone}>
            <IonInput
              fill="outline"
              type="tel"
              inputmode="tel"
              placeholder="(87) 99999-9999"
              value={formatarTelefone(c.responsavelTelefone)}
              onIonInput={(e) => mudar('responsavelTelefone', somenteDigitos(String(e.detail.value ?? '')))}
            />
          </Campo>
        </fieldset>
      )}

      <label className={`form-conv-consent${erros.consentimento ? ' com-erro' : ''}`}>
        <IonCheckbox
          checked={c.consentimento}
          onIonChange={(e) => mudar('consentimento', e.detail.checked)}
          aria-label="Consentimento"
        />
        <span>
          <strong>A pessoa autorizou</strong> que um pastor da cidade entre em contato com ela.
        </span>
      </label>
      {erros.consentimento && <p className="form-conv-erro">{erros.consentimento}</p>}

      {tentou && qtdErros > 0 && (
        <div className="ias-aviso erro" role="alert">
          <IonIcon icon={alertCircleOutline} />
          <span>{qtdErros === 1 ? 'Falta corrigir 1 campo.' : `Falta corrigir ${qtdErros} campos.`}</span>
        </div>
      )}

      <IonButton type="submit" expand="block" size="large" disabled={salvando} className="form-conv-botao">
        {salvando ? (
          <IonSpinner name="crescent" />
        ) : (
          <>
            <IonIcon icon={inicial === CAMPOS_VAZIOS ? personAddOutline : saveOutline} slot="start" />
            {textoBotao}
          </>
        )}
      </IonButton>
    </form>
  );
});

function Campo({
  rotulo,
  obrigatorio,
  dica,
  erro,
  className,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  dica?: string;
  erro?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`form-conv-campo${erro ? ' com-erro' : ''}${className ? ` ${className}` : ''}`}>
      <span className="form-conv-rotulo">
        {rotulo}
        {obrigatorio && <span className="form-conv-obrig"> *</span>}
      </span>
      {children}
      {erro ? <p className="form-conv-erro">{erro}</p> : dica ? <p className="form-conv-dica">{dica}</p> : null}
    </div>
  );
}
