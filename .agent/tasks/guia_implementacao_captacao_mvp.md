---
description: Guia Técnico para Implementação dos Ajustes Finais do Funil de Captação MVP
---

# 🛠️ Guia de Implementação: Refinamento do Funil de Captação (MVP)

Este guia detalha as alterações técnicas necessárias para finalizar o módulo de Captação de Imóveis, focando na resolução de conflitos entre IA e Humano e na melhoria da usabilidade do corretor.

**Objetivo:** Alinhar o sistema ao Playbook de Captação de 4 Fases.

---

## 1. Backend & IA: Resolução de Conflitos (`templates-agentes.ts`)

**Contexto:** O Agente `SDR_CAPTACAO` atual é muito "ansioso". Ele tenta pedir documentos e agendar visitas logo no início, o que gera duplicidade quando o corretor também tenta fazer isso na Fase 2 ou 3.

**O Que Fazer:**
Localizar o arquivo `pacotes/backend/src/agentes/templates-agentes.ts`, especificamente na constante `TEMPLATE_SDR_CAPTACAO`.

### 1.1. Ajustar Instruções do Sistema
Alterar o bloco `instrucoesSistema` para delimitar o escopo da IA apenas à "Fase 1: Interesse e Qualificação".

```typescript
// ANTES (Conflitante):
// 3. Agendar avaliação presencial...
// 4. Coletar documentos...

// DEPOIS (Correto):
instrucoesSistema: `
// ... (manter identidade)

# OBJETIVOS PRINCIPAIS (ESCOPO LIMITADO)
1. Confirmar se é proprietário e se quer vender/alugar
2. Coletar dados preliminares do imóvel (quarto, vaga, bairro)
3. Identificar urgência/motivação
4. AVISAR O HUMANO assim que o lead demonstrar interesse real (Lead Quente)

# LIMITES RÍGIDOS
- NÃO solicite envio de documentos (RG, Matrícula) nesta fase inicial.
- NÃO agende horários de visita fixos sem consultar o corretor.
- Se o cliente perguntar de documentos/visita, diga: "Vou pedir para nosso especialista te ligar para alinhar os detalhes."
// ...
`
```

### 1.2. Remover Proatividade de Documentos
No mesmo arquivo, **remover** ou **comentar** a lista `documentosNecessarios` do template `SDR_CAPTACAO`. Deixe essa lista apenas para o agente especialista `DOCUMENTOS` ou para o Humano na Fase 3.

---

## 2. Frontend: Refinamento do Kanban (`KanbanLeads.tsx`)

**Contexto:** Precisamos alinhar os nomes das colunas com o vocabulário do time comercial e adicionar senso de urgência (SLA).

**O Que Fazer:**
Editar `pacotes/frontend/src/componentes/KanbanLeads.tsx`.

### 2.1. Renomear Colunas
Atualizar a constante `KANBAN_COLUMNS` para refletir os termos aprovados:

```typescript
const KANBAN_COLUMNS = [
    { 
        id: "INTERESSE", // Mapeia para status 'NOVO'
        label: "1. Interesse Confirmado", 
        // ...
    },
    { 
        id: "ALINHAMENTO", // Mapeia para 'TENTATIVA_AGENDAMENTO'
        label: "2. Alinhamento & Visita", // NOME NOVO
        // ...
    },
    { 
        id: "VALIDACAO", // Mapeia para 'DOCUMENTACAO'
        label: "3. Validação do Imóvel", // NOME NOVO (Era "Documentação")
        // ...
    },
    { 
        id: "CAPTADO", 
        label: "4. Captado (Ativo)", 
        // ...
    },
];
```

### 2.2. Implementar SLA Visual (Timer)
Adicionar um indicador visual no Card do Kanban para mostrar há quanto tempo o lead está naquela fase.

**Lógica (Exemplo):**
```tsx
// Dentro do map de renderização do Card
const horasCriacao = Math.floor((new Date().getTime() - new Date(lead.dataCriacao).getTime()) / (1000 * 60 * 60));
const isAtrasado = horasCriacao > 24 && lead.status === 'NOVO';

// Renderizar Badge
{isAtrasado && (
    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200 animate-pulse">
        <Clock className="w-3 h-3" />
        {horasCriacao}h (Atrasado)
    </div>
)}
```

---

## 3. Frontend: Checklist de Execução (`LeadDetalhes`)

**Contexto:** O corretor precisa saber exatamente *o que fazer* em cada fase, não apenas ver os dados.

**O Que Fazer:**
Criar um novo componente `FaseChecklist.tsx` em `pacotes/frontend/src/paginas/LeadDetalhes/componentes/` e importá-lo no `index.tsx` principal.

### 3.1. Estrutura do Checklist (Sugestão de Código)
O componente deve receber o `lead.status` e mostrar as tarefas correspondentes.

```tsx
// Exemplo simplificado
export function FaseChecklist({ status }: { status: string }) {
    
    // Definir tarefas por Status (Isso pode virar uma constante depois)
    const TAREFAS = {
        'NOVO': [ // Fase 1
            "Ligar para o proprietário (Tentativa 1)",
            "Confirmar endereço exato do imóvel",
            "Identificar motivo da venda (Dor)"
        ],
        'TENTATIVA_AGENDAMENTO': [ // Fase 2
            "Apresentar apresentação institucional",
            "Agendar visita técnica",
            "Alinhar expectativa de preço"
        ],
        'DOCUMENTACAO': [ // Fase 3
            "Realizar visita e fotos",
            "Coletar Matrícula e IPTU",
            "Solicitar assinatura da autorização"
        ]
    };

    const tarefasAtuais = TAREFAS[status] || [];

    if (tarefasAtuais.length === 0) return null;

    return (
        <Card className="border-l-4 border-blue-500 mb-6">
            <CardHeader className="py-3">
                <CardTitle className="text-sm uppercase tracking-wider text-blue-600">
                    📋 Tarefas da Fase Atual
                </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
                <div className="space-y-2">
                    {tarefasAtuais.map((tarefa, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                            <span className="text-sm text-gray-700">{tarefa}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
```

### 3.2. Integração
Inserir este componente `<FaseChecklist status={lead.status} />` no topo do arquivo `LeadDetalhes/index.tsx`, logo abaixo dos Banners de Status.

---

## Resumo da Entrega

1.  **Agente "Calmo":** Foca em qualificar, para de invadir a fase de documentos.
2.  **Kanban "Falante":** Colunas com nomes comerciais e aviso de atraso.
3.  **Lead "Guiado":** Checklist dizendo ao corretor o próximo passo.
