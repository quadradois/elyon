import { getRedisClient } from '../lib/redis';
import { mapaService } from './mapa';
import axios from 'axios'; // Importar axios para fazer chamadas diretas se necessário

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

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
            // Implementação manual do loop para ter controle de progresso

            // 1. Contar total
            const countResponse = await axios.get(MAPA_API_URL, {
                params: {
                    where: `cdbairro = ${job.codigo}`,
                    returnCountOnly: true,
                    f: 'json'
                },
                timeout: 30000
            });

            const total = countResponse.data.count || 0;
            await atualizarJob(jobId, { total });

            if (total > 0) {
                const BATCH_SIZE = 500;
                let offset = 0;

                while (offset < total) {
                    const response = await axios.get(MAPA_API_URL, {
                        params: {
                            where: `cdbairro = ${job.codigo}`,
                            outFields: 'nrinscr,nmlogradou,nmbairro,areaterr,areaedif,incompl,nrimovel,nrquadra,nrlote',
                            orderByFields: 'nrquadra ASC, nrlote ASC',
                            resultOffset: offset,
                            resultRecordCount: BATCH_SIZE,
                            returnGeometry: false,
                            f: 'json'
                        },
                        timeout: 60000
                    });

                    const features = response.data.features || [];

                    const novasCasas = features.map((f: any) => ({
                        nrinscr: f.attributes.nrinscr,
                        nmedificio: '',
                        incompl: f.attributes.nrimovel || f.attributes.incompl || '',
                        nmlogradou: f.attributes.nmlogradou?.trim() || '',
                        nmbairro: f.attributes.nmbairro?.trim() || '',
                        areaedif: f.attributes.areaedif || 0,
                        areaterr: f.attributes.areaterr || 0,
                        nrquadra: f.attributes.nrquadra?.trim() || '',
                        nrlote: f.attributes.nrlote?.trim() || ''
                    }));

                    todasUnidades = [...todasUnidades, ...novasCasas];

                    await atualizarJob(jobId, {
                        processados: todasUnidades.length
                    });

                    offset += BATCH_SIZE;

                    if (features.length < BATCH_SIZE) break;
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
