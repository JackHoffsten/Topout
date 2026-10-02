FROM node:24.21.0-alpine AS build
WORKDIR /source
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY apps/app/ apps/app/
COPY packages/shared/ packages/shared/
ENV EXPO_PUBLIC_API_URL=https://topout.jackhoffsten.se
RUN npm run build

FROM caddy:2.11.4-alpine
COPY --from=build /source/apps/app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
