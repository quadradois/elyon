/**
 * Script para atualizar contatos existentes com dados da Assertiva
 * 
 * Este script varre todos os contatos que têm CPF e tenta encontrar
 * dados de enriquecimento no CacheCpf, atualizando os campos faltantes.
 * 
 * Executar: npx ts-node scripts/atualizar-contatos-assertiva.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando atualização de contatos com dados da Assertiva...\n');

  // Buscar todos os contatos que têm CPF
  const contatos = await prisma.contato.findMany({
    where: {
      cpf: { not: null }
    },
    select: {
      id: true,
      cpf: true,
      nome: true,
      // Campos que podem estar faltando
      dataNascimento: true,
      idade: true,
      sexo: true,
      signo: true,
      nomeMae: true,
      profissao: true,
      rendaEstimada: true,
      faixaSalarial: true,
      setor: true,
      empresaAtual: true,
      cnpjEmpresa: true,
      situacaoCadastral: true,
      scoreAssertiva: true,
      endereco: true,
      cidade: true,
      estado: true,
      cep: true,
      fonteEnriquecimento: true,
    }
  });

  console.log(`📊 Total de contatos com CPF: ${contatos.length}\n`);

  let atualizados = 0;
  let semCache = 0;
  let jaCompletos = 0;
  let erros = 0;

  for (const contato of contatos) {
    try {
      const cpfLimpo = contato.cpf?.replace(/\D/g, '');
      if (!cpfLimpo) continue;

      // Buscar cache
      const cache = await prisma.cacheCpf.findFirst({
        where: { cpf: cpfLimpo }
      });

      if (!cache || !cache.dados) {
        semCache++;
        continue;
      }

      const dados = cache.dados as any;

      // Verificar se tem dados úteis no cache
      const temDadosAssertiva = dados.idade || dados.sexo || dados.profissao || dados.rendaEstimada;
      if (!temDadosAssertiva) {
        semCache++;
        continue;
      }

      // Verificar se contato já está completo
      if (contato.idade && contato.profissao && contato.rendaEstimada) {
        jaCompletos++;
        continue;
      }

      // Preparar dados para atualização
      let dataNascimento: Date | null = null;
      if (dados.dataNascimento && !contato.dataNascimento) {
        try {
          const partes = dados.dataNascimento.split('/');
          dataNascimento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
        } catch (e) { /* ignora erro */ }
      }

      // Endereço pessoal
      let enderecoPessoal: string | null = null;
      let cidadePessoal: string | null = null;
      let estadoPessoal: string | null = null;
      let cepPessoal: string | null = null;

      if (dados.endereco && !contato.endereco) {
        const end = dados.endereco;
        enderecoPessoal = [end.tipoLogradouro, end.logradouro, end.numero, end.complemento]
          .filter(Boolean).join(' ').trim() || null;
        cidadePessoal = end.cidade || null;
        estadoPessoal = end.uf || null;
        cepPessoal = end.cep || null;
      }

      // Atualizar apenas campos que estão vazios
      const updateData: any = {};

      if (dataNascimento && !contato.dataNascimento) updateData.dataNascimento = dataNascimento;
      if (dados.idade && !contato.idade) updateData.idade = dados.idade;
      if (dados.sexo && !contato.sexo) updateData.sexo = dados.sexo;
      if (dados.signo && !contato.signo) updateData.signo = dados.signo;
      if (dados.nomeMae && !contato.nomeMae) updateData.nomeMae = dados.nomeMae;
      if (dados.profissao && !contato.profissao) updateData.profissao = dados.profissao;
      if (dados.rendaEstimada && !contato.rendaEstimada) updateData.rendaEstimada = dados.rendaEstimada;
      if (dados.faixaSalarial && !contato.faixaSalarial) updateData.faixaSalarial = dados.faixaSalarial;
      if (dados.setor && !contato.setor) updateData.setor = dados.setor;
      if (dados.empresaAtual && !contato.empresaAtual) updateData.empresaAtual = dados.empresaAtual;
      if (dados.cnpjEmpresa && !contato.cnpjEmpresa) updateData.cnpjEmpresa = dados.cnpjEmpresa;
      if (dados.situacaoCadastral && !contato.situacaoCadastral) updateData.situacaoCadastral = dados.situacaoCadastral;
      if (dados.obitoProvavel !== undefined) updateData.obitoProvavel = dados.obitoProvavel;
      if (dados.ppe !== undefined) updateData.ppe = dados.ppe;
      if (dados.score && !contato.scoreAssertiva) updateData.scoreAssertiva = dados.score;
      if (enderecoPessoal && !contato.endereco) updateData.endereco = enderecoPessoal;
      if (cidadePessoal && !contato.cidade) updateData.cidade = cidadePessoal;
      if (estadoPessoal && !contato.estado) updateData.estado = estadoPessoal;
      if (cepPessoal && !contato.cep) updateData.cep = cepPessoal;

      // Sempre atualizar metadados se tiver dados para atualizar
      if (Object.keys(updateData).length > 0) {
        updateData.fonteEnriquecimento = 'ASSERTIVA';
        updateData.enriquecidoEm = new Date();

        await prisma.contato.update({
          where: { id: contato.id },
          data: updateData
        });

        atualizados++;
        console.log(`✅ ${contato.nome} - ${Object.keys(updateData).length - 2} campos atualizados`);
      } else {
        jaCompletos++;
      }
    } catch (error: any) {
      erros++;
      console.error(`❌ Erro ao atualizar ${contato.nome}: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('📊 RESUMO DA ATUALIZAÇÃO');
  console.log('========================================');
  console.log(`✅ Atualizados: ${atualizados}`);
  console.log(`⏭️  Já completos: ${jaCompletos}`);
  console.log(`📭 Sem cache: ${semCache}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('========================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
