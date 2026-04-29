# Aprovação de Conteúdo — Templates Confirmação Corretor (v1)

Data: 2026-04-29
Escopo: convites `T-120`, lembretes `T-90` e remanejamento ao lead.

## Versão aprovada
- Versão: `v1`
- Status: `APROVADO PARA PRODUCAO`
- Referência técnica: `pacotes/backend/src/jobs/job-confirmacao-corretor.ts`

## Templates

### 1) Convite (`T-120`)
```
Elyon | Convite de confirmação
Lead: {leadNome}
Reunião: {dataHora}
Confirme até 1h antes: {linkConfirmacao}
```

### 2) Lembrete (`T-90`)
```
Elyon | Lembrete de confirmação (T-90)
Lead: {leadNome}
Reunião: {dataHora}
Prazo de confirmação: até T-60
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
