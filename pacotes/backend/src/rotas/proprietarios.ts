import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';
import { getTenantId } from '../utils/tenant';

const router = Router();

type EstagioFunil = 'Em Prospecção' | 'Respondeu' | 'Qualificado' | 'Em Negociação' | 'Captado';

function calcularEstagio(params: {
  statusProspeccao?: string | null;
  virouLead?: boolean | null;
  statusLead?: string | null;
}): EstagioFunil {
  const statusLead = params.statusLead || '';
  const statusProspeccao = params.statusProspeccao || '';

  if (statusLead === 'CAPTADO') return 'Captado';

  if (params.virouLead || statusLead) {
    if (['NOVO'].includes(statusLead)) return 'Qualificado';
    return 'Em Negociação';
  }

  if (['RESPONDEU', 'INTERESSADO'].includes(statusProspeccao)) return 'Respondeu';
  return 'Em Prospecção';
}

function whereStatusByEstagio(estagio?: string) {
  if (!estagio) return undefined;
  if (estagio === 'Em Prospecção') {
    return {
      virouLead: false,
      statusProspeccao: { in: ['AGUARDANDO', 'CONTATANDO'] }
    };
  }
  if (estagio === 'Respondeu') {
    return {
      virouLead: false,
      statusProspeccao: { in: ['RESPONDEU', 'INTERESSADO'] }
    };
  }
  if (estagio === 'Qualificado') {
    return {
      virouLead: true,
      lead: { status: { in: ['NOVO'] } }
    };
  }
  if (estagio === 'Em Negociação') {
    return {
      virouLead: true,
      lead: { status: { in: ['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'ONBOARDING'] } }
    };
  }
  if (estagio === 'Captado') {
    return {
      virouLead: true,
      lead: { status: { in: ['CAPTADO'] } }
    };
  }
  return undefined;
}

function paraStringOuNull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) return null;
    if (texto.toLowerCase() === '[object object]') return null;
    return texto;
  }
  if (typeof valor === 'number' || typeof valor === 'bigint' || typeof valor === 'boolean') return String(valor);
  if (typeof (valor as any)?.toString === 'function') {
    const convertido = (valor as any).toString();
    return convertido === '[object Object]' ? null : convertido;
  }
  return null;
}

function pareceLogradouro(valor: string | null): boolean {
  if (!valor) return false;
  const t = valor.toUpperCase().trim();
  return /^(RUA|R\.|AV|AV\.|AVENIDA|ALAMEDA|TRAVESSA|RODOVIA|ESTRADA|QD|QUADRA)\b/.test(t);
}

function montarEndereco(logradouro: string | null, numero: string | null, complemento: string | null): string | null {
  const l = paraStringOuNull(logradouro);
  if (!l) return null;
  const n = paraStringOuNull(numero);
  const c = paraStringOuNull(complemento);
  return [l, n, c].filter(Boolean).join(', ');
}

function normalizarLeadParaFrontend(lead: any, contato: any, imovelRef?: any | null) {
  if (!lead) return null;

  const enderecoLead = paraStringOuNull(lead.enderecoImovel);
  const enderecoContato = paraStringOuNull(contato?.enderecoImovel);
  const enderecoRef = montarEndereco(imovelRef?.logradouro || null, imovelRef?.numero || null, imovelRef?.complemento || null);
  const enderecoImovel = enderecoLead ?? enderecoContato ?? enderecoRef;

  const tipoImovel = paraStringOuNull(lead.tipoImovel) ?? paraStringOuNull(contato?.tipoImovel);
  const inscricaoIptu = paraStringOuNull(lead.inscricaoIptu) ?? paraStringOuNull(contato?.inscricaoIptu);
  const bairroBruto = paraStringOuNull(lead.bairroImovel) ?? paraStringOuNull(contato?.bairroImovel);
  const bairroRef = paraStringOuNull(imovelRef?.bairro);
  const bairroImovel =
    !bairroBruto || bairroBruto === enderecoImovel || pareceLogradouro(bairroBruto)
      ? (bairroRef ?? bairroBruto)
      : bairroBruto;
  const nomeEdificio =
    paraStringOuNull(lead.nomeEdificio) ??
    paraStringOuNull(contato?.nomeEdificio) ??
    paraStringOuNull(imovelRef?.nomeEdificio);
  const areaImovel = paraStringOuNull(lead.areaImovel) ?? paraStringOuNull(contato?.areaConstruida);

  return {
    ...lead,
    // Contrato esperado pelos componentes de LeadDetalhes (reutilizados em ProprietárioDetalhes)
    imovel: {
      endereco: enderecoImovel,
      tipo: tipoImovel,
      area: areaImovel,
      quartos: lead.quartosImovel ?? null,
      vagas: lead.vagasImovel ?? null,
      valorPretendido: paraStringOuNull(lead.valorPretendido),
      ocupacao: paraStringOuNull(lead.ocupacaoImovel),
      interesseEm: paraStringOuNull(lead.interesseEm)
    },

    // Mantém campos legados planos usados em trechos da tela
    enderecoImovel,
    tipoImovel,
    areaImovel,
    inscricaoIptu,
    bairroImovel,
    nomeEdificio,

    // Fallback assertiva (quando lead foi criado com dados parciais)
    nome: paraStringOuNull(lead.nome) ?? paraStringOuNull(contato?.nome),
    telefone: paraStringOuNull(lead.telefone) ?? paraStringOuNull(contato?.telefone),
    telefone2: paraStringOuNull(lead.telefone2) ?? paraStringOuNull(contato?.telefone2),
    telefone3: paraStringOuNull(lead.telefone3) ?? paraStringOuNull(contato?.telefone3),
    email: paraStringOuNull(lead.email) ?? paraStringOuNull(contato?.email),
    email2: paraStringOuNull(lead.email2) ?? paraStringOuNull(contato?.email2),
    cpf: paraStringOuNull(lead.cpf) ?? paraStringOuNull(contato?.cpf),
    enderecoPrincipal: paraStringOuNull(lead.enderecoPrincipal) ?? paraStringOuNull(contato?.endereco),
    cidade: paraStringOuNull(lead.cidade) ?? paraStringOuNull(contato?.cidade),
    estado: paraStringOuNull(lead.estado) ?? paraStringOuNull(contato?.estado),
    cep: paraStringOuNull(lead.cep) ?? paraStringOuNull(contato?.cep),
    idade: lead.idade ?? contato?.idade ?? null,
    sexo: paraStringOuNull(lead.sexo) ?? paraStringOuNull(contato?.sexo),
    scoreAssertiva: lead.scoreAssertiva ?? contato?.scoreAssertiva ?? null,
    empresaAtual: paraStringOuNull(lead.empresaAtual) ?? paraStringOuNull(contato?.empresaAtual),
    profissao: paraStringOuNull(lead.profissao) ?? paraStringOuNull(contato?.profissao),
    setor: paraStringOuNull(lead.setor) ?? paraStringOuNull(contato?.setor),
    cnpjEmpresa: paraStringOuNull(lead.cnpjEmpresa) ?? paraStringOuNull(contato?.cnpjEmpresa),
    faixaSalarial: paraStringOuNull(lead.faixaSalarial) ?? paraStringOuNull(contato?.faixaSalarial),
    rendaEstimada: paraStringOuNull(lead.rendaEstimada) ?? paraStringOuNull(contato?.rendaEstimada),
    valorVenal: paraStringOuNull(lead.valorVenal) ?? paraStringOuNull(contato?.valorVenal),
    statusProspeccao: paraStringOuNull(lead.statusProspeccao) ?? paraStringOuNull(contato?.statusProspeccao)
  };
}

// GET /api/proprietarios
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const estagio = req.query.estagio ? String(req.query.estagio) : undefined;
    const campanhaId = req.query.campanhaId ? String(req.query.campanhaId) : undefined;
    const busca = req.query.busca ? String(req.query.busca).trim() : '';

    const where: any = {
      campanha: { tenantId }
    };

    const estagioWhere = whereStatusByEstagio(estagio);
    if (estagioWhere) {
      where.AND = [...(where.AND || []), estagioWhere];
    }

    if (campanhaId) {
      where.AND = [...(where.AND || []), { campanhaId }];
    }

    if (busca) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            { telefone: { contains: busca } },
            { cpf: { contains: busca.replace(/\D/g, '') } },
            { lead: { nome: { contains: busca, mode: 'insensitive' } } },
            { lead: { telefone: { contains: busca } } },
            { lead: { cpf: { contains: busca.replace(/\D/g, '') } } }
          ]
        }
      ];
    }

    const [total, contatos] = await Promise.all([
      prisma.contato.count({ where }),
      prisma.contato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
        include: {
          campanha: {
            select: { id: true, nome: true, nomeEmpreendimento: true }
          },
          lead: {
            select: {
              id: true,
              status: true,
              temperatura: true,
              ultimaInteracao: true
            }
          }
        }
      })
    ]);

    const data = contatos.map((c: any) => {
      const estagioCalc = calcularEstagio({
        statusProspeccao: c.statusProspeccao,
        virouLead: c.virouLead,
        statusLead: c.lead?.status
      });

      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        campanhaId: c.campanhaId,
        campanhaNome: c.campanha?.nome || null,
        empreendimento: c.campanha?.nomeEmpreendimento || null,
        statusProspeccao: c.statusProspeccao,
        virouLead: c.virouLead,
        leadId: c.leadId,
        statusLead: c.lead?.status || null,
        temperatura: c.lead?.temperatura || null,
        estagio: estagioCalc,
        criadoEm: c.criadoEm,
        ultimaInteracao: c.lead?.ultimaInteracao || c.atualizadoEm
      };
    });

    return res.json({
      data,
      metadata: {
        total,
        pagina: page,
        limit,
        totalPaginas: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('[Proprietarios] erro ao listar:', error);
    return responderErro(res, 500, 'Erro ao listar proprietários');
  }
});

// GET /api/proprietarios/:id (aceita contatoId ou leadId)
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const { id } = req.params;

    let contato: any = await prisma.contato.findFirst({
      where: {
        id,
        campanha: { tenantId }
      },
      include: {
        campanha: true,
        lead: true
      }
    });

    if (!contato) {
      contato = await prisma.contato.findFirst({
        where: {
          leadId: id,
          campanha: { tenantId }
        },
        include: {
          campanha: true,
          lead: true
        }
      });
    }

    let lead = contato?.lead || null;
    if (!lead) {
      lead = await prisma.lead.findFirst({
        where: { id, tenantId },
      });
    }

    if (!contato && !lead) {
      return responderErro(res, 404, 'Proprietário não encontrado');
    }

    const contatoId = contato?.id || null;
    const leadId = lead?.id || contato?.leadId || null;

    const [mensagens, atividades, conversas] = await Promise.all([
      contatoId
        ? prisma.mensagemProspeccao.findMany({
            where: { contatoId },
            orderBy: { dataHora: 'desc' },
            take: 50
          })
        : Promise.resolve([]),
      leadId
        ? prisma.atividade.findMany({
            where: { leadId },
            orderBy: { criadoEm: 'desc' },
            take: 50
          })
        : Promise.resolve([]),
      leadId
        ? prisma.conversa.findMany({
            where: { leadId },
            orderBy: { iniciadaEm: 'desc' },
            take: 20,
            include: {
              mensagens: {
                orderBy: { enviadaEm: 'desc' },
                take: 20
              }
            }
          })
        : Promise.resolve([])
    ]);

    const iptuConsulta = paraStringOuNull(lead?.inscricaoIptu) ?? paraStringOuNull(contato?.inscricaoIptu);
    const iptuNumerico = iptuConsulta ? iptuConsulta.replace(/\D/g, '') : null;
    const imovelRef = iptuNumerico
      ? await prisma.imovel.findFirst({
          where: { inscricaoIptu: iptuNumerico },
          select: {
            inscricaoIptu: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            nomeEdificio: true
          }
        })
      : null;

    const leadNormalizado = normalizarLeadParaFrontend(lead, contato, imovelRef);

    const estagio = calcularEstagio({
      statusProspeccao: contato?.statusProspeccao,
      virouLead: contato?.virouLead || !!lead,
      statusLead: lead?.status
    });

    return res.json({
      data: {
        id: contato?.id || lead?.id,
        estagio,
        contato: contato || null,
        lead: leadNormalizado,
        campanha: contato?.campanha || null,
        mensagensProspecao: mensagens,
        atividades,
        conversas
      }
    });
  } catch (error) {
    console.error('[Proprietarios] erro ao detalhar:', error);
    return responderErro(res, 500, 'Erro ao buscar proprietário');
  }
});

// POST /api/proprietarios
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const nome = String(req.body?.nome || '').trim();
    const telefone = String(req.body?.telefone || '').trim();
    const email = req.body?.email ? String(req.body.email).trim() : null;
    const campanhaId = req.body?.campanhaId ? String(req.body.campanhaId) : null;

    if (!nome || !telefone) {
      return responderErro(res, 400, 'Nome e telefone são obrigatórios');
    }

    if (campanhaId) {
      const campanha = await prisma.campanha.findFirst({
        where: { id: campanhaId, tenantId },
        select: { id: true }
      });
      if (!campanha) {
        return responderErro(res, 400, 'Campanha inválida para este tenant');
      }
    }

    const contato = await prisma.contato.create({
      data: {
        nome,
        telefone,
        email,
        campanhaId: campanhaId || undefined
      } as any
    });

    return res.status(201).json({ data: contato });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return responderErro(res, 409, 'Já existe proprietário com este telefone nesta campanha');
    }
    console.error('[Proprietarios] erro ao criar:', error);
    return responderErro(res, 500, 'Erro ao criar proprietário');
  }
});

export default router;
