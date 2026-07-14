import {
  extrairMetadadosMidia,
  montarResumoMidiaParaIA,
  normalizarWebhookEvolutionGo,
} from '../adapters/evolution-go.adapter';

describe('adapter Evolution Go', () => {
  it('mantém payload legado sem alteração', () => {
    const payload = { event: 'MESSAGES_UPSERT', instance: 'principal', data: { key: { id: '1' } } };
    expect(normalizarWebhookEvolutionGo(payload)).toBe(payload);
  });

  it('caracteriza mensagem whatsmeow no contrato Baileys consumido pela rota', () => {
    expect(normalizarWebhookEvolutionGo({
      event: 'message',
      instanceName: 'principal',
      data: {
        Info: { Chat: '5511999999999@s.whatsapp.net', ID: 'msg-1', IsFromMe: false, PushName: 'Lead' },
        Message: { conversation: 'Olá' },
      },
    })).toEqual({
      event: 'MESSAGES_UPSERT',
      instance: 'principal',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'msg-1', remoteJidAlt: undefined },
        message: { conversation: 'Olá' },
        messageType: 'conversation',
        messageTimestamp: undefined,
        pushName: 'Lead',
        mediaUrl: undefined,
      },
    });
  });

  it('extrai e resume mídia sem expor o adapter à rota HTTP', () => {
    const meta = extrairMetadadosMidia({
      message: { documentMessage: { fileName: 'matricula.pdf', mimetype: 'application/pdf', caption: 'Matrícula' } },
    }, 'documentMessage');
    expect(meta).toEqual(expect.objectContaining({ fileName: 'matricula.pdf', mimeType: 'application/pdf' }));
    expect(montarResumoMidiaParaIA('documentMessage', meta)).toContain('matricula.pdf');
  });
});
