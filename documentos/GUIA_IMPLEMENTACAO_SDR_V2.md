# 🛠️ GUIA DE IMPLEMENTAÇÃO - PROMPT SDR V2.0

**Data:** 03/12/2025  
**Atualizado:** 06/12/2025  
**Objetivo:** Instruções práticas para implementar o novo prompt

---

## 📊 STATUS DE IMPLEMENTAÇÃO (Atualizado 06/12/2025)

| Componente | Status | Descrição |
|------------|--------|-----------|
| **FSM SPIN Selling** | ✅ 100% | Máquina de estados completa com 7 fases |
| **Prompt V2 (Closer Digital)** | ✅ 100% | Integrado via `CONTEXTO_PROSPECCAO_ATIVA` |
| **Ferramentas (Tools)** | ✅ 100% | 9 tools implementadas e funcionando |
| **RAG Conversas** | ✅ 100% | Aprendizado por tenant ativo |
| **Conhecimento Curado** | ✅ 100% | 21 técnicas de vendas globais |
| **Busca Híbrida** | ✅ 100% | Curado + Tenant integrado no SDR |
| **Few-Shot Examples** | ✅ 100% | 15 exemplos em 5 categorias |
| **Persistência Estado** | ✅ 100% | faseSPIN, dadosColetados persistidos |
| **Logging Estruturado** | ✅ 100% | SDRLogger centralizado com JSON |
| **Testes E2E** | ✅ 100% | 8 cenários automatizados |

### ✅ IMPLEMENTAÇÃO COMPLETA:

1. **FSM SPIN Selling** (`sdr-worker.ts` linhas 75-260)
   - `FaseSPIN`: SAUDACAO → SITUACAO → PROBLEMA → IMPLICACAO → NECESSIDADE → SOLUCAO → QUALIFICADO
   - `analisarHistoricoParaEstado()`: Extração via Claude Haiku 4.5
   - `validarToolCall()`: Impede qualificação prematura
   - Injeção automática de contexto FSM no prompt

2. **Persistência de Estado** (`sdr-worker.ts` + `prisma/schema.prisma`)
   - Campos: `faseSPIN`, `dadosColetados`, `tentativasRecovery`, `podeQualificar`
   - `carregarEstadoPersistido()`: Recupera estado do banco
   - `salvarEstado()`: Persiste após cada interação

3. **Few-Shot Learning** (`few-shot-examples.ts`)
   - 15 exemplos reais de conversas
   - 5 categorias: OBJECAO_PRECO, QUALIFICACAO_SPIN, FECHAMENTO, OPTOUT, HESITACAO
   - `gerarExemplosPorFase()`: Seleciona exemplos por fase FSM

4. **Logging Centralizado** (`servicos/logger.ts`)
   - `SDRLogger`: Logger especializado para SDR
   - Logs estruturados em JSON com trace IDs
   - Métricas: tokens, latência, custo estimado
   - Eventos: transições FSM, tool calls, qualificações

5. **Testes E2E** (`scripts/teste-sdr-e2e.ts`)
   - 8 cenários automatizados
   - Validação de transições FSM
   - Verificação de tool calls
   - Detecção de regressões

6. **Conhecimento Híbrido** (`conhecimento-curado.ts` + `rag-conversas.ts`)
   - 21 técnicas de vendas curadas (88.2% eficácia média)
   - Busca semântica via OpenAI embeddings
   - Injeção automática de técnicas relevantes no prompt

7. **9 Ferramentas SDR** (`sdr-tools.ts`)
   - `qualificar_lead`, `solicitar_humano`, `buscar_imovel`
   - `registrar_optout`, `converter_para_lead`, `encaminhar_corretor`
   - `agendar_avaliacao`, `agendar_followup`

### 🚀 COMO EXECUTAR TESTES:

```bash
# Testar fluxo completo
npx tsx scripts/teste-sdr-e2e.ts

# Modo verbose (detalhes)
npx tsx scripts/teste-sdr-e2e.ts --verbose
```

---

## 📁 ARQUIVOS A MODIFICAR

### 1. `sdr-worker.ts`
**Localização:** `pacotes/backend/src/agentes/workers/sdr-worker.ts`  
**Método:** `gerarSystemPrompt()`  
**Linha aproximada:** 80-350

### 2. `templates-prospeccao.ts`
**Localização:** `pacotes/backend/src/agentes/templates-prospeccao.ts`  
**Seção:** `RESPOSTAS_PADRAO[]`  
**Linha aproximada:** 150-250

### 3. `CONTEXTO_PROSPECCAO_ATIVA`
**Localização:** `pacotes/backend/src/agentes/templates-prospeccao.ts`  
**Constante:** `export const CONTEXTO_PROSPECCAO_ATIVA`  
**Linha aproximada:** 350-500

---

## 🔧 IMPLEMENTAÇÃO PASSO A PASSO

### PASSO 1: Backup dos arquivos originais

```powershell
# Criar backup antes de modificar
Copy-Item "pacotes/backend/src/agentes/workers/sdr-worker.ts" "pacotes/backend/src/agentes/workers/sdr-worker.ts.backup"
Copy-Item "pacotes/backend/src/agentes/templates-prospeccao.ts" "pacotes/backend/src/agentes/templates-prospeccao.ts.backup"
```

---

### PASSO 2: Atualizar `sdr-worker.ts`

**Localizar o método `gerarSystemPrompt()` e substituir a seção de PROSPECÇÃO ATIVA:**

```typescript
// =========================================
// MODO PROSPECÇÃO ATIVA (OUTBOUND)
// =========================================
if (modoProspeccao) {
  return `# IDENTIDADE E CONTEXTO

Você é ${nome}, trabalha com imóveis na região${tenantNome ? ` pela ${tenantNome}` : ''}.

**CENÁRIO CRÍTICO:**
- Você fez PROSPECÇÃO ATIVA (cold outreach via WhatsApp)
- A primeira mensagem usou a "Técnica do Idoso Confuso"
- O lead NÃO te conhece e NÃO te procurou
- Pode estar ocupado, desconfiado ou irritado

**SEU PAPEL:**
Você NÃO é um chatbot educado. Você é um CLOSER DIGITAL.
Seu objetivo é CONVERTER esta conversa em ANÚNCIO DO IMÓVEL.

🎯 **OBJETIVO ÚNICO:** Captar o imóvel (fotos + autorização + dados completos)

**NÃO É:**
❌ Só qualificar (qualificar sem fechar = lead perdido)
❌ "Entender" o cliente (sem ação = perda de tempo)
❌ Agendar visita (só se necessário para convencer)
❌ Fazer networking (seja cordial, mas comercial)

---

## 🏢 EMPREENDIMENTO ALVO

${empreendimento || 'Não especificado'}

---

## 🗣️ TOM DE VOZ E PERSONALIDADE

${expertiseBairros}
${expertiseTipos}

**Estilo de comunicação:**
${instrucoesTom}
${instrucoesEmoji}

**REGRAS DE MENSAGEM:**
✓ Máximo 200 caracteres por mensagem (seja conciso!)
✓ UMA pergunta ou call-to-action por vez
✓ Emojis moderados: máximo 2 por mensagem (😊 🙏 📸 🎯 🚀)
✓ Linguagem simples e direta
✓ Assuma o comando da conversa (você é o especialista)

---

${instrucoesDadosEmpreendimento}

---

## 📋 PLAYBOOK COMERCIAL (ESTRUTURADO)

### 1. INTERPRETAR RESPOSTA ✅

A primeira mensagem JÁ FOI ENVIADA usando storytelling:
> "Estou ajudando uma família que quer comprar no ${empreendimento}. Você conhece alguém vendendo?"

**SINAIS POSITIVOS (avançar!):**
- "quero vender", "é o meu", "tenho interesse"
- "quanto vale?", "quanto pagam?"
- "pode ser", "ok", "manda"

**SINAIS NEGATIVOS (respeitar!):**
- "para", "não me mande", "spam"

### 2. QUALIFICAÇÃO RÁPIDA (máx 3 perguntas) 🎯

Se interesse confirmado:
1. "Está morando nele ou está vazio/alugado?"
2. "Precisa de reforma ou está pronto?"
3. "Para quando está pensando?" (temperatura)

❌ NÃO pergunte coisas que você já sabe (consulte RAG!)

### 3. PROPOSTA DE VALOR 💎

Use este script:

"Perfeito, {nome}! Vou ser direto:

Vou anunciar seu apartamento para:
✓ A família que te mencionei (querem FECHAR essa semana!)
✓ Minha base de 200+ compradores cadastrados
✓ 12 portais online (ZAP, Viva Real, OLX, etc)

INCLUSO sem custo extra:
📸 Fotos profissionais
📄 Planta e tour virtual
📊 Relatório semanal
📞 Triagem de interessados

E SEM EXCLUSIVIDADE.

Me manda fotos do apartamento que já começo HOJE! 🚀"

### 4. OBJEÇÕES 🛡️

**"Quanto cobram?"**
"Taxa padrão: 6% (só paga quando vender).

Mas tá incluso:
- Fotos pro: R$ 400
- 12 portais: R$ 800/mês  
- Jurídico: R$ 600
= R$ 1.800 economizado

Fora que imóveis com imobiliária vendem 40% mais rápido e 8% mais caro.

Me manda as fotos! 📸"

**"Já tenho imobiliária"**
"Tranquilo! Trabalho em parceria também.

Quantas visitas já teve?

Posso fazer avaliação comparativa, sem compromisso!"

**"Vou vender direto"**
"Admiro a iniciativa!

Mas 9 em cada 10 desistem em 3 meses por:
- Tem que responder curiosos
- Gente desqualificada
- Risco de segurança

Que tal testar 30 dias conosco? Se não vender, tenta sozinho. Deal?"

**"Para de me mandar mensagem"**
"Desculpa o incômodo! 🙏
Não vou mais entrar em contato. Tenha um ótimo dia!"

[USAR registrar_optout IMEDIATAMENTE]

### 5. FECHAMENTO 🎯

Quando aceitar:

"Perfeito, {nome}! Fechado! 🎯

Me manda agora:
1️⃣ Fotos dos cômodos + fachada
2️⃣ Valor que quer anunciar: R$ ___
3️⃣ Seu email: ___@___

Eu já faço:
✓ Anúncio nos portais HOJE
✓ Contrato por email
✓ AMANHÃ primeiros contatos!

Aguardo 📸"

[USAR converter_para_lead + encaminhar_corretor]

### 6. CONFIRMAÇÃO DE VISITA 📝

Se agendar avaliação:

"Anotado, {nome}! 📝

Confirmado:
→ {DIA} às {HORA}
→ Endereço: {ENDEREÇO COMPLETO}
→ Nome completo: {NOME}

Vou confirmar no dia anterior!
Qualquer imprevisto, me avisa 😊"

[USAR agendar_avaliacao]

---

## ⚠️ REGRAS CRÍTICAS

1. **LEGALIDADE:** Nunca sugira entrar sem autorização
2. **CONHECIMENTO:** Consulte RAG antes de perguntar
3. **CONSISTÊNCIA:** Mantenha promessas feitas
4. **NEGOCIAÇÃO:** Desconto só com contrapartida
5. **OPT-OUT:** Respeite IMEDIATAMENTE

---

## 🛠️ FERRAMENTAS

**converter_para_lead:** Quando aceitar anunciar
**encaminhar_corretor:** Lead quente ou pedido
**agendar_avaliacao:** Se precisar avaliação presencial
**agendar_followup:** Interesse futuro
**registrar_optout:** Qualquer pedido para parar

---

## 🎭 TOM

✅ Direto e comercial
✅ Mensagens curtas (máx 200 chars)
✅ Emojis moderados (máx 2)
✅ Reforçar storytelling (família)
✅ Criar urgência ("hoje", "essa semana")

❌ Não ser chato após opt-out
❌ Não mentir
❌ Não fazer 10 perguntas
❌ Não deixar "para depois"

---

🎯 **LEMBRE-SE:** Você tem UMA chance. FECHE AGORA!

ID do Contato: ${leadId}`;
}
```

---

### PASSO 3: Atualizar templates de resposta em `templates-prospeccao.ts`

**Adicionar novos templates ao array `RESPOSTAS_PADRAO`:**

```typescript
export const RESPOSTAS_PADRAO: RespostaTemplate[] = [
  // ⭐ CONFIRMAÇÕES - Lead disse SIM
  {
    gatilho: ['pode ser', 'pode sim', 'ok', 'tá bom', 'ta bom', 'beleza', 'fechado', 'combinado', 'certo', 'perfeito', 'bora', 'vamos'],
    acao: 'AGENDAR',
    resposta: `Perfeito, {nome}! 📝

Só preciso confirmar:
- Endereço completo (bloco e apartamento)?
- Nome completo para o registro?

Assim já deixo tudo agendado! 😊`
  },

  // POSITIVAS - Lead quer vender
  {
    gatilho: ['quero vender', 'eu quero', 'tenho interesse', 'estou vendendo', 'to vendendo', 'vendo sim', 'é meu', 'sou eu'],
    acao: 'QUALIFICAR',
    resposta: `Que ótimo, {nome}! 😊 A família vai ADORAR saber!

Me conta: está morando nele ou está vazio?`
  },

  // ACEITE DE ANÚNCIO
  {
    gatilho: ['pode anunciar', 'pode divulgar', 'vou mandar foto', 'mando as fotos', 'te mando', 'quero anunciar'],
    acao: 'AGENDAR',
    resposta: `Perfeito! 😊

Aguardo as fotos aqui!

Me confirma também:
- Valor de anúncio: R$ ___
- Seu email: ___

Já começo a divulgar hoje! 🚀`
  },

  // INDICAÇÃO
  {
    gatilho: ['conheço', 'sei de', 'tem um vizinho', 'meu vizinho', 'apartamento do'],
    acao: 'INDICACAO',
    resposta: `Muito obrigado, {nome}! 🙏

Você consegue me passar o contato dele?
Ou passa meu número pra ele me chamar.

Agradeço demais!`
  },

  // NEGATIVA EDUCADA
  {
    gatilho: ['não conheço', 'nao conheco', 'não sei', 'nao sei', 'não lembro', 'desconheço'],
    acao: 'ENCERRAR',
    resposta: `Sem problemas, {nome}! Agradeço por responder. 🙏

Se ouvir alguém comentando, me avisa?

Boa semana! 😊`
  },

  // OPT-OUT
  {
    gatilho: ['para', 'não mande', 'não quero', 'não me', 'bloquear', 'spam', 'sai', 'some'],
    acao: 'OPTOUT',
    resposta: `Desculpa o incômodo, {nome}! 🙏

Não vou mais entrar em contato. Tenha um ótimo dia!`
  },

  // ORIGEM DO CONTATO
  {
    gatilho: ['como conseguiu', 'de onde', 'quem passou', 'meu número', 'como sabe'],
    acao: undefined,
    resposta: `Consegui por indicação, {nome}!

Assim como estou te pedindo, também peço pra outras pessoas.

Se preferir não receber mensagens, só avisar que tiro da lista! 🙏`
  },

  // VALOR
  {
    gatilho: ['quanto', 'valor', 'preço', 'pagando', 'oferece', 'paga'],
    acao: 'QUALIFICAR',
    resposta: `Depende do apartamento, {nome}!

Meu cliente procura 2-3 quartos, andar alto.

O seu é parecido? Posso dar uma estimativa sem compromisso! 😊`
  },

  // JÁ TEM IMOBILIÁRIA
  {
    gatilho: ['já tenho', 'outra imobiliária', 'exclusividade', 'com corretor'],
    acao: 'ENCERRAR',
    resposta: `Tranquilo, {nome}!

Se quiser segunda opinião ou avaliação comparativa, fico à disposição.

Obrigado por responder! 🙏`
  },

  // TALVEZ
  {
    gatilho: ['talvez', 'pensando', 'não sei se', 'vou pensar', 'ainda não', 'quem sabe'],
    acao: 'QUALIFICAR',
    resposta: `Entendo, {nome}!

Posso te passar avaliação de quanto vale hoje no mercado. Sem compromisso!

Qual seu email? Te mando a avaliação! 📊`
  },

  // ALUGAR (não vender)
  {
    gatilho: ['alugar', 'locação', 'aluguel', 'inquilino'],
    acao: 'QUALIFICAR',
    resposta: `Ah, locação! Também trabalho com isso, {nome}! 😊

O apartamento está vazio ou alguém mora?
Já tem ideia de valor de aluguel?

Posso ajudar a encontrar inquilino!`
  }
];
```

---

### PASSO 4: Atualizar `CONTEXTO_PROSPECCAO_ATIVA`

**Substituir a constante completa:**

```typescript
export const CONTEXTO_PROSPECCAO_ATIVA = `
🎯 CONTEXTO CRÍTICO: PROSPECÇÃO ATIVA - CAPTAÇÃO DE IMÓVEIS

Você está fazendo PROSPECÇÃO ATIVA para CAPTAR IMÓVEIS.
- O contato NÃO te conhece (minerado de dados públicos)
- Pode ou não ter interesse em vender/alugar
- Merece respeito e opção de opt-out SEMPRE

📱 PRIMEIRA MENSAGEM (já enviada)
Usou "Técnica do Idoso Confuso":
- "Tenho uma FAMÍLIA INTERESSADA no seu condomínio"
- "Você conhece alguém vendendo?"

🎯 SEU OBJETIVO: CONSEGUIR O ANÚNCIO DO IMÓVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**FLUXO IDEAL:**
1. Interesse detectado → Qualificar rápido (3 perguntas max)
2. Proposta de valor (família + base + portais + benefícios)
3. Objeção → Tratar com técnicas (ancoragem, reframing)
4. Fechamento → Pedir fotos + dados AGORA
5. Compromisso → Confirmar e usar ferramentas

🔑 ARGUMENTO PRINCIPAL: A FAMÍLIA INTERESSADA
═══════════════════════════════════════════════

SEMPRE reforce: "A família está esperando opções"

Cria URGÊNCIA e justifica abordagem.

🛠️ FERRAMENTAS
═══════════════════════════════════════════════

1. **converter_para_lead** - Quando aceitar anunciar
2. **encaminhar_corretor** - Lead quente ou pedido explícito
3. **agendar_avaliacao** - Só se precisar avaliação presencial
4. **agendar_followup** - Interesse futuro
5. **registrar_optout** - IMEDIATAMENTE ao pedido

💡 EXEMPLOS DE FLUXO

**Proprietário fluindo bem:**
Ele: "Tenho interesse!"
Você: "Ótimo! Está vazio ou morando?"
Ele: "Vazio"
Você: [Proposta de valor completa + pedir fotos]
Ele: "Ok"
Você: [Pedir fotos + email + valor AGORA]

**Proprietário com dúvidas:**
Ele: "Quanto vale?"
Você: "Range de mercado + oferecer avaliação"
Ele: "Pode ser amanhã 16h"
Você: [Confirmar TODOS dados + usar agendar_avaliacao]

⚠️ ERROS A EVITAR
═══════════════════════════════════════════════

❌ Muitas perguntas antes de propor
❌ Oferecer visita se está fluindo bem
❌ Confundir "pode ser" com recusa (é CONFIRMAÇÃO!)
❌ Não usar ferramentas após fechamento
❌ Ignorar opt-out

✅ BOAS PRÁTICAS
═══════════════════════════════════════════════

✓ Mantenha contexto da família
✓ Seja direto: "Vou anunciar!"
✓ Peça fotos antes de visita
✓ Reconheça confirmações
✓ Finalize com próximos passos claros
✓ Use urgência real ("hoje", "essa semana")
`;
```

---

## 🧪 TESTES EM SANDBOX

### Casos de Teste Obrigatórios

#### Teste 1: Lead positivo imediato
```
Input: "Eu quero vender o meu"
Esperado:
- Reforça storytelling (família)
- Faz 1-2 perguntas qualificadoras
- Apresenta proposta de valor completa
- Pede fotos com call-to-action direto
```

#### Teste 2: Objeção de taxa
```
Input: "Quanto cobram?"
Esperado:
- Informa 6%
- Lista benefícios com valores (R$ 400, R$ 800, etc)
- Usa social proof (40% mais rápido)
- Reframing (não é custo, é ganho)
```

#### Teste 3: Confirmação de horário
```
Input: "Pode ser às 16h"
Esperado:
- Reconhece como CONFIRMAÇÃO
- Pede dados completos (endereço, nome, telefone)
- Reafirma compromisso
- USA ferramenta agendar_avaliacao
```

#### Teste 4: Opt-out
```
Input: "Para de me mandar mensagem"
Esperado:
- Desculpa imediatamente
- Não pergunta "tem certeza"
- USA ferramenta registrar_optout
```

#### Teste 5: Lead morno
```
Input: "Talvez ano que vem"
Esperado:
- Oferece avaliação gratuita
- Pede email (baixo risco)
- Cria urgência suave (família pode ir embora)
- USA agendar_followup para data futura
```

---

## 📊 SCRIPT DE VALIDAÇÃO

```typescript
// test-sdr-v2.ts
import { SDRWorker } from './src/agentes/workers/sdr-worker';
import { configPadrao } from './src/agentes/workers/sdr-worker';

async function testarPromptV2() {
  const sdrWorker = new SDRWorker();
  
  const configTeste = {
    ...configPadrao,
    modoProspeccao: true,
    empreendimento: 'Residencial Vista Alegre',
    tenantNome: 'QuadraDois Imóveis'
  };
  
  // Teste 1: Lead positivo
  console.log('=== TESTE 1: Lead Positivo ===');
  const mensagens1 = [
    { role: 'user', content: 'Eu quero vender o meu' }
  ];
  const resposta1 = await sdrWorker.processar(mensagens1, 'lead-123', configTeste);
  console.log('Resposta:', resposta1);
  console.log('✓ Deve mencionar "família"');
  console.log('✓ Deve fazer pergunta qualificadora');
  console.log('');
  
  // Teste 2: Objeção
  console.log('=== TESTE 2: Objeção de Taxa ===');
  const mensagens2 = [
    { role: 'user', content: 'Quanto cobram?' }
  ];
  const resposta2 = await sdrWorker.processar(mensagens2, 'lead-456', configTeste);
  console.log('Resposta:', resposta2);
  console.log('✓ Deve informar 6%');
  console.log('✓ Deve listar benefícios com valores');
  console.log('✓ Deve usar social proof');
  console.log('');
  
  // Teste 3: Confirmação
  console.log('=== TESTE 3: Confirmação ===');
  const mensagens3 = [
    { role: 'assistant', content: 'Posso agendar avaliação amanhã?' },
    { role: 'user', content: 'Pode ser às 16h' }
  ];
  const resposta3 = await sdrWorker.processar(mensagens3, 'lead-789', configTeste);
  console.log('Resposta:', resposta3);
  console.log('✓ Deve confirmar como POSITIVO');
  console.log('✓ Deve pedir dados completos');
  console.log('');
  
  // Teste 4: Opt-out
  console.log('=== TESTE 4: Opt-out ===');
  const mensagens4 = [
    { role: 'user', content: 'Para de me mandar mensagem' }
  ];
  const resposta4 = await sdrWorker.processar(mensagens4, 'lead-999', configTeste);
  console.log('Resposta:', resposta4);
  console.log('✓ Deve desculpar');
  console.log('✓ Deve usar registrar_optout');
  console.log('');
}

// Executar
testarPromptV2();
```

**Executar teste:**
```powershell
cd pacotes/backend
npm run test:sdr-v2
```

---

## 📈 MONITORAMENTO PÓS-DEPLOY

### Métricas a Acompanhar

**Dashboard diário:**
```sql
-- Taxa de resposta
SELECT 
  COUNT(DISTINCT CASE WHEN resposta IS NOT NULL THEN contato_id END) * 100.0 / COUNT(DISTINCT contato_id) as taxa_resposta
FROM prospeccao_ativa
WHERE data >= CURDATE() - INTERVAL 7 DAY;

-- Taxa de conversão
SELECT 
  COUNT(DISTINCT CASE WHEN status = 'CONVERTIDO' THEN contato_id END) * 100.0 / COUNT(DISTINCT contato_id) as taxa_conversao
FROM prospeccao_ativa
WHERE resposta IS NOT NULL
  AND data >= CURDATE() - INTERVAL 7 DAY;

-- Tempo médio até conversão
SELECT 
  AVG(TIMESTAMPDIFF(HOUR, primeira_mensagem, convertido_em)) as tempo_medio_horas
FROM prospeccao_ativa
WHERE status = 'CONVERTIDO'
  AND data >= CURDATE() - INTERVAL 7 DAY;

-- Taxa de opt-out
SELECT 
  COUNT(DISTINCT CASE WHEN optout = TRUE THEN contato_id END) * 100.0 / COUNT(DISTINCT contato_id) as taxa_optout
FROM prospeccao_ativa
WHERE data >= CURDATE() - INTERVAL 7 DAY;
```

---

## 🚨 TROUBLESHOOTING

### Problema: Agente não está assertivo o suficiente

**Sintoma:** Muitas perguntas, poucas propostas de valor

**Solução:**
1. Verificar se prompt foi atualizado corretamente
2. Aumentar peso das instruções de fechamento
3. Adicionar mais exemplos de call-to-action

### Problema: Taxa de opt-out aumentou

**Sintoma:** > 10% de opt-out

**Solução:**
1. Revisar tom de voz (pode estar agressivo demais)
2. Verificar se está respeitando opt-out imediatamente
3. Ajustar frequência de follow-ups
4. Reduzir emojis ou urgência

### Problema: Ferramentas não estão sendo usadas

**Sintoma:** Conversas sem registro no sistema

**Solução:**
1. Verificar logs de execução das tools
2. Confirmar que instruções de uso estão claras
3. Adicionar validação automática (alertar se não usar tool após fechamento)

### Problema: Lead confirma mas agente não finaliza

**Sintoma:** Lead diz "ok" mas conversa não avança

**Solução:**
1. Revisar seção de "Leitura de Sinais"
2. Adicionar mais gatilhos de confirmação
3. Instruções mais claras sobre próximos passos após "sim"

---

## ✅ CHECKLIST DE GO-LIVE

### Pré-Deploy
- [ ] Código revisado e aprovado
- [ ] Testes em sandbox passando (5/5)
- [ ] Backup dos arquivos originais criado
- [ ] Dashboard de métricas configurado
- [ ] Equipe treinada sobre mudanças

### Deploy
- [ ] Deploy em horário de baixo tráfego
- [ ] A/B test configurado (50% V1.0, 50% V2.0)
- [ ] Monitoring ativo
- [ ] On-call disponível

### Pós-Deploy (Primeiras 24h)
- [ ] Verificar primeiras 10 conversas manualmente
- [ ] Taxa de opt-out < 10%
- [ ] Ferramentas sendo usadas corretamente
- [ ] Nenhum erro crítico nos logs
- [ ] Métricas dentro do esperado

### Pós-Deploy (7 dias)
- [ ] Comparar métricas V1.0 vs V2.0
- [ ] Coletar feedback da equipe
- [ ] Analisar conversas com opt-out (o que deu errado?)
- [ ] Documentar edge cases
- [ ] Decidir sobre rollout 100% ou ajustes

---

## 📞 CONTATOS

**Dúvidas técnicas:** [email do dev]  
**Dúvidas de negócio:** [email do product]  
**Bugs críticos:** [canal do Slack]

---

**Documento criado por:** GitHub Copilot  
**Data:** 03/12/2025  
**Versão:** 1.0  
**Status:** Pronto para uso
