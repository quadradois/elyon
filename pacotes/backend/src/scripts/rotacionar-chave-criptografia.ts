/**
 * Inventaria, verifica e rotaciona credenciais criptografadas.
 *
 * Uso:
 *   node dist/scripts/rotacionar-chave-criptografia.js --dry-run
 *   node dist/scripts/rotacionar-chave-criptografia.js --apply
 *   node dist/scripts/rotacionar-chave-criptografia.js --verify
 */

import { PrismaClient } from '@prisma/client';
import {
  criptografar,
  descriptografar,
  estaNaChaveAtiva,
  validarConfiguracaoCriptografia
} from '../lib/crypto';

type CampoCriptografado =
  | 'tenant.llmApiKeyCriptografada'
  | 'tenant.openaiApiKeyCriptografada'
  | 'integracao.apiKeyCriptografada';

interface RegistroCriptografado {
  id: string;
  campo: CampoCriptografado;
  valor: string;
}

interface Alteracao extends RegistroCriptografado {
  novoValor: string;
}

const prisma = new PrismaClient();

async function carregarRegistros(): Promise<RegistroCriptografado[]> {
  const [tenants, integracoes] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, llmApiKeyCriptografada: true, openaiApiKeyCriptografada: true }
    }),
    prisma.configuracaoIntegracao.findMany({
      select: { id: true, apiKeyCriptografada: true }
    })
  ]);

  const registros: RegistroCriptografado[] = [];
  for (const tenant of tenants) {
    if (tenant.llmApiKeyCriptografada) {
      registros.push({ id: tenant.id, campo: 'tenant.llmApiKeyCriptografada', valor: tenant.llmApiKeyCriptografada });
    }
    if (tenant.openaiApiKeyCriptografada) {
      registros.push({ id: tenant.id, campo: 'tenant.openaiApiKeyCriptografada', valor: tenant.openaiApiKeyCriptografada });
    }
  }
  for (const integracao of integracoes) {
    registros.push({ id: integracao.id, campo: 'integracao.apiKeyCriptografada', valor: integracao.apiKeyCriptografada });
  }
  return registros;
}

function prepararAlteracoes(registros: RegistroCriptografado[]): Alteracao[] {
  return registros.flatMap((registro) => {
    const plaintext = descriptografar(registro.valor);
    if (estaNaChaveAtiva(registro.valor)) return [];
    return [{ ...registro, novoValor: criptografar(plaintext) }];
  });
}

async function aplicarAlteracao(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, alteracao: Alteracao): Promise<void> {
  let quantidade = 0;
  if (alteracao.campo === 'tenant.llmApiKeyCriptografada') {
    quantidade = (await tx.tenant.updateMany({
      where: { id: alteracao.id, llmApiKeyCriptografada: alteracao.valor },
      data: { llmApiKeyCriptografada: alteracao.novoValor }
    })).count;
  } else if (alteracao.campo === 'tenant.openaiApiKeyCriptografada') {
    quantidade = (await tx.tenant.updateMany({
      where: { id: alteracao.id, openaiApiKeyCriptografada: alteracao.valor },
      data: { openaiApiKeyCriptografada: alteracao.novoValor }
    })).count;
  } else {
    quantidade = (await tx.configuracaoIntegracao.updateMany({
      where: { id: alteracao.id, apiKeyCriptografada: alteracao.valor },
      data: { apiKeyCriptografada: alteracao.novoValor }
    })).count;
  }

  if (quantidade !== 1) {
    throw new Error(`Concorrência detectada em ${alteracao.campo}; nenhuma alteração foi confirmada`);
  }
}

function imprimirInventario(registros: RegistroCriptografado[], paraRotacionar: number): void {
  const porCampo = registros.reduce<Record<string, number>>((acc, registro) => {
    acc[registro.campo] = (acc[registro.campo] || 0) + 1;
    return acc;
  }, {});
  console.log('[CRYPTO ROTATION] Inventário validado:', JSON.stringify({
    total: registros.length,
    jaNaChaveAtiva: registros.length - paraRotacionar,
    paraRotacionar,
    porCampo
  }));
}

async function verificar(): Promise<void> {
  const registros = await carregarRegistros();
  for (const registro of registros) {
    descriptografar(registro.valor);
    if (!estaNaChaveAtiva(registro.valor)) {
      throw new Error(`Cifra fora da chave ativa encontrada em ${registro.campo}`);
    }
  }
  imprimirInventario(registros, 0);
  console.log('[CRYPTO ROTATION] Verificação concluída: todas as credenciais usam a chave ativa.');
}

async function executar(): Promise<void> {
  validarConfiguracaoCriptografia();
  const argumento = process.argv[2] || '--dry-run';
  if (!['--dry-run', '--apply', '--verify'].includes(argumento)) {
    throw new Error('Use --dry-run, --apply ou --verify');
  }
  if (argumento === '--verify') return verificar();

  const registros = await carregarRegistros();
  const alteracoes = prepararAlteracoes(registros);
  imprimirInventario(registros, alteracoes.length);

  if (argumento === '--dry-run') {
    console.log('[CRYPTO ROTATION] Dry-run concluído; o banco não foi alterado.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const alteracao of alteracoes) await aplicarAlteracao(tx, alteracao);
  }, { maxWait: 10_000, timeout: 60_000 });

  console.log(`[CRYPTO ROTATION] Rotação transacional concluída: ${alteracoes.length} credencial(is) atualizada(s).`);
  await verificar();
}

executar()
  .catch((erro: unknown) => {
    const mensagem = erro instanceof Error ? erro.message : 'erro desconhecido';
    console.error(`[CRYPTO ROTATION] Falha segura: ${mensagem}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
