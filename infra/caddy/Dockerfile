# A imagem oficial do Caddy não traz plugins de DNS — precisamos do
# provider cloudflare para o certificado wildcard (desafio DNS-01). Build
# pequeno via xcaddy, só isso de diferente da imagem padrão.
FROM caddy:2-builder-alpine AS build
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine
COPY --from=build /usr/bin/caddy /usr/bin/caddy
