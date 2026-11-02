-- =====================================================================
-- App de Registro de Conversões — Missão Ide ao Sertão
-- Migration 002: aviso em tempo real para o placar
--
-- A cada conversão nova, o banco envia pelo Supabase Realtime um aviso
-- no canal privado "placar:<evento_id>" contendo só o evento e o grupo,
-- nunca dados pessoais. O app recebe o aviso e atualiza o placar
-- chamando app_placar(evento_id).
-- =====================================================================

begin;

create function public.app_avisar_placar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('evento_id', new.evento_id, 'grupo_id', new.grupo_id),
    'nova_conversao',
    'placar:' || new.evento_id::text,
    true  -- canal privado: só quem passa na regra abaixo recebe
  );
  return null;
exception when others then
  -- Uma falha no aviso nunca pode impedir que a conversão seja salva.
  return null;
end;
$$;

revoke execute on function public.app_avisar_placar() from anon, public;

create trigger app_conversoes_avisar_placar
after insert on public.app_conversoes
for each row execute function public.app_avisar_placar();

-- Quem pode ouvir o canal do placar: admin do app ou líder do evento.
create policy "placar: admin ou lider do evento ouve"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() like 'placar:%'
  and (
    public.app_is_admin()
    or public.app_lidera_evento(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
  )
);

commit;
