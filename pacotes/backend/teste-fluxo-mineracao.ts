/**
 * TESTE DE FUNCIONAMENTO DO FLUXO DE MINERAÇÃO
 * 
 * Este script testa cada etapa do processo interno para verificar
 * se está funcionando conforme a proposta.
 * 
 * @ts-nocheck
 */

// Importações diretas para evitar erros de compilação de outros arquivos
import axios from 'axios';

// Simular os serviços inline para teste isolado
const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const PREFEITURA_URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';

// Cores para console
const verde = '\x1b[32m';
const vermelho = '\x1b[31m';
const amarelo = '\x1b[33m';
const azul = '\x1b[36m';
const reset = '\x1b[0m';

function ok(msg: string) { console.log(`${verde}✅ ${msg}${reset}`); }
function erro(msg: string) { console.log(`${vermelho}❌ ${msg}${reset}`); }
function aviso(msg: string) { console.log(`${amarelo}⚠️  ${msg}${reset}`); }
function info(msg: string) { console.log(`${azul}ℹ️  ${msg}${reset}`); }
function titulo(msg: string) { console.log(`\n${azul}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${reset}`); }

interface ResultadoTeste {
  etapa: string;
  status: 'OK' | 'FALHA' | 'PARCIAL';
  mensagem: string;
  dados?: any;
}

const resultados: ResultadoTeste[] = [];

async function testarEtapa1_BuscarEdificios() {
  titulo('ETAPA 1: BUSCAR EDIFÍCIOS/IMÓVEIS');
  
  try {
    // Teste 1.1: Buscar por nome de edifício
    info('Testando busca por nome "RESERVA"...');
    const edificios = await mapaService.buscarEdificiosPorNome('RESERVA', 5);
    
    if (edificios.length > 0) {
      ok(`Busca por nome funcionando! ${edificios.length} edifícios encontrados`);
      console.log('   Exemplos:');
      edificios.slice(0, 3).forEach(e => {
        console.log(`   - ${e.nome} (código: ${e.codigo})`);
      });
      resultados.push({ etapa: '1.1 Busca por nome', status: 'OK', mensagem: `${edificios.length} edifícios`, dados: edificios[0] });
    } else {
      aviso('Busca por nome retornou vazio (pode ser cache vazio ou API offline)');
      resultados.push({ etapa: '1.1 Busca por nome', status: 'PARCIAL', mensagem: 'Sem resultados' });
    }

    // Teste 1.2: Listar bairros
    info('Testando listagem de bairros...');
    const bairros = await mapaService.listarBairros();
    
    if (bairros.length > 0) {
      ok(`Listagem de bairros funcionando! ${bairros.length} bairros`);
      resultados.push({ etapa: '1.2 Listar bairros', status: 'OK', mensagem: `${bairros.length} bairros` });
    } else {
      aviso('Listagem de bairros retornou fallback (mock)');
      resultados.push({ etapa: '1.2 Listar bairros', status: 'PARCIAL', mensagem: 'Usando mock' });
    }

    // Teste 1.3: Buscar condomínios horizontais
    info('Testando busca de condomínios horizontais "JARDINS"...');
    const condominios = await mapaService.buscarCondominiosHorizontais('JARDINS', 5);
    
    if (condominios.length > 0) {
      ok(`Busca de condomínios funcionando! ${condominios.length} encontrados`);
      console.log('   Exemplos:');
      condominios.slice(0, 3).forEach(c => {
        console.log(`   - ${c.nome}`);
      });
      resultados.push({ etapa: '1.3 Condomínios horizontais', status: 'OK', mensagem: `${condominios.length} condomínios` });
    } else {
      aviso('Busca de condomínios retornou vazio');
      resultados.push({ etapa: '1.3 Condomínios horizontais', status: 'PARCIAL', mensagem: 'Sem resultados' });
    }

    return edificios.length > 0 ? edificios[0] : null;

  } catch (error: any) {
    erro(`Falha na Etapa 1: ${error.message}`);
    resultados.push({ etapa: '1 Buscar Edifícios', status: 'FALHA', mensagem: error.message });
    return null;
  }
}

async function testarEtapa2_BuscarUnidades(edificio: any) {
  titulo('ETAPA 2: BUSCAR UNIDADES E IPTU');
  
  try {
    if (!edificio) {
      // Usar dados de fallback
      info('Usando dados de fallback para teste...');
      const imoveisMock = [
        { nrinscr: '32313702960010', nmedificio: 'RESERVA BURITI', incompl: 'APTO 101', nmbairro: 'SETOR PEDRO LUDOVICO' },
        { nrinscr: '32313702960011', nmedificio: 'RESERVA BURITI', incompl: 'APTO 102', nmbairro: 'SETOR PEDRO LUDOVICO' },
        { nrinscr: '32313702960012', nmedificio: 'RESERVA BURITI', incompl: 'APTO 103', nmbairro: 'SETOR PEDRO LUDOVICO' },
      ];
      
      ok('Dados de fallback carregados!');
      console.log('   Unidades disponíveis:');
      imoveisMock.forEach(i => {
        console.log(`   - IPTU: ${i.nrinscr} | ${i.incompl} | ${i.nmbairro}`);
      });
      
      resultados.push({ etapa: '2 Buscar Unidades', status: 'PARCIAL', mensagem: 'Usando fallback', dados: imoveisMock });
      return imoveisMock;
    }

    // Buscar unidades do edifício encontrado
    info(`Buscando unidades do edifício ${edificio.nome} (código: ${edificio.codigo})...`);
    const resultado = await mapaService.buscarUnidadesPorEdificio(edificio.codigo, 0, 10, edificio.nome);
    
    if (resultado.unidades.length > 0) {
      ok(`${resultado.unidades.length} unidades encontradas (total: ${resultado.total})`);
      console.log('   Primeiras unidades:');
      resultado.unidades.slice(0, 5).forEach(u => {
        console.log(`   - IPTU: ${u.nrinscr} | ${u.incompl || 'N/A'} | ${u.nmbairro}`);
      });
      resultados.push({ etapa: '2 Buscar Unidades', status: 'OK', mensagem: `${resultado.total} unidades`, dados: resultado.unidades });
      return resultado.unidades;
    } else {
      aviso('Nenhuma unidade encontrada');
      resultados.push({ etapa: '2 Buscar Unidades', status: 'PARCIAL', mensagem: 'Sem unidades' });
      return [];
    }

  } catch (error: any) {
    erro(`Falha na Etapa 2: ${error.message}`);
    resultados.push({ etapa: '2 Buscar Unidades', status: 'FALHA', mensagem: error.message });
    return [];
  }
}

async function testarEtapa3_BuscarCPF(unidades: any[]) {
  titulo('ETAPA 3: DESCOBRIR CPF VIA IPTU (PREFEITURA)');
  
  if (unidades.length === 0) {
    // Usar IPTU de fallback
    unidades = [{ nrinscr: '32313702960010' }];
  }
  
  const iptuTeste = unidades[0].nrinscr;
  info(`Consultando CPF para IPTU: ${iptuTeste}`);
  
  try {
    const dadosProprietario = await scraperIPTU.consultarProprietario(iptuTeste);
    
    console.log('\n   Resultado da consulta:');
    console.log(`   - Nome: ${dadosProprietario.nome || 'N/A'}`);
    console.log(`   - CPF: ${dadosProprietario.cpf || 'N/A'}`);
    console.log(`   - Endereço: ${dadosProprietario.endereco_correspondencia || 'N/A'}`);
    console.log(`   - Origem: ${dadosProprietario.origem}`);
    
    if (dadosProprietario.origem === 'SCRAPER_WEB') {
      ok('Scraper da prefeitura funcionando! Dados REAIS obtidos.');
      resultados.push({ 
        etapa: '3 Descobrir CPF', 
        status: 'OK', 
        mensagem: 'Dados reais da prefeitura',
        dados: dadosProprietario 
      });
    } else if (dadosProprietario.origem === 'MOCK') {
      aviso('Scraper retornou dados MOCKADOS (prefeitura pode estar offline ou formato mudou)');
      resultados.push({ 
        etapa: '3 Descobrir CPF', 
        status: 'PARCIAL', 
        mensagem: 'Usando dados simulados (MOCK)',
        dados: dadosProprietario 
      });
    } else if (dadosProprietario.origem === 'CACHE') {
      ok('Dados obtidos do CACHE local.');
      resultados.push({ 
        etapa: '3 Descobrir CPF', 
        status: 'OK', 
        mensagem: 'Dados do cache',
        dados: dadosProprietario 
      });
    }
    
    return dadosProprietario;

  } catch (error: any) {
    erro(`Falha na Etapa 3: ${error.message}`);
    resultados.push({ etapa: '3 Descobrir CPF', status: 'FALHA', mensagem: error.message });
    return null;
  }
}

async function testarEtapa4_EnriquecerAssertiva(proprietario: any) {
  titulo('ETAPA 4: ENRIQUECER COM ASSERTIVA (CONTATOS)');
  
  if (!proprietario || !proprietario.cpf) {
    aviso('Sem CPF para consultar. Usando CPF de teste...');
    proprietario = { cpf: '123.456.789-00', nome: 'TESTE SISTEMA' };
  }
  
  info(`Enriquecendo CPF: ${proprietario.cpf}`);
  info(`Nome: ${proprietario.nome}`);
  
  try {
    const dadosEnriquecidos = await assertivaService.enriquecerCPF(proprietario.cpf, proprietario.nome);
    
    console.log('\n   Resultado do enriquecimento:');
    console.log(`   - Nome: ${dadosEnriquecidos.nome}`);
    console.log(`   - Telefones: ${dadosEnriquecidos.telefones?.length || 0}`);
    if (dadosEnriquecidos.telefones && dadosEnriquecidos.telefones.length > 0) {
      dadosEnriquecidos.telefones.forEach(t => {
        console.log(`     • ${t.numero} (${t.tipo}) ${t.whatsapp ? '📱 WhatsApp' : ''}`);
      });
    }
    console.log(`   - Emails: ${dadosEnriquecidos.emails?.length || 0}`);
    if (dadosEnriquecidos.emails && dadosEnriquecidos.emails.length > 0) {
      dadosEnriquecidos.emails.forEach(e => console.log(`     • ${e}`));
    }
    console.log(`   - Score: ${dadosEnriquecidos.score || 'N/A'}`);
    console.log(`   - Idade: ${dadosEnriquecidos.idade || 'N/A'}`);
    console.log(`   - Renda: ${dadosEnriquecidos.faixaSalarial || 'N/A'}`);
    console.log(`   - Profissão: ${dadosEnriquecidos.profissao || 'N/A'}`);
    
    // Verificar se são dados reais ou mock
    const temCredenciais = process.env.ASSERTIVA_CLIENT_ID && process.env.ASSERTIVA_CLIENT_SECRET;
    
    if (temCredenciais) {
      ok('Assertiva configurada! Tentando dados reais...');
      resultados.push({ 
        etapa: '4 Enriquecer Assertiva', 
        status: 'OK', 
        mensagem: 'API configurada',
        dados: dadosEnriquecidos 
      });
    } else {
      aviso('Credenciais da Assertiva NÃO configuradas. Dados são MOCK.');
      resultados.push({ 
        etapa: '4 Enriquecer Assertiva', 
        status: 'PARCIAL', 
        mensagem: 'Sem credenciais - usando mock',
        dados: dadosEnriquecidos 
      });
    }
    
    return dadosEnriquecidos;

  } catch (error: any) {
    erro(`Falha na Etapa 4: ${error.message}`);
    resultados.push({ etapa: '4 Enriquecer Assertiva', status: 'FALHA', mensagem: error.message });
    return null;
  }
}

function gerarRelatorioFinal() {
  titulo('RELATÓRIO FINAL - ANÁLISE DE FUNCIONAMENTO');
  
  console.log('\n📊 RESUMO POR ETAPA:\n');
  
  let totalOk = 0;
  let totalParcial = 0;
  let totalFalha = 0;
  
  resultados.forEach(r => {
    let icone = '';
    if (r.status === 'OK') { icone = '✅'; totalOk++; }
    else if (r.status === 'PARCIAL') { icone = '⚠️'; totalParcial++; }
    else { icone = '❌'; totalFalha++; }
    
    console.log(`${icone} ${r.etapa}`);
    console.log(`   Status: ${r.status}`);
    console.log(`   ${r.mensagem}\n`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 ESTATÍSTICAS:');
  console.log(`   ✅ Funcionando: ${totalOk}`);
  console.log(`   ⚠️  Parcial/Mock: ${totalParcial}`);
  console.log(`   ❌ Falha: ${totalFalha}`);
  
  const nota = Math.round(((totalOk * 100) + (totalParcial * 50)) / (totalOk + totalParcial + totalFalha));
  console.log(`\n🎯 NOTA GERAL: ${nota}%`);
  
  if (nota >= 80) {
    console.log(`${verde}   Sistema funcionando bem!${reset}`);
  } else if (nota >= 50) {
    console.log(`${amarelo}   Sistema funcionando parcialmente. Verifique as etapas com problemas.${reset}`);
  } else {
    console.log(`${vermelho}   Sistema com problemas críticos. Ação necessária!${reset}`);
  }
  
  // Diagnóstico específico
  console.log('\n📋 DIAGNÓSTICO:\n');
  
  const etapa3 = resultados.find(r => r.etapa.includes('Descobrir CPF'));
  if (etapa3?.status === 'PARCIAL') {
    console.log(`${amarelo}⚠️  ETAPA 3 (Prefeitura): Retornando dados MOCK.`);
    console.log('   Isso significa que o scraper da prefeitura pode estar:');
    console.log('   - Offline ou com timeout');
    console.log('   - Com formato de HTML alterado');
    console.log('   - Exigindo CAPTCHA');
    console.log(`   AÇÃO: Testar manualmente o endpoint da prefeitura.${reset}\n`);
  }
  
  const etapa4 = resultados.find(r => r.etapa.includes('Assertiva'));
  if (etapa4?.status === 'PARCIAL') {
    console.log(`${amarelo}⚠️  ETAPA 4 (Assertiva): Usando dados MOCK.`);
    console.log('   Verifique se as variáveis de ambiente estão configuradas:');
    console.log('   - ASSERTIVA_CLIENT_ID');
    console.log('   - ASSERTIVA_CLIENT_SECRET');
    console.log(`   AÇÃO: Configurar credenciais no arquivo .env${reset}\n`);
  }
  
  console.log('='.repeat(60));
}

async function executarTestes() {
  console.log('\n🔍 INICIANDO ANÁLISE DE FUNCIONAMENTO DO FLUXO DE MINERAÇÃO\n');
  console.log('Este teste verifica cada etapa do processo interno:\n');
  console.log('1️⃣  Localizar imóveis/edifícios/condomínios');
  console.log('2️⃣  Descobrir IPTU das unidades');
  console.log('3️⃣  Descobrir CPF via certidão (prefeitura)');
  console.log('4️⃣  Buscar contatos na Assertiva');
  console.log('');
  
  // Executar etapas
  const edificio = await testarEtapa1_BuscarEdificios();
  const unidades = await testarEtapa2_BuscarUnidades(edificio);
  const proprietario = await testarEtapa3_BuscarCPF(unidades);
  await testarEtapa4_EnriquecerAssertiva(proprietario);
  
  // Gerar relatório
  gerarRelatorioFinal();
}

// Executar
executarTestes().catch(console.error);
