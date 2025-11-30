# 📋 BRIEFING FINAL - MVP Agentes de IA ELYON

**Versão:** 1.0.0  
**Data:** 30 de Novembro de 2025  
**Projeto:** QuadraDois ELYON  
**Objetivo:** Sistema de Agentes de IA para Imobiliárias

---

## 📌 SUMÁRIO EXECUTIVO

### Visão do Produto

O ELYON é uma plataforma de agentes de IA especializados para o mercado imobiliário, que automatiza o atendimento inicial de leads via WhatsApp, qualificando-os e preparando-os para o contato com corretores humanos.

### Proposta de Valor

> **"Agentes de IA pré-treinados para o mercado imobiliário. Configure em 5 minutos, atenda 24/7."**

### Público-Alvo MVP

- Imobiliárias de pequeno e médio porte (5-50 corretores)
- Corretores autônomos com alto volume de leads
- Incorporadoras com lançamentos

---

## 🏗️ ARQUITETURA DO SISTEMA

### Diagrama Geral

```
                              ┌─────────────────────────────────────┐
                              │           WHATSAPP                  │
                              │        (Evolution API)              │
                              └──────────────┬──────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELYON CORE v0.5                                │
│                         (Orquestrador Principal)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Detector   │  │  Roteador   │  │  Rate       │  │   RAG       │        │
│  │  de IA      │  │  de Intenção│  │  Limiter    │  │   Engine    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
          ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
          │   SDR VENDAS    │      │   SDR LOCAÇÃO   │      │  SDR CAPTAÇÃO   │
          │                 │      │                 │      │                 │
          │ Qualifica       │      │ Qualifica       │      │ Convence        │
          │ compradores     │      │ inquilinos      │      │ proprietários   │
          └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
                   │                        │                        │
                   └────────────────────────┼────────────────────────┘
                                            ▼
                                  ┌─────────────────┐
                                  │    SUPERVISOR   │
                                  │                 │
                                  │ Qualidade       │
                                  │ Escalação       │
                                  │ Refinamento     │
                                  └────────┬────────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                         ┌────────┐  ┌──────────┐  ┌─────────┐
                         │ ENVIAR │  │ REFINAR  │  │ ESCALAR │
                         │        │  │          │  │ HUMANO  │
                         └────────┘  └──────────┘  └─────────┘
                                            │
                                            ▼
                                  ┌─────────────────┐
                                  │   DOCUMENTOS    │
                                  │    (Shared)     │
                                  └─────────────────┘
```

---

## 🤖 CATÁLOGO DE AGENTES

### Tipos Disponíveis no MVP

| Agente | Ícone | Objetivo | Status |
|--------|-------|----------|--------|
| SDR Vendas | 🏠 | Qualificar leads interessados em COMPRAR | ✅ MVP |
| SDR Locação | 🔑 | Qualificar leads interessados em ALUGAR | ✅ MVP |
| SDR Captação | 📋 | Convencer proprietários a ANUNCIAR | ✅ MVP |
| Documentos | 📄 | Coletar documentação necessária | ✅ MVP |

### Conceito: Agentes Pré-Treinados

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   QUADRADOIS FORNECE              CLIENTE CONFIGURA             │
│   (A "Faculdade")                 (A "Cultura da Empresa")      │
│   ══════════════════              ═════════════════════         │
│                                                                 │
│   🎓 Conhecimento técnico         🎨 Tom de voz                 │
│   📚 Perguntas de qualificação    💬 Nome do agente             │
│   🔧 Ferramentas (tools)          📍 Bairros de atuação         │
│   📊 Etapas do funil              ✨ Diferenciais               │
│   🔄 Tratamento de objeções       📝 Scripts personalizados     │
│                                                                 │
│   → IMUTÁVEL                      → CONFIGURÁVEL                │
│   → Atualizado por nós            → Definido pelo usuário       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 MODOS DE CRIAÇÃO

### Modo Rápido (Recomendado)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🚀 MODO RÁPIDO                                               │
│                                                                 │
│   • Agente pré-treinado por especialistas                      │
│   • Configuração em 5 minutos                                  │
│   • Melhores práticas do mercado imobiliário                   │
│   • Atualizações automáticas de conhecimento                   │
│   • Suporte completo                                           │
│                                                                 │
│   Wizard em 4 etapas:                                          │
│   1. Escolher tipo (Vendas/Locação/Captação)                   │
│   2. Definir identidade (nome, avatar, tom)                    │
│   3. Configurar expertise (bairros, tipos, faixa)              │
│   4. Personalizar scripts (saudação, despedida)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modo Avançado (Usuários Técnicos)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🔧 MODO AVANÇADO                                             │
│                                                                 │
│   • 100% personalizável                                        │
│   • Controle total sobre prompts                               │
│   • Definição de tools customizadas                            │
│   • Fluxos de conversa próprios                                │
│   • Responsabilidade total do usuário                          │
│                                                                 │
│   Wizard em 6 etapas:                                          │
│   1. Identidade                                                │
│   2. Objetivo e contexto                                       │
│   3. Prompt do sistema (escrita livre)                         │
│   4. Personalidade e tom                                       │
│   5. Ferramentas (tools)                                       │
│   6. Scripts e gatilhos                                        │
│                                                                 │
│   ⚠️ Isenção de responsabilidade obrigatória                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 CONHECIMENTO DOS AGENTES (Templates)

### SDR Vendas - Conhecimento Base

```typescript
const TEMPLATE_SDR_VENDAS = {
  tipo: 'SDR_VENDAS',
  objetivo: 'Qualificar leads interessados em COMPRAR imóveis',
  
  etapasFunil: [
    'CONTATO_INICIAL',
    'QUALIFICACAO',
    'APRESENTACAO',
    'VISITA_AGENDADA',
    'PROPOSTA',
    'DOCUMENTACAO'
  ],
  
  perguntasQualificacao: [
    'Qual região você está buscando?',
    'Quantos quartos você precisa?',
    'Qual sua faixa de investimento?',
    'Pretende financiar ou pagar à vista?',
    'Tem algum imóvel para dar como entrada?',
    'Para quando você precisa do imóvel?'
  ],
  
  gatilhosTemperatura: {
    QUENTE: ['urgente', 'preciso logo', 'já aprovei financiamento', 'quero fechar'],
    MORNO: ['estou pesquisando', 'talvez', 'ainda não decidi', 'comparando'],
    FRIO: ['só curiosidade', 'futuro', 'daqui a um ano', 'sem pressa']
  },
  
  objecoesComuns: {
    'muito caro': 'Entendo! Posso mostrar opções com financiamento que cabem no seu bolso. Qual valor de parcela seria confortável pra você?',
    'vou pensar': 'Claro, é uma decisão importante! Enquanto isso, posso enviar mais detalhes e fotos por aqui?',
    'já tenho corretor': 'Que bom que você já está assessorado! Ficamos à disposição como segunda opinião se precisar.',
    'não tenho entrada': 'Temos opções com entrada facilitada e uso do FGTS. Posso explicar como funciona?'
  },
  
  documentosNecessarios: [
    'RG e CPF',
    'Comprovante de renda (3 últimos)',
    'Comprovante de residência',
    'Extrato FGTS (se usar)',
    'Certidão de casamento (se casado)'
  ]
};
```

### SDR Locação - Conhecimento Base

```typescript
const TEMPLATE_SDR_LOCACAO = {
  tipo: 'SDR_LOCACAO',
  objetivo: 'Qualificar leads interessados em ALUGAR imóveis',
  
  perguntasQualificacao: [
    'Qual região você prefere?',
    'Quantos quartos precisa?',
    'Qual seu orçamento mensal para aluguel?',
    'Você tem fiador ou prefere seguro fiança?',
    'Para quando precisa do imóvel?',
    'Mora sozinho ou com família?'
  ],
  
  gatilhosTemperatura: {
    QUENTE: ['preciso essa semana', 'já tenho fiador', 'posso assinar hoje'],
    MORNO: ['próximo mês', 'ainda decidindo', 'vendo opções'],
    FRIO: ['só pesquisando', 'talvez ano que vem', 'sem pressa']
  },
  
  garantiasAceitas: [
    'Fiador (2 imóveis quitados)',
    'Seguro fiança',
    'Título de capitalização',
    'Caução (3 meses)'
  ],
  
  documentosNecessarios: [
    'RG e CPF',
    'Comprovante de renda (3x o aluguel)',
    'Comprovante de residência atual',
    'Carteira de trabalho ou contrato',
    'Documentos do fiador (se aplicável)'
  ]
};
```

### SDR Captação - Conhecimento Base

```typescript
const TEMPLATE_SDR_CAPTACAO = {
  tipo: 'SDR_CAPTACAO',
  objetivo: 'Convencer proprietários a ANUNCIAR seus imóveis',
  
  perguntasQualificacao: [
    'Seu imóvel está disponível para venda, locação ou ambos?',
    'Qual a metragem e quantos quartos?',
    'O imóvel está ocupado ou desocupado?',
    'Tem ideia do valor que pretende?',
    'Já trabalha com alguma imobiliária atualmente?',
    'Qual a urgência para vender/alugar?'
  ],
  
  argumentosVenda: [
    'Avaliação gratuita do seu imóvel',
    'Fotos profissionais inclusas',
    'Divulgação nos principais portais',
    'Acompanhamento jurídico completo',
    'Sem taxa de exclusividade obrigatória'
  ],
  
  objecoesComuns: {
    'taxa muito alta': 'Nossa taxa inclui todo o marketing, fotografia profissional e assessoria jurídica. É um investimento que acelera a venda!',
    'já tenho imobiliária': 'Entendo! Podemos trabalhar em parceria ou ser sua segunda opção. Que tal uma avaliação sem compromisso?',
    'vou vender direto': 'É uma opção! Mas sabia que imóveis com imobiliária vendem 40% mais rápido? Posso explicar como funcionamos.'
  },
  
  documentosNecessarios: [
    'Matrícula atualizada',
    'IPTU quitado',
    'Certidão de ônus reais',
    'Fotos do imóvel',
    'Documentos do proprietário'
  ]
};
```

---

## 🛡️ SISTEMA DE SUPERVISÃO

### Fluxo de Qualidade

```
┌──────────────────────────────────────────────────────────────────┐
│                     SUPERVISOR DE QUALIDADE                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. ANÁLISE DA RESPOSTA                                        │
│   ─────────────────────                                          │
│   • Confiança (0-100%)                                          │
│   • Relevância (0-100%)                                         │
│   • Tom adequado?                                               │
│   • Risco de escalação (0-100%)                                 │
│                                                                  │
│   2. DECISÃO                                                    │
│   ────────                                                       │
│   ┌─────────┐    ┌──────────┐    ┌─────────────┐                │
│   │ ENVIAR  │    │ REFINAR  │    │   ESCALAR   │                │
│   │         │    │          │    │   HUMANO    │                │
│   │ >70%    │    │ 50-70%   │    │   <50%      │                │
│   │ conf.   │    │ conf.    │    │   ou risco  │                │
│   └─────────┘    └──────────┘    └─────────────┘                │
│                                                                  │
│   3. GATILHOS DE ESCALAÇÃO IMEDIATA                             │
│   ─────────────────────────────────                              │
│   • Palavras: "procon", "advogado", "processo"                  │
│   • Temas: cancelamento, rescisão, devolução                    │
│   • Pedido explícito: "quero falar com humano"                  │
│   • Frustração detectada (2+ sinais negativos)                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🤖 DETECÇÃO DE IA vs IA

### Sinais de Suspeita

```typescript
const DETECTOR_IA = {
  sinais: {
    // Tempo de resposta
    respostaInstantanea: '<3 segundos sempre',
    
    // Padrões de texto
    semErrosDigitacao: 'Mensagens perfeitas demais',
    tamanhoConstante: 'Sempre ~50 palavras',
    semGirias: 'Linguagem muito formal',
    
    // Comportamento
    nuncaPerguntaPessoal: 'Só responde, não interage',
    respondeDeNoite: '3h da manhã, resposta imediata',
    semContextoEmocional: 'Respostas robóticas'
  },
  
  acoes: {
    suspeita_50_70: 'Inserir pergunta de validação (CAPTCHA conversacional)',
    suspeita_70_90: 'Pausar automação, aguardar humano',
    suspeita_90_100: 'Bloquear e notificar admin'
  }
};
```

### CAPTCHA Conversacional

```
┌──────────────────────────────────────────────────────────────────┐
│   Quando suspeita > 50%, o agente pergunta algo pessoal:        │
│                                                                  │
│   "Só pra eu te conhecer melhor! 😊                             │
│    Você está buscando o imóvel pra você ou pra outra pessoa?"   │
│                                                                  │
│   OU                                                             │
│                                                                  │
│   "Antes de continuar, me conta:                                │
│    Qual bairro você mais gosta em [cidade]? Algum motivo?"      │
│                                                                  │
│   → IA: Resposta genérica ou evasiva                            │
│   → Humano: Resposta com contexto pessoal                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔒 LIMITES E PROTEÇÕES

### Rate Limiting

```typescript
const LIMITES = {
  // Por conversa
  estrategia: 'AGRUPAR', // Não bloqueia, agrupa mensagens
  janelaAgrupamento: 30, // segundos de silêncio antes de responder
  maxMensagensPorConversa: 50, // Depois: escala para humano
  
  // Por tenant (proteção de custo)
  maxTokensDia: 100_000, // ~$2/dia no gpt-4o-mini
  alertaEm: 80_000, // Notifica admin em 80%
  
  // Detecção de loop
  maxRespostasSemProgresso: 10 // Se só "ok", "sim", "não"
};
```

### Mensagem de Limite Atingido

```
"Adorei nossa conversa! 😊 Para continuar te ajudando da melhor 
forma, vou passar você para o João, nosso especialista. 
Ele vai entrar em contato em instantes!"
```

---

## ⏰ OPERAÇÃO 24/7

### Decisão Final

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   🌙 O AGENTE NUNCA DORME!                                      │
│                                                                  │
│   • Responde mensagens a qualquer hora                          │
│   • Qualificação acontece 24/7                                  │
│   • Leads quentes são marcados imediatamente                    │
│                                                                  │
│   📧 ESCALAÇÃO PARA HUMANO                                      │
│                                                                  │
│   • Notificação no dashboard (sempre)                           │
│   • Email para corretor (horário comercial)                     │
│   • Mensagem ao lead: "O corretor retorna em breve!"            │
│                                                                  │
│   💡 VANTAGEM COMPETITIVA                                       │
│                                                                  │
│   "Atendimento instantâneo 24 horas por dia"                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ TERMOS DE USO E ISENÇÃO

### Aceite Obrigatório

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ⚠️ TERMOS DE USO DO AGENTE DE IA                              │
│                                                                  │
│   Ao criar e utilizar um Agente de IA na plataforma ELYON,      │
│   você concorda com os seguintes termos:                        │
│                                                                  │
│   1. NATUREZA DO SERVIÇO                                        │
│   O Agente de IA é uma ferramenta de APOIO ao atendimento.      │
│   Ele NÃO substitui o julgamento humano profissional.           │
│                                                                  │
│   2. RESPONSABILIDADE                                           │
│   • Modo Rápido: Templates desenvolvidos com melhores práticas, │
│     porém a QuadraDois NÃO se responsabiliza por respostas      │
│     inadequadas ou interpretações incorretas.                   │
│                                                                  │
│   • Modo Avançado: O usuário assume TOTAL responsabilidade      │
│     pelo comportamento do agente.                               │
│                                                                  │
│   3. SUPERVISÃO HUMANA                                          │
│   É OBRIGATÓRIO manter supervisão das conversas.                │
│                                                                  │
│   4. RESULTADOS                                                 │
│   A QuadraDois NÃO garante resultados de vendas ou conversões.  │
│                                                                  │
│   5. CONFORMIDADE LEGAL                                         │
│   O usuário é responsável pela conformidade com LGPD e demais   │
│   legislações aplicáveis.                                       │
│                                                                  │
│   6. LIMITAÇÃO                                                  │
│   A QuadraDois não se responsabiliza por danos diretos ou       │
│   indiretos causados pelo uso do agente.                        │
│                                                                  │
│   [x] Li e concordo com os Termos de Uso                        │
│                                                                  │
│              [CANCELAR]     [ACEITAR E CONTINUAR]               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗃️ MODELO DE DADOS

### Schema Principal

```prisma
model ConfiguracaoAgente {
  id                String   @id @default(uuid())
  tenantId          String
  
  // Tipo e Modo
  tipoAgente        String   // SDR_VENDAS, SDR_LOCACAO, SDR_CAPTACAO, DOCUMENTOS
  modoCreacao       String   // PRE_TREINADO, PERSONALIZADO
  templateBase      String?  // Referência ao template usado
  
  // Identidade
  nome              String
  avatar            String?
  genero            String   @default("feminino")
  
  // Personalização
  personalidade     Json     // { tom, usarEmojis, usarGirias }
  expertise         Json     // { bairros, tiposImovel, faixaPreco }
  scripts           Json     // { saudacao, despedida, objecoes }
  regrasNegocio     Json     // { horaEscalacao, corretorResponsavel }
  
  // Modo Avançado
  promptCustomizado String?  // Prompt livre (só modo avançado)
  toolsCustomizadas Json?    // Tools personalizadas
  
  // Status
  status            String   @default("RASCUNHO") // RASCUNHO, ATIVO, PAUSADO
  estaAtivo         Boolean  @default(false)
  
  // Termos
  termosAceitos     Boolean  @default(false)
  termosAceitosEm   DateTime?
  termosVersao      String?
  
  // Timestamps
  criadoEm          DateTime @default(now())
  atualizadoEm      DateTime @updatedAt
}
```

---

## 📊 FUNCIONALIDADES DO MVP

### Checklist Completo

#### ✅ Core (Obrigatório)

- [x] 4 tipos de agentes pré-treinados
- [x] 2 modos de criação (Rápido/Avançado)
- [x] Wizard de criação guiado
- [x] Configuração de personalidade e expertise
- [x] Integração WhatsApp (Evolution API)
- [x] Supervisor de qualidade
- [x] Escalação para humano
- [x] RAG de empreendimentos
- [x] RAG de conversas (aprendizado)
- [x] Dashboard de métricas
- [x] Termos de uso obrigatórios

#### ✅ Proteções (Obrigatório)

- [x] Rate limiting (agrupamento 30s)
- [x] Detector de IA vs IA
- [x] CAPTCHA conversacional
- [x] Limite de mensagens por conversa (50)
- [x] Alerta de custo (80% do limite diário)

#### ✅ UX (Obrigatório)

- [x] Status do agente: RASCUNHO / ATIVO / PAUSADO
- [x] Botão "Duplicar Agente"
- [x] Chat de teste (sandbox) antes de ativar
- [x] Notificação de escalação no dashboard
- [x] Badges visuais (Pré-treinado vs Personalizado)

#### 📅 Pós-MVP (v2)

- [ ] Histórico de versões do agente
- [ ] Multi-canal (Instagram, Site)
- [ ] Pesquisa de satisfação (1-5)
- [ ] Analytics avançado (funil)
- [ ] A/B testing de configurações
- [ ] Marketplace de templates

---

## 🔄 FLUXO COMPLETO DO USUÁRIO

### Criação de Agente (Modo Rápido)

```
1. Dashboard → "Criar Agente"
         │
         ▼
2. Escolher Modo
   ┌─────────────┐  ┌─────────────┐
   │ 🚀 RÁPIDO   │  │ 🔧 AVANÇADO │
   │  [ESCOLHER] │  │             │
   └─────────────┘  └─────────────┘
         │
         ▼
3. Aceitar Termos de Uso
   [x] Li e concordo...
   [ACEITAR E CONTINUAR]
         │
         ▼
4. Escolher Tipo de Agente
   ┌────────┐ ┌────────┐ ┌────────┐
   │🏠VENDAS│ │🔑LOCAÇÃO│ │📋CAPTAÇÃO│
   └────────┘ └────────┘ └────────┘
         │
         ▼
5. Wizard 4 Etapas
   ├── Etapa 1: Identidade (nome, avatar)
   ├── Etapa 2: Personalidade (tom, emojis)
   ├── Etapa 3: Expertise (bairros, tipos)
   └── Etapa 4: Scripts (saudação, despedida)
         │
         ▼
6. Preview e Teste
   [TESTAR NO SANDBOX]
         │
         ▼
7. Ativar
   Status: RASCUNHO → ATIVO
         │
         ▼
8. Agente funcionando! 🎉
```

### Fluxo de Conversa

```
Lead envia mensagem no WhatsApp
         │
         ▼
Evolution API → Webhook → ELYON Core
         │
         ├── Verificar rate limit
         ├── Detectar se é IA
         ├── Identificar tenant/agente
         ├── Carregar histórico
         └── Buscar contexto RAG
         │
         ▼
Roteador de Intenção
         │
         ├── Vendas? → SDR Vendas
         ├── Locação? → SDR Locação
         └── Captação? → SDR Captação
         │
         ▼
Worker processa e gera resposta
         │
         ▼
Supervisor analisa qualidade
         │
         ├── >70% confiança → ENVIAR
         ├── 50-70% → REFINAR e enviar
         └── <50% ou risco → ESCALAR
         │
         ▼
WhatsApp envia resposta
         │
         ▼
Salvar no banco + atualizar métricas
```

---

## 📈 MÉTRICAS A COLETAR

### Dashboard de Performance

| Métrica | Descrição | Meta |
|---------|-----------|------|
| Total de Conversas | Quantidade de leads atendidos | - |
| Taxa de Qualificação | Leads QUENTE / Total | > 30% |
| Tempo Médio de Resposta | Segundos até primeira resposta | < 5s |
| Taxa de Escalação | Conversas passadas para humano | < 15% |
| Distribuição de Temperatura | FRIO / MORNO / QUENTE | Balanceado |
| Custo por Conversa | Tokens consumidos / conversa | < $0.05 |

---

## 💰 PRECIFICAÇÃO

> ⏸️ **A DEFINIR EM SESSÃO DEDICADA**

Fatores a considerar:
- Custo OpenAI por mensagem (~$0.001)
- Custo de infraestrutura
- Margem desejada
- Preço da concorrência
- Modelo: por mensagem vs por agente vs flat

---

## 📅 CRONOGRAMA SUGERIDO

### Sprint 1 (2 semanas)
- [ ] Finalizar templates dos 4 agentes
- [ ] Implementar Wizard Modo Rápido completo
- [ ] Integrar termos de uso

### Sprint 2 (2 semanas)
- [ ] Implementar Modo Avançado
- [ ] Chat de teste (sandbox)
- [ ] Status do agente (RASCUNHO/ATIVO/PAUSADO)

### Sprint 3 (2 semanas)
- [ ] Detector de IA
- [ ] Rate limiting com agrupamento
- [ ] Sistema de notificações de escalação

### Sprint 4 (1 semana)
- [ ] Testes integrados
- [ ] Ajustes de UX
- [ ] Deploy para beta testers

**Total estimado: 7 semanas**

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Agente responde errado | Média | Alto | Supervisor + Escalação |
| Custo OpenAI explode | Baixa | Alto | Rate limiting + Alertas |
| Loop IA vs IA | Média | Médio | Detector + CAPTCHA |
| Cliente insatisfeito | Média | Alto | Escalação rápida |
| LGPD | Baixa | Alto | Consentimento + Retenção |

---

## ✅ APROVAÇÕES

| Item | Status |
|------|--------|
| Arquitetura Geral | ✅ Aprovado |
| 4 Tipos de Agentes | ✅ Aprovado |
| 2 Modos de Criação | ✅ Aprovado |
| Conceito Pré-treinado | ✅ Aprovado |
| Termos de Uso | ✅ Aprovado |
| Operação 24/7 | ✅ Aprovado |
| Rate Limiting (Agrupar) | ✅ Aprovado |
| Detector de IA | ✅ Aprovado |
| Precificação | ⏸️ Pendente |

---

**Documento preparado por:** GitHub Copilot  
**Revisado por:** Equipe QuadraDois  
**Versão:** 1.0.0  
**Data:** 30 de Novembro de 2025
