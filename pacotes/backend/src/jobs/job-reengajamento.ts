/**
 * JOB DE RE-ENGAJAMENTO DE LEADS FRIOS
 * 
 * Reativa leads classificados como FRIO após 30-60 dias com uma
 * abordagem completamente diferente da prospecção original.
 * 
 * Estratégia: Em vez de "vender", o re-engajamento foca em VALOR:
 * - Informação de mercado atualizada
 * - Notícias sobre a região do imóvel
 * - Mudanças relevantes (novo metrô, shopping, valorização)
 * 
 * Limita a 10 re-engajamentos/dia por campanha para evitar spam.
 * 
 * Deve ser executado via cron (ex: terça e quinta às 10h)
 * 
 * @version 1.0
 * @date 02/04/2026
 */

import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';

interface ResultadoReengajamento {
  processados: number;
  enviados: number;
  erros: number;
  campanhasProcessadas: string[];
}

// ====================================
// MENSAGENS DE RE-ENGAJAMENTO
// ====================================

/**
 * Gera mensagem de re-engajamento baseada no contexto do lead frio.
 * Foco: VALOR e INFORMAÇÃO, não venda direta.
 */
function gerarMensagemReengajamento(contato: any): string {
  const nome = contato.nome?.split(' ')[0] || 'Olá';
  const edificio = contato.nomeEdificio || contato.campanhaOrigem?.nomeEmpreendimento || '';
  const bairro = contato.campanhaOrigem?.empreendimento?.localizacao || '';

  const templates = [
    // Template 1: Informação de mercado
    `Oi ${nome}! 📊 Passando pra compartilhar: o mercado imobiliário${bairro ? ` na região do ${bairro}` : ''} valorizou nos últimos meses. Se ainda tem o imóvel${edificio ? ` no ${edificio}` : ''}, pode ser um bom momento pra reavaliar. Quer que eu faça uma análise atualizada pra você? Sem compromisso! 😊`,

    // Template 2: Interesse genuíno
    `${nome}, tudo bem? 😊 Sei que quando conversamos o momento não era ideal, mas queria saber se algo mudou na sua situação${edificio ? ` com o ${edificio}` : ''}. Caso precise de qualquer orientação sobre o mercado, estou por aqui!`,

    // Template 3: Novidade na região
    `Oi ${nome}! Sabia que a região${bairro ? ` do ${bairro}` : ' do seu imóvel'} tem recebido novos investimentos? 🏗️ Isso pode impactar na valorização${edificio ? ` do ${edificio}` : ''}. Se tiver curiosidade, posso te passar uma análise rápida. Sem compromisso! 😊`,

    // Template 4: Dica profissional
    `${nome}, bom dia! 🌅 Como especialista do mercado${bairro ? ` do ${bairro}` : ''}, queria compartilhar uma dica: ${new Date().getMonth() >= 6 ? 'o segundo semestre costuma ser mais movimentado para vendas' : 'o primeiro semestre é excelente para avaliações'}. Se quiser conversar sobre${edificio ? ` o ${edificio}` : ' seu imóvel'}, estou à disposição!`,
  ];

  // Selecionar template de forma determinística baseado no ID para evitar repetição
  const index = contato.id.charCodeAt(0) % templates.length;
  return templates[index];
}

// ====================================
// PROCESSAMENTO
// ====================================

const LIMITE_POR_CAMPANHA = 10;
const DIAS_MINIMO_INATIVIDADE = 30;

export async function processarReengajamento(): Promise<ResultadoReengajamento> {
  console.log('\n========================================');
  console.log('🔄 INICIANDO JOB DE RE-ENGAJAMENTO DE LEADS FRIOS');
  console.log('========================================\n');

  const resultado: ResultadoReengajamento = {
    processados: 0,
    enviados: 0,
    erros: 0,
    campanhasProcessadas: []
  };

  try {
    // Calcular data limite (30 dias atrás)
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - DIAS_MINIMO_INATIVIDADE);

    // Buscar leads frios que não foram contatados há pelo menos 30 dias
    // Agrupados por campanha para respeitar o limite de 10/campanha
    const campanhasAtivas = await prisma.campanha.findMany({
      where: { status: 'ATIVA' },
      select: { id: true, tenantId: true, nomeEmpreendimento: true }
    });

    for (const campanha of campanhasAtivas) {
      // Buscar contatos frios desta campanha
      const contatosFrios = await prisma.lead.findMany({
        where: {
          campanhaOrigemId: campanha.id,
          OR: [
            { statusProspeccao: 'FRIO' },
            { statusProspeccao: 'NAO_RESPONDEU' }
          ],
          atualizadoEm: { lte: limiteData },
          // Nunca re-engajar quem pediu opt-out
          NOT: { statusProspeccao: 'OPTOUT' }
        },
        include: {
          campanhaOrigem: { include: { empreendimento: true } }
        },
        take: LIMITE_POR_CAMPANHA,
        orderBy: { atualizadoEm: 'asc' } // Mais antigos primeiro
      });

      if (contatosFrios.length === 0) continue;

      resultado.campanhasProcessadas.push(campanha.nomeEmpreendimento || campanha.id);
      console.log(`\n📋 Campanha "${campanha.nomeEmpreendimento || campanha.id}": ${contatosFrios.length} leads frios elegíveis`);

      // Buscar sessão WhatsApp do tenant
      const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
        where: { tenantId: campanha.tenantId, status: 'CONECTADO' }
      });

      if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
        console.log(`   ⚠️ Sem sessão WhatsApp ativa para tenant ${campanha.tenantId}`);
        resultado.erros += contatosFrios.length;
        continue;
      }

      const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);

      for (const contato of contatosFrios) {
        resultado.processados++;

        if (!contato.telefone || !contato.temWhatsapp) {
          resultado.erros++;
          continue;
        }

        try {
          const mensagem = gerarMensagemReengajamento(contato);

          // Enviar via WhatsApp
          await whatsappService.enviarMensagemTexto(contato.telefone, mensagem);

          // Registrar mensagem no histórico
          await prisma.mensagemProspeccao.create({
            data: {
              leadId: contato.id,
              direcao: 'SAIDA',
              conteudo: mensagem,
              tipo: 'TEXTO',
              telefone: contato.telefone,
              processadaPorIA: false
            }
          });

          // Atualizar status
          await prisma.lead.update({
            where: { id: contato.id },
            data: {
              statusProspeccao: 'CONTATANDO',
              tentativasContato: (contato.tentativasContato || 0) + 1,
              ultimaTentativa: new Date(),
              observacoes: `[RE-ENGAJAMENTO ${new Date().toLocaleDateString('pt-BR')}] Lead frio reativado após ${DIAS_MINIMO_INATIVIDADE}+ dias.\n\n${contato.observacoes || ''}`
            }
          });

          resultado.enviados++;
          console.log(`   ✅ ${contato.nome} — re-engajado com sucesso`);

          // Delay entre envios (3-6 segundos)
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 3000));

        } catch (error: any) {
          console.error(`   ❌ ${contato.nome}: ${error.message}`);
          resultado.erros++;
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Erro fatal no job de re-engajamento:', error);
    throw error;
  }

  // Resumo
  console.log('\n========================================');
  console.log('📊 RESUMO DO RE-ENGAJAMENTO');
  console.log('========================================');
  console.log(`Processados: ${resultado.processados}`);
  console.log(`Enviados:    ${resultado.enviados}`);
  console.log(`Erros:       ${resultado.erros}`);
  console.log(`Campanhas:   ${resultado.campanhasProcessadas.join(', ') || 'nenhuma'}`);
  console.log('========================================\n');

  return resultado;
}

// Executar se chamado diretamente
if (require.main === module) {
  processarReengajamento()
    .then(() => {
      console.log('Job finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job falhou:', error);
      process.exit(1);
    });
}
