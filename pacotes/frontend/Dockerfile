# ==================================
# Build Stage
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# API URL como build arg
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build Vite
RUN npm run build

# ==================================
# Production Stage (Nginx)
# ==================================
FROM nginx:alpine AS runner

# Copiar build estático
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração nginx customizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1

# Comando padrão
CMD ["nginx", "-g", "daemon off;"]
