/**
 * ADMIN AGENT - Agente 4: Onboarding
 * 
 * Missão: Coletar documentos, enviar contrato, coletar dados do imóvel, enviar para CRM
 * Personalidade: Organizado, metódico, eficiente
 * 
 * Fluxo:
 * 1. Coletar documentos (CPF, email, endereço)
 * 2. Gerar e enviar contrato
 * 3. Agendar avaliação/fotos
 * 4. NOVO: Coletar dados do imóvel (quartos, área, valor, características)
 * 5. NOVO: Enviar para CRM
 * 6. Marcar como CAPTADO
 * 
 * @version 2.0
 * @date 22/12/2025
 */

import { Agent } from '@openai/agents';
import { z } from 'zod';
import {
    moverParaFaseTool,
    agendarAvaliacaoTool,
    encaminharCorretorTool,
    gerarLinkContratoTool,
    atualizarDadosLeadTool,
    salvarDadosImovelTool,
    enviarParaCrmTool
} from '../ferramentas/sdr-tools-agents';
import { prisma } from '../lib/db';



// ====================================
// CHECKLIST DE ONBOARDING
// ====================================

const DOCUMENTOS_NECESSARIOS = [
    {
        nome: 'CPF do Proprietário',
        obrigatorio: true,
        motivo: 'Para identificação no contrato'
    },
    {
        nome: 'Endereço Completo do Imóvel',
        obrigatorio: true,
        motivo: 'Para registro e avaliação'
    },
    {
        nome: 'Número do IPTU',
        obrigatorio: false,
        motivo: 'Se disponível, agiliza a análise documental'
    },
    {
        nome: 'Matrícula do Imóvel',
        obrigatorio: false,
        motivo: 'Será solicitada na visita técnica'
    },
    {
        nome: 'E-mail',
        obrigatorio: true,
        motivo: 'Para envio do contrato digital'
    }
];

const DADOS_IMOVEL_COLETAR = [
    { nome: 'Tipo do imóvel', exemplo: 'apartamento, casa, comercial' },
    { nome: 'Quartos / Suítes', exemplo: '3 quartos, 1 suíte' },
    { nome: 'Banheiros', exemplo: '2 banheiros' },
    { nome: 'Vagas de garagem', exemplo: '2 vagas' },
    { nome: 'Área', exemplo: '120m²' },
    { nome: 'Valor pretendido', exemplo: 'R$ 650.000' },
    { nome: 'Características', exemplo: 'armários, varanda, churrasqueira' },
];

// ====================================
// GERAR SYSTEM PROMPT
// ====================================

export function gerarPromptAdmin(config: {
    nomeAgente: string;
    genero: string;
    nomeImobiliaria: string;
    emailContrato?: string;
    tipoAutorizacao?: string;
    prazoTrabalho?: number;
    comissaoAcordada?: string;
}): string {
    const generoSufixo = config.genero === 'feminino' ? 'a' : 'o';
    const tipoContrato = config.tipoAutorizacao === 'exclusiva' ? 'AUTORIZAÇÃO EXCLUSIVA' : 'AUTORIZAÇÃO DE VENDA';
    const prazo = config.prazoTrabalho || 90;
    const comissao = config.comissaoAcordada || 'padrao';

    return `# Você é ${config.nomeAgente} - Especialista em Onboarding da ${config.nomeImobiliaria}

## 🎯 SUA MISSÃO (FASE 4 - ONBOARDING COMPLETO)
Você finaliza o processo de captação. O cliente já ACORDOU os termos:
- **Modelo:** ${tipoContrato}
- **Prazo:** ${prazo} dias
- **Comissão:** ${comissao}

## 📌 FLUXO OBRIGATÓRIO (siga na ordem!)

### ETAPA 1: Documentos Básicos
${DOCUMENTOS_NECESSARIOS.map((doc, i) => `${i + 1}. **${doc.nome}** ${doc.obrigatorio ? '(Obrigatório)' : '(Opcional)'}`).join('\n')}

→ Use \`atualizar_dados_lead\` para salvar

### ETAPA 2: Contrato Digital
1. Gere o link com \`gerar_link_contrato\`
2. Envie ao cliente
3. Aguarde confirmação de recebimento

### ETAPA 3: Agendar Avaliação
- Pergunte: "Qual o melhor dia/horário para fotos?"
- Use \`agendar_avaliacao\`

### ETAPA 4: 📸 COLETAR DADOS DO IMÓVEL (NOVO!)
Após o contrato, colete detalhes para anunciar:

${DADOS_IMOVEL_COLETAR.map((d, i) => `${i + 1}. **${d.nome}** - Ex: "${d.exemplo}"`).join('\n')}

**PERGUNTE DE FORMA NATURAL:**
"Perfeito! Agora preciso de alguns detalhes do seu imóvel para criar um anúncio atrativo:
📐 Quantos quartos e suítes?
🚿 Quantos banheiros?
🚗 Vagas de garagem?
📏 Qual a metragem aproximada?
💰 Qual valor você pretende?"

→ Use \`salvar_dados_imovel\` para CADA GRUPO de dados recebido

### ETAPA 5: Enviar para CRM
Após coletar os dados do imóvel:
→ Use \`enviar_para_crm\` para sincronizar com o sistema de gestão

### ETAPA 6: Finalizar
Quando tudo estiver completo:
→ Use \`mover_para_fase\` com faseDestino="CAPTADO"

## ✅ CHECKLIST DE SUCESSO
- [ ] CPF e E-mail salvos
- [ ] Link do contrato enviado
- [ ] Visita agendada
- [ ] Dados do imóvel coletados
- [ ] Enviado para CRM

## 💬 ESTILO
- Tom prático: "Vamos resolver isso rapidinho!"
- Confirme cada info: "✓ Dados salvos!"
- Emojis moderados (✓, 📋, 📅, 🏠)

## ⚠️ REGRAS
- NUNCA se apresente novamente
- NUNCA diga "passar para outro"
- Você É ${config.nomeAgente} desde o início`;
}

// ====================================
// CRIAR AGENTE ADMIN
// ====================================

export function criarAdminAgent(config: {
    nomeAgente: string;
    genero?: string;
    nomeImobiliaria: string;
    emailContrato?: string;
    tipoAutorizacao?: string;
    prazoTrabalho?: number;
    comissaoAcordada?: string;
}): Agent {
    const prompt = gerarPromptAdmin({
        nomeAgente: config.nomeAgente,
        genero: config.genero || 'feminino',
        nomeImobiliaria: config.nomeImobiliaria,
        emailContrato: config.emailContrato,
        tipoAutorizacao: config.tipoAutorizacao,
        prazoTrabalho: config.prazoTrabalho,
        comissaoAcordada: config.comissaoAcordada
    });

    return new Agent({
        name: 'admin_agent',
        model: 'gpt-4o',
        instructions: prompt,
        tools: [
            moverParaFaseTool,
            agendarAvaliacaoTool,
            encaminharCorretorTool,
            gerarLinkContratoTool,
            atualizarDadosLeadTool,
            salvarDadosImovelTool,   // 🆕 Coleta dados do imóvel
            enviarParaCrmTool        // 🆕 Envia para CRM
        ]
    });
}

// ====================================
// EXPORTAR
// ====================================

export default criarAdminAgent;
