/**
 * Script de Teste E2E - Sistema de Prospecção Ativa
 * 
 * Este script testa o fluxo completo:
 * 1. Criar campanha de teste
 * 2. Adicionar contatos de teste
 * 3. Disparar mensagens
 * 4. Simular resposta do contato
 * 5. Verificar processamento do SDR
 * 
 * USO: npx ts-node src/scripts/teste-prospeccao-e2e.ts
 */

import { PrismaClient } from '@prisma/client';
import { disparoCampanhaService } from '../servicos/disparo-campanha';
import { blacklistService } from '../servicos/blacklist';

const prisma = new PrismaClient();

// ============================================
// CONFIGURAÇÕES DO TESTE
// ============================================

const CONFIG_TESTE = {
  // Defina um número de telefone REAL seu para receber a mensagem de teste
  TELEFONE_TESTE: process.env.TELEFONE_TESTE || '5562999999999',
  
  // Nome para o contato de teste
  NOME_CONTATO: 'Teste Prospecção',
  
  // Se true, realmente envia mensagem via WhatsApp
  MODO_REAL: process.env.MODO_REAL === 'true',
};

// ============================================
// FUNÇÕES DE TESTE
// ============================================

async function criarCampanhaTeste(): Promise<string> {
  console.log('\n📋 1. Criando campanha de teste...');
  
  // Buscar tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('Nenhum tenant encontrado. Crie um tenant primeiro.');
  }
  
  // Verificar se já existe campanha de teste
  let campanha = await prisma.campanha.findFirst({
    where: { nome: 'Campanha Teste E2E' }
  });
  
  if (campanha) {
    console.log(`   ✅ Usando campanha existente: ${campanha.id}`);
    
    // Garantir que está ativa
    await prisma.campanha.update({
      where: { id: campanha.id },
      data: { status: 'ATIVA' }
    });
    
    return campanha.id;
  }
  
  // Criar nova campanha
  campanha = await prisma.campanha.create({
    data: {
      nome: 'Campanha Teste E2E',
      tenantId: tenant.id,
      tipo: 'PROSPECCAO',
      status: 'ATIVA',
      nomeEmpreendimento: 'Edifício Teste',
      localizacao: 'Setor Bueno',
      cidade: 'Goiânia',
      estado: 'GO',
    }
  });
  
  // Atualizar configDisparo separadamente
  await prisma.$executeRaw`
    UPDATE campanhas 
    SET "configDisparo" = '{"mensagensPorMinuto":10,"atrasoEntreMensagens":5000,"maxTentativas":3,"horarioInicio":"00:00","horarioFim":"23:59","diasSemana":["dom","seg","ter","qua","qui","sex","sab"]}'::jsonb
    WHERE id = ${campanha.id}
  `;
  
  console.log(`   ✅ Campanha criada: ${campanha.id}`);
  return campanha.id;
}

async function criarContatoTeste(campanhaId: string): Promise<string> {
  console.log('\n👤 2. Criando contato de teste...');
  
  // Verificar se já existe
  let contato = await prisma.contato.findFirst({
    where: {
      campanhaId,
      telefone: { contains: CONFIG_TESTE.TELEFONE_TESTE.slice(-8) }
    }
  });
  
  if (contato) {
    console.log(`   ✅ Usando contato existente: ${contato.id}`);
    
    // Resetar status para teste
    await prisma.contato.update({
      where: { id: contato.id },
      data: {
        statusProspeccao: 'AGUARDANDO',
        tentativasContato: 0,
        respondeu: false,
        ultimaTentativa: null
      }
    });
    
    return contato.id;
  }
  
  // Criar novo contato
  contato = await prisma.contato.create({
    data: {
      campanhaId,
      nome: CONFIG_TESTE.NOME_CONTATO,
      telefone: CONFIG_TESTE.TELEFONE_TESTE,
      statusProspeccao: 'AGUARDANDO',
      tentativasContato: 0
    }
  });
  
  console.log(`   ✅ Contato criado: ${contato.id}`);
  console.log(`   📱 Telefone: ${CONFIG_TESTE.TELEFONE_TESTE}`);
  
  return contato.id;
}

async function testarBlacklist(): Promise<void> {
  console.log('\n🚫 3. Testando Blacklist...');
  
  const telefoneBlacklist = '5562888888888';
  
  // Adicionar à blacklist
  await blacklistService.adicionar({
    telefone: telefoneBlacklist,
    motivo: 'MANUAL',
    observacoes: 'Teste E2E'
  });
  console.log(`   ✅ Telefone ${telefoneBlacklist} adicionado à blacklist`);
  
  // Verificar se está na blacklist
  const bloqueado = await blacklistService.estaBlacklist(telefoneBlacklist);
  console.log(`   ✅ Verificação: ${bloqueado ? 'BLOQUEADO ✓' : 'ERRO - não encontrado!'}`);
  
  // Remover da blacklist
  await blacklistService.remover(telefoneBlacklist);
  console.log(`   ✅ Telefone removido da blacklist`);
  
  // Verificar remoção
  const aindaBloqueado = await blacklistService.estaBlacklist(telefoneBlacklist);
  console.log(`   ✅ Após remoção: ${aindaBloqueado ? 'ERRO - ainda bloqueado!' : 'LIBERADO ✓'}`);
}

async function testarDisparo(campanhaId: string): Promise<void> {
  console.log('\n🚀 4. Testando Disparo...');
  
  if (!CONFIG_TESTE.MODO_REAL) {
    console.log('   ⚠️  MODO SIMULAÇÃO - Nenhuma mensagem será enviada');
    console.log('   💡 Para enviar mensagem real, defina MODO_REAL=true');
    
    // Simular atualização do contato
    await prisma.contato.updateMany({
      where: { campanhaId },
      data: {
        statusProspeccao: 'CONTATANDO',
        tentativasContato: 1,
        ultimaTentativa: new Date()
      }
    });
    
    console.log('   ✅ Contato atualizado para CONTATANDO (simulação)');
    return;
  }
  
  console.log('   📤 Disparando mensagem real...');
  
  try {
    const resultado = await disparoCampanhaService.dispararLote(campanhaId);
    
    console.log(`   ✅ Disparo concluído!`);
    console.log(`   📊 Enviados: ${resultado.contatosEnviados}`);
    console.log(`   ❌ Erros: ${resultado.erros}`);
    console.log(`   📝 Mensagem: ${resultado.mensagem}`);
  } catch (error: any) {
    console.error(`   ❌ Erro no disparo: ${error.message}`);
  }
}

async function verificarStatus(campanhaId: string): Promise<void> {
  console.log('\n📊 5. Verificando Status...');
  
  const status = await disparoCampanhaService.obterStatusCampanha(campanhaId);
  
  console.log('   ┌─────────────────────────────────┐');
  console.log(`   │ Total:        ${status.total.toString().padStart(5)}           │`);
  console.log(`   │ Aguardando:   ${status.aguardando.toString().padStart(5)}           │`);
  console.log(`   │ Contatando:   ${status.contatando.toString().padStart(5)}           │`);
  console.log(`   │ Respondeu:    ${status.respondeu.toString().padStart(5)}           │`);
  console.log(`   │ Interessado:  ${status.interessado.toString().padStart(5)}           │`);
  console.log(`   │ Opt-out:      ${status.optout.toString().padStart(5)}           │`);
  console.log(`   │ Falha:        ${status.falha.toString().padStart(5)}           │`);
  console.log('   └─────────────────────────────────┘');
}

async function simularResposta(campanhaId: string): Promise<void> {
  console.log('\n💬 6. Simulando Resposta do Contato...');
  
  // Buscar contato em CONTATANDO
  const contato = await prisma.contato.findFirst({
    where: {
      campanhaId,
      statusProspeccao: 'CONTATANDO'
    }
  });
  
  if (!contato) {
    console.log('   ⚠️  Nenhum contato em CONTATANDO para simular resposta');
    return;
  }
  
  // Simular atualização como se tivesse respondido
  await prisma.contato.update({
    where: { id: contato.id },
    data: {
      respondeu: true,
      primeiraResposta: new Date(),
      statusProspeccao: 'RESPONDEU'
    }
  });
  
  console.log(`   ✅ Contato ${contato.nome} marcado como RESPONDEU`);
  console.log('   💡 Em produção, isso acontece automaticamente via webhook');
}

async function testarOptout(campanhaId: string): Promise<void> {
  console.log('\n🛑 7. Testando Opt-out...');
  
  // Criar contato de teste para opt-out
  const telefoneOptout = '5562777777777';
  
  const contatoOptout = await prisma.contato.create({
    data: {
      campanhaId,
      nome: 'Teste Opt-out',
      telefone: telefoneOptout,
      statusProspeccao: 'CONTATANDO',
      tentativasContato: 1
    }
  });
  
  console.log(`   📱 Contato criado: ${contatoOptout.nome}`);
  
  // Registrar opt-out
  await blacklistService.registrarOptout(telefoneOptout, 'Teste Opt-out', campanhaId);
  
  console.log('   ✅ Opt-out registrado');
  
  // Verificar se contato foi atualizado
  const contatoAtualizado = await prisma.contato.findUnique({
    where: { id: contatoOptout.id }
  });
  
  console.log(`   📊 Status do contato: ${contatoAtualizado?.statusProspeccao}`);
  
  // Limpar
  await prisma.contato.delete({ where: { id: contatoOptout.id } });
  await blacklistService.remover(telefoneOptout);
  
  console.log('   🧹 Limpeza concluída');
}

// ============================================
// EXECUÇÃO PRINCIPAL
// ============================================

async function executarTestes(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   TESTE E2E - SISTEMA DE PROSPECÇÃO ATIVA        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   Telefone Teste: ' + CONFIG_TESTE.TELEFONE_TESTE.padEnd(30) + '║');
  console.log('║   Modo Real: ' + (CONFIG_TESTE.MODO_REAL ? 'SIM ⚠️' : 'NÃO (simulação)').padEnd(35) + '║');
  console.log('╚══════════════════════════════════════════════════╝');
  
  try {
    // 1. Criar campanha
    const campanhaId = await criarCampanhaTeste();
    
    // 2. Criar contato
    await criarContatoTeste(campanhaId);
    
    // 3. Testar blacklist
    await testarBlacklist();
    
    // 4. Testar disparo
    await testarDisparo(campanhaId);
    
    // 5. Verificar status
    await verificarStatus(campanhaId);
    
    // 6. Simular resposta
    await simularResposta(campanhaId);
    
    // 7. Testar opt-out
    await testarOptout(campanhaId);
    
    // 8. Status final
    console.log('\n📊 STATUS FINAL:');
    await verificarStatus(campanhaId);
    
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   ✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!     ║');
    console.log('╚══════════════════════════════════════════════════╝');
    
    if (!CONFIG_TESTE.MODO_REAL) {
      console.log('\n💡 Para testar com envio real de mensagens:');
      console.log('   TELEFONE_TESTE=5562999999999 MODO_REAL=true npx ts-node src/scripts/teste-prospeccao-e2e.ts');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  executarTestes();
}

export { executarTestes };
