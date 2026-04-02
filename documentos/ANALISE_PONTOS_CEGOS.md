# 🔍 ANÁLISE DE PONTOS CEGOS - Sistema de Prospecção Ativa

**Data**: 02/12/2025
**Analisado por**: Copilot (Agente de Sistema)

---

## ⚠️ PONTOS CEGOS CRÍTICOS IDENTIFICADOS

### 1. 🔴 CRÍTICO: Busca de Contatos Incompleta

**Localização**: `webhook.ts` → `buscarContatoProspeccao()`

**Problema**: A busca só captura contatos com status `CONTATANDO` e `RESPONDEU`:

```typescript
statusProspeccao: {
  in: ['CONTATANDO', 'RESPONDEU'] // ❌ INCOMPLETO!
}
```

**Impacto**:
- Se o contato virou **LEAD** e continua conversando → **MENSAGENS PERDIDAS**
- Se o contato ficou **INTERESSADO** (avaliação agendada) e manda mensagem → **NÃO CAPTURADO**
- Se o contato é **MORNO_FUTURO** e volta a falar → **NÃO CAPTURADO**

**Correção Necessária**:
```typescript
statusProspeccao: {
  in: ['CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO']
}
```

---

### 2. 🔴 CRÍTICO: Áudio Não Transcrito em Prospecção

**Localização**: `webhook.ts` → fluxo de prospecção ativa

**Problema**: O fluxo de leads inbound tem transcrição de áudio (via OpenAI Whisper), mas o de prospecção ativa **não tem**. Quando o proprietário envia áudio, o SDR recebe apenas `[Mídia recebida]`.

**Impacto**:
- SDR não entende o que o proprietário disse no áudio
- Respostas genéricas e descontextualizadas
- Proprietário pode achar que está sendo ignorado

**Correção Necessária**: Adicionar transcrição de áudio no fluxo de prospecção, similar ao que existe para leads inbound.

---

### 3. 🟠 ALTO: Sem Cron para Recontato Automático

**Localização**: Não existe

**Problema**: Contatos marcados como `MORNO_FUTURO` têm `dataRecontato` salva, mas **não existe job/cron** que processe isso automaticamente.

**Impacto**:
- Recontatos nunca são feitos automaticamente
- Campo `dataRecontato` é salvo mas nunca usado
- Oportunidades perdidas com proprietários que teriam interesse futuro

**Correção Necessária**: Criar job agendado que:
1. Busca contatos com `dataRecontato <= hoje` e `statusProspeccao = 'MORNO_FUTURO'`
2. Muda status para `AGUARDANDO`
3. Dispara nova mensagem de recontato

---

### 4. 🟠 ALTO: Histórico de Mensagens Não Inclui Primeira Mensagem da Campanha

**Localização**: `disparo-campanha.ts` (parcialmente corrigido)

**Problema**: Embora tenhamos adicionado o salvamento da primeira mensagem no disparo, **não há garantia** de que a mensagem inicial está sendo incluída no contexto do SDR.

**Verificação**: A função `carregarHistoricoMensagens()` busca por `contatoId`, e a primeira mensagem é salva com o `contatoId` correto. ✅ OK

---

### 5. 🟡 MÉDIO: Sem Fallback para Campanha Sem Tenant

**Localização**: `sdr-tools.ts` → `agendarAvaliacaoTool`

**Problema**: Se por algum motivo `contato.campanha?.tenantId` for null/undefined, a criação do Lead falha:

```typescript
tenantId: contato.campanha?.tenantId || '',  // String vazia causa erro!
```

**Impacto**: Erro silencioso ao criar lead se tenant não existir

**Correção Necessária**: Validar existência do tenantId antes de criar Lead.

---

### 6. 🟡 MÉDIO: Sem Tratamento de Duplicidade de Mensagens

**Localização**: `webhook.ts` → `salvarMensagemProspeccao()`

**Problema**: O WhatsApp/Evolution pode enviar a mesma mensagem mais de uma vez (retry). Não há verificação de `messageId` duplicado.

**Impacto**:
- Histórico de mensagens pode ter duplicatas
- SDR pode receber contexto duplicado

**Correção Necessária**: Verificar se `messageId` já existe antes de salvar.

---

### 7. 🟢 BAIXO: Log Excessivo no Webhook

**Localização**: `webhook.ts`

**Problema**: `console.log('Body:', JSON.stringify(req.body, null, 2))` loga todo o body de CADA mensagem. Em produção, isso pode gerar muito ruído.

**Recomendação**: Reduzir verbosidade em produção.

---

## ✅ PONTOS QUE ESTÃO OK

1. ✅ **RAG do perfil** sendo passado para o SDR
2. ✅ **Histórico de 20 mensagens** carregado corretamente
3. ✅ **Conversão Contato → Lead** funcionando
4. ✅ **Ferramentas de agendamento** criadas
5. ✅ **SPIN Selling** no prompt do SDR
6. ✅ **Opt-out** sendo registrado
7. ✅ **Blacklist** verificada antes do disparo
8. ✅ **Janela de horário** respeitada
9. ✅ **Taxa de disparo** controlada

---

## 📋 PRIORIDADE DE CORREÇÃO

| # | Prioridade | Item | Esforço |
|---|------------|------|---------|
| 1 | 🔴 CRÍTICA | Busca de contatos incompleta | 5 min |
| 2 | 🔴 CRÍTICA | Áudio não transcrito | 15 min |
| 3 | 🟠 ALTA | Cron de recontato | 30 min |
| 4 | 🟡 MÉDIA | Fallback tenant | 5 min |
| 5 | 🟡 MÉDIA | Duplicidade mensagens | 10 min |
| 6 | 🟢 BAIXA | Log excessivo | 5 min |

---

## 🚀 PRÓXIMAS AÇÕES RECOMENDADAS

1. **Corrigir busca de contatos** (5 min) - URGENTE
2. **Adicionar transcrição de áudio** (15 min) - URGENTE
3. **Criar job de recontato** (30 min) - ALTA
4. **Melhorias menores** (20 min) - MÉDIA

**Tempo total estimado**: ~1h10min
