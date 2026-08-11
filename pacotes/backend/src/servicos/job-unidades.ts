import { getRedisClient } from '../lib/redis';
import { mapaService } from './mapa';
import { prisma } from '../lib/db';
import { runWithJobLogContext } from '../lib/log-context';

export interface JobUnidades {
    id: string;
    codigo: number;
    tipo: 'edificio' | 'condominio';
    fonte: 'legado' | 'geo360';
    cidade: string;
    idLote?: number;
    nome?: string;
    status: 'pendente' | 'processando' | 'concluido' | 'erro';
    mensagem?: string;
    total: number;
    processados: number;
    unidades: any[];
    criadoEm: string;
    atualizadoEm: string;
}

const JOB_PREFIX = 'elyon:job:unidades:';
const JOB_TTL_SECONDS = 3600; // 1 hora

// Teto de seguranca. O cruzamento por NOME do bairro (hack de resiliencia, ver
// processarJobUnidades) usa `startsWith` sobre texto livre: um nome como "s a"
// casaria todo bairro iniciado por "s" e o loop pagina ate esgotar, acumulando
// tudo em memoria e numa unica chave Redis. O teto corta no `count`, antes de
// qualquer `findMany` — o custo do abuso vira uma contagem.
// Referencia de tamanho real: o maior condominio horizontal da base tem
// centenas de unidades, nao dezenas de milhares.
const LIMITE_UNIDADES_POR_JOB = 20000;

// ============================================
// FUNÇÕES DO SERVIÇO
// ============================================

/**
 * Cria um novo job de busca de unidades e retorna o ID
 */
export async function criarJobUnidades(
    codigo: number,
    tipo: 'edificio' | 'condominio',
    nome?: string,
    fonte: 'legado' | 'geo360' = 'legado',
    cidade: string = 'goiania',
    idLote?: number
): Promise<string> {
    const redis = await getRedisClient();
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const job: JobUnidades = {
        id: jobId,
        codigo,
        tipo,
        fonte,
        cidade,
        idLote,
        nome,
        status: 'pendente',
        total: 0,
        processados: 0,
        unidades: [],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    // Salvar job no Redis
    await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), { EX: JOB_TTL_SECONDS });

    // Iniciar processamento em background (sem await)
    runWithJobLogContext(jobId, () => processarJobUnidades(jobId)).catch(err => {
        console.error(`[JobUnidades] Erro não tratado no job ${jobId}:`, err);
    });

    return jobId;
}

/**
 * Obtém o status atual do job
 */
export async function obterStatusJobUnidades(jobId: string): Promise<JobUnidades | null> {
    const redis = await getRedisClient();
    const data = await redis.get(`${JOB_PREFIX}${jobId}`);

    if (!data) return null;

    return JSON.parse(data);
}

/**
 * Atualiza o job no Redis
 */
async function atualizarJob(jobId: string, dados: Partial<JobUnidades>): Promise<void> {
    const redis = await getRedisClient();
    const chave = `${JOB_PREFIX}${jobId}`;

    const atual = await redis.get(chave);
    if (!atual) return;

    const job = JSON.parse(atual);
    const novoJob = {
        ...job,
        ...dados,
        atualizadoEm: new Date().toISOString()
    };

    await redis.set(chave, JSON.stringify(novoJob), { EX: JOB_TTL_SECONDS });
}

// ============================================
// PROCESSAMENTO EM BACKGROUND
// ============================================

async function processarJobUnidades(jobId: string): Promise<void> {
    const redis = await getRedisClient();

    // Carregar job
    const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);
    if (!jobData) return;

    const job: JobUnidades = JSON.parse(jobData);

    try {
        await atualizarJob(jobId, { status: 'processando' });
        console.log(`[JobUnidades] Iniciando busca para ${job.tipo} ${job.codigo}...`);

        let todasUnidades: any[] = [];

        if (job.fonte === 'geo360') {
            const idLote = job.idLote || job.codigo;
            const limit = 100;
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const resultado = await mapaService.buscarUnidadesPorLoteGeo360(
                    job.cidade || 'goiania',
                    idLote,
                    offset,
                    limit,
                    job.nome
                );

                if (offset === 0) {
                    await atualizarJob(jobId, { total: resultado.total });
                }

                todasUnidades = [...todasUnidades, ...resultado.unidades];
                await atualizarJob(jobId, {
                    processados: todasUnidades.length
                });

                hasMore = resultado.hasMore;
                offset += limit;

                if (hasMore) await new Promise(r => setTimeout(r, 200));
            }
        } else if (job.tipo === 'edificio') {
            // ============================================
            // LÓGICA PARA EDIFÍCIOS VERTICAIS
            // ============================================
            const limit = 100; // Lotes menores para atualizar progresso
            let offset = 0;
            let hasMore = true;
            let totalEstimado = 0;

            while (hasMore) {
                // Buscar lote
                const resultado = await mapaService.buscarUnidadesPorEdificio(
                    job.codigo,
                    offset,
                    limit,
                    job.nome
                );

                if (offset === 0) {
                    totalEstimado = resultado.total;
                    await atualizarJob(jobId, { total: totalEstimado });
                }

                todasUnidades = [...todasUnidades, ...resultado.unidades];

                // Atualizar progresso
                await atualizarJob(jobId, {
                    processados: todasUnidades.length,
                    // Opcional: salvar unidades parciais se quiser streaming
                    // unidades: todasUnidades
                });

                hasMore = resultado.hasMore;
                offset += limit;

                // Pequeno delay para não sobrecarregar se for loop rápido
                if (hasMore) await new Promise(r => setTimeout(r, 200));
            }

        } else {
            // ============================================
            // LÓGICA PARA CONDOMÍNIOS HORIZONTAIS
            // ============================================
            let whereBairro: any = {
                OR: [
                    { codigoEdificio: null },
                    { nomeEdificio: null },
                    { nomeEdificio: '' }
                ]
            };

            // Hack de Resiliência: Muitas vezes a base da Prefeitura mapeia o Condomínio/Loteamento
            // em um Zoneamento (codigoBairro) diferente do Cadastro Geográfico oficial.
            // Para não retornar 0 casas, vamos tentar cruzar pelo código OU pelo nome textual do bairro.
            if (job.nome) {
                // Separa o loteamento da zona, se necessário, cruzando por texto
                // Ex: "LOT ALPHAVILLE FLAMBOYANT"
                const partesNome = job.nome.split(' ');
                const primeiroNome = partesNome[0] || job.nome;
                const ultimoNome = partesNome[partesNome.length - 1] || job.nome;

                whereBairro = {
                    ...whereBairro,
                    AND: [
                        {
                            OR: [
                                { codigoBairro: job.codigo },
                                { bairro: { equals: job.nome, mode: 'insensitive' } },
                                { 
                                    bairro: { 
                                        startsWith: primeiroNome, 
                                        contains: ultimoNome, 
                                        mode: 'insensitive' 
                                    } 
                                }
                            ]
                        }
                    ]
                };
            } else {
                whereBairro.codigoBairro = job.codigo;
            }

            const total = await prisma.imovel.count({ where: whereBairro });

            if (total > LIMITE_UNIDADES_POR_JOB) {
                await atualizarJob(jobId, {
                    status: 'erro',
                    total,
                    mensagem:
                        `Seleção ampla demais: ${total} unidades (limite ${LIMITE_UNIDADES_POR_JOB}). ` +
                        'Escolha um condomínio ou bairro específico.'
                });
                return;
            }

            await atualizarJob(jobId, { total });

            if (total > 0) {
                const BATCH_SIZE = 500;
                let offset = 0;

                while (offset < total) {
                    const imoveis = await prisma.imovel.findMany({
                        where: whereBairro,
                        skip: offset,
                        take: BATCH_SIZE,
                        orderBy: [
                            { quadra: 'asc' },
                            { lote: 'asc' },
                            { inscricaoIptu: 'asc' }
                        ],
                        select: {
                            inscricaoIptu: true,
                            numero: true,
                            complemento: true,
                            logradouro: true,
                            bairro: true,
                            areaEdificada: true,
                            areaTerreno: true,
                            quadra: true,
                            lote: true
                        }
                    });

                    const novasCasas = imoveis.map((imovel) => ({
                        nrinscr: imovel.inscricaoIptu,
                        nmedificio: '',
                        incompl: imovel.numero || imovel.complemento || '',
                        nmlogradou: imovel.logradouro?.trim() || '',
                        nmbairro: imovel.bairro?.trim() || '',
                        areaedif: imovel.areaEdificada || 0,
                        areaterr: imovel.areaTerreno || 0,
                        nrquadra: imovel.quadra?.trim() || '',
                        nrlote: imovel.lote?.trim() || ''
                    }));

                    todasUnidades = [...todasUnidades, ...novasCasas];

                    await atualizarJob(jobId, {
                        processados: todasUnidades.length
                    });

                    offset += BATCH_SIZE;

                    if (imoveis.length < BATCH_SIZE) break;
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        }

        // Finalizar
        await atualizarJob(jobId, {
            status: 'concluido',
            processados: todasUnidades.length,
            unidades: todasUnidades,
            total: todasUnidades.length // Atualizar total real final
        });

        console.log(`[JobUnidades] Job ${jobId} concluído: ${todasUnidades.length} unidades.`);

    } catch (error: any) {
        console.error(`[JobUnidades] Erro no job ${jobId}:`, error);
        await atualizarJob(jobId, {
            status: 'erro',
            mensagem: error.message || 'Erro desconhecido ao buscar unidades'
        });
    }
}
