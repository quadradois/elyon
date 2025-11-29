import { Router } from 'express';
import { prisma } from '../servidor';

const router = Router();

// GET /api/leads - Retorna apenas leads QUALIFICADOS
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;

    // Base: apenas leads qualificados
    const baseWhere: any = {
      status: 'QUALIFICADO' // 🎯 FILTRO: apenas leads qualificados aparecem!
    };

    // Se tiver busca, adicionar filtros de busca
    const where = busca ? {
      AND: [
        baseWhere,
        {
          OR: [
            { nome: { contains: String(busca), mode: 'insensitive' as const } },
            { email: { contains: String(busca), mode: 'insensitive' as const } },
            { telefone: { contains: String(busca) } },
            { cpf: { contains: String(busca) } }
          ]
        }
      ]
    } : baseWhere;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        campanhaOrigem: true, // Incluir campanha origem
        conversas: {
          orderBy: { iniciadaEm: 'desc' },
          take: 1
        },
        atividades: {
          orderBy: { criadoEm: 'desc' },
          take: 1
        }
      }
    });

    // Formatar para o frontend
    const leadsFormatados = leads.map(lead => {
      // Determinar última interação (atividade ou conversa)
      let ultimaInteracao = 'N/A';
      const ultimaAtividade = lead.atividades[0]?.criadoEm;
      const ultimaConversa = lead.conversas[0]?.iniciadaEm;

      if (ultimaAtividade || ultimaConversa) {
        const data = (ultimaAtividade && ultimaConversa) 
          ? (ultimaAtividade > ultimaConversa ? ultimaAtividade : ultimaConversa)
          : (ultimaAtividade || ultimaConversa);
        
        ultimaInteracao = new Date(data!).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
      }

      return {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        status: lead.status,
        temperatura: lead.temperatura,
        campanhaOrigem: lead.campanhaOrigem?.nome || null, // Badge campanha
        ultimaInteracao
      };
    });

    res.json(leadsFormatados);
  } catch (error) {
    console.error('Erro ao listar leads:', error);
    res.status(500).json({ erro: 'Erro interno ao listar leads' });
  }
});

// POST /api/leads
// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const { nome, telefone, email } = req.body;

    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    // Buscar o primeiro tenant (solução temporária até ter auth completa)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(500).json({ error: 'Nenhum tenant encontrado no sistema.' });
    }

    // Gerar um CPF fictício para leads manuais se não fornecido
    // Formato: MANUAL-{timestamp} para garantir unicidade
    const cpfFicticio = `MANUAL-${Date.now()}`;

    const lead = await prisma.lead.create({
      data: {
        nome,
        telefone,
        email,
        cpf: cpfFicticio,
        tenantId: tenant.id,
        status: 'NOVO',
        temperatura: 'FRIO',
        origem: 'MANUAL'
      }
    });

    res.json(lead);
  } catch (error: any) {
    console.error('Erro ao criar lead:', error);
    res.status(500).json({ error: 'Erro ao criar lead', details: error.message });
  }
});

export default router;
