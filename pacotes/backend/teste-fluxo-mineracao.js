/**
 * TESTE DE FUNCIONAMENTO DO FLUXO DE MINERAÇÃO
 * Teste isolado que não depende de outros arquivos
 * @ts-nocheck
 */

const axios = require('axios');

// URLs das APIs
const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const PREFEITURA_URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';

// Cores para console
const verde = '\x1b[32m';
const vermelho = '\x1b[31m';
const amarelo = '\x1b[33m';
const azul = '\x1b[36m';
const reset = '\x1b[0m';

function ok(msg) { console.log(`${verde}✅ ${msg}${reset}`); }
function erro(msg) { console.log(`${vermelho}❌ ${msg}${reset}`); }
function aviso(msg) { console.log(`${amarelo}⚠️  ${msg}${reset}`); }
function info(msg) { console.log(`${azul}ℹ️  ${msg}${reset}`); }
function titulo(msg) { console.log(`\n${azul}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${reset}`); }

const resultados = [];

// =============================================
// ETAPA 1: TESTE API MAPA GOIÂNIA
// =============================================
async function testarEtapa1_MapaGoiania() {
  titulo('ETAPA 1: API MAPA GOIÂNIA (Buscar Edifícios)');
  
  try {
    // Teste 1.1: Buscar edifícios por nome
    info('Testando busca por nome de edifício "RESERVA"...');
    
    const response = await axios.get(MAPA_API_URL, {
      params: {
        where: "nmedificio LIKE '%RESERVA%'",
        outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou,incompl',
        resultRecordCount: 5,
        returnGeometry: false,
        f: 'json'
      },
      timeout: 15000
    });
    
    if (response.data.error) {
      erro(`API retornou erro: ${response.data.error.message}`);
      resultados.push({ etapa: '1.1 Busca edifícios', status: 'FALHA', msg: response.data.error.message });
      return null;
    }
    
    const features = response.data.features || [];
    
    if (features.length > 0) {
      ok(`API Mapa funcionando! ${features.length} edifícios encontrados`);
      console.log('\n   Exemplos encontrados:');
      features.slice(0, 3).forEach(f => {
        const a = f.attributes;
        console.log(`   - ${a.nmedificio || 'N/A'}`);
        console.log(`     IPTU: ${a.nrinscr} | ${a.nmbairro}`);
      });
      resultados.push({ etapa: '1.1 Busca edifícios', status: 'OK', msg: `${features.length} encontrados` });
      return features;
    } else {
      aviso('API respondeu mas sem resultados');
      resultados.push({ etapa: '1.1 Busca edifícios', status: 'PARCIAL', msg: 'Sem resultados' });
      return null;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      erro('API Mapa Goiânia está OFFLINE ou bloqueada!');
      resultados.push({ etapa: '1.1 Busca edifícios', status: 'FALHA', msg: 'API offline' });
    } else {
      erro(`Erro na API Mapa: ${error.message}`);
      resultados.push({ etapa: '1.1 Busca edifícios', status: 'FALHA', msg: error.message });
    }
    return null;
  }
}

// =============================================
// ETAPA 2: TESTE BUSCA DE UNIDADES (IPTU)
// =============================================
async function testarEtapa2_BuscarIPTU(features) {
  titulo('ETAPA 2: BUSCAR UNIDADES E NÚMEROS DE IPTU');
  
  // Dados de fallback caso API não retorne
  const fallbackIPTUs = [
    { nrinscr: '32313702960010', nmedificio: 'RESERVA BURITI', incompl: 'APTO 101', nmbairro: 'SETOR PEDRO LUDOVICO' },
    { nrinscr: '32313702960011', nmedificio: 'RESERVA BURITI', incompl: 'APTO 102', nmbairro: 'SETOR PEDRO LUDOVICO' },
    { nrinscr: '32313702960012', nmedificio: 'RESERVA BURITI', incompl: 'APTO 103', nmbairro: 'SETOR PEDRO LUDOVICO' },
  ];
  
  if (features && features.length > 0) {
    ok('Usando dados REAIS da API do Mapa');
    const unidades = features.map(f => f.attributes);
    console.log('\n   IPTUs obtidos da API:');
    unidades.slice(0, 5).forEach(u => {
      console.log(`   - IPTU: ${u.nrinscr}`);
      console.log(`     ${u.nmedificio || 'Casa'} | ${u.incompl || 'N/A'} | ${u.nmbairro}`);
    });
    resultados.push({ etapa: '2 Obter IPTU', status: 'OK', msg: `${unidades.length} IPTUs reais` });
    return unidades;
  } else {
    aviso('API Mapa indisponível. Usando dados de FALLBACK para continuar teste.');
    console.log('\n   IPTUs de fallback:');
    fallbackIPTUs.forEach(u => {
      console.log(`   - IPTU: ${u.nrinscr}`);
      console.log(`     ${u.nmedificio} | ${u.incompl} | ${u.nmbairro}`);
    });
    resultados.push({ etapa: '2 Obter IPTU', status: 'PARCIAL', msg: 'Usando fallback' });
    return fallbackIPTUs;
  }
}

// =============================================
// ETAPA 3: TESTE SCRAPER PREFEITURA (CPF)
// =============================================
async function testarEtapa3_ScraperPrefeitura(unidades) {
  titulo('ETAPA 3: SCRAPER PREFEITURA (IPTU → CPF)');
  
  const iptuTeste = unidades[0].nrinscr;
  info(`Consultando CPF para IPTU: ${iptuTeste}`);
  
  try {
    // Tentar consultar a prefeitura
    const params = new URLSearchParams();
    params.append('txt_nr_iptu', iptuTeste);
    params.append('txt_captcha', '');
    
    const response = await axios.post(PREFEITURA_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201f0.asp'
      },
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    // Decodificar resposta
    const html = response.data.toString('latin1');
    
    // Tentar extrair dados via regex
    const nomeMatch = html.match(/NOME<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    const cpfMatch = html.match(/CPF\/CNPJ<\/td>\s*<td[^>]*>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    
    if (nomeMatch && nomeMatch[1] && nomeMatch[1].trim().length > 0) {
      const nome = nomeMatch[1].trim();
      const cpf = cpfMatch ? cpfMatch[1].trim() : 'N/A';
      
      ok('Scraper da prefeitura funcionando! Dados REAIS obtidos.');
      console.log('\n   Dados do proprietário:');
      console.log(`   - Nome: ${nome}`);
      console.log(`   - CPF: ${cpf}`);
      resultados.push({ etapa: '3 Descobrir CPF', status: 'OK', msg: 'Dados reais da prefeitura' });
      return { nome, cpf, origem: 'SCRAPER_WEB' };
      
    } else {
      // Verificar se tem CAPTCHA ou outro bloqueio
      if (html.includes('captcha') || html.includes('CAPTCHA')) {
        aviso('Prefeitura exigindo CAPTCHA!');
        resultados.push({ etapa: '3 Descobrir CPF', status: 'PARCIAL', msg: 'CAPTCHA exigido' });
      } else if (html.includes('não encontrado') || html.includes('Não encontrado')) {
        aviso('IPTU não encontrado na base da prefeitura');
        resultados.push({ etapa: '3 Descobrir CPF', status: 'PARCIAL', msg: 'IPTU não encontrado' });
      } else {
        aviso('Formato do HTML mudou ou dados não localizados');
        resultados.push({ etapa: '3 Descobrir CPF', status: 'PARCIAL', msg: 'Formato HTML alterado' });
      }
      
      // Usar dados mockados
      info('Gerando dados de MOCK para continuar teste...');
      const mockData = gerarMockProprietario(iptuTeste);
      console.log('\n   Dados MOCKADOS:');
      console.log(`   - Nome: ${mockData.nome}`);
      console.log(`   - CPF: ${mockData.cpf}`);
      return mockData;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      erro('Site da prefeitura OFFLINE ou bloqueado!');
      resultados.push({ etapa: '3 Descobrir CPF', status: 'FALHA', msg: 'Prefeitura offline' });
    } else {
      erro(`Erro no scraper: ${error.message}`);
      resultados.push({ etapa: '3 Descobrir CPF', status: 'FALHA', msg: error.message });
    }
    
    // Usar mock
    info('Gerando dados de MOCK...');
    return gerarMockProprietario(iptuTeste);
  }
}

function gerarMockProprietario(iptu) {
  const nomes = ['Carlos Silva', 'Maria Santos', 'João Oliveira', 'Ana Costa', 'Pedro Lima'];
  const hash = iptu.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const nome = nomes[hash % nomes.length];
  const cpf = `${String(hash % 999).padStart(3, '0')}.${String((hash * 2) % 999).padStart(3, '0')}.${String((hash * 3) % 999).padStart(3, '0')}-${String(hash % 99).padStart(2, '0')}`;
  return { nome, cpf, origem: 'MOCK' };
}

// =============================================
// ETAPA 4: TESTE ASSERTIVA (ENRIQUECIMENTO)
// =============================================
async function testarEtapa4_Assertiva(proprietario) {
  titulo('ETAPA 4: ASSERTIVA (CPF → CONTATOS)');
  
  info(`Enriquecendo CPF: ${proprietario.cpf}`);
  info(`Nome: ${proprietario.nome}`);
  
  // Verificar se tem credenciais configuradas
  const clientId = process.env.ASSERTIVA_CLIENT_ID;
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    aviso('Credenciais da Assertiva NÃO configuradas!');
    console.log('\n   Variáveis de ambiente necessárias:');
    console.log('   - ASSERTIVA_CLIENT_ID');
    console.log('   - ASSERTIVA_CLIENT_SECRET');
    resultados.push({ etapa: '4 Assertiva', status: 'PARCIAL', msg: 'Sem credenciais' });
    
    // Gerar mock
    const mockContatos = gerarMockContatos(proprietario);
    console.log('\n   Dados MOCKADOS de contato:');
    console.log(`   - Telefones: ${mockContatos.telefones.length}`);
    mockContatos.telefones.forEach(t => console.log(`     • ${t.numero} (${t.tipo}) ${t.whatsapp ? '📱' : ''}`));
    console.log(`   - Emails: ${mockContatos.emails.length}`);
    mockContatos.emails.forEach(e => console.log(`     • ${e}`));
    console.log(`   - Renda: ${mockContatos.faixaSalarial}`);
    return mockContatos;
  }
  
  try {
    // Tentar autenticar na Assertiva
    info('Tentando autenticar na API Assertiva...');
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await axios.post(
      'https://api.assertivasolucoes.com.br/oauth2/v3/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    
    const token = tokenResponse.data.access_token;
    ok('Autenticação Assertiva OK!');
    
    // Consultar CPF
    info('Consultando CPF na Assertiva...');
    const cpfLimpo = proprietario.cpf.replace(/\D/g, '');
    
    const response = await axios.get('https://api.assertivasolucoes.com.br/localize/v3/cpf', {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { cpf: cpfLimpo, idFinalidade: 1 },
      timeout: 15000
    });
    
    const dados = response.data.resposta;
    ok('Consulta Assertiva realizada com sucesso!');
    
    console.log('\n   Dados REAIS da Assertiva:');
    console.log(`   - Nome: ${dados.dadosCadastrais?.nome || 'N/A'}`);
    console.log(`   - Telefones: ${dados.telefones?.moveis?.length || 0} celulares, ${dados.telefones?.fixos?.length || 0} fixos`);
    console.log(`   - Emails: ${dados.emails?.length || 0}`);
    
    resultados.push({ etapa: '4 Assertiva', status: 'OK', msg: 'Dados reais obtidos' });
    return dados;
    
  } catch (error) {
    if (error.response?.status === 401) {
      erro('Credenciais da Assertiva inválidas!');
      resultados.push({ etapa: '4 Assertiva', status: 'FALHA', msg: 'Credenciais inválidas' });
    } else if (error.response?.status === 403) {
      erro('Sem permissão ou créditos esgotados na Assertiva!');
      resultados.push({ etapa: '4 Assertiva', status: 'FALHA', msg: 'Sem permissão/créditos' });
    } else {
      erro(`Erro na Assertiva: ${error.message}`);
      resultados.push({ etapa: '4 Assertiva', status: 'FALHA', msg: error.message });
    }
    
    return gerarMockContatos(proprietario);
  }
}

function gerarMockContatos(proprietario) {
  const hash = proprietario.cpf.replace(/\D/g, '').slice(-2);
  return {
    nome: proprietario.nome,
    telefones: [
      { numero: `629${Math.random().toString().slice(2, 10)}`, tipo: 'CELULAR', whatsapp: true },
      { numero: `623${Math.random().toString().slice(2, 9)}`, tipo: 'FIXO', whatsapp: false },
    ],
    emails: [
      `${proprietario.nome.split(' ')[0].toLowerCase()}@gmail.com`,
    ],
    idade: 30 + parseInt(hash),
    faixaSalarial: 'De 3 a 5 Salários Mínimos',
    profissao: 'Empresário',
  };
}

// =============================================
// RELATÓRIO FINAL
// =============================================
function gerarRelatorioFinal() {
  titulo('📊 RELATÓRIO FINAL - ANÁLISE DE FUNCIONAMENTO');
  
  console.log('\n');
  
  let totalOk = 0;
  let totalParcial = 0;
  let totalFalha = 0;
  
  resultados.forEach(r => {
    let icone = '';
    let cor = '';
    if (r.status === 'OK') { icone = '✅'; cor = verde; totalOk++; }
    else if (r.status === 'PARCIAL') { icone = '⚠️'; cor = amarelo; totalParcial++; }
    else { icone = '❌'; cor = vermelho; totalFalha++; }
    
    console.log(`${cor}${icone} ${r.etapa}${reset}`);
    console.log(`   ${r.msg}\n`);
  });
  
  console.log('='.repeat(60));
  console.log('\n📈 ESTATÍSTICAS:\n');
  console.log(`   ${verde}✅ Funcionando: ${totalOk}${reset}`);
  console.log(`   ${amarelo}⚠️  Parcial/Mock: ${totalParcial}${reset}`);
  console.log(`   ${vermelho}❌ Falha: ${totalFalha}${reset}`);
  
  const total = totalOk + totalParcial + totalFalha;
  const nota = total > 0 ? Math.round(((totalOk * 100) + (totalParcial * 50)) / total) : 0;
  
  console.log(`\n🎯 NOTA GERAL DO SISTEMA: ${nota}%\n`);
  
  if (nota >= 80) {
    console.log(`${verde}✨ Sistema funcionando muito bem!${reset}`);
  } else if (nota >= 50) {
    console.log(`${amarelo}⚡ Sistema funcionando parcialmente.${reset}`);
    console.log('   Algumas integrações estão usando fallback/mock.');
  } else {
    console.log(`${vermelho}🔥 Sistema com problemas críticos!${reset}`);
    console.log('   Verifique as etapas com falha acima.');
  }
  
  // Diagnóstico específico
  console.log('\n\n📋 DIAGNÓSTICO DETALHADO:\n');
  
  resultados.forEach(r => {
    if (r.status !== 'OK') {
      console.log(`${amarelo}→ ${r.etapa}:${reset}`);
      if (r.etapa.includes('Mapa') || r.etapa.includes('edifícios')) {
        console.log('  A API do Mapa Goiânia pode estar:');
        console.log('  - Fora do ar temporariamente');
        console.log('  - Bloqueando requisições (rate limit)');
        console.log('  - Com mudança de endpoint');
      }
      if (r.etapa.includes('CPF') || r.etapa.includes('Prefeitura')) {
        console.log('  O scraper da prefeitura pode estar:');
        console.log('  - Exigindo CAPTCHA');
        console.log('  - Com formato de HTML alterado');
        console.log('  - Fora do ar');
        console.log('  ⚠️  IMPACTO: Sistema usa dados mockados!');
      }
      if (r.etapa.includes('Assertiva')) {
        console.log('  A API Assertiva precisa:');
        console.log('  - ASSERTIVA_CLIENT_ID configurado');
        console.log('  - ASSERTIVA_CLIENT_SECRET configurado');
        console.log('  - Créditos disponíveis na conta');
      }
      console.log('');
    }
  });
  
  console.log('='.repeat(60));
}

// =============================================
// EXECUTAR TESTES
// =============================================
async function executarTestes() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 ANÁLISE DE FUNCIONAMENTO - MINERAÇÃO ELYON          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Este teste verifica se cada etapa do fluxo está          ║');
  console.log('║  funcionando conforme a proposta:                          ║');
  console.log('║                                                            ║');
  console.log('║  1️⃣  API Mapa Goiânia → Buscar edifícios/imóveis          ║');
  console.log('║  2️⃣  Obter número do IPTU das unidades                    ║');
  console.log('║  3️⃣  Scraper Prefeitura → Descobrir CPF via IPTU          ║');
  console.log('║  4️⃣  API Assertiva → Buscar contatos via CPF              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Executar cada etapa
  const features = await testarEtapa1_MapaGoiania();
  const unidades = await testarEtapa2_BuscarIPTU(features);
  const proprietario = await testarEtapa3_ScraperPrefeitura(unidades);
  await testarEtapa4_Assertiva(proprietario);
  
  // Gerar relatório
  gerarRelatorioFinal();
}

// Iniciar
executarTestes().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
