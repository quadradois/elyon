import { mapaService } from './src/servicos/mapa';

async function test() {
  console.log('Testando busca por IPTU...');
  try {
    // Teste com o IPTU que o usuário informou
    const resultado = await mapaService.buscarImoveis({
      nrinscr: '32313702960010'
    });
    console.log('Sucesso:', resultado.length, 'imóveis encontrados');
    console.log(JSON.stringify(resultado[0], null, 2));
  } catch (error) {
    console.error('Erro na busca:', error);
  }
}

test();
