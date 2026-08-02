import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string) {
  return readFileSync(resolve(__dirname, '../../src', path), 'utf8');
}

function between(text: string, start: string, end: string) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe('arquitetura de escritores da Agenda', () => {
  it.each([
    ['aprovação do painel', 'rotas/agenda.ts', "router.post('/:id/aprovar'", "const CancelarAgendamentoSchema"],
    ['proposta do painel', 'rotas/agenda.ts', "router.post('/:id/propor-horario'", "router.get('/expediente'"],
    ['aceite público do Lead', 'rotas/leads.ts', "router.post('/confirmar/:atividadeId/:token'", "router.get('/confirmar-corretor"],
    ['aceite público do especialista', 'rotas/leads.ts', "router.post('/confirmar-corretor/:atividadeId/:token'", "router.get('/:id/modo'"],
  ])('%s delega transições ao comando central', (_label, file, start, end) => {
    const section = between(source(file), start, end);
    expect(section).toContain('executarComandoAgenda');
    const directUpdates = section.match(/prisma\.atividade\.update\(\{[\s\S]*?\n\s*\}\);/g) || [];
    for (const update of directUpdates) {
      expect(update).not.toMatch(/statusAgendamento|statusConfirmacaoCorretor|\bversao\b|estadoAgendaAtualizadoEm/);
    }
  });

  it('ferramenta SDR não corrige o agregado depois do comando', () => {
    const section = between(source('ferramentas/sdr-tools-agents.ts'), "if (atividadeAberta)", '} else {');
    expect(section).toContain('executarComandoAgenda');
    expect(section).not.toContain('prisma.atividade.update');
  });
});
