# Obraz runtime dla WLED Warehouse.
#
# Zawiera prebudowane zależności (better-sqlite3 i bcrypt skompilowane pod musl/Alpine),
# dzięki czemu serwer docelowy NIE potrzebuje internetu ani `npm install` przy starcie.
#
# Kod aplikacji celowo NIE jest zapiekany w obrazie — montowany jest z katalogu hosta
# (APP_DIR -> /app), więc pliki można edytować bezpośrednio na serwerze i zrestartować
# kontener. Zależności leżą poza /app (w NODE_PATH), więc bind-mount ich nie przykrywa.

FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /opt/wled-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine
# tzdata — bez tego Alpine nie zna stref czasowych (systemowy `date` zostaje w UTC)
RUN apk add --no-cache tzdata
COPY --from=deps /opt/wled-deps/node_modules /opt/wled-deps/node_modules
ENV NODE_PATH=/opt/wled-deps/node_modules
WORKDIR /app
CMD ["sh", "/app/deploy/start.sh"]
