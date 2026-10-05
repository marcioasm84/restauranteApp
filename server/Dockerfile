FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

EXPOSE 4000

# If DATABASE_URL isn't provided directly (docker-compose sets it that way),
# build it from the discrete DB_* vars instead — that's how ECS supplies it,
# since RDS's generated secret only covers username/password, not a full
# connection string. Then apply any pending migrations and start the server;
# prisma migrate deploy is a no-op when there's nothing new to apply.
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then export DATABASE_URL=\"postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME\"; fi && npx prisma migrate deploy && npx tsx src/index.ts"]
