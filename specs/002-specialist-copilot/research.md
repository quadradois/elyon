# Pesquisa e decisões — Copilot de Agenda do Especialista

## Roteamento do ator

**Decisão**: resolver especialista ativo no tenant antes do lead somente quando houver contexto operacional acionável ou comando inequívoco de agenda.

**Justificativa**: o webhook atual ignora quem não resolve como lead. A precedência condicionada permite inbound operacional sem reativar inbound comercial geral e evita tratar silenciosamente um telefone compartilhado no papel errado.

**Alternativas consideradas**: sempre priorizar usuário (risco de capturar conversa de lead); criar número exclusivo para especialistas (mais operação e não corresponde à experiência desejada).

## Interpretação de linguagem natural

**Decisão**: parser determinístico para confirmações/recusas simples, com interpretação estruturada para frases complexas; nenhum interpretador grava diretamente no banco.

**Justificativa**: respostas curtas precisam continuar funcionando mesmo sem IA. Para contraproposta e consulta, a camada de linguagem produz intenção e parâmetros, enquanto autorização, estado e efeito permanecem determinísticos.

**Alternativas consideradas**: LLM para todas as mensagens (mais latência e fragilidade); somente comandos rígidos (experiência robotizada).

## Persistência de convites

**Decisão**: modelar convites como tentativas versionadas, em vez de depender apenas dos campos únicos de `Atividade`.

**Justificativa**: principal, fallback, expiração, link antigo e respostas concorrentes exigem histórico e distinção de tentativa. Campos legados continuam espelhados durante o rollout.

**Alternativas consideradas**: adicionar mais campos à atividade (não representa histórico nem múltiplas tentativas); inferir pelo log (não é fonte transacional).

## Contraproposta

**Decisão**: persistir proposta pendente separada e manter o compromisso original até aceite do lead e revalidação do horário.

**Justificativa**: uma sugestão do especialista não é autorização do lead e não pode reservar definitivamente um horário ainda não aceito.

**Alternativas consideradas**: reagendar provisoriamente (gera confirmação incorreta e corrida); cancelar o original ao propor (aumenta risco de perda).

## Efeitos e lembretes

**Decisão**: reaproveitar o outbox de agenda com `destinatarioTipo=USUARIO` para especialistas e chave por atividade, versão, tipo e destinatário.

**Justificativa**: o outbox já possui retry, lease, fencing e idempotência. Uma nova fila duplicaria mecanismos críticos.

**Alternativas consideradas**: envio direto no webhook/job (pode confirmar estado sem entregar mensagem); fila separada (complexidade desnecessária).

## Disponibilidade e calendários

**Decisão**: usar as regras internas atuais como fonte de disponibilidade e manter calendários pessoais fora do escopo.

**Justificativa**: o ambiente atual utiliza conta central e a criação de evento já pode cair no fallback local. Condicionar o Copilot à agenda pessoal impediria a entrega.

## Privacidade do resumo

**Decisão**: reutilizar o resumo operacional já coletado, limitando tamanho e removendo CPF, tokens, documentos e outros dados desnecessários.

**Justificativa**: o especialista precisa de contexto comercial, não do dossiê completo do proprietário.
