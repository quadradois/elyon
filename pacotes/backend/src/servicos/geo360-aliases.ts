import { prisma } from '../lib/db';

export const aliasesGeo360Validados = [{
  cidade: 'goiania',
  idLote: 405683,
  nome: 'WISH VACA BRAVA',
  tipo: 'COMERCIAL',
  construtora: 'EBM',
  fonteUrl: 'https://ebm.com.br/go/goiania/wish/vaca-brava/',
  observacao: [
    'Identidade confirmada pela coincidencia entre endereco, area do terreno',
    '(3.975 m2) e 287 apartamentos no lote e no site oficial da EBM.',
  ].join(' '),
  metadados: {
    unidadesResidenciais: 287,
    torres: 2,
    pavimentos: 25,
    areaTerrenoM2: 3975,
    entrega: '2025-03',
    enderecoComercial: 'Ruas T-53, T-30 e T-54, Quadra 100, lotes 1-5, Setor Bueno, Goiania-GO',
  },
}] as const;

export async function sincronizarAliasesGeo360Validados() {
  let cadastrados = 0;
  let ignorados = 0;

  for (const alias of aliasesGeo360Validados) {
    const lote = await prisma.geo360Lote.findUnique({
      where: { cidade_idLote: { cidade: alias.cidade, idLote: alias.idLote } },
      select: { idLote: true },
    });

    if (!lote) {
      ignorados += 1;
      continue;
    }

    const dados = {
      tipo: alias.tipo,
      construtora: alias.construtora,
      fonteUrl: alias.fonteUrl,
      validado: true,
      observacao: alias.observacao,
      metadados: alias.metadados,
    };

    await prisma.geo360LoteAlias.upsert({
      where: {
        cidade_idLote_nome: {
          cidade: alias.cidade,
          idLote: alias.idLote,
          nome: alias.nome,
        },
      },
      create: {
        cidade: alias.cidade,
        idLote: alias.idLote,
        nome: alias.nome,
        ...dados,
        validadoEm: new Date(),
      },
      update: dados,
    });
    cadastrados += 1;
  }

  return { total: aliasesGeo360Validados.length, cadastrados, ignorados };
}
