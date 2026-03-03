import { getRedisClient } from '../lib/redis';
import { mapaService } from './mapa';
import { prisma } from '../lib/db';

export interface JobUnidades {
    id: string;
    codigo: number;
    tipo: 'edificio' | 'condominio';
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

// ============================================
// FUNÇÕES DO SERVIÇO
// ============================================

/**
 * Cria um novo job de busca de unidades e retorna o ID
 */
export async function criarJobUnidades(
    codigo: number,
    tipo: 'edificio' | 'condominio',
    nome?: string
): Promise<string> {
    const redis = await getRedisClient();
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const job: JobUnidades = {
        id: jobId,
        codigo,
        tipo,
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
    processarJobUnidades(jobId).catch(err => {
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

        if (job.tipo === 'edificio') {
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
            const whereBairro = {
                codigoBairro: job.codigo,
                OR: [
                    { codigoEdificio: null },
                    { nomeEdificio: null },
                    { nomeEdificio: '' }
                ]
            };

            const total = await prisma.imovel.count({ where: whereBairro });
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
