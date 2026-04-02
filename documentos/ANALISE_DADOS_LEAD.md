# 🔍 ANÁLISE: DADOS COLETADOS vs DADOS NECESSÁRIOS

**Data:** 06/12/2025  
**Contexto:** Verificação dos dados coletados pelo SDR vs necessidades do módulo de gestão

---

## 📊 SITUAÇÃO ATUAL

### **O que o SDR COLETA hoje (FSM)**
```typescript
dadosColetados: {
  quartos?: number;              // ✅ Coletado via SPIN
  ocupacao?: 'ocupado' | 'vazio'; // ✅ Coletado via SPIN  
  motivacao?: string;             // ✅ Coletado via SPIN
  timeline?: string;              // ✅ Coletado via SPIN
}
```

### **O que a tool `qualificar_lead` RECEBE**
```typescript
qualificar_lead({
  // OBRIGATÓRIOS:
  temperatura: 'FRIO' | 'MORNO' | 'QUENTE',  // ✅ SDR decide
  interesse: string,                          // ✅ SDR pergunta
  timeline: string,                           // ✅ Já tem no FSM
  
  // OPCIONAIS:
  orcamento?: string,                         // ⚠️ NÃO está no FSM!
  motivacao?: string,                         // ✅ Já tem no FSM
  estadoImovel?: string,                      // ✅ Já tem no FSM (ocupacao)
  observacoes?: string                        // ⚠️ Genérico
})
```

### **O que a tool `agendar_avaliacao` RECEBE**
```typescript
agendar_avaliacao({
  contatoId: string,
  dataAvaliacao: string,                    // ✅ SDR confirma
  observacoes?: string,
  
  // OPCIONAIS (complementares):
  enderecoImovel?: string,                  // ⚠️ Pode vir do Contato
  tipoImovel?: string,                      // ⚠️ NÃO coletado!
  areaAproximada?: string                   // ⚠️ NÃO coletado!
})
```

---

## ⚠️ GAPS IDENTIFICADOS

### **GAP 1: Dados do Imóvel não coletados sistematicamente**

**Problema:**
- SDR coleta `quartos` mas não coleta `area`, `tipo`, `vagas`
- `tipoImovel` é opcional no agendamento mas útil para o corretor

**Impacto:**
- Corretor vai sem saber se é apartamento ou casa
- Não sabe tamanho aproximado para estimativa

**Solução:**
```typescript
// Adicionar ao FSM (dadosColetados):
dadosColetados: {
  // Já existentes
  quartos?: number;
  ocupacao?: 'ocupado' | 'vazio';
  motivacao?: string;
  timeline?: string;
  
  // 🆕 NOVOS (opcionais mas recomendados):
  tipo?: 'apartamento' | 'casa' | 'comercial' | 'terreno';
  area?: string;              // Ex: "100m²", "grande", "3 quartos"
  vagas?: number;
  valorPretendido?: string;   // Ex: "600 mil", "entre 500-700k"
}
```

### **GAP 2: Endereço nem sempre é capturado**

**Problema:**
- SDR pode qualificar sem endereço completo
- Depende do `enderecoImovel` do Contato (mineração)
- Pode não ter sido atualizado

**Impacto:**
- Corretor agenda avaliação mas não sabe onde ir
- Cliente precisa repetir endereço

**Solução:**
```typescript
// Adicionar pergunta explícita antes de agendar:
"Perfeito! Para eu agendar a avaliação, 
qual o endereço completo do imóvel?
Rua, número, bairro..."

// Validar antes de chamar agendar_avaliacao:
if (!enderecoConfirmado) {
  → Perguntar endereço
} else {
  → Chamar agendar_avaliacao
}
```

### **GAP 3: Valor pretendido não é coletado consistentemente**

**Problema:**
- `orcamento` é opcional no `qualificar_lead`
- Não está no FSM (dadosColetados)
- SDR pode qualificar sem saber o valor

**Impacto:**
- Corretor não sabe expectativa de preço
- Pode fazer proposta muito baixa/alta

**Solução:**
```typescript
// Tornar obrigatório para QUENTES:
if (temperatura === 'QUENTE') {
  if (!valorPretendido) {
    → Perguntar: "E qual valor você está pensando?"
  }
}
```

---

## 🎯 PROPOSTA DE MELHORIA

### **OPÇÃO 1: Melhorar FSM (Recomendado)** ⭐

**Expandir dados coletados no SPIN:**
```typescript
interface EstadoQualificacao {
  fase: FaseSPIN;
  dadosColetados: {
    // ✅ Já existentes:
    quartos?: number;
    ocupacao?: 'ocupado' | 'vazio';
    motivacao?: string;
    timeline?: string;
    
    // 🆕 NOVOS (coleta progressiva):
    tipo?: 'apartamento' | 'casa' | 'comercial' | 'terreno';
    area?: string;
    vagas?: number;
    valorPretendido?: string;
    endereco?: string;           // Confirmar antes de agendar
    interesse?: 'vender' | 'alugar' | 'ambos';
  };
  tentativasRecovery: number;
  objecoesRecebidas: string[];
}
```

**Vantagens:**
- ✅ Dados estruturados
- ✅ Validação no FSM
- ✅ Persistência automática
- ✅ Qualidade de coleta aumenta

**Desvantagens:**
- ⚠️ Conversas podem ficar mais longas
- ⚠️ Risco de lead desistir se perguntar demais

### **OPÇÃO 2: Manter Mínimo no FSM, Coletar no Agendamento**

**FSM coleta o mínimo:**
```typescript
dadosColetados: {
  quartos?: number;
  ocupacao?: 'ocupado' | 'vazio';
  motivacao?: string;
  timeline?: string;
}
```

**Coletar detalhes só quando agendar avaliação:**
```
SDR: "Ótimo! Vou agendar a avaliação. 
      Só preciso de algumas informações rápidas:"
      
1. Qual o endereço completo?
2. É apartamento ou casa?
3. Quantos metros² aproximadamente?
4. Qual valor você está pensando?

[Com essas respostas, chama agendar_avaliacao]
```

**Vantagens:**
- ✅ Conversa inicial mais rápida
- ✅ Coleta detalhes só quando necessário
- ✅ Menos risco de desistência

**Desvantagens:**
- ⚠️ Pode esquecer de perguntar algo
- ⚠️ Dados não estruturados no FSM

---

## 💡 RECOMENDAÇÃO FINAL

### **Híbrido: FSM + Checklist Pré-Agendamento**

#### **1. FSM coleta o essencial:**
```typescript
dadosColetados: {
  quartos: number,              // OBRIGATÓRIO para qualificar
  ocupacao: 'ocupado' | 'vazio', // OBRIGATÓRIO
  motivacao: string,             // OBRIGATÓRIO
  timeline: string,              // OBRIGATÓRIO
  
  // Opcionais (se surgirem naturalmente):
  tipo?: string,
  area?: string,
  valorPretendido?: string,
  interesse?: string
}
```

#### **2. Checklist antes de `agendar_avaliacao`:**
```typescript
// No prompt do SDR:
"ANTES de chamar agendar_avaliacao, 
CONFIRME que você tem:"

✓ Endereço completo
✓ Tipo do imóvel (apartamento/casa)
✓ Valor pretendido pelo proprietário
✓ Data e hora confirmadas

Se faltar algo, PERGUNTE antes de agendar!
```

#### **3. Model Lead expandido:**
```prisma
model Lead {
  // ... campos existentes ...
  
  // 🆕 Dados do imóvel de interesse:
  tipoImovel         String?    // apartamento, casa, etc
  areaImovel         String?    // "100m²"
  vagasImovel        Int?
  valorPretendido    String?    // "600 mil"
  interesseEm        String?    // "vender", "alugar"
  
  // 🆕 Dados de qualificação SDR:
  motivacaoVenda     String?
  prazoDesejado      String?    // "3 meses", "urgente"
  situacaoImovel     String?    // "ocupado", "vazio"
}
```

---

## 🚀 PLANO DE AÇÃO

### **FASE 1: Ajustar Prompt SDR** (30min)
- [ ] Adicionar checklist pré-agendamento
- [ ] Instruir a perguntar endereço antes de agendar
- [ ] Instruir a perguntar valor pretendido para QUENTES

### **FASE 2: Expandir Schema Lead** (30min)
- [ ] Adicionar campos: tipoImovel, areaImovel, valorPretendido
- [ ] Migração Prisma
- [ ] Atualizar tool `qualificar_lead` para salvar esses dados

### **FASE 3: Atualizar `agendar_avaliacao`** (30min)
- [ ] Salvar dados do imóvel no Lead
- [ ] Incluir na descrição da Atividade
- [ ] Validar campos obrigatórios

### **FASE 4: Frontend exibir dados** (1h)
- [ ] Tela detalhes do Lead mostrar imóvel
- [ ] Card de agendamento com dados completos

---

## 📋 DADOS MÍNIMOS PARA MVP

### **Para QUALIFICAR:**
- ✅ Quartos
- ✅ Ocupação
- ✅ Motivação
- ✅ Timeline
- ✅ Interesse (vender/alugar)
- ✅ Temperatura

### **Para AGENDAR AVALIAÇÃO:**
- ✅ Tudo acima +
- 🆕 Endereço completo
- 🆕 Tipo do imóvel
- 🆕 Valor pretendido

### **Nice to Have (opcional):**
- Área aproximada
- Vagas de garagem
- Estado de conservação
- Diferenciais (vista, piscina, etc)

---

**Quer que eu implemente a OPÇÃO HÍBRIDA?** 🚀

Isso vai garantir que:
1. ✅ SDR coleta o essencial
2. ✅ Antes de agendar, confirma dados cruciais
3. ✅ Lead no CRM tem informações completas
4. ✅ Corretor vai preparado para avaliação
