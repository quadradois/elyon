import { extrairRespostaECot as _extrairRespostaECot } from '../output-extraction';
import { aplicarFiltrosRespostaOrchestrator } from '../response-filters';
import { wrapToolExecute } from '../../ferramentas/tool-wrapper';
import type { EstadoConversa } from '../conversation-state';

const mockPrisma = {
  contato: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
  },
};

jest.mock('../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { QualificarLeadUseCase } from '../../casos-de-uso/agentes/qualificar-lead.usecase';

// Cast para permitir stubs parciais de resultado de run
const extrairRespostaECot = _extrairRespostaECot as (result: any) => ReturnType<typeof _extrairRespostaECot>;

describe('GOV-05 — Regressão E2E Ivonet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('limpa vazamento interno e mantém apenas texto para cliente', () => {
    const estadoBase: EstadoConversa = {
      intencao: 'vender',
      metragem: null,
      ocupacao: null,
      valorPretendido: null,
      jaRespondeuDecisao: true,
      estaAnunciando: true,
      timeline: null,
      perguntasJaFeitas: { prioridade: true, decisaoVenda: true, valor: true },
    };

    const respostaPoluida = `Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.
Qual valor você espera pelo seu apartamento?

{
  "respostaParaOCliente": "Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\\nQual valor você espera pelo seu apartamento?",
  "raciocinio": "Fase descoberta",
  "fase": "DESCOBERTA",
  "pvam": { "A": "ALTO" },
  "spin": { "sinalCompra": "ABERTO" }
}`;

    const extraido = extrairRespostaECot({ finalOutput: respostaPoluida });
    const filtrado = aplicarFiltrosRespostaOrchestrator({
      respostaFinal: extraido.respostaFinal,
      houveHandoff: false,
      tipoAgente: 'SDR',
      agenteQueRespondeuFormatado: 'SDR',
      estadoConversaAtual: estadoBase,
      cotLog: extraido.cotLog,
      nomesToolsTurno: [],
      fallbackAplicadoAtual: 'NONE',
    });

    expect(filtrado.respostaLimpa).toBe(
      'Sim — trabalho com compradores buscando apartamentos no Reserva Buriti.\nQual valor você espera pelo seu apartamento?'
    );
    expect(filtrado.respostaLimpa).not.toContain('raciocinio');
    expect(filtrado.respostaLimpa).not.toContain('"respostaParaOCliente"');
  });

  it('corrige confusão de valor como área no wrapper de tool', async () => {
    const wrapped = wrapToolExecute('qualificar_lead', async (args: any) => {
      return JSON.stringify({ success: true, argsRecebidos: args });
    });

    const raw = await wrapped({
      contatoId: 'contato-ivonet-001',
      temperatura: 'MORNO',
      interesse: 'Vender',
      areaImovel: '350mil',
      valorPretendido: '',
    });

    const parsed = JSON.parse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.argsRecebidos.valorPretendido).toBe('350mil');
    expect(parsed.argsRecebidos.areaImovel).toBe('');
  });

  it('aceita leadId canônico em qualificar_lead no wrapper', async () => {
    const wrapped = wrapToolExecute('qualificar_lead', async (args: any) => {
      return JSON.stringify({ success: true, argsRecebidos: args });
    });

    const raw = await wrapped({
      leadId: 'lead-ivonet-001',
      temperatura: 'MORNO',
      interesse: 'Vender',
      areaImovel: '85m2',
      valorPretendido: '700mil',
      ocupacaoImovel: 'ocupado',
      situacaoAtual: 'anunciando por conta',
    });

    const parsed = JSON.parse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.argsRecebidos.leadId).toBe('lead-ivonet-001');
  });

  it('não persiste campos fantasmas na qualificação do caso Ivonet', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-ivonet-001',
      leadId: 'lead-ivonet-001',
      campanha: { tenantId: 'tenant-1' },
      enderecoImovel: 'Reserva Buriti',
      tipoImovel: 'apartamento',
    });

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: [],
      status: 'QUALIFICADO',
      schemaState: {},
      objecoes: [],
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender',
      tipoImovel: 'apartamento',
      areaImovel: null,
      valorPretendido: '350mil',
      ocupacaoImovel: 'ocupado',
      doresIdentificadas: ['poucas visitas e curiosos'],
      situacaoAtual: 'anunciando por conta',
      motivacaoVenda: 'quer vender',
      consequencias: null,
      custosAtuais: null,
    });
    mockPrisma.atividade.create.mockResolvedValue({});

    const useCase = new QualificarLeadUseCase();
    const result = await useCase.execute({
      contatoId: 'contato-ivonet-001',
      temperatura: 'MORNO',
      interesse: 'Vender',
      areaImovel: '350mil',
      valorPretendido: '350mil',
      ocupacaoImovel: 'ocupado',
      situacaoAtual: 'anunciando por conta',
      doresIdentificadas: ['poucas visitas e curiosos'],
      comCorretorAtualmente: false,
      temDividas: false,
      pressaoTempo: false,
      interesseAvaliacao: false,
      timeline: undefined,
    });

    expect(result.success).toBe(true);
    const updateCallDados = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateCallDados.data.areaImovel).toBeUndefined();
    expect(updateCallDados.data.valorPretendido).toBe('350mil');
    expect(updateCallDados.data.temDividas).toBeUndefined();
    expect(updateCallDados.data.comCorretorAtualmente).toBeUndefined();
    expect(updateCallDados.data.pressaoTempo).toBeUndefined();
    expect(updateCallDados.data.interesseAvaliacao).toBeUndefined();
    expect(updateCallDados.data.prazoDesejado).toBeUndefined();
    expect(updateCallDados.data.urgencia).toBeUndefined();
  });

  it('bloqueia follow-up sem contrato temporal e aceita payload estruturado', async () => {
    const wrapped = wrapToolExecute('agendar_followup', async (args: any) => {
      return JSON.stringify({ success: true, argsRecebidos: args });
    });

    const passado = await wrapped({
      leadId: 'lead-ivonet-001',
      dataRecontato: '01/01/2020',
      motivo: 'cliente pediu para falar depois',
    });
    const parsedPassado = JSON.parse(passado);
    expect(parsedPassado.success).toBe(false);
    expect(parsedPassado.bloqueadoPorValidacao).toBe(true);
    expect(parsedPassado.error).toContain('data e hora');

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dd = String(amanha.getDate()).padStart(2, '0');
    const mm = String(amanha.getMonth() + 1).padStart(2, '0');
    const yyyy = amanha.getFullYear();
    const dataFutura = `${dd}/${mm}/${yyyy} 09:00`;

    const futuro = await wrapped({
      leadId: 'lead-ivonet-001',
      dataRecontato: dataFutura,
      timezoneIana: 'America/Sao_Paulo',
      motivo: 'lead quer retomar com calma',
      mensagemEnvio: 'Posso retomar nosso contato conforme combinado?',
      evidenciaPedido: 'pode me chamar amanha',
      policyVersion: 'followup-v1',
    });
    const parsedFuturo = JSON.parse(futuro);
    expect(parsedFuturo.success).toBe(true);
    expect(parsedFuturo.argsRecebidos.dataRecontato).toBe(dataFutura);
  });

  it('aceita leadId canônico em converter_para_lead (compatível com alias legado)', async () => {
    const wrapped = wrapToolExecute('converter_para_lead', async (args: any) => {
      return JSON.stringify({ success: true, argsRecebidos: args });
    });

    const raw = await wrapped({
      leadId: 'lead-ivonet-001',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      valorPretendido: '700 mil',
      ocupacaoImovel: 'ocupado',
      areaImovel: '120 m2',
      situacaoAtual: 'anunciando por conta',
    });

    const parsed = JSON.parse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.argsRecebidos.leadId).toBe('lead-ivonet-001');
  });

  it('não traduz ausência de especialista como conflito de horário', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00.000Z'));

    const wrapped = wrapToolExecute('agendar_reuniao_closer', async () => {
      return JSON.stringify({
        success: false,
        reasonCode: 'SPECIALIST_NOT_CONFIGURED',
        error: 'Nenhum especialista ativo está configurado para esta campanha.',
      });
    });

    const raw = await wrapped({
      contatoId: 'lead-ivonet-001',
      dataHora: '03/08/2026 08:00',
      observacoesCloser: 'Lead solicitou avaliação.',
    });
    const parsed = JSON.parse(raw);

    expect(parsed.instrucaoParaAgente).toContain('NÃO diga que o horário está indisponível');
    expect(parsed.instrucaoParaAgente).toContain('O horário não foi consultado');
  });
});
