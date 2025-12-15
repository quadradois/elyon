import axios from 'axios';
import { prisma } from '../lib/db';

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

export class SincronizacaoMapaService {

    /**
     * Passo 1: Sincronizar Bairros
     * Busca todos os bairros da API e salva na tabela Bairro
     */
    async sincronizarBairros() {
        console.log('[Sync] Iniciando sincronização de BAIRROS...');
        const inicio = Date.now();

        try {
            // Buscar todos os bairros da API (sem paginação pois são poucos)
            const response = await axios.get(MAPA_API_URL, {
                params: {
                    where: '1=1',
                    outFields: 'cdbairro,nmbairro',
                    returnDistinctValues: true,
                    orderByFields: 'nmbairro ASC',
                    returnGeometry: false,
                    f: 'json'
                },
                timeout: 30000
            });

            if (response.data.error) {
                throw new Error(`Erro na API: ${response.data.error.message}`);
            }

            const features = response.data.features || [];
            console.log(`[Sync] API retornou ${features.length} bairros.`);

            let novos = 0;
            let atualizados = 0;

            // Processar em transação para garantir integridade
            // Mas como pode ser demorado, vamos fazer upsert individual ou em lotes pequenos

            for (const f of features) {
                const codigo = f.attributes.cdbairro;
                const nome = f.attributes.nmbairro?.trim();

                if (!codigo || !nome) continue;

                // Upsert
                const bairro = await prisma.bairro.upsert({
                    where: { codigo },
                    update: { nome },
                    create: { codigo, nome }
                });

                // Simples contagem (não distingue create/update no retorno do prisma upsert sem verificar antes)
                atualizados++;
            }

            const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
            console.log(`[Sync] ✅ Bairros sincronizados em ${tempo}s. Total processado: ${atualizados}`);
            return { total: atualizados, tempo };

        } catch (error) {
            console.error('[Sync] ❌ Erro ao sincronizar bairros:', error);
            throw error;
        }
    }

    /**
     * Passo 2: Sincronizar Edifícios
     * Itera sobre todos os bairros e busca seus edifícios
     */
    async sincronizarEdificios() {
        console.log('[Sync] Iniciando sincronização de EDIFÍCIOS...');
        const inicioTotal = Date.now();

        try {
            // Listar todos os bairros locais para iterar
            const bairros = await prisma.bairro.findMany({
                orderBy: { nome: 'asc' }
            });

            console.log(`[Sync] Processando edifícios de ${bairros.length} bairros...`);

            let totalEdificios = 0;
            let erros = 0;

            for (let i = 0; i < bairros.length; i++) {
                const bairro = bairros[i];

                try {
                    // Se for bairro do tipo Condomínio Horizontal (Jardins, Alphaville...), marcamos flag
                    // Mas a busca de edifícios verticais dentro do bairro continua igual
                    const count = await this.sincronizarEdificiosDoBairro(bairro.codigo);
                    totalEdificios += count;

                    if (i % 50 === 0) {
                        console.log(`[Sync] Progresso: ${i + 1}/${bairros.length} bairros processados (Total Edifícios: ${totalEdificios})`);
                    }

                    // Pequeno delay
                    await new Promise(r => setTimeout(r, 50));

                } catch (e) {
                    console.error(`[Sync] Erro ao processar bairro ${bairro.nome}:`, e);
                    erros++;
                }
            }

            const tempo = ((Date.now() - inicioTotal) / 1000).toFixed(1);
            console.log(`[Sync] ✅ Edifícios sincronizados em ${tempo}s.`);
            console.log(`[Sync] Total Edifícios: ${totalEdificios} | Bairros com erro: ${erros}`);

            return { total: totalEdificios, tempo };

        } catch (error) {
            console.error('[Sync] ❌ Erro crítico ao sincronizar edifícios:', error);
            throw error;
        }
    }

    /**
     * Passo 3: Sincronizar Unidades (Imóveis)
     * Itera sobre todos os edifícios e busca suas unidades
     */
    async sincronizarUnidades() {
        console.log('[Sync] Iniciando sincronização de UNIDADES/IMÓVEIS...');
        const inicioTotal = Date.now();

        try {
            // Listar todos os edifícios locais
            const edificios = await prisma.edificio.findMany({
                orderBy: { nome: 'asc' },
                select: { codigo: true, nome: true, codigoBairro: true }
            });

            console.log(`[Sync] Buscando unidades de ${edificios.length} edifícios...`);

            let totalUnidades = 0;
            let erros = 0;

            // Processar em lotes para não estourar memória
            const BATCH_SIZE = 10;

            for (let i = 0; i < edificios.length; i += BATCH_SIZE) {
                const lote = edificios.slice(i, i + BATCH_SIZE);

                await Promise.all(lote.map(async (ed) => {
                    try {
                        const count = await this.sincronizarUnidadesDoEdificio(ed.codigo, ed.codigoBairro || 0);
                        totalUnidades += count;
                    } catch (e: any) {
                        console.error(`[Sync] Erro no edifício ${ed.nome}:`, e.message);
                        erros++;
                    }
                }));

                if (i % 100 === 0) {
                    console.log(`[Sync] Progresso: ${i}/${edificios.length} edifícios processados (Total Unidades: ${totalUnidades})`);
                }

                // Delay entre lotes
                await new Promise(r => setTimeout(r, 200));
            }

            const tempo = ((Date.now() - inicioTotal) / 1000).toFixed(1);
            console.log(`[Sync] ✅ Unidades sincronizadas em ${tempo}s.`);
            console.log(`[Sync] Total Unidades: ${totalUnidades} | Erros: ${erros}`);

            return { total: totalUnidades, tempo };

        } catch (error) {
            console.error('[Sync] ❌ Erro crítico ao sincronizar unidades:', error);
            throw error;
        }
    }

    /**
     * Helper: Busca e salva edifícios de um único bairro
     */
    private async sincronizarEdificiosDoBairro(cdbairro: number): Promise<number> {
        const response = await axios.get(MAPA_API_URL, {
            params: {
                where: `cdbairro = ${cdbairro} AND cdedificio IS NOT NULL AND nmedificio IS NOT NULL`,
                outFields: 'cdedificio,nmedificio,nmlogradou',
                returnDistinctValues: true,
                orderByFields: 'nmedificio ASC',
                returnGeometry: false,
                f: 'json'
            },
            timeout: 10000
        });

        const features = response.data.features || [];
        if (features.length === 0) return 0;

        // Agrupar para remover duplicatas
        const edificiosMap = new Map<number, any>();
        for (const f of features) {
            const codigo = f.attributes.cdedificio;
            if (!edificiosMap.has(codigo)) {
                edificiosMap.set(codigo, {
                    codigo,
                    nome: f.attributes.nmedificio?.trim(),
                    logradouro: f.attributes.nmlogradou?.trim() || null,
                    codigoBairro: cdbairro
                });
            }
        }

        const edificios = Array.from(edificiosMap.values());

        // Salvar no banco (com transaction para ser atômico por bairro se possível, mas upsert é seguro)
        await prisma.$transaction(
            edificios.map(ed => prisma.edificio.upsert({
                where: { codigo: ed.codigo },
                update: {
                    nome: ed.nome,
                    logradouro: ed.logradouro,
                    codigoBairro: ed.codigoBairro
                },
                create: {
                    codigo: ed.codigo,
                    nome: ed.nome,
                    logradouro: ed.logradouro,
                    codigoBairro: ed.codigoBairro
                }
            }))
        );

        return edificios.length;
    }

    /**
     * Helper: Busca todas as unidades de um edifício (com paginação)
     */
    private async sincronizarUnidadesDoEdificio(cdedificio: number, cdbairro: number): Promise<number> {
        let offset = 0;
        let totalBaixado = 0;
        const LIMIT = 1000; // Limite da API

        while (true) {
            const response = await axios.get(MAPA_API_URL, {
                params: {
                    where: `cdedificio = ${cdedificio}`,
                    outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nmbairro,areaedif,areaterr,nrquadra,nrlote,nrimovel',
                    orderByFields: 'nrinscr ASC', // Ordenação estável para paginação
                    resultOffset: offset,
                    resultRecordCount: LIMIT,
                    returnGeometry: false,
                    f: 'json'
                },
                timeout: 15000
            });

            const features = response.data.features || [];
            if (features.length === 0) break;

            // Mapper de dados
            const unidades = features.map((f: any) => ({
                nrinscr: f.attributes.nrinscr,
                nomeEdificio: f.attributes.nmedificio?.trim(),
                logradouro: f.attributes.nmlogradou?.trim() || '',
                bairro: f.attributes.nmbairro?.trim() || '',
                complemento: f.attributes.incompl || '',

                // Dados físicos
                areaEdificada: f.attributes.areaedif,
                areaTerreno: f.attributes.areaterr,
                quadra: f.attributes.nrquadra?.trim(),
                lote: f.attributes.nrlote?.trim(),
                numero: f.attributes.nrimovel?.trim(),

                // Vínculos
                codigoEdificio: cdedificio,
                codigoBairro: cdbairro
            }));

            // Upsert em massa
            await prisma.$transaction(
                unidades.map((u: any) => prisma.imovel.upsert({
                    where: { inscricaoIptu: u.nrinscr },
                    update: {
                        logradouro: u.logradouro,
                        complemento: u.complemento,
                        bairro: u.bairro,
                        codigoEdificio: u.codigoEdificio,
                        codigoBairro: u.codigoBairro,
                        areaEdificada: u.areaEdificada,
                        areaTerreno: u.areaTerreno,
                        quadra: u.quadra,
                        lote: u.lote,
                        numero: u.numero
                    },
                    create: {
                        inscricaoIptu: u.nrinscr,
                        nomeEdificio: u.nomeEdificio,
                        logradouro: u.logradouro,
                        complemento: u.complemento,
                        bairro: u.bairro,
                        codigoEdificio: u.codigoEdificio,
                        codigoBairro: u.codigoBairro,
                        areaEdificada: u.areaEdificada,
                        areaTerreno: u.areaTerreno,
                        quadra: u.quadra,
                        lote: u.lote,
                        numero: u.numero,
                        statusCaptacao: 'IDENTIFICADO'
                    }
                }))
            );

            totalBaixado += unidades.length;
            offset += LIMIT;

            // Se retornou menos que o limite, acabou
            if (features.length < LIMIT) break;
        }

        // Atualizar contagem no edifício pai
        if (totalBaixado > 0) {
            await prisma.edificio.update({
                where: { codigo: cdedificio },
                data: { totalUnidades: totalBaixado }
            });
        }

        return totalBaixado;
    }
}

export const sincronizacaoService = new SincronizacaoMapaService();
