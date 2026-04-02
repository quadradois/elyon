/**
 * Testes: templates-agentes.ts
 *
 * Cobre:
 * - CATALOGO_AGENTES: 4 tipos
 * - listarTiposAgentes: retorna array formatado
 * - buscarTemplate: por tipo, e caso inexistente
 * - gerarSystemPrompt: com e sem RAG, com e sem extras
 * - validarPersonalizacao: ok e erros
 */

import {
    TEMPLATE_SDR_VENDAS,
    TEMPLATE_SDR_LOCACAO,
    TEMPLATE_SDR_CAPTACAO,
    TEMPLATE_DOCUMENTOS,
    CATALOGO_AGENTES,
    listarTiposAgentes,
    buscarTemplate,
    gerarSystemPrompt,
    validarPersonalizacao,
    TipoAgente,
} from '../templates-agentes';

// ====================================
// CATÁLOGO E CONSTANTES
// ====================================

describe('CATALOGO_AGENTES', () => {
    it('tem exatamente 4 tipos', () => {
        expect(Object.keys(CATALOGO_AGENTES)).toHaveLength(4);
    });

    it.each([
        ['SDR_VENDAS', TEMPLATE_SDR_VENDAS],
        ['SDR_LOCACAO', TEMPLATE_SDR_LOCACAO],
        ['SDR_CAPTACAO', TEMPLATE_SDR_CAPTACAO],
        ['DOCUMENTOS', TEMPLATE_DOCUMENTOS],
    ] as const)('contém %s', (tipo, template) => {
        expect(CATALOGO_AGENTES[tipo as TipoAgente]).toBe(template);
    });
});

describe('Templates individuais', () => {
    it.each([
        TEMPLATE_SDR_VENDAS,
        TEMPLATE_SDR_LOCACAO,
        TEMPLATE_SDR_CAPTACAO,
        TEMPLATE_DOCUMENTOS,
    ])('$tipo tem campos obrigatórios', (template) => {
        expect(template.tipo).toBeDefined();
        expect(template.icone).toBeDefined();
        expect(template.titulo).toBeDefined();
        expect(template.descricao).toBeDefined();
        expect(template.corTema).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(template.conhecimento).toBeDefined();
        expect(template.conhecimento.objetivo).toBeTruthy();
        expect(template.conhecimento.instrucoesSistema).toBeTruthy();
        expect(template.conhecimento.etapasFunil.length).toBeGreaterThan(0);
        expect(template.conhecimento.perguntasQualificacao.length).toBeGreaterThan(0);
        expect(template.conhecimento.regrasComportamento.length).toBeGreaterThan(0);
        expect(template.defaultsPersonalizacao).toBeDefined();
        expect(template.defaultsPersonalizacao.nome).toBeTruthy();
    });
});

// ====================================
// listarTiposAgentes
// ====================================

describe('listarTiposAgentes', () => {
    it('retorna 4 agentes', () => {
        const lista = listarTiposAgentes();
        expect(lista).toHaveLength(4);
    });

    it('cada item tem campos do wizard', () => {
        const lista = listarTiposAgentes();
        for (const item of lista) {
            expect(item).toHaveProperty('tipo');
            expect(item).toHaveProperty('icone');
            expect(item).toHaveProperty('titulo');
            expect(item).toHaveProperty('descricao');
            expect(item).toHaveProperty('corTema');
            // Não deve expor conhecimento interno
            expect(item).not.toHaveProperty('conhecimento');
        }
    });
});

// ====================================
// buscarTemplate
// ====================================

describe('buscarTemplate', () => {
    it('retorna template SDR_VENDAS', () => {
        const t = buscarTemplate('SDR_VENDAS');
        expect(t).toBeDefined();
        expect(t!.tipo).toBe('SDR_VENDAS');
    });

    it('retorna template DOCUMENTOS', () => {
        const t = buscarTemplate('DOCUMENTOS');
        expect(t).toBeDefined();
        expect(t!.tipo).toBe('DOCUMENTOS');
    });

    it('retorna undefined para tipo inexistente', () => {
        const t = buscarTemplate('INEXISTENTE' as TipoAgente);
        expect(t).toBeUndefined();
    });
});

// ====================================
// gerarSystemPrompt
// ====================================

describe('gerarSystemPrompt', () => {
    const personalizacao = {
        nome: 'Sofia',
        nomeImobiliaria: 'Imob Teste',
        tom: 'equilibrado',
        usarEmojis: true,
    };

    it('gera prompt com identidade do agente', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao);
        expect(prompt).toContain('Sofia');
        expect(prompt).toContain('Imob Teste');
    });

    it('inclui perguntas de qualificação', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao);
        expect(prompt).toContain('QUALIFICAÇÃO');
    });

    it('inclui gatilhos de temperatura', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao);
        expect(prompt).toContain('QUENTE');
        expect(prompt).toContain('MORNO');
        expect(prompt).toContain('FRIO');
    });

    it('inclui objeções comuns', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao);
        expect(prompt).toContain('OBJEÇÕES');
    });

    it('inclui contexto RAG quando fornecido', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao, 'Imóveis disponíveis na Barra');
        expect(prompt).toContain('CONHECIMENTO ADICIONAL');
        expect(prompt).toContain('Imóveis disponíveis na Barra');
    });

    it('não inclui RAG quando não fornecido', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', personalizacao);
        expect(prompt).not.toContain('CONHECIMENTO ADICIONAL');
    });

    it('inclui bairros quando configurados', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', {
            ...personalizacao,
            bairros: ['Barra', 'Recreio'],
        });
        expect(prompt).toContain('Barra');
        expect(prompt).toContain('Recreio');
    });

    it('inclui diferenciais quando configurados', () => {
        const prompt = gerarSystemPrompt('SDR_VENDAS', {
            ...personalizacao,
            diferenciais: ['Tour Virtual 360°'],
        });
        expect(prompt).toContain('Tour Virtual 360°');
    });

    it('lança erro para tipo inexistente', () => {
        expect(() =>
            gerarSystemPrompt('FAKE' as TipoAgente, personalizacao)
        ).toThrow('Template não encontrado');
    });
});

// ====================================
// validarPersonalizacao
// ====================================

describe('validarPersonalizacao', () => {
    it('valida personalização completa', () => {
        const result = validarPersonalizacao({
            nome: 'Sofia',
            saudacao: 'Olá! Sou a Sofia, como posso ajudar?',
            despedida: 'Obrigada, até breve!',
        });
        expect(result.valido).toBe(true);
        expect(result.erros).toHaveLength(0);
    });

    it('rejeita nome curto', () => {
        const result = validarPersonalizacao({
            nome: 'A',
            saudacao: 'Olá! Como posso ajudar?',
            despedida: 'Até breve! Qualquer dúvida...',
        });
        expect(result.valido).toBe(false);
        expect(result.erros).toContainEqual(expect.stringContaining('Nome'));
    });

    it('rejeita saudação curta', () => {
        const result = validarPersonalizacao({
            nome: 'Sofia',
            saudacao: 'Oi',
            despedida: 'Até breve! Qualquer dúvida...',
        });
        expect(result.valido).toBe(false);
        expect(result.erros).toContainEqual(expect.stringContaining('saudação'));
    });

    it('rejeita despedida curta', () => {
        const result = validarPersonalizacao({
            nome: 'Sofia',
            saudacao: 'Olá! Como posso ajudar?',
            despedida: 'Bye',
        });
        expect(result.valido).toBe(false);
        expect(result.erros).toContainEqual(expect.stringContaining('despedida'));
    });

    it('acumula múltiplos erros', () => {
        const result = validarPersonalizacao({});
        expect(result.valido).toBe(false);
        expect(result.erros.length).toBeGreaterThanOrEqual(3);
    });
});
