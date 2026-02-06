# PLAN: Conclusão Elyon 2.0 - BYOK & Agents

> **Objetivo**: Finalizar integração LiteLLM e limpeza de código legado
> **Data**: 2026-02-06

---

## 📊 Status Verificado

| Fase | Descrição | Status |
|------|-----------|--------|
| **1** | Setup LiteLLM + Prisma Migration | ✅ **FEITO** |
| **2** | LLM Provider Factory | ✅ **FEITO** |
| **3** | Adaptar Agentes para BYOK | ✅ **FEITO** |
| **4** | Unificar Entry Points | ✅ **FEITO** |
| **5** | Limpeza de Código Legado | ⬜ **PENDENTE** |
| **6** | Testes e Validação | ⬜ **PENDENTE** |

---

## ✅ Evidências de Conclusão (Fases 1-4)

### Fase 1: Setup
- `litellm: ^0.12.0` instalado em `package.json`
- `ConfiguracaoLLM` model existe no Prisma

### Fase 2: Provider Factory
- `llm-provider-factory.ts` (288 linhas) ✅
- Suporta 8 providers: OpenAI, Anthropic, Groq, Mistral, Azure, Vertex, Together, DeepSeek
- Criptografia AES-256 para API keys
- Fallback automático para chave do sistema

### Fase 3: Agentes
- 7 agentes implementados com @openai/agents
- `criarSdrAgent()` aceita modelo dinâmico

### Fase 4: Entry Points
- `lead-inbound-handler.ts` usa `orquestradorService` ✅
- Comentário "Removida dependência do ElyonCore" confirma migração

---

## 📋 Tarefas Pendentes

### Fase 5: Limpeza (Prioridade Alta)
- [ ] **5.1** Verificar e limpar `_deprecated/`
- [ ] **5.2** Remover arquivos `.bak` restantes
- [ ] **5.3** Atualizar `task.md` com status final

### Fase 6: Testes (Prioridade Média)
- [ ] **6.1** Testar fluxo completo de mensagem (WhatsApp → Agent → Resposta)
- [ ] **6.2** Testar BYOK (criar config, salvar, usar)
- [ ] **6.3** Executar lint e type-check

---

## 👥 Agent Allocation

| Fase | Agent | Ação |
|------|-------|------|
| 5 | `backend-specialist` | Limpar código deprecated |
| 6 | `test-engineer` | Executar testes de integração |
| 6 | `devops-engineer` | Verificar build e deploy |

---

## 🎯 Critérios de Aceite

1. ✅ Nenhum arquivo `.bak` no repositório
2. ✅ Pasta `_deprecated/` limpa ou removida
3. ✅ Build passa sem erros
4. ✅ Teste de fluxo WhatsApp funcional
