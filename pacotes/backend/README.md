# Backend ELYON

API Node.js + TypeScript + Express + Prisma

## Scripts

```bash
npm run dev      # Rodar em desenvolvimento
npm run build    # Build para produção
npm run start    # Rodar produção
npm run migrar   # Rodar migrations
npm run studio   # Abrir Prisma Studio
```

## Estrutura

```
src/
├── agentes/         # ELYON + agentes dos tenants
├── rotas/           # Express routes
├── servicos/        # Lógica de negócio
├── repositorios/    # Acesso a dados
├── utilitarios/     # Funções auxiliares
└── servidor.ts      # Entry point
```
