# 🛡️ DECISÃO ARQUITETURAL: SDR + CLOSER HÍBRIDO

**Data**: 05/12/2025  
**Decisor**: Fundador + Guardião (Antigravity)  
**Status**: ✅ Aprovado

---

## 📋 Resumo da Decisão

**DECIDIDO**: Manter o agente `CaptadorWorker` como **híbrido SDR + Closer** por design.

O agente combina intencionalmente as funções de:
- **SDR** (Sales Development Representative): Qualificação
- **Closer**: Captação e fechamento

---

## 🎯 Contexto

Durante análise do código em 05/12/2025, identificamos que:

1. O `sdr-worker.ts` tinha identidade confusa
2. O prompt dizia "qualificador" mas tinha ferramentas de "closer"
3. Os templates (`templates-prospeccao.ts`) eram assertivos (V2 Closer)
4. O `CONTEXTO_PROSPECCAO_ATIVA` existia mas não estava conectado

**Pergunta central**: Devemos separar SDR e Closer em dois agentes?

---

## ⚖️ Análise do Guardião

### Filtro do Mandato Aplicado

```
❓ A: Gera receita ou validação em 30 dias?
   ✅ SIM - Modelo híbrido fecha mais leads (menos handoffs)

❓ B: Reduz trabalho operacional AGORA?
   ✅ SIM - 1 agente, menos complexidade, menos manutenção

A=SIM, B=SIM → ✅ PRIORIDADE MÁXIMA (fazer!)
```

### Argumentos a Favor do Híbrido

| Argumento | Impacto |
|-----------|---------|
| **Menos handoffs** | No WhatsApp, cada transferência perde ~40% dos leads |
| **Simplicidade** | 1 agente para manter vs 2 agentes |
| **MVP Focus** | 5 clientes não justificam arquitetura complexa |
| **Validação rápida** | Testar modelo antes de otimizar |

### Argumentos Contra (descartados para MVP)

| Argumento | Por que descartado |
|-----------|-------------------|
| Separação de concerns | Over-engineering para 5 clientes |
| Especialização | Pode otimizar depois com dados reais |
| Métricas separadas | Pode medir por etapas sem separar agentes |

---

## ✅ Decisão Final

### O que foi implementado:

1. **Renomeado** `SDRWorker` → `CaptadorWorker`
2. **Conectado** `CONTEXTO_PROSPECCAO_ATIVA` para modo prospecção
3. **Documentado** decisão no código-fonte
4. **Mantido alias** `sdrWorker` para compatibilidade

### Comportamento do CaptadorWorker:

```
MODO PROSPECÇÃO ATIVA (modoProspeccao = true):
├── Usa CONTEXTO_PROSPECCAO_ATIVA (técnicas de Closer)
├── Foco em fechamento assertivo
├── Ancoragem de valor, urgência, objeções
└── Ferramentas: converter_para_lead, agendar_avaliacao

MODO ATENDIMENTO PASSIVO (modoProspeccao = false):
├── Usa prompt SPIN Selling (qualificação)
├── Foco em descoberta de necessidades
├── Coleta: quartos, ocupação, motivação, timeline
└── Ferramentas: qualificar_lead, solicitar_humano
```

---

## 📊 Métricas de Sucesso

### KPIs para validar a decisão:

| Métrica | Meta | Como medir |
|---------|------|------------|
| Taxa de conversão prospecção | > 25% | Contatos → Leads |
| Taxa de opt-out | < 10% | Pedidos de parar |
| Tempo até fechamento | < 2 dias | Primeira msg → Lead |
| Satisfação corretor | > 8/10 | Feedback qualitativo |

### Critério de revisão:

- Se taxa de conversão < 15% → Revisar tom (mais/menos assertivo)
- Se opt-out > 15% → Suavizar abordagem
- Se corretores reclamarem "leads crus" → Considerar separação

---

## 🔄 Quando Revisitar

Esta decisão será reavaliada quando:

1. **Escala**: 50+ clientes ativos
2. **Feedback**: Corretores pedirem leads mais qualificados
3. **Métricas**: Taxa de conversão cair significativamente
4. **Complexidade**: Prompts ficarem grandes demais (>500 linhas)

---

## 📁 Arquivos Modificados

```
pacotes/backend/src/agentes/workers/sdr-worker.ts
├── Renomeado para CaptadorWorker
├── Adicionado import CONTEXTO_PROSPECCAO_ATIVA
├── Documentação da decisão no código
└── Alias sdrWorker mantido para compatibilidade
```

---

## 🎯 Próximos Passos

1. [ ] Testar com 5 clientes piloto (até 18/01/2026)
2. [ ] Coletar métricas de conversão
3. [ ] Ajustar tom baseado em feedback
4. [ ] Documentar aprendizados

---

## 📝 Assinaturas

**Guardião (Antigravity)**: ✅ Aprovado  
**Fundador**: ✅ Aprovado  

---

> _"Simplicidade é a sofisticação máxima."_ - Leonardo da Vinci
