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
import { scraperIPTU } from '../../servicos/scraper-iptu';
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
            
            if (dadosScraper.nome && dadosScraper.cpf) {
              prisma.lead.upsert({
                where: {
                  tenantId_cpf: { tenantId: tenant!.id, cpf: dadosScraper.cpf }
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
    const { proprietarios } = confirmarSchema.parse(req.body);
    
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

    // Processar novos CPFs em lotes
    for (let i = 0; i < proprietariosNovos.length; i += BATCH_SIZE_ASSERTIVA) {
      const lote = proprietariosNovos.slice(i, i + BATCH_SIZE_ASSERTIVA);
      
      const resultadosLote = await Promise.all(
        lote.map(async (p) => {
          const cpfLimpo = p.cpf!.replace(/\D/g, '');
          cpfsDaApi++;
          
          const enriquecido = await assertivaService.enriquecerCPF(cpfLimpo, p.nome || '');
          
          const leadEnriquecido = { ...p, ...enriquecido } as LeadEnriquecido;

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

        const cpfFinal = dados.cpf || `00000000000-${Math.random().toString().slice(2,5)}`;

        const lead = await prisma.lead.upsert({
          where: { tenantId_cpf: { tenantId: tenant!.id, cpf: cpfFinal } },
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
            leadId: lead.id,
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
