import { prisma } from './src/lib/db';
import { scraperIPTU } from './src/servicos/scraper-iptu';
import { assertivaService } from './src/servicos/assertiva';

async function testProcessar() {
  console.log('Iniciando teste de processamento...');

  // Mock payload similar to what frontend sends
  const imoveis = [
    {
      nrinscr: '32313702960010',
      nmedificio: 'EDIFICIO TESTE',
      nmbairro: 'SETOR BUENO',
      nmlogradou: 'RUA T 53',
      incompl: 'APTO 101'
    },
    {
      nrinscr: '32313702960011',
      nmedificio: 'EDIFICIO TESTE',
      nmbairro: 'SETOR BUENO',
      nmlogradou: 'RUA T 53',
      incompl: 'APTO 102'
    }
  ];

  try {
    // 1. Scraper (IPTU -> Nome/CPF)
    console.log('1. Executando Scraper...');
    const dadosProprietarios = await Promise.all(
      imoveis.map(async (imovel) => {
        const dadosScraper = await scraperIPTU.consultarProprietario(imovel.nrinscr);
        return { ...imovel, ...dadosScraper };
      })
    );
    console.log('Dados Scraper:', JSON.stringify(dadosProprietarios, null, 2));

    // 2. Enriquecimento
    console.log('2. Executando Enriquecimento...');
    const leadsEnriquecidos = await Promise.all(
      dadosProprietarios.map(async (p) => {
        if (p.cpf && p.nome) {
          const enriquecido = await assertivaService.enriquecerCPF(p.cpf, p.nome);
          return { ...p, ...enriquecido };
        }
        return p;
      })
    );
    console.log('Dados Enriquecidos:', JSON.stringify(leadsEnriquecidos, null, 2));

    // 3. Persistência
    console.log('3. Executando Persistência...');
    
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('Criando tenant demo...');
      tenant = await prisma.tenant.create({
        data: {
          nome: 'Imobiliária Demo',
          slug: 'demo',
          status: 'ATIVO'
        }
      });
    }
    console.log('Tenant ID:', tenant.id);

    const resultadosPersistidos = await Promise.all(
      leadsEnriquecidos.map(async (dados: any) => {
        if (!dados.nome) {
            console.log(`Skipping ${dados.nrinscr} - Sem nome`);
            return dados;
        }

        const cpfFinal = dados.cpf || `00000000000-${Math.random().toString().slice(2,5)}`;
        console.log(`Processando ${dados.nome} - CPF: ${cpfFinal}`);

        let lead;
        try {
            console.log('Tentando upsert Lead...');
            lead = await prisma.lead.upsert({
              where: {
                tenantId_cpf: {
                  tenantId: tenant!.id,
                  cpf: cpfFinal
                }
              },
              update: {
                nome: dados.nome,
                telefone: dados.telefones?.[0]?.numero || null,
                email: dados.emails?.[0] || null,
                enderecoPrincipal: dados.endereco_correspondencia,
                origem: 'api_iptu'
              },
              create: {
                tenantId: tenant!.id,
                cpf: cpfFinal,
                nome: dados.nome,
                telefone: dados.telefones?.[0]?.numero || null,
                email: dados.emails?.[0] || null,
                enderecoPrincipal: dados.endereco_correspondencia,
                origem: 'api_iptu',
                status: 'NOVO'
              }
            });
            console.log('Lead salvo:', lead.id);
        } catch (e) {
            console.error(`ERRO AO SALVAR LEAD ${dados.nome}:`, e);
            throw e;
        }

        const imovel = await prisma.imovel.upsert({
          where: { inscricaoIptu: dados.nrinscr },
          update: {
            leadId: lead.id,
            nomeEdificio: dados.nmedificio,
            bairro: dados.nmbairro,
            logradouro: dados.nmlogradou,
            complemento: dados.incompl
          },
          create: {
            inscricaoIptu: dados.nrinscr,
            leadId: lead.id,
            nomeEdificio: dados.nmedificio,
            bairro: dados.nmbairro || 'Desconhecido',
            logradouro: dados.nmlogradou || 'Desconhecido',
            complemento: dados.incompl,
            statusCaptacao: 'IDENTIFICADO'
          }
        });
        console.log('Imóvel salvo:', imovel.id);

        return { ...dados, leadId: lead.id, imovelId: imovel.id };
      })
    );

    console.log('Sucesso!');
  } catch (error) {
    console.error('ERRO FATAL:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProcessar();
