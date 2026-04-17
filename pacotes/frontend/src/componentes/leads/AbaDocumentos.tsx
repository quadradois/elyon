/**
 * AbaDocumentos — Documentos do Lead capturados via WhatsApp
 *
 * Exibe documentos, imagens, áudios enviados pelo cliente via WhatsApp,
 * com ações de visualizar/download e exclusão individual.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../servicos/api';
import { toast } from 'sonner';

// ─── Tipos ───────────────────────────────────────

interface DocumentoLead {
  id: string;
  nomeOriginal?: string;
  mimeType: string;
  tamanhoBytes?: number;
  s3Key: string;
  tipo: string;
  origem: string;
  criadoEm: string;
}

interface AbaDocumentosProps {
  leadId: string;
  leadNome: string;
}

// ─── Helpers ─────────────────────────────────────

function formatarTamanho(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(data: string): string {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Ícone por tipo ───────────────────────────────

function IconeTipo({ tipo, mimeType }: { tipo: string; mimeType: string }) {
  if (tipo === 'imagem' || mimeType.startsWith('image/')) {
    return <ImageIcon className="w-5 h-5 text-blue-500" />;
  }
  if (tipo === 'audio' || mimeType.startsWith('audio/')) {
    return <Mic className="w-5 h-5 text-purple-500" />;
  }
  if (tipo === 'video' || mimeType.startsWith('video/')) {
    return <Video className="w-5 h-5 text-rose-500" />;
  }
  return <FileText className="w-5 h-5 text-amber-600" />;
}

function labelTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    imagem: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    documento: 'Documento',
  };
  return mapa[tipo] || 'Arquivo';
}

// ─── Card de Documento ───────────────────────────

function CardDocumento({
  doc,
  onExcluir,
}: {
  doc: DocumentoLead;
  onExcluir: (id: string) => void;
}) {
  const [baixando, setBaixando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const baixar = async () => {
    if (baixando) return;
    setBaixando(true);
    try {
      const res = await api.get(`/leads/${doc.id}/documentos/${doc.id}/download`);
      window.open(res.data.url, '_blank');
    } catch {
      toast.error('Erro ao gerar link de download');
    } finally {
      setBaixando(false);
    }
  };

  const excluir = async () => {
    if (!confirm('Remover este documento? A ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      onExcluir(doc.id);
    } finally {
      setExcluindo(false);
    }
  };

  const nomeExibido = doc.nomeOriginal || `${labelTipo(doc.tipo)} — ${formatarData(doc.criadoEm)}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all group">
      {/* Ícone */}
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
        <IconeTipo tipo={doc.tipo} mimeType={doc.mimeType} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800 truncate">{nomeExibido}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">{formatarData(doc.criadoEm)}</span>
          {doc.tamanhoBytes && (
            <span className="text-[10px] text-slate-400">· {formatarTamanho(doc.tamanhoBytes)}</span>
          )}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            doc.origem === 'whatsapp'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-indigo-100 text-indigo-700'
          }`}>
            {doc.origem === 'whatsapp' ? 'WhatsApp' : 'Upload'}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={baixar}
          disabled={baixando}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          title="Download"
        >
          {baixando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
        <button
          onClick={excluir}
          disabled={excluindo}
          className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
          title="Excluir"
        >
          {excluindo ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────

export function AbaDocumentos({ leadId }: AbaDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoLead[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get(`/leads/${leadId}/documentos`);
      setDocumentos(res.data.documentos || []);
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  }, [leadId]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [leadId, carregar]);

  const excluir = async (docId: string) => {
    try {
      await api.delete(`/leads/${leadId}/documentos/${docId}`);
      setDocumentos((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Documento removido');
    } catch {
      toast.error('Erro ao remover documento');
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-700">Documentos Recebidos</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {documentos.length === 0
              ? 'Nenhum arquivo ainda'
              : `${documentos.length} arquivo${documentos.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={carregar}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Lista de documentos */}
      {documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <FolderOpen className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum documento</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
            Documentos, imagens e arquivos enviados pelo cliente via WhatsApp aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <CardDocumento key={doc.id} doc={doc} onExcluir={excluir} />
          ))}
        </div>
      )}
    </div>
  );
}
