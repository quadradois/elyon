import { recuperarLicoesComportamentais, LicaoVendas } from '../behavioralRAG';

describe('RAG Comportamental (Behavioral RAG)', () => {
    
    it('Retorna vazio se não houver interação correspondente aos gatilhos', () => {
        const resultado = recuperarLicoesComportamentais("Estou querendo vender meu apartamento amanhã.");
        expect(resultado).toBe('');
    });

    it('Injeta lição tática quando encontra gatilho de Inquilino', () => {
        const resultado = recuperarLicoesComportamentais("Eu quero vender, mas tá alugado no momento.");
        expect(resultado).toContain('[O GERENTE INJETOU AS SEGUINTES DIRETRIZES TÁTICAS');
        expect(resultado).toContain('INQUILINO no imóvel');
        expect(resultado).toContain('Jamais sugira desocupação');
    });

    it('Injeta lição tática quando encontra gatilho de Hostilidade (Múltiplas correspondências)', () => {
        const resultado = recuperarLicoesComportamentais("Eu já me dei mal com corretor no passado, não assino nada com vocês.");
        
        // Deve avisar sobre a hostilidade baseado nos dois gatilhos "ja me dei mal" e "não assino"
        expect(resultado).toContain('O Lead está HOSTIL');
        expect(resultado).toContain('NÃO aja de forma defensiva');
    });

    it('Injeta múltiplas lições se cruzar com variadas situações', () => {
        // Mock customizado só para forçar duas regras disparando
        const bancoMock: LicaoVendas[] = [
            { id: "1", gatilhos: ["caro"], diretriz: "Aviso Caro: Não dê desconto." },
            { id: "2", gatilhos: ["longe"], diretriz: "Aviso Longe: Diga que aceita digital." },
        ];
        
        const resultado = recuperarLicoesComportamentais("Achei meio caro e vocês ficam muito longe.", bancoMock);
        expect(resultado).toContain('Aviso Caro: Não dê desconto.');
        expect(resultado).toContain('Aviso Longe: Diga que aceita digital.');
    });

});
