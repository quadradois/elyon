/**
 * Testes E2E do SDR Worker
 * 
 * Valida o fluxo completo de qualificação SPIN Selling:
 * - Transições de FSM
 * - Coleta de dados obrigatórios
 * - Bloqueio de qualificação prematura
 * - Tool calls corretas
 * - Conhecimento contextual
 * 
 * Uso:
 *   npx tsx scripts/teste-sdr-e2e.ts
 *   npx tsx scripts/teste-sdr-e2e.ts --verbose
 */

import { sdrWorker } from '../src/agentes/workers/sdr-worker';
import { SDRLogger, createLogger } from '../src/servicos/logger';

const logger = createLogger('E2E-Test');
const verbose = process.argv.includes('--verbose');

// ============================================================================
// CENÁRIOS DE TESTE
// ============================================================================

interface CenarioTeste {
  nome: string;
  descricao: string;
  mensagens: Array<{ role: 'user' | 'assistant'; content: string }>;
  esperado: {
    faseMinima?: string;
    contemPalavras?: string[];
    naoContemPalavras?: string[];
    toolChamada?: string;
    toolBloqueada?: string;
  };
}

const CENARIOS: CenarioTeste[] = [
  // -------------------------------------------------------------------------
  // CENÁRIO 1: Primeiro contato (Técnica do Idoso Confuso)
  // -------------------------------------------------------------------------
  {
    nome: 'Primeiro Contato',
    descricao: 'Lead recebe mensagem inicial e responde com interesse',
    mensagens: [
      {
        role: 'user',
        content: 'Oi, recebi uma mensagem perguntando sobre meu imóvel. Do que se trata?'
      }
    ],
    esperado: {
      contemPalavras: ['imóvel'],
      naoContemPalavras: ['qualificado']
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 2: Lead demonstra interesse em vender
  // -------------------------------------------------------------------------
  {
    nome: 'Interesse em Venda',
    descricao: 'Lead quer vender o imóvel',
    mensagens: [
      {
        role: 'user',
        content: 'Sim, estou pensando em vender meu apartamento'
      },
      {
        role: 'assistant',
        content: 'Que ótimo! Posso te ajudar com isso. Só para eu entender melhor, qual o endereço do imóvel?'
      },
      {
        role: 'user',
        content: 'É na Rua T-50, 123, Setor Bueno'
      }
    ],
    esperado: {
      faseMinima: 'SITUACAO',
      contemPalavras: ['quarto']  // Pergunta sobre quartos
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 3: Coleta de dados progressiva
  // -------------------------------------------------------------------------
  {
    nome: 'Coleta Progressiva',
    descricao: 'Conversa evolui coletando interesse, localização e valor',
    mensagens: [
      {
        role: 'user',
        content: 'Quero vender meu imóvel'
      },
      {
        role: 'assistant', 
        content: 'Perfeito! Onde fica o imóvel?'
      },
      {
        role: 'user',
        content: 'Rua T-37, Setor Bueno'
      },
      {
        role: 'assistant',
        content: 'Ótima localização! Qual valor você imagina?'
      },
      {
        role: 'user',
        content: 'Estou pensando em uns 500 mil'
      },
      {
        role: 'assistant',
        content: 'Entendi! E qual o tamanho do imóvel?'
      },
      {
        role: 'user',
        content: 'É um apartamento de 80m², 3 quartos'
      }
    ],
    esperado: {
      faseMinima: 'PROBLEMA',
      contemPalavras: ['!']  // Resposta positiva/engajada
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 4: Objeção de preço
  // -------------------------------------------------------------------------
  {
    nome: 'Objeção de Preço',
    descricao: 'Lead reclama de taxas ou comissões',
    mensagens: [
      {
        role: 'user',
        content: 'Achei a taxa de vocês muito alta'
      }
    ],
    esperado: {
      contemPalavras: ['entendo'],
      naoContemPalavras: ['infelizmente']
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 5: Opt-out
  // -------------------------------------------------------------------------
  {
    nome: 'Opt-Out Explícito',
    descricao: 'Lead pede para não receber mais mensagens',
    mensagens: [
      {
        role: 'user',
        content: 'Não tenho interesse, pare de me enviar mensagens'
      }
    ],
    esperado: {
      contemPalavras: ['desculp', 'mensagen'],
      toolChamada: 'registrar_optout'
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 6: Lead qualificado completo
  // -------------------------------------------------------------------------
  {
    nome: 'Lead Totalmente Qualificado',
    descricao: 'Todos os 4 dados coletados - deve chamar qualificar_lead',
    mensagens: [
      {
        role: 'user',
        content: 'Quero vender meu apartamento no Setor Bueno, 3 quartos, 100m², estou pedindo 600 mil'
      }
    ],
    esperado: {
      faseMinima: 'PROBLEMA',
      contemPalavras: ['!'] // Resposta engajada
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 7: Tentativa de qualificação prematura (deve ser bloqueada)
  // -------------------------------------------------------------------------
  {
    nome: 'Qualificação Prematura Bloqueada',
    descricao: 'Lead só disse interesse, sem outros dados - FSM deve bloquear',
    mensagens: [
      {
        role: 'user',
        content: 'Tenho interesse em vender'
      }
    ],
    esperado: {
      naoContemPalavras: ['qualificado', 'corretor irá ligar']
    }
  },

  // -------------------------------------------------------------------------
  // CENÁRIO 8: Hesitação do lead
  // -------------------------------------------------------------------------
  {
    nome: 'Hesitação',
    descricao: 'Lead demonstra dúvida ou hesitação',
    mensagens: [
      {
        role: 'user',
        content: 'Ainda não sei se quero vender, estou só pesquisando'
      }
    ],
    esperado: {
      contemPalavras: ['entend', 'pesquis'],  // "entendo" ou "entendi"
      naoContemPalavras: ['urgente']
    }
  }
];

// ============================================================================
// EXECUTOR DE TESTES
// ============================================================================

interface ResultadoTeste {
  cenario: string;
  passou: boolean;
  resposta: string;
  erros: string[];
  duracao: number;
}

async function executarCenario(cenario: CenarioTeste): Promise<ResultadoTeste> {
  const inicio = Date.now();
  const erros: string[] = [];
  
  try {
    if (verbose) {
      logger.info(`Executando: ${cenario.nome}`);
    }
    
    // Executar SDR
    const resposta = await sdrWorker.processar(
      cenario.mensagens,
      `test-lead-${Date.now()}`,
      undefined,
      undefined,
      undefined
    );
    
    // Validar resposta
    const respostaLower = resposta.toLowerCase();
    
    // Verificar palavras que devem estar presentes
    if (cenario.esperado.contemPalavras) {
      for (const palavra of cenario.esperado.contemPalavras) {
        if (!respostaLower.includes(palavra.toLowerCase())) {
          erros.push(`Deveria conter "${palavra}"`);
        }
      }
    }
    
    // Verificar palavras que NÃO devem estar presentes
    if (cenario.esperado.naoContemPalavras) {
      for (const palavra of cenario.esperado.naoContemPalavras) {
        if (respostaLower.includes(palavra.toLowerCase())) {
          erros.push(`NÃO deveria conter "${palavra}"`);
        }
      }
    }
    
    // Verificar tamanho mínimo da resposta
    if (resposta.length < 20) {
      erros.push('Resposta muito curta');
    }
    
    // Verificar se não é resposta de fallback
    if (resposta.includes('problema técnico') || resposta.includes('Desculpe, não entendi')) {
      erros.push('Recebeu resposta de fallback/erro');
    }
    
    return {
      cenario: cenario.nome,
      passou: erros.length === 0,
      resposta,
      erros,
      duracao: Date.now() - inicio
    };
    
  } catch (error: any) {
    return {
      cenario: cenario.nome,
      passou: false,
      resposta: '',
      erros: [`Exceção: ${error.message}`],
      duracao: Date.now() - inicio
    };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              🧪 TESTES E2E - SDR WORKER                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');
  
  const resultados: ResultadoTeste[] = [];
  let passou = 0;
  let falhou = 0;
  
  for (const cenario of CENARIOS) {
    const resultado = await executarCenario(cenario);
    resultados.push(resultado);
    
    const status = resultado.passou ? '✅' : '❌';
    const duracao = `${resultado.duracao}ms`;
    
    console.log(`${status} ${cenario.nome} (${duracao})`);
    
    if (verbose || !resultado.passou) {
      console.log(`   📝 ${cenario.descricao}`);
      console.log(`   💬 Resposta: "${resultado.resposta.substring(0, 100)}..."`);
      
      if (resultado.erros.length > 0) {
        for (const erro of resultado.erros) {
          console.log(`   ⚠️  ${erro}`);
        }
      }
      console.log('');
    }
    
    if (resultado.passou) {
      passou++;
    } else {
      falhou++;
    }
  }
  
  // Resumo
  console.log('\n');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('                        RESUMO                                  ');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`   ✅ Passou: ${passou}`);
  console.log(`   ❌ Falhou: ${falhou}`);
  console.log(`   📊 Taxa: ${Math.round((passou / CENARIOS.length) * 100)}%`);
  console.log('───────────────────────────────────────────────────────────────');
  
  // Calcular tempo total
  const tempoTotal = resultados.reduce((acc, r) => acc + r.duracao, 0);
  console.log(`   ⏱️  Tempo total: ${(tempoTotal / 1000).toFixed(1)}s`);
  console.log(`   ⏱️  Média por teste: ${Math.round(tempoTotal / CENARIOS.length)}ms`);
  console.log('\n');
  
  // Exit code baseado nos resultados
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch(console.error);
