import axios from 'axios';

export type EvolutionStage = 'instance/create' | 'instance/connect' | 'instance/qr' | 'banco' | 'configuracao';

export type EvolutionReasonCode =
  | 'EVOLUTION_AUTH_REJECTED'
  | 'EVOLUTION_INSTANCE_NOT_FOUND'
  | 'EVOLUTION_INSTANCE_CONFLICT'
  | 'EVOLUTION_CONTRACT_INVALID'
  | 'EVOLUTION_CONFIG_MISSING'
  | 'EVOLUTION_UNAVAILABLE'
  | 'EVOLUTION_UPSTREAM_FAILURE'
  | 'WHATSAPP_DATABASE_FAILURE'
  | 'WHATSAPP_CONNECTION_FAILED';

interface EvolutionFailureContext {
  stage: EvolutionStage;
  route?: string;
  instanceAlreadyExisted?: boolean;
  contractInvalid?: boolean;
}

export class EvolutionIntegrationError extends Error {
  readonly stage: EvolutionStage;
  readonly route?: string;
  readonly upstreamStatus?: number;
  readonly reasonCode: EvolutionReasonCode;
  readonly httpStatus: 500 | 502 | 503;
  readonly instanceAlreadyExisted?: boolean;

  constructor(params: {
    message: string;
    stage: EvolutionStage;
    route?: string;
    upstreamStatus?: number;
    reasonCode: EvolutionReasonCode;
    httpStatus: 500 | 502 | 503;
    instanceAlreadyExisted?: boolean;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'EvolutionIntegrationError';
    this.stage = params.stage;
    this.route = params.route;
    this.upstreamStatus = params.upstreamStatus;
    this.reasonCode = params.reasonCode;
    this.httpStatus = params.httpStatus;
    this.instanceAlreadyExisted = params.instanceAlreadyExisted;
  }
}

function reasonFromStatus(status?: number): EvolutionReasonCode {
  if (status === 401 || status === 403) return 'EVOLUTION_AUTH_REJECTED';
  if (status === 404) return 'EVOLUTION_INSTANCE_NOT_FOUND';
  if (status === 409) return 'EVOLUTION_INSTANCE_CONFLICT';
  if (status === 502 || status === 503 || status === 504) return 'EVOLUTION_UNAVAILABLE';
  return 'EVOLUTION_UPSTREAM_FAILURE';
}

export function toEvolutionIntegrationError(
  error: unknown,
  context: EvolutionFailureContext,
): EvolutionIntegrationError {
  if (error instanceof EvolutionIntegrationError) return error;

  if (context.contractInvalid) {
    return new EvolutionIntegrationError({
      message: 'Contrato inesperado da Evolution Go',
      ...context,
      reasonCode: 'EVOLUTION_CONTRACT_INVALID',
      httpStatus: 502,
      cause: error,
    });
  }

  if (axios.isAxiosError(error)) {
    const upstreamStatus = error.response?.status;
    const unavailable = !error.response || [502, 503, 504].includes(upstreamStatus || 0);
    return new EvolutionIntegrationError({
      message: unavailable ? 'Evolution Go indisponivel' : 'Evolution Go rejeitou a operacao',
      ...context,
      upstreamStatus,
      reasonCode: unavailable ? 'EVOLUTION_UNAVAILABLE' : reasonFromStatus(upstreamStatus),
      httpStatus: unavailable ? 503 : 502,
      cause: error,
    });
  }

  return new EvolutionIntegrationError({
    message: 'Falha de integracao com Evolution Go',
    ...context,
    reasonCode: 'WHATSAPP_CONNECTION_FAILED',
    httpStatus: 502,
    cause: error,
  });
}

export function publicConnectionFailure(error: unknown): {
  httpStatus: 500 | 502 | 503;
  stage: EvolutionStage;
  reasonCode: EvolutionReasonCode;
  upstreamStatus?: number;
  route?: string;
  instanceAlreadyExisted?: boolean;
} {
  if (error instanceof EvolutionIntegrationError) {
    return {
      httpStatus: error.httpStatus,
      stage: error.stage,
      reasonCode: error.reasonCode,
      upstreamStatus: error.upstreamStatus,
      route: error.route,
      instanceAlreadyExisted: error.instanceAlreadyExisted,
    };
  }

  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
  const prismaCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (name.startsWith('Prisma') || /^P\d{4}$/.test(prismaCode)) {
    return { httpStatus: 500, stage: 'banco', reasonCode: 'WHATSAPP_DATABASE_FAILURE' };
  }

  return { httpStatus: 500, stage: 'configuracao', reasonCode: 'WHATSAPP_CONNECTION_FAILED' };
}
