import { DecidirCanalRespostaWebhookUseCase } from '../aplicacao/decidir-canal-resposta.usecase';
import { PrepararRespostaWebhookUseCase } from '../aplicacao/preparar-resposta.usecase';
import type { MensagemPendente } from '../dominio/tipos';

const mensagem = (conteudo: string, tipo = 'TEXTO'): MensagemPendente => ({
  conteudo,
  tipo,
  timestamp: 1_700_000_000,
});

describe('casos de uso do webhook', () => {
  const prepararResposta = new PrepararRespostaWebhookUseCase();
  const decidirCanal = new DecidirCanalRespostaWebhookUseCase();

  it('preserva a resposta do orquestrador e troca oferta de e-mail por WhatsApp', () => {
    const resposta = prepararResposta.execute({
      respostaOrquestrador: 'Posso enviar os termos por e-mail.',
      textoConsolidado: 'Pode mandar o documento?',
    });
    expect(resposta).toEqual({
      resposta: 'Posso enviar os termos aqui no WhatsApp.',
      fallbackAplicado: false,
      leadPediuDocumentoAutorizacao: true,
      respostaOfereceuEmail: true,
    });
  });

  it('impede silêncio quando o orquestrador não retorna conteúdo', () => {
    const resposta = prepararResposta.execute({
      respostaOrquestrador: '   ',
      textoConsolidado: 'Quais documentos preciso enviar?',
    });
    expect(resposta.fallbackAplicado).toBe(true);
    expect(resposta.resposta).toContain('dados básicos do imóvel');
  });

  it('responde em áudio quando o lead enviou áudio e não há link operacional', () => {
    expect(decidirCanal.execute({
      resposta: 'Recebi sua mensagem e vou explicar todos os detalhes agora.',
      textoConsolidado: 'áudio recebido',
      mensagens: [mensagem('áudio recebido', 'AUDIO')],
      respostaEmAudioAtiva: true,
      preferenciaAudio: null,
    })).toEqual(expect.objectContaining({ enviarAudio: true, pedirPermissaoAudio: false }));
  });

  it('mantém texto quando a resposta contém link de agendamento', () => {
    expect(decidirCanal.execute({
      resposta: 'Agendamento confirmado: https://calendar.google.com/evento',
      textoConsolidado: 'Pode agendar?',
      mensagens: [mensagem('Pode agendar?')],
      respostaEmAudioAtiva: true,
      preferenciaAudio: 'PERMITIDO',
    }).enviarAudio).toBe(false);
  });
});
