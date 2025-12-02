const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Função para parsear o endereço da Prefeitura
function parsearEnderecoPrefeitura(endereco) {
  const resultado = {};
  
  if (!endereco) return resultado;
  
  // Extrair BOX
  const boxMatch = endereco.match(/BOX[:\s]*(\d+[A-Z]?)/i);
  if (boxMatch) resultado.box = boxMatch[1].trim();
  
  // Extrair Quadra
  const quadraMatch = endereco.match(/QD[:\s]*([^\s]+)/i);
  if (quadraMatch) resultado.quadra = quadraMatch[1].trim();
  
  // Extrair Lote
  const loteMatch = endereco.match(/LT[:\s]*([^\s]+)/i);
  if (loteMatch) resultado.lote = loteMatch[1].trim();
  
  // Extrair Edifício
  const edificioMatch = endereco.match(/ED\s+(.+?)(?:\s+BOX|\s*$)/i);
  if (edificioMatch) resultado.nomeEdificio = edificioMatch[1].trim();
  
  // Extrair Apartamento e Bloco (formato: APTO806BL.B ou APT 806 BL B)
  const aptoMatch = endereco.match(/APT[O]?\s*(\d+)\s*(?:BL[.\s]*([A-Z0-9]+))?/i);
  if (aptoMatch) {
    resultado.apartamento = aptoMatch[1];
    if (aptoMatch[2]) resultado.bloco = aptoMatch[2];
    resultado.unidade = `APTO ${aptoMatch[1]}${aptoMatch[2] ? ' BL.' + aptoMatch[2] : ''}`;
  }
  
  return resultado;
}

async function buscarDadosPrefeitura(iptu) {
  const URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';
  
  try {
    const params = new URLSearchParams();
    params.append('txt_nr_iptu', iptu);
    params.append('txt_captcha', '');

    const response = await axios.post(URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201f0.asp'
      },
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const html = response.data.toString('latin1');
    
    const enderecoMatch = html.match(/ENDEREÇO<\/td>\s*<td>:<\/td>\s*<td>([\s\S]*?)<\/td>/i);
    if (enderecoMatch) {
      const endereco = enderecoMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return parsearEnderecoPrefeitura(endereco);
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Erro ao buscar IPTU ${iptu}: ${error.message}`);
    return null;
  }
}

async function atualizarContatosCampanha() {
  const prisma = new PrismaClient();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🔄 ATUALIZAR CONTATOS COM DADOS DA PREFEITURA             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Buscar contatos da campanha Reserva Buriti que tem IPTU
    const contatos = await prisma.contato.findMany({
      where: {
        campanha: {
          nome: { contains: 'Buriti', mode: 'insensitive' }
        },
        inscricaoIptu: { not: null }
      }
    });
    
    console.log(`📊 Total de contatos a atualizar: ${contatos.length}\n`);
    
    let atualizados = 0;
    let erros = 0;
    
    for (const contato of contatos) {
      process.stdout.write(`   Buscando IPTU ${contato.inscricaoIptu}... `);
      
      const dados = await buscarDadosPrefeitura(contato.inscricaoIptu);
      
      if (dados && (dados.apartamento || dados.box)) {
        await prisma.contato.update({
          where: { id: contato.id },
          data: {
            apartamento: dados.apartamento,
            bloco: dados.bloco,
            unidade: dados.unidade,
            box: dados.box,
            quadra: dados.quadra,
            lote: dados.lote,
            nomeEdificio: dados.nomeEdificio
          }
        });
        
        console.log(`✅ Apto: ${dados.apartamento || '-'} | Bloco: ${dados.bloco || '-'} | Box: ${dados.box || '-'}`);
        atualizados++;
      } else {
        console.log('⚠️  Sem dados de unidade');
        erros++;
      }
      
      // Delay para não sobrecarregar o servidor da prefeitura
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n============================================================');
    console.log('📊 RESUMO');
    console.log('============================================================');
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ⚠️  Sem dados: ${erros}`);
    console.log('\n✅ Atualização concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

atualizarContatosCampanha();
