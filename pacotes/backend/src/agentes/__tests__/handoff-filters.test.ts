/**
 * Testes: handoff-filters.ts
 *
 * Cobre:
 * - filterHistoryByQuery: filtragem por regex, preservação de system
 * - sliceHistoryPreservingSystem: trimming com preservação de system e tool_call
 * - removeHandoffNarration: remoção de narração de handoff
 * - gerarBriefingHandoff: (mocka OpenAI) geração de briefing LLM
 */

// Mock do OpenAI
const mockCreate = jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'Lead receptivo, urgente. Evitar comissão.' } }],
});

jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
    }));
});

// Mock do SDK agents (tipo AgentInputItem)
jest.mock('@openai/agents', () => ({}));

import {
    filterHistoryByQuery,
    sliceHistoryPreservingSystem,
    removeHandoffNarration,
    gerarBriefingHandoff,
} from '../handoff-filters';

// Helper: cria item de histórico
function item(role: string, content: string, type?: string): any {
    return { role, content, ...(type ? { type } : {}) };
}

// ====================================
// filterHistoryByQuery
// ====================================

describe('filterHistoryByQuery', () => {
    it('remove mensagens que casam com padrão regex', () => {
        const history = [
            item('user', 'Quero vender'),
            item('assistant', 'Vou te passar para um especialista'),
            item('user', 'Ok'),
        ];
        const result = filterHistoryByQuery(history, [/vou\s+te\s+passar/i]);
        expect(result).toHaveLength(2);
        expect(result.map((i: any) => i.content)).toEqual(['Quero vender', 'Ok']);
    });

    it('preserva mensagens de system SEMPRE', () => {
        const history = [
            item('system', 'Vou te passar — instrução interna'),
            item('assistant', 'Vou te passar para outro agente'),
        ];
        const result = filterHistoryByQuery(history, [/vou\s+te\s+passar/i]);
        expect(result).toHaveLength(1);
        expect((result[0] as any).role).toBe('system');
    });

    it('retorna tudo se nenhum padrão casar', () => {
        const history = [
            item('user', 'Oi'),
            item('assistant', 'Olá!'),
        ];
        const result = filterHistoryByQuery(history, [/nunca_vai_casar/]);
        expect(result).toHaveLength(2);
    });

    it('remove com múltiplos padrões', () => {
        const history = [
            item('assistant', 'Transferindo para o próximo'),
            item('assistant', 'Aguarde um instante'),
            item('user', 'Ok'),
        ];
        const result = filterHistoryByQuery(history, [
            /transferindo/i,
            /aguard[ea]\s+um\s+instante/i,
        ]);
        expect(result).toHaveLength(1);
        expect((result[0] as any).content).toBe('Ok');
    });

    it('funciona com histórico vazio', () => {
        const result = filterHistoryByQuery([], [/test/]);
        expect(result).toHaveLength(0);
    });
});

// ====================================
// sliceHistoryPreservingSystem
// ====================================

describe('sliceHistoryPreservingSystem', () => {
    it('preserva mensagens system mesmo com slice pequeno', () => {
        const history = [
            item('system', 'System prompt'),
            ...Array.from({ length: 30 }, (_, i) => item('user', `Msg ${i}`)),
        ];
        const result = sliceHistoryPreservingSystem(history, 5, 'Teste');
        // system preservado + últimos 15 (mínimo efetivo)
        const systemItems = result.filter((i: any) => i.role === 'system');
        expect(systemItems).toHaveLength(1);
        expect((systemItems[0] as any).content).toBe('System prompt');
    });

    it('preserva tool_call_items', () => {
        const history = [
            item('system', 'Prompt'),
            item('user', 'Msg 1'),
            { role: 'assistant', content: '', type: 'tool_call_item', toolName: 'qualificar_lead' },
            { role: 'assistant', content: '', type: 'tool_call_output_item', toolName: 'qualificar_lead' },
            ...Array.from({ length: 20 }, (_, i) => item('user', `Msg ${i + 2}`)),
        ];
        const result = sliceHistoryPreservingSystem(history, 5, 'Teste');
        const toolItems = result.filter((i: any) =>
            i.type === 'tool_call_item' || i.type === 'tool_call_output_item'
        );
        expect(toolItems).toHaveLength(2);
    });

    it('mínimo efetivo 15 turnos mesmo se pedido menor', () => {
        const history = Array.from({ length: 30 }, (_, i) => item('user', `Msg ${i}`));
        const result = sliceHistoryPreservingSystem(history, 3, 'Teste');
        // Sem system/tool, deve manter 15 últimos
        expect(result).toHaveLength(15);
        expect((result[0] as any).content).toBe('Msg 15');
    });

    it('não corta se histórico é menor que turnsToKeep', () => {
        const history = [
            item('user', 'Msg 1'),
            item('assistant', 'Resp 1'),
            item('user', 'Msg 2'),
        ];
        const result = sliceHistoryPreservingSystem(history, 5, 'Teste');
        expect(result).toHaveLength(3);
    });
});

// ====================================
// removeHandoffNarration
// ====================================

describe('removeHandoffNarration', () => {
    it('remove "transferindo"', () => {
        const history = [
            item('assistant', 'Transferindo para outro setor'),
            item('user', 'Ok'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(1);
        expect((result[0] as any).content).toBe('Ok');
    });

    it('remove "vou te passar"', () => {
        const history = [
            item('assistant', 'Vou te passar para o especialista'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(0);
    });

    it('remove "aguarde um instante"', () => {
        const history = [
            item('assistant', 'Aguarde um instante, por favor'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(0);
    });

    it('remove "já estou aqui"', () => {
        const history = [
            item('assistant', 'Já estou aqui para te ajudar!'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(0);
    });

    it('remove "pronto...aqui"', () => {
        const history = [
            item('assistant', 'Pronto, estou aqui!'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(0);
    });

    it('preserva mensagens normais', () => {
        const history = [
            item('user', 'Quero vender meu apto'),
            item('assistant', 'Quantos quartos tem?'),
        ];
        const result = removeHandoffNarration(history);
        expect(result).toHaveLength(2);
    });
});

// ====================================
// gerarBriefingHandoff
// ====================================

describe('gerarBriefingHandoff', () => {
    beforeEach(() => {
        mockCreate.mockClear();
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: 'Lead receptivo, urgente. Evitar comissão.' } }],
        });
    });

    it('gera briefing com histórico suficiente', async () => {
        const history = [
            item('user', 'Quero vender meu apartamento de 3 quartos no centro'),
            item('assistant', 'Ótimo! Há quanto tempo está tentando vender?'),
            item('user', 'Já faz 6 meses, ninguém aparece'),
        ];
        const result = await gerarBriefingHandoff(history, 'Opener', 'Presenter');
        expect(result).not.toBeNull();
        expect((result as any)?.content).toContain('BRIEFING ESTRATÉGICO');
        expect((result as any)?.content).toContain('Opener → Presenter');
        expect((result as any)?.role).toBe('system');
    });

    it('retorna null se conversa muito curta', async () => {
        const history = [item('user', 'Oi')];
        const result = await gerarBriefingHandoff(history, 'Opener', 'Presenter');
        expect(result).toBeNull();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('retorna null se OpenAI falhar (não-crítico)', async () => {
        mockCreate.mockRejectedValueOnce(new Error('API Error'));
        const history = [
            item('user', 'Quero vender meu apartamento de 3 quartos no centro da cidade'),
            item('assistant', 'Ótimo! Vamos conversar sobre isso'),
        ];
        const result = await gerarBriefingHandoff(history, 'Opener', 'Presenter');
        expect(result).toBeNull();
    });

    it('inclui tool calls no texto enviado à LLM', async () => {
        const history = [
            item('user', 'Quero vender meu apto de 2 quartos, estou pagando caro'),
            { role: 'assistant', content: '', type: 'tool_call_item', toolName: 'qualificar_lead', args: { nota: 8 } },
            { role: 'assistant', content: '', type: 'tool_call_output_item', toolName: 'qualificar_lead', output: '{"ok":true}' },
            item('assistant', 'Anotei! Vamos seguir com o diagnóstico.'),
        ];
        await gerarBriefingHandoff(history, 'Presenter', 'Admin');
        const callArgs = mockCreate.mock.calls[0][0];
        const userMsg = callArgs.messages[1].content;
        expect(userMsg).toContain('TOOL EXECUTADA: qualificar_lead');
        expect(userMsg).toContain('RESULTADO TOOL: qualificar_lead');
    });

    it('chama GPT-4.1-mini com temperature 0.3', async () => {
        const history = [
            item('user', 'Tenho um apartamento de 3 quartos no bairro centro e quero vender'),
            item('assistant', 'Vamos conversar sobre isso!'),
        ];
        await gerarBriefingHandoff(history, 'Opener', 'Presenter');
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gpt-4.1-mini',
                temperature: 0.3,
            })
        );
    });
});
