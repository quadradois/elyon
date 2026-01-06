/**
 * Rotas de Processamento - Mineração de Leads
 * 
 * Responsabilidades:
 * - Busca legada de imóveis
 * - Identificação de proprietários (Scraper IPTU)
 * - Enriquecimento de leads (Assertiva)
 * - Persistência no banco de dados
 * - Consumo de créditos por operação
 */

import { Router } from 'express';
import { mapaService } from '../../servicos/mapa';
import { scraperIPTU, parsearEnderecoPrefeitura } from '../../servicos/scraper-iptu';
import { assertivaService } from '../../servicos/assertiva';
import { prisma } from '../../lib/db';
import { servicoCreditos } from '../../servicos/servico-creditos';
import { z } from 'zod';

const router = Router();

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

const buscaSchema = z.object({
  nmedificio: z.string().optional(),
  nmbairro: z.string().optional(),
  nmlogradou: z.string().optional(),
  nrinscr: z.string().optional(),
});

const identificarSchema = z.object({
  imoveis: z.array(z.object({
    nrinscr: z.string(),
    nmedificio: z.string().optional(),
    incompl: z.string().optional(),
    nmlogradou: z.string().optional(),
    nmbairro: z.string().optional(),
  }))
});

const confirmarSchema = z.object({
  proprietarios: z.array(z.object({
    nrinscr: z.string(),
    nome: z.string().optional(),
    cpf: z.string().optional(),
    endereco_correspondencia: z.string().optional(),
    origem: z.string(),
    nmedificio: z.string().optional(),
    nmbairro: z.string().optional(),
    nmlogradou: z.string().optional(),
    incompl: z.string().optional(),
    apartamento: z.string().optional(),
    bloco: z.string().optional(),
    unidade: z.string().optional(),
    box: z.string().optional(),
    quadra: z.string().optional(),
    lote: z.string().optional(),
    nomeEdificio: z.string().optional(),
    tipoImovel: z.string().optional(),
  }))
});

// ============================================
// INTERFACE
// ============================================

interface LeadEnriquecido {
  nrinscr: string;
  nome?: string;
  cpf?: string;
  endereco_correspondencia?: string;
  origem: string;
  nmedificio?: string;
  nmbairro?: string;
  nmlogradou?: string;
  incompl?: string;
  apartamento?: string;
  bloco?: string;
  unidade?: string;
  box?: string;
  quadra?: string;
  lote?: string;
  nomeEdificio?: string;
  tipoImovel?: string;
  telefones?: { numero: string; tipo: string; whatsapp: boolean }[];
  emails?: string[];
  leadId?: string;
  imovelId?: string;
}

// ============================================
// BUSCA LEGADA
// ============================================

/**
 * POST /buscar
 * Busca legada de imóveis
 */
router.post('/buscar', async (req, res) => {
  try {
    const params = buscaSchema.parse(req.body);

    if (!params.nmedificio && !params.nmbairro && !params.nmlogradou && !params.nrinscr) {
      return res.status(400).json({ erro: 'Pelo menos um filtro deve ser fornecido' });
    }

    const resultados = await mapaService.buscarImoveis(params);
    return res.json(resultados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao buscar imóveis' });
  }
});

// ============================================
// IDENTIFICAÇÃO DE PROPRIETÁRIOS
// ============================================

/**
 * POST /identificar-proprietarios
 * Scraper IPTU - Identifica proprietários dos imóveis
 */
router.post('/identificar-proprietarios', async (req, res) => {
  try {
    const { imoveis } = identificarSchema.parse(req.body);

    if (imoveis.length === 0) {
      return res.status(400).json({ erro: 'Lista de imóveis vazia' });
    }

    const inicio = Date.now();
    console.log(`[Mineracao] 🚀 Identificando proprietários de ${imoveis.length} imóveis (modo otimizado)...`);

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({
        erro: 'Tenant não identificado. Envie o header X-Tenant-Id.'
      });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(400).json({
        erro: 'Tenant não encontrado. Verifique o X-Tenant-Id.'
      });
    }

    // ====================================
    // VERIFICAR CRÉDITOS DISPONÍVEIS
    // ====================================
    const saldo = await servicoCreditos.consultarSaldo(tenantId);
    const creditosNecessarios = imoveis.length;

    if (saldo.total < creditosNecessarios) {
      return res.status(402).json({
        erro: 'Créditos insuficientes',
        mensagem: `Você precisa de ${creditosNecessarios} créditos, mas tem apenas ${saldo.total}.`,
        saldo: {
          total: saldo.total,
          mensais: saldo.mensais,
          prepagos: saldo.prepagos,
          bonus: saldo.bonus
        },
        necessario: creditosNecessarios
      });
    }

    console.log(`[Mineracao] 💰 Créditos: ${saldo.total} disponíveis, ${creditosNecessarios} serão consumidos`);

    const BATCH_SIZE = 10;
    const DELAY_ENTRE_BATCHES = 500;

    const dadosProprietarios: any[] = [];
    const batches = [];
    let creditosConsumidos = 0;

    for (let i = 0; i < imoveis.length; i += BATCH_SIZE) {
      batches.push(imoveis.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Mineracao] Dividido em ${batches.length} batches de até ${BATCH_SIZE} imóveis`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const resultadosBatch = await Promise.all(
        batch.map(async (imovel) => {
          try {
            const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);

            // CONSUMIR CRÉDITO após consulta bem-sucedida
            try {
              await servicoCreditos.consumirCredito(tenantId);
              creditosConsumidos++;
            } catch (e) {
              console.error(`[Mineracao] Erro ao consumir crédito:`, e);
            }

            // NOTA: Não criamos Lead aqui!
            // Os dados são retornados para o frontend que deve:
            // 1. Vincular a uma Campanha
            // 2. Criar Contatos (não Leads)
            // 3. Leads só são criados após qualificação SPIN
            // Veja: /rotas/campanhas/contatos.rotas.ts

            return { ...imovel, ...dadosScraper };
          } catch (error) {
            console.error(`Erro ao processar imóvel ${imovel.nrinscr}:`, error);
            return imovel;
          }
        })
      );

      dadosProprietarios.push(...resultadosBatch);

      const processados = Math.min((batchIndex + 1) * BATCH_SIZE, imoveis.length);
      console.log(`[Mineracao] ✓ Batch ${batchIndex + 1}/${batches.length} concluído (${processados}/${imoveis.length})`);

      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES));
      }
    }

    const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`[Mineracao] ✅ Concluído em ${tempoTotal}s (${(imoveis.length / parseFloat(tempoTotal)).toFixed(1)} imóveis/s)`);
    console.log(`[Mineracao] 💰 Total de créditos consumidos: ${creditosConsumidos}`);

    // Consultar saldo atualizado
    const saldoAtualizado = await servicoCreditos.consultarSaldo(tenantId);

    return res.json({
      proprietarios: dadosProprietarios,
      creditos: {
        consumidos: creditosConsumidos,
        saldoRestante: saldoAtualizado.total
      }
    });
  } catch (error) {
    console.error('Erro ao identificar proprietários:', error);
    return res.status(500).json({ erro: 'Falha na identificação de proprietários' });
  }
});

// ============================================
// CONFIRMAÇÃO E ENRIQUECIMENTO DE LEADS
// ============================================

/**
 * POST /confirmar-leads
 * Enriquecimento Assertiva + Persistência com deduplicação
 */
router.post('/confirmar-leads', async (req, res) => {
  try {
    console.log('[DEBUG] /confirmar-leads body:', JSON.stringify(req.body, null, 2));

    let proprietarios;
    try {
      const parsed = confirmarSchema.parse(req.body);
      proprietarios = parsed.proprietarios;
    } catch (zodError) {
      console.error('[DEBUG] Zod Error:', JSON.stringify(zodError, null, 2));
      throw zodError;
    }

    const inicio = Date.now();
    console.log(`[Mineracao] 🚀 Processando ${proprietarios.length} leads (modo otimizado)...`);

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({
        erro: 'Tenant não identificado. Envie o header X-Tenant-Id.'
      });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(400).json({
        erro: 'Tenant não encontrado. Verifique o X-Tenant-Id.'
      });
    }

    let cpfsDoCache = 0;
    let cpfsDaApi = 0;
    let economiaTotal = 0;

    const CUSTO_ASSERTIVA = 0.15;
    const precoVendaContato = Number(tenant.precoConsultaCpf) || 2.00;

    // 1. Separar CPFs únicos
    const cpfsUnicos = new Set<string>();
    const proprietariosComCpf: typeof proprietarios = [];
    const proprietariosSemCpf: typeof proprietarios = [];

    for (const p of proprietarios) {
      if (p.cpf) {
        const cpfLimpo = p.cpf.replace(/\D/g, '');
        if (!cpfsUnicos.has(cpfLimpo)) {
          cpfsUnicos.add(cpfLimpo);
          proprietariosComCpf.push(p);
        }
      } else {
        proprietariosSemCpf.push(p);
      }
    }

    console.log(`[Mineracao] ${proprietariosComCpf.length} CPFs únicos, ${proprietariosSemCpf.length} sem CPF`);

    // 2. Verificar cache
    const agora = new Date();
    const cacheExistente = await prisma.cacheCpf.findMany({
      where: {
        cpf: { in: Array.from(cpfsUnicos) },
        expiraEm: { gt: agora }
      }
    });

    const cpfsEmCache = new Map(cacheExistente.map(c => [c.cpf, c]));
    console.log(`[Mineracao] ${cpfsEmCache.size} CPFs encontrados no cache`);

    // 3. Enriquecer proprietários
    const leadsEnriquecidos: LeadEnriquecido[] = [];
    const BATCH_SIZE_ASSERTIVA = 5;
    const DELAY_ENTRE_LOTES_ASSERTIVA = 300;

    const proprietariosDoCache: typeof proprietariosComCpf = [];
    const proprietariosNovos: typeof proprietariosComCpf = [];

    for (const p of proprietariosComCpf) {
      const cpfLimpo = p.cpf!.replace(/\D/g, '');
      if (cpfsEmCache.has(cpfLimpo)) {
        proprietariosDoCache.push(p);
      } else {
        proprietariosNovos.push(p);
      }
    }

    console.log(`[Mineracao] ${proprietariosDoCache.length} do cache, ${proprietariosNovos.length} novos para API`);

    // Processar cache em paralelo
    const resultadosCache = await Promise.all(
      proprietariosDoCache.map(async (p) => {
        const cpfLimpo = p.cpf!.replace(/\D/g, '');
        const cached = cpfsEmCache.get(cpfLimpo)!;

        cpfsDoCache++;
        economiaTotal += CUSTO_ASSERTIVA;

        const dadosCache = cached.dados as any;
        const leadEnriquecido = {
          ...p,
          cpf: cpfLimpo,
          nome: dadosCache.nome || p.nome,
          telefones: dadosCache.telefones || [],
          emails: dadosCache.emails || [],
          score: dadosCache.score || 80,
        } as LeadEnriquecido;

        // COBRANÇA DE CRÉDITO (Apenas se tiver telefone)
        if (leadEnriquecido.telefones && leadEnriquecido.telefones.length > 0) {
          try {
            await servicoCreditos.consumirCredito(tenantId);
          } catch (e) {
            console.error(`[Mineracao] Erro ao cobrar crédito do cache:`, e);
            // Opcional: Bloquear retorno se não tiver crédito?
            // Por enquanto, apenas logamos e permitimos (política permissiva)
          }
        }

        await prisma.cacheCpf.update({
          where: { id: cached.id },
          data: { contagemConsultas: { increment: 1 }, ultimoUsoEm: agora }
        });

        await prisma.consultaCpf.create({
          data: {
            tenantId: tenant.id,
            cpf: cpfLimpo,
            veioDoCache: true,
            custoParaNos: 0,
            cobradoDe: precoVendaContato,
            lucro: precoVendaContato,
            cacheId: cached.id
          }
        });

        return leadEnriquecido;
      })
    );

    leadsEnriquecidos.push(...resultadosCache);

    // Processar novos documentos (CPF/CNPJ) em lotes
    for (let i = 0; i < proprietariosNovos.length; i += BATCH_SIZE_ASSERTIVA) {
      const lote = proprietariosNovos.slice(i, i + BATCH_SIZE_ASSERTIVA);

      const resultadosLote = await Promise.all(
        lote.map(async (p) => {
          const docLimpo = p.cpf!.replace(/\D/g, '');

          // Validar tamanho do documento (CPF=11, CNPJ=14)
          if (docLimpo.length !== 11 && docLimpo.length !== 14) {
            console.log(`[Mineracao] ⚠️ Ignorando documento inválido: ${docLimpo} (${docLimpo.length} dígitos)`);
            return p as LeadEnriquecido;
          }

          cpfsDaApi++;
          const tipoDOC = docLimpo.length === 11 ? 'CPF' : 'CNPJ';

          try {
            // Método universal: detecta CPF ou CNPJ automaticamente
            const enriquecido = await assertivaService.enriquecerDocumento(docLimpo, p.nome || '');

            // COBRANÇA DE CRÉDITO (Apenas se tiver telefone)
            if (enriquecido.telefones && enriquecido.telefones.length > 0) {
              try {
                await servicoCreditos.consumirCredito(tenantId);
              } catch (e) {
                console.error(`[Mineracao] Erro ao cobrar crédito da API:`, e);
              }
            }

            const leadEnriquecido = { ...p, ...enriquecido } as LeadEnriquecido;

            const expiraEm = new Date();
            expiraEm.setDate(expiraEm.getDate() + 90);

            const novoCache = await prisma.cacheCpf.create({
              data: {
                cpf: docLimpo,
                dados: {
                  nome: enriquecido.nome,
                  telefones: enriquecido.telefones,
                  emails: enriquecido.emails,
                  score: enriquecido.score,
                  dataNascimento: enriquecido.dataNascimento,
                  idade: enriquecido.idade,
                  sexo: enriquecido.sexo,
                  signo: enriquecido.signo,
                  situacaoCadastral: enriquecido.situacaoCadastral,
                  obitoProvavel: enriquecido.obitoProvavel,
                  nomeMae: enriquecido.nomeMae,
                  ppe: enriquecido.ppe,
                  rendaEstimada: enriquecido.rendaEstimada,
                  faixaSalarial: enriquecido.faixaSalarial,
                  profissao: enriquecido.profissao,
                  setor: enriquecido.setor,
                  empresaAtual: enriquecido.empresaAtual,
                  cnpjEmpresa: enriquecido.cnpjEmpresa,
                  endereco: enriquecido.endereco,
                  participacoesEmpresas: enriquecido.participacoesEmpresas,
                  redesSociais: enriquecido.redesSociais,
                },
                fonte: 'assertiva',
                expiraEm,
                primeiraConsultaPor: tenant.id
              }
            });

            await prisma.consultaCpf.create({
              data: {
                tenantId: tenant.id,
                cpf: docLimpo,
                veioDoCache: false,
                custoParaNos: CUSTO_ASSERTIVA,
                cobradoDe: precoVendaContato,
                lucro: precoVendaContato - CUSTO_ASSERTIVA,
                cacheId: novoCache.id
              }
            });

            return leadEnriquecido;
          } catch (enriquecimentoError: any) {
            console.error(`[Mineracao] Erro ao enriquecer ${tipoDOC} ${docLimpo}:`, enriquecimentoError?.message);
            // Retornar proprietário sem enriquecimento para não quebrar o lote
            return p as LeadEnriquecido;
          }
        })
      );

      leadsEnriquecidos.push(...resultadosLote);

      if (i + BATCH_SIZE_ASSERTIVA < proprietariosNovos.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_LOTES_ASSERTIVA));
      }
    }

    // Adicionar proprietários sem CPF
    for (const p of proprietariosSemCpf) {
      leadsEnriquecidos.push(p as LeadEnriquecido);
    }

    // Atualizar métricas do tenant
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        totalConsultas: { increment: cpfsDaApi },
        taxaCacheHit: cpfsDoCache > 0 ? cpfsDoCache / (cpfsDoCache + cpfsDaApi) : 0
      }
    });

    console.log(`[Mineracao] Cache: ${cpfsDoCache} hits, API: ${cpfsDaApi} novas consultas`);

    // 4. Persistência
    const resultadosPersistidos = await Promise.all(
      leadsEnriquecidos.map(async (dados) => {
        if (!dados.nome) return dados;

        // Fallback: se apartamento não está definido, tentar parsear do campo incompl
        if (!dados.apartamento && dados.incompl) {
          const dadosParsed = parsearEnderecoPrefeitura(dados.incompl);
          if (dadosParsed.apartamento) dados.apartamento = dadosParsed.apartamento;
          if (dadosParsed.bloco) dados.bloco = dadosParsed.bloco;
          if (dadosParsed.box) dados.box = dadosParsed.box;
          if (dadosParsed.unidade) dados.unidade = dadosParsed.unidade;
          if (dadosParsed.quadra) dados.quadra = dadosParsed.quadra;
          if (dadosParsed.lote) dados.lote = dadosParsed.lote;
        }

        const cpfFinal = dados.cpf || `00000000000-${Math.random().toString().slice(2, 5)}`;

        // NOTA: NÃO criamos Lead aqui!
        // Leads só devem ser criados após qualificação SPIN
        // Os dados são retornados para o frontend que deve:
        // 1. Criar uma Campanha
        // 2. Vincular os dados como Contatos (não Leads)
        // 3. Disparar prospecção IA
        // 4. IA qualifica e converte Contato → Lead

        // Apenas persistimos o imóvel (dado valioso de referência)
        let imovelId: string | null = null;
        try {
          const imovel = await prisma.imovel.upsert({
            where: { inscricaoIptu: dados.nrinscr },
            update: {
              nomeEdificio: dados.nomeEdificio || dados.nmedificio,
              bairro: dados.nmbairro,
              logradouro: dados.nmlogradou,
              complemento: dados.incompl,
              apartamento: dados.apartamento,
              bloco: dados.bloco,
              unidade: dados.unidade,
              box: dados.box,
              quadra: dados.quadra,
              lote: dados.lote,
              tipoImovel: dados.tipoImovel,
            },
            create: {
              inscricaoIptu: dados.nrinscr,
              nomeEdificio: dados.nomeEdificio || dados.nmedificio,
              bairro: dados.nmbairro || 'Desconhecido',
              logradouro: dados.nmlogradou || 'Desconhecido',
              complemento: dados.incompl,
              apartamento: dados.apartamento,
              bloco: dados.bloco,
              unidade: dados.unidade,
              box: dados.box,
              quadra: dados.quadra,
              lote: dados.lote,
              tipoImovel: dados.tipoImovel,
              statusCaptacao: 'IDENTIFICADO'
            }
          });
          imovelId = imovel.id;
        } catch (e) {
          console.error(`[Mineracao] Erro ao salvar imóvel ${dados.nrinscr}:`, e);
        }

        // Retornar dados enriquecidos (sem leadId - será criado via fluxo correto)
        return {
          ...dados,
          cpf: cpfFinal,
          imovelId,
          // Dados prontos para criar Contato
          telefone: dados.telefones?.[0]?.numero || null,
          email: dados.emails?.[0] || null,
        };
      })
    );

    // Contagem de resultados
    const comTelefone = resultadosPersistidos.filter(r => r.telefones && r.telefones.length > 0).length;
    const comEmail = resultadosPersistidos.filter(r => r.emails && r.emails.length > 0).length;
    const comImovel = resultadosPersistidos.filter(r => r.imovelId).length;

    return res.json({
      total: resultadosPersistidos.length,
      comTelefone,
      comEmail,
      comImovel,
      doCache: cpfsDoCache,
      dApi: cpfsDaApi,
      economia: economiaTotal,
      dados: resultadosPersistidos,
      // IMPORTANTE: Instruções para o frontend
      instrucoes: {
        mensagem: 'Dados enriquecidos. Para prospectar, vincule a uma Campanha e crie Contatos.',
        proximoPasso: 'POST /api/campanhas/:id/vincular-leads-minerados'
      }
    });

  } catch (error: any) {
    console.error('[ERRO] confirmar-leads falhou:', error?.message || error);
    console.error('[ERRO] Stack:', error?.stack);
    // console.error('[ERRO] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return res.status(500).json({ erro: 'Falha ao confirmar leads', detalhes: error?.message });
  }
});


// ============================================
// BUSCA UNITÁRIA (Flow "Novo Lead por IPTU")
// ============================================

/**
 * POST /iptu-unitario
 * Realiza o fluxo completo para um único IPTU:
 * 1. Scraper Prefeitura (identifica proprietário/CPF)
 * 2. Assertiva (enriquece contatos)
 * 3. Consumo de Créditos
 */
router.post('/iptu-unitario', async (req, res) => {
  try {
    const { iptu } = req.body;

    if (!iptu) {
      return res.status(400).json({ erro: 'IPTU é obrigatório' });
    }

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    console.log(`[Mineracao] 🔎 Iniciando busca unitária para IPTU ${iptu}`);

    // 1. Verificar saldo inicial (pelo menos 1 crédito para começar)
    if (!(await servicoCreditos.temCreditos(tenantId))) {
      return res.status(402).json({
        erro: 'Sem créditos disponíveis',
        mensagem: 'Recarregue seus créditos para usar a Busca Inteligente.'
      });
    }

    // 2. SCRAPER PREFEITURA
    let dadosProprietario;
    try {
      dadosProprietario = await scraperIPTU.consultarProprietario(iptu);
    } catch (error) {
      console.error(`[Mineracao] Erro no scraper para IPTU ${iptu}:`, error);
      return res.status(404).json({
        erro: 'Dados não encontrados na Prefeitura',
        detalhes: 'Verifique se o número do IPTU está correto.'
      });
    }

    // REMOVIDO: Cobrança pelo scraper.
    // Nova Regra: Cobrar APENAS se houver enriquecimento com contatos (telefone).

    // Se não tiver CPF/CNPJ, retorna o que achou (apenas dados do imóvel/proprietário básico)
    if (!dadosProprietario.cpf) {
      return res.json({
        encontrado: true,
        tipo: 'BASICO',
        mensagem: 'Proprietário identificado, mas sem CPF cadastrado na Prefeitura.',
        imovel: {
          endereco: dadosProprietario.endereco_correspondencia,
          tipo: dadosProprietario.tipoImovel,
          // Mapear campos parseados
          ...dadosProprietario
        },
        proprietario: {
          nome: dadosProprietario.nome,
          cpf: null,
          telefones: [],
          emails: []
        },
        creditosConsumidos: 0 // Gratuito se não achou CPF
      });
    }

    // 3. ENRIQUECIMENTO ASSERTIVA
    let dadosEnriquecidos;
    let creditosConsumidosCount = 0;

    try {
      // Remover máscara do CPF/CNPJ
      const docLimpo = dadosProprietario.cpf.replace(/\D/g, '');

      // Enriquecer
      dadosEnriquecidos = await assertivaService.enriquecerDocumento(
        docLimpo,
        dadosProprietario.nome
      );

      // Cobrar crédito SE encontrou telefone (Regra de Negócio: Pagamos por contato)
      if (dadosEnriquecidos.telefones && dadosEnriquecidos.telefones.length > 0) {
        try {
          // Cobramos 1 crédito pelo Lead completo (Endereço + Proprietário + Contatos)
          await servicoCreditos.consumirCredito(tenantId);
          creditosConsumidosCount = 1;
        } catch (e) {
          console.warn('[Mineracao] Falha ao cobrar crédito do enriquecimento');
        }
      }

    } catch (error) {
      console.error('[Mineracao] Erro no enriquecimento:', error);
      // Se falhar o enriquecimento, segue com dados básicos do scraper
      dadosEnriquecidos = null;
    }

    // 4. FORMATAR RESPOSTA FINAL
    const proprietarioFinal = dadosEnriquecidos ? {
      nome: dadosEnriquecidos.nome,
      cpf: dadosEnriquecidos.cpf, // ou CNPJ
      cpfEnriquecido: dadosEnriquecidos.cpf,
      telefones: dadosEnriquecidos.telefones.map(t => `(${t.numero.slice(0, 2)}) ${t.numero.slice(2)}`), // Formatar visualmente
      emails: dadosEnriquecidos.emails,
      score: dadosEnriquecidos.score,
      // Extras
      idade: dadosEnriquecidos.idade,
      profissao: dadosEnriquecidos.profissao,
      rendaEstimada: dadosEnriquecidos.rendaEstimada
    } : {
      nome: dadosProprietario.nome,
      cpf: dadosProprietario.cpf,
      telefones: [],
      emails: [],
      score: null
    };

    return res.json({
      encontrado: true,
      tipo: dadosEnriquecidos ? 'ENRIQUECIDO' : 'BASICO',
      imovel: {
        endereco: dadosProprietario.endereco_correspondencia,
        area: 'N/D', // Scraper atual não pega área construída, futuro improvement
        valorVenal: 'N/D',
        // Dados parseados úteis
        apartamento: dadosProprietario.apartamento,
        bloco: dadosProprietario.bloco,
        edificio: dadosProprietario.nomeEdificio
      },
      proprietario: proprietarioFinal,
      creditosConsumidos: creditosConsumidosCount
    });

  } catch (error: any) {
    console.error('[Mineracao] Erro fatal na busca unitária:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

export default router;
