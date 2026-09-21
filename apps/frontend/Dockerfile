FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/frontend
COPY apps/frontend apps/frontend
RUN npm run build --workspace=apps/frontend

FROM node:22-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/apps/frontend/dist ./dist
USER node
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
