# Auditoria: Leads vs Contatos no ELYON

## Data: 2024-12-14

## Problema Identificado

Há **698 registros** na tabela `leads` com status `NOVO` que nunca foram qualificados. Estes deveriam ser **Contatos**, não Leads.

### Origem dos Dados Incorretos

| Origem | Total | Problema |
|--------|-------|----------|
| `api_iptu_scraper` | 419 | Criados diretamente como Lead |
| `api_iptu` | 247 | Criados diretamente como Lead |
| `WHATSAPP_INBOUND` | 32 | Correto (mensagens entrantes) |

## Definições Corretas

### 📌 CONTATO (tabela `contatos`)
- **Definição**: Proprietário de imóvel identificado via mineração
- **Origem**: Mineração IPTU, Assertiva, Lista importada
- **Status inicial**: `AGUARDANDO`
- **Pode virar Lead**: SIM, após qualificação SPIN
- **Não é oportunidade**: É apenas um dado bruto

### 📌 LEAD (tabela `leads`)
- **Definição**: Proprietário que **demonstrou interesse** em vender/alugar
- **Origem**: Conversão de Contato qualificado
- **Status inicial**: `QUALIFICADO`
- **É oportunidade**: SIM, é uma oportunidade de captação

## Fluxo Correto

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  MINERAÇÃO  │ ──▶  │   CONTATO   │ ──▶  │    LEAD     │
│  (IPTU)     │      │ (statusPros │      │ (status     │
│             │      │  peccao:    │      │  QUALIFICA  │
│             │      │  AGUARDANDO)│      │  DO)        │
└─────────────┘      └─────────────┘      └─────────────┘
                           │
                           ▼
                     Prospecção IA
                     (SDR Worker)
                           │
                           ▼
                     Qualificação
                     (SPIN Selling)
                           │
                     ┌─────┴─────┐
                     ▼           ▼
              ✅ INTERESSE   ❌ SEM INT
              virar Lead     permanece
                             Contato
```

## Código Problemático

### Arquivo: `/rotas/mineracao/processamento.rotas.ts`

**Linha 203-219** - Cria Lead direto do scraper:
```typescript
prisma.lead.upsert({
  where: { tenantId_cpf: { tenantId: tenant!.id, cpf: dadosScraper.cpf } },
  create: {
    origem: 'api_iptu_scraper',
    status: 'NOVO' // ❌ ERRADO!
  }
});
```

**Linha 523-542** - Cria Lead no confirmar:
```typescript
const lead = await prisma.lead.upsert({
  create: {
    origem: 'api_iptu',
    status: 'NOVO' // ❌ ERRADO!
  }
});
```

## Correções Necessárias

### 1. Banco de Dados (SQL)

Migrar os 698 leads NOVO de origem mineração para a tabela correta:

```sql
-- Análise prévia
SELECT 
  origem, 
  status, 
  COUNT(*) 
FROM leads 
GROUP BY origem, status;

-- Identificar leads que deveriam ser contatos
SELECT COUNT(*) FROM leads 
WHERE status = 'NOVO' 
  AND origem IN ('api_iptu', 'api_iptu_scraper');
```

### 2. Código Backend

**Opção A**: Corrigir a rota `/confirmar-leads` para criar Contatos
**Opção B**: Deprecar a rota legada (já existe fluxo correto via Campanhas)

### 3. Frontend

- Página de Leads deve mostrar apenas `status = 'QUALIFICADO'` (já faz!)
- Criar página de "Contatos" para ver dados da mineração

## Código Correto (já existe)

O fluxo correto **já está implementado** nas ferramentas SDR:

- `converterParaLeadTool` (sdr-tools.ts:619-794)
- `qualificarLeadTool` (sdr-tools.ts:19-321)

Estas ferramentas:
1. Recebem um `contatoId`
2. Criam o Lead com status `QUALIFICADO`
3. Atualizam o Contato com `virouLead: true`

## Ações Recomendadas

1. [x] Documentar o problema
2. [ ] Limpar/migrar dados incorretos
3. [ ] Corrigir rota de mineração legada
4. [ ] Melhorar UI para separar Contatos de Leads
5. [ ] Adicionar validação para evitar criação de Leads com status NOVO

## Impacto

- **Usuário vê 698 "leads"** que na verdade são apenas contatos não qualificados
- **Métricas distorcidas** (total de leads inflado)
- **Confusão operacional** para corretores

---

## ✅ MIGRAÇÃO EXECUTADA: 2024-12-14 23:20

### Ações Realizadas

1. **Backup criado**: `leads_backup_20241214` (666 registros)

2. **Migração de dados**:
   - 423 leads SEM telefone → ARQUIVADOS
   - 243 leads COM telefone → Migrados para CONTATOS
   - Criada campanha "[Migração] Dados Mineração Legada"

3. **Correção de código**:
   - `/rotas/mineracao/processamento.rotas.ts` modificado
   - Remoção da criação automática de Leads
   - Agora apenas retorna dados para o frontend processar

### Resultado Final

| Tabela | Antes | Depois |
|--------|-------|--------|
| Leads NOVO | 698 | **32** (apenas WhatsApp legítimos) |
| Leads ARQUIVADOS | 0 | 666 (backup preservado) |
| Contatos AGUARDANDO | 100 | **343** (+243 migrados) |
| Imóveis | 960 | 960 (preservados) |

### Fluxo Agora

```
Mineração IPTU → Dados retornados → Frontend cria Campanha → Vincula como Contatos → IA Prospecta → Qualifica → Lead
```

### Códigos Modificados

1. `/rotas/mineracao/processamento.rotas.ts`:
   - Linha ~195-220: Removido `prisma.lead.upsert` do scraper
   - Linha ~510-580: Removido criação de Lead, apenas imóveis são salvos

### Rollback (se necessário)

```sql
-- Restaurar leads do backup
INSERT INTO leads 
SELECT * FROM leads_backup_20241214 
ON CONFLICT (id) DO NOTHING;
```

