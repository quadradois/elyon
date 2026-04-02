/**
 * Script para sincronizar contatos com dados do cache Assertiva
 * 
 * Uso: node sincronizar-contatos-assertiva.js [--contato-id=ID] [--campanha-id=ID]
 * 
 * Se nenhum parâmetro for passado, sincroniza TODOS os contatos sem dados enriquecidos
 * que possuem CPF e cujo CPF está no cache Assertiva.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizarTelefone = (tel) => {
    if (!tel) return null;
    return tel.replace(/\D/g, '');
};

async function sincronizarContato(contato, cache) {
    const dados = cache.dados;
    const telefones = dados.telefones || [];
    const emails = dados.emails || [];

    // Ordenar telefones (WhatsApp primeiro)
    const telefonesOrdenados = [...telefones].sort((a, b) => {
        if (a.whatsapp && !b.whatsapp) return -1;
        if (!a.whatsapp && b.whatsapp) return 1;
        if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
        if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
        return 0;
    });

    let dataNascimento = null;
    if (dados.dataNascimento) {
        const partes = dados.dataNascimento.split('/');
        dataNascimento = new Date(partes[2] + '-' + partes[1] + '-' + partes[0]);
    }

    let enderecoCompleto = null;
    if (dados.endereco) {
        const e = dados.endereco;
        enderecoCompleto = [e.tipoLogradouro, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf]
            .filter(Boolean).join(' ').trim();
    }

    return prisma.contato.update({
        where: { id: contato.id },
        data: {
            telefone: normalizarTelefone(telefonesOrdenados[0]?.numero) || contato.telefone,
            telefone2: normalizarTelefone(telefonesOrdenados[1]?.numero) || null,
            telefone3: normalizarTelefone(telefonesOrdenados[2]?.numero) || null,
            telefone4: normalizarTelefone(telefonesOrdenados[3]?.numero) || null,
            telefone5: normalizarTelefone(telefonesOrdenados[4]?.numero) || null,
            telefonesJson: telefones.length > 0 ? telefones : null,
            temWhatsapp: telefones.some(t => t.whatsapp),
            quantidadeWhatsapp: telefones.filter(t => t.whatsapp).length,
            email: emails[0] || contato.email,
            email2: emails[1] || null,
            email3: emails[2] || null,
            email4: emails[3] || null,
            email5: emails[4] || null,
            emailsJson: emails.length > 0 ? emails : null,
            dataNascimento,
            idade: dados.idade || null,
            sexo: dados.sexo || null,
            signo: dados.signo || null,
            nomeMae: dados.nomeMae || null,
            situacaoCadastral: dados.situacaoCadastral || null,
            obitoProvavel: dados.obitoProvavel || false,
            ppe: dados.ppe || false,
            profissao: dados.profissao || null,
            rendaEstimada: dados.rendaEstimada || null,
            faixaSalarial: dados.faixaSalarial || null,
            setor: dados.setor || null,
            empresaAtual: dados.empresaAtual || null,
            cnpjEmpresa: dados.cnpjEmpresa || null,
            endereco: enderecoCompleto,
            cidade: dados.endereco?.cidade || null,
            estado: dados.endereco?.uf || null,
            cep: dados.endereco?.cep || null,
            scoreAssertiva: dados.score || null,
            participacoesEmpresas: dados.participacoesEmpresas || null,
            fonteEnriquecimento: 'ASSERTIVA',
            enriquecidoEm: new Date(),
        }
    });
}

async function main() {
    // Buscar contatos sem dados enriquecidos mas com CPF
    const contatos = await prisma.contato.findMany({
        where: {
            cpf: { not: null },
            fonteEnriquecimento: null
        },
        select: {
            id: true,
            nome: true,
            cpf: true,
            telefone: true,
            email: true
        }
    });

    console.log(`📋 Encontrados ${contatos.length} contatos para sincronizar`);

    let atualizados = 0;
    let semCache = 0;
    let erros = 0;

    for (const contato of contatos) {
        try {
            const cpfLimpo = contato.cpf.replace(/\D/g, '');

            const cache = await prisma.cacheCpf.findFirst({
                where: { cpf: cpfLimpo }
            });

            if (!cache || !cache.dados) {
                semCache++;
                continue;
            }

            await sincronizarContato(contato, cache);
            atualizados++;
            console.log(`✅ ${contato.nome} - sincronizado`);
        } catch (e) {
            erros++;
            console.error(`❌ ${contato.nome} - erro: ${e.message}`);
        }
    }

    console.log('');
    console.log('📊 Resumo:');
    console.log(`   ✅ Atualizados: ${atualizados}`);
    console.log(`   ⏭️  Sem cache: ${semCache}`);
    console.log(`   ❌ Erros: ${erros}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
