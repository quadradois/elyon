import { prisma } from '../lib/db';
import { sincronizarAliasesGeo360Validados } from '../servicos/geo360-aliases';

sincronizarAliasesGeo360Validados()
  .then((resultado) => console.log(JSON.stringify(resultado)))
  .finally(() => prisma.$disconnect());
