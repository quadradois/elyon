---
description: Playbook de Captação Elyon - MVP (4 Etapas)
---

# 📋 Playbook de Captação - Elyon MVP

**Objetivo Final:** Contrato de Captação Assinado  
**Escopo:** Versão 1.0 focada em estabelecer processo funcional sem depender de features futuras (fotos/anúncios).

---

## 🎯 Visão Geral do Funil

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PROSPECTAR │ --> │  QUALIFICAR │ --> │  CONVERTER  │ --> │  FINALIZAR  │
│   (Contato) │     │    (Lead)   │     │ (Autorizado)│     │  (Captado)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Taxa de Conversão Esperada:**  
Prospectar → Qualificar: 20%  
Qualificar → Converter: 40%  
Converter → Finalizar: 70%

---

## 📍 FASE 1: PROSPECTAR (Status: AGUARDANDO)

### Objetivo
Criar base de proprietários e iniciar primeiro contato.

### Executor Principal
**🤖 IA (Agente SDR de Captação)**

### Atividades
1. **Enviar mensagem inicial no WhatsApp**
   - Template: "Oi [Nome]! Trabalho com imóveis e tenho cliente procurando no [Bairro]. Você conhece alguém vendendo?"
   - Alternativa (Ativo): Usar "Técnica do Idoso Confuso"
   - Alternativa (Passivo): Se lead entrou em contato, perguntar interesse direto

2. **Mapear intenção inicial**
   - Perguntar: "Seu imóvel está para vender, alugar ou ambos?"
   - Perguntar: "Qual a urgência? Semana/Mês/Ano?"

### Dados Coletados (Mínimo)
- ✅ Telefone válido (WhatsApp ativo)
- ✅ Nome do proprietário
- ✅ Intenção declarada (Venda/Locação/Talvez)
- ✅ Urgência (Alta/Média/Baixa)

### Critério de Passagem para FASE 2
- [ ] Proprietário respondeu "SIM, quero vender/alugar"
- [ ] OU respondeu "Talvez" mas com prazo definido (ex: "Daqui 2 meses")

### Ações de Falha
- **Se "Não tenho interesse"** → Registrar Opt-out
- **Se "Futuro distante"** → Marcar para Nutrição (6 meses)
- **Se não responder em 48h** → 1 follow-up, depois arquivar

### Transição Técnica
**Ação:** Botão "Promover a Lead" (Manual) OU Tool `converter_para_lead` (IA Automático)  
**Destino:** Lead criado com status `NOVO` (Kanban: "1. Interesse Confirmado")

### Responsabilidade Humana Nesta Fase
**NENHUMA** (100% automatizado)

---

## 📍 FASE 2: QUALIFICAR (Status: NOVO → TENTATIVA_AGENDAMENTO)

### Objetivo
Validar se a oportunidade é real e coletar dados comerciais mínimos para avaliar viabilidade.

### Executor Principal
**👤 HUMANO (Corretor/SDR Humano)** com apoio da IA

### Atividades
1. **Primeira Ligação de Diagnóstico (Humano)**
   - Confirmar identidade: "É o proprietário mesmo?"
   - Validar motivação: "Por que quer vender/alugar agora?"
   - Descobrir restrições: "Já está com outra imobiliária?"
   - Coletar localização: "Qual endereço do imóvel?"
   - Entender produto: "Quantos quartos? Metragem aproximada?"
   - Sinalizar valor: "Tem ideia do valor que pretende?"

2. **Qualificação de Urgência (Humano)**
   - Perguntar: "Seu prazo é flexível ou precisa vender rápido?"
   - Identificar GAP: "Preço que espera X valor de mercado estimado"

3. **Apoio da IA (Opcional)**
   - IA pode enviar mensagens de follow-up se humano não conseguir contato
   - IA pode responder dúvidas básicas do cliente entre ligações

### Dados Coletados (Obrigatórios)
- ✅ Endereço completo ou Nome do Condomínio
- ✅ Tipo de Imóvel (Casa/Apto/Comercial)
- ✅ Quartos e Metragem (aproximado)
- ✅ Ocupação (Vazio/Inquilino/Proprietário Mora)
- ✅ Valor pretendido (range ou exato)
- ✅ Motivação (Mudança/Investimento/Dívida/Herança)
- ✅ Está com outra imobiliária? (Sim/Não)

### Dados Desejáveis (Bônus)
- ⚪ Quitado ou financiado?
- ⚪ Tem dívidas (IPTU/Condomínio)?
- ⚪ Estado de conservação (Reforma/Bom/Excelente)

### Critério de Passagem para FASE 3
- [ ] Proprietário confirmou dados básicos do imóvel
- [ ] Valor pretendido está dentro da realidade (±30% do mercado)
- [ ] Proprietário topou próxima conversa sobre "autorização de anúncio"
- [ ] SEM exclusividade com concorrente OU disposto a trabalhar junto

### Ações de Falha
- **Se preço absurdo (>50% mercado) e inflexível** → Marcar "Perdido - Expectativa Irreal"
- **Se exclusividade bloqueada (contrato vigente)** → Marcar "Perdido - Concorrência" + Follow-up em 3 meses
- **Se não é proprietário** → Arquivar ou buscar contato do real dono

### Transição Técnica
**Ação:** Humano move card no Kanban (Drag & Drop)  
**Destino:** Lead move para status `TENTATIVA_AGENDAMENTO` (Kanban: "2. Qualificação")

### Responsabilidade da IA Nesta Fase
- Manter histórico do chat disponível para o humano consultar
- Responder enquanto humano não está disponível
- Sugerir argumentos (via botão "Gerar Resposta")

---

## 📍 FASE 3: CONVERTER (Status: TENTATIVA_AGENDAMENTO → DOCUMENTACAO)

### Objetivo
Conseguir autorização formal para anunciar o imóvel e alinhar condições comerciais (comissão, prazo, exclusividade).

### Executor Principal
**👤 HUMANO (Corretor)** com sugestões da IA

### Atividades
1. **Negociação Comercial (Humano)**
   - Apresentar proposta de trabalho:
     * Comissão padrão (6% ou valor regional)
     * Forma de divulgação (Portais + Redes)
     * Prazo de trabalho (Sugestão: 90 dias)
     * Exclusividade (Preferencial mas não obrigatória)
   
2. **Tratamento de Objeções (Humano + IA)**
   - **Objeção:** "Taxa muito alta"
     * **Resposta (IA sugere):** "Nossa taxa inclui avaliação gratuita, fotos profissionais, divulgação em X portais e assessoria jurídica. É investimento que acelera a venda."
     * **Contrapartida:** "Posso consultar 5% SE você assinar exclusividade de 60 dias"
   
   - **Objeção:** "Já tenho imobiliária"
     * **Resposta:** "Podemos trabalhar em conjunto sem exclusividade. Mais canais = mais chances de vender rápido."
   
   - **Objeção:** "Quero vender sozinho"
     * **Resposta:** "Entendo! Mas sabia que imóveis com imobiliária vendem 40% mais rápido? Posso mostrar nossos resultados."

3. **Coleta de Documentos Preliminares (Humano)**
   - Solicitar por WhatsApp (ou pessoalmente se houver visita):
     * Foto da Matrícula (legível)
     * Foto do IPTU recente
     * RG/CPF do proprietário
   
   - **Nota:** Se o cliente não tiver documentos em mãos, não bloquear. Apenas anotar pendências.

### Dados Coletados (Obrigatórios)
- ✅ Comissão acordada (% ou valor fixo)
- ✅ Tipo de autorização (Exclusiva/Simples)
- ✅ Prazo de trabalho (dias)
- ✅ Confirmação de que vai autorizar anúncio

### Dados Desejáveis
- ⚪ Documentos básicos recebidos (Matrícula, IPTU, RG)
- ⚪ Fotos do imóvel (mínimo 3, tiradas pelo próprio cliente)

### Critério de Passagem para FASE 4
- [ ] Proprietário concordou com condições comerciais (comissão + prazo)
- [ ] Proprietário autorizou divulgação explicitamente ("Pode anunciar")
- [ ] OU Proprietário pediu para enviar contrato ("Me manda o contrato pra eu assinar")

### Ações de Falha
- **Se não aceitar comissão E não houver margem** → Marcar "Perdido - Condições Comerciais"
- **Se ficou de "pensar" por >7 dias** → Follow-up 1x, depois mover pra "Morno" (Nutrição)

### Transição Técnica
**Ação:** Humano move card no Kanban  
**Destino:** Lead move para status `DOCUMENTACAO` (Kanban: "3. Documentação")

### Responsabilidade da IA Nesta Fase
- Gerar minutas de mensagens persuasivas (botão "Sugerir Argumento")
- Enviar mensagens de follow-up se humano não fechar em 3 dias
- Gravar no chat quando proprietário confirmar acordo verbal

---

## 📍 FASE 4: FINALIZAR (Status: DOCUMENTACAO → CAPTADO)

### Objetivo
Gerar e assinar contrato de captação, formalizando a parceria.

### Executor Principal
**👤 HUMANO (Corretor)** com automação da IA

### Atividades
1. **Geração do Contrato (Automático ou Semi)**
   - Sistema preenche template de contrato com dados do Lead:
     * Nome do proprietário
     * CPF
     * Endereço do imóvel
     * Comissão acordada
     * Prazo de vigência
     * Tipo (Exclusivo ou Simples)
   
   - **Executor:** Sistema (futuro) ou Humano (MVP atual - via Google Docs/Word)

2. **Envio do Contrato (Humano)**
   - Enviar PDF via WhatsApp ou Email
   - Explicar cláusulas importantes se necessário
   - Solicitar assinatura (física ou digital via DocuSign/ClickSign)

3. **Confirmação da Assinatura (Humano)**
   - Receber contrato assinado
   - Fazer upload no sistema (salvar em `Lead.contratoUrl` ou pasta)
   - Marcar lead como `CAPTADO`

### Dados Coletados (Obrigatórios)
- ✅ Contrato assinado (arquivo PDF)
- ✅ Data de assinatura
- ✅ Data de vigência (início/fim)

### Critério de Conclusão
- [ ] Contrato assinado por ambas as partes
- [ ] Arquivo salvo no sistema

### Transição Técnica
**Ação:** Humano move card no Kanban  
**Destino:** Lead move para status `CAPTADO` (Kanban: "4. Captado")

### Responsabilidade da IA Nesta Fase
- Lembrar humano de cobrar assinatura (se >3 dias sem retorno)
- Gerar rascunho de mensagem: "Oi [Nome], enviei o contrato ontem. Conseguiu dar uma olhada? Qualquer dúvida, me chama!"

### Próximos Passos (Fora do MVP)
Após `CAPTADO`, o imóvel entra no funil de **Anúncios**:
- Agendar sessão de fotos
- Criar ficha completa
- Publicar em portais

**Por ora:** Lead fica em `CAPTADO` e equipe trabalha manualmente fora do sistema.

---

## 📊 Checklist de Responsabilidades

| Fase | IA (Automático) | Humano (Manual) | Sistema (Backend) |
|------|----------------|-----------------|-------------------|
| **1. Prospectar** | ✅ Enviar mensagens<br>✅ Coletar intenção<br>✅ Criar Contato | ❌ Nenhuma | ✅ Registrar chat<br>✅ Criar Lead ao promover |
| **2. Qualificar** | ⚪ Follow-up<br>⚪ Sugerir respostas | ✅ Ligar cliente<br>✅ Qualificar dados<br>✅ Mover Kanban | ✅ Atualizar campos do Lead |
| **3. Converter** | ⚪ Sugerir objeções<br>⚪ Follow-up cobrança | ✅ Negociar comissão<br>✅ Pedir docs<br>✅ Mover Kanban | ✅ Salvar arquivos<br>✅ Atualizar status |
| **4. Finalizar** | ⚪ Lembrar assinatura | ✅ Gerar contrato<br>✅ Enviar contrato<br>✅ Upload assinado | ✅ Salvar contrato<br>✅ Marcar CAPTADO |

**Legenda:**
- ✅ Responsabilidade principal
- ⚪ Responsabilidade auxiliar
- ❌ Não atua

---

## 🔧 Gaps Técnicos Identificados (Para Resolver)

### 1. Perda de Dados da IA → Kanban
**Problema:** IA coleta endereço/metragem no chat, mas não preenche automaticamente no Lead.  
**Solução (Futuro):** Tools da IA devem fazer `PATCH /leads/:id` ao coletar dado estruturado.

### 2. Documentos Ficam no WhatsApp
**Problema:** Cliente envia PDF da matrícula pra IA, mas arquivo não sobe pro sistema.  
**Solução (Futuro):** Integração Evolution API → Storage → `Lead.arquivos[]`

### 3. Geração de Contrato Manual
**Problema:** Humano precisa fazer contrato no Word/Docs manualmente.  
**Solução (Futuro):** Backend gera PDF automatizado via template + dados do Lead.

### 4. Agendamento Duplicado
**Problema:** IA agenda visita, humano agenda de novo porque não viu.  
**Solução (MVP):** Campo visual no Lead "Última Atividade da IA" mostrando o que ela fez.

---

## 🎯 Métricas de Sucesso (MVP)

- **Leads Qualificados/Mês:** >50
- **Taxa de Conversão (Qualificar → Converter):** >30%
- **Tempo Médio (Prospectar → Captado):** <15 dias
- **% Contratos Assinados Digitalmente:** >70%

---

## 📝 Notas Finais

Este playbook deve ser **vivo**. Ajustar a cada sprint conforme feedbacks da operação.

**Próxima Revisão:** Após 30 contratos captados pelo processo acima.
