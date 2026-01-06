---
description: Refatoração da arquitetura para separar Contatos (Base Fria) de Leads (CRM)
---

# 🏗️ Refatoração: Segregação Leads vs. Contatos

**Objetivo:** Separar a base de dados em duas camadas distintas para otimizar performance e usabilidade.
1. **Contatos (Base Fria):** Dados brutos de mineração, trabalhados exclusivamente pela IA/SDR.
2. **Leads (Base Quente/CRM):** Oportunidades qualificadas, trabalhadas por corretores humanos.

## 1. Alterações no Banco de Dados (Schema)

- [x] Criar model `Contato` no Prisma:
    - Campos básicos: nome, telefone, email, documento (cpf/cnpj).
    - Campos de origem: idMineracao, origem (ex: 'scraping-iptu').
    - Status de Qualificação: `NAO_PROCESSADO` | `EM_QUALIFICACAO` | `QUALIFICADO` | `DESCARTADO`.
    - Dados do Imóvel (Json simplificado).
- [x] Alterar model `Lead`:
    - Adicionar campo `contatoOrigemId` (relação opcional com Contato).
    - Manter estrutura robusta de CRM (SPIN, Atividades).

## 2. Migração de Dados (Script)

- [ ] Criar script `mover-leads-frios.ts`:
    - Identificar Leads com status `NOVO` E sem `Atividades` E sem `Conversas`.
    - Copiar estes registros para tabela `Contato`.
    - Deletar estes registros da tabela `Lead`.
    - **Resultado:** Limpeza da tabela Leads, mantendo apenas o que é real.

## 3. Ajuste no Fluxo de Mineração

- [x] Alterar `processamento.rotas.ts`:
    - Ao finalizar mineração/enriquecimento, salvar em `Contato` em vez de `Lead`.

## 4. Ajuste no Painel do Corretor (Frontend)

- [x] Tela de "Listas" (já existente) deve ler da tabela `Contatos`.
- [x] Tela de "Leads" (CRM) deve ler APENAS da tabela `Leads`.
- [x] Adicionar botão "Promover a Lead" manual na tela de Listas/Contatos.

## 5. Gatilho de Promoção (SDR)

- [ ] Alterar webhook do WhatsApp/Agent:
    - Quando o SDR detectar "Interesse", chamar função `promoverContatoParaLead(contatoId)`.
    - Essa função cria o registro na tabela `Leader` e notifica o corretor.

---

## 📅 Execução

Recomendado executar em ambiente de Stage/Dev primeiro.
