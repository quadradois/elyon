import { Router } from 'express';
import { mapaService } from '../servicos/mapa';
import { z } from 'zod';

// Imports dos serviços
import { scraperIPTU } from '../servicos/scraper-iptu';
import { assertivaService } from '../servicos/assertiva';
import { prisma } from '../servidor';

const router = Router();

// ============================================
// NOVAS ROTAS: Busca Hierárquica
// ============================================

/**
 * GET /api/mineracao/bairros
 * Lista todos os bairros disponíveis para seleção
 */
router.get('/bairros', async (_req, res) => {
  try {
    console.log('[Mineracao] Listando bairros...');
    const bairros = await mapaService.listarBairros();
    
    return res.json({
      total: bairros.length,
      bairros
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar bairros:', error);
    return res.status(500).json({ erro: 'Erro ao listar bairros' });
  }
});

/**
 * GET /api/mineracao/edificios/:cdbairro
 * Lista todos os edifícios de um bairro específico
 */
router.get('/edificios/:cdbairro', async (req, res) => {
  try {
    const cdbairro = parseInt(req.params.cdbairro);
    
    if (isNaN(cdbairro)) {
      return res.status(400).json({ erro: 'Código do bairro inválido' });
    }

    console.log(`[Mineracao] Listando edifícios do bairro ${cdbairro}...`);
    const edificios = await mapaService.listarEdificiosPorBairro(cdbairro);
    
    return res.json({
      total: edificios.length,
      cdbairro,
      edificios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar edifícios:', error);
    return res.status(500).json({ erro: 'Erro ao listar edifícios' });
  }
});

/**
 * GET /api/mineracao/unidades/:cdedificio?offset=0&limit=500&nome=NOME_EDIFICIO
 * Lista todas as unidades de um edifício específico (com paginação)
 * Aceita 'nome' como parâmetro para buscar no cache quando a API falhar
 */
router.get('/unidades/:cdedificio', async (req, res) => {
  try {
    const cdedificio = parseInt(req.params.cdedificio);
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000); // Max 1000
    const nomeEdificio = req.query.nome as string | undefined; // Nome para fallback de cache
    
    if (isNaN(cdedificio)) {
      return res.status(400).json({ erro: 'Código do edifício inválido' });
    }

    console.log(`[Mineracao] Buscando unidades do edifício ${cdedificio} (nome: ${nomeEdificio || 'N/A'}, offset: ${offset}, limit: ${limit})...`);
    const resultado = await mapaService.buscarUnidadesPorEdificio(cdedificio, offset, limit, nomeEdificio);
    
    return res.json({
      total: resultado.total,
      offset,
      limit,
      hasMore: resultado.hasMore,
      cdedificio,
      nomeEdificio: resultado.unidades[0]?.nmedificio || nomeEdificio || '',
      bairro: resultado.unidades[0]?.nmbairro || '',
      unidades: resultado.unidades
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar unidades:', error);
    return res.status(500).json({ erro: 'Erro ao buscar unidades' });
  }
});

/**
 * GET /api/mineracao/buscar-edificios?termo=reserva
 * Busca edifícios por nome (autocomplete)
 */
router.get('/buscar-edificios', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Buscando edifícios por termo: "${termo}"...`);
    const edificios = await mapaService.buscarEdificiosPorNome(termo);
    
    return res.json({
      total: edificios.length,
      termo,
      edificios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar edifícios:', error);
    return res.status(500).json({ erro: 'Erro ao buscar edifícios' });
  }
});

// ============================================
// ROTA: Busca Unificada (Edifícios + Condomínios)
// ============================================

/**
 * GET /api/mineracao/buscar-imoveis?termo=jardins
 * Busca UNIFICADA que retorna tanto edifícios verticais quanto condomínios horizontais
 * Cada resultado indica seu tipo para tratamento diferenciado no frontend
 */
router.get('/buscar-imoveis', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Busca unificada por: "${termo}"...`);

    // Buscar em paralelo: edifícios verticais + condomínios horizontais
    // Limites generosos para garantir resultados abrangentes
    const [edificios, condominios] = await Promise.all([
      mapaService.buscarEdificiosPorNome(termo, 50),      // Até 50 edifícios
      mapaService.buscarCondominiosHorizontais(termo, 100) // Até 100 condomínios (bairros)
    ]);

    // Unificar resultados com tipo identificado
    const resultados = [
      ...edificios.map(e => ({
        codigo: e.codigo,
        nome: e.nome,
        bairro: e.logradouro || '',
        tipo: 'edificio' as const,
        icone: '🏢'
      })),
      ...condominios.map(c => ({
        codigo: c.codigo,
        nome: c.nome,
        bairro: c.nome, // Condomínio horizontal É o bairro
        tipo: 'condominio' as const,
        icone: '🏠'
      }))
    ];

    // Ordenar por relevância (nome começa com o termo primeiro)
    resultados.sort((a, b) => {
      const aStartsWith = a.nome.toUpperCase().startsWith(termo.toUpperCase());
      const bStartsWith = b.nome.toUpperCase().startsWith(termo.toUpperCase());
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.nome.localeCompare(b.nome);
    });

    console.log(`[Mineracao] Encontrados: ${edificios.length} edifícios + ${condominios.length} condomínios`);
    
    return res.json({
      total: resultados.length,
      termo,
      edificios: resultados.filter(r => r.tipo === 'edificio'),
      condominios: resultados.filter(r => r.tipo === 'condominio'),
      resultados // Lista unificada para o wizard
    });
  } catch (error) {
    console.error('[Mineracao] Erro na busca unificada:', error);
    return res.status(500).json({ erro: 'Erro ao buscar imóveis' });
  }
});

// ============================================
// ROTAS: Condomínios Horizontais (Casas)
// ============================================

/**
 * GET /api/mineracao/condominios?termo=jardins
 * Busca condomínios horizontais pelo nome
 * Condomínios horizontais são cadastrados como BAIRROS
 */
router.get('/condominios', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Buscando condomínios horizontais: "${termo}"...`);
    const condominios = await mapaService.buscarCondominiosHorizontais(termo);
    
    return res.json({
      total: condominios.length,
      termo,
      condominios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar condomínios:', error);
    return res.status(500).json({ erro: 'Erro ao buscar condomínios' });
  }
});

/**
 * GET /api/mineracao/casas/:cdbairro
 * Lista TODAS as casas de um condomínio horizontal (busca todas as páginas automaticamente)
 */
router.get('/casas/:cdbairro', async (req, res) => {
  try {
    const cdbairro = parseInt(req.params.cdbairro);
    
    if (isNaN(cdbairro)) {
      return res.status(400).json({ erro: 'Código do condomínio inválido' });
    }

    console.log(`[Mineracao] Buscando TODAS as casas do condomínio ${cdbairro}...`);
    const resultado = await mapaService.listarTodasCasasPorCondominio(cdbairro);
    
    return res.json({
      total: resultado.total,
      cdbairro,
      nomeCondominio: resultado.casas[0]?.nmbairro || '',
      casas: resultado.casas
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar casas:', error);
    return res.status(500).json({ erro: 'Erro ao listar casas' });
  }
});

/**
 * GET /api/mineracao/endereco?rua=...&numero=...
 * Busca imóveis por endereço (rua/avenida + número opcional)
 * Ideal para encontrar casas avulsas ou imóveis específicos
 */
router.get('/endereco', async (req, res) => {
  try {
    const rua = req.query.rua as string;
    const numero = req.query.numero as string | undefined;
    
    if (!rua || rua.length < 3) {
      return res.status(400).json({ erro: 'Nome da rua deve ter pelo menos 3 caracteres' });
    }

    console.log(`[Mineracao] Buscando por endereço: "${rua}" ${numero ? `Nº ${numero}` : ''}...`);
    const imoveis = await mapaService.buscarPorEndereco(rua, numero);
    
    // Separar casas e apartamentos
    const casas = imoveis.filter(i => i.tipo === 'casa');
    const apartamentos = imoveis.filter(i => i.tipo === 'apartamento');
    
    return res.json({
      total: imoveis.length,
      casas: casas.length,
      apartamentos: apartamentos.length,
      rua,
      numero: numero || null,
      imoveis
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar por endereço:', error);
    return res.status(500).json({ erro: 'Erro ao buscar por endereço' });
  }
});

// ============================================
// ROTAS LEGADAS (mantidas para compatibilidade)
// ============================================

// Schema de validação
const buscaSchema = z.object({
  nmedificio: z.string().optional(),
  nmbairro: z.string().optional(),
  nmlogradou: z.string().optional(),
  nrinscr: z.string().optional(),
});

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

// Schema para identificação (Etapa 1)
const identificarSchema = z.object({
  imoveis: z.array(z.object({
    nrinscr: z.string(),
    nmedificio: z.string().optional(),
    incompl: z.string().optional(),
    nmlogradou: z.string().optional(),
    nmbairro: z.string().optional(),
  }))
});

// Rota 1: Identificar Proprietários (Scraper) - OTIMIZADO COM BATCHES
router.post('/identificar-proprietarios', async (req, res) => {
  try {
    const { imoveis } = identificarSchema.parse(req.body);
    
    if (imoveis.length === 0) {
      return res.status(400).json({ erro: 'Lista de imóveis vazia' });
    }

    const inicio = Date.now();
    console.log(`[Mineracao] 🚀 Identificando proprietários de ${imoveis.length} imóveis (modo otimizado)...`);

    // Garantir que existe um tenant para associar os leads
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { nome: 'Imobiliária Demo', slug: 'demo', status: 'ATIVO' }
      });
    }

    // Configuração de paralelismo
    const BATCH_SIZE = 10;  // Processar 10 imóveis por vez
    const DELAY_ENTRE_BATCHES = 500; // 500ms entre batches (evita sobrecarga)
    
    const dadosProprietarios: any[] = [];
    const batches = [];
    
    // Dividir em batches
    for (let i = 0; i < imoveis.length; i += BATCH_SIZE) {
      batches.push(imoveis.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[Mineracao] Dividido em ${batches.length} batches de até ${BATCH_SIZE} imóveis`);

    // Processar cada batch em paralelo
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Processar todos os imóveis do batch em paralelo
      const resultadosBatch = await Promise.all(
        batch.map(async (imovel) => {
          try {
            const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);
            
            // Persistência do lead (não bloqueia)
            if (dadosScraper.nome && dadosScraper.cpf) {
              prisma.lead.upsert({
                where: {
                  tenantId_cpf: {
                    tenantId: tenant!.id,
                    cpf: dadosScraper.cpf
                  }
                },
                update: {
                  nome: dadosScraper.nome,
                  enderecoPrincipal: dadosScraper.endereco_correspondencia
                },
                create: {
                  tenantId: tenant!.id,
                  cpf: dadosScraper.cpf,
                  nome: dadosScraper.nome,
                  enderecoPrincipal: dadosScraper.endereco_correspondencia,
                  origem: 'api_iptu_scraper',
                  status: 'NOVO'
                }
              }).catch(e => console.error(`Erro ao persistir lead ${imovel.nrinscr}:`, e));
            }

            return {
              ...imovel,
              ...dadosScraper
            };
          } catch (error) {
            console.error(`Erro ao processar imóvel ${imovel.nrinscr}:`, error);
            return imovel; // Retorna sem dados do scraper
          }
        })
      );
      
      dadosProprietarios.push(...resultadosBatch);
      
      // Log de progresso
      const processados = Math.min((batchIndex + 1) * BATCH_SIZE, imoveis.length);
      console.log(`[Mineracao] ✓ Batch ${batchIndex + 1}/${batches.length} concluído (${processados}/${imoveis.length})`);
      
      // Delay entre batches (exceto no último)
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES));
      }
    }

    const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`[Mineracao] ✅ Concluído em ${tempoTotal}s (${(imoveis.length / parseFloat(tempoTotal)).toFixed(1)} imóveis/s)`);

    return res.json(dadosProprietarios);
  } catch (error) {
    console.error('Erro ao identificar proprietários:', error);
    return res.status(500).json({ erro: 'Falha na identificação de proprietários' });
  }
});

// Interface para os dados combinados
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
  telefones?: { numero: string; tipo: string; whatsapp: boolean }[];
  emails?: string[];
  leadId?: string;
  imovelId?: string;
}

// Schema para confirmação (Etapa 2)
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
  }))
});

// Rota 2: Confirmar Leads (Enriquecimento + Persistência com DEDUPLIÇÃO) - OTIMIZADO
router.post('/confirmar-leads', async (req, res) => {
  try {
    const { proprietarios } = confirmarSchema.parse(req.body);
    
    const inicio = Date.now();
    console.log(`[Mineracao] 🚀 Processando ${proprietarios.length} leads (modo otimizado)...`);

    // Encontrar ou criar tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('[Mineracao] Criando tenant demo...');
      tenant = await prisma.tenant.create({
        data: {
          nome: 'Imobiliária Demo',
          slug: 'demo',
          status: 'ATIVO'
        }
      });
    }

    // Estatísticas de cache e custos
    let cpfsDoCache = 0;
    let cpfsDaApi = 0;
    let economiaTotal = 0;
    
    // Preços de venda e custo
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

    // 2. Verificar cache para CPFs
    const agora = new Date();
    const cacheExistente = await prisma.cacheCpf.findMany({
      where: {
        cpf: { in: Array.from(cpfsUnicos) },
        expiraEm: { gt: agora }
      }
    });

    const cpfsEmCache = new Map(cacheExistente.map(c => [c.cpf, c]));
    console.log(`[Mineracao] ${cpfsEmCache.size} CPFs encontrados no cache`);

    // 3. Enriquecer proprietários - OTIMIZADO COM PROCESSAMENTO PARALELO
    const leadsEnriquecidos: LeadEnriquecido[] = [];
    const BATCH_SIZE_ASSERTIVA = 5; // Lotes menores para API Assertiva (evitar rate limit)
    const DELAY_ENTRE_LOTES_ASSERTIVA = 300; // 300ms entre lotes

    // Separar proprietários em cache e novos
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

    // Processar cache em paralelo (não tem rate limit)
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

        // Atualizar métricas do cache
        await prisma.cacheCpf.update({
          where: { id: cached.id },
          data: {
            contagemConsultas: { increment: 1 },
            ultimoUsoEm: agora
          }
        });

        // Registrar consulta do cache
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

    // Processar novos CPFs em lotes paralelos (com rate limiting)
    for (let i = 0; i < proprietariosNovos.length; i += BATCH_SIZE_ASSERTIVA) {
      const lote = proprietariosNovos.slice(i, i + BATCH_SIZE_ASSERTIVA);
      
      const resultadosLote = await Promise.all(
        lote.map(async (p) => {
          const cpfLimpo = p.cpf!.replace(/\D/g, '');
          cpfsDaApi++;
          
          const enriquecido = await assertivaService.enriquecerCPF(cpfLimpo, p.nome || '');
          
          const leadEnriquecido = {
            ...p,
            ...enriquecido,
          } as LeadEnriquecido;

          // Salvar no cache (expira em 90 dias) - TODOS OS DADOS
          const expiraEm = new Date();
          expiraEm.setDate(expiraEm.getDate() + 90);

          const novoCache = await prisma.cacheCpf.create({
            data: {
              cpf: cpfLimpo,
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

          // Registrar consulta da API
          await prisma.consultaCpf.create({
            data: {
              tenantId: tenant.id,
              cpf: cpfLimpo,
              veioDoCache: false,
              custoParaNos: CUSTO_ASSERTIVA,
              cobradoDe: precoVendaContato,
              lucro: precoVendaContato - CUSTO_ASSERTIVA,
              cacheId: novoCache.id
            }
          });

          return leadEnriquecido;
        })
      );

      leadsEnriquecidos.push(...resultadosLote);

      // Delay entre lotes para evitar rate limit da Assertiva
      if (i + BATCH_SIZE_ASSERTIVA < proprietariosNovos.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_LOTES_ASSERTIVA));
      }
    }

    // Adicionar proprietários sem CPF (sem enriquecimento)
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

    // 4. Persistência (Salvar no Banco)
    const resultadosPersistidos = await Promise.all(
      leadsEnriquecidos.map(async (dados) => {
        if (!dados.nome) return dados;

        const cpfFinal = dados.cpf || `00000000000-${Math.random().toString().slice(2,5)}`;

        const lead = await prisma.lead.upsert({
          where: {
            tenantId_cpf: {
              tenantId: tenant!.id,
              cpf: cpfFinal
            }
          },
          update: {
            nome: dados.nome,
            telefone: dados.telefones?.[0]?.numero || null,
            email: dados.emails?.[0] || null,
            enderecoPrincipal: dados.endereco_correspondencia,
            origem: 'api_iptu'
          },
          create: {
            tenantId: tenant!.id,
            cpf: cpfFinal,
            nome: dados.nome,
            telefone: dados.telefones?.[0]?.numero || null,
            email: dados.emails?.[0] || null,
            enderecoPrincipal: dados.endereco_correspondencia,
            origem: 'api_iptu',
            status: 'NOVO'
          }
        });

        const imovel = await prisma.imovel.upsert({
          where: { inscricaoIptu: dados.nrinscr },
          update: {
            leadId: lead.id,
            nomeEdificio: dados.nmedificio,
            bairro: dados.nmbairro,
            logradouro: dados.nmlogradou,
            complemento: dados.incompl
          },
          create: {
            inscricaoIptu: dados.nrinscr,
            leadId: lead.id,
            nomeEdificio: dados.nmedificio,
            bairro: dados.nmbairro || 'Desconhecido',
            logradouro: dados.nmlogradou || 'Desconhecido',
            complemento: dados.incompl,
            statusCaptacao: 'IDENTIFICADO'
          }
        });

        return { ...dados, leadId: lead.id, imovelId: imovel.id };
      })
    );

    return res.json({
      total: resultadosPersistidos.length,
      sucesso: resultadosPersistidos.filter(r => r.leadId).length,
      doCache: cpfsDoCache,
      dApi: cpfsDaApi,
      economia: economiaTotal,
      dados: resultadosPersistidos
    });

  } catch (error) {
    console.error('Erro ao confirmar leads:', error);
    return res.status(500).json({ erro: 'Falha ao confirmar leads' });
  }
});

export default router;
