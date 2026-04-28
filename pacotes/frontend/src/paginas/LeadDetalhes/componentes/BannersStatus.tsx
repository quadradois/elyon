/**
 * Banners de status especial (Captado, Perdido, Arquivado)
 */

import { Trophy, XOctagon, Archive } from "lucide-react";

interface BannersStatusProps {
    status: string;
    isPerdidoOuArquivado: boolean;
    isCaptado: boolean;
}

export function BannersStatus({ status, isPerdidoOuArquivado, isCaptado }: BannersStatusProps) {
    if (isCaptado) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                    <Trophy className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <p className="font-medium text-emerald-800">🎉 Imóvel Captado com Sucesso!</p>
                    <p className="text-sm text-emerald-600">Este lead foi convertido em captação</p>
                </div>
            </div>
        );
    }

    if (isPerdidoOuArquivado) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        {status === 'PERDIDO' ? <XOctagon className="w-6 h-6 text-slate-500" /> : <Archive className="w-6 h-6 text-slate-500" />}
                    </div>
                    <div>
                        <p className="font-medium text-slate-800">
                            {status === 'PERDIDO' ? 'Lead Perdido' : 'Lead Arquivado'}
                        </p>
                        <p className="text-sm text-slate-500">Clique em "Reativar" para tentar novamente</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
