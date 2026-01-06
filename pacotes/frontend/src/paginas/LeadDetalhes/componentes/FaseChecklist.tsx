import { CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";

interface FaseChecklistProps {
    status: string;
}

export function FaseChecklist({ status }: FaseChecklistProps) {

    // Definição das tarefas por fase (Alinhado aos 4 Agentes)
    const TAREFAS: Record<string, string[]> = {
        // Fase 1: Opener (Qualificação)
        'NOVO': [
            "Confirmar interesse em vender ou alugar",
            "Identificar DOR 1 (ex: fotos ruins, poucas visitas)",
            "Identificar DOR 2 (ex: corretor sumiu, demora)",
            "Registrar dores identificadas no lead"
        ],
        'QUALIFICADO': [
            "Confirmar interesse em vender ou alugar",
            "Identificar DOR 1 (ex: fotos ruins, poucas visitas)",
            "Identificar DOR 2 (ex: corretor sumiu, demora)",
            "Registrar dores identificadas no lead"
        ],
        // Fase 2: Presenter (Apresentação)
        'TENTATIVA_AGENDAMENTO': [
            "Conectar DOR 1 → Solução específica",
            "Conectar DOR 2 → Solução específica",
            "Apresentar diferenciais da imobiliária",
            "Fazer pergunta: 'Faz sentido dar um upgrade?'"
        ],
        'VISITA_AGENDADA': [
            "Confirmar visita 24h antes",
            "Realizar visita técnica e fotos",
            "Solicitar envio de documentos preliminares"
        ],
        // Fase 3: Closer (Negociação)
        'AVALIACAO_EM_ANDAMENTO': [
            "Realizar estudo de mercado (ACM)",
            "Apresentar avaliação ao proprietário",
            "Iniciar negociação de contrato"
        ],
        'DOCUMENTACAO': [
            "Apresentar opções de contrato (exclusivo/simples)",
            "Justificar comissão como investimento",
            "Contornar objeções (máx 3)",
            "Fazer pergunta: 'Podemos avançar para documentação?'"
        ],
        'EM_NEGOCIACAO': [
            "Apresentar opções de contrato (exclusivo/simples)",
            "Justificar comissão como investimento",
            "Contornar objeções (máx 3)",
            "Fazer pergunta: 'Podemos avançar para documentação?'"
        ],
        // Fase 4: Admin (Onboarding)
        'ONBOARDING': [
            "Solicitar CPF e dados pessoais",
            "Confirmar endereço do imóvel",
            "Enviar contrato para assinatura",
            "Agendar visita de avaliação/fotos"
        ]
    };

    const tarefasAtuais = TAREFAS[status] || [];

    // Se não tiver tarefas (ex: Captado, Perdido), não renderiza nada
    if (tarefasAtuais.length === 0) return null;

    // Identificar nome da fase para display
    const getNomeFase = (s: string) => {
        if (['NOVO', 'QUALIFICADO'].includes(s)) return "Fase 1: Qualificação (Opener)";
        if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'].includes(s)) return "Fase 2: Apresentação (Presenter)";
        if (['DOCUMENTACAO', 'AVALIACAO_EM_ANDAMENTO', 'EM_NEGOCIACAO'].includes(s)) return "Fase 3: Negociação (Closer)";
        if (['ONBOARDING'].includes(s)) return "Fase 4: Onboarding (Admin)";
        return "Checklist";
    };

    return (
        <Card className="border-l-4 border-indigo-500 bg-indigo-50/30 mb-6 shadow-sm">
            <CardHeader className="py-3 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    {getNomeFase(status)}
                </CardTitle>
            </CardHeader>
            <CardContent className="py-2 pb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    {tarefasAtuais.map((tarefa, i) => (
                        <div key={i} className="flex items-start gap-2 p-1.5 rounded hover:bg-white/60 transition-colors">
                            <input
                                type="checkbox"
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                            />
                            <span className="text-sm text-slate-700 font-medium leading-tight">{tarefa}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center justify-end">
                    <p className="text-[10px] text-indigo-400 italic mr-1">Checklist Obrigatório</p>
                </div>
            </CardContent>
        </Card>
    );
}
