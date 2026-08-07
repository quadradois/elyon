import { ehConsultaStatusAgendamento } from '../intencao-status-agendamento';

describe('ehConsultaStatusAgendamento', () => {
  it.each([
    'Veja se tenho algum agendamento ativo!',
    'Meu agendamento foi cancelado?',
    'Qual é o horário do meu atendimento?',
    'Quem é o especialista que vai me ligar?',
    'Existe reunião pendente?',
  ])('reconhece consulta somente leitura: %s', (texto) => {
    expect(ehConsultaStatusAgendamento(texto)).toBe(true);
  });

  it.each([
    'Quero cancelar meu agendamento',
    'Quero marcar uma reunião amanhã',
    'Tenho interesse em vender meu imóvel',
  ])('não confunde comando ou conversa comercial com consulta: %s', (texto) => {
    expect(ehConsultaStatusAgendamento(texto)).toBe(false);
  });
});
