#!/usr/bin/env bash
# Deploy manual (ou via o workflow opcional em .github/workflows/deploy.yml,
# que só roda isto por SSH). Mesma lógica do ambiente local — buildar e subir
# os containers. Diferente da versão anterior (EC2 + SSM), os segredos não
# são buscados a cada deploy — o Lightsail não tem IAM Instance Role pra ler
# o SSM Parameter Store, então o .env é colocado manualmente na instância
# uma vez (ver AWS_DEPLOYMENT.md) e só persiste ali.
set -euo pipefail
cd "$(dirname "$0")/../.."

git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker image prune -f
