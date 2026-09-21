FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json
RUN npm ci
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/node_modules ./node_modules
COPY --from=build /app/apps/backend/prisma ./prisma
COPY --from=build /app/apps/backend/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server.js"]
