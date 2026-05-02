import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';
import { getTenantId } from '../utils/tenant';

const router = Router();

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EstagioFunil =
  | 'Em Prospecção'
  | 'Respondeu'
  | 'Qualificado'
  | 'Em Negociação'
  | 'Captado'
  | 'Descartado';

// ─── Helpers de estágio ───────────────────────────────────────────────────────

function calcularEstagio(params: {
  statusProspeccao?: string | null;
  statusLead?: string | null;
}): EstagioFunil {
  const statusLead = params.statusLead || '';
  const statusProspeccao = params.statusProspeccao || '';

  // BUG-FIX: SEM_INTERESSE / OPT_OUT / FALHA não são "Em Prospecção"
  if (['SEM_INTERESSE', 'OPT_OUT', 'FALHA'].includes(statusProspeccao)) return 'Descartado';

  if (statusLead === 'CAPTADO') return 'Captado';

  // statusProspeccao === null → virou lead CRM
  if (params.statusProspeccao === null) {
    if (statusLead === 'NOVO') return 'Qualificado';
    return 'Em Negociação';
  }

  if (['RESPONDEU', 'INTERESSADO'].includes(statusProspeccao)) return 'Respondeu';

  return 'Em Prospecção';
}

function whereStatusByEstagio(estagio?: string): Record<string, any> | undefined {
  if (!estagio) return undefined;

  const map: Record<string, Record<string, any>> = {
    'Em Prospecção': { statusProspeccao: { in: ['AGUARDANDO', 'CONTATANDO'] } },
    'Respondeu':     { statusProspeccao: { in: ['RESPONDEU', 'INTERESSADO'] } },
    'Descartado':    { statusProspeccao: { in: ['SEM_INTERESSE', 'OPT_OUT', 'FALHA'] } },
    'Qualificado':   { statusProspeccao: null, status: { in: ['NOVO'] } },
    'Em Negociação': {
      statusProspeccao: null,
      status: { in: ['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'ONBOARDING'] },
    },
    'Captado': { statusProspeccao: null, status: { in: ['CAPTADO'] } },
  };

  return map[estagio] ?? undefined;
}

// ─── Helpers de string ────────────────────────────────────────────────────────

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
  return /^(RUA|R\.|AV|AV\.|AVENIDA|ALAMEDA|TRAVESSA|RODOVIA|ESTRADA|QD|QUADRA)\b/i.test(valor.trim());
}

function montarEndereco(logradouro: string | null, numero: string | null, complemento: string | null): string | null {
  const l = paraStringOuNull(logradouro);
  if (!l) return null;
  return [l, paraStringOuNull(numero), paraStringOuNull(complemento)].filter(Boolean).join(', ');
}

// BUG-FIX: removidos todos os fallbacks `?? contato?.campo` — com Option A o lead É o contato.
// Função simplificada: 120 → 55 linhas.
function normalizarLeadParaFrontend(lead: any, imovelRef?: any | null) {
  if (!lead) return null;

  const enderecoLead = paraStringOuNull(lead.enderecoImovel);
  const enderecoRef  = montarEndereco(imovelRef?.logradouro ?? null, imovelRef?.numero ?? null, imovelRef?.complemento ?? null);
  const enderecoImovel = enderecoLead ?? enderecoRef;

  const bairroBruto = paraStringOuNull(lead.bairroImovel);
  const bairroRef   = paraStringOuNull(imovelRef?.bairro);
  const bairroImovel =
    !bairroBruto || bairroBruto === enderecoImovel || pareceLogradouro(bairroBruto)
      ? (bairroRef ?? bairroBruto)
      : bairroBruto;

  const areaImovel = paraStringOuNull(lead.areaImovel) ?? paraStringOuNull(String(lead.areaConstruida ?? ''));

  return {
    ...lead,
    imovel: {
      endereco:        enderecoImovel,
      tipo:            paraStringOuNull(lead.tipoImovel),
      area:            areaImovel,
      quartos:         lead.quartosImovel ?? null,
      vagas:           lead.vagasImovel ?? null,
      valorPretendido: paraStringOuNull(lead.valorPretendido),
      ocupacao:        paraStringOuNull(lead.ocupacaoImovel),
      interesseEm:     paraStringOuNull(lead.interesseEm),
    },
    spin: {
      situacao: {
        situacaoAtual:        paraStringOuNull(lead.situacaoAtual),
        tempoDecisao:         paraStringOuNull(lead.tempoDecisao),
        tentativasAnteriores: paraStringOuNull(lead.tentativasAnteriores),
        comCorretorAtualmente: lead.comCorretorAtualmente ?? null,
      },
      problema: {
        motivacaoVenda:    paraStringOuNull(lead.motivacaoVenda),
        doresIdentificadas: Array.isArray(lead.doresIdentificadas) ? lead.doresIdentificadas : [],
      },
      implicacao: {
        prazoDesejado: paraStringOuNull(lead.prazoDesejado),
        urgencia:      paraStringOuNull(lead.urgencia),
        consequencias: paraStringOuNull(lead.consequencias),
        custosAtuais:  paraStringOuNull(lead.custosAtuais),
        pressaoTempo:  lead.pressaoTempo ?? null,
      },
      necessidade: {
        expectativaServico: paraStringOuNull(lead.expectativaServico),
        objecoes:           Array.isArray(lead.objecoes) ? lead.objecoes : [],
        interesseAvaliacao: lead.interesseAvaliacao ?? null,
      },
      observacoes: paraStringOuNull(lead.observacoesSpin),
    },
    // Campos planos usados por componentes legados
    enderecoImovel,
    tipoImovel:    paraStringOuNull(lead.tipoImovel),
    areaImovel,
    inscricaoIptu: paraStringOuNull(lead.inscricaoIptu),
    bairroImovel,
    nomeEdificio:  paraStringOuNull(lead.nomeEdificio) ?? paraStringOuNull(imovelRef?.nomeEdificio),
    areaConstruida: areaImovel,
    enderecoPrincipal: paraStringOuNull(lead.enderecoPrincipal),
  };
}

// ─── Helpers de query ─────────────────────────────────────────────────────────

function adicionarFiltroEstagio(base: any, estagio: string): any {
  const sw = whereStatusByEstagio(estagio);
  if (!sw) return base;
  return { ...base, AND: [...(base.AND || []), sw] };
}

// ─── GET /api/proprietarios ───────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const page      = Math.max(1, Number(req.query.page) || 1);
    const limit     = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const skip      = (page - 1) * limit;
    const estagio   = req.query.estagio   ? String(req.query.estagio)   : undefined;
    const campanhaId = req.query.campanhaId ? String(req.query.campanhaId) : undefined;
    const busca     = req.query.busca     ? String(req.query.busca).trim() : '';

    // whereBase: sem filtro de estágio — usado para contar por estágio sem viés
    const whereBase: any = { tenantId };

    if (campanhaId) {
      whereBase.AND = [...(whereBase.AND || []), { campanhaOrigemId: campanhaId }];
    }
    if (busca) {
      whereBase.AND = [
        ...(whereBase.AND || []),
        {
          OR: [
            { nome:     { contains: busca, mode: 'insensitive' } },
            { telefone: { contains: busca } },
            { cpf:      { contains: busca.replace(/\D/g, '') } },
          ],
        },
      ];
    }

    // where: com filtro de estágio para a listagem paginada
    const where = estagio ? adicionarFiltroEstagio(whereBase, estagio) : whereBase;

    const ESTAGIOS: EstagioFunil[] = ['Em Prospecção', 'Respondeu', 'Qualificado', 'Em Negociação', 'Captado', 'Descartado'];

    // BUG-FIX: contar por estágio a partir de whereBase (sem filtro de estágio)
    // para que os chips sempre mostrem o total real de cada coluna.
    const [total, contatos, ...contagensPorEstagio] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { criadoEm: 'desc' },
        include: {
          campanhaOrigem: { select: { id: true, nome: true, nomeEmpreendimento: true } },
        },
      }),
      ...ESTAGIOS.map((e) => prisma.lead.count({ where: adicionarFiltroEstagio(whereBase, e) })),
    ]);

    const countsByEstagio = Object.fromEntries(ESTAGIOS.map((e, i) => [e, contagensPorEstagio[i]]));

    const data = contatos.map((c: any) => ({
      id:               c.id,
      nome:             c.nome,
      telefone:         c.telefone,
      email:            c.email,
      campanhaId:       c.campanhaOrigemId,
      campanhaNome:     c.campanhaOrigem?.nome || null,
      empreendimento:   c.campanhaOrigem?.nomeEmpreendimento || null,
      statusProspeccao: c.statusProspeccao,
      virouLead:        c.statusProspeccao === null,
      statusLead:       c.status || null,
      temperatura:      c.temperatura || null,
      estagio:          calcularEstagio({ statusProspeccao: c.statusProspeccao, statusLead: c.status }),
      criadoEm:         c.criadoEm,
      ultimaInteracao:  c.ultimaInteracao || c.atualizadoEm,
    }));

    return res.json({
      data,
      metadata: {
        total,
        pagina: page,
        limit,
        totalPaginas:    Math.max(1, Math.ceil(total / limit)),
        countsByEstagio, // BUG-FIX: contagens reais por estágio para os chips
      },
    });
  } catch (error) {
    console.error('[Proprietarios] erro ao listar:', error);
    return responderErro(res, 500, 'Erro ao listar proprietários');
  }
});

// ─── GET /api/proprietarios/:id ───────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id, tenantId },
      include: { campanhaOrigem: { include: { empreendimento: true } } },
    });

    if (!lead) return responderErro(res, 404, 'Proprietário não encontrado');

    const leadId      = lead.id;
    const iptuNumerico = lead.inscricaoIptu ? lead.inscricaoIptu.replace(/\D/g, '') : null;

    // BUG-FIX: imovelRef movido para dentro do Promise.all (era sequencial antes)
    const [mensagens, atividades, conversas, imovelRef] = await Promise.all([
      prisma.mensagemProspeccao.findMany({
        where:   { leadId },
        orderBy: { dataHora: 'desc' },
        take:    50,
      }),
      prisma.atividade.findMany({
        where:   { leadId },
        orderBy: { criadoEm: 'desc' },
        take:    50,
      }),
      prisma.conversa.findMany({
        where:   { leadId },
        orderBy: { iniciadaEm: 'desc' },
        take:    20,
        include: { mensagens: { orderBy: { enviadaEm: 'desc' }, take: 20 } },
      }),
      iptuNumerico
        ? prisma.imovel.findFirst({
            where:  { inscricaoIptu: iptuNumerico },
            select: { inscricaoIptu: true, logradouro: true, numero: true, complemento: true, bairro: true, nomeEdificio: true },
          })
        : Promise.resolve(null),
    ]);

    const leadNormalizado = normalizarLeadParaFrontend(lead, imovelRef);
    const estagio = calcularEstagio({ statusProspeccao: lead.statusProspeccao, statusLead: lead.status as string });

    return res.json({
      data: {
        id:    lead.id,
        estagio,
        // BUG-FIX: virouLead calculado explicitamente (campo não existe no model)
        contato: { ...lead, virouLead: lead.statusProspeccao === null },
        lead:    leadNormalizado,
        campanha: (lead as any).campanhaOrigem || null,
        mensagensProspecao: mensagens,
        atividades,
        conversas,
      },
    });
  } catch (error) {
    console.error('[Proprietarios] erro ao detalhar:', error);
    return responderErro(res, 500, 'Erro ao buscar proprietário');
  }
});

// ─── POST /api/proprietarios ──────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return responderErro(res, 401, 'Não autorizado - tenant não identificado');

    const nome      = String(req.body?.nome     || '').trim();
    const telefone  = String(req.body?.telefone || '').trim();
    const email     = req.body?.email     ? String(req.body.email).trim()     : null;
    const campanhaId = req.body?.campanhaId ? String(req.body.campanhaId)      : null;

    if (!nome || !telefone) return responderErro(res, 400, 'Nome e telefone são obrigatórios');

    if (campanhaId) {
      const campanha = await prisma.campanha.findFirst({ where: { id: campanhaId, tenantId }, select: { id: true } });
      if (!campanha) return responderErro(res, 400, 'Campanha inválida para este tenant');
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        nome,
        telefone,
        email,
        campanhaOrigemId: campanhaId || undefined,
        statusProspeccao: campanhaId ? 'AGUARDANDO' : null,
      },
    });

    return res.status(201).json({ data: lead });
  } catch (error: any) {
    if (error?.code === 'P2002') return responderErro(res, 409, 'Já existe proprietário com este telefone nesta campanha');
    console.error('[Proprietarios] erro ao criar:', error);
    return responderErro(res, 500, 'Erro ao criar proprietário');
  }
});

export default router;
