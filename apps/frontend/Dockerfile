FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/apps/frontend/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
