# --- Étape 1 : build (dépendances complètes, client Prisma, compilation) ---
# Cette étape sert aussi au service `migrate` de docker-compose (target: build),
# car `prisma migrate deploy` a besoin du CLI Prisma, absent de l'image finale.
FROM node:22-slim AS build
# Prisma a besoin d'OpenSSL, absent des images « slim ».
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
RUN npm ci --workspace=apps/backend
COPY apps/backend apps/backend
RUN npm run prisma:generate --workspace=apps/backend \
 && npm run build --workspace=apps/backend

# --- Étape 2 : image finale (dépendances de production uniquement) ---
FROM node:22-slim AS runtime
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
# Avec les workspaces npm, les dépendances sont installées à la RACINE
# (/app/node_modules), pas dans apps/backend/node_modules : on n'installe donc
# que celles de production, puis on y ajoute le client Prisma généré.
RUN npm ci --omit=dev --workspace=apps/backend
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
WORKDIR /app/apps/backend
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
