FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- target dev : serveur Vite ---
FROM base AS development
COPY . .
# Vite écrit un cache dans node_modules/.vite : on le rend accessible à l'utilisateur node
RUN chown node:node /app && mkdir -p node_modules/.vite && chown node:node node_modules/.vite
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- étape intermédiaire : compile le front en fichiers statiques ---
FROM base AS build
COPY . .
RUN npm run build

# --- target prod : Nginx sert les fichiers statiques ---
FROM nginxinc/nginx-unprivileged:stable-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080