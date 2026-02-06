import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../componentes/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../componentes/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import {
    Search,
    Plus,
    Loader2,
    MoreHorizontal,
    Pencil,
    Trash2,
    Copy,
    Sparkles,
    BookOpen,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Save,
    Download,
} from "lucide-react";
import { api } from "../servicos/api";
import { toast } from "sonner";

// Types
interface Playbook {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    ePadrao: boolean;
    estaAtivo: boolean;
    agente?: { nome: string } | null;
    _count?: { etapas: number };
    criadoEm: string;
}

interface AgenteOpcao {
    id: string;
    nome: string;
}

export function Playbooks() {
    const navigate = useNavigate();
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [termoBusca, setTermoBusca] = useState("");

    // Dialog states
    const [dialogCriar, setDialogCriar] = useState(false);
    const [dialogIA, setDialogIA] = useState(false);
    const [criando, setCriando] = useState(false);

    // AI Generation states
    const [abaModoIA, setAbaModoIA] = useState<"perguntas" | "escrever" | "colar">("perguntas");
    const [conteudoIA, setConteudoIA] = useState("");
    const [gerando, setGerando] = useState(false);
    const [playbookGerado, setPlaybookGerado] = useState<any>(null);

    // Guided chat states
    const [chatPasso, setChatPasso] = useState(0);
    const [chatRespostas, setChatRespostas] = useState<Record<string, string>>({});

    // Perguntas dinâmicas baseadas no tipo de estratégia
    const estrategiaOutbound = chatRespostas.estrategia === "outbound";
    const chatPerguntas = [
        {
            id: "estrategia",
            pergunta: "Qual tipo de campanha você vai usar?",
            placeholder: "Clique na opção desejada",
            tipo: "opcoes",
            opcoes: [
                { valor: "outbound", label: "📤 Outbound (Prospecção Ativa)", descricao: "Você entra em contato com listas de clientes" },
                { valor: "inbound", label: "📥 Inbound (Receptivo)", descricao: "O cliente entra em contato com você" }
            ]
        },
        {
            id: "produto",
            pergunta: "Qual produto ou serviço você está vendendo?",
            placeholder: "Ex: Chácaras à beira do Rio dos Bois, Apartamentos na Zona Sul, Lotes em condomínio..."
        },
        {
            id: "publico",
            pergunta: estrategiaOutbound
                ? "Qual o perfil da lista que você vai prospectar?"
                : "Qual o perfil ideal do seu cliente?",
            placeholder: estrategiaOutbound
                ? "Ex: Lista de CPFs da região X, leads que visitaram estande, contatos de redes sociais..."
                : "Ex: Famílias de 35-50 anos, classe média, buscando lazer nos fins de semana..."
        },
        {
            id: "abordagem",
            pergunta: estrategiaOutbound
                ? "Como você faz o primeiro contato com o lead?"
                : "Quais perguntas você sempre faz para o cliente?",
            placeholder: estrategiaOutbound
                ? "Ex: 'Oi, tudo bem? Vi que você tem interesse em imóveis na região X. Posso te apresentar uma oportunidade?'"
                : "Ex: Qual seu orçamento? É pra lazer ou investimento? Pode visitar no fim de semana?"
        },
        {
            id: "objecoes",
            pergunta: estrategiaOutbound
                ? "Quais objeções você mais ouve no primeiro contato?"
                : "Quais são as objeções mais comuns que você ouve?",
            placeholder: estrategiaOutbound
                ? "Ex: 'Não tenho interesse', 'De onde pegou meu número?', 'Já tenho corretor', 'Não é o momento'..."
                : "Ex: 'Está caro', 'Vou pensar', 'Preciso falar com minha esposa', 'Agora não é o momento'..."
        },
        {
            id: "qualificacao",
            pergunta: estrategiaOutbound
                ? "O que você precisa descobrir para saber se o lead é quente?"
                : "Qual o diferencial do seu produto?",
            placeholder: estrategiaOutbound
                ? "Ex: Se tem interesse real, orçamento disponível, prazo para comprar, se é decisor..."
                : "Ex: Acesso direto ao rio, parcelas fixas sem consulta SPC, infraestrutura completa..."
        }
    ];

    // Agentes para vincular
    const [agentes, setAgentes] = useState<AgenteOpcao[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        nome: "",
        descricao: "",
        tipo: "QUALIFICACAO",
        agenteId: "",
    });

    useEffect(() => {
        carregarPlaybooks();
        carregarAgentes();
    }, []);

    const carregarPlaybooks = async () => {
        try {
            setLoading(true);
            const response = await api.get("/playbooks");
            setPlaybooks(response.data.playbooks || []);
        } catch (error) {
            console.error("Erro ao carregar playbooks:", error);
            setErro("Não foi possível carregar os playbooks.");
        } finally {
            setLoading(false);
        }
    };

    const carregarAgentes = async () => {
        try {
            const response = await api.get("/agentes");
            setAgentes(response.data.agentes || []);
        } catch (error) {
            console.error("Erro ao carregar agentes:", error);
        }
    };

    const criarPlaybook = async () => {
        if (!formData.nome) {
            toast.error("Nome é obrigatório");
            return;
        }

        try {
            setCriando(true);
            const response = await api.post("/playbooks", {
                nome: formData.nome,
                descricao: formData.descricao || null,
                tipo: formData.tipo,
                agenteId: formData.agenteId || null,
            });

            toast.success("Playbook criado com sucesso!");
            setDialogCriar(false);
            setFormData({ nome: "", descricao: "", tipo: "QUALIFICACAO", agenteId: "" });

            // Navegar para edição
            navigate(`/dashboard/playbooks/${response.data.playbook.id}`);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao criar playbook");
        } finally {
            setCriando(false);
        }
    };

    const duplicarPlaybook = async (id: string) => {
        try {
            await api.post(`/playbooks/${id}/duplicar`);
            toast.success("Playbook duplicado!");
            carregarPlaybooks();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao duplicar");
        }
    };

    const excluirPlaybook = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este playbook?")) return;

        try {
            await api.delete(`/playbooks/${id}`);
            toast.success("Playbook excluído!");
            carregarPlaybooks();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao excluir");
        }
    };



    // ===== AI GENERATION =====
    const gerarPlaybookIA = async () => {
        if (!conteudoIA.trim() || conteudoIA.length < 20) {
            toast.error("Descreva seu atendimento com mais detalhes (mínimo 20 caracteres)");
            return;
        }

        try {
            setGerando(true);
            setPlaybookGerado(null);

            const response = await api.post("/playbooks/gerar", {
                conteudo: conteudoIA,
                tipo: "QUALIFICACAO"
            });

            if (response.data.sucesso) {
                setPlaybookGerado(response.data.playbook);
                toast.success(`✨ Playbook gerado com ${response.data.estatisticas.etapas} etapas!`);
            } else {
                toast.error("Erro ao gerar playbook");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao gerar playbook com IA");
        } finally {
            setGerando(false);
        }
    };

    const salvarPlaybookGerado = async () => {
        if (!playbookGerado) return;

        try {
            setCriando(true);
            const response = await api.post("/playbooks/gerar", {
                conteudo: conteudoIA,
                tipo: "QUALIFICACAO",
                salvarAutomatico: true
            });

            if (response.data.salvo) {
                toast.success(`Playbook "${response.data.playbook.nome}" salvo com sucesso!`);
                setDialogIA(false);
                setConteudoIA("");
                setPlaybookGerado(null);
                carregarPlaybooks();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao salvar playbook");
        } finally {
            setCriando(false);
        }
    };

    // ===== GUIDED CHAT FUNCTIONS =====
    const responderPergunta = (resposta: string) => {
        const perguntaAtual = chatPerguntas[chatPasso];
        setChatRespostas(prev => ({ ...prev, [perguntaAtual.id]: resposta }));
    };

    const avancarChat = (forceSkipValidation = false) => {
        // Se não for forçado, validar resposta
        if (!forceSkipValidation) {
            const perguntaAtual = chatPerguntas[chatPasso];
            if (!chatRespostas[perguntaAtual.id]?.trim()) {
                toast.error("Por favor, responda a pergunta antes de continuar");
                return;
            }
        }
        if (chatPasso < chatPerguntas.length - 1) {
            setChatPasso(prev => prev + 1);
        }
    };

    const voltarChat = () => {
        if (chatPasso > 0) {
            setChatPasso(prev => prev - 1);
        }
    };

    const gerarDoChat = async () => {
        // Montar o conteúdo a partir das respostas, adaptado por estratégia
        const isOutbound = chatRespostas.estrategia === "outbound";

        const textoCompleto = `
TIPO DE CAMPANHA: ${isOutbound ? "OUTBOUND (Prospecção Ativa)" : "INBOUND (Receptivo)"}

PRODUTO/SERVIÇO: ${chatRespostas.produto || ""}

${isOutbound ? "PERFIL DA LISTA DE PROSPECÇÃO" : "PÚBLICO-ALVO"}: ${chatRespostas.publico || ""}

${isOutbound ? "ABORDAGEM INICIAL" : "PERGUNTAS QUE FAÇO AO CLIENTE"}:
${chatRespostas.abordagem || ""}

OBJEÇÕES COMUNS:
${chatRespostas.objecoes || ""}

${isOutbound ? "CRITÉRIOS DE QUALIFICAÇÃO (LEAD QUENTE)" : "DIFERENCIAIS DO PRODUTO"}:
${chatRespostas.qualificacao || ""}
        `.trim();

        setConteudoIA(textoCompleto);

        try {
            setGerando(true);
            setPlaybookGerado(null);

            const response = await api.post("/playbooks/gerar", {
                conteudo: textoCompleto,
                tipo: "QUALIFICACAO",
                contexto: `Produto: ${chatRespostas.produto}. Público: ${chatRespostas.publico}`
            });

            if (response.data.sucesso) {
                setPlaybookGerado(response.data.playbook);
                toast.success(`✨ Playbook gerado com ${response.data.estatisticas.etapas} etapas!`);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao gerar playbook");
        } finally {
            setGerando(false);
        }
    };

    const resetarChat = () => {
        setChatPasso(0);
        setChatRespostas({});
        setPlaybookGerado(null);
        setConteudoIA("");
    };

    // Filtro
    const playbooksFiltrados = playbooks.filter(p =>
        p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        p.tipo.toLowerCase().includes(termoBusca.toLowerCase())
    );

    // Badge de tipo
    const getTipoBadge = (tipo: string) => {
        const cores: Record<string, string> = {
            QUALIFICACAO: "bg-blue-100 text-blue-800",
            VENDA: "bg-green-100 text-green-800",
            LOCACAO: "bg-purple-100 text-purple-800",
            CAPTACAO: "bg-orange-100 text-orange-800",
            COMERCIAL: "bg-slate-100 text-slate-800",
        };
        return cores[tipo] || "bg-slate-100 text-slate-800";
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">📋 Playbooks</h1>
                    <p className="text-slate-500 mt-1">
                        Roteiros dinâmicos para seus agentes de IA
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* Botão Criar com IA */}
                    <Dialog open={dialogIA} onOpenChange={setDialogIA}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                Criar com IA
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-purple-500" />
                                    Assistente de Criação de Playbook
                                </DialogTitle>
                                <DialogDescription>
                                    Descreva seu atendimento em texto livre - a IA vai estruturar para você.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 pt-2">
                                {/* Abas de modo - 3 opções */}
                                {!playbookGerado && (
                                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                                        <button
                                            onClick={() => { setAbaModoIA("perguntas"); resetarChat(); }}
                                            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all ${abaModoIA === "perguntas"
                                                ? "bg-white shadow text-slate-900"
                                                : "text-slate-600 hover:text-slate-900"
                                                }`}
                                        >
                                            💬 Responder Perguntas
                                        </button>
                                        <button
                                            onClick={() => { setAbaModoIA("escrever"); setPlaybookGerado(null); }}
                                            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all ${abaModoIA === "escrever"
                                                ? "bg-white shadow text-slate-900"
                                                : "text-slate-600 hover:text-slate-900"
                                                }`}
                                        >
                                            📝 Texto Livre
                                        </button>
                                        <button
                                            onClick={() => { setAbaModoIA("colar"); setPlaybookGerado(null); }}
                                            className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all ${abaModoIA === "colar"
                                                ? "bg-white shadow text-slate-900"
                                                : "text-slate-600 hover:text-slate-900"
                                                }`}
                                        >
                                            📄 Colar JSON
                                        </button>
                                    </div>
                                )}

                                {/* ===== ABA 1: PERGUNTAS GUIADAS ===== */}
                                {abaModoIA === "perguntas" && !playbookGerado && (
                                    <div className="space-y-4">
                                        {/* Progresso */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-600">
                                                Pergunta {chatPasso + 1} de {chatPerguntas.length}
                                            </span>
                                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                                                <div
                                                    className="bg-purple-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${((chatPasso + 1) / chatPerguntas.length) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Pergunta atual */}
                                        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                                            <p className="text-lg font-medium text-slate-800">
                                                {chatPerguntas[chatPasso].pergunta}
                                            </p>
                                        </div>

                                        {/* Input da resposta - condicional por tipo */}
                                        {(chatPerguntas[chatPasso] as any).tipo === "opcoes" ? (
                                            <div className="space-y-3">
                                                {(chatPerguntas[chatPasso] as any).opcoes?.map((opcao: any) => (
                                                    <button
                                                        key={opcao.valor}
                                                        onClick={() => {
                                                            responderPergunta(opcao.valor);
                                                            // Auto-avançar após selecionar (força skip de validação)
                                                            setTimeout(() => avancarChat(true), 300);
                                                        }}
                                                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${chatRespostas[chatPerguntas[chatPasso].id] === opcao.valor
                                                            ? "border-purple-500 bg-purple-50"
                                                            : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                                                            }`}
                                                    >
                                                        <div className="font-medium text-slate-800">{opcao.label}</div>
                                                        <div className="text-sm text-slate-500 mt-1">{opcao.descricao}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <textarea
                                                placeholder={chatPerguntas[chatPasso].placeholder}
                                                value={chatRespostas[chatPerguntas[chatPasso].id] || ""}
                                                onChange={(e) => responderPergunta(e.target.value)}
                                                className="w-full h-28 p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                            />
                                        )}

                                        {/* Botões de navegação */}
                                        <div className="flex gap-3">
                                            {chatPasso > 0 && (
                                                <Button variant="outline" onClick={voltarChat} className="gap-2">
                                                    ← Voltar
                                                </Button>
                                            )}

                                            {chatPasso < chatPerguntas.length - 1 ? (
                                                <Button
                                                    onClick={() => avancarChat()}
                                                    className="flex-1 gap-2"
                                                    disabled={!chatRespostas[chatPerguntas[chatPasso].id]?.trim()}
                                                >
                                                    Próxima →
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={gerarDoChat}
                                                    disabled={gerando || !chatRespostas[chatPerguntas[chatPasso].id]?.trim()}
                                                    className="flex-1 gap-2"
                                                >
                                                    {gerando ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Gerando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="h-4 w-4" />
                                                            ✨ Gerar Playbook
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ===== ABA 2 e 3: ESCREVER / COLAR ===== */}
                                {(abaModoIA === "escrever" || abaModoIA === "colar") && !playbookGerado && (
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-2">
                                            {abaModoIA === "escrever"
                                                ? "Descreva como você atende um cliente interessado:"
                                                : "Cole o texto, JSON ou conteúdo que você já tem:"}
                                        </label>
                                        <textarea
                                            placeholder={abaModoIA === "escrever"
                                                ? "Ex: Quando o cliente chama, primeiro cumprimento e pergunto o que está buscando. Depois pergunto se é pra lazer ou investimento, qual o orçamento, se pode visitar no fim de semana..."
                                                : "Cole aqui seu guia, manual, JSON ou qualquer conteúdo descrevendo o atendimento..."
                                            }
                                            value={conteudoIA}
                                            onChange={(e) => setConteudoIA(e.target.value)}
                                            className="w-full h-40 p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        />
                                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                                            <span>{conteudoIA.length} caracteres</span>
                                            <span>Mínimo: 20 caracteres</span>
                                        </div>

                                        <Button
                                            onClick={gerarPlaybookIA}
                                            disabled={gerando || conteudoIA.length < 20}
                                            className="w-full gap-2 mt-4"
                                        >
                                            {gerando ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Gerando Playbook... (10-20 segundos)
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    ✨ Gerar Playbook
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* Preview do Playbook Gerado */}
                                {playbookGerado && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-green-700 font-medium">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Playbook gerado com sucesso!
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-lg border">
                                            <h3 className="font-semibold text-lg text-slate-900">
                                                {playbookGerado.nome}
                                            </h3>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {playbookGerado.descricao}
                                            </p>

                                            <div className="mt-4 space-y-2">
                                                {playbookGerado.etapas?.map((etapa: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                                        <span className="text-lg">{etapa.icone || '📋'}</span>
                                                        <div>
                                                            <span className="font-medium">{etapa.nome}</span>
                                                            <span className="text-slate-500 ml-2">
                                                                ({etapa.itens?.length || 0} itens)
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 pt-3 border-t flex gap-4 text-xs text-slate-500">
                                                <span>📋 {playbookGerado.etapas?.length || 0} etapas</span>
                                                <span>✅ {playbookGerado.etapas?.reduce((a: number, e: any) => a + (e.itens?.length || 0), 0)} itens</span>
                                                <span>💬 {playbookGerado.etapas?.reduce((a: number, e: any) => a + (e.objecoes?.length || 0), 0)} objeções</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => setPlaybookGerado(null)}
                                                className="flex-1"
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                Gerar Novamente
                                            </Button>
                                            <Button
                                                onClick={salvarPlaybookGerado}
                                                disabled={criando}
                                                className="flex-1"
                                            >
                                                {criando ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Salvando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="h-4 w-4 mr-2" />
                                                        Salvar Playbook
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {/* Botão Exportar JSON */}
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                const json = JSON.stringify(playbookGerado, null, 2);
                                                const blob = new Blob([json], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `playbook-${playbookGerado.nome?.replace(/\s+/g, '-').toLowerCase() || 'export'}.json`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                toast.success('JSON exportado!');
                                            }}
                                            className="w-full gap-2 text-slate-600"
                                        >
                                            <Download className="h-4 w-4" />
                                            Exportar JSON
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Botão Criar Manual */}
                    <Dialog open={dialogCriar} onOpenChange={setDialogCriar}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Novo Playbook
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Criar Novo Playbook</DialogTitle>
                                <DialogDescription>
                                    Defina as informações básicas do seu playbook
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Nome *</label>
                                    <Input
                                        placeholder="Ex: Qualificação de Vendas"
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Descrição</label>
                                    <Input
                                        placeholder="Descreva o objetivo do playbook"
                                        value={formData.descricao}
                                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Tipo</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 p-2.5"
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                    >
                                        <option value="QUALIFICACAO">📊 Qualificação</option>
                                        <option value="VENDA">💰 Venda</option>
                                        <option value="LOCACAO">🏠 Locação</option>
                                        <option value="CAPTACAO">🎯 Captação</option>
                                        <option value="COMERCIAL">💼 Comercial</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Vincular a Agente (Opcional)</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 p-2.5"
                                        value={formData.agenteId}
                                        onChange={(e) => setFormData({ ...formData, agenteId: e.target.value })}
                                    >
                                        <option value="">Nenhum (usar como template)</option>
                                        {agentes.map((agente) => (
                                            <option key={agente.id} value={agente.id}>
                                                {agente.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setDialogCriar(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button onClick={criarPlaybook} disabled={criando}>
                                        {criando ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Criando...
                                            </>
                                        ) : (
                                            "Criar Playbook"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Buscar playbooks..."
                    className="pl-10"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : erro ? (
                <div className="text-center text-red-500 py-8">{erro}</div>
            ) : playbooksFiltrados.length === 0 ? (
                <div className="text-center py-16">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">
                        Nenhum playbook encontrado
                    </h3>
                    <p className="text-slate-500 mt-1">
                        Clique em "Novo Playbook" para criar seu primeiro roteiro
                    </p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Agente</TableHead>
                            <TableHead>Etapas</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {playbooksFiltrados.map((playbook) => (
                            <TableRow
                                key={playbook.id}
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={() => navigate(`/dashboard/playbooks/${playbook.id}`)}
                            >
                                <TableCell>
                                    <div>
                                        <div className="font-medium text-slate-900">{playbook.nome}</div>
                                        {playbook.descricao && (
                                            <div className="text-sm text-slate-500 truncate max-w-xs">
                                                {playbook.descricao}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoBadge(playbook.tipo)}`}>
                                        {playbook.tipo}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {playbook.agente?.nome || (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {playbook._count?.etapas || 0} etapas
                                </TableCell>
                                <TableCell>
                                    {playbook.estaAtivo ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Ativo
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <XCircle className="h-4 w-4" />
                                            Inativo
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="sm">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/dashboard/playbooks/${playbook.id}`);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    duplicarPlaybook(playbook.id);
                                                }}
                                            >
                                                <Copy className="h-4 w-4 mr-2" />
                                                Duplicar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    excluirPlaybook(playbook.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}

export default Playbooks;
