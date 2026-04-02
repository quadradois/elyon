export const DEFAULT_COMISSAO_PADRAO = '5%';
export const DEFAULT_PRAZO_CONTRATO_DIAS = 180;
export const DEFAULT_DIFERENCIAIS = [
  'Avaliação com IA',
  'Material Profissional',
  'Rede de Parceiros'
];

function normalizarPercentual(valor: string): string {
  const limpo = valor.trim();
  if (!limpo) return DEFAULT_COMISSAO_PADRAO;
  return limpo.endsWith('%') ? limpo : `${limpo}%`;
}

export function resolverComissaoPadrao(valor?: string | number | null): string {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) {
    return `${valor}%`;
  }

  if (typeof valor === 'string') {
    const normalizado = valor.trim();
    if (normalizado.length === 0) return DEFAULT_COMISSAO_PADRAO;
    return normalizarPercentual(normalizado.replace('%%', '%'));
  }

  return DEFAULT_COMISSAO_PADRAO;
}

export function resolverPrazoContrato(valor?: string | number | null): number {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) {
    return Math.round(valor);
  }

  if (typeof valor === 'string') {
    const parsed = Number(valor);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return DEFAULT_PRAZO_CONTRATO_DIAS;
}

export function resolverDiferenciais(diferenciais?: string[] | null): string[] {
  if (Array.isArray(diferenciais)) {
    const validos = diferenciais
      .map(item => (item || '').trim())
      .filter(Boolean);

    if (validos.length > 0) {
      return validos;
    }
  }

  return [...DEFAULT_DIFERENCIAIS];
}

export function construirSecaoPoliticaComercial(config: {
  comissaoPadrao?: string;
  prazoContrato?: number;
  diferenciais?: string[];
}): string {
  const comissaoPadrao = resolverComissaoPadrao(config.comissaoPadrao);
  const prazoContrato = resolverPrazoContrato(config.prazoContrato);
  const diferenciais = resolverDiferenciais(config.diferenciais);

  return `NOSSO MÉTODO DE TRABALHO (USE NO PITCH SE A INTENÇÃO FOR VALIDADA):
  - Nossa comissão segue a política comercial vigente (referência atual: ${comissaoPadrao})
- Contrato de Consultoria de ${prazoContrato} dias
- Rede de Parceiros conectada: Imóvel ganha visibilidade de dezenas de corretores da cidade trabalhando de forma organizada
- Apresentação Premium: Avaliação com IA, Fotos Profissionais, Vídeo e Tour 360º
- Diferenciais: ${diferenciais.join(', ')}`;
}
