FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# nginx.conf proxies /api and /ws to the backend container, so the build
# calls those as same-origin paths — works behind any origin (LAN IP,
# localhost, an ngrok tunnel, ...) without baking in a fixed URL.
ENV VITE_API_URL=same-origin
ENV VITE_WS_URL=same-origin
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
