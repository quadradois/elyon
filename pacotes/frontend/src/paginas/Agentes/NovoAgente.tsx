import { useState, useEffect, useRef } from 'react';
import { api } from '../../servicos/api';
import {
    MessageSquare,
    Bot,
    Zap,
    Database,
    Cpu,
    Save,
    Play,
    Target,
    Users,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

// ===================================
// TIPOS
// ===================================

type EspecialistaType = 'CAPTURE' | 'SALES';

interface SkillConfig {
    id: string;
    nome: string;
    icone: any;
    descricao: string;
    ativo: boolean;
    params?: Record<string, any>;
}

// ===================================
// COMPONENTES "PREMIUM"
// ===================================

const ButtonPremium = ({ children, variant = 'primary', className = '', ...props }: any) => {
    const base = "relative overflow-hidden font-medium text-sm px-8 py-3 rounded-lg transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 group";
    const variants: Record<string, string> = {
        primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:translate-y-[-1px]",
        outline: "border border-border bg-card/50 hover:bg-accent hover:border-accent text-foreground backdrop-blur-sm",
        ghost: "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
    };

    return (
        <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
            <span className="relative z-10 flex items-center gap-2">{children}</span>
            {variant === 'primary' && (
                <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 blur-md" />
            )}
        </button>
    );
};

const CardGlass = ({ children, className = '', active = false, onClick }: any) => (
    <div
        onClick={onClick}
        className={`
            relative p-6 rounded-xl border transition-all duration-500 cursor-pointer group overflow-hidden
            ${active
                ? 'bg-card/80 border-blue-500/50 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] transform scale-[1.02]'
                : 'bg-card/40 border-border hover:border-primary/30 hover:bg-card/60'
            } 
            backdrop-blur-md ${className}
        `}
    >
        {active && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/5 pointer-events-none" />
        )}
        {children}
    </div>
);

// ===================================
// PÁGINA PRINCIPAL
// ===================================

const NovoAgente = () => {
    // ESTADO
    const [especialista, setEspecialista] = useState<EspecialistaType | null>(null);
    const [skills, setSkills] = useState<SkillConfig[]>([
        { id: 'AGENDAMENTO', nome: 'Agendamento Inteligente', icone: Play, descricao: 'Agenda visitas sincronizadas com Google Calendar.', ativo: false },
        { id: 'RAG_SEARCH', nome: 'Base de Conhecimento (RAG)', icone: Database, descricao: 'Responde dúvidas técnicas sobre imóveis.', ativo: true },
        { id: 'QUALIFICACAO', nome: 'Qualificação BANT', icone: Target, descricao: 'Filtra leads por Budget, Authority, Need, Focus.', ativo: false },
    ]);

    const [loading, setLoading] = useState(false);

    // CHAT STATE
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize chat when specialist changes
    useEffect(() => {
        if (especialista) {
            setMessages([{
                role: 'assistant',
                content: especialista === 'CAPTURE'
                    ? "Olá! Sou o assistente de captação da Elyon. Como posso ajudar com seu imóvel hoje?"
                    : "Olá! Vi que você se interessou pelo nosso lançamento. Gostaria de conhecer os detalhes?"
            }]);
        } else {
            setMessages([]);
        }
    }, [especialista]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = () => {
        if (!inputValue.trim() || !especialista) return;

        const userMsg = inputValue;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInputValue('');

        // Simulate response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Entendi. Como este é apenas um ambiente de teste, não consigo processar essa solicitação real, mas no agente final eu usaria minhas habilidades ativas para responder."
            }]);
        }, 1000);
    };

    const handleDeploy = async () => {
        if (!especialista) return;

        try {
            setLoading(true);
            const payload = {
                nome: especialista === 'CAPTURE' ? 'Sofia (Captação I.A.)' : 'Carlos (Vendas I.A.)',
                avatar: null,
                sessaoWhatsappId: null,
                regrasNegocio: {
                    builderConfig: {
                        especialista: {
                            id: especialista,
                            subtipo: especialista === 'CAPTURE' ? 'VENDA' : 'LANCAMENTO'
                        },
                        skills: skills.filter(s => s.ativo).map(s => ({
                            id: s.id,
                            parametros: s.params || {}
                        }))
                    }
                },
                personalidade: { tom: 'Profissional' },
                expertise: {},
                scripts: {}
            };

            await api.post('/agentes', payload);
            toast.success("Agente implantado com sucesso!");

            setTimeout(() => {
                window.location.href = '/dashboard/agente';
            }, 1500);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao fazer deploy do agente.");
        } finally {
            setLoading(false);
        }
    };

    // 1. SELEÇÃO DE PERSONA
    const renderSpecialistDeck = () => (
        <div className="flex flex-col gap-6 h-full animate-fade-in" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-foreground tracking-wider">1. PERSONA</h2>
                    <p className="text-xs text-muted-foreground">Quem é o seu agente?</p>
                </div>
            </div>

            <div className="grid gap-4">
                {/* CAPTURE CARD */}
                <CardGlass
                    active={especialista === 'CAPTURE'}
                    onClick={() => setEspecialista('CAPTURE')}
                >
                    <div className="flex items-start gap-4 relative z-10">
                        <div className={`p-3 rounded-lg transition-colors ${especialista === 'CAPTURE' ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Bot className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-foreground">Captação</h3>
                                {especialista === 'CAPTURE' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Especialista em proprietários. Foca em angariar novos imóveis e qualificar vendedores.
                            </p>
                        </div>
                    </div>
                </CardGlass>

                {/* SALES CARD */}
                <CardGlass
                    active={especialista === 'SALES'}
                    onClick={() => setEspecialista('SALES')}
                >
                    <div className="flex items-start gap-4 relative z-10">
                        <div className={`p-3 rounded-lg transition-colors ${especialista === 'SALES' ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Zap className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-foreground">Vendas</h3>
                                {especialista === 'SALES' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Especialista em compradores. Foca em vender lançamentos e qualificar leads quentes.
                            </p>
                        </div>
                    </div>
                </CardGlass>
            </div>
        </div>
    );

    // 2. CONFIGURAÇÃO DE SKILLS
    const renderSkillMatrix = () => (
        <div className="flex flex-col gap-6 h-full animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Cpu className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-foreground tracking-wider">2. SKILLS</h2>
                    <p className="text-xs text-muted-foreground">O que ele sabe fazer?</p>
                </div>
            </div>

            <div className="space-y-3">
                {skills.map(skill => (
                    <CardGlass
                        key={skill.id}
                        active={skill.ativo}
                        className={`py-4 px-5 ${!especialista ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                        onClick={() => {
                            if (!especialista) return;
                            const newSkills = skills.map(s =>
                                s.id === skill.id ? { ...s, ativo: !s.ativo } : s
                            );
                            setSkills(newSkills);
                        }}
                    >
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <skill.icone className={`w-5 h-5 ${skill.ativo ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                <div>
                                    <div className={`font-medium text-sm ${skill.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>{skill.nome}</div>
                                    <div className="text-xs text-muted-foreground">{skill.descricao}</div>
                                </div>
                            </div>
                            <div className={`w-4 h-4 border-2 rounded-full transition-all ${skill.ativo ? 'border-amber-500 bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'border-muted-foreground/30'
                                }`} />
                        </div>
                    </CardGlass>
                ))}
            </div>

            {!especialista && (
                <div className="p-4 rounded-lg border border-dashed border-border bg-card/40 text-center">
                    <p className="text-xs text-muted-foreground">Selecione uma persona para habilitar as skills</p>
                </div>
            )}
        </div>
    );

    // 3. PREVIEW & DEPLOY
    const renderSimulation = () => (
        <div className="flex flex-col gap-6 h-full animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-foreground tracking-wider">3. PREVIEW</h2>
                    <p className="text-xs text-muted-foreground">Teste em tempo real</p>
                </div>
            </div>

            <div className="flex-1 bg-card rounded-xl border border-border relative flex flex-col overflow-hidden shadow-inner">
                {/* Header do Chat */}
                <div className="border-b border-border p-4 flex items-center justify-between bg-muted/30 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-50" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground tracking-wide">ONLINE</span>
                    </div>
                    {especialista && <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground uppercase">{especialista} CHANNEL</span>}
                </div>

                {/* Área de Mensagens */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-gradient-to-b from-card to-muted/20">
                    {!especialista ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border">
                                <Bot className="w-8 h-8 opacity-50" />
                            </div>
                            <span className="text-sm font-medium">Configure seu agente para iniciar</span>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${msg.role === 'assistant'
                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                                            : 'bg-muted border border-border'
                                        }`}>
                                        {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <Users className="w-4 h-4 text-muted-foreground" />}
                                    </div>
                                    <div className={`space-y-2 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                        <div className={`p-4 rounded-2xl text-sm shadow-sm backdrop-blur-sm ${msg.role === 'assistant'
                                                ? 'bg-muted/80 rounded-tl-none border border-border text-foreground'
                                                : 'bg-blue-600/90 rounded-tr-none text-white'
                                            }`}>
                                            <p>{msg.content}</p>
                                        </div>
                                        {msg.role === 'assistant' && idx === 0 && (
                                            <div className="flex gap-2">
                                                {skills.filter(s => s.ativo).map(s => (
                                                    <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground flex items-center gap-1">
                                                        <Zap className="w-3 h-3 text-amber-500" />
                                                        {s.id}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-muted/30 border-t border-border">
                    <div className="relative">
                        <input
                            className="w-full bg-card border border-border rounded-lg pl-4 pr-12 py-3 text-sm text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-muted-foreground"
                            placeholder="Digite uma mensagem..."
                            disabled={!especialista}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button
                            disabled={!especialista}
                            onClick={handleSendMessage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-muted transition-colors"
                        >
                            <Play className="w-4 h-4 fill-current" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 flex justify-end gap-3 border-t border-border/50">
                <ButtonPremium variant="ghost" onClick={() => window.location.href = '/dashboard/agente'}>
                    Cancelar
                </ButtonPremium>
                <ButtonPremium
                    onClick={handleDeploy}
                    disabled={!especialista || loading}
                    className={loading ? 'opacity-80 cursor-wait' : ''}
                >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{loading ? 'Inicializando...' : 'Publicar Agente'}</span>
                </ButtonPremium>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground p-6 lg:p-12 font-sans selection:bg-blue-500/30 selection:text-blue-600">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-50">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <header className="mb-12">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Agent Studio <span className="text-blue-600">Pro</span></h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Crie assistentes de IA avançados combinando personas especializadas e módulos de habilidades.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:h-[650px] items-start">
                    {renderSpecialistDeck()}
                    {renderSkillMatrix()}
                    {renderSimulation()}
                </div>
            </div>
        </div>
    );
};

export default NovoAgente;
