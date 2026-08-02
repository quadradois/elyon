# Aprovação de Conteúdo — Templates Confirmação Corretor (v1)

Data: 2026-04-29
Escopo: convite imediato, SLA de 60 minutos, lembrete 15 minutos antes e remanejamento para fallback.

## Versão aprovada
- Versão: `v1`
- Status: `APROVADO PARA PRODUCAO`
- Referência técnica: `pacotes/backend/src/jobs/job-confirmacao-corretor.ts`

## Templates

### 1) Convite imediato
```
Elyon | Convite de confirmação
Lead: {leadNome}
Reunião: {dataHora}
Responda em até 60 minutos (prazo: {prazoConfirmacao}).
{linkConfirmacao}
```

### 2) Lembrete (15 minutos antes do prazo)
```
Elyon | Lembrete de confirmação
Lead: {leadNome}
Reunião: {dataHora}
Seu prazo termina às {prazoConfirmacao}. Sem resposta, o atendimento será oferecido ao especialista fallback.
{linkConfirmacao}
```

### 3) Remanejamento (lead)
```
Atualização: seu atendimento será conduzido por {especialistaNome} ({especialistaCargo}). Seguimos no horário combinado.
```

## Critérios aplicados
- Tom profissional e direto.
- Mensagens curtas para WhatsApp.
- Identificação explícita do contexto da reunião.
- Link sempre presente em convite e lembrete.
- Sem promessas fora do escopo operacional.

## Observações
- Alterações futuras devem incrementar versão (`v2`, `v3`, ...).
- Recomendado revalidar conteúdo com operação sempre que houver mudança de SLA.
