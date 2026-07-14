export type PreferenciaAudio = 'PERMITIDO' | 'NEGADO' | 'PERGUNTADO';

export interface MensagemPendente {
  conteudo: string;
  tipo: string;
  messageId?: string;
  timestamp: number;
  urlMidia?: string;
  mimeTypeMidia?: string;
  nomeArquivoMidia?: string;
}

export interface PerfilVendaTenant {
  modalidadesVenda?: string[];
  modalidadePreferencial?: string;
}
