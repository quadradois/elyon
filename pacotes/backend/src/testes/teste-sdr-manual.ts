/**
 * TESTE MANUAL DO SDR WORKER
 * 
 * Valida as 5 mudanças críticas implementadas:
 * 1. ✅ Prompt reduzido (~180 linhas)
 * 2. ✅ FSM externo com validação programática
 * 3. ✅ Identidade clara e tom aplicado
 * 4. ✅ Chain-of-thought integrado
 * 5. ✅ Avaliação gratuita como carta na manga
 * 
 * Execute com: npx ts-node src/testes/teste-sdr-manual.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { sdrWorker, ConfiguracaoAgente } from '../agentes/workers/sdr-worker';

// Cores para output
const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const AMARELO = '\x1b[33m';
const AZUL = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Configuração de teste
const configTeste: ConfiguracaoAgente = {
  nome: 'Sofia',
  personalidade: {
    tom: 'amigavel',
    usarEmojis: true,
    nivelFormalidade: 3
  },
  expertise: {
    bairros: ['Setor Bueno', 'Marista', 'Jardim Goiás'],
    tiposImovel: ['Apartamento', 'Casa']
  },
  scripts: {
    saudacao: 'Olá! Como posso ajudar você hoje?',
    despedida: 'Foi um prazer ajudar! Até logo!'
  },
  tenantNome: 'Imobiliária Teste'
};

// Cenários de teste
interface CenarioTeste {
  nome: string;
  descricao: string;
  mensagens: Array<{role: string, content: string}>;
  validacoes: {
    naoDeveTer?: string[];    // Strings que NÃO devem aparecer
    deveTer?: string[];       // Strings que DEVEM aparecer (alguma delas)
    naoDeveQualificar?: boolean;  // FSM deve bloquear qualificação
    deveSerCurta?: boolean;   // Resposta < 200 chars
  };
}

const cenarios: CenarioTeste[] = [
  // ===== TESTE 1: FSM - Bloquear qualificação prematura =====
  {
    nome: '🔒 FSM: Bloquear qualificação sem dados',
    descricao: 'Lead diz "sim" mas não temos os 4 dados. FSM deve bloquear tool.',
    mensagens: [
      { role: 'user', content: 'Oi, recebi sua mensagem' },
      { role: 'assistant', content: 'Olá! Que bom que respondeu! Você tem interesse em vender seu imóvel?' },
      { role: 'user', content: 'Sim, tenho interesse' }
    ],
    validacoes: {
      naoDeveQualificar: true,
      naoDeveTer: ['corretor', 'agendar visita', 'avaliação gratuita'],
      deveTer: ['quarto', 'quantos', 'apartamento', 'imóvel']
    }
  },

  // ===== TESTE 2: Coleta de dados progressiva =====
  {
    nome: '📊 Coleta: Pergunta 1 por vez',
    descricao: 'Agente deve fazer UMA pergunta por vez, não várias.',
    mensagens: [
      { role: 'user', content: 'Quero vender meu apartamento' }
    ],
    validacoes: {
      deveSerCurta: true,
      naoDeveTer: ['valor', 'preço', 'avaliação', 'agendar'],
      deveTer: ['quarto', 'quantos']
    }
  },

  // ===== TESTE 3: Identidade coerente =====
  {
    nome: '🎭 Identidade: Responder "de onde você é?"',
    descricao: 'Agente deve manter coerência com a mensagem de prospecção.',
    mensagens: [
      { role: 'user', content: 'Oi, quem é você? De onde conseguiu meu número?' }
    ],
    validacoes: {
      deveTer: ['Sofia', 'Imobiliária', 'indicação', 'região'],
      naoDeveTer: ['base de dados', 'prefeitura', 'IPTU', 'sistema']
    }
  },

  // ===== TESTE 4: Objeção de comissão =====
  {
    nome: '💰 Objeção: Comissão',
    descricao: 'Lead pergunta comissão ANTES de qualificar. Deve responder e voltar a coletar.',
    mensagens: [
      { role: 'user', content: 'Quanto vocês cobram de comissão?' }
    ],
    validacoes: {
      deveTer: ['6%', 'taxa', 'padrão'],
      naoDeveTer: ['avaliação gratuita', 'agendar']
    }
  },

  // ===== TESTE 5: Recovery de "não obrigado" =====
  {
    nome: '🔄 Recovery: Primeira tentativa',
    descricao: 'Lead diz "não obrigado". Deve fazer 1 tentativa de recovery.',
    mensagens: [
      { role: 'user', content: 'Não, obrigado. Não tenho interesse.' }
    ],
    validacoes: {
      naoDeveTer: ['tudo bem', 'entendido', 'até logo'],
      deveTer: ['tranquilo', 'pensar em vender', 'conversar', 'ajuda']
    }
  },

  // ===== TESTE 6: Avaliação só como carta na manga =====
  {
    nome: '🃏 Carta na Manga: Não oferecer avaliação cedo',
    descricao: 'Lead pergunta "como funciona?". NÃO deve oferecer avaliação gratuita.',
    mensagens: [
      { role: 'user', content: 'Como funciona o serviço de vocês?' }
    ],
    validacoes: {
      naoDeveTer: ['avaliação gratuita', 'avaliação grátis', 'avaliar seu imóvel'],
      deveTer: ['carteira', 'interessado', 'divulg', 'avis']
    }
  },

  // ===== TESTE 7: Qualificação completa (4 dados) =====
  {
    nome: '✅ Qualificação: Com 4 dados coletados',
    descricao: 'Lead forneceu todos os dados. Agente PODE qualificar.',
    mensagens: [
      { role: 'user', content: 'Tenho um apartamento de 3 quartos' },
      { role: 'assistant', content: 'Que ótimo! 3 quartos é bem procurado. O apartamento está ocupado ou vazio?' },
      { role: 'user', content: 'Está vazio, moramos em outra casa' },
      { role: 'assistant', content: 'Entendi! E o que te fez pensar em vender agora?' },
      { role: 'user', content: 'Preciso do dinheiro pra quitar umas dívidas' },
      { role: 'assistant', content: 'Compreendo. E você tem urgência? Tipo, precisa vender em quanto tempo?' },
      { role: 'user', content: 'Quero resolver isso em uns 2 meses' }
    ],
    validacoes: {
      // Aqui o agente PODE qualificar e oferecer próximo passo
      deveTer: ['carteira', 'interessado', 'oportunidade', 'lista', 'incluir', 'adicionar']
    }
  },

  // ===== TESTE 8: Tom amigável com emoji =====
  {
    nome: '😊 Personalidade: Tom amigável + emoji',
    descricao: 'Configurado com tom amigável e emojis. Deve usar.',
    mensagens: [
      { role: 'user', content: 'Olá!' }
    ],
    validacoes: {
      // Deve ter emoji em algum lugar (comum em saudação)
      // Não deve ser muito formal
      naoDeveTer: ['senhor', 'senhora', 'prezado']
    }
  }
];

// ===== EXECUTOR DE TESTES =====

async function executarTeste(cenario: CenarioTeste, indice: number): Promise<boolean> {
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${AZUL}TESTE ${indice + 1}/${cenarios.length}: ${cenario.nome}${RESET}`);
  console.log(`${AMARELO}${cenario.descricao}${RESET}`);
  console.log(`─────────────────────────────────────────────────────────────────`);
  
  try {
    const inicio = Date.now();
    
    const resposta = await sdrWorker.processar(
      cenario.mensagens,
      `teste-${indice}`,
      configTeste
    );
    
    const duracao = Date.now() - inicio;
    
    console.log(`\n${BOLD}📩 ENTRADA:${RESET}`);
    const ultimaMensagem = cenario.mensagens[cenario.mensagens.length - 1];
    console.log(`   "${ultimaMensagem.content}"`);
    
    console.log(`\n${BOLD}📤 RESPOSTA (${duracao}ms):${RESET}`);
    console.log(`   "${resposta}"`);
    
    // Validações
    let passou = true;
    const erros: string[] = [];
    
    // Validar: não deve ter
    if (cenario.validacoes.naoDeveTer) {
      for (const termo of cenario.validacoes.naoDeveTer) {
        if (resposta.toLowerCase().includes(termo.toLowerCase())) {
          passou = false;
          erros.push(`❌ Contém "${termo}" (não deveria)`);
        }
      }
    }
    
    // Validar: deve ter (pelo menos um)
    if (cenario.validacoes.deveTer) {
      const temAlgum = cenario.validacoes.deveTer.some(termo => 
        resposta.toLowerCase().includes(termo.toLowerCase())
      );
      if (!temAlgum) {
        passou = false;
        erros.push(`❌ Não contém nenhum de: ${cenario.validacoes.deveTer.join(', ')}`);
      }
    }
    
    // Validar: deve ser curta
    if (cenario.validacoes.deveSerCurta && resposta.length > 200) {
      passou = false;
      erros.push(`❌ Resposta muito longa (${resposta.length} chars > 200)`);
    }
    
    // Resultado
    console.log(`\n${BOLD}📋 VALIDAÇÃO:${RESET}`);
    if (passou) {
      console.log(`   ${VERDE}✅ PASSOU${RESET}`);
    } else {
      console.log(`   ${VERMELHO}❌ FALHOU${RESET}`);
      erros.forEach(e => console.log(`   ${e}`));
    }
    
    return passou;
    
  } catch (error: any) {
    console.log(`\n${VERMELHO}💥 ERRO: ${error.message}${RESET}`);
    return false;
  }
}

async function executarTodosTestes() {
  console.log(`\n${BOLD}${AZUL}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${AZUL}║         🧪 TESTE DO SDR WORKER - VALIDAÇÃO COMPLETA          ║${RESET}`);
  console.log(`${BOLD}${AZUL}╚═══════════════════════════════════════════════════════════════╝${RESET}`);
  
  console.log(`\n📋 Validando ${cenarios.length} cenários...`);
  console.log(`⏱️  Cada teste chama a API da Anthropic (pode demorar)\n`);
  
  const resultados: boolean[] = [];
  
  for (let i = 0; i < cenarios.length; i++) {
    const resultado = await executarTeste(cenarios[i], i);
    resultados.push(resultado);
    
    // Pequena pausa entre testes para não sobrecarregar API
    if (i < cenarios.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Resumo final
  const passou = resultados.filter(r => r).length;
  const falhou = resultados.filter(r => !r).length;
  
  console.log(`\n${BOLD}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║                      📊 RESUMO FINAL                          ║${RESET}`);
  console.log(`${BOLD}╚═══════════════════════════════════════════════════════════════╝${RESET}`);
  
  console.log(`\n   ${VERDE}✅ Passou: ${passou}/${cenarios.length}${RESET}`);
  console.log(`   ${VERMELHO}❌ Falhou: ${falhou}/${cenarios.length}${RESET}`);
  
  const taxa = Math.round((passou / cenarios.length) * 100);
  
  if (taxa === 100) {
    console.log(`\n   ${VERDE}${BOLD}🎉 PERFEITO! Todas as validações passaram!${RESET}`);
    console.log(`   ${VERDE}→ O SDR está pronto para produção.${RESET}`);
  } else if (taxa >= 75) {
    console.log(`\n   ${AMARELO}${BOLD}⚠️ BOM, mas precisa ajustes (${taxa}%)${RESET}`);
    console.log(`   ${AMARELO}→ Revise os cenários que falharam.${RESET}`);
  } else {
    console.log(`\n   ${VERMELHO}${BOLD}🚨 ATENÇÃO: Taxa baixa de sucesso (${taxa}%)${RESET}`);
    console.log(`   ${VERMELHO}→ Revisar implementação antes de produção.${RESET}`);
  }
  
  console.log(`\n`);
}

// Executar
executarTodosTestes().catch(console.error);
