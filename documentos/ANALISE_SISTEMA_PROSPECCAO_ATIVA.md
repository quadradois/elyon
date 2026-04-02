# 🔍 ANÁLISE HOLÍSTICA: Sistema de Prospecção Ativa ELYON

**Versão:** 1.0  
**Data:** 02 de Dezembro de 2025  
**Autor:** Análise Estratégica de Produto  
**Objetivo:** Diagnóstico completo para preparar o sistema para prospecção ativa (outbound)

---

## 📋 SUMÁRIO EXECUTIVO

### O Contexto Crítico

O sistema ELYON foi construído com uma **arquitetura de atendimento PASSIVO** (inbound), onde o lead inicia a conversa. Porém, **90% do modelo de negócio é PROSPECÇÃO ATIVA** (outbound), onde:

- 99% dos contatos **NUNCA tiveram relação prévia** com o tenant
- A maioria **NÃO tem interesse em vender/alugar** inicialmente
- **NÃO estão esperando** contato sobre seus imóveis
- Precisamos **captar a atenção** de quem já está anunciando ou pensando em vender/alugar

### Diagnóstico em Números

| Aspecto | Status Atual | Necessário para Outbound |
|---------|--------------|--------------------------|
| Fluxo de Primeiro Contato | ❌ Não existe | ✅ Crítico |
| Mensagem Inicial Automatizada | ❌ Não existe | ✅ Crítico |
| Estratégia de Abordagem Fria | ❌ Não existe | ✅ Crítico |
| Sistema de Disparos | ❌ Não existe | ✅ Crítico |
| Gestão de Opt-out | ❌ Não existe | ✅ Obrigatório (legal) |
| Templates de Primeira Mensagem | ❌ Não existe | ✅ Crítico |
| Rate Limiting de Disparos | ❌ Não existe | ⚠️ Importante |
| Filas de Contatos | ❌ Não existe | ✅ Crítico |
| Horários de Disparo | ❌ Não existe | ⚠️ Importante |
| Métricas de Conversão Outbound | ❌ Não existe | ✅ Importante |

### Gap Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA ATUAL vs NECESSÁRIO                              │
└─────────────────────────────────────────────────────────────────────────────┘

MODELO ATUAL (PASSIVO/INBOUND)         MODELO NECESSÁRIO (ATIVO/OUTBOUND)
═══════════════════════════════        ═══════════════════════════════════

Lead envia mensagem                    ELYON inicia contato
        ↓                                      ↓
Webhook recebe                         Sistema dispara mensagem
        ↓                                      ↓
ELYON processa                         Contato pode responder ou ignorar
        ↓                                      ↓
SDR qualifica                          SDR engaja (se responder)
        ↓                                      ↓
Resposta automática                    Qualificação gradual

❌ PROBLEMA: Não existe caminho        ✅ SOLUÇÃO: Criar fluxo completo
   para INICIAR conversas                 de prospecção ativa
```

---

## 🔴 GAPS CRÍTICOS IDENTIFICADOS

### 1. **Ausência de Sistema de Disparos**

**Estado Atual:**
- O sistema apenas RESPONDE mensagens recebidas
- Não há forma de INICIAR conversas programaticamente
- `whatsappService.enviarMensagemTexto()` existe mas não há orquestração

**Código Atual (Passivo):**
```typescript
// webhook.ts - Apenas recebe
router.post('/messages', async (req, res) => {
  // Só processa mensagens RECEBIDAS
  const { message } = req.body.data;
  await elyonCore.processarMensagem(leadId, mensagem, tipo);
});
```

**Necessário (Ativo):**
```typescript
// disparo.ts - Novo serviço necessário
class ServicoDisparo {
  async iniciarProspeccao(contatoId: string, campanhaId: string) {
    // 1. Buscar contato e briefing da campanha
    // 2. Gerar mensagem inicial personalizada
    // 3. Enviar via WhatsApp
    // 4. Registrar tentativa
    // 5. Aguardar resposta (webhook cuida disso)
  }
}
```

### 2. **Falta de Estratégia de Primeira Mensagem**

**O Desafio:**
- 99% dos contatos são "frios" (não conhecem a imobiliária)
- 90% não têm interesse explícito em vender/alugar
- A mensagem inicial PRECISA:
  - Não parecer spam
  - Despertar curiosidade
  - Ser relevante para quem está pensando em vender/alugar
  - Respeitar a privacidade (LGPD)

**Estado Atual:**
- `scripts.saudacao` existe mas é para quando LEAD inicia contato
- Não há template específico para prospecção fria

**Exemplo do Problema:**
```typescript
// sdr-worker.ts linha 152
saudacao: "${scripts.saudacao}"
// Usa: "Olá! Como posso ajudar você hoje?"
// PROBLEMA: Lead não pediu ajuda! Nós que estamos contatando!
```

### 3. **SDR Worker NÃO Preparado para Abordagem Fria**

**Prompt Atual (linha 159 sdr-worker.ts):**
```typescript
1. **Primeiro Contato** (se for a primeira mensagem)
   - Cumprimentar de forma amigável e profissional
   - Se apresentar brevemente
   - Confirmar que está falando com o proprietário
```

**Problema:** Assume que o lead já sabe por que está sendo contatado!

**Necessário:**
```typescript
1. **Primeiro Contato FRIO** (prospecção ativa)
   - Explicar QUEM você é e DE ONDE conseguiu o contato
   - Explicar rapidamente o MOTIVO do contato
   - Fazer uma pergunta de ABERTURA não invasiva
   - Dar opção de OPT-OUT imediato
```

### 4. **Ausência de Gestão de Filas de Contatos**

**Estado Atual:**
- Contatos ficam em status "AGUARDANDO" eternamente
- Não há sistema de "próximo contato a abordar"
- Não há priorização (ex: contatos com WhatsApp primeiro)

**Schema Atual (schema.prisma):**
```prisma
statusProspeccao    String    @default("AGUARDANDO")
// Valores: AGUARDANDO, CONTATANDO, RESPONDEU, SEM_INTERESSE, INTERESSADO, LEAD
```

**Falta:**
- Sistema de fila com priorização
- Controle de tentativas e intervalos
- Blacklist/Opt-out persistente

### 5. **Ausência de Rate Limiting e Horários**

**Riscos:**
- Banimento do número WhatsApp por spam
- Contato em horários inapropriados
- Múltiplas mensagens para mesmo contato

**Necessário:**
- Limite de disparos por hora/dia
- Janela de horário permitido (08h-20h)
- Intervalo mínimo entre mensagens
- Máximo de tentativas sem resposta

---

## 🎯 ESTRATÉGIA DE ABORDAGEM PROPOSTA

### Filosofia: "Porta Aberta, Não Vendedor de Porta"

A abordagem deve ser:
- **Contextualizada**: Explicar por que estamos entrando em contato
- **Não-invasiva**: Oferecer opt-out imediato
- **Relevante**: Focar em quem está anunciando ou pensando em anunciar
- **Humana**: Parecer mensagem pessoal, não marketing

### Templates de Primeira Mensagem

#### **Template 1: Contato Geral (Mineração IPTU)**
```
Olá, {nome}! 👋

Sou {agente} da {imobiliaria}. 

Vi que você é proprietário(a) de um imóvel no(a) {bairro} e gostaria de saber se você tem interesse em vender ou alugar.

Caso não tenha interesse no momento, sem problemas! É só me avisar que não volto a incomodar.

Posso ajudar com alguma informação?
```

**Por que funciona:**
- Explica como conseguiu o contato (transparência)
- Vai direto ao ponto
- Oferece opt-out respeitoso
- Termina com pergunta aberta

#### **Template 2: Contato de Imóvel Anunciado (Portais)**
```
Olá, {nome}! 

Notei que você tem um imóvel anunciado no(a) {bairro} e gostaria de conversar sobre como posso ajudar a acelerar essa negociação.

Trabalho com a {imobiliaria} e temos compradores/inquilinos buscando nessa região.

Posso te contar mais? Ou se preferir não receber contatos, me avisa que tiro você da lista.
```

**Por que funciona:**
- Mostra que é relevante (imóvel já anunciado)
- Oferece benefício concreto (compradores/inquilinos)
- Opt-out claro

#### **Template 3: Contato de Condomínio Específico**
```
Oi, {nome}! 

A {imobiliaria} está com alta procura por imóveis no {empreendimento}. 

Se você tiver interesse em vender ou alugar seu apartamento, temos clientes prontos para fechar negócio!

Quer saber mais? 😊

PS: Se não tiver interesse, me avisa que não mando mais mensagens.
```

**Por que funciona:**
- Menciona demanda real (escassez gera interesse)
- Específico para o empreendimento
- Linguagem casual mas profissional

### Fluxo de Prospecção Ativa

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE PROSPECÇÃO ATIVA                                │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │  LISTA MINERADA  │
                         │  (Contatos)      │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   FILA DE DISPAROS      │
                    │                         │
                    │ • Prioriza WhatsApp     │
                    │ • Respeita horário      │
                    │ • Rate limiting         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  GERADOR DE MENSAGEM    │
                    │                         │
                    │ • Template + contexto   │
                    │ • Personalização        │
                    │ • Validação LGPD        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     DISPARO VIA WPP     │
                    │                         │
                    │ • Evolution API         │
                    │ • Registro de tentativa │
                    │ • Status: CONTATANDO    │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ SEM RESPOSTA │    │  RESPONDEU   │    │   OPT-OUT    │
    │              │    │              │    │              │
    │ Tentar novam.│    │ SDR Worker   │    │ Blacklist    │
    │ em 24h       │    │ assume       │    │ permanente   │
    │ (max 3x)     │    │              │    │              │
    └──────────────┘    └──────┬───────┘    └──────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │    QUALIFICAÇÃO SDR     │
                    │                         │
                    │ • Descobrir interesse   │
                    │ • FRIO/MORNO/QUENTE     │
                    │ • Agendar avaliação     │
                    └─────────────────────────┘
```

---

## 📊 MODELO DE DADOS NECESSÁRIO

### Novos Campos para Contato

```prisma
model Contato {
  // ... campos existentes ...
  
  // Novos campos para prospecção ativa
  primeiroDisparo     DateTime?             // Quando enviamos primeira msg
  ultimoDisparo       DateTime?             // Último disparo enviado
  disparosEnviados    Int       @default(0) // Quantas msgs enviamos
  
  // Opt-out
  optOut              Boolean   @default(false)
  optOutEm            DateTime?
  motivoOptOut        String?               // "não_incomodar", "já_tem_imob", etc
  
  // Contexto do disparo
  templateUsado       String?               // Qual template de msg
  campanhaDisparo     String?               // Campanha ativa no disparo
  
  // Agendamento
  proximoDisparo      DateTime?             // Quando tentar novamente
  filaDisparo         Boolean   @default(false) // Está na fila ativa?
}
```

### Nova Tabela: FilaDisparo

```prisma
model FilaDisparo {
  id              String   @id @default(uuid())
  campanhaId      String
  campanha        Campanha @relation(fields: [campanhaId], references: [id])
  contatoId       String
  contato         Contato  @relation(fields: [contatoId], references: [id])
  
  // Prioridade
  prioridade      Int      @default(5) // 1=máxima, 10=mínima
  
  // Agendamento
  agendadoPara    DateTime
  
  // Status
  status          String   @default("PENDENTE") // PENDENTE, ENVIADO, FALHA, CANCELADO
  tentativa       Int      @default(1)
  
  // Auditoria
  criadoEm        DateTime @default(now())
  processadoEm    DateTime?
  erro            String?
  
  @@index([campanhaId, status])
  @@index([agendadoPara])
}
```

### Nova Tabela: ConfiguracaoDisparo

```prisma
model ConfiguracaoDisparo {
  id                    String   @id @default(uuid())
  tenantId              String   @unique
  tenant                Tenant   @relation(fields: [tenantId], references: [id])
  
  // Limites
  disparosPorHora       Int      @default(20)
  disparosPorDia        Int      @default(100)
  intervaloMinimo       Int      @default(30) // segundos entre disparos
  maxTentativasSemResposta Int   @default(3)
  intervaloEntreRetentativas Int @default(24) // horas
  
  // Janela de Horário
  horaInicio            Int      @default(8)  // 08:00
  horaFim               Int      @default(20) // 20:00
  diasSemana            String   @default("1,2,3,4,5") // seg-sex
  
  // Templates
  templatePadrao        String?
  templates             Json?    // Array de templates customizados
  
  criadoEm              DateTime @default(now())
  atualizadoEm          DateTime @updatedAt
}
```

---

## 🛠️ IMPLEMENTAÇÃO PROPOSTA

### Fase 1: Infraestrutura de Disparos (Semana 1)

1. **Criar ServicoDisparo**
   - Fila de mensagens com priorização
   - Rate limiting
   - Janela de horário
   - Registro de tentativas

2. **Atualizar Schema Prisma**
   - Novos campos em Contato
   - Tabela FilaDisparo
   - ConfiguracaoDisparo

3. **API de Disparos**
   - `POST /api/campanhas/:id/iniciar-prospeccao`
   - `POST /api/campanhas/:id/pausar-prospeccao`
   - `GET /api/campanhas/:id/fila-disparo`

### Fase 2: Estratégia de Mensagens (Semana 1-2)

1. **Criar Templates de Primeira Mensagem**
   - Template genérico (mineração IPTU)
   - Template imóvel anunciado
   - Template empreendimento específico

2. **Gerador de Mensagem Personalizada**
   - Substituição de variáveis
   - Validação LGPD (opt-out)
   - A/B testing de templates

3. **Atualizar SDR Worker**
   - Novo prompt para abordagem fria
   - Detecção de opt-out
   - Fluxo específico para primeiro contato

### Fase 3: Interface de Gestão (Semana 2)

1. **Tela de Configuração de Disparos**
   - Limites e horários
   - Templates personalizáveis
   - Preview de mensagem

2. **Dashboard de Prospecção**
   - Fila atual
   - Taxa de resposta
   - Conversões por template

3. **Gestão de Opt-outs**
   - Lista de bloqueados
   - Motivos de recusa
   - Exportação para compliance

---

## 📝 PROMPT DO SDR PARA PROSPECÇÃO ATIVA

### System Prompt Atualizado

```typescript
const SYSTEM_PROMPT_PROSPECCAO_ATIVA = `
Você é ${nome}, SDR (Sales Development Representative) da ${imobiliaria}.

🎯 CONTEXTO CRÍTICO
Você está fazendo PROSPECÇÃO ATIVA. O contato:
- NÃO te conhece
- NÃO pediu para ser contatado
- Pode ou não ter interesse em vender/alugar
- Merece respeito e opção de opt-out

🗣️ PRIMEIRA MENSAGEM (já foi enviada)
A mensagem inicial já foi enviada pelo sistema. Você está recebendo a RESPOSTA do contato.

📋 COMO INTERPRETAR RESPOSTAS

**POSITIVAS (continuar qualificação):**
- "Oi, tudo bem" → Responder e perguntar sobre o imóvel
- "Sim, tenho interesse" → Qualificar (venda ou locação?)
- "Pode falar" → Explicar seu trabalho e perguntar interesse

**NEUTRAS (explorar com cuidado):**
- "Quem é você?" → Explicar novamente, oferecer opt-out
- "Como conseguiu meu número?" → Ser transparente (banco de dados públicos/IPTU)
- "?" ou "Oi" → Reapresentar proposta brevemente

**NEGATIVAS (respeitar imediatamente):**
- "Não tenho interesse" → Agradecer e encerrar
- "Não me ligue mais" → Pedir desculpas e garantir opt-out
- "Já tenho imobiliária" → Agradecer e perguntar se pode ser segunda opção
- "Não quero vender" → Ok! Perguntar sobre locação? Se não, encerrar
- Qualquer agressividade → Pedir desculpas e encerrar

⚠️ REGRAS CRÍTICAS

1. **SEMPRE ofereça opt-out** se o contato parecer desconfortável
2. **NUNCA seja insistente** - uma "não" é suficiente
3. **Seja transparente** sobre como conseguiu o contato
4. **Valorize o tempo** do contato - seja breve e direto
5. **Registre opt-out** imediatamente se solicitado

🔧 FERRAMENTAS

- qualificar_lead: Quando tiver interesse + tipo (venda/locação) + timeline
- solicitar_humano: Quando lead quiser falar com corretor
- registrar_optout: Quando contato pedir para não ser mais contatado
- buscar_imovel: Quando precisar de dados do imóvel do contato

💡 LEMBRE-SE
O objetivo NÃO é vender. É descobrir se há interesse genuíno em anunciar o imóvel.
Se não houver, encerrar educadamente é melhor que insistir e prejudicar a imagem.
`;
```

### Nova Ferramenta: registrar_optout

```typescript
const registrarOptoutTool = {
  name: 'registrar_optout',
  description: 'Registra que o contato não quer mais receber mensagens. Use quando o contato pedir para não ser mais contatado.',
  parameters: {
    type: 'object',
    properties: {
      contatoId: {
        type: 'string',
        description: 'ID do contato'
      },
      motivo: {
        type: 'string',
        enum: ['NAO_INCOMODAR', 'JA_TEM_IMOBILIARIA', 'SEM_INTERESSE_AGORA', 'IMOVEL_VENDIDO', 'OUTRO'],
        description: 'Motivo do opt-out'
      },
      observacao: {
        type: 'string',
        description: 'Observação adicional sobre o motivo'
      }
    },
    required: ['contatoId', 'motivo']
  }
};
```

---

## 📊 MÉTRICAS DE PROSPECÇÃO ATIVA

### Dashboard Necessário

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MÉTRICAS DE PROSPECÇÃO                                   │
└─────────────────────────────────────────────────────────────────────────────┘

FUNIL DE CONVERSÃO
═══════════════════

Contatos Minerados     ████████████████████████████████████  1.000 (100%)
        ↓
Disparos Enviados      ██████████████████████████            650 (65%)
        ↓
Respostas Recebidas    ████████████                          200 (31%)
        ↓
Interessados           ██████                                120 (60%)
        ↓
Avaliações Agendadas   ███                                   60 (50%)
        ↓
Imóveis Captados       █                                     20 (33%)


MÉTRICAS-CHAVE
═══════════════════

Taxa de Resposta:        31%     (meta: 25%)   ✅
Taxa de Interesse:       60%     (meta: 40%)   ✅
Taxa de Opt-out:         8%      (máx: 15%)    ✅
Tempo Médio Resposta:    4.2h    (meta: <24h)  ✅


POR TEMPLATE
═══════════════════

Template A (Genérico):      28% resposta | 55% interesse
Template B (Anunciado):     42% resposta | 72% interesse  ⭐ Melhor
Template C (Empreendimento): 35% resposta | 65% interesse
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Prioridade 1 (Crítico)
- [ ] Criar ServicoDisparo com fila
- [ ] Implementar rate limiting
- [ ] Criar templates de primeira mensagem
- [ ] Atualizar schema com novos campos
- [ ] Implementar opt-out no SDR Worker
- [ ] API para iniciar/pausar prospecção

### Prioridade 2 (Importante)
- [ ] Janela de horário de disparos
- [ ] Retry automático para sem resposta
- [ ] Dashboard de métricas outbound
- [ ] Gestão de blacklist
- [ ] A/B testing de templates

### Prioridade 3 (Desejável)
- [ ] Variações automáticas de mensagem
- [ ] Análise de sentimento nas respostas
- [ ] Priorização inteligente da fila
- [ ] Integração com CRM externo
- [ ] Relatórios de compliance LGPD

---

## 🚨 CONSIDERAÇÕES LEGAIS (LGPD)

### Obrigatório
1. **Opt-out claro** em toda primeira mensagem
2. **Registro de consentimento** (ou interesse legítimo documentado)
3. **Blacklist persistente** respeitada por todo o sistema
4. **Origem dos dados** documentada (IPTU, portais, etc.)

### Recomendado
1. Política de privacidade acessível
2. Canal para solicitação de exclusão de dados
3. Limite de tentativas de contato
4. Registro de todas as interações

---

## 📅 PRÓXIMOS PASSOS

1. **Imediato**: Aprovar estratégia de abordagem e templates
2. **Semana 1**: Implementar infraestrutura de disparos
3. **Semana 2**: Integrar SDR Worker com novo fluxo
4. **Semana 3**: Testes com campanha piloto
5. **Semana 4**: Ajustes baseados em métricas reais

---

**Documento preparado para discussão estratégica.**
**Aguardando aprovação para início da implementação.**
