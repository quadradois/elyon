import { CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import type { Lead } from "../tipos";

interface FaseChecklistProps {
    lead: Lead;
}

interface ChecklistItem {
    label: string;
    done: boolean;
}

export function FaseChecklist({ lead }: FaseChecklistProps) {
    const status = lead.status;
    const doresCount = lead.spin?.problema?.doresIdentificadas?.length || 0;
    const atividades = lead.atividades || [];

    const temEvidenciaAtividade = (regex: RegExp) =>
        atividades.some((a) => regex.test(`${a.titulo || ""} ${a.descricao || ""}`));

    const toolExecutada = (toolName: string) =>
        atividades.some((a) => (a.titulo || "").includes(`TOOL_EXEC:${toolName}`) && (a.descricao || "").includes('SUCCESS'));

    const faseSpinAtual = lead.conversas?.[0]?.faseSPIN || "";
    const faseSpin = (faseSpinAtual || "").toUpperCase();
    const faseSpinAvancada = ["IMPLICACAO", "NECESSIDADE", "SOLUCAO"].includes(faseSpin);
    const apresentouSolucao = ["SOLUCAO"].includes(faseSpin);

    const temAtividadeAvaliacao = lead.atividades?.some((a) => a.tipo === "AVALIACAO" && !!a.agendadoPara);
    const temDadosPessoais = !!lead.cpf && !!lead.nome && (!!lead.email || !!lead.telefone);
    const temEnderecoImovel = !!lead.imovel?.endereco;

    const moveuParaFase3 = /movido para fase3/i.test(lead.ultimaAcaoIA || "") || ["DOCUMENTACAO", "ONBOARDING", "CAPTADO"].includes(status);
    const moveuParaFase4 = /movido para fase4/i.test(lead.ultimaAcaoIA || "") || ["ONBOARDING", "CAPTADO"].includes(status);

    const temEvidenciaQualificacao =
        toolExecutada('qualificar_lead') ||
        toolExecutada('converter_para_lead') ||
        temEvidenciaAtividade(/lead qualificado/i);

    const temEvidenciaContrato =
        toolExecutada('gerar_link_contrato') ||
        toolExecutada('mover_para_fase') ||
        !!lead.tipoAutorizacao ||
        !!lead.comissaoAcordada ||
        !!lead.contratoUrl ||
        !!lead.dataAssinatura ||
        temEvidenciaAtividade(/contrato|documenta/i);

    const temEvidenciaPitch =
        toolExecutada('mover_para_fase') ||
        apresentouSolucao ||
        moveuParaFase3 ||
        temEvidenciaAtividade(/diferencial|solu(ç|c)ão|faz sentido|upgrade/i);

    // Definição das tarefas por fase com regras automáticas (Alinhado aos 4 Agentes)
    const TAREFAS: Record<string, ChecklistItem[]> = {
        // Fase 1: Opener (Qualificação)
        'NOVO': [
            {
                label: "Confirmar intenção: vender ou alugar",
                done: !!lead.imovel?.interesseEm
            },
            {
                label: "Confirmar tipologia/configuração (tipo e quartos)",
                done: !!lead.imovel?.tipo || lead.imovel?.quartos != null
            },
            {
                label: "Confirmar metragem e ocupação do imóvel",
                done: !!lead.imovel?.area || !!lead.imovel?.ocupacao
            },
            {
                label: "Perguntar se já tem valor em mente",
                done: !!lead.imovel?.valorPretendido
            }
        ],
        // Fase 2: Presenter (Apresentação)
        'TENTATIVA_AGENDAMENTO': [
            {
                label: "Conectar DOR 1 → Solução específica",
                done: doresCount >= 1 && (toolExecutada('qualificar_lead') || faseSpinAvancada || temEvidenciaQualificacao || moveuParaFase3)
            },
            {
                label: "Conectar DOR 2 → Solução específica",
                done: doresCount >= 2 && (toolExecutada('qualificar_lead') || faseSpinAvancada || temEvidenciaQualificacao || moveuParaFase3)
            },
            {
                label: "Apresentar diferenciais da imobiliária",
                done: temEvidenciaPitch
            },
            {
                label: "Fazer pergunta: 'Faz sentido dar um upgrade?'",
                done: toolExecutada('mover_para_fase') || moveuParaFase3 || temEvidenciaAtividade(/faz sentido|upgrade/i)
            }
        ],
        'VISITA_AGENDADA': [
            {
                label: "Confirmar visita 24h antes",
                done: !!lead.proximaAtividade && lead.proximaAtividade.tipo === "AVALIACAO"
            },
            {
                label: "Realizar visita técnica e fotos",
                done: lead.atividades?.some((a) => a.tipo === "AVALIACAO" && !!a.completadoEm) || false
            },
            {
                label: "Solicitar envio de documentos preliminares",
                done: temDadosPessoais
            }
        ],
        // Fase 3: Humano (Documentação)
        'AVALIACAO_EM_ANDAMENTO': [
            {
                label: "Consolidar proposta comercial para documentação",
                done: toolExecutada('agendar_avaliacao') || temEvidenciaAtividade(/acm|estudo de mercado|avalia(ç|c)(ã|a)o/i)
            },
            {
                label: "Validar termos comerciais com o proprietário",
                done: temEvidenciaAtividade(/apresent|proposta|termos|condi(ç|c)(ã|a)o/i) || !!lead.tipoAutorizacao
            },
            {
                label: "Encaminhar para documentação humana",
                done: temEvidenciaContrato
            }
        ],
        'DOCUMENTACAO': [
            {
                label: "Time humano conduzir documentação e contrato",
                done: !!lead.tipoAutorizacao || temEvidenciaAtividade(/exclusiv|simples|contrato/i)
            },
            {
                label: "Definir comissão e modelo de autorização",
                done: !!lead.comissaoAcordada || temEvidenciaAtividade(/comiss(ã|a)o/i)
            },
            {
                label: "Registrar objeções e pendências de formalização",
                done: (lead.spin?.necessidade?.objecoes?.length || 0) > 0 || temEvidenciaAtividade(/obje(ç|c)(ã|a)o/i)
            },
            {
                label: "Concluir transição para onboarding pós-assinatura",
                done: moveuParaFase4 || !!lead.contratoUrl || !!lead.prazoTrabalho
            }
        ],
        // Fase 4: Admin (Onboarding)
        'ONBOARDING': [
            {
                label: "Confirmar CPF, e-mail e dados cadastrais",
                done: temDadosPessoais
            },
            {
                label: "Completar dados técnicos do imóvel",
                done: toolExecutada('atualizar_dados_lead') || temEnderecoImovel || temEvidenciaAtividade(/endere(ç|c)o/i)
            },
            {
                label: "Salvar dados do imóvel para anúncio",
                done: toolExecutada('salvar_dados_imovel') || temEvidenciaAtividade(/dados do im[oó]vel|quartos|metragem|caracter[ií]sticas/i)
            },
            {
                label: "Agendar fotos/visita e enviar para CRM",
                done: (toolExecutada('agendar_avaliacao') || !!temAtividadeAvaliacao) && (toolExecutada('enviar_para_crm') || temEvidenciaAtividade(/crm|enviado para crm|property/i))
            }
        ]
    };

    const tarefasAtuais = TAREFAS[status] || [];

    // Se não tiver tarefas (ex: Captado, Perdido), não renderiza nada
    if (tarefasAtuais.length === 0) return null;

    // Identificar nome da fase para display
    const getNomeFase = (s: string) => {
        if (['NOVO'].includes(s)) return "Fase 1: Qualificação (Opener)";
        if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'].includes(s)) return "Fase 2: Apresentação (Presenter)";
        if (['DOCUMENTACAO', 'AVALIACAO_EM_ANDAMENTO'].includes(s)) return "Fase 3: Documentação (Humano)";
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
                                checked={tarefa.done}
                                readOnly
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-default pointer-events-none flex-shrink-0 opacity-100"
                            />
                            <span className="text-sm text-slate-700 font-medium leading-tight">{tarefa.label}</span>
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
