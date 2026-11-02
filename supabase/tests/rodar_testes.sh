#!/usr/bin/env bash
# Roda as migrations e os testes num PostgreSQL local, duas vezes:
# com o id de public.eventos como uuid e como número (bigint),
# para garantir que a ligação com o site funciona nos dois casos.
#
# Uso: ./supabase/tests/rodar_testes.sh
# Requer: PostgreSQL 15+ local e acesso como superusuário (psql).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
MIG="$DIR/../migrations"
PSQL="${PSQL:-psql}"
DB="app_conversoes_teste"

rodar() {
  local tipo="$1" id1="$2" id2="$3" id3="$4"
  echo "=============================================="
  echo " Testando com public.eventos.id do tipo: $tipo"
  echo "=============================================="

  $PSQL -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"

  sed "s/__TIPO_ID__/$tipo/" "$DIR/00_stub_supabase.sql" \
    | $PSQL -q -v ON_ERROR_STOP=1 -d "$DB"

  for f in "$MIG"/*.sql; do
    echo "-> aplicando $(basename "$f")"
    $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
  done

  for f in "$DIR"/[0-9][0-9]_testes_*.sql; do
    echo "-> $(basename "$f")"
    sed -e "s/__ID1__/$id1/g" -e "s/__ID2__/$id2/g" -e "s/__ID3__/$id3/g" "$f" \
      | $PSQL -v ON_ERROR_STOP=1 -d "$DB" 2>&1 | grep -E "PASS|FAIL|ERRO|ERROR|passaram" | sed 's/^.*NOTICE: *//'
    test "${PIPESTATUS[1]}" -eq 0
  done

  $PSQL -q -d postgres -c "drop database $DB"
}

rodar uuid \
  "'e0000000-0000-0000-0000-000000000001'::uuid" \
  "'e0000000-0000-0000-0000-000000000002'::uuid" \
  "'e0000000-0000-0000-0000-000000000003'::uuid"

rodar bigint 1 2 3

echo ""
echo "OK: migrations e testes aprovados nos dois cenários."
