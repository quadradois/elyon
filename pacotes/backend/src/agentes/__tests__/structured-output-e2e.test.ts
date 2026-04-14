/**
 * E2E: Structured Output Schemas + Output Extraction Pipeline
 *
 * Valida que os schemas Zod reais (OpenerOutputSchema, PresenterOutputSchema, AdminOutputSchema)
 * parsam corretamente dados realistas e que o pipeline extrairRespostaECot
 * extrai todos os campos corretamente para cada tipo de agente.
 *
 * Isso simula o que o SDK OpenAI faz internamente quando recebe uma resposta
 * da API com response_format: json_schema e valida contra o Zod schema.
 */

import { z } from 'zod';
import { extrairRespostaECot as _extrairRespostaECot } from '../output-extraction';

// Cast para permitir stubs de teste com objetos parciais
const extrairRespostaECot = _extrairRespostaECot as (result: any) => ReturnType<typeof _extrairRespostaECot>;

// ====================================
// RECRIAR SCHEMAS (mesma definição dos agentes)
// Não importamos direto porque os agentes têm imports pesados.
// ====================================

const OpenerOutputSchema = z.object({
    respostaParaOCliente: z.string(),
    raciocinio: z.string(),
    proximoPasso: z.enum([
        'MEIO_CAMPO', 'DESCOBERTA', 'TRANSICAO',
        'PROTOCOLO_RECUO', 'HANDOFF_PRESENTER', 'FOLLOW_UP',
    ]),
    pvamInferido: z.object({
        preco: z.enum(['REALISTA', 'INFLADO', 'DESCONHECIDO']),
        veto: z.enum(['DECIDE_SOZINHO', 'PRECISA_CONSULTAR', 'DESCONHECIDO']),
        ativador: z.enum(['DOR_CLARA', 'INTERESSE_LEVE', 'DESCONHECIDO']),
        momento: z.enum(['ASAP', 'MESES', 'INDEFINIDO', 'DESCONHECIDO']),
    }),
});

const PresenterOutputSchema = z.object({
    respostaParaOCliente: z.string(),
    raciocinio: z.string(),
    proximoPasso: z.enum([
        'DIAGNOSTICO_SPIN', 'PITCH_APRESENTACAO', 'TRATATIVA_OBJECAO',
        'AGENDAMENTO_FINAL', 'FOLLOW_UP',
    ]),
    sinaisDetectados: z.object({
        dorFinanceira: z.enum(['ALTO', 'MEDIO', 'BAIXO']),
        necessidadeGestao: z.enum(['ALTA', 'MEDIA', 'BAIXA']),
        sinalCompra: z.enum(['ABERTO', 'VALIDADO', 'NULO']),
    }),
});

const AdminOutputSchema = z.object({
    respostaParaOCliente: z.string(),
    dadosColetados: z.object({
        cpf: z.string().regex(/^\d{11}$/).nullable().optional(),
        email: z.string().email().nullable().optional(),
        endereco: z.string().nullable().optional(),
        tipoImovel: z.string().nullable().optional(),
        quartos: z.number().nullable().optional(),
        area: z.number().nullable().optional(),
        valorPretendido: z.number().nullable().optional(),
    }),
    proximoPasso: z.enum(['COLETAR_DOCS', 'GERAR_CONTRATO', 'AGENDAR_VISITA', 'COLETAR_DADOS_IMOVEL', 'FINALIZAR']),
});

// ====================================
// CENÁRIOS REALISTAS DE RESPOSTA
// ====================================

describe('Structured Output E2E — Zod Schema Validation', () => {

    // ── OPENER ──
    describe('OpenerOutputSchema', () => {
        const cenarioDescoberta = {
            respostaParaOCliente: 'Boa tarde! Vi que você tem um apartamento no Setor Bueno. Já tentou vender antes?',
            raciocinio: 'Lead novo, Fase Meio-Campo. Preciso fazer discovery sem parecer intrusivo. Vou usar pergunta sobre tentativa anterior.',
            proximoPasso: 'DESCOBERTA' as const,
            pvamInferido: {
                preco: 'DESCONHECIDO' as const,
                veto: 'DESCONHECIDO' as const,
                ativador: 'INTERESSE_LEVE' as const,
                momento: 'DESCONHECIDO' as const,
            },
        };

        const cenarioHandoff = {
            respostaParaOCliente: 'Perfeito! Deixa eu te passar para nossa especialista que vai te apresentar como funciona nosso modelo.',
            raciocinio: 'Lead qualificado: preço realista, decide sozinho, dor financeira clara (IPTU+condomínio). Momento de handoff.',
            proximoPasso: 'HANDOFF_PRESENTER' as const,
            pvamInferido: {
                preco: 'REALISTA' as const,
                veto: 'DECIDE_SOZINHO' as const,
                ativador: 'DOR_CLARA' as const,
                momento: 'ASAP' as const,
            },
        };

        it('parseia cenário DESCOBERTA corretamente', () => {
            const parsed = OpenerOutputSchema.safeParse(cenarioDescoberta);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.proximoPasso).toBe('DESCOBERTA');
                expect(parsed.data.pvamInferido.ativador).toBe('INTERESSE_LEVE');
            }
        });

        it('parseia cenário HANDOFF_PRESENTER corretamente', () => {
            const parsed = OpenerOutputSchema.safeParse(cenarioHandoff);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.pvamInferido.preco).toBe('REALISTA');
                expect(parsed.data.pvamInferido.momento).toBe('ASAP');
            }
        });

        it('REJEITA output com campo PVAM inválido', () => {
            const invalido = { ...cenarioDescoberta, pvamInferido: { ...cenarioDescoberta.pvamInferido, preco: 'BARATISSIMO' } };
            const parsed = OpenerOutputSchema.safeParse(invalido);
            expect(parsed.success).toBe(false);
        });

        it('REJEITA output sem respostaParaOCliente', () => {
            const { respostaParaOCliente, ...semResposta } = cenarioDescoberta;
            const parsed = OpenerOutputSchema.safeParse(semResposta);
            expect(parsed.success).toBe(false);
        });

        it('pipeline extrairRespostaECot extrai corretamente Opener output', () => {
            const result = extrairRespostaECot({ finalOutput: cenarioHandoff });
            expect(result.structuredOutputDetectado).toBe(true);
            expect(result.respostaFinal).toBe(cenarioHandoff.respostaParaOCliente);
            expect(result.cotLog).toBe(cenarioHandoff.raciocinio);
            expect(result.proximoPasso).toBe('HANDOFF_PRESENTER');
            expect(result.dadosEstruturados?.pvamInferido).toEqual(cenarioHandoff.pvamInferido);
        });
    });

    // ── PRESENTER ──
    describe('PresenterOutputSchema', () => {
        const cenarioPitch = {
            respostaParaOCliente: 'Entendi. Então entre condomínio, IPTU e parcela do financiamento, você tá desembolsando quase R$3mil por mês num imóvel que não usa. Isso te incomoda?',
            raciocinio: 'Lead revelou custo: condo R$1200 + IPTU R$800 + financ R$950. Dor financeira alta. Preciso escalar para pitch.',
            proximoPasso: 'PITCH_APRESENTACAO' as const,
            sinaisDetectados: {
                dorFinanceira: 'ALTO' as const,
                necessidadeGestao: 'ALTA' as const,
                sinalCompra: 'ABERTO' as const,
            },
        };

        const cenarioObjecao = {
            respostaParaOCliente: 'Entendo sua preocupação com a comissão. O que a maioria dos proprietários não percebe é que sem gestão profissional, o imóvel fica parado meses — e cada mês são R$3mil de custo.',
            raciocinio: 'Objeção de comissão detectada. Usar reframing: custo de oportunidade > comissão.',
            proximoPasso: 'TRATATIVA_OBJECAO' as const,
            sinaisDetectados: {
                dorFinanceira: 'MEDIO' as const,
                necessidadeGestao: 'MEDIA' as const,
                sinalCompra: 'NULO' as const,
            },
        };

        it('parseia cenário PITCH corretamente', () => {
            const parsed = PresenterOutputSchema.safeParse(cenarioPitch);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.sinaisDetectados.dorFinanceira).toBe('ALTO');
                expect(parsed.data.proximoPasso).toBe('PITCH_APRESENTACAO');
            }
        });

        it('parseia cenário TRATATIVA_OBJECAO corretamente', () => {
            const parsed = PresenterOutputSchema.safeParse(cenarioObjecao);
            expect(parsed.success).toBe(true);
        });

        it('REJEITA sinal SPIN inválido', () => {
            const invalido = { ...cenarioPitch, sinaisDetectados: { ...cenarioPitch.sinaisDetectados, dorFinanceira: 'GIGANTE' } };
            const parsed = PresenterOutputSchema.safeParse(invalido);
            expect(parsed.success).toBe(false);
        });

        it('pipeline extrairRespostaECot extrai sinaisDetectados', () => {
            const result = extrairRespostaECot({ finalOutput: cenarioPitch });
            expect(result.structuredOutputDetectado).toBe(true);
            expect(result.dadosEstruturados?.sinaisDetectados).toEqual(cenarioPitch.sinaisDetectados);
            expect(result.proximoPasso).toBe('PITCH_APRESENTACAO');
        });
    });

    // ── ADMIN ──
    describe('AdminOutputSchema', () => {
        const cenarioColeta = {
            respostaParaOCliente: 'CPF anotado! Agora me passa seu e-mail para enviarmos o contrato.',
            dadosColetados: {
                cpf: '12345678901',
                email: null,
                endereco: null,
                tipoImovel: 'apartamento',
                quartos: 3,
                area: null,
                valorPretendido: null,
            },
            proximoPasso: 'COLETAR_DOCS' as const,
        };

        const cenarioFinalizar = {
            respostaParaOCliente: 'Tudo anotado! Vou gerar seu contrato e te envio em instantes.',
            dadosColetados: {
                cpf: '98765432101',
                email: 'joao@email.com',
                endereco: 'Rua das Flores, 123 - Setor Bueno',
                tipoImovel: 'casa',
                quartos: 4,
                area: 250,
                valorPretendido: 850000,
            },
            proximoPasso: 'GERAR_CONTRATO' as const,
        };

        it('parseia cenário COLETAR_DOCS com dados parciais', () => {
            const parsed = AdminOutputSchema.safeParse(cenarioColeta);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.dadosColetados.cpf).toBe('12345678901');
                expect(parsed.data.dadosColetados.email).toBeNull();
            }
        });

        it('parseia cenário GERAR_CONTRATO com dados completos', () => {
            const parsed = AdminOutputSchema.safeParse(cenarioFinalizar);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.dadosColetados.quartos).toBe(4);
                expect(parsed.data.dadosColetados.valorPretendido).toBe(850000);
            }
        });

        it('REJEITA CPF com formato inválido (com pontos)', () => {
            const invalido = { ...cenarioColeta, dadosColetados: { ...cenarioColeta.dadosColetados, cpf: '123.456.789-01' } };
            const parsed = AdminOutputSchema.safeParse(invalido);
            expect(parsed.success).toBe(false);
        });

        it('REJEITA email inválido', () => {
            const invalido = { ...cenarioFinalizar, dadosColetados: { ...cenarioFinalizar.dadosColetados, email: 'nao-eh-email' } };
            const parsed = AdminOutputSchema.safeParse(invalido);
            expect(parsed.success).toBe(false);
        });

        it('pipeline extrairRespostaECot extrai dadosColetados', () => {
            const result = extrairRespostaECot({ finalOutput: cenarioFinalizar });
            expect(result.structuredOutputDetectado).toBe(true);
            expect(result.respostaFinal).toBe(cenarioFinalizar.respostaParaOCliente);
            expect(result.dadosEstruturados?.dadosColetados).toEqual(cenarioFinalizar.dadosColetados);
        });
    });

    // ── FALLBACK STRING (backward compatibility) ──
    describe('Fallback string (agentes sem resultType)', () => {
        it('extrai string normal quando finalOutput não é objeto estruturado', () => {
            const result = extrairRespostaECot({ finalOutput: 'Resposta simples sem structured output' });
            expect(result.structuredOutputDetectado).toBe(false);
            expect(result.respostaFinal).toBe('Resposta simples sem structured output');
            expect(result.dadosEstruturados).toBeUndefined();
        });

        it('extrai corretamente quando CoT + string misturados', () => {
            const result = extrairRespostaECot({
                finalOutput: '<cot>Raciocínio interno sobre o lead</cot> Entendido! Me conta mais sobre o imóvel.',
            });
            expect(result.structuredOutputDetectado).toBe(false);
            expect(result.respostaFinal).toBe('Entendido! Me conta mais sobre o imóvel.');
            expect(result.cotLog).toBe('<cot>Raciocínio interno sobre o lead</cot>');
        });
    });
});
