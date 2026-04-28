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
import { PageHeader } from '../componentes/ui/page-header';
import {
    ArrowLeft,
    Link2,
    Save,
    TestTube,
    CheckCircle2,
    XCircle,
    Loader2,
    Eye,
    EyeOff,
    ExternalLink,
    Trash2,
    Building2,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Integracao {
    id: string;
    tipo: string;
    nome: string;
    apiUrl: string;
    temApiKey: boolean;
    tenantIdDestino: number | null;
    ativo: boolean;
    ultimoTesteEm: string | null;
    ultimoTesteOk: boolean | null;
    ultimoErro: string | null;
    totalEnvios: number;
    totalSucessos: number;
    totalFalhas: number;
    ultimoEnvioEm: string | null;
}

export function Integracoes() {
    const navigate = useNavigate();
    const token = localStorage.getItem('elyon_token');
    const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [testando, setTestando] = useState<string | null>(null);
    const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

    // URL fixa do CRM - não precisa configurar
    const CRM_API_URL = 'https://api.quadradois.com.br/api';

    // Form state - apenas API Key necessária
    const [formData, setFormData] = useState({
        tipo: 'CRM_QUADRADOIS',
        nome: 'CRM Principal',
        apiUrl: CRM_API_URL, // URL fixa
        apiKey: '',
        tenantIdDestino: '', // Vem da API Key no backend
    });
    const [mostrarApiKey, setMostrarApiKey] = useState(false);
    const [editando, setEditando] = useState(false);

    // Carregar configurações existentes
    const carregarIntegracoes = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/configuracao/integracao', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setIntegracoes(data.integracoes);

                // Se já existe config do CRM, preencher form
                const crmConfig = data.integracoes.find((i: Integracao) => i.tipo === 'CRM_QUADRADOIS');
                if (crmConfig) {
                    setFormData({
                        tipo: crmConfig.tipo,
                        nome: crmConfig.nome,
                        apiUrl: crmConfig.apiUrl,
                        apiKey: '', // Não retornamos a key por segurança
                        tenantIdDestino: crmConfig.tenantIdDestino?.toString() || '',
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar integrações:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarIntegracoes();
    }, [token]);

    // Salvar configuração
    const salvar = async () => {
        if (!formData.apiKey && !crmIntegracao?.temApiKey) {
            setMensagem({ tipo: 'erro', texto: 'API Key é obrigatória' });
            return;
        }

        try {
            setSalvando(true);
            const response = await fetch('/api/configuracao/integracao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (data.success) {
                setMensagem({ tipo: 'sucesso', texto: 'Configuração salva com sucesso!' });
                setEditando(false);
                setFormData(prev => ({ ...prev, apiKey: '' })); // Limpar key do form
                await carregarIntegracoes();
            } else {
                setMensagem({ tipo: 'erro', texto: data.error || 'Erro ao salvar' });
            }
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro de conexão' });
        } finally {
            setSalvando(false);
        }
    };

    // Testar conexão
    const testarConexao = async (tipo: string) => {
        try {
            setTestando(tipo);
            const response = await fetch(`/api/configuracao/integracao/${tipo}/testar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setMensagem({ tipo: 'sucesso', texto: 'Conexão estabelecida com sucesso!' });
            } else {
                setMensagem({ tipo: 'erro', texto: data.error || 'Falha na conexão' });
            }
            await carregarIntegracoes();
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro ao testar conexão' });
        } finally {
            setTestando(null);
        }
    };

    // Remover integração
    const remover = async (tipo: string) => {
        if (!confirm('Tem certeza que deseja remover esta integração?')) return;

        try {
            await fetch(`/api/configuracao/integracao/${tipo}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            setMensagem({ tipo: 'sucesso', texto: 'Integração removida' });
            await carregarIntegracoes();
        } catch (error) {
            setMensagem({ tipo: 'erro', texto: 'Erro ao remover' });
        }
    };

    // Limpar mensagem após 5s
    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => setMensagem(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);

    const crmIntegracao = integracoes.find(i => i.tipo === 'CRM_QUADRADOIS');

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <PageHeader
                title="Integrações"
                description="Configure conexões com sistemas externos"
                icon={<Link2 className="w-5 h-5" />}
                actions={(
                    <Button
                        variant="outline"
                        onClick={() => navigate('/dashboard/configuracoes')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Button>
                )}
            />

            {/* Mensagem de feedback */}
            {mensagem && (
                <div
                    className={cn(
                        'px-4 py-3 rounded-lg flex items-center gap-2 text-sm',
                        mensagem.tipo === 'sucesso'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    )}
                >
                    {mensagem.tipo === 'sucesso' ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <XCircle className="w-4 h-4" />
                    )}
                    {mensagem.texto}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* CRM Quadradois */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-brand" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">CRM Quadradois</CardTitle>
                                        <CardDescription>
                                            Envia leads captados automaticamente para o CRM de gestão
                                        </CardDescription>
                                    </div>
                                </div>

                                {crmIntegracao && (
                                    <div className="flex items-center gap-2">
                                        {crmIntegracao.ultimoTesteOk ? (
                                            <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Conectado
                                            </span>
                                        ) : crmIntegracao.ultimoTesteOk === false ? (
                                            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                                <XCircle className="w-3 h-3" />
                                                Erro
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                                                Não testado
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Estatísticas se configurado */}
                            {crmIntegracao && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-slate-900">{crmIntegracao.totalEnvios}</p>
                                        <p className="text-xs text-slate-500">Total Envios</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{crmIntegracao.totalSucessos}</p>
                                        <p className="text-xs text-slate-500">Sucessos</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-red-600">{crmIntegracao.totalFalhas}</p>
                                        <p className="text-xs text-slate-500">Falhas</p>
                                    </div>
                                </div>
                            )}

                            {/* Formulário - Apenas API Key */}
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="apiKey">
                                        API Key {crmIntegracao?.temApiKey && !editando && '(configurada)'}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="apiKey"
                                            type={mostrarApiKey ? 'text' : 'password'}
                                            placeholder={crmIntegracao?.temApiKey && !editando ? '••••••••••••••••' : 'Cole aqui a chave gerada no CRM'}
                                            value={formData.apiKey}
                                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                            disabled={crmIntegracao && !editando}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarApiKey(!mostrarApiKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {mostrarApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Gere a chave no CRM em <strong>Configurações → Elyon - Captação</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Erro do último teste */}
                            {crmIntegracao?.ultimoErro && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                    <p className="text-sm text-red-700">
                                        <strong>Último erro:</strong> {crmIntegracao.ultimoErro}
                                    </p>
                                </div>
                            )}

                            {/* Ações */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="flex items-center gap-2">
                                    {crmIntegracao ? (
                                        <>
                                            {!editando ? (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setEditando(true)}
                                                >
                                                    Editar
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditando(false);
                                                        carregarIntegracoes();
                                                    }}
                                                >
                                                    Cancelar
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                onClick={() => testarConexao('CRM_QUADRADOIS')}
                                                disabled={testando === 'CRM_QUADRADOIS'}
                                            >
                                                {testando === 'CRM_QUADRADOIS' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                ) : (
                                                    <TestTube className="w-4 h-4 mr-2" />
                                                )}
                                                Testar Conexão
                                            </Button>
                                        </>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                    {crmIntegracao && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            onClick={() => remover('CRM_QUADRADOIS')}
                                        >
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            Remover
                                        </Button>
                                    )}

                                    {(!crmIntegracao || editando) && (
                                        <Button
                                            onClick={salvar}
                                            disabled={salvando}
                                        >
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

                    {/* Info adicional */}
                    <Card className="bg-indigo-50 border-indigo-100">
                        <CardContent className="py-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <ExternalLink className="w-4 h-4 text-brand" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-900">Como funciona?</h4>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Após configurar a integração, os leads captados pelo agente IA serão
                                        automaticamente enviados para o CRM quando marcados como "CAPTADO".
                                        O CRM criará o Proprietário e o Imóvel no sistema de gestão.
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

export default Integracoes;
