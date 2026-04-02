const axios = require('axios');

async function testarScraperPrefeitura() {
  const IPTU = '32313702960151'; // EDIVALDO YUKISHIQUE HASHIMOTO
  const URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 TESTE SCRAPER PREFEITURA - IPTU REAL                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📍 IPTU: ${IPTU}`);
  console.log(`🌐 URL: ${URL}\n`);
  
  try {
    const params = new URLSearchParams();
    params.append('txt_nr_iptu', IPTU);
    params.append('txt_captcha', '');

    const response = await axios.post(URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201f0.asp'
      },
      responseType: 'arraybuffer'
    });

    const html = response.data.toString('latin1');
    
    console.log('============================================================');
    console.log('📄 HTML RETORNADO (trecho relevante):');
    console.log('============================================================\n');
    
    // Procurar a tabela de dados
    const tabelaMatch = html.match(/<table[^>]*>[\s\S]*?NOME[\s\S]*?<\/table>/i);
    if (tabelaMatch) {
      // Limpar HTML para visualização
      const tabelaLimpa = tabelaMatch[0]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
      console.log(tabelaLimpa);
    }
    
    console.log('\n============================================================');
    console.log('🔎 DADOS EXTRAÍDOS:');
    console.log('============================================================\n');
    
    // Extrair todos os campos possíveis
    const campos = [
      { nome: 'NOME', regex: /NOME<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'CPF/CNPJ', regex: /CPF\/CNPJ<\/td>\s*<td[^>]*>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'ENDEREÇO', regex: /ENDEREÇO<\/td>\s*<td>:<\/td>\s*<td>([\s\S]*?)<\/td>/i },
      { nome: 'INSCRIÇÃO', regex: /INSCRIÇÃO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'BAIRRO', regex: /BAIRRO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'LOGRADOURO', regex: /LOGRADOURO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'QUADRA', regex: /QUADRA<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'LOTE', regex: /LOTE<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'UNIDADE', regex: /UNIDADE<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'COMPLEMENTO', regex: /COMPLEMENTO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'ÁREA TERRENO', regex: /ÁREA\s*TERRENO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
      { nome: 'ÁREA EDIFICADA', regex: /ÁREA\s*EDIF[I]*CADA<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i },
    ];
    
    for (const campo of campos) {
      const match = html.match(campo.regex);
      if (match && match[1]) {
        const valor = match[1]
          .replace(/<br\s*\/?>/gi, ' | ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        console.log(`   ${campo.nome}: ${valor}`);
      }
    }
    
    // Salvar HTML completo para análise
    console.log('\n============================================================');
    console.log('💾 Salvando HTML completo para análise...');
    console.log('============================================================');
    
    const fs = require('fs');
    fs.writeFileSync('resposta_prefeitura.html', html);
    console.log('   Arquivo salvo: resposta_prefeitura.html');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarScraperPrefeitura();
