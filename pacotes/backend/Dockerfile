# ==================================
# Build Stage
# ==================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++ openssl openssl-dev libc6-compat

# Copiar package files primeiro (melhor cache)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY . .

# Gerar Prisma Client (com mock local vazio pro regex funcionar)
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
RUN npx prisma generate --schema=./prisma/schema.prisma

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

# Criar usuário não-root para segurança ANTES de copiar (melhora performance)
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copiar artefatos do build já com o dono correto (evita o lento chown -R)
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nodejs:nodejs --from=builder /app/package*.json ./

# Instalar apenas dependências de produção (sem devDependencies)
RUN npm install --omit=dev --legacy-peer-deps

USER nodejs

# Expor porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Comando de inicialização
# Roda migrations e depois inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/servidor.js"]
