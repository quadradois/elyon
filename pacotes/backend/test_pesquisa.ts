/**
 * Script de teste para o pesquisador de empreendimentos v2.1
 * Usa Google Gemini (gratuito) como provedor de IA
 */
import 'dotenv/config';
import { pesquisadorEmpreendimento } from './src/servicos/pesquisador-empreendimento';

async function testar() {
  console.log('='.repeat(60));
  console.log('🧪 TESTE DO PESQUISADOR v2.1 (Google Gemini)');
  console.log('='.repeat(60));
  
  console.log('\n📋 Verificando configurações:');
  console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ OK' : '❌ FALTANDO');
  console.log('- SERPER_API_KEY:', process.env.SERPER_API_KEY ? '✅ OK' : '❌ FALTANDO');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '⚠️ OK (backup)' : '❌ FALTANDO');
  
  console.log('\n📍 Testando com campos separados:');
  console.log('-'.repeat(60));
  
  try {
    const resultado = await pesquisadorEmpreendimento.pesquisar({
      nome: 'Reserva Buriti',
      localizacao: 'Vila Rosa, Goiânia - GO',
      bairro: 'Vila Rosa',
      cidade: 'Goiânia',
      estado: 'GO',
      tipo: 'Apartamento',
    });
    
    console.log('\n✅ RESULTADO:');
    console.log('-'.repeat(60));
    console.log('Nome:', resultado.nome_empreendimento);
    console.log('Localização:', resultado.localizacao_completa);
    console.log('Provedor IA:', (resultado as any).provedor_ia || 'N/A');
    console.log('Confiabilidade:', (resultado.confiabilidade * 100).toFixed(0) + '%');
    console.log('Fontes consultadas:', resultado.fontes_consultadas?.length || 0);
    
    // Mostrar preços encontrados (novo!)
    if ((resultado as any).precos_encontrados?.length > 0) {
      console.log('\n💵 Preços Encontrados:');
      for (const p of (resultado as any).precos_encontrados) {
        console.log(`   - R$ ${p.valor?.toLocaleString('pt-BR')} (${p.fonte}) ${p.metragem || ''}`);
      }
    }
    
    if (resultado.faixa_preco) {
      console.log('\n💰 Faixa de Preço:');
      console.log(`   Min: R$ ${resultado.faixa_preco.min?.toLocaleString('pt-BR') || 0}`);
      console.log(`   Max: R$ ${resultado.faixa_preco.max?.toLocaleString('pt-BR') || 0}`);
      console.log(`   Fonte: ${resultado.faixa_preco.fonte || 'N/A'}`);
    }
    
    // Mostrar metragens (novo!)
    if ((resultado as any).metragens?.length > 0) {
      console.log('\n📐 Metragens:');
      for (const m of (resultado as any).metragens) {
        console.log(`   - ${m.area}: R$ ${m.preco_medio?.toLocaleString('pt-BR') || 'N/A'} médio`);
      }
    }
    
    // Mostrar localização detalhada (novo!)
    if ((resultado as any).localizacao_detalhes) {
      const loc = (resultado as any).localizacao_detalhes;
      console.log('\n📍 Localização Detalhada:');
      console.log(`   Bairro: ${loc.bairro} (${loc.caracteristica_bairro})`);
      console.log(`   Região: ${loc.regiao_cidade}`);
      if (loc.vias_acesso?.length > 0) {
        console.log(`   Vias de acesso: ${loc.vias_acesso.join(', ')}`);
      }
      if (loc.pontos_referencia?.length > 0) {
        console.log(`   Referências: ${loc.pontos_referencia.join(', ')}`);
      }
      if (loc.proximidades) {
        console.log('   Proximidades:');
        for (const [tipo, locais] of Object.entries(loc.proximidades)) {
          if (Array.isArray(locais) && locais.length > 0) {
            console.log(`     - ${tipo}: ${locais.join(', ')}`);
          }
        }
      }
    }
    
    // Mostrar dados do condomínio (novo!)
    if ((resultado as any).condominio) {
      const cond = (resultado as any).condominio;
      console.log('\n🏢 Condomínio:');
      if (cond.valor_estimado) console.log(`   Valor estimado: R$ ${cond.valor_estimado}/mês`);
      if (cond.areas_lazer?.length > 0) {
        console.log(`   Lazer: ${cond.areas_lazer.join(', ')}`);
      }
      if (cond.seguranca?.length > 0) {
        console.log(`   Segurança: ${cond.seguranca.join(', ')}`);
      }
      if (cond.vagas_garagem) console.log(`   Garagem: ${cond.vagas_garagem}`);
      if (cond.torres) console.log(`   Torres: ${cond.torres}, Andares: ${cond.andares || 'N/A'}`);
    }

    console.log('\n📝 Resumo SDR:');
    console.log(resultado.resumo_sdr?.substring(0, 500) || 'Sem resumo');
    
    if (resultado.alertas?.length > 0) {
      console.log('\n⚠️ Alertas:');
      resultado.alertas.forEach(a => console.log(`   - ${a}`));
    }
    
    // Verificar dados do ZAP
    if ((resultado as any).dados_zap_m2) {
      console.log('\n📊 Dados do ZAP Imóveis:');
      console.log(JSON.stringify((resultado as any).dados_zap_m2, null, 2));
    }
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  }
}

testar().then(() => process.exit(0));
