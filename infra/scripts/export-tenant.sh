#!/usr/bin/env bash
# Exporta os CADASTROS de um único cliente (tenant) do ambiente local de
# desenvolvimento para um pacote que o import-tenant.sh aplica numa instância
# (ver AWS_DEPLOYMENT.md, "Levar um cliente do desenvolvimento para o piloto").
#
# Uso (na sua máquina, com o docker compose local rodando):
#   bash infra/scripts/export-tenant.sh <slug>
#
# Gera tenant-<slug>.tgz (SQL + logo enviado pelo painel, se houver) e
# tenant-<slug>.tgz.b64 (mesmo pacote em texto, para colar no terminal do
# console Lightsail, que não tem upload de arquivos).
#
# O que vai: tenants, tenant_users (inclui hash das senhas), restaurant_tables,
# menu_items, loyalty_accounts. NÃO vai: pedidos, contas e avaliações
# (orders, bills, reviews) — são movimento, não cadastro.
#
# Imagens: fotos de produto (/produtos/...) e o logo "bundled" (/algo.jpeg)
# ficam em public/ e já vão no build do frontend. Só o logo enviado pelo
# painel (/api/uploads/logos/...) vive no volume de uploads, e é esse que
# este script empacota.
set -euo pipefail
export MSYS_NO_PATHCONV=1

SLUG="${1:?uso: export-tenant.sh <slug>}"
PG_CONTAINER="${PG_CONTAINER:-restauranteapp-postgres-1}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-restauranteapp-backend-1}"
PG_USER="${PG_USER:-mesaviva}"
PG_DB="${PG_DB:-mesaviva}"

if [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "slug inválido: '$SLUG'" >&2; exit 1
fi

psql_q() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"; }

TENANT_ID="$(psql_q -tAc "select id from tenants where slug = '$SLUG'")"
if [[ -z "$TENANT_ID" ]]; then
  echo "cliente '$SLUG' não encontrado no banco local" >&2; exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SQL="$WORK/tenant.sql"

# Lista as colunas explicitamente (COPY tabela (colunas)), em vez de confiar
# na ordem física: um banco de dev que passou por ALTERs pode ter as colunas
# em ordem diferente de um banco criado só pelas migrações.
copy_out() {
  local table="$1" where="$2" cols
  cols="$(psql_q -tAc "select string_agg(quote_ident(column_name), ', ' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = '$table'")"
  printf 'COPY %s (%s) FROM stdin;\n' "$table" "$cols" >> "$SQL"
  psql_q -c "COPY (select $cols from $table where $where) TO STDOUT" >> "$SQL"
  printf '\\.\n\n' >> "$SQL"
}

{
  echo "-- Cliente '$SLUG' exportado em $(date -u +%FT%TZ)"
  echo "BEGIN;"
} > "$SQL"

copy_out tenants           "id = '$TENANT_ID'"
copy_out tenant_users      "\"tenantId\" = '$TENANT_ID'"
copy_out restaurant_tables "\"tenantId\" = '$TENANT_ID'"
copy_out menu_items        "\"tenantId\" = '$TENANT_ID'"
copy_out loyalty_accounts  "\"tenantId\" = '$TENANT_ID'"
echo "COMMIT;" >> "$SQL"

# Logo enviado pelo painel (guardado no volume de uploads do backend).
LOGO_URL="$(psql_q -tAc "select coalesce(\"logoUrl\", '') from tenants where id = '$TENANT_ID'")"
mkdir -p "$WORK/uploads/logos"
if [[ "$LOGO_URL" == /api/uploads/logos/* ]]; then
  LOGO_FILE="${LOGO_URL##*/}"
  docker cp "$BACKEND_CONTAINER:/app/uploads/logos/$LOGO_FILE" "$WORK/uploads/logos/$LOGO_FILE"
  echo "logo enviado pelo painel incluído: $LOGO_FILE"
else
  echo "logo ('${LOGO_URL:-nenhum}') não vem do volume de uploads — nada a empacotar"
fi

OUT="tenant-$SLUG.tgz"
tar czf "$OUT" -C "$WORK" tenant.sql uploads
base64 -w0 "$OUT" > "$OUT.b64"

echo
echo "tenants:           $(grep -c . <<<"$(psql_q -tAc "select 1 from tenants where id='$TENANT_ID'")")"
echo "tenant_users:      $(psql_q -tAc "select count(*) from tenant_users where \"tenantId\"='$TENANT_ID'")"
echo "restaurant_tables: $(psql_q -tAc "select count(*) from restaurant_tables where \"tenantId\"='$TENANT_ID'")"
echo "menu_items:        $(psql_q -tAc "select count(*) from menu_items where \"tenantId\"='$TENANT_ID'")"
echo "loyalty_accounts:  $(psql_q -tAc "select count(*) from loyalty_accounts where \"tenantId\"='$TENANT_ID'")"
echo
echo "Gerado: $OUT ($(wc -c < "$OUT") bytes) e $OUT.b64 ($(wc -c < "$OUT.b64") bytes)"
