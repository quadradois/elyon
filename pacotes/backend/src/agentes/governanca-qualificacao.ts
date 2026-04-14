interface SnapshotGovernancaQualificacao {
  interesseEm?: string | null;
  tipoImovel?: string | null;
  areaImovel?: string | null;
  ocupacaoImovel?: string | null;
  valorPretendido?: string | null;
  doresIdentificadas?: string[] | null;
  situacaoAtual?: string | null;
  motivacaoVenda?: string | null;
  consequencias?: string | null;
  custosAtuais?: string | null;
}

interface FieldSourceEntryLike {
  source?: string;
  value?: unknown;
  updatedAt?: string;
  evidence?: string;
}

interface SchemaStateLike {
  fieldSources?: Record<string, FieldSourceEntryLike>;
  lastSourceUpdateAt?: string;
}

export interface GovernancaFieldSourceResumo {
  campo: string;
  source: string;
  value: unknown;
  updatedAt: string;
  evidence?: string;
}

function temTexto(valor?: string | null): boolean {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function objetoPlano(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}

export function camposCriticosFaltantes(snapshot: SnapshotGovernancaQualificacao): string[] {
  const faltantes: string[] = [];

  if (!temTexto(snapshot.interesseEm)) faltantes.push('interesseEm');
  if (!temTexto(snapshot.tipoImovel)) faltantes.push('tipoImovel');
  if (!temTexto(snapshot.areaImovel)) faltantes.push('areaImovel');
  if (!temTexto(snapshot.ocupacaoImovel)) faltantes.push('ocupacaoImovel');
  if (!temTexto(snapshot.valorPretendido)) faltantes.push('valorPretendido');
  if (!snapshot.doresIdentificadas || snapshot.doresIdentificadas.length === 0) faltantes.push('doresIdentificadas');
  if (!temTexto(snapshot.situacaoAtual)) faltantes.push('situacaoAtual');
  if (!temTexto(snapshot.motivacaoVenda)) faltantes.push('motivacaoVenda');

  const temImplicacao = temTexto(snapshot.consequencias) || temTexto(snapshot.custosAtuais);
  if (!temImplicacao) faltantes.push('implicacao');

  return faltantes;
}

export function extrairFieldSources(schemaState: unknown): GovernancaFieldSourceResumo[] {
  if (!objetoPlano(schemaState)) return [];
  const raw = (schemaState as SchemaStateLike).fieldSources;
  if (!objetoPlano(raw)) return [];

  return Object.entries(raw)
    .map(([campo, dado]) => {
      const item = objetoPlano(dado) ? (dado as FieldSourceEntryLike) : {};
      if (!item.source || !item.updatedAt) return null;
      return {
        campo,
        source: item.source,
        value: item.value,
        updatedAt: item.updatedAt,
        evidence: temTexto(item.evidence || null) ? item.evidence : undefined,
      } as GovernancaFieldSourceResumo;
    })
    .filter((item): item is GovernancaFieldSourceResumo => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function obterLastSourceUpdateAt(schemaState: unknown): string | null {
  if (!objetoPlano(schemaState)) return null;
  const valor = (schemaState as SchemaStateLike).lastSourceUpdateAt;
  return temTexto(valor || null) ? (valor as string) : null;
}

