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

// Compatibilidade temporária: algumas branches estão com o Prisma Client
// sem os campos de rastreamento de proprietário em `Imovel`.
// Este adapter mantém o fluxo funcionando até a regeneração do client alinhada ao schema.
type ImovelRastreamentoOwner = {
    cpfProprietario: string | null;
    cpfVerificadoEm: Date | null;
    histProprietarios: unknown;
};

const imovelModelRastreamento = prisma.imovel as unknown as {
    findFirst(args: any): Promise<ImovelRastreamentoOwner | null>;
    updateMany(args: any): Promise<{ count: number }>;
};

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

    // Cache de CPFs já processados neste job (escopo global do job, não do batch).
    // Evita que o mesmo proprietário seja raspado múltiplas vezes quando possui imóveis em batches diferentes.
    const cacheJob = new Map<string, any>();

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Verificar se foi cancelado
        const jobAtual = await obterStatusJob(jobId);
        if (jobAtual?.status === 'cancelado') {
            console.log(`[JobMineracao] Job ${jobId} cancelado pelo usuário`);
            return;
        }

        const batch = batches[batchIndex];
        const resultadosBatch = [];

        for (const imovel of batch) {
            try {
                // 1. Tentar Cache Global (Tabela Contatos)
                const contatoCache = await prisma.contato.findFirst({
                    where: {
                        inscricaoIptu: imovel.nrinscr,
                        nome: { not: '' }
                    },
                    orderBy: { criadoEm: 'desc' },
                    select: {
                        nome: true,
                        cpf: true,
                        enderecoImovel: true,
                        telefonesJson: true,
                        emailsJson: true
                    }
                });

                if (contatoCache) {
                    // Deduplicação Intra-Job (Cache Hit em Memória)
                    if (contatoCache.cpf && cacheJob.has(contatoCache.cpf)) {
                        console.log(`[JobMineracao] IPTU ${imovel.nrinscr}: CPF ${contatoCache.cpf} já processado neste job. Ignorando duplicata.`);
                        continue;
                    }

                    console.log(`[JobMineracao] Cache Hit Global para IPTU ${imovel.nrinscr}`);
                    sucessos++;
                    
                    const dados = {
                        ...imovel,
                        nome: contatoCache.nome,
                        cpf: contatoCache.cpf,
                        endereco_correspondencia: contatoCache.enderecoImovel,
                        origem: 'CACHE_SISTEMA',
                        cached: true
                    };
                    
                    if (contatoCache.cpf) {
                        cacheJob.set(contatoCache.cpf, true);
                    }
                    
                    resultadosBatch.push(dados);
                    continue;
                }

                // 2. Verificar Layer 1 (IPTU → CPF, TTL 30 dias via imoveis.cpfVerificadoEm)
                // Se o CPF do proprietário foi raspado recentemente, evita nova consulta à Prefeitura.
                const TTL_L1_MS = 30 * 24 * 60 * 60 * 1000;
                const imovelDb = await imovelModelRastreamento.findFirst({
                    where: { inscricaoIptu: imovel.nrinscr },
                    select: { cpfProprietario: true, cpfVerificadoEm: true, histProprietarios: true }
                });
                const cpfL1 = imovelDb?.cpfProprietario ?? null;
                const verificadoEm = imovelDb?.cpfVerificadoEm ?? null;
                const cpfL1Fresco = verificadoEm
                    ? (Date.now() - new Date(verificadoEm).getTime()) < TTL_L1_MS
                    : false;

                if (cpfL1 && cpfL1Fresco) {
                    // CPF verificado nos últimos 30 dias → pular scraping
                    if (cacheJob.has(cpfL1)) {
                        console.log(`[JobMineracao] IPTU ${imovel.nrinscr}: CPF L1 ${cpfL1} já no job. Ignorando duplicata.`);
                        continue;
                    }
                    cacheJob.set(cpfL1, true);
                    console.log(`[JobMineracao] Cache L1 HIT para IPTU ${imovel.nrinscr} → CPF ${cpfL1} (verificado em ${verificadoEm?.toISOString()})`);
                    sucessos++;
                    resultadosBatch.push({ ...imovel, cpf: cpfL1, origem: 'CACHE_L1', cached: true });
                    continue;
                }

                // 3. Sem cache L1 fresco → raspar prefeitura
                console.log(`[JobMineracao] Raspando IPTU ${imovel.nrinscr}...`);
                const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);

                // 4. Deduplicação Intra-Job (Após Scraping)
                const cpfRetornado = dadosScraper.cpf || (dadosScraper as any).cpfCnpj;

                if (cpfRetornado && cacheJob.has(cpfRetornado)) {
                    console.log(`[JobMineracao] IPTU ${imovel.nrinscr}: CPF ${cpfRetornado} recém raspado já existe neste job. Ignorando duplicata.`);
                    continue;
                }

                if (cpfRetornado) {
                    cacheJob.set(cpfRetornado, true);
                }

                // 5. Detecção de venda: comparar CPF raspado com o último CPF armazenado (Layer 1)
                if (cpfRetornado) {
                    const vendaDetectada = cpfL1 && cpfL1 !== cpfRetornado;

                    if (vendaDetectada) {
                        console.log(`[JobMineracao] 🔄 VENDA DETECTADA IPTU ${imovel.nrinscr}: CPF ${cpfL1} → ${cpfRetornado}`);

                        // Expirar cache_cpf do proprietário antigo imediatamente (Layer 2)
                        await prisma.cacheCpf.updateMany({
                            where: { cpf: cpfL1! },
                            data: { expiraEm: new Date() }
                        }).catch(e => console.error(`[JobMineracao] Falha ao expirar cacheCpf antigo (${cpfL1}):`, e));

                        // Registrar no histórico de proprietários
                        const histAtual: { cpf: string; ate: string }[] = Array.isArray(imovelDb?.histProprietarios)
                            ? (imovelDb?.histProprietarios as { cpf: string; ate: string }[])
                            : [];
                        const novoHist = [...histAtual, { cpf: cpfL1!, ate: new Date().toISOString() }];

                        await imovelModelRastreamento.updateMany({
                            where: { inscricaoIptu: imovel.nrinscr },
                            data: {
                                cpfProprietario: cpfRetornado,
                                cpfVerificadoEm: new Date(),
                                histProprietarios: novoHist
                            }
                        }).catch(e => console.error(`[JobMineracao] Falha ao atualizar Layer 1 (venda):`, e));
                    } else {
                        // Mesmo proprietário ou primeira vez → atualizar CPF e timestamp
                        await imovelModelRastreamento.updateMany({
                            where: { inscricaoIptu: imovel.nrinscr },
                            data: {
                                cpfProprietario: cpfRetornado,
                                cpfVerificadoEm: new Date()
                            }
                        }).catch(e => console.error(`[JobMineracao] Falha ao atualizar Layer 1:`, e));
                    }
                }

                // 4. MERGE INTELIGENTE (Associação de Box da Etapa 01)
                // Se o scraper não achou box/unidade mas a Etapa 01 tinha o 'incompl', usamos ele como extra
                const dadosFinais = { ...imovel, ...dadosScraper };
                
                // Fallback de Box/Unidade: se o scraper não preencheu e temos 'incompl' da Etapa 01
                if (!dadosFinais.box || !dadosFinais.unidade) {
                    const extraData = parsearEnderecoPrefeitura(imovel.incompl || '');
                    if (!dadosFinais.box && extraData.box) dadosFinais.box = extraData.box;
                    if (!dadosFinais.unidade && extraData.unidade) dadosFinais.unidade = extraData.unidade;
                    if (!dadosFinais.apartamento && extraData.apartamento) dadosFinais.apartamento = extraData.apartamento;
                    if (!dadosFinais.bloco && extraData.bloco) dadosFinais.bloco = extraData.bloco;
                }

                sucessos++;
                resultadosBatch.push(dadosFinais);

            } catch (error: any) {
                console.error(`[JobMineracao] Erro ao processar ${imovel.nrinscr}:`, error);
                erros++;
                resultadosBatch.push({ ...imovel, origem: 'ERRO' });
                
                // Gravar log para auditoria de falhas de IPTU
                try {
                    await prisma.logScraperIPTU.create({
                        data: {
                            tenantId: tenantId, 
                            inscricao: imovel.nrinscr,
                            status: error.message?.includes('Mascara') ? 'MASCARADO_LGPD' : 'ERRO',
                            mensagemErro: error.message || 'Erro desconhecido',
                            jobId: jobId
                        }
                    });
                } catch (logErr) {
                    console.error(`[JobMineracao] Falha ao salvar LogScraperIPTU para ${imovel.nrinscr}:`, logErr);
                }
            }
        } // FIM DO FOR DOS IMÓVEIS NO BATCH

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
