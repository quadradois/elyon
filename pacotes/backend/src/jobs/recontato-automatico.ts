/**
 * JOB DE RECONTATO AUTOMÁTICO
 * 
 * Processa contatos marcados como MORNO_FUTURO cuja data de recontato chegou.
 * Envia mensagem de follow-up personalizada e reativa o contato para prospecção.
 * 
 * Deve ser executado via cron (ex: diariamente às 9h)
 * 
 * @example
 * // Executar via terminal:
 * npx ts-node src/jobs/recontato-automatico.ts
 * 
 * // Ou via cron no servidor:
 * 0 9 * * * cd /app && node dist/jobs/recontato-automatico.js
 */

import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';

interface ResultadoRecontato {
  processados: number;
  enviados: number;
  erros: number;
  detalhes: {
    contatoId: string;
    nome: string;
    status: 'enviado' | 'erro';
    mensagem?: string;
  }[];
}

/**
 * Gera mensagem de recontato personalizada baseada no motivo original.
 * Se o motivo começar com [MSG], usa a mensagem exata digitada pelo corretor.
 */
function gerarMensagemRecontato(contato: any): string {
  const motivoOriginal = contato.motivoRecontato || '';

  // Mensagem customizada agendada pelo corretor via ChatPanel
  if (motivoOriginal.startsWith('[MSG] ')) {
    return motivoOriginal.replace('[MSG] ', '').trim();
  }

  const nome = contato.nome?.split(' ')[0] || 'Olá';
  const motivo = motivoOriginal.toLowerCase();
  const empreendimento = contato.nomeEdificio || contato.campanha?.nomeEmpreendimento || 'seu imóvel';
  
  if (motivo.includes('inquilino') || motivo.includes('ocupado')) {
    return `Oi ${nome}! 😊 Passando pra saber como está a situação do inquilino. Ainda está morando aí ou já desocupou? Lembra que conversamos sobre a venda do ${empreendimento}?`;
  }
  if (motivo.includes('reforma') || motivo.includes('obra')) {
    return `Oi ${nome}! Tudo bem? Passando pra ver se a reforma já finalizou. Como está ficando o ${empreendimento}? Quando estiver pronto, me avisa que tenho interessados na região! 🏠`;
  }
  if (motivo.includes('viajar') || motivo.includes('viagem')) {
    return `Oi ${nome}! Espero que a viagem tenha sido ótima! 😊 Voltando ao assunto do ${empreendimento}, ainda tem interesse em vender? Tenho novidades do mercado pra te contar!`;
  }
  if (motivo.includes('pensar') || motivo.includes('decidir')) {
    return `Oi ${nome}! Passando pra saber se já pensou melhor sobre a venda do ${empreendimento}. Alguma dúvida que eu possa ajudar a esclarecer? 😊`;
  }
  if (motivo.includes('corretor') || motivo.includes('exclusividade')) {
    return `Oi ${nome}! Como está a venda do ${empreendimento}? Já conseguiu um bom resultado com o corretor atual? Se precisar de uma segunda opinião, estou por aqui! 😊`;
  }
  if (motivo.includes('preço') || motivo.includes('valor')) {
    return `Oi ${nome}! O mercado tem se movimentado bastante! Passando pra saber se ainda tem interesse em saber quanto vale o ${empreendimento} hoje. Posso fazer uma avaliação atualizada pra você! 📊`;
  }
  return `Oi ${nome}! 😊 Lembra que conversamos sobre o ${empreendimento}? Passando pra saber se algo mudou e se posso ajudar de alguma forma!`;
}


/**
 * Busca contatos que precisam ser recontatados hoje
 */
async function buscarContatosParaRecontato(): Promise<any[]> {
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999); // Fim do dia
  
  const contatos = await prisma.contato.findMany({
    where: {
      statusProspeccao: 'MORNO_FUTURO',
      dataRecontato: {
        lte: hoje
      }
    },
    include: {
      campanha: true
    },
    orderBy: {
      dataRecontato: 'asc'
    }
  });
  
  return contatos;
}

/**
 * Processa recontatos automáticos
 */
export async function processarRecontatos(): Promise<ResultadoRecontato> {
  console.log('\n========================================');
  console.log('🔄 INICIANDO JOB DE RECONTATO AUTOMÁTICO');
  console.log('========================================\n');
  
  const resultado: ResultadoRecontato = {
    processados: 0,
    enviados: 0,
    erros: 0,
    detalhes: []
  };
  
  try {
    // 1. Buscar contatos para recontato
    const contatos = await buscarContatosParaRecontato();
    
    console.log(`📋 Encontrados ${contatos.length} contatos para recontato\n`);
    
    if (contatos.length === 0) {
      console.log('✅ Nenhum contato para recontar hoje.');
      return resultado;
    }
    
    // 2. Processar cada contato
    for (const contato of contatos) {
      resultado.processados++;
      
      console.log(`\n[${resultado.processados}/${contatos.length}] Processando: ${contato.nome}`);
      console.log(`   📅 Data agendada: ${contato.dataRecontato?.toLocaleDateString('pt-BR')}`);
      console.log(`   📝 Motivo: ${contato.motivoRecontato || 'Não informado'}`);
      console.log(`   📞 Telefone: ${contato.telefone}`);
      
      try {
        // Verificar se campanha ainda está ativa
        if (!contato.campanha || contato.campanha.status !== 'ATIVA') {
          console.log(`   ⚠️ Campanha não está ativa, pulando...`);
          resultado.detalhes.push({
            contatoId: contato.id,
            nome: contato.nome,
            status: 'erro',
            mensagem: 'Campanha não está ativa'
          });
          resultado.erros++;
          continue;
        }
        
        // Verificar se tem telefone válido
        if (!contato.telefone) {
          console.log(`   ⚠️ Contato sem telefone, pulando...`);
          resultado.detalhes.push({
            contatoId: contato.id,
            nome: contato.nome,
            status: 'erro',
            mensagem: 'Telefone não encontrado'
          });
          resultado.erros++;
          continue;
        }
        
        // Gerar mensagem personalizada de follow-up
        const mensagemFollowUp = gerarMensagemRecontato(contato);
        console.log(`   💬 Mensagem: ${mensagemFollowUp.substring(0, 60)}...`);
        
        // Buscar sessão ativa do tenant da campanha
        const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
          where: { 
            tenantId: contato.campanha.tenantId, 
            status: 'CONECTADO' 
          }
        });

        if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
          console.log(`   ⚠️ Nenhuma sessão WhatsApp ativa encontrada para o tenant ${contato.campanha.tenantId}, pulando...`);
          resultado.detalhes.push({
            contatoId: contato.id,
            nome: contato.nome,
            status: 'erro',
            mensagem: 'Nenhuma sessão WhatsApp ativa encontrada'
          });
          resultado.erros++;
          continue;
        }

        // Usar a instância correta do tenant
        const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
        
        // Enviar mensagem via WhatsApp
        await whatsappService.enviarMensagemTexto(contato.telefone, mensagemFollowUp);
        console.log(`   ✅ Mensagem enviada!`);
        
        // Salvar mensagem no histórico
        await prisma.mensagemProspeccao.create({
          data: {
            contatoId: contato.id,
            direcao: 'SAIDA',
            conteudo: mensagemFollowUp,
            tipo: 'TEXTO',
            telefone: contato.telefone,
            processadaPorIA: false
          }
        });
        
        // Atualizar status do contato
        await prisma.contato.update({
          where: { id: contato.id },
          data: {
            statusProspeccao: 'CONTATANDO', // Volta para contatando
            dataRecontato: null, // Limpar para não processar novamente
            tentativasContato: (contato.tentativasContato || 0) + 1,
            ultimaTentativa: new Date(),
            observacoes: `[RECONTATO ${new Date().toLocaleDateString('pt-BR')}] ${contato.motivoRecontato || ''}\n\n${contato.observacoes || ''}`
          }
        });
        
        resultado.enviados++;
        resultado.detalhes.push({
          contatoId: contato.id,
          nome: contato.nome,
          status: 'enviado'
        });
        
        // Delay entre envios para não sobrecarregar (2-5 segundos)
        const delay = 2000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error: any) {
        console.error(`   ❌ Erro: ${error.message}`);
        resultado.erros++;
        resultado.detalhes.push({
          contatoId: contato.id,
          nome: contato.nome,
          status: 'erro',
          mensagem: error.message
        });
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erro fatal no job de recontato:', error);
    throw error;
  }
  
  // Resumo final
  console.log('\n========================================');
  console.log('📊 RESUMO DO JOB DE RECONTATO');
  console.log('========================================');
  console.log(`Processados: ${resultado.processados}`);
  console.log(`Enviados:    ${resultado.enviados}`);
  console.log(`Erros:       ${resultado.erros}`);
  console.log('========================================\n');
  
  return resultado;
}

// Executar se chamado diretamente
if (require.main === module) {
  processarRecontatos()
    .then(() => {
      console.log('Job finalizado com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job falhou:', error);
      process.exit(1);
    });
}
