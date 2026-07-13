# Constituicao de Engenharia do ELYON

Versao: 1.0.0  
Ratificada em: 2026-07-13  
Ultima alteracao: 2026-07-13

## 1. Seguranca e isolamento por tenant

Toda entrada externa e toda operacao sobre dados deve autenticar o chamador,
resolver o tenant no servidor e aplicar o tenant na consulta. IDs recebidos do
cliente nunca constituem autorizacao. Mudancas em autenticacao, webhooks, PII,
segredos ou fronteiras de tenant exigem testes negativos e plano de rollback.

## 2. Mudancas pequenas e contratos preservados

Alteracoes devem ser incrementais, revisaveis e ligadas a uma issue. Contratos
REST, WebSocket, eventos e banco permanecem retrocompativeis durante rollout.
Quebras deliberadas exigem ADR, migracao de consumidores e janela aprovada.

## 3. Evidencia antes do merge

O nivel de teste acompanha o risco. Unitarios cobrem regras; integracao cobre
banco, Redis e fronteiras; smoke cobre o release. Um teste nao pode depender de
dados compartilhados ou de producao. Excecoes devem estar justificadas no PR.

## 4. Main e producao sao estados auditaveis

Todo codigo chega a `main` por branch e PR ligado com `Closes #N`. O SHA de
producao deve existir em `main`, passar pelo CI e ser implantado pelo workflow
versionado. Edicao direta na VPS e alteracao manual de historico Git sao vedadas.

## 5. Migracoes e operacao segura

Migracoes devem ser reproduziveis em banco vazio e retrocompativeis com a versao
anterior da aplicacao. Deploy exige backup pre-release, timeout, owner, smoke e
rollback documentado. Rollback de aplicacao nao implica rollback automatico de
schema. Volumes, backups e secrets nunca sao removidos por rotinas de limpeza.

## 6. Observabilidade e privacidade

Fluxos criticos expoem health, metricas e logs correlacionaveis sem tokens, PII
ou payloads sensiveis. Novos jobs e integracoes definem owner, limites, retries,
dead-letter ou estado terminal e sinais operacionais acionaveis.

## 7. Governanca

Esta constituicao prevalece sobre conveniencias locais. Mudancas exigem PR,
justificativa, impacto nos templates e aprovacao dos code owners. Versao major
remove ou redefine principio; minor adiciona principio; patch esclarece texto.

## Definition of Done

- Issue vinculada, contexto e criterios de aceite atualizados.
- Testes e checks proporcionais ao risco aprovados.
- Seguranca, tenant, migracao, observabilidade e compatibilidade avaliados.
- Rollout, rollback e validacao pos-deploy documentados quando aplicaveis.
- Documentacao e ADR atualizados quando o comportamento ou a arquitetura muda.
- PR integrado, deploy concluido quando necessario e issue encerrada por merge.
