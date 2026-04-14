export type FonteVerdade =
  | 'mensagem_usuario'
  | 'tool_confirmada'
  | 'briefing'
  | 'inferido'
  | 'sistema';

export interface FieldSourceEntry {
  source: FonteVerdade;
  value: unknown;
  updatedAt: string;
  evidence?: string;
}

type SchemaStateLike = Record<string, unknown> & {
  fieldSources?: Record<string, FieldSourceEntry>;
  lastSourceUpdateAt?: string;
};

function objetoPlano(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}

/**
 * Mescla o schemaState existente com trilha de source_of_truth por campo.
 * Não quebra formato atual de schemaState: apenas adiciona metadados.
 */
export function mergeSchemaStateComSources(
  schemaStateAtual: unknown,
  updates: Record<string, unknown>,
  source: FonteVerdade,
  evidence?: string
): SchemaStateLike {
  const base: SchemaStateLike = objetoPlano(schemaStateAtual) ? { ...(schemaStateAtual as SchemaStateLike) } : {};
  const fieldSources = objetoPlano(base.fieldSources) ? { ...base.fieldSources } : {};
  const now = new Date().toISOString();

  for (const [campo, valor] of Object.entries(updates)) {
    if (valor === undefined) continue;
    fieldSources[campo] = {
      source,
      value: valor,
      updatedAt: now,
      ...(evidence ? { evidence } : {})
    };
  }

  base.fieldSources = fieldSources;
  base.lastSourceUpdateAt = now;
  return base;
}
