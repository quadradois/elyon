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
    Settings,
    Plus,
    Key,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfigLLM {
    id: string;
    tipoProvider: string;
    modeloPreferido: string;
    ativo: boolean;
    priorizacao: number;
    baseUrl: string | null;
    totalChamadas: number;
    totalTokensInput: bigint;
    totalTokensOutput: bigint;
    custoEstimado: number;
    ultimoUsoEm: string | null;
    ultimoTesteOk: boolean | null;
    ultimoErro: string | null;
}

interface ProviderInfo {
    tipo: string;
    nome: string;
    icone: string;
    cor: string;
    modelos: string[];
}

const PROVIDERS: ProviderInfo[] = [
    {
        tipo: 'OPENAI',
        nome: 'OpenAI',
        icone: '🤖',
        cor: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        modelos: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    {
        tipo: 'ANTHROPIC',
        nome: 'Anthropic',
        icone: '🧠',
        cor: 'bg-orange-50 border-orange-200 text-orange-700',
        modelos: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
    },
    {
        tipo: 'GROQ',
        nome: 'Groq',
        icone: '⚡',
        cor: 'bg-purple-50 border-purple-200 text-purple-700',
        modelos: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
    },
    {
        tipo: 'MISTRAL',
        nome: 'Mistral',
        icone: '🌀',
        cor: 'bg-blue-50 border-blue-200 text-blue-700',
        modelos: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']
    },
    {
        tipo: 'AZURE_OPENAI',
        nome: 'Azure OpenAI',
        icone: '☁️',
        cor: 'bg-cyan-50 border-cyan-200 text-cyan-700',
        modelos: ['gpt-4', 'gpt-35-turbo']
    },
    {
        tipo: 'GOOGLE_VERTEX',
        nome: 'Google Vertex AI',
        icone: '🔵',
        cor: 'bg-red-50 border-red-200 text-red-700',
        modelos: ['gemini-pro', 'gemini-1.5-pro']
    },
    {
        tipo: 'TOGETHER',
        nome: 'Together AI',
        icone: '🤝',
        cor: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        modelos: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1']
    },
    {
        tipo: 'DEEPSEEK',
        nome: 'DeepSeek',
        icone: '🔍',
        cor: 'bg-slate-50 border-slate-200 text-slate-700',
        modelos: ['deepseek-chat', 'deepseek-coder']
    },
];

export function ConfiguracaoLLM() {
    const navigate = useNavigate();
    const token = localStorage.getItem('elyon_token');
    const [configs, setConfigs] = useState<ConfigLLM[]>([]);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [testando, setTestando] = useState<string | null>(null);
    const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
    const [providerAtivo, setProviderAtivo] = useState<string>('SYSTEM_DEFAULT');
    const [metricas, setMetricas] = useState<any>(null);

    // Form state para adicionar nova config
    const [mostrarForm, setMostrarForm] = useState(false);
    const [formData, setFormData] = useState({
        tipoProvider: '',
        modeloPreferido: '',
        apiKey: '',
        baseUrl: '',
        priorizacao: '',
    });
    const [mostrarApiKey, setMostrarApiKey] = useState(false);

    // Carregar configurações
    const carregarConfigs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/configuracao/llm', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (data.configs) {
                setConfigs(data.configs);
                setProviderAtivo(data.providerAtivo || 'SYSTEM_DEFAULT');
            }
        } catch (error) {
            console.error('Erro ao carregar configs LLM:', error);
        } finally {
            setLoading(false);
        }
    };

    // Carregar métricas
    const carregarMetricas = async () => {
        try {
            const response = await fetch('/api/configuracao/llm/metricas', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            setMetricas(data);
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        }
    };

    useEffect(() => {
        carregarConfigs();
        carregarMetricas();
    }, [token]);

    // Salvar nova configuração
    const salvar = async () => {
        if (!formData.tipoProvider || !formData.modeloPreferido || !formData.apiKey) {
            setMensagem({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios' });
            return;
        }

        try {
            setSalvando(true);

            // Sanitizar payload
            const payload: any = {
                ...formData,
                baseUrl: formData.baseUrl?.trim() || undefined,
                priorizacao: formData.priorizacao ? Number(formData.priorizacao) : undefined
            };

            // Se for update e apiKey estiver vazia, não enviar (para não sobrescrever com vazio)
            // Mas aqui estamos no POST (criar), então apiKey é obrigatória e já validada no início da função.
            // Para segurança, removemos se vazia.
            if (!payload.apiKey) delete payload.apiKey;

            const response = await fetch('/api/configuracao/llm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (response.ok) {
                setMensagem({ tipo: 'sucesso', texto: 'Configuração salva com sucesso!' });
                setMostrarForm(false);
                setFormData({ tipoProvider: '', modeloPreferido: '', apiKey: '', baseUrl: '', priorizacao: '' });
                await carregarConfigs();
            } else {
                setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao salvar' });
            }
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
        } finally {
            setSalvando(false);
        }
    };

    // Testar conexão
    const testarConexao = async (tipoProvider: string) => {
        try {
            setTestando(tipoProvider);
            const response = await fetch(`/api/configuracao/llm/${tipoProvider}/testar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.sucesso) {
                setMensagem({ tipo: 'sucesso', texto: 'Conexão testada com sucesso!' });
            } else {
                setMensagem({ tipo: 'erro', texto: data.erro || 'Falha no teste' });
            }
            await carregarConfigs();
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro ao testar conexão' });
        } finally {
            setTestando(null);
        }
    };

    // Remover configuração
    const remover = async (tipoProvider: string) => {
        if (!confirm('Remover esta configuração? O sistema usará a chave padrão.')) return;

        try {
            await fetch(`/api/configuracao/llm/${tipoProvider}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            setMensagem({ tipo: 'sucesso', texto: 'Configuração removida' });
            await carregarConfigs();
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro ao remover' });
        }
    };

    // Limpar mensagem
    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => setMensagem(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);

    const getProviderInfo = (tipo: string) => PROVIDERS.find(p => p.tipo === tipo);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/dashboard/configuracoes')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Configuração de IA</h1>
                        <p className="text-sm text-slate-500">
                            Use sua própria chave de API (BYOK)
                        </p>
                    </div>
                </div>
            </div>

            {/* Mensagem de feedback */}
            {mensagem && (
                <div
                    className={cn(
                        'px-4 py-3 rounded-lg flex items-center gap-2 text-sm',
                        mensagem.tipo === 'sucesso'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    )}
                >
                    {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {mensagem.texto}
                </div>
            )}

            {/* Status atual */}
            <Card className={cn(
                "border-2",
                providerAtivo === 'SYSTEM_DEFAULT'
                    ? "bg-blue-50 border-blue-200"
                    : "bg-green-50 border-green-200"
            )}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                providerAtivo === 'SYSTEM_DEFAULT' ? "bg-blue-100" : "bg-green-100"
                            )}>
                                {providerAtivo === 'SYSTEM_DEFAULT' ? (
                                    <Zap className="w-5 h-5 text-blue-600" />
                                ) : (
                                    <Key className="w-5 h-5 text-green-600" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    {providerAtivo === 'SYSTEM_DEFAULT'
                                        ? 'Usando chave do sistema'
                                        : `Usando sua chave: ${getProviderInfo(providerAtivo)?.nome || providerAtivo}`
                                    }
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {providerAtivo === 'SYSTEM_DEFAULT'
                                        ? 'Claude Haiku (Anthropic) - incluído no plano'
                                        : 'BYOK ativo - você controla os custos'
                                    }
                                </p>
                            </div>
                        </div>
                        {metricas && (
                            <div className="text-right">
                                <p className="text-2xl font-bold text-slate-900">{metricas.total?.chamadas || 0}</p>
                                <p className="text-xs text-slate-500">chamadas totais</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Configs existentes */}
                    {configs.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                                Suas Configurações
                            </h2>
                            <div className="space-y-3">
                                {configs.map(config => {
                                    const provider = getProviderInfo(config.tipoProvider);
                                    return (
                                        <Card key={config.id} className={cn("border", provider?.cor)}>
                                            <CardContent className="py-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">{provider?.icone || '🔌'}</span>
                                                        <div>
                                                            <h4 className="font-semibold">{provider?.nome || config.tipoProvider}</h4>
                                                            <p className="text-sm text-slate-500">{config.modeloPreferido}</p>
                                                        </div>
                                                        {config.ativo && (
                                                            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                                                Ativo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {config.ultimoTesteOk === true && (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        )}
                                                        {config.ultimoTesteOk === false && (
                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => testarConexao(config.tipoProvider)}
                                                            disabled={testando === config.tipoProvider}
                                                        >
                                                            {testando === config.tipoProvider ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <TestTube className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:bg-red-50"
                                                            onClick={() => remover(config.tipoProvider)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {config.ultimoErro && (
                                                    <p className="mt-2 text-xs text-red-600">{config.ultimoErro}</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Botão para adicionar */}
                    {!mostrarForm && (
                        <Button
                            variant="outline"
                            className="w-full py-6 border-dashed"
                            onClick={() => setMostrarForm(true)}
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Adicionar sua API Key
                        </Button>
                    )}

                    {/* Formulário para nova config */}
                    {mostrarForm && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Nova Configuração BYOK</CardTitle>
                                <CardDescription>
                                    Adicione sua própria chave de API para controlar custos e performance
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Provider */}
                                <div>
                                    <Label>Provider</Label>
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {PROVIDERS.map(provider => (
                                            <button
                                                key={provider.tipo}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        tipoProvider: provider.tipo,
                                                        modeloPreferido: provider.modelos[0]
                                                    });
                                                }}
                                                className={cn(
                                                    "p-3 rounded-lg border-2 text-center transition-all",
                                                    formData.tipoProvider === provider.tipo
                                                        ? provider.cor + " border-current"
                                                        : "border-slate-200 hover:border-slate-300"
                                                )}
                                            >
                                                <span className="text-xl block">{provider.icone}</span>
                                                <span className="text-xs mt-1 block">{provider.nome}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Modelo */}
                                {formData.tipoProvider && (
                                    <div>
                                        <Label>Modelo</Label>
                                        <select
                                            className="w-full mt-1 p-2 border rounded-lg"
                                            value={formData.modeloPreferido}
                                            onChange={(e) => setFormData({ ...formData, modeloPreferido: e.target.value })}
                                        >
                                            {getProviderInfo(formData.tipoProvider)?.modelos.map(modelo => (
                                                <option key={modelo} value={modelo}>{modelo}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* API Key */}
                                <div>
                                    <Label>API Key</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            type={mostrarApiKey ? 'text' : 'password'}
                                            placeholder="sk-..."
                                            value={formData.apiKey}
                                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarApiKey(!mostrarApiKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {mostrarApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setMostrarForm(false);
                                            setFormData({ tipoProvider: '', modeloPreferido: '', apiKey: '', baseUrl: '', priorizacao: '' });
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button onClick={salvar} disabled={salvando}>
                                        {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Salvar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Info */}
                    <Card className="bg-violet-50 border-violet-100">
                        <CardContent className="py-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Settings className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-900">O que é BYOK?</h4>
                                    <p className="text-sm text-slate-600 mt-1">
                                        <strong>Bring Your Own Key</strong> permite usar sua própria chave de API de provedores como
                                        OpenAI, Anthropic, Groq, etc. Você controla os custos e pode usar modelos mais avançados
                                        ou mais baratos conforme sua necessidade.
                                    </p>
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
