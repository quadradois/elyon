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

import { responderErro } from '../../utilitarios/resposta';
import { Router } from 'express';
import { logger } from '../../lib/logger';
import { mapaService } from '../../servicos/mapa';
import { scraperIPTU, parsearEnderecoPrefeitura } from '../../servicos/scraper-iptu';
import { imoveisRanchoService } from '../../servicos/imoveis-rancho';
import { assertivaService } from '../../servicos/assertiva';
import { prisma } from '../../lib/db';
import { servicoCreditos } from '../../servicos/servico-creditos';
import { z } from 'zod';
import { ServicoAuditoria } from '../../servicos/servico-auditoria';

const router = Router();

// Fonte de identificação de proprietário:
// - USAR_BASE_GEO360 (default ON): consulta a base local `imoveis_rancho` (instantâneo, sem carga na API).
// - GEO360_FALLBACK_SCRAPER (default OFF): se o imóvel não estiver na base, cai no scraper da Prefeitura.
const USAR_BASE_GEO360 = process.env.USAR_BASE_GEO360 !== 'false';
const GEO360_FALLBACK_SCRAPER = process.env.GEO360_FALLBACK_SCRAPER === 'true';

// TTL do cache de CPFs da Assertiva (compartilhado entre todos os tenants):
// Proprietário de imóvel raramente muda telefone em menos de 1 ano.
// Com sliding-window, CPFs consultados frequentemente nunca expiram.
// Valor em dias — alterar aqui afeta tanto criação quanto renovação.
const CACHE_CPF_TTL_DIAS = 365;

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
    nome: z.string().nullable().optional(),
    cpf: z.string().nullable().optional(),
    endereco_correspondencia: z.string().nullable().optional(),
    origem: z.string(),
    nmedificio: z.string().nullable().optional(),
    nmbairro: z.string().nullable().optional(),
    nmlogradou: z.string().nullable().optional(),
    incompl: z.string().nullable().optional(),
    apartamento: z.string().nullable().optional(),
    bloco: z.string().nullable().optional(),
    unidade: z.string().nullable().optional(),
    box: z.string().nullable().optional(),
    quadra: z.string().nullable().optional(),
    lote: z.string().nullable().optional(),
    nomeEdificio: z.string().nullable().optional(),
    tipoImovel: z.string().nullable().optional(),
    areaTerreno: z.union([z.number(), z.string()]).nullable().optional(),
    areaConstruida: z.union([z.number(), z.string()]).nullable().optional(),
    valorVenal: z.union([z.number(), z.string()]).nullable().optional(),
    anoConstituicao: z.union([z.number(), z.string()]).nullable().optional(),
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
  areaTerreno?: number | string;
  areaConstruida?: number | string;
  valorVenal?: number | string;
  anoConstituicao?: number | string;
  telefones?: { numero: string; tipo: string; whatsapp: boolean }[];
  emails?: string[];
  estadoCivil?: string;
  cpfMae?: string;
  escolaridade?: string;
  tipoLogradouro?: string;
  ppe?: boolean;
  obitoProvavel?: boolean;
  participacoesEmpresas?: any[];
  redesSociais?: any[];
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
      return responderErro(res, 400, 'Pelo menos um filtro deve ser fornecido');
    }

    const resultados = await mapaService.buscarImoveis(params);
    return res.json(resultados);
  } catch (error) {
    logger.error(error);
    return responderErro(res, 500, 'Erro interno ao buscar imóveis');
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
      return responderErro(res, 400, 'Lista de imóveis vazia');
    }

    const inicio = Date.now();
    logger.info(`[Mineracao] 🚀 Identificando proprietários de ${imoveis.length} imóveis (modo otimizado)...`);

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.tenantId as string;
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant não identificado. Envie o header X-Tenant-Id.');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 400, 'Tenant não encontrado. Verifique o X-Tenant-Id.');
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

    logger.info(`[Mineracao] 💰 Créditos: ${saldo.total} disponíveis, ${creditosNecessarios} serão consumidos`);

    const BATCH_SIZE = 10;
    const DELAY_ENTRE_BATCHES = 500;

    const dadosProprietarios: any[] = [];
    const batches = [];
    let creditosConsumidos = 0;

    for (let i = 0; i < imoveis.length; i += BATCH_SIZE) {
      batches.push(imoveis.slice(i, i + BATCH_SIZE));
    }

    logger.info(`[Mineracao] Dividido em ${batches.length} batches de até ${BATCH_SIZE} imóveis`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      const resultadosBatch = await Promise.all(
        batch.map(async (imovel) => {
          try {
            // Fonte primária: base local GEO360 (`imoveis_rancho`) — instantânea, sem carga na API.
            // Fallback opcional ao scraper da Prefeitura quando o imóvel não está na base.
            let dadosProprietario: Awaited<ReturnType<typeof imoveisRanchoService.consultarProprietario>>
              | Awaited<ReturnType<typeof scraperIPTU.consultarProprietario>>
              | null = null;

            if (USAR_BASE_GEO360) {
              dadosProprietario = await imoveisRanchoService.consultarProprietario(imovel.nrinscr);
            }
            if (!dadosProprietario && (!USAR_BASE_GEO360 || GEO360_FALLBACK_SCRAPER)) {
              dadosProprietario = await scraperIPTU.consultarProprietario(imovel.nrinscr);
            }

            // Imóvel não encontrado na base e sem fallback → devolve sem proprietário e NÃO cobra crédito.
            if (!dadosProprietario) {
              return imovel;
            }

            // CONSUMIR CRÉDITO após identificação bem-sucedida
            try {
              await servicoCreditos.consumirCredito(tenantId);
              creditosConsumidos++;
            } catch (e) {
              logger.error('Erro registrado');
            }

            // NOTA: Não criamos Lead aqui!
            // Os dados são retornados para o frontend que deve:
            // 1. Vincular a uma Campanha
            // 2. Criar Contatos (não Leads)
            // 3. Leads só são criados após qualificação SPIN
            // Veja: /rotas/campanhas/contatos.rotas.ts

            return { ...imovel, ...dadosProprietario };
          } catch (error) {
            logger.error('Erro registrado');
            return imovel;
          }
        })
      );

      dadosProprietarios.push(...resultadosBatch);

      const processados = Math.min((batchIndex + 1) * BATCH_SIZE, imoveis.length);
      logger.info(`[Mineracao] ✓ Batch ${batchIndex + 1}/${batches.length} concluído (${processados}/${imoveis.length})`);

      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES));
      }
    }

    const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);
    logger.info(`[Mineracao] ✅ Concluído em ${tempoTotal}s (${(imoveis.length / parseFloat(tempoTotal)).toFixed(1)} imóveis/s)`);
    logger.info(`[Mineracao] 💰 Total de créditos consumidos: ${creditosConsumidos}`);

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
    logger.error('Erro');
    return responderErro(res, 500, 'Falha na identificação de proprietários');
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
    logger.info({ body: req.body }, '[DEBUG] /confirmar-leads body');

    let proprietarios;
    try {
      const parsed = confirmarSchema.parse(req.body);
      proprietarios = parsed.proprietarios;
    } catch (zodError) {
      logger.error({ erroZod: zodError }, '[DEBUG] Zod Error');
      return responderErro(res, 400, 'Dados inválidos. Envie { proprietarios: [...] }');
    }

    if (!proprietarios || proprietarios.length === 0) {
      return responderErro(res, 400, 'Nenhum documento/proprietário fornecido para confirmação');
    }

    const inicio = Date.now();
    logger.info(`[Mineracao] 🚀 Processando ${proprietarios.length} leads (modo otimizado)...`);

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.tenantId as string;
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant não identificado. Envie o header X-Tenant-Id.');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 400, 'Tenant não encontrado. Verifique o X-Tenant-Id.');
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

    logger.info(`[Mineracao] ${proprietariosComCpf.length} CPFs únicos, ${proprietariosSemCpf.length} sem CPF`);

    // 2. Verificar cache
    const agora = new Date();
    const cacheExistente = await prisma.cacheCpf.findMany({
      where: {
        cpf: { in: Array.from(cpfsUnicos) },
        expiraEm: { gt: agora }
      }
    });

    const cpfsEmCache = new Map<string, any>(cacheExistente.map((c: any) => [c.cpf, c]));
    logger.info(`[Mineracao] ${cpfsEmCache.size} CPFs encontrados no cache`);

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

    logger.info(`[Mineracao] ${proprietariosDoCache.length} do cache, ${proprietariosNovos.length} novos para API`);

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
          dataNascimento: dadosCache.dataNascimento,
          idade: dadosCache.idade,
          sexo: dadosCache.sexo,
          estadoCivil: dadosCache.estadoCivil,
          signo: dadosCache.signo,
          situacaoCadastral: dadosCache.situacaoCadastral,
          obitoProvavel: dadosCache.obitoProvavel,
          nomeMae: dadosCache.nomeMae,
          cpfMae: dadosCache.cpfMae,
          escolaridade: dadosCache.escolaridade,
          ppe: dadosCache.ppe,
          rendaEstimada: dadosCache.rendaEstimada,
          faixaSalarial: dadosCache.faixaSalarial,
          profissao: dadosCache.profissao,
          setor: dadosCache.setor,
          empresaAtual: dadosCache.empresaAtual,
          cnpjEmpresa: dadosCache.cnpjEmpresa,
          endereco: dadosCache.endereco,
          tipoLogradouro: dadosCache.tipoLogradouro || dadosCache.endereco?.tipoLogradouro,
          participacoesEmpresas: dadosCache.participacoesEmpresas,
          redesSociais: dadosCache.redesSociais,
        } as LeadEnriquecido;

        // COBRANÇA DE CRÉDITO (Apenas se tiver telefone)
        if (leadEnriquecido.telefones && leadEnriquecido.telefones.length > 0) {
          try {
            await servicoCreditos.consumirCredito(tenantId);
          } catch (e) {
            logger.error('Erro registrado');
            // Opcional: Bloquear retorno se não tiver crédito?
            // Por enquanto, apenas logamos e permitimos (política permissiva)
          }
        }

        // Sliding window TTL: renova expiraEm a cada acesso (evita que CPFs consultados frequentemente expirem)
        const novaExpiracao = new Date();
        novaExpiracao.setDate(novaExpiracao.getDate() + CACHE_CPF_TTL_DIAS);
        await prisma.cacheCpf.update({
          where: { id: cached.id },
          data: { contagemConsultas: { increment: 1 }, ultimoUsoEm: agora, expiraEm: novaExpiracao }
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
            logger.info(`[Mineracao] ⚠️ Ignorando documento inválido: ${docLimpo} (${docLimpo.length} dígitos)`);
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
                logger.error('Erro registrado');
              }
            }

            const leadEnriquecido = { ...p, ...enriquecido } as LeadEnriquecido;

            // ✅ TASK-13: Validação Zod antes de persistir no CacheCpf
            // Garante que o retorno é válido e que não estamos guardando lixo de mock no banco (causa raiz corrigida).
            const CacheAntiMockSchema = z.object({
              nome: z.string().optional(),
              telefones: z.array(z.any()).optional(),
              emails: z.array(z.any()).optional()
            }).passthrough().refine(data => {
              const text = JSON.stringify(data).toUpperCase();
              return !text.includes('MARIA FEDERAL') && !text.includes('SERVICOS 123 ME');
            }, "Assinatura de dados mockados detectada. Rejeitando cache.");

            const validacaoZod = CacheAntiMockSchema.safeParse(enriquecido);
            if (!validacaoZod.success) {
              logger.warn(`[Mineracao] 🛡️ Validação Zod bloqueou os dados do CPF ${docLimpo}. Motivo: mock detectado.`);
              return p as LeadEnriquecido; // Retorna sem persistir o array de mock
            }

            const expiraEm = new Date();
            expiraEm.setDate(expiraEm.getDate() + CACHE_CPF_TTL_DIAS);

            const dadosCache = {
              nome: enriquecido.nome,
              telefones: enriquecido.telefones,
              emails: enriquecido.emails,
              score: enriquecido.score,
              dataNascimento: enriquecido.dataNascimento,
              idade: enriquecido.idade,
              sexo: enriquecido.sexo,
              estadoCivil: enriquecido.estadoCivil,
              signo: enriquecido.signo,
              situacaoCadastral: enriquecido.situacaoCadastral,
              obitoProvavel: enriquecido.obitoProvavel,
              nomeMae: enriquecido.nomeMae,
              cpfMae: enriquecido.cpfMae,
              escolaridade: enriquecido.escolaridade,
              ppe: enriquecido.ppe,
              rendaEstimada: enriquecido.rendaEstimada,
              faixaSalarial: enriquecido.faixaSalarial,
              profissao: enriquecido.profissao,
              setor: enriquecido.setor,
              empresaAtual: enriquecido.empresaAtual,
              cnpjEmpresa: enriquecido.cnpjEmpresa,
              endereco: enriquecido.endereco,
              tipoLogradouro: enriquecido.endereco?.tipoLogradouro,
              participacoesEmpresas: enriquecido.participacoesEmpresas,
              redesSociais: enriquecido.redesSociais,
            };

            // Cache em try/catch separado: erro de cache (ex: unique constraint em CPF expirado)
            // NÃO deve descartar os dados enriquecidos pela Assertiva.
            try {
              const novoCache = await prisma.cacheCpf.upsert({
                where: { cpf: docLimpo },
                update: {
                  dados: dadosCache,
                  expiraEm,
                  ultimoUsoEm: new Date(),
                  contagemConsultas: { increment: 1 },
                },
                create: {
                  cpf: docLimpo,
                  dados: dadosCache,
                  fonte: 'assertiva',
                  expiraEm,
                  primeiraConsultaPor: tenant.id,
                },
              });

              await prisma.consultaCpf.create({
                data: {
                  tenantId: tenant.id,
                  cpf: docLimpo,
                  veioDoCache: false,
                  custoParaNos: CUSTO_ASSERTIVA,
                  cobradoDe: precoVendaContato,
                  lucro: precoVendaContato - CUSTO_ASSERTIVA,
                  cacheId: novoCache.id,
                },
              });
            } catch (cacheError: any) {
              // Cache falhou (ex: registro expirado causando conflito), mas os dados da Assertiva são preservados.
              logger.warn(`[Mineracao] ⚠️ Cache upsert falhou para ${tipoDOC} ${docLimpo}: ${cacheError?.message}. Dados enriquecidos mantidos.`);
            }

            // Dados enriquecidos sempre retornados, independente do cache.
            return leadEnriquecido;
          } catch (enriquecimentoError: any) {
            logger.error({ err: enriquecimentoError?.message }, `[Mineracao] Erro ao enriquecer ${tipoDOC} ${docLimpo}:`);

            // Fail-Fast: erros da Assertiva (timeout, auth, rate limit) abortam o lote
            const msgErro = (enriquecimentoError?.message || '').toLowerCase();
            const errosFatais = ['timeout', 'rate limit', 'não autorizado', 'auth', 'falha de comunicação', 'saldo', 'insuficiente', '500', '502', '503', '504', '403', 'credenciais', 'acesso negado', 'forbidden'];

            const ehErroFatal = errosFatais.some(termo => msgErro.includes(termo));

            if (ehErroFatal) {
              throw new Error(`Falha crítica na Assertiva ao enriquecer ${tipoDOC} ${docLimpo}: Contrato bloqueado/inexistente ou credencial inválida. Processo abortado para evitar perda de dados.`);
            }

            // CPF não encontrado na Assertiva: retorna proprietário sem enriquecimento
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

    logger.info(`[Mineracao] Cache: ${cpfsDoCache} hits, API: ${cpfsDaApi} novas consultas`);

    ServicoAuditoria.registrar({
      tenantId: tenant.id,
      usuarioId: req.headers['x-usuario-id'] as string || undefined,
      acao: 'MINERACAO_LOTE',
      detalhes: { cpfsDoCache, cpfsDaApi, economiaTotal, custoCreditos: cpfsDaApi },
      ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
    });

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
          logger.error('Erro registrado');
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
      sucesso: comTelefone,
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
    logger.error({ err: error?.message || error }, '[ERRO] confirmar-leads falhou:');
    logger.error({ err: error?.stack }, '[ERRO] Stack:');
    // logger.error({ err: JSON.stringify(error, Object.getOwnPropertyNames(error }, '[ERRO] Full error:'), 2));
    return responderErro(res, 500, 'Falha ao confirmar leads', {detalhes: error?.message});
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
      return responderErro(res, 400, 'IPTU é obrigatório');
    }

    // Obter tenant do header X-Tenant-Id
    const tenantId = req.tenantId as string;
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    logger.info(`[Mineracao] 🔎 Iniciando busca unitária para IPTU ${iptu}`);

    // 1. Verificar saldo inicial (pelo menos 1 crédito para começar)
    if (!(await servicoCreditos.temCreditos(tenantId))) {
      return responderErro(res, 402, 'Sem créditos disponíveis',
        {mensagem: 'Recarregue seus créditos para usar a Busca Inteligente.'});
    }

    // 2. FONTE: base local GEO360 (`imoveis_rancho`) — fallback opcional ao scraper.
    let dadosProprietario:
      | Awaited<ReturnType<typeof imoveisRanchoService.consultarProprietario>>
      | Awaited<ReturnType<typeof scraperIPTU.consultarProprietario>>
      | null = null;
    try {
      if (USAR_BASE_GEO360) {
        dadosProprietario = await imoveisRanchoService.consultarProprietario(iptu);
      }
      if (!dadosProprietario && (!USAR_BASE_GEO360 || GEO360_FALLBACK_SCRAPER)) {
        dadosProprietario = await scraperIPTU.consultarProprietario(iptu);
      }
    } catch (error) {
      logger.error('Erro registrado');
      return responderErro(res, 404, 'Dados não encontrados',
        {detalhes: 'Verifique se o número do IPTU está correto.'});
    }

    if (!dadosProprietario) {
      return responderErro(res, 404, 'Imóvel não encontrado na base',
        {detalhes: 'Inscrição não localizada na base GEO360 (Goiânia/Aparecida).'});
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
          
          ServicoAuditoria.registrar({
            tenantId,
            usuarioId: req.headers['x-usuario-id'] as string || undefined,
            acao: 'MINERACAO_UNITARIA',
            detalhes: { cpf: docLimpo, encontrouTelefone: true },
            ip: req.socket.remoteAddress || req.headers['x-forwarded-for'] as string
          });
        } catch (e) {
          logger.warn('[Mineracao] Falha ao cobrar crédito do enriquecimento');
        }
      }

    } catch (error) {
      logger.error('Erro');
      // Se falhar o enriquecimento, segue com dados básicos do scraper
      dadosEnriquecidos = null;
    }

    // 4. FORMATAR RESPOSTA FINAL
    const proprietarioFinal = dadosEnriquecidos ? {
      nome: dadosEnriquecidos.nome,
      cpf: dadosEnriquecidos.cpf, // ou CNPJ
      cpfEnriquecido: dadosEnriquecidos.cpf,
      telefones: (dadosEnriquecidos.telefones || []).map(t => `(${t.numero.slice(0, 2)}) ${t.numero.slice(2)}`), // Formatar visualmente
      emails: dadosEnriquecidos.emails || [],
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
        area: dadosProprietario.areaConstruida ?? null,
        areaTerreno: dadosProprietario.areaTerreno ?? null,
        valorVenal: dadosProprietario.valorVenal ?? null,
        anoConstituicao: dadosProprietario.anoConstituicao ?? null,
        // Dados parseados úteis
        apartamento: dadosProprietario.apartamento,
        bloco: dadosProprietario.bloco,
        edificio: dadosProprietario.nomeEdificio
      },
      proprietario: proprietarioFinal,
      creditosConsumidos: creditosConsumidosCount
    });

  } catch (error: any) {
    logger.error('Erro');
    return responderErro(res, 500, 'Erro interno no servidor');
  }
});

export default router;
