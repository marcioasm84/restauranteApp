#!/usr/bin/env bash
# Backup diário do Postgres pro S3 — agende via cron (ver AWS_DEPLOYMENT.md).
# Precisa, no .env: BACKUP_BUCKET (saída "BackupBucketName" do `cdk deploy`)
# e AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_DEFAULT_REGION da credencial
# do usuário IAM "meu-restaurante-backup" (criada manualmente via
# `aws iam create-access-key` — o Lightsail não tem IAM Instance Role, então
# essa é a única forma do `aws s3 cp` abaixo se autenticar; a permissão
# desse usuário é só gravar neste bucket, nada além disso).
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env; set +a

TIMESTAMP="$(date +%F-%H%M)"
FILE="/tmp/backup-${TIMESTAMP}.sql.gz"

docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-mesaviva}" "${POSTGRES_DB:-mesaviva}" \
  | gzip > "$FILE"

aws s3 cp "$FILE" "s3://${BACKUP_BUCKET}/postgres/${TIMESTAMP}.sql.gz"
rm -f "$FILE"

echo "Backup enviado: s3://${BACKUP_BUCKET}/postgres/${TIMESTAMP}.sql.gz"
