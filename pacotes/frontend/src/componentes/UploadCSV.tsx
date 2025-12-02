import { useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { api } from "../servicos/api";

interface UploadCSVProps {
  campanhaId: string;
  onSuccess: (resultado: {
    importados: number;
    duplicados: number;
    erros: { linha: number; motivo: string }[];
  }) => void;
  onClose: () => void;
}

type StatusUpload = 'idle' | 'arrastando' | 'processando' | 'sucesso' | 'erro';

interface ResultadoImportacao {
  importados: number;
  duplicados: number;
  totalErros: number;
  erros: { linha: number; motivo: string }[];
}

export function UploadCSV({ campanhaId, onSuccess, onClose }: UploadCSVProps) {
  const [status, setStatus] = useState<StatusUpload>('idle');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string>('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('arrastando');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('idle');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('idle');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validarArquivo(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validarArquivo(files[0]);
    }
  };

  const validarArquivo = (file: File) => {
    setErro('');
    
    // Verificar extensão
    if (!file.name.endsWith('.csv')) {
      setErro('Por favor, selecione um arquivo CSV');
      return;
    }

    // Verificar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErro('Arquivo muito grande. Máximo 10MB');
      return;
    }

    setArquivo(file);
  };

  const enviarArquivo = async () => {
    if (!arquivo) return;

    try {
      setStatus('processando');
      setErro('');

      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const response = await api.post(`/campanhas/${campanhaId}/importar-csv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;
      setResultado(data);
      setStatus('sucesso');
      
      onSuccess({
        importados: data.importados,
        duplicados: data.duplicados,
        erros: data.erros || [],
      });

    } catch (error: any) {
      console.error('Erro ao enviar CSV:', error);
      setStatus('erro');
      setErro(error.response?.data?.erro || 'Erro ao processar arquivo');
    }
  };

  const baixarTemplate = () => {
    window.open(`${api.defaults.baseURL}/campanhas/template-csv`, '_blank');
  };

  const resetar = () => {
    setArquivo(null);
    setStatus('idle');
    setErro('');
    setResultado(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Renderização condicional baseada no status
  if (status === 'sucesso' && resultado) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-900">
            Importação Concluída!
          </h3>
          <p className="text-green-700 mt-2">
            <span className="font-bold">{resultado.importados}</span> contatos importados
          </p>
          {resultado.duplicados > 0 && (
            <p className="text-green-600 text-sm">
              {resultado.duplicados} duplicados ignorados
            </p>
          )}
        </div>

        {resultado.totalErros > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {resultado.totalErros} linha(s) com erro
            </h4>
            <ul className="mt-2 text-sm text-amber-700 space-y-1">
              {resultado.erros.map((err, i) => (
                <li key={i}>
                  Linha {err.linha}: {err.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={resetar}>
            Importar Outro
          </Button>
          <Button onClick={onClose}>
            Concluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão Download Template */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={baixarTemplate}
        >
          <Download className="w-4 h-4" />
          Baixar modelo CSV
        </Button>
      </div>

      {/* Área de Upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${status === 'arrastando' 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
          ${arquivo ? 'border-green-400 bg-green-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Selecionar arquivo CSV"
        />

        {arquivo ? (
          <div className="space-y-2">
            <FileSpreadsheet className="w-12 h-12 text-green-600 mx-auto" />
            <p className="font-medium text-slate-900">{arquivo.name}</p>
            <p className="text-sm text-slate-500">
              {(arquivo.size / 1024).toFixed(1)} KB
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                resetar();
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              Remover
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-12 h-12 text-slate-400 mx-auto" />
            <p className="font-medium text-slate-700">
              Arraste seu arquivo CSV aqui
            </p>
            <p className="text-sm text-slate-500">
              ou clique para selecionar
            </p>
            <p className="text-xs text-slate-400 mt-4">
              Máximo 10MB • Formato CSV com separador ; ou ,
            </p>
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {/* Dicas */}
      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <p className="font-medium mb-2">Colunas reconhecidas:</p>
        <div className="flex flex-wrap gap-2">
          {['nome', 'telefone', 'telefone2', 'email', 'cpf', 'endereco', 'bairro', 'unidade', 'bloco'].map(col => (
            <span key={col} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs">
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={enviarArquivo}
          disabled={!arquivo || status === 'processando'}
        >
          {status === 'processando' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Importar Contatos
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
