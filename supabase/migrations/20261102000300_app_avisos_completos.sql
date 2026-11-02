-- =====================================================================
-- App de Registro de Conversões — Missão Ide ao Sertão
-- Migration 003: aviso em tempo real também ao corrigir e ao apagar
--
-- Antes, só conversão NOVA gerava aviso no canal "placar:<evento_id>".
-- Agora correção e exclusão (feita pelo admin, por exemplo para limpar
-- um teste) também avisam, para o placar e o painel ao vivo do admin
-- se atualizarem na hora. Os avisos continuam sem nenhum dado pessoal.
-- =====================================================================

begin;

create or replace function public.app_avisar_placar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha  public.app_conversoes;
  v_evento text;
begin
  if tg_op = 'DELETE' then
    v_linha := old;
    v_evento := 'conversao_apagada';
  elsif tg_op = 'UPDATE' then
    v_linha := new;
    v_evento := 'conversao_atualizada';
  else
    v_linha := new;
    v_evento := 'nova_conversao';
  end if;

  perform realtime.send(
    jsonb_build_object('evento_id', v_linha.evento_id, 'grupo_id', v_linha.grupo_id),
    v_evento,
    'placar:' || v_linha.evento_id::text,
    true
  );
  return null;
exception when others then
  -- Uma falha no aviso nunca pode impedir a gravação.
  return null;
end;
$$;

drop trigger if exists app_conversoes_avisar_placar on public.app_conversoes;

create trigger app_conversoes_avisar_placar
after insert or update or delete on public.app_conversoes
for each row execute function public.app_avisar_placar();

commit;
