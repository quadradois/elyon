/**
 * Serviço de consulta de CEP usando ViaCEP (gratuito)
 * https://viacep.com.br/
 */

export interface DadosCEP {
  cep: string;
  logradouro: string;  // Rua/Avenida
  complemento: string;
  bairro: string;
  cidade: string;      // localidade no ViaCEP
  estado: string;      // uf no ViaCEP
  ibge?: string;
  ddd?: string;
  erro?: boolean;
}

export class ConsultaCEP {
  private cache: Map<string, DadosCEP> = new Map();

  /**
   * Consulta CEP na API ViaCEP
   * @param cep - CEP com ou sem formatação (ex: "74000-000" ou "74000000")
   */
  async consultar(cep: string): Promise<DadosCEP | null> {
    // Limpar CEP (remover traços e espaços)
    const cepLimpo = cep.replace(/\D/g, '');
    
    // Validar formato (8 dígitos)
    if (cepLimpo.length !== 8) {
      console.log(`[CEP] ❌ CEP inválido: ${cep}`);
      return null;
    }
    
    // Verificar cache
    if (this.cache.has(cepLimpo)) {
      console.log(`[CEP] ✅ Cache hit: ${cepLimpo}`);
      return this.cache.get(cepLimpo)!;
    }
    
    try {
      console.log(`[CEP] 🔍 Consultando: ${cepLimpo}`);
      
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      
      if (!response.ok) {
        console.error(`[CEP] ❌ Erro HTTP: ${response.status}`);
        return null;
      }
      
      const data: any = await response.json();
      
      // ViaCEP retorna { erro: true } quando CEP não existe
      if (data.erro) {
        console.log(`[CEP] ⚠️ CEP não encontrado: ${cepLimpo}`);
        return null;
      }
      
      // Mapear para nosso formato
      const resultado: DadosCEP = {
        cep: data.cep,
        logradouro: data.logradouro || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        ibge: data.ibge,
        ddd: data.ddd,
      };
      
      console.log(`[CEP] ✅ Encontrado: ${resultado.logradouro}, ${resultado.bairro}, ${resultado.cidade}-${resultado.estado}`);
      
      // Salvar no cache
      this.cache.set(cepLimpo, resultado);
      
      return resultado;
      
    } catch (error) {
      console.error('[CEP] ❌ Erro na consulta:', error);
      return null;
    }
  }

  /**
   * Formata CEP para exibição (XX.XXX-XXX)
   */
  formatar(cep: string): string {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return cep;
    return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
  }
}

export const consultaCEP = new ConsultaCEP();
