# Skills para Agentes de IA
*Guia Técnico para Desenvolvedores*

---

## 1. O que é uma Skill?

Uma Skill é um arquivo Markdown (`.md`) — ou uma pasta com vários arquivos — que funciona como um **playbook instrucional** que o agente lê sob demanda, antes de executar uma tarefa específica.

Diferente de colocar todas as instruções no system prompt, a Skill é carregada apenas quando necessária (**progressive disclosure**), preservando a janela de contexto do modelo.

### Analogia prática

Pense em um funcionário novo na empresa:

- **System Prompt** = contrato de trabalho (regras gerais, tom, objetivo)
- **Skill** = manual de onboarding de uma tarefa específica (como qualificar um lead, como tratar objeções, como agendar reunião)
- O funcionário só abre o manual quando vai executar aquela tarefa — não fica relendo o manual o tempo todo

---

## 2. Arquitetura: Agents vs Skills

| Aspecto | Agente tradicional | Com Skills |
|---|---|---|
| **System Prompt** | Grande e detalhado | Enxuto — só referencia as skills disponíveis |
| **Ferramentas (Tools)** | Definidas na arquitetura | Scripts chamados dentro do `.md` |
| **Memória** | Banco de dados externo | Retroalimentação direta no arquivo `.md` |
| **Manutenção** | Requer deploy | Edição direta no arquivo, sem deploy |
| **Contexto** | Carrega tudo sempre | Carrega só o que for usar (progressive disclosure) |

---

## 3. Estrutura de Arquivos

Uma Skill é uma pasta com a seguinte estrutura típica:

```
📁 skill-sdr-qualificacao/
   📄 SKILL.md                  ← instrução principal (o playbook)
   📁 referencias/              ← arquivos de apoio
      📄 roteiro-bant.md
      📄 objecoes-comuns.md
      📄 icp-perfil-ideal.md
   📁 scripts/                  ← scripts determinísticos (opcional)
      📄 registrar_lead.py
```

---

## 4. Anatomia do SKILL.md

O arquivo `SKILL.md` deve conter as seguintes seções:

### 4.1 Trigger — quando usar esta skill

Define as palavras ou contextos que ativam a leitura desta skill:

```markdown
## Quando usar esta Skill
Use esta skill sempre que o usuário mencionar:
- qualificar lead, novo contato, prospecção
- perguntas sobre o perfil do cliente
- avançar para reunião, agendar demo
```

### 4.2 Objetivo

Descreve o que o agente deve alcançar ao executar esta skill.

### 4.3 Roteiro / Passo a Passo

O fluxo que o agente deve seguir — pode incluir perguntas, lógicas condicionais e ações.

### 4.4 Referência a Scripts (se houver)

Indica quando e como chamar os scripts da pasta `/scripts`:

```markdown
## Ferramentas disponíveis
Quando qualificar um lead com sucesso, execute:
→ scripts/registrar_lead.py com os dados coletados
```

---

## 5. Como o System Prompt referencia as Skills

O system prompt do agente deve ser **enxuto** e apenas listar as skills disponíveis:

```
Você é um SDR da [Empresa]. Seu objetivo é qualificar leads no WhatsApp.

## Skills disponíveis
- skill-qualificacao: roteiro para qualificar um lead (BANT)
- skill-objecoes: como tratar objeções comuns
- skill-agendamento: como conduzir para marcar reunião
- skill-produto: informações técnicas do produto

Leia a skill relevante antes de executar cada tarefa.
```

> ⚠️ O agente **NÃO** carrega o conteúdo das skills no início — apenas os nomes. O conteúdo é lido sob demanda.

---

## 6. Implementação Prática — SDR de WhatsApp

### Skills recomendadas

| Skill | Conteúdo principal |
|---|---|
| `skill-qualificacao.md` | Roteiro BANT/SPIN, perguntas por etapa, critério de passagem |
| `skill-objecoes.md` | Top 10 objeções + resposta recomendada para cada |
| `skill-produto.md` | Casos de uso, diferenciais, público ideal (ICP) |
| `skill-agendamento.md` | Como propor reunião, horários disponíveis, link de agendamento |
| `skill-escalamento.md` | Quando e como passar para humano ou para outra equipe |

---

## 7. Evolução Contínua da Skill

Uma das maiores vantagens das Skills é a **retroalimentação direta**:

- Após uma boa qualificação: *"Registra este padrão na skill-qualificacao"*
- Após tratar uma objeção nova: *"Adiciona esta objeção e resposta na skill-objecoes"*
- A skill melhora continuamente **sem precisar de deploy ou alteração de código**

> 💡 Para times técnicos: versione as skills no **GitHub** para histórico completo de evolução.

---

## 8. Fluxo de Execução — Passo a Passo

```
1. Usuário envia mensagem no WhatsApp
        ↓
2. Agente lê o system prompt enxuto (com lista de skills)
        ↓
3. Agente identifica qual skill é necessária para esta mensagem
        ↓
4. Agente lê o SKILL.md correspondente
        ↓
5. Agente executa o roteiro (perguntas, ações, scripts)
        ↓
6. Resposta retorna ao usuário — skill é descarregada do contexto
```

---

*Documento para uso interno do time de desenvolvimento.*
