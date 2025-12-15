# ==================================
# Build Stage
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

# Copiar package files primeiro (melhor cache)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ==================================
# Production Stage
# ==================================
FROM node:20-alpine AS runner

WORKDIR /app

# Definir ambiente
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

# Instalar apenas dependências para Prisma funcionar
RUN apk add --no-cache openssl

# Copiar artefatos do build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expor porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Comando de inicialização
# Roda migrations e depois inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/servidor.js"]
