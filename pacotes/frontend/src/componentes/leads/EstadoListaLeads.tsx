import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

export function EstadoCarregandoLeads({ texto = 'Atualizando oportunidades...' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-72 bg-white rounded-2xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
      <p className="text-sm text-slate-600 font-medium">{texto}</p>
    </div>
  );
}

export function EstadoVazioLeads({
  titulo = 'Nenhuma oportunidade no filtro atual',
  descricao = 'Ajuste os filtros ou adicione novos leads.',
}: {
  titulo?: string;
  descricao?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-72 bg-white rounded-2xl border border-dashed border-slate-300">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      <p className="text-xs text-slate-400 mt-1">{descricao}</p>
    </div>
  );
}

export function EstadoErroLeads({
  mensagem = 'Falha ao carregar oportunidades. Tente atualizar novamente.',
}: {
  mensagem?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-72 bg-white rounded-2xl border border-red-200">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <p className="text-sm font-semibold text-red-700">Erro de carregamento</p>
      <p className="text-xs text-red-500 mt-1 text-center max-w-sm">{mensagem}</p>
    </div>
  );
}
