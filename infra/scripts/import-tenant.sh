#!/usr/bin/env bash
# Importa um pacote gerado por export-tenant.sh na instância (ou em qualquer
# docker compose desta aplicação). Uso, na pasta /opt/app:
#   sudo bash infra/scripts/import-tenant.sh /tmp/tenant-<slug>.tgz
#
# Aborta, sem alterar nada, se já existir um cliente com o mesmo slug no
# destino — nesse caso remova o cadastro de teste antes (ver AWS_DEPLOYMENT.md).
# O SQL roda numa única transação: ou entra tudo, ou nada.
set -euo pipefail
cd "$(dirname "$0")/../.."

PACKAGE="${1:?uso: import-tenant.sh <tenant-slug.tgz>}"
[[ -f "$PACKAGE" ]] || { echo "arquivo não encontrado: $PACKAGE" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar xzf "$PACKAGE" -C "$WORK"

PG_USER="$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r"' || true)"
PG_DB="$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r"' || true)"
PG_USER="${PG_USER:-mesaviva}"
PG_DB="${PG_DB:-mesaviva}"

DC=(docker compose -f docker-compose.yml)
psql_in() { "${DC[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"; }

SLUG="$(sed -n "s/^-- Cliente '\([^']*\)'.*/\1/p" "$WORK/tenant.sql" | head -n1)"
[[ -n "$SLUG" ]] || { echo "pacote inválido: slug não encontrado no SQL" >&2; exit 1; }

EXISTS="$(psql_in -tAc "select count(*) from tenants where slug = '$SLUG'" | tr -d '[:space:]')"
if [[ "$EXISTS" != "0" ]]; then
  echo "Já existe um cliente com o slug '$SLUG' neste banco. Remova-o antes de importar:" >&2
  echo "  sudo docker compose -f docker-compose.yml exec -T postgres psql -U $PG_USER -d $PG_DB -c \"delete from tenants where slug = '$SLUG'\"" >&2
  exit 1
fi

echo "Importando '$SLUG'..."
psql_in < "$WORK/tenant.sql"

if compgen -G "$WORK/uploads/logos/*" > /dev/null; then
  "${DC[@]}" cp "$WORK/uploads/logos/." backend:/app/uploads/logos/
  echo "Logo(s) copiado(s) para o volume de uploads."
fi

echo "Pronto. Contagens no destino:"
psql_in -tAc "select 'tenant_users: ' || count(*) from tenant_users u join tenants t on t.id=u.\"tenantId\" where t.slug='$SLUG'"
psql_in -tAc "select 'restaurant_tables: ' || count(*) from restaurant_tables r join tenants t on t.id=r.\"tenantId\" where t.slug='$SLUG'"
psql_in -tAc "select 'menu_items: ' || count(*) from menu_items m join tenants t on t.id=m.\"tenantId\" where t.slug='$SLUG'"
