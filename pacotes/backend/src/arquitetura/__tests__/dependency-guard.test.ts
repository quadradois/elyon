import { analisarDependenciasModulo } from '../dependency-guard';

describe('dependency guard dos módulos', () => {
  it.each([
    ['express', "import { Router } from 'express';"],
    ['Prisma', "import { PrismaClient } from '@prisma/client';"],
    ['serviço legado', "import { enviar } from '../../../servicos/whatsapp';"],
    ['adapter', "import { adaptar } from '../adapters/evolution-go.adapter';"],
  ])('reprova dependência de %s dentro do domínio', (_nome, conteudo) => {
    expect(analisarDependenciasModulo([{ caminho: 'modulos/webhook/dominio/politica.ts', conteudo }]))
      .toEqual([expect.objectContaining({ regra: 'domínio deve permanecer puro' })]);
  });

  it('reprova módulo que importa uma rota', () => {
    expect(analisarDependenciasModulo([{
      caminho: 'modulos/webhook/adapters/http.ts',
      conteudo: "import webhookRouter from '../../../rotas/webhook';",
    }])).toEqual([expect.objectContaining({ regra: 'módulos não podem depender de rotas' })]);
  });

  it('permite aplicação depender do domínio e domínio depender de tipos puros', () => {
    expect(analisarDependenciasModulo([
      { caminho: 'modulos/webhook/dominio/politica.ts', conteudo: "import type { Mensagem } from './tipos';" },
      { caminho: 'modulos/webhook/aplicacao/preparar.usecase.ts', conteudo: "import { decidir } from '../dominio/politica';" },
    ])).toEqual([]);
  });
});
