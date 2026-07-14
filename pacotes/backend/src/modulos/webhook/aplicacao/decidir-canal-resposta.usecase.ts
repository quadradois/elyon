import {
  anexarPedidoPermissaoAudio,
  clienteMandouAudio,
  devePedirPermissaoAudio,
  deveResponderEmAudio,
} from '../dominio/politicas-resposta';
import type { MensagemPendente, PreferenciaAudio } from '../dominio/tipos';

export interface DecidirCanalEntrada {
  resposta: string;
  textoConsolidado: string;
  mensagens: MensagemPendente[];
  respostaEmAudioAtiva: boolean;
  preferenciaAudio: PreferenciaAudio | null;
}

export interface DecisaoCanalResposta {
  resposta: string;
  enviarAudio: boolean;
  pedirPermissaoAudio: boolean;
}

export class DecidirCanalRespostaWebhookUseCase {
  execute(entrada: DecidirCanalEntrada): DecisaoCanalResposta {
    const clienteEnviouAudio = clienteMandouAudio(entrada.mensagens);
    const enviarAudio = deveResponderEmAudio({ ...entrada, clienteEnviouAudio });
    const pedirPermissaoAudio = devePedirPermissaoAudio({ ...entrada, clienteEnviouAudio });
    return {
      resposta: pedirPermissaoAudio ? anexarPedidoPermissaoAudio(entrada.resposta) : entrada.resposta,
      enviarAudio,
      pedirPermissaoAudio,
    };
  }
}
