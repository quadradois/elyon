# Suite de QA de Regressão — Cenários Reais (P2)

## Objetivo
Validar comportamento operacional e conversacional do agente com base em cenários reais (Julia/Célio) e cenários sintéticos críticos.

## Meta de Sucesso
- Taxa mínima por cenário: `>= 85%`
- Taxa global da suíte: `>= 90%`

## Escala de Pontuação
- `1 ponto` por critério atendido
- `0 ponto` por critério não atendido
- Resultado do cenário = `pontos obtidos / total`

## Cenário 1 — Julia (mensagens sequenciais + mídia)
Contexto: cliente envia múltiplas mensagens em sequência e anexa mídia no meio do fluxo.

Critérios:
- [ ] Agente consolida bloco de mensagens sequenciais antes de responder
- [ ] Agente responde pergunta direta antes de voltar ao roteiro
- [ ] Agente não repete pergunta já respondida
- [ ] Agente reconhece mídia sem pergunta genérica inadequada
- [ ] Agente mantém continuidade da etapa comercial após mídia

Resultado:
- Pontos: `__/5`
- Taxa: `__%`
- Status: `APROVADO | REPROVADO`

## Cenário 2 — Célio (objeções contrato/exclusividade)
Contexto: cliente questiona contrato, exclusividade e formato de trabalho.

Critérios:
- [ ] Agente responde a pergunta direta no primeiro parágrafo
- [ ] Agente usa framing correto de autorização de venda
- [ ] Agente evita termos proibidos/fora de política do tenant
- [ ] Agente aplica argumentação de compromisso (dilema do carona) com linguagem humana
- [ ] Agente conduz para próximo passo (agendamento/passagem de bastão)

Resultado:
- Pontos: `__/5`
- Taxa: `__%`
- Status: `APROVADO | REPROVADO`

## Cenário 3 — Troca de valor pretendido (ex: 600k -> 800k)
Contexto: cliente informa um valor e depois corrige para outro.

Critérios:
- [ ] Agente detecta conflito de valor
- [ ] Agente pede confirmação objetiva do valor final
- [ ] Agente não repete pergunta de valor após confirmação
- [ ] Resumo final reflete valor atual consistente
- [ ] Histórico da alteração fica compreensível para o especialista

Resultado:
- Pontos: `__/5`
- Taxa: `__%`
- Status: `APROVADO | REPROVADO`

## Cenário 4 — Docs + áudio + imagem no mesmo lead
Contexto: cliente envia documento, áudio e imagem em sequência.

Critérios:
- [ ] UI classifica cada mídia no tipo correto
- [ ] Agente não trata áudio como documento genérico
- [ ] Download/visualização de anexos funciona para todos os tipos
- [ ] Conversa não trava após entrada de mídia
- [ ] Agente segue com pergunta contextual (não aleatória)

Resultado:
- Pontos: `__/5`
- Taxa: `__%`
- Status: `APROVADO | REPROVADO`

## Fechamento da Rodada
- Total de pontos: `__/20`
- Taxa global: `__%`
- Decisão: `LIBERAR | AJUSTAR E REVALIDAR`

## Evidências obrigatórias
- Link/screenshot do lead Julia
- Link/screenshot do lead Célio
- Registro de ações no painel (telemetria)
- Data da execução da rodada

---

## Rodada Interna Executada (26/04/2026)

Escopo desta rodada:
- Testes automatizados críticos do backend/agente
- Verificação de dados reais em banco para Julia/Célio
- Verificação de registros de mídia (áudio/documento)

### Execução técnica (automação)

Suites executadas e aprovadas:
- `skills-system.test.ts` + `classificador-objecao.test.ts` + `adversarial-scenarios.test.ts`
  - Resultado: `3/3 suites`, `92/92 testes`
- `conversation-cache.test.ts` + `conversation-state.test.ts` + `history-persistence.test.ts` + `orchestrator-integration.test.ts` + `gov-05-ivonet-regression.e2e.test.ts`
  - Resultado: `5/5 suites`, `124/124 testes`
- `client-response-sanitizer.test.ts` + `response-filters.test.ts` + `output-extraction.test.ts` + `input-builder.test.ts`
  - Resultado: `4/4 suites`, `39/39 testes`

Total automação rodada interna:
- `12/12 suites`
- `255/255 testes`
- Status: `APROVADO`

### Evidência de produção (Julia/Célio)

Fonte: consulta direta ao banco em 26/04/2026.

Resumo observado:
- Lead **Julia Matos**:
  - `blocosSequenciaisInbound`: `4`
  - `duplicidadeSaidaAte30s`: `0`
  - Registro de mídia: cliente com `tipo=audio`, porém conteúdo salvo como `[Mídia]`, seguido de resposta genérica.
- Lead **Célio Campos**:
  - `blocosSequenciaisInbound`: `1`
  - `duplicidadeSaidaAte30s`: `0`
  - Objeções de contrato/exclusividade respondidas, mas com linguagem antiga em histórico.

### Resultado por cenário (rodada interna)

## Cenário 1 — Julia (mensagens sequenciais + mídia)
- Pontos: `1/5`
- Taxa: `20%`
- Status: `REPROVADO`

Observações:
- Histórico real ainda mostra perda de contexto em mensagens sequenciais e tratativa genérica de mídia.

## Cenário 2 — Célio (objeções contrato/exclusividade)
- Pontos: `2/5`
- Taxa: `40%`
- Status: `REPROVADO`

Observações:
- Conversa histórica ainda contém framing antigo (`contrato simples/exclusivo`) e não evidencia plenamente a nova diretriz comercial.

## Cenário 3 — Troca de valor pretendido (ex: 600k -> 800k)
- Pontos: `3/5`
- Taxa: `60%`
- Status: `REPROVADO`

Observações:
- Valor final foi consolidado no lead, mas há repetição de pergunta no histórico da conversa real.

## Cenário 4 — Docs + áudio + imagem no mesmo lead
- Pontos: `2/5`
- Taxa: `40%`
- Status: `REPROVADO`

Observações:
- Banco mostra áudio sendo salvo em `mensagens.tipo=audio` (funcionando para alguns casos), mas há falhas de interpretação/contexto em exemplos reais.
- Em `documentos_lead`, quase não há mídia recente classificada para validação ponta a ponta do painel.

## Fechamento da rodada interna
- Total de pontos: `8/20`
- Taxa global: `40%`
- Decisão: `AJUSTAR E REVALIDAR`

### Conclusão prática para o teste com equipe (amanhã)
- Base técnica está estável (automação `255/255`).
- Conversas reais antigas ainda evidenciam gaps nos cenários críticos de negócio.
- Recomendação: executar validação guiada amanhã focando em:
  - sequenciais (2-3 mensagens do cliente em < 10s),
  - objeção “como conseguiu meu número?”,
  - objeção “é exclusivo?/tem contrato?”,
  - envio de áudio + imagem + documento no mesmo fluxo.
