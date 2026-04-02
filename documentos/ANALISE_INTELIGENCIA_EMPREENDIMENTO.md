# 🔍 ANÁLISE - Inteligência do Empreendimento

**Data:** 02 de Dezembro de 2025  
**Status:** ⚠️ PESQUISA POR IA DESATIVADA - MODO 100% MANUAL

---

## 🎯 DECISÃO ATUAL

### Pesquisa com IA → DESATIVADA (Feature Futura)

A pesquisa automática por IA foi **temporariamente removida** para:

| ✅ Benefício | Descrição |
|-------------|-----------|
| **Simplicidade** | Menos dependências externas (Groq, Serper) |
| **Custo Zero** | Sem gastos com APIs de IA |
| **Controle Total** | Usuário preenche exatamente o que precisa |
| **Confiabilidade** | Não depende de APIs externas |
| **Velocidade** | Criação de campanha instantânea |

### Fluxo Atual (Manual)

```
┌──────────────────────────────────────────────────────────────┐
│  1. CRIAR CAMPANHA                                           │
│     → Nome, Empreendimento, Endereço, Tipo                   │
├──────────────────────────────────────────────────────────────┤
│  2. PREENCHER BRIEFING (EditorBriefing.tsx)                  │
│     → Preços, Características, Diferenciais, Resumo SDR      │
├──────────────────────────────────────────────────────────────┤
│  3. IMPORTAR CONTATOS                                        │
│     → De lista existente ou CSV                              │
└──────────────────────────────────────────────────────────────┘
```

### Arquivos Desativados

Os seguintes arquivos foram renomeados e mantidos para reativação futura:

```
pacotes/backend/src/servicos/
├── _pesquisador-empreendimento.DESATIVADO.ts   # Serviço principal
├── _groq.DESATIVADO.ts                          # Cliente Groq (LLM gratuito)
└── (gemini.ts mantido para agentes)
```

---

## 📋 HISTÓRICO - Análise Original

> ⚠️ **Nota:** A seção abaixo documenta a análise feita ANTES da desativação.
> Será útil quando a feature for reativada.

**Data Original:** 01 de Dezembro de 2025  
**Objetivo:** Melhorar a qualidade do contexto para o Agente SDR

---

## 📋 RESUMO EXECUTIVO (Histórico)

### Problema Identificado
O sistema de "Inteligência do Empreendimento" está gerando briefings **fora do contexto do imóvel**, com informações imprecisas sobre:
- ❌ **Preços** - valores genéricos ou muito discrepantes
- ❌ **Tamanho** - metragem sem distinção privativa/total
- ❌ **Distâncias** - pontos de interesse não validados geograficamente
- ❌ **Características** - dados inconsistentes entre fontes

### Impacto
O Agente SDR recebe um contexto pobre/incorreto, prejudicando:
1. Credibilidade nas conversas com leads
2. Capacidade de responder perguntas específicas
3. Conversão de leads qualificados

---

## 🔬 DIAGNÓSTICO TÉCNICO

### 1. Fluxo Atual

```
[Wizard Campanha] → [Pesquisador Empreendimento] → [Serper API (Google)] → [GPT-4o-mini] → [RAG/Briefing]
                                                                                               ↓
[Agente SDR] ← [System Prompt + Contexto RAG] ← [ELYON Core] ← [Campanha + EmpreendimentoConhecimento]
```

### 2. Pontos de Falha Identificados

#### A. Query de Busca Muito Genérica
**Arquivo:** `pesquisador-empreendimento.ts` (linha ~87)

```typescript
const query = `${dados.nome} ${localizacaoCompleta} ${dados.tipo || 'apartamento'} venda preço características`;
```

**Problema:** A query é ampla demais e retorna resultados misturados (outros empreendimentos, imóveis usados, etc.)

**Exemplo:**
- Input: "Reserva Buriti, Vila Rosa, Goiânia"
- Query: "Reserva Buriti Vila Rosa Goiânia apartamento venda preço características"
- Resultado: Pode trazer dados de OUTROS empreendimentos com nome similar, imóveis usados no bairro, etc.

#### B. Serper API Retorna Poucos Dados Estruturados
Os snippets do Google são fragmentos de texto sem estrutura:
- "Apartamento 2 quartos a partir de R$ 330 mil..."
- "Lançamento na Vila Rosa com área de lazer..."

O GPT tenta inferir dados, mas frequentemente **alucina** informações.

#### C. Consolidação com GPT Tem Alta Taxa de Alucinação
**Problema:** O GPT-4o-mini recebe snippets fragmentados e tenta:
1. Inferir faixa de preços (pode misturar valores de imóveis diferentes)
2. Deduzir características (pode copiar de empreendimentos similares)
3. Inventar distâncias (não tem acesso a dados geográficos reais)

#### D. Validação Insuficiente
O sistema avisa sobre baixa confiabilidade, mas **não bloqueia** dados ruins.

---

## 💡 PROPOSTAS DE MELHORIA

### NÍVEL 1: Quick Wins (Implementar Agora)

#### 1.1 Melhorar Query de Busca
```typescript
// ANTES
const query = `${dados.nome} ${localizacaoCompleta} ${dados.tipo} venda preço características`;

// DEPOIS - Queries especializadas
const queries = [
  `"${dados.nome}" ${localizacaoCompleta} preço m2 área`,        // Preço e área
  `"${dados.nome}" ${localizacaoCompleta} planta quartos vagas`, // Características
  `"${dados.nome}" incorporadora construtora lançamento`,        // Info oficial
];
```

#### 1.2 Filtrar Resultados por Domínio
Priorizar fontes confiáveis:
- ✅ Sites de incorporadoras (próprios do empreendimento)
- ✅ Portais especializados (imovelweb, vivareal, zapimoveis)
- ⚠️ Blogs e artigos (com cautela)
- ❌ Fóruns e redes sociais (evitar)

#### 1.3 Prompt Mais Restritivo para GPT
```typescript
// Adicionar instruções críticas:
`⚠️ REGRAS CRÍTICAS:
1. Se não encontrar um dado EXPLICITAMENTE nas fontes, escreva "Não informado"
2. NUNCA invente valores de preço ou metragem
3. Para distâncias, só inclua se houver fonte ou use "verificar no mapa"
4. Se houver conflito entre fontes, indique a discrepância`
```

#### 1.4 Campo "Dados Verificados" vs "Dados Inferidos"
Separar no briefing:
```json
{
  "dados_verificados": {
    "nome": "Reserva Buriti",
    "endereco": "Vila Rosa, Goiânia"
  },
  "dados_inferidos": {
    "faixa_preco": { "min": 330000, "max": 380000, "confianca": 0.6 },
    "area": { "valor": "54m²", "tipo": "verificar se privativa ou total" }
  }
}
```

### NÍVEL 2: Melhorias Estruturais (Próxima Sprint)

#### 2.1 Integrar APIs de Dados Imobiliários
- **CRECI/COFECI**: Base de imóveis registrados
- **APIs de Incorporadoras**: Dados oficiais de lançamentos
- **Google Places API**: Distâncias reais para pontos de interesse

#### 2.2 Validação Manual Obrigatória para Dados Críticos
```
[Briefing Gerado] → [Review Humano] → [Briefing Validado] → [Agente SDR]
```

Campos que DEVEM ser validados:
- Faixa de preço
- Metragem
- Número de quartos/vagas

#### 2.3 Feedback Loop do Corretor
Quando o corretor corrigir um dado em conversa, atualizar o briefing:
```typescript
// Corretor: "Na verdade são 3 quartos, não 2"
await ragEmpreendimentos.atualizar(id, {
  briefingEstruturado: { ...atual, caracteristicas: ["3 quartos", ...] },
  validado: true,
  validadoPor: "corretor_xyz"
});
```

### NÍVEL 3: Evolução do Produto (Roadmap)

#### 3.1 Scraping Direto de Portais
Buscar dados diretamente em:
- 62imoveis.com.br
- imovelweb.com.br
- vivareal.com.br
- zapimoveis.com.br

#### 3.2 Base de Conhecimento de Incorporadoras
Cadastro manual de dados oficiais de lançamentos.

#### 3.3 Fine-tuning de Modelo
Treinar modelo específico para extração de dados imobiliários.

---

## 🛠️ IMPLEMENTAÇÃO RECOMENDADA

### Fase 1: Correções Imediatas (Esta Sessão)

1. **Refatorar `pesquisador-empreendimento.ts`**
   - Múltiplas queries especializadas
   - Filtro de domínios confiáveis
   - Prompt mais restritivo

2. **Melhorar estrutura do briefing**
   - Separar dados verificados vs inferidos
   - Adicionar campo "fonte" para cada dado

3. **Atualizar prompt do SDR Worker**
   - Instruir a não afirmar dados com baixa confiança
   - Orientar a perguntar para o corretor quando não souber

### Fase 2: Próxima Sprint

4. **Interface de validação de briefing**
   - Antes de ativar campanha, revisar dados críticos

5. **Integração Google Places API**
   - Distâncias reais para pontos de interesse

---

## 📊 MÉTRICAS DE SUCESSO

| Métrica | Atual | Meta |
|---------|-------|------|
| Confiabilidade média do briefing | ~0.5 | ≥ 0.8 |
| Briefings validados manualmente | 0% | 100% |
| Correções por corretores | N/A | < 2 por briefing |
| Dados com fonte explícita | ~30% | ≥ 80% |

---

## ✅ IMPLEMENTADO - Editor de Briefing Completo

**Data:** 01/12/2025

### Solução Adotada

Implementamos **edição 100% manual** de todos os campos do briefing, pois os dados de anúncios de terceiros não são confiáveis o suficiente para uso direto pelo agente de IA.

### Componentes Criados

1. **EditorBriefing.tsx** - Interface de edição com 4 abas:
   - Geral: Resumo, nome, tipo, localização, características, diferenciais
   - Preços: Faixa de preços e metragens disponíveis
   - Localização: Bairro, região, vias de acesso, pontos de referência
   - Condomínio: Valor, lazer, segurança, torres, garagem

2. **Integração na página CampanhaDetalhes.tsx**
   - Aba "Empreendimento" agora usa o EditorBriefing
   - Salvamento automático no banco e RAG

3. **Endpoint atualizado PUT /campanhas/:id/briefing**
   - Aceita briefingCompleto + briefingEstruturado
   - Atualiza confiabilidade para 100% quando editado manualmente

### Fluxo de Trabalho Recomendado

```
1. Criar campanha → Pesquisa automática executa
2. Revisar aba "Empreendimento" → Dados pré-preenchidos
3. Corrigir/completar todos os campos → Edição livre
4. Salvar → Confiabilidade vai para 100%
5. Agente SDR usa dados corretos nas conversas
```

---

## 🚀 PRÓXIMOS PASSOS

1. [x] ~~Aprovar análise com stakeholders~~
2. [x] ~~Implementar Fase 1 (quick wins)~~
3. [ ] Testar com 3 campanhas reais
4. [ ] Ajustar baseado em feedback
5. [ ] Planejar Fase 2 (integração com construtoras)

---

*Documento atualizado em 01/12/2025 - Elyon AI Agent*
