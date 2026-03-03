import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../componentes/ui/card';
import { Button } from '../componentes/ui/button';
import { Input } from '../componentes/ui/input';
import { Label } from '../componentes/ui/label';
import {
    ArrowLeft,
    Brain,
    Save,
    TestTube,
    CheckCircle2,
    XCircle,
    Loader2,
    Eye,
    EyeOff,
    Trash2,
    Zap,
    Info,
    ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Combobox } from '../componentes/ui/combobox';
import { Badge } from '../componentes/ui/badge';

interface LLMConfig {
    provedor: string | null;
    modelo: string | null;
    baseUrl: string | null;
    temApiKey: boolean;
    usando_padrao: boolean;
}

interface Provedor {
    nome: string;
    baseUrl?: string;
    modelos: string[];
}

const LOGOS: Record<string, string> = {
    openai: '🤖',
    openrouter: '🌉',
    groq: '⚡',
    custom: '🛠️',
    moonshot: '🌙',
    anthropic: '🧠'
};

interface ModeloOpenRouter {
    id: string;
    name: string;
    isFree: boolean;
    pricing: {
        prompt: string;
        completion: string;
    };
}

export function ConfiguracaoLLM() {
    const navigate = useNavigate();
    const token = localStorage.getItem('elyon_token');

    const [config, setConfig] = useState<LLMConfig | null>(null);
    const [provedores, setProvedores] = useState<Record<string, Provedor>>({});
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [testando, setTestando] = useState(false);
    const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

    const [form, setForm] = useState({
        provedor: '',
        modelo: '',
        apiKey: '',
        baseUrl: '',
    });
    const [mostrarKey, setMostrarKey] = useState(false);
    const [editando, setEditando] = useState(false);
    const [modelosOpenRouter, setModelosOpenRouter] = useState<ModeloOpenRouter[]>([]);
    const [carregandoModelos, setCarregandoModelos] = useState(false);

    const carregarConfig = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/configuracao/llm', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setProvedores(data.provedores || {});
                if (data.config.provedor) {
                    setForm(prev => ({
                        ...prev,
                        provedor: data.config.provedor || '',
                        modelo: data.config.modelo || '',
                        baseUrl: data.config.baseUrl || '',
                    }));
                }
            }
        } catch {
            setMensagem({ tipo: 'erro', texto: 'Erro ao carregar configuração' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarConfig();
    }, []);

    const carregarModelosOpenRouter = async () => {
        try {
            setCarregandoModelos(true);
            const res = await fetch('/api/configuracao/llm/modelos-openrouter', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setModelosOpenRouter(data.modelos);
            }
        } catch (error) {
            console.error('Erro ao carregar modelos OpenRouter:', error);
        } finally {
            setCarregandoModelos(false);
        }
    };

    useEffect(() => {
        if (form.provedor === 'openrouter' && modelosOpenRouter.length === 0) {
            carregarModelosOpenRouter();
        }
    }, [form.provedor]);

    // Auto-preenche baseUrl ao trocar provedor
    useEffect(() => {
        if (form.provedor && provedores[form.provedor]) {
            setForm(prev => {
                // Se a página acabou de carregar e o config do DB bate com o form, evita sobrescrever
                if (config && config.provedor === form.provedor && config.modelo === prev.modelo) {
                    return prev;
                }
                return {
                    ...prev,
                    baseUrl: provedores[form.provedor]?.baseUrl || '',
                    modelo: provedores[form.provedor]?.modelos[0] || '',
                };
            });
        }
    }, [form.provedor, provedores, config]);

    // Limpa a mensagem de feedback após 5s
    useEffect(() => {
        if (mensagem) {
            const t = setTimeout(() => setMensagem(null), 5000);
            return () => clearTimeout(t);
        }
    }, [mensagem]);

    const salvar = async () => {
        if (!form.provedor || !form.modelo) {
            setMensagem({ tipo: 'erro', texto: 'Selecione um provedor e um modelo' });
            return;
        }
        if (!form.apiKey && !config?.temApiKey) {
            setMensagem({ tipo: 'erro', texto: 'API Key é obrigatória' });
            return;
        }
        try {
            setSalvando(true);
            const res = await fetch('/api/configuracao/llm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    provedor: form.provedor,
                    modelo: form.modelo,
                    apiKey: form.apiKey || undefined,
                    baseUrl: form.baseUrl || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMensagem({ tipo: 'sucesso', texto: data.message });
                setEditando(false);
                setForm(prev => ({ ...prev, apiKey: '' }));
                await carregarConfig();
            } else {
                setMensagem({ tipo: 'erro', texto: data.error });
            }
        } catch {
            setMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
        } finally {
            setSalvando(false);
        }
    };

    const testar = async () => {
        try {
            setTestando(true);
            const res = await fetch('/api/configuracao/llm/testar', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setMensagem({
                tipo: data.success ? 'sucesso' : 'erro',
                texto: data.success ? data.message : (data.error || 'Falha no teste'),
            });
        } catch {
            setMensagem({ tipo: 'erro', texto: 'Erro ao testar conexão' });
        } finally {
            setTestando(false);
        }
    };

    const remover = async () => {
        if (!confirm('Remover a configuração e voltar ao provedor padrão do sistema?')) return;
        try {
            const res = await fetch('/api/configuracao/llm', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setMensagem({ tipo: 'sucesso', texto: data.message });
                setForm({ provedor: '', modelo: '', apiKey: '', baseUrl: '' });
                await carregarConfig();
            }
        } catch {
            setMensagem({ tipo: 'erro', texto: 'Erro ao remover configuração' });
        }
    };

    const modelosSelecionado = form.provedor ? (provedores[form.provedor]?.modelos || []) : [];

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/dashboard/configuracoes')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Provedor de IA (BYOK)</h1>
                        <p className="text-sm text-slate-500">
                            Use sua própria chave de API para OpenAI, Anthropic ou OpenRouter
                        </p>
                    </div>
                </div>
            </div>

            {/* Feedback */}
            {mensagem && (
                <div className={cn(
                    'px-4 py-3 rounded-lg flex items-center gap-2 text-sm border',
                    mensagem.tipo === 'sucesso'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                )}>
                    {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                    {mensagem.texto}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Card de Status Atual */}
                    {config && !config.usando_padrao && (
                        <Card className="border-violet-200 bg-violet-50/50">
                            <CardContent className="flex items-center justify-between py-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{LOGOS[config.provedor!] || '🤖'}</span>
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {provedores[config.provedor!]?.nome || config.provedor}
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            Modelo: <code className="bg-white px-1 rounded text-xs">{config.modelo}</code>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">
                                        <Zap className="w-3 h-3" />
                                        BYOK Ativo
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {config?.usando_padrao && (
                        <Card className="border-slate-200 bg-slate-50/50">
                            <CardContent className="flex items-center gap-3 py-4">
                                <Info className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                <p className="text-sm text-slate-600">
                                    Usando o provedor padrão do sistema (<strong>OpenAI GPT-4.1</strong>). Configure abaixo para usar sua própria chave.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Card de Configuração */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-2xl">
                                        {form.provedor ? (LOGOS[form.provedor] || '🤖') : '🔑'}
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">Configuração BYOK</CardTitle>
                                        <CardDescription>
                                            Trazer sua própria chave reduz custo e aumenta controle
                                        </CardDescription>
                                    </div>
                                </div>
                                {config?.temApiKey && !editando && (
                                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Configurado
                                    </span>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            {/* Provedor */}
                            <div>
                                <Label htmlFor="provedor">Provedor</Label>
                                <div className="relative mt-1">
                                    <select
                                        id="provedor"
                                        className="w-full h-10 pl-3 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                                        value={form.provedor}
                                        onChange={e => setForm(prev => ({ ...prev, provedor: e.target.value }))}
                                        disabled={config?.temApiKey && !editando}
                                    >
                                        <option value="">Selecione um provedor...</option>
                                        {Object.entries(provedores).map(([key, p]) => (
                                            <option key={key} value={key}>
                                                {LOGOS[key]} {p.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Modelo */}
                            <div>
                                <Label htmlFor="modelo">Modelo</Label>
                                <div className="mt-1 space-y-2">
                                    {form.provedor === 'openrouter' ? (
                                        <Combobox
                                            options={modelosOpenRouter.map(m => ({
                                                value: m.id,
                                                label: m.name,
                                                render: (
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="truncate">{m.name}</span>
                                                        {m.isFree ? (
                                                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 ml-2">
                                                                Grátis
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 ml-2">
                                                                ${(parseFloat(m.pricing.prompt) * 1000000).toFixed(2)}/M
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            }))}
                                            value={form.modelo}
                                            onValueChange={(val) => setForm(prev => ({ ...prev, modelo: val }))}
                                            placeholder={carregandoModelos ? "Carregando modelos..." : "Buscar modelo no OpenRouter..."}
                                            disabled={(config?.temApiKey && !editando) || carregandoModelos}
                                        />
                                    ) : (
                                        <div className="relative">
                                            <select
                                                id="modelo"
                                                className="w-full h-10 pl-3 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                                                value={form.modelo}
                                                onChange={e => setForm(prev => ({ ...prev, modelo: e.target.value }))}
                                                disabled={config?.temApiKey && !editando}
                                            >
                                                {modelosSelecionado.length === 0 && (
                                                    <option value="">Selecione o provedor primeiro...</option>
                                                )}
                                                {modelosSelecionado.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <div className="h-[1px] bg-slate-100 flex-1" />
                                        <span className="text-[10px] text-slate-400 uppercase font-medium">Ou personalize</span>
                                        <div className="h-[1px] bg-slate-100 flex-1" />
                                    </div>

                                    <Input
                                        placeholder="ID do modelo (ex: anthropic/claude-3.5-sonnet)"
                                        value={form.modelo}
                                        onChange={e => setForm(prev => ({ ...prev, modelo: e.target.value }))}
                                        disabled={config?.temApiKey && !editando}
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    No OpenRouter, use o formato <code>provedor/nome-do-modelo</code>.
                                </p>
                            </div>

                            {/* API Key */}
                            <div>
                                <Label htmlFor="apiKey">
                                    API Key{config?.temApiKey && !editando ? ' (salva com segurança)' : ''}
                                </Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="apiKey"
                                        type={mostrarKey ? 'text' : 'password'}
                                        placeholder={
                                            config?.temApiKey && !editando
                                                ? '••••••••••••••••'
                                                : 'sk-... ou ant-...'
                                        }
                                        value={form.apiKey}
                                        onChange={e => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                                        disabled={config?.temApiKey && !editando}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarKey(!mostrarKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {mostrarKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    A chave é criptografada antes de ser armazenada e nunca é exibida novamente.
                                </p>
                            </div>

                            {/* Base URL customizada (somente para OpenRouter ou proxy) */}
                            {(form.provedor === 'openrouter' || form.provedor === '') && (
                                <div>
                                    <Label htmlFor="baseUrl">Base URL (opcional)</Label>
                                    <Input
                                        id="baseUrl"
                                        placeholder="https://openrouter.ai/api/v1"
                                        value={form.baseUrl}
                                        onChange={e => setForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                                        disabled={config?.temApiKey && !editando}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Útil para proxies via OpenRouter ou gateways LiteLLM.
                                    </p>
                                </div>
                            )}

                            {/* Ações */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="flex items-center gap-2">
                                    {config?.temApiKey && !editando ? (
                                        <>
                                            <Button variant="outline" onClick={() => setEditando(true)}>
                                                Editar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={testar}
                                                disabled={testando}
                                            >
                                                {testando ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <TestTube className="w-4 h-4 mr-2" />
                                                )}
                                                Testar Conexão
                                            </Button>
                                        </>
                                    ) : config?.temApiKey && editando ? (
                                        <Button
                                            variant="ghost"
                                            onClick={() => { setEditando(false); carregarConfig(); setForm(prev => ({ ...prev, apiKey: '' })); }}
                                        >
                                            Cancelar
                                        </Button>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                    {config?.temApiKey && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            onClick={remover}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Usar Padrão
                                        </Button>
                                    )}
                                    {(!config?.temApiKey || editando) && (
                                        <Button onClick={salvar} disabled={salvando}>
                                            {salvando ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Save className="w-4 h-4 mr-2" />
                                            )}
                                            Salvar Configuração
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <Card className="bg-blue-50 border-blue-100 shadow-sm">
                        <CardContent className="py-5">
                            <div className="flex items-start gap-4">
                                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <h4 className="font-bold text-slate-900 text-sm">Como funciona a compatibilidade?</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        O motor de agentes do Elyon utiliza o <strong>protocolo padrão da OpenAI</strong>. Isso significa que ele é compatível com qualquer provedor que aceite esse formato.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                        <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                            <p className="text-xs font-bold text-blue-800 uppercase mb-1">Dica para Claude/Gemini</p>
                                            <p className="text-xs text-slate-600">
                                                Para usar modelos como <strong>Claude 3.5 Sonnet</strong>, a forma mais estável é via <strong>OpenRouter</strong>, que traduz o sinal para o formato que nossos agentes entendem.
                                            </p>
                                        </div>
                                        <div className="bg-white/50 p-3 rounded-lg border border-blue-100">
                                            <p className="text-xs font-bold text-blue-800 uppercase mb-1">Outros Provedores</p>
                                            <p className="text-xs text-slate-600">
                                                Serviços como <strong>Groq</strong> ou <strong>Together AI</strong> funcionam nativamente pois já seguem o padrão necessário.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default ConfiguracaoLLM;
