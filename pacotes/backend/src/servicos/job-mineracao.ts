/**
 * Serviço de Jobs de Mineração
 * 
 * Processa mineração de proprietários em background usando Redis para:
 * - Armazenar status do job
 * - Salvar progresso em tempo real
 * - Permitir cancelamento
 */

import { getRedisClient } from '../lib/redis';
import { scraperIPTU, parsearEnderecoPrefeitura } from './scraper-iptu';
import { servicoCreditos } from './servico-creditos';
import { prisma } from '../lib/db';

// ============================================
// TIPOS
// ============================================

export interface JobMineracao {
    id: string;
    tenantId: string;
    status: 'aguardando' | 'processando' | 'concluido' | 'erro' | 'cancelado';
    total: number;
    processados: number;
    sucessos: number;
    erros: number;
    creditosConsumidos: number;
    mensagem?: string;
    criadoEm: string;
    atualizadoEm: string;
    proprietarios?: any[];
    modoTeste?: boolean;
}

export interface ImovelInput {
    nrinscr: string;
    nmedificio?: string;
    incompl?: string;
    nmlogradou?: string;
    nmbairro?: string;
}

// ============================================
// CONSTANTES
// ============================================

const JOB_PREFIX = 'elyon:job:mineracao:';
const JOB_TTL_SECONDS = 3600; // 1 hora
const BATCH_SIZE = 10;
const DELAY_ENTRE_BATCHES = 500;

// ============================================
// FUNÇÕES DO SERVIÇO
// ============================================

/**
 * Cria um novo job de mineração e retorna o ID
 */
export async function criarJobMineracao(
    tenantId: string,
    imoveis: ImovelInput[],
    modoTeste: boolean = false
): Promise<string> {
    const redis = await getRedisClient();
    const jobId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const job: JobMineracao = {
        id: jobId,
        tenantId,
        status: 'aguardando',
        total: imoveis.length,
        processados: 0,
        sucessos: 0,
        erros: 0,
        creditosConsumidos: 0,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        modoTeste
    };

    // Salvar job no Redis
    await redis.setEx(
        `${JOB_PREFIX}${jobId}`,
        JOB_TTL_SECONDS,
        JSON.stringify(job)
    );

    // Salvar lista de imóveis para processar
    await redis.setEx(
        `${JOB_PREFIX}${jobId}:imoveis`,
        JOB_TTL_SECONDS,
        JSON.stringify(imoveis)
    );

    // Iniciar processamento em background (não bloqueia)
    processarJobEmBackground(jobId, tenantId).catch(err => {
        console.error(`[JobMineracao] Erro fatal no job ${jobId}:`, err);
    });

    return jobId;
}

/**
 * Obtém status atual do job
 */
export async function obterStatusJob(jobId: string): Promise<JobMineracao | null> {
    const redis = await getRedisClient();
    const data = await redis.get(`${JOB_PREFIX}${jobId}`);

    if (!data) return null;
    return JSON.parse(data) as JobMineracao;
}

/**
 * Obtém resultado completo do job (incluindo proprietários)
 */
export async function obterResultadoJob(jobId: string): Promise<JobMineracao | null> {
    const redis = await getRedisClient();

    const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);
    if (!jobData) return null;

    const job = JSON.parse(jobData) as JobMineracao;

    // Se concluído, buscar resultados
    if (job.status === 'concluido') {
        const resultadoData = await redis.get(`${JOB_PREFIX}${jobId}:resultado`);
        if (resultadoData) {
            job.proprietarios = JSON.parse(resultadoData);
        }
    }

    return job;
}

/**
 * Cancela um job em andamento
 */
export async function cancelarJob(jobId: string): Promise<boolean> {
    const redis = await getRedisClient();
    const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);

    if (!jobData) return false;

    const job = JSON.parse(jobData) as JobMineracao;

    if (job.status !== 'processando' && job.status !== 'aguardando') {
        return false; // Já concluído ou cancelado
    }

    job.status = 'cancelado';
    job.mensagem = 'Job cancelado pelo usuário';
    job.atualizadoEm = new Date().toISOString();

    await redis.setEx(
        `${JOB_PREFIX}${jobId}`,
        JOB_TTL_SECONDS,
        JSON.stringify(job)
    );

    return true;
}

// ============================================
// PROCESSAMENTO EM BACKGROUND
// ============================================

async function processarJobEmBackground(jobId: string, tenantId: string): Promise<void> {
    const redis = await getRedisClient();

    // Carregar imóveis
    const imoveisData = await redis.get(`${JOB_PREFIX}${jobId}:imoveis`);
    if (!imoveisData) {
        await atualizarJob(jobId, { status: 'erro', mensagem: 'Imóveis não encontrados' });
        return;
    }

    let imoveis: ImovelInput[] = JSON.parse(imoveisData);

    // Verificar se é modo teste
    const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);
    const job = jobData ? JSON.parse(jobData) : null;
    const modoTeste = job?.modoTeste === true;

    if (modoTeste) {
        console.log(`[JobMineracao] Job ${jobId} em MODO TESTE (limitando a 5 imóveis)`);
        imoveis = imoveis.slice(0, 5);
    }

    // Verificar tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        await atualizarJob(jobId, { status: 'erro', mensagem: 'Tenant não encontrado' });
        return;
    }

    // Verificar créditos
    const saldo = await servicoCreditos.consultarSaldo(tenantId);
    if (saldo.total < imoveis.length) {
        await atualizarJob(jobId, {
            status: 'erro',
            mensagem: `Créditos insuficientes: ${saldo.total} disponíveis, ${imoveis.length} necessários`
        });
        return;
    }

    // Iniciar processamento
    await atualizarJob(jobId, { status: 'processando' });

    const dadosProprietarios: any[] = [];
    const creditosConsumidos = 0;
    let sucessos = 0;
    let erros = 0;

    // Dividir em batches
    const batches: ImovelInput[][] = [];
    for (let i = 0; i < imoveis.length; i += BATCH_SIZE) {
        batches.push(imoveis.slice(i, i + BATCH_SIZE));
    }

    console.log(`[JobMineracao] Job ${jobId}: ${imoveis.length} imóveis em ${batches.length} batches`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Verificar se foi cancelado
        const jobAtual = await obterStatusJob(jobId);
        if (jobAtual?.status === 'cancelado') {
            console.log(`[JobMineracao] Job ${jobId} cancelado pelo usuário`);
            return;
        }

        const batch = batches[batchIndex];

        const resultadosBatch = await Promise.all(
            batch.map(async (imovel) => {
                try {
                    // 1. Tentar Cache Global (Tabela Contatos)
                    // Verifica se algum tenant já minerou este imóvel e obteve sucesso
                    const contatoCache = await prisma.contato.findFirst({
                        where: {
                            inscricaoIptu: imovel.nrinscr,
                            nome: { not: '' } // Garante que tem nome
                        },
                        orderBy: { criadoEm: 'desc' }, // Pega o mais recente
                        select: {
                            nome: true,
                            cpf: true,
                            enderecoImovel: true,
                            telefonesJson: true,
                            emailsJson: true
                        }
                    });

                    if (contatoCache) {
                        console.log(`[JobMineracao] Cache Hit para IPTU ${imovel.nrinscr}`);

                        // Não cobrar crédito na mineração (cobrança movida para o enriquecimento)
                        // apenas contabilizamos para estatística se necessário, mas aqui será 0

                        sucessos++;
                        return {
                            ...imovel,
                            nome: contatoCache.nome,
                            cpf: contatoCache.cpf,
                            endereco_correspondencia: contatoCache.enderecoImovel,
                            origem: 'CACHE_SISTEMA',
                            cached: true
                        };
                    }

                    // 2. Se não tem cache, faz o scraping
                    const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);

                    // Não cobrar crédito na mineração (cobrança movida para o enriquecimento)

                    // Persistir lead se tiver dados
                    if (dadosScraper.nome && dadosScraper.cpf) {
                        await prisma.lead.upsert({
                            where: {
                                tenantId_cpf: { tenantId: tenant.id, cpf: dadosScraper.cpf }
                            },
                            update: {
                                nome: dadosScraper.nome,
                                enderecoPrincipal: dadosScraper.endereco_correspondencia
                            },
                            create: {
                                tenantId: tenant.id,
                                cpf: dadosScraper.cpf,
                                nome: dadosScraper.nome,
                                enderecoPrincipal: dadosScraper.endereco_correspondencia,
                                origem: 'api_iptu_scraper',
                                status: 'NOVO'
                            }
                        }).catch(e => console.error(`[JobMineracao] Erro ao persistir lead:`, e));
                    }

                    sucessos++;
                    return { ...imovel, ...dadosScraper };
                } catch (error) {
                    console.error(`[JobMineracao] Erro ao processar ${imovel.nrinscr}:`, error);
                    erros++;
                    return { ...imovel, origem: 'ERRO' };
                }
            })
        );

        dadosProprietarios.push(...resultadosBatch);

        // Atualizar progresso
        const processados = Math.min((batchIndex + 1) * BATCH_SIZE, imoveis.length);
        await atualizarJob(jobId, {
            processados,
            sucessos,
            erros,
            creditosConsumidos,
        });

        console.log(`[JobMineracao] Job ${jobId}: Batch ${batchIndex + 1}/${batches.length} (${processados}/${imoveis.length})`);

        // Delay entre batches
        if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES));
        }
    }

    // Salvar resultado
    await redis.setEx(
        `${JOB_PREFIX}${jobId}:resultado`,
        JOB_TTL_SECONDS,
        JSON.stringify(dadosProprietarios)
    );

    // Marcar como concluído
    await atualizarJob(jobId, {
        status: 'concluido',
        processados: imoveis.length,
        sucessos,
        erros,
        creditosConsumidos,
        mensagem: `Concluído: ${sucessos} proprietários identificados`
    });

    console.log(`[JobMineracao] Job ${jobId} concluído: ${sucessos} sucessos, ${erros} erros`);
}

async function atualizarJob(jobId: string, updates: Partial<JobMineracao>): Promise<void> {
    const redis = await getRedisClient();
    const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);

    if (!jobData) return;

    const job = JSON.parse(jobData) as JobMineracao;
    Object.assign(job, updates, { atualizadoEm: new Date().toISOString() });

    await redis.setEx(
        `${JOB_PREFIX}${jobId}`,
        JOB_TTL_SECONDS,
        JSON.stringify(job)
    );
}
