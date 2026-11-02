-- =====================================================================
-- DESFAZER: remove tudo que as migrations do app criaram.
-- Use só se precisar voltar atrás. APAGA os dados do app (conversões,
-- grupos, eventos do app). As tabelas do site não são tocadas.
-- =====================================================================

begin;

drop policy if exists "placar: admin ou lider do evento ouve" on realtime.messages;

drop table if exists
  public.app_exportacoes,
  public.app_conversoes,
  public.app_lideres_historico,
  public.app_grupos,
  public.app_eventos,
  public.app_papeis
cascade;

drop function if exists
  public.app_avisar_placar(),
  public.app_placar(uuid),
  public.app_meus_eventos(),
  public.app_eventos_site(),
  public.app_pessoas(),
  public.app_pode_registrar(uuid, uuid),
  public.app_evento_ativo(uuid),
  public.app_lidera_evento(uuid),
  public.app_is_admin(),
  public.app_registrar_lider_historico(),
  public.app_grupos_travar_evento(),
  public.app_conversoes_antes_gravar(),
  public.app_exportacoes_antes_gravar();

commit;
