#!/usr/bin/env bash
# Deploy manual (ou via o workflow opcional em .github/workflows/deploy.yml,
# que só roda isto por SSH). Mesma lógica do ambiente local — buildar e subir
# os containers. Os segredos não são buscados a cada deploy — o Lightsail não
# tem IAM Instance Role pra ler o SSM Parameter Store, então o .env é colocado
# manualmente na instância uma vez (ver AWS_DEPLOYMENT.md) e só persiste ali.
#
# DEPLOY_MODE (no .env): "pilot" = Fase 1, HTTP puro na porta 80, sem Caddy;
# "prod" (padrão) = Fase 2, Caddy + HTTPS wildcard via Cloudflare.
set -euo pipefail
cd "$(dirname "$0")/../.."

DEPLOY_MODE="$(grep -E '^DEPLOY_MODE=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r"' || true)"
DEPLOY_MODE="${DEPLOY_MODE:-prod}"

case "$DEPLOY_MODE" in
  pilot) OVERRIDE="docker-compose.pilot.yml" ;;
  prod)  OVERRIDE="docker-compose.prod.yml" ;;
  *) echo "DEPLOY_MODE inválido: '$DEPLOY_MODE' (use pilot ou prod)" >&2; exit 1 ;;
esac

echo "Deploy em modo '$DEPLOY_MODE' ($OVERRIDE)"
git pull
docker compose -f docker-compose.yml -f "$OVERRIDE" up --build -d
docker image prune -f
