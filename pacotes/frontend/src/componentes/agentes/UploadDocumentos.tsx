import { useState, useCallback, useRef } from 'react';
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileUp,
  X 
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DocumentoUpload {
  id?: string;
  nome: string;
  tamanho: number;
  tipo: string;
  status: 'pendente' | 'enviando' | 'sucesso' | 'erro';
  arquivo?: File;
  erro?: string;
  textoExtraido?: string;
}

interface UploadDocumentosProps {
  documentos: DocumentoUpload[];
  onDocumentosChange: (docs: DocumentoUpload[]) => void;
  onUpload?: (arquivo: File) => Promise<{ id: string; textoExtraido: string }>;
  maxArquivos?: number;
  maxTamanhoMB?: number;
  tiposAceitos?: string[];
  disabled?: boolean;
  modo?: 'wizard' | 'edicao'; // wizard = só adiciona localmente, edicao = envia imediatamente
}

const TIPOS_ACEITOS_PADRAO = ['.pdf', '.txt', '.doc', '.docx'];
const MAX_TAMANHO_PADRAO = 10; // MB

export function UploadDocumentos({
  documentos,
  onDocumentosChange,
  onUpload,
  maxArquivos = 10,
  maxTamanhoMB = MAX_TAMANHO_PADRAO,
  tiposAceitos = TIPOS_ACEITOS_PADRAO,
  disabled = false,
  modo = 'wizard',
}: UploadDocumentosProps) {
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatarTamanho = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validarArquivo = (arquivo: File): string | null => {
    // Verificar tipo
    const extensao = '.' + arquivo.name.split('.').pop()?.toLowerCase();
    if (!tiposAceitos.includes(extensao)) {
      return `Tipo não suportado. Use: ${tiposAceitos.join(', ')}`;
    }

    // Verificar tamanho
    const tamanhoMB = arquivo.size / (1024 * 1024);
    if (tamanhoMB > maxTamanhoMB) {
      return `Arquivo muito grande. Máximo: ${maxTamanhoMB}MB`;
    }

    // Verificar duplicidade
    if (documentos.some(d => d.nome === arquivo.name)) {
      return 'Arquivo já adicionado';
    }

    // Verificar limite de arquivos
    if (documentos.length >= maxArquivos) {
      return `Limite de ${maxArquivos} arquivos atingido`;
    }

    return null;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const adicionarArquivos = useCallback(async (arquivos: FileList | File[]) => {
    const novosDocumentos: DocumentoUpload[] = [];

    for (const arquivo of Array.from(arquivos)) {
      const erro = validarArquivo(arquivo);
      
      const novoDoc: DocumentoUpload = {
        nome: arquivo.name,
        tamanho: arquivo.size,
        tipo: arquivo.type || 'application/octet-stream',
        status: erro ? 'erro' : 'pendente',
        arquivo: erro ? undefined : arquivo,
        erro: erro || undefined,
      };

      novosDocumentos.push(novoDoc);
    }

    const todosDocumentos = [...documentos, ...novosDocumentos];
    onDocumentosChange(todosDocumentos);

    // Se modo edição e tem onUpload, envia imediatamente os válidos
    if (modo === 'edicao' && onUpload) {
      for (const doc of novosDocumentos.filter(d => d.status === 'pendente')) {
        await enviarDocumento(doc, todosDocumentos);
      }
    }
  }, [documentos, onDocumentosChange, onUpload, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviarDocumento = async (doc: DocumentoUpload, listaDocs: DocumentoUpload[]) => {
    if (!doc.arquivo || !onUpload) return;

    // Atualizar status para enviando
    const docsAtualizados = listaDocs.map(d => 
      d.nome === doc.nome ? { ...d, status: 'enviando' as const } : d
    );
    onDocumentosChange(docsAtualizados);

    try {
      const resultado = await onUpload(doc.arquivo);
      
      // Atualizar com sucesso
      onDocumentosChange(docsAtualizados.map(d => 
        d.nome === doc.nome 
          ? { ...d, id: resultado.id, status: 'sucesso' as const, textoExtraido: resultado.textoExtraido } 
          : d
      ));
    } catch (error: any) {
      // Atualizar com erro
      onDocumentosChange(docsAtualizados.map(d => 
        d.nome === doc.nome 
          ? { ...d, status: 'erro' as const, erro: error.message || 'Erro ao enviar' } 
          : d
      ));
    }
  };

  const removerDocumento = (nome: string) => {
    onDocumentosChange(documentos.filter(d => d.nome !== nome));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setArrastando(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      adicionarArquivos(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      adicionarArquivos(e.target.files);
      e.target.value = ''; // Reset para permitir selecionar o mesmo arquivo
    }
  };

  const getIconeStatus = (status: DocumentoUpload['status']) => {
    switch (status) {
      case 'enviando':
        return <Loader2 className="w-4 h-4 animate-spin text-brand" />;
      case 'sucesso':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'erro':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Área de Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          arrastando 
            ? "border-brand bg-indigo-50" 
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={tiposAceitos.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          title="Selecionar documentos"
          aria-label="Selecionar documentos para upload"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center",
            arrastando ? "bg-indigo-100" : "bg-slate-100"
          )}>
            <FileUp className={cn(
              "w-7 h-7",
              arrastando ? "text-brand" : "text-slate-400"
            )} />
          </div>
          
          <div>
            <p className="font-medium text-slate-700">
              {arrastando ? 'Solte os arquivos aqui' : 'Arraste PDFs ou clique para selecionar'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {tiposAceitos.join(', ')} • Máx. {maxTamanhoMB}MB por arquivo
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Documentos */}
      {documentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Documentos ({documentos.length}/{maxArquivos})
          </p>
          
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div
                key={doc.nome}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  doc.status === 'erro' 
                    ? "bg-red-50 border-red-200" 
                    : doc.status === 'sucesso'
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-slate-200"
                )}
              >
                {getIconeStatus(doc.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-700 truncate">
                    {doc.nome}
                  </p>
                  <p className="text-xs text-slate-500">
                    {doc.erro || formatarTamanho(doc.tamanho)}
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removerDocumento(doc.nome);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remover documento"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dica */}
      {documentos.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">💡 O que subir?</p>
              <ul className="text-amber-800 mt-1 space-y-1">
                <li>• Manuais de atendimento e scripts</li>
                <li>• Políticas detalhadas da imobiliária</li>
                <li>• Treinamentos e materiais exclusivos</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
