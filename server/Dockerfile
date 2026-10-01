FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

EXPOSE 4000

# Apply any pending migrations against the live database, then start the
# server. Safe to run on every boot: prisma migrate deploy is a no-op when
# there's nothing new to apply.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
