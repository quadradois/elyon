/**
 * Script de diagnóstico detalhado das fontes de pesquisa
 * Mostra exatamente o que cada fonte retorna
 */
import 'dotenv/config';

async function diagnosticar() {
  console.log('='.repeat(70));
  console.log('🔍 DIAGNÓSTICO DETALHADO DE FONTES - Reserva Buriti');
  console.log('='.repeat(70));

  const queries = [
    '"Reserva Buriti" Vila Rosa Goiânia preço valor',
    '"Reserva Buriti" Goiânia apartamento venda',
    'Reserva Buriti Vila Rosa preço m²',
  ];

  for (const query of queries) {
    console.log(`\n📡 Query: "${query}"`);
    console.log('-'.repeat(70));

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 15,
          gl: 'br',
          hl: 'pt-br',
        }),
      });

      const data: any = await response.json();
      const resultados = data.organic || [];

      console.log(`📊 ${resultados.length} resultados encontrados\n`);

      for (let i = 0; i < resultados.length; i++) {
        const r = resultados[i];
        const hostname = new URL(r.link).hostname;
        
        // Extrair preços do snippet
        const precosMatch = r.snippet?.match(/R\$\s*([\d.,]+)/g) || [];
        const precos = precosMatch.map((p: string) => p.replace('R$', '').trim());
        
        console.log(`${i + 1}. [${hostname}]`);
        console.log(`   Título: ${r.title?.substring(0, 60)}...`);
        console.log(`   Snippet: ${r.snippet?.substring(0, 120)}...`);
        if (precos.length > 0) {
          console.log(`   💰 Preços encontrados: ${precos.join(', ')}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(`❌ Erro: ${error}`);
    }
  }

  // Análise de preços
  console.log('\n' + '='.repeat(70));
  console.log('📊 ANÁLISE DE PREÇOS');
  console.log('='.repeat(70));
  
  console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
  console.log('Se os preços estão acima da média real de venda do prédio,');
  console.log('pode ser porque:');
  console.log('');
  console.log('1. Anúncios com preços inflados (proprietários pedindo mais)');
  console.log('2. Imóveis reformados/mobiliados (premium)');
  console.log('3. Metragens maiores sendo usadas como referência');
  console.log('4. Falta de filtro por "usados" vs "novos"');
  console.log('');
  console.log('💡 SOLUÇÃO: Adicionar query específica para preço médio real');
}

diagnosticar().then(() => process.exit(0));
