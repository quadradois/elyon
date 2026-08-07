import { metricsRegistry } from '../metricas';
import { registrarSpecialistCopilotEvento } from '../agenda-comercial-metrics';

describe('specialist copilot metrics privacy', () => {
  it('normaliza labels e não publica telefone ou conteúdo livre', async () => {
    registrarSpecialistCopilotEvento('telefone 62999990001', 'mensagem livre da Ivonet');
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_specialist_copilot_events_total');
    expect(output).toContain('intencao="unknown"');
    expect(output).not.toContain('62999990001');
    expect(output).not.toContain('Ivonet');
  });
});
