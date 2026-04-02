# 📘 Guia de Execução: Migração da Base Local de Imóveis

**Objetivo:** Criar uma cópia local completa da base de dados imobiliária da Prefeitura de Goiânia (Portal Mapa) para eliminar a dependência da API externa e acelerar o sistema.

**Estratégia:** Execução do scraping em ambiente **LOCAL (DEV)** para proteger o IP de produção, seguido de migração dos dados via DUMP SQL.

---

## 🛠️ Fase 1: Preparação do Ambiente Local

A equipe de desenvolvimento deve seguir estes passos na máquina local.

1. **Baixar o código atualizado**
   Certifique-se de ter as últimas alterações do backend (Schema Prisma e Scripts de Sync).
   ```bash
   git pull origin main
   ```

2. **Atualizar o Banco de Dados Local**
   Aplique as alterações no esquema do banco (novas tabelas `Edificio`, `Bairro`).
   ```bash
   cd elyon
   docker-compose up -d backend
   docker exec elyon_backend npx prisma db push
   ```

3. **Verificar se o servidor está rodando**
   Acesse `http://localhost:3000/api/saude` e veja se retorna "ok".

---

## 🚀 Fase 2: Execução da Carga de Dados (Scraping)

Execute os comandos abaixo sequencialmente. Utilize um terminal separado (ex: Git Bash ou terminal do VSCode).

### 1️⃣ Passo 1: Sincronizar Bairros
Baixa a lista de todos os bairros e condomínios horizontais.
*   **Tempo estimado:** ~5 segundos
*   **Comando:**
    ```bash
    curl -X POST http://localhost:3000/api/sincronizacao/bairros \
      -H "x-admin-key: elyon-master-key-2024"
    ```

### 2️⃣ Passo 2: Sincronizar Edifícios
Percorre cada bairro buscando edifícios e condomínios verticais.
*   **Tempo estimado:** ~2 a 5 minutos
*   **Comando:**
    ```bash
    curl -X POST http://localhost:3000/api/sincronizacao/edificios \
      -H "x-admin-key: elyon-master-key-2024"
    ```

### 3️⃣ Passo 3: Sincronizar Unidades (Carga Pesada) ⚠️
Baixa todos os apartamentos e casas (aprox. 800.000 registros). 
*   **Tempo estimado:** 30 a 60 minutos (dependendo da internet e resposta da API).
*   **Comando:**
    ```bash
    curl -X POST http://localhost:3000/api/sincronizacao/unidades \
      -H "x-admin-key: elyon-master-key-2024"
    ```
*   **Monitoramento:** Acompanhe os logs para garantir que não houve bloqueio de IP.
    ```bash
    docker logs -f elyon_backend
    ```

> **Dica:** Se o IP for bloqueado (muitos erros 403/429 consecutivos), pare o script, reinicie seu modem para trocar de IP e rode o comando novamente. Ele continuará de onde parou.

---

## 📦 Fase 3: Exportação (Dump) dos Dados

Após concluir a carga local com sucesso, vamos extrair APENAS os dados geográficos para levar para produção.

1. **Gerar o arquivo de Dump (Data Only)**
   Este comando exporta apenas os dados das tabelas `bairros_geo`, `edificios_geo` e atualiza a tabela `imoveis`.
   
   ⚠️ *Nota: Como a tabela `imoveis` pode ter dados de produção misturados, a estratégia mais segura é exportar apenas as tabelas novas (`bairros` e `edificios`) e os imóveis novos.*

   **Comando para exportar TUDO (Recomendado se a base local for limpa):**
   ```bash
   docker exec elyon_postgres pg_dump -U postgres -d elyon \
     --data-only \
     --table=bairros_geo \
     --table=edificios_geo \
     --table=imoveis \
     --column-inserts > base_imoveis_goiania.sql
   ```

---

## 🚢 Fase 4: Importação em Produção

No servidor de produção:

1. **Fazer Backup Prévio (Segurança)**
   ```bash
   docker exec elyon_postgres pg_dump -U postgres -d elyon > backup_pre_migracao.sql
   ```

2. **Atualizar o Schema em Produção**
   Garante que as tabelas existem antes de receber os dados.
   ```bash
   docker exec elyon_backend npx prisma db push
   ```

3. **Importar os Dados**
   Copie o arquivo `base_imoveis_goiania.sql` para o servidor e execute:
   ```bash
   cat base_imoveis_goiania.sql | docker exec -i elyon_postgres psql -U postgres -d elyon
   ```

---

## ✅ Resolução de Problemas Comuns

| Sintoma | Causa Provável | Solução |
|---------|----------------|---------|
| **Erro 403 / 429 nos logs** | IP Bloqueado pela Prefeitura | Reinicie o modem/roteador para trocar o IP. |
| **Erro "Connection Timed Out"** | API da Prefeitura instável | Espere alguns minutos e tente novamente. O script é idempotente. |
| **Erro de chave estrangeira (FK)** | Tentou importar imóvel sem bairro | Garanta que seguiu a ordem: Bairros → Edifícios → Imóveis. |

---

**Equipe Elyon Tech**  
*Documento gerado em 15/12/2024*
