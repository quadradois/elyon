export type UrgenciaQualificacao = 'BAIXA' | 'MEDIA' | 'ALTA';

export function temTexto(valor?: string | null): boolean {
    return typeof valor === 'string' && valor.trim().length > 0;
}

export function normalizarTextoSemAcento(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function possuiMarcadorTemporal(timelineNormalizada: string): boolean {
    return (
        /\b\d+\s*(dia|dias|semana|semanas|mes|meses|ano|anos)\b/.test(timelineNormalizada)
        || /\b(urgente|urgencia|imediat|ja|breve|logo|trimestre|sem pressa|longo prazo|quanto antes)\b/.test(timelineNormalizada)
    );
}

export function timelineConfiavel(timeline?: string | null): timeline is string {
    if (!temTexto(timeline)) return false;
    const t = normalizarTextoSemAcento(timeline!);
    if (!t) return false;
    if (/^(nao informado|indefinido|n\/a|na|nao sei|sem prazo( definido)?|sem previsao)$/.test(t)) {
        return false;
    }
    return possuiMarcadorTemporal(t);
}

export function derivarUrgenciaPorTimeline(timeline: string): UrgenciaQualificacao | undefined {
    const tl = normalizarTextoSemAcento(timeline);

    const matchMeses = tl.match(/\b(\d{1,2})\s*(mes|meses)\b/);
    if (matchMeses) {
        const meses = Number(matchMeses[1]);
        if (meses <= 1) return 'ALTA';
        if (meses <= 5) return 'MEDIA';
        return 'BAIXA';
    }

    const matchSemanas = tl.match(/\b(\d{1,2})\s*(semana|semanas)\b/);
    if (matchSemanas) {
        const semanas = Number(matchSemanas[1]);
        if (semanas <= 4) return 'ALTA';
        if (semanas <= 12) return 'MEDIA';
        return 'BAIXA';
    }

    const matchDias = tl.match(/\b(\d{1,3})\s*(dia|dias)\b/);
    if (matchDias) {
        const dias = Number(matchDias[1]);
        if (dias <= 30) return 'ALTA';
        if (dias <= 90) return 'MEDIA';
        return 'BAIXA';
    }

    if (/\b(urgente|urgencia|imediat|ja|quanto antes)\b/.test(tl)) return 'ALTA';
    if (/\b(breve|logo|trimestre)\b/.test(tl)) return 'MEDIA';
    if (/\b(sem pressa|longo prazo)\b/.test(tl) || /\b\d+\s*anos?\b/.test(tl)) return 'BAIXA';
    return undefined;
}

export function normalizarPrazoEUrgencia(params: {
    timeline?: string | null;
    prazoDesejado?: string | null;
}): {
    timelineEhConfiavel: boolean;
    prazoDesejadoNormalizado?: string;
    urgencia?: UrgenciaQualificacao;
} {
    const timelineEhConfiavel = timelineConfiavel(params.timeline);
    const prazoDesejadoNormalizado = temTexto(params.prazoDesejado)
        ? params.prazoDesejado!.trim()
        : timelineEhConfiavel
            ? params.timeline!.trim()
            : undefined;
    const urgencia = timelineEhConfiavel ? derivarUrgenciaPorTimeline(params.timeline!) : undefined;

    return { timelineEhConfiavel, prazoDesejadoNormalizado, urgencia };
}

export function valorComEvidencia<T>(valor: T | undefined, evidencia?: string | null): T | undefined {
    return valor !== undefined && temTexto(evidencia) ? valor : undefined;
}

export function aplicarBooleanComEvidencia(params: {
    campo: string;
    valor: boolean | undefined;
    evidencia?: string | null;
    updateData: Record<string, unknown>;
    camposAtualizados?: string[];
    warningTag: string;
}): boolean {
    const { campo, valor, evidencia, updateData, camposAtualizados, warningTag } = params;
    if (valor === undefined) return false;
    if (temTexto(evidencia)) {
        updateData[campo] = valor;
        camposAtualizados?.push(campo);
        return true;
    }
    console.warn(`[${warningTag}] ${campo} ignorado por falta de evidência explícita`);
    return false;
}
