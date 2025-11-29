import { Router } from 'express';
import { mapaService } from '../servicos/mapa';
import { z } from 'zod';

// Imports dos serviços
import { scraperIPTU } from '../servicos/scraper-iptu';
import { assertivaService } from '../servicos/assertiva';
import { prisma } from '../servidor';

const router = Router();

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

// Rota 1: Identificar Proprietários (Scraper)
router.post('/identificar-proprietarios', async (req, res) => {
  try {
    const { imoveis } = identificarSchema.parse(req.body);
    
    if (imoveis.length === 0) {
      return res.status(400).json({ erro: 'Lista de imóveis vazia' });
    }

    console.log(`[Mineracao] Identificando proprietários de ${imoveis.length} imóveis...`);

    // Garantir que existe um tenant para associar os leads
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { nome: 'Imobiliária Demo', slug: 'demo', status: 'ATIVO' }
      });
    }

    const dadosProprietarios = [];
    
    // Processamento Sequencial (Um por um) para evitar bloqueios e sobrecarga
    for (const imovel of imoveis) {
      // Delay aleatório entre 1s e 2s para parecer humano
      const delay = Math.floor(Math.random() * 1000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);
        
        // Persistência Incremental: Cria um Lead preliminar com os dados do Scraper
        if (dadosScraper.nome && dadosScraper.cpf) {
          try {
            const lead = await prisma.lead.upsert({
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
            });

            await prisma.imovel.update({
              where: { inscricaoIptu: imovel.nrinscr },
              data: {
                leadId: lead.id,
                statusCaptacao: 'IDENTIFICADO'
              }
            });
          } catch (e) {
            console.error(`Erro ao persistir lead parcial para ${imovel.nrinscr}:`, e);
          }
        }

        dadosProprietarios.push({
          ...imovel,
          ...dadosScraper
        });

      } catch (error) {
        console.error(`Erro ao processar imóvel ${imovel.nrinscr}:`, error);
        // Em caso de erro, retorna o imóvel sem dados do scraper para não quebrar o fluxo
        dadosProprietarios.push(imovel);
      }
    }

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

// Rota 2: Confirmar Leads (Enriquecimento + Persistência)
router.post('/confirmar-leads', async (req, res) => {
  try {
    const { proprietarios } = confirmarSchema.parse(req.body);
    
    console.log(`[Mineracao] Enriquecendo e salvando ${proprietarios.length} leads...`);

    // 1. Enriquecimento (CPF -> Contatos)
    const leadsEnriquecidos: LeadEnriquecido[] = await Promise.all(
      proprietarios.map(async (p) => {
        if (p.cpf && p.nome) {
          const enriquecido = await assertivaService.enriquecerCPF(p.cpf, p.nome);
          return { ...p, ...enriquecido } as LeadEnriquecido;
        }
        return p as LeadEnriquecido;
      })
    );

    // 2. Persistência (Salvar no Banco)
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
      dados: resultadosPersistidos
    });

  } catch (error) {
    console.error('Erro ao confirmar leads:', error);
    return res.status(500).json({ erro: 'Falha ao confirmar leads' });
  }
});

export default router;
