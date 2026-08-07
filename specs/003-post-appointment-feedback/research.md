# Pesquisa e decisões — Feedback Pós-Atendimento

## Momento do contato

**Decisão**: ligação em T+20 do início; reunião/visita em término previsto +15 minutos.

**Rationale**: ligações normalmente terminam dentro da janela; visitas e reuniões não devem ser interrompidas. A duração existente é a referência e o padrão atual cobre ausência de duração.

**Alternatives considered**: T+20 universal (interrompe visitas); somente no fim do dia (feedback perde contexto).

## Fonte da verdade

**Decisão**: o especialista declara o desfecho; a Agenda continua sendo alterada somente pelo comando canônico e o milestone é a evidência auditável.

**Rationale**: WhatsApp e calendário não provam a realização. A declaração explícita identifica autor, instante e origem sem inferência silenciosa.

**Alternatives considered**: inferir por horário passado ou por ausência de mensagem (inseguro); confiar em texto solto sem comando (não transacional).

## Estado durável

**Decisão**: criar entidade própria de solicitação, em vez de reaproveitar convite de confirmação.

**Rationale**: convite decide atribuição antes do atendimento; feedback decide desfecho depois. Prazos, estados e concorrência são diferentes e misturá-los criaria dependência semântica indevida.

**Alternatives considered**: novos status no convite (confunde ciclos); apenas interação WhatsApp (não representa prazos e pendências).

## Timeline do lead

**Decisão**: criar uma atividade NOTA append-only com descrição sanitizada e marcador estruturado de origem.

**Rationale**: a ficha já consome atividades e preserva autoria/tempo. Evita nova superfície de leitura e mantém compatibilidade.

**Alternatives considered**: sobrescrever `Atividade.resultado` (perde histórico); criar JSON no lead (acoplamento e baixa auditabilidade).

## Linguagem natural

**Decisão**: parser determinístico para as cinco intenções do feedback e resumo como texto remanescente sanitizado. Ambiguidade pede esclarecimento.

**Rationale**: o efeito crítico não depende de modelo externo. A primeira versão cobre frases naturais frequentes com comportamento previsível.

**Alternatives considered**: LLM em todas as respostas (latência e risco); somente números (experiência robotizada).

## Silêncio e no-show

**Decisão**: um lembrete em duas horas e pendência em vinte e quatro; gate de feedback desabilita a baixa automática por no-show no mesmo escopo.

**Rationale**: silêncio não identifica a parte ausente. A operação precisa de uma fila, não de um fato inventado.

**Alternatives considered**: manter worker de no-show concorrente (fonte de verdade conflitante); lembretes ilimitados (desgaste).
