/**
 * Script para atualizar dados de imóvel nos contatos existentes
 * 
 * Busca dados do cache (CacheCpf), do imóvel vinculado ao lead,
 * e do scraper IPTU para preencher campos que estão faltando nos contatos.
 */

import { PrismaClient } from '@prisma/client';
import { scraperIPTU } from '../src/servicos/scraper-iptu';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando atualização de dados de imóvel nos contatos...\n');

  // Buscar contatos que têm IPTU mas faltam dados de unidade
  const contatos = await prisma.contato.findMany({
    where: {
      inscricaoIptu: { not: null },
      OR: [
        { nomeEdificio: null },
        { apartamento: null },
        { unidade: null },
        { box: null }
      ]
    },
    select: {
      id: true,
      nome: true,
      cpf: true,
      leadId: true,
      inscricaoIptu: true,
      tipoImovel: true,
      enderecoImovel: true,
      bairroImovel: true,
      nomeEdificio: true,
      apartamento: true,
      bloco: true,
      unidade: true,
      box: true,
      quadra: true,
      lote: true,
      valorVenal: true,
    }
  });

  console.log(`📋 Encontrados ${contatos.length} contatos para atualizar\n`);

  let atualizados = 0;
  let erros = 0;
  let pulados = 0;

  for (const contato of contatos) {
    try {
      const updates: any = {};
      let fonte = '';
      
      // 1. Primeiro tentar buscar do imóvel já salvo no banco
      if (contato.leadId) {
        const imovel = await prisma.imovel.findFirst({
          where: { leadId: contato.leadId }
        });

        if (imovel && (imovel.apartamento || imovel.nomeEdificio)) {
          fonte = 'BD';
          if (!contato.nomeEdificio && imovel.nomeEdificio) updates.nomeEdificio = imovel.nomeEdificio;
          if (!contato.apartamento && imovel.apartamento) updates.apartamento = imovel.apartamento;
          if (!contato.bloco && imovel.bloco) updates.bloco = imovel.bloco;
          if (!contato.unidade && imovel.unidade) updates.unidade = imovel.unidade;
          if (!contato.box && imovel.box) updates.box = imovel.box;
          if (!contato.quadra && imovel.quadra) updates.quadra = imovel.quadra;
          if (!contato.lote && imovel.lote) updates.lote = imovel.lote;
          if (!contato.enderecoImovel && imovel.logradouro) updates.enderecoImovel = imovel.logradouro;
          if (!contato.bairroImovel && imovel.bairro) updates.bairroImovel = imovel.bairro;
        }
      }

      // 2. Se ainda faltam dados, buscar no scraper IPTU
      if (contato.inscricaoIptu && (!contato.apartamento || !contato.nomeEdificio) && !updates.apartamento) {
        console.log(`  🔍 Buscando IPTU ${contato.inscricaoIptu}...`);
        fonte = 'SCRAPER';
        
        try {
          const dadosScraper = await scraperIPTU.consultarProprietario(contato.inscricaoIptu);
          
          if (dadosScraper.origem !== 'MOCK') {
            if (!contato.nomeEdificio && dadosScraper.nomeEdificio) updates.nomeEdificio = dadosScraper.nomeEdificio;
            if (!contato.apartamento && dadosScraper.apartamento) updates.apartamento = dadosScraper.apartamento;
            if (!contato.bloco && dadosScraper.bloco) updates.bloco = dadosScraper.bloco;
            if (!contato.unidade && dadosScraper.unidade) updates.unidade = dadosScraper.unidade;
            if (!contato.box && dadosScraper.box) updates.box = dadosScraper.box;
            if (!contato.quadra && dadosScraper.quadra) updates.quadra = dadosScraper.quadra;
            if (!contato.lote && dadosScraper.lote) updates.lote = dadosScraper.lote;
            if (dadosScraper.tipoImovel) updates.tipoImovel = dadosScraper.tipoImovel;
            
            // Também atualizar o imóvel no banco
            const imovelExistente = await prisma.imovel.findUnique({
              where: { inscricaoIptu: contato.inscricaoIptu }
            });
            
            if (imovelExistente) {
              await prisma.imovel.update({
                where: { id: imovelExistente.id },
                data: {
                  nomeEdificio: dadosScraper.nomeEdificio || imovelExistente.nomeEdificio,
                  apartamento: dadosScraper.apartamento,
                  bloco: dadosScraper.bloco,
                  unidade: dadosScraper.unidade,
                  box: dadosScraper.box,
                  quadra: dadosScraper.quadra || imovelExistente.quadra,
                  lote: dadosScraper.lote || imovelExistente.lote,
                  tipoImovel: dadosScraper.tipoImovel,
                }
              });
            }
          }
          
          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (scraperError: any) {
          console.log(`  ⚠️ Erro no scraper: ${scraperError.message}`);
        }
      }

      // 3. Aplicar atualizações se houver
      if (Object.keys(updates).length > 0) {
        await prisma.contato.update({
          where: { id: contato.id },
          data: updates
        });
        atualizados++;
        
        const apto = updates.apartamento || contato.apartamento || '-';
        const bloco = updates.bloco || contato.bloco || '-';
        const box = updates.box || contato.box || '-';
        console.log(`  ✅ [${fonte}] ${contato.nome}: Apto ${apto} | Bloco ${bloco} | Box ${box}`);
      } else {
        pulados++;
      }

    } catch (error: any) {
      erros++;
      console.error(`  ❌ Erro ao atualizar contato ${contato.id}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA ATUALIZAÇÃO');
  console.log('='.repeat(60));
  console.log(`  ✅ Atualizados: ${atualizados}`);
  console.log(`  ⏩ Pulados (sem novos dados): ${pulados}`);
  console.log(`  ❌ Erros: ${erros}`);
  console.log(`  📋 Total processados: ${contatos.length}`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
