/**
 * Script para atualizar contatos com telefones do cache Assertiva
 * Busca todos os telefones do CacheCpf e atualiza os contatos
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function atualizarContatosTelefones() {
  console.log('🔍 Buscando contatos da campanha Reserva Buriti 02...\n');
  
  const campanhaId = '7c0f2f10-974f-483e-a5e5-917862f26e2b';
  
  // Buscar todos os contatos da campanha
  const contatos = await prisma.contato.findMany({
    where: { campanhaId },
    select: {
      id: true,
      nome: true,
      cpf: true,
      telefone: true,
      telefone2: true,
      telefone3: true,
      email: true,
      email2: true,
    }
  });
  
  console.log(`📋 Total de contatos: ${contatos.length}\n`);
  
  let atualizados = 0;
  let semCache = 0;
  let jaCompletos = 0;
  
  for (const contato of contatos) {
    if (!contato.cpf) {
      console.log(`⚠️ ${contato.nome}: Sem CPF`);
      continue;
    }
    
    // Buscar no cache
    const cache = await prisma.cacheCpf.findFirst({
      where: { cpf: contato.cpf.replace(/\D/g, '') }
    });
    
    if (!cache) {
      console.log(`❌ ${contato.nome}: Sem cache para CPF ${contato.cpf}`);
      semCache++;
      continue;
    }
    
    const dados = cache.dados;
    const telefones = dados.telefones || [];
    const emails = dados.emails || [];
    
    // Verificar se já tem todos os telefones
    if (contato.telefone2 && contato.telefone3) {
      jaCompletos++;
      continue;
    }
    
    // Organizar telefones: priorizar celular com WhatsApp, depois celular, depois fixo
    const telefonesOrdenados = [...telefones].sort((a, b) => {
      // WhatsApp primeiro
      if (a.whatsapp && !b.whatsapp) return -1;
      if (!a.whatsapp && b.whatsapp) return 1;
      // Celular antes de fixo
      if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
      if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
      return 0;
    });
    
    const tel1 = telefonesOrdenados[0]?.numero || null;
    const tel2 = telefonesOrdenados[1]?.numero || null;
    const tel3 = telefonesOrdenados[2]?.numero || null;
    const temWhatsapp = telefonesOrdenados.some(t => t.whatsapp === true);
    
    const email1 = emails[0] || null;
    const email2 = emails[1] || null;
    
    // Só atualizar se tiver mais dados
    const temMaisTelefones = (tel2 && !contato.telefone2) || (tel3 && !contato.telefone3);
    const temMaisEmails = (email2 && !contato.email2);
    
    if (temMaisTelefones || temMaisEmails) {
      await prisma.contato.update({
        where: { id: contato.id },
        data: {
          telefone: tel1 || contato.telefone,
          telefone2: tel2 || contato.telefone2,
          telefone3: tel3 || contato.telefone3,
          temWhatsapp: temWhatsapp,
          email: email1 || contato.email,
          email2: email2 || contato.email2,
        }
      });
      
      console.log(`✅ ${contato.nome.substring(0, 25).padEnd(25)}: Tel: ${tel1 || '-'} | Tel2: ${tel2 || '-'} | Tel3: ${tel3 || '-'} | WhatsApp: ${temWhatsapp ? 'Sim' : 'Não'}`);
      atualizados++;
    } else {
      jaCompletos++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMO:');
  console.log(`   ✅ Atualizados: ${atualizados}`);
  console.log(`   ✔️  Já completos: ${jaCompletos}`);
  console.log(`   ❌ Sem cache: ${semCache}`);
  console.log('='.repeat(70));
  
  await prisma.$disconnect();
}

atualizarContatosTelefones().catch(console.error);
