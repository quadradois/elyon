# Plano de Execução Técnico — Coerência de Agentes SDR

Base: `docs/RAIO_X_COERENCIA_AGENTES.md`  
Objetivo: corrigir conflitos de instrução e reduzir regressão de comportamento no agente SDR.

## Estratégia de Entrega

1. Primeiro remover contradições que quebram confiança do lead (críticos).
2. Depois alinhar regras operacionais que afetam consistência de resposta (importantes).
3. Em seguida tratar nomenclatura/escopo para manutenção futura (atenção e melhorias).

## Gate de Decisão (Antes do PR 1)

1. Comissão deve ser definida por tenant no Perfil da Imobiliária (Configurações), sem fallback global numérico.
2. Se o tenant não configurar comissão, o agente deve usar texto neutro ("conforme política comercial da imobiliária"), sem inventar `%`.

Sem essa regra, o item `[C2]` não fecha com segurança em ambiente multi-tenant.

## Ordem de PRs

## PR 1 — Críticos (bloqueador de onboarding)

Status: CONCLUIDO

### Escopo

- `[C1]` Termo contratual unificado.
- `[C2]` Comissão padrão coerente entre código e skills.
- `[C3]` Remoção de fase legada (`FASE3`).

### Arquivos

- `pacotes/backend/src/agentes/commercial-policy.ts`
- `pacotes/backend/src/agentes/skills/presenter/tratativa-comissao.md`
- `pacotes/backend/src/agentes/skills/presenter/escalation-trigger-matrix.md`

### Checklist de alteração

- [x] Trocar `"Contrato de Consultoria"` por `"Autorização de Venda"` em `commercial-policy.ts`.
- [x] Remover fallback numérico global de comissão no backend.
- [x] Ajustar exemplos da `tratativa-comissao.md` para usar `[COMISSAO_DO_TENANT]` (sem valor hardcoded).
- [x] Substituir referência `mover_para_fase("FASE3")` por `mover_para_fase("AGENDAMENTO")`.

### Validação

- [x] `rg 'Contrato de Consultoria|FASE3' pacotes/backend/src/agentes` retorna vazio para contexto SDR.
- [x] Simulação de pitch + objeção de comissão usa valor do tenant quando configurado.
- [x] Sem comissão configurada, o prompt não contém percentual inventado.
- [x] Fluxo com aceite textual não tenta mover para fase inexistente.

### Commit sugerido

`fix(sdr): remove conflitos críticos de nomenclatura, comissão e fase de agendamento`

## PR 2 — Importantes (consistência operacional)

Status: CONCLUIDO

### Escopo

- `[I1]` Limite de linhas WhatsApp.
- `[I2]` IA detection centralizada no guardrail 9.
- `[I3]` Objeção “já tem imobiliária” em fluxo único.
- `[I4]` Guardrail 11 compatível com skill de cláusulas.

### Arquivos

- `pacotes/backend/src/agentes/sdr-agent.ts`
- `pacotes/backend/src/agentes/skills/compartilhados/regras-whatsapp.md`
- `pacotes/backend/src/agentes/skills/presenter/escalation-trigger-matrix.md`
- `pacotes/backend/src/agentes/catalogo-objecoes.ts`
- `pacotes/backend/src/agentes/skills/opener/protocolo-ja-tem-contrato.md`
- `pacotes/backend/src/agentes/shared-behavioral-guardrails.ts`

### Checklist de alteração

- [x] Padronizar regra de tamanho de resposta (3 linhas; exceção até 5 para objeção complexa).
- [x] Remover item “Você é uma IA?” da `escalation-trigger-matrix.md`.
- [x] Alinhar resposta da objeção “já tem imobiliária” em `catalogo-objecoes.ts` com o playbook de `protocolo-ja-tem-contrato.md`.
- [x] Atualizar guardrail 11 item 5 para usar skill contratual em dúvidas de cláusulas.
- [x] Manter encaminhamento ao especialista apenas para multa, condições especiais e negociação fora do padrão.

### Validação

- [x] Simulação com pergunta “você é IA?” centralizada no fluxo de `compartilhados/anti-injection` (matrix de escalation sem regra duplicada).
- [x] Objeção “já tenho imobiliária” alinhada ao mesmo fluxo-base do protocolo de contrato ativo.
- [x] Respostas de WhatsApp padronizadas em 3 linhas, com exceção explícita até 5 para objeções complexas.

### Commit sugerido

`fix(sdr): padroniza guardrails de whatsapp, identidade IA e tratativas de contrato`

## PR 3 — Atenção + Melhorias (estrutura e manutenção)

Status: CONCLUIDO

### Escopo

- `[A1]` Separar claramente skill que responde vs skill que encaminha.
- `[A3]` Trigger correto da escalation matrix na tabela do `sdr-agent.ts`.
- `[A4]` Renomear skill com nome enganoso.
- `[M1]` Definir integração do `catalogo-objecoes.ts`.
- `[M2]` Remover “Avaliação com IA” de política comercial.
- `[M3]` Remover conteúdo interno de dev do prompt de skill.

### Arquivos

- `pacotes/backend/src/agentes/skills/presenter/tratativa-contrato-condicoes.md`
- `pacotes/backend/src/agentes/skills/presenter/tratativa-clausulas-contrato.md`
- `pacotes/backend/src/agentes/sdr-agent.ts`
- `pacotes/backend/src/agentes/skills/opener/protocolo-autorizacao-venda.md`
- `pacotes/backend/src/agentes/skills/SKILLS_REGISTRY.ts`
- `pacotes/backend/src/agentes/commercial-policy.ts`
- `pacotes/backend/src/agentes/catalogo-objecoes.ts` e classificadores relacionados

### Checklist de alteração

- [x] Delimitar escopo:
- `tratativa-clausulas-contrato` = skill padrão para explicar cláusulas.
- `tratativa-contrato-condicoes` = somente encaminhamento para casos fora do padrão.
- [x] Corrigir descrição de trigger da `escalation-trigger-matrix` na Camada 5 do `sdr-agent.ts`.
- [x] Renomear arquivo `opener/tratativa-exclusividade.md` para `opener/protocolo-autorizacao-venda.md`.
- [x] Atualizar registry/imports/referências após rename.
- [x] Trocar “Avaliação com IA” por “avaliação com dados de mercado” em `commercial-policy.ts`.
- [x] Criar/ajustar `tratativa-clausulas-contrato.md` sem conteúdo interno/meta-raciocínio.
- [x] Documentar integração `catalogo-objecoes.ts` + `classificador-objecao.ts` no ecossistema.

### Validação

- [x] `rg 'Avaliação com IA' pacotes/backend/src/agentes` não retorna prompt ativo do SDR.
- [x] `rg 'tratativa-exclusividade.md' pacotes/backend/src/agentes` só encontra skill de exclusividade real.
- [x] Classificação de objeções aponta para caminho documentado e consistente (`catalogo-objecoes.ts` + `classificador-objecao.ts` + skills).

### Commit sugerido

`refactor(sdr): organiza escopo de skills contratuais e nomenclatura de opener`

## QA de Regressão (mínimo)

Executar cenários de conversa ponta a ponta:

1. Comissão + aceite de pitch + pedido de agenda.
2. Pergunta sobre exclusividade e autorização.
3. Pergunta “você é IA?” no meio da conversa.
4. Objeção “já tenho imobiliária”.
5. Dúvida de cláusula comum vs cláusula especial com multa.

Critério de aceite:

- Não há contradição terminológica no mesmo fluxo.
- Não há chamada de fase/tool inválida.
- O agente mantém coerência entre guardrail, skill e política comercial.

## Sequência de Commit (sugestão fina)

1. `fix(sdr): unifica autorização de venda e remove fase legada FASE3`
2. `fix(sdr): alinha comissão padrão com playbooks comerciais`
3. `fix(sdr): centraliza anti-injection e padroniza limite whatsapp`
4. `fix(sdr): harmoniza tratativa de contrato e cláusulas`
5. `refactor(sdr): renomeia skill opener para protocolo-autorizacao-venda`
6. `chore(sdr): documenta fonte única de objeções e carregamento`

## Risco e Mitigação

- Risco: mudanças de texto em prompt alterarem taxa de conversão.
- Mitigação: deploy gradual + monitorar taxa de resposta positiva e avanço para agendamento por 7 dias.

- Risco: rename de skill quebrar referências em registry/classificador.
- Mitigação: validação por `rg` + teste de carregamento de skill por id.

## Dono sugerido por trilha

1. Produto/Comercial: manter regra de comissão por tenant no perfil da imobiliária.
2. Backend Agentes: PR 1 e PR 2.
3. Arquitetura de Skills: PR 3 e documentação de fonte de verdade.
