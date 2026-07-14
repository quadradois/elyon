import {
  gerarFallbackSemSilencio,
  normalizarCanalTermosParaWhatsapp,
  respostaOfereceEmailParaTermos,
  textoPedeDocumentoAutorizacao,
} from '../dominio/politicas-resposta';

export interface PrepararRespostaEntrada {
  respostaOrquestrador?: string | null;
  textoConsolidado: string;
}

export interface RespostaPreparada {
  resposta: string;
  fallbackAplicado: boolean;
  leadPediuDocumentoAutorizacao: boolean;
  respostaOfereceuEmail: boolean;
}

export class PrepararRespostaWebhookUseCase {
  execute(entrada: PrepararRespostaEntrada): RespostaPreparada {
    const fallbackAplicado = !entrada.respostaOrquestrador?.trim();
    let resposta = fallbackAplicado
      ? gerarFallbackSemSilencio(entrada.textoConsolidado)
      : entrada.respostaOrquestrador!;
    const respostaOfereceuEmail = respostaOfereceEmailParaTermos(resposta);
    if (respostaOfereceuEmail) resposta = normalizarCanalTermosParaWhatsapp(resposta);
    return {
      resposta,
      fallbackAplicado,
      leadPediuDocumentoAutorizacao: textoPedeDocumentoAutorizacao(entrada.textoConsolidado),
      respostaOfereceuEmail,
    };
  }
}
