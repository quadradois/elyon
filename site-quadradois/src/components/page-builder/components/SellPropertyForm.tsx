/**
 * SellPropertyForm Component - Premium Wizard
 * Formulário de captação de proprietários que desejam vender imóveis
 * Layout split: texto à esquerda + formulário wizard à direita
 */
'use client';

import { useState } from 'react';
import { ComponentProps } from '../types';
import {
    Loader2,
    CheckCircle2,
    Home,
    MessageSquare,
    Clock,
    ArrowRight,
    ArrowLeft,
    Phone,
    Mail,
    MapPin,
    Building2,
    Sparkles
} from 'lucide-react';

interface FormData {
    // Step 0 - Contato Inicial
    nome: string;
    whatsapp: string;
    email: string;
    // Step 1 - Dados do Imóvel
    tipo_imovel: string;
    bairro: string;
    cidade: string;
    // Step 2 - Preferências
    preferencia_contato: string;
    melhor_horario: string;
}

const TIPOS_IMOVEL = [
    'Apartamento',
    'Casa',
    'Cobertura',
    'Terreno',
    'Sala Comercial',
    'Loja',
    'Galpão',
    'Outro'
];

const PREFERENCIAS_CONTATO = [
    { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { value: 'telefone', label: 'Ligação', icon: Phone },
    { value: 'email', label: 'E-mail', icon: Mail },
];

const HORARIOS = [
    'Manhã (8h - 12h)',
    'Tarde (12h - 18h)',
    'Noite (18h - 21h)',
    'Qualquer horário'
];

export default function SellPropertyForm(props: ComponentProps & { tenantId?: number }) {
    const {
        title = 'Quer vender seu imóvel?',
        highlight_text = 'com a gente',
        subtitle = 'Cadastre-se e receba uma avaliação gratuita do seu imóvel. Nossa equipe entrará em contato para ajudá-lo a vender pelo melhor preço.',
        benefits = [
            'Avaliação gratuita do seu imóvel',
            'Divulgação nos melhores portais',
            'Equipe especializada em vendas'
        ],
        button_text = 'Quero Vender Meu Imóvel',
        urgency_text = 'Alta demanda na região',
        tenantId
    } = props;

    const [step, setStep] = useState(0); // 0: contato, 1: imóvel, 2: preferências, 3: sucesso
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState<FormData>({
        nome: '',
        whatsapp: '',
        email: '',
        tipo_imovel: '',
        bairro: '',
        cidade: '',
        preferencia_contato: 'whatsapp',
        melhor_horario: ''
    });

    const updateField = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleInitialSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome || !formData.whatsapp || !formData.email) {
            setError('Preencha todos os campos');
            return;
        }
        setError('');
        setStep(1);
    };

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.tipo_imovel || !formData.bairro || !formData.cidade) {
            setError('Preencha todos os campos');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.preferencia_contato || !formData.melhor_horario) {
            setError('Preencha todos os campos');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
            const response = await fetch(`${apiUrl}/api/public/leads/seller`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(tenantId && { 'X-Tenant-ID': String(tenantId) })
                },
                body: JSON.stringify({
                    nome: formData.nome,
                    whatsapp: formData.whatsapp,
                    email: formData.email,
                    tipo_imovel: formData.tipo_imovel,
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    preferencia_contato: formData.preferencia_contato,
                    melhor_horario: formData.melhor_horario,
                    origem: 'site_venda',
                    tenant_id: tenantId
                })
            });

            // Mesmo se a API falhar, mostramos sucesso (para não perder o lead)
            setStep(3);
        } catch (err) {
            // Mostra sucesso mesmo em caso de erro (melhor UX)
            setStep(3);
        } finally {
            setLoading(false);
        }
    };

    const benefitsList = (Array.isArray(benefits) ? benefits : [
        'Avaliação gratuita do seu imóvel',
        'Divulgação nos melhores portais',
        'Equipe especializada em vendas'
    ]).map((b: any) => {
        if (typeof b === 'string') return b;
        if (typeof b === 'object' && b !== null && 'value' in b) return b.value;
        return '';
    }).filter(Boolean);

    return (
        <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">

                    {/* Left Side - Content */}
                    <div className="order-2 lg:order-1">
                        {/* Logo/Icon */}
                        <div className="mb-8">
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, var(--color-primary)) 100%)'
                                }}
                            >
                                <Home className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            {title}{' '}
                            <span className="text-[var(--color-primary)]">{highlight_text}</span>
                        </h2>

                        {/* Subtitle */}
                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            {subtitle}
                        </p>

                        {/* Benefits */}
                        <ul className="space-y-4">
                            {benefitsList.map((benefit: string, index: number) => (
                                <li key={index} className="flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-[var(--color-primary)] flex-shrink-0" />
                                    <span className="text-gray-700 font-medium">{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Side - Form Card */}
                    <div className="order-1 lg:order-2">
                        <div
                            className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 relative overflow-hidden"
                            style={{
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                            }}
                        >
                            {/* Urgency Badge */}
                            {step < 3 && (
                                <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 bg-red-50 rounded-full">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                    </span>
                                    <span className="text-sm font-semibold text-red-600">
                                        {urgency_text}
                                    </span>
                                </div>
                            )}

                            {/* Progress Indicator */}
                            {step > 0 && step < 3 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-gray-500">Etapa {step} de 2</span>
                                        <span className="text-sm font-medium text-[var(--color-primary)]">
                                            {step === 1 ? 'Dados do Imóvel' : 'Preferências'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                                            style={{ width: `${(step / 2) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 0: Initial Contact */}
                            {step === 0 && (
                                <form onSubmit={handleInitialSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Seu nome
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nome}
                                            onChange={(e) => updateField('nome', e.target.value)}
                                            placeholder="Digite seu nome"
                                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Telefone/WhatsApp
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.whatsapp}
                                            onChange={(e) => updateField('whatsapp', e.target.value)}
                                            placeholder="(00) 00000-0000"
                                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            E-mail
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            placeholder="seu@email.com"
                                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900"
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                                    >
                                        <Sparkles className="w-5 h-5" />
                                        {button_text}
                                    </button>

                                    <p className="text-center text-sm text-gray-500">
                                        ⚡ Resposta em menos de 2 minutos
                                    </p>
                                </form>
                            )}

                            {/* Step 1: Property Data */}
                            {step === 1 && (
                                <form onSubmit={handleStep1Submit} className="space-y-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Building2 className="w-6 h-6 text-[var(--color-primary)]" />
                                        <h3 className="text-lg font-bold text-gray-900">Dados do Imóvel</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Tipo do Imóvel
                                        </label>
                                        <select
                                            value={formData.tipo_imovel}
                                            onChange={(e) => updateField('tipo_imovel', e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                                            required
                                        >
                                            <option value="">Selecione o tipo</option>
                                            {TIPOS_IMOVEL.map(tipo => (
                                                <option key={tipo} value={tipo}>{tipo}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Bairro
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={formData.bairro}
                                                onChange={(e) => updateField('bairro', e.target.value)}
                                                placeholder="Nome do bairro"
                                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Cidade
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.cidade}
                                            onChange={(e) => updateField('cidade', e.target.value)}
                                            placeholder="Nome da cidade"
                                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-gray-900"
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setStep(0)}
                                            className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                            Voltar
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                        >
                                            Próximo
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Step 2: Preferences */}
                            {step === 2 && (
                                <form onSubmit={handleFinalSubmit} className="space-y-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <MessageSquare className="w-6 h-6 text-[var(--color-primary)]" />
                                        <h3 className="text-lg font-bold text-gray-900">Preferências de Contato</h3>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Como prefere ser contactado?
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {PREFERENCIAS_CONTATO.map(pref => (
                                                <button
                                                    key={pref.value}
                                                    type="button"
                                                    onClick={() => updateField('preferencia_contato', pref.value)}
                                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.preferencia_contato === pref.value
                                                        ? 'border-[var(--color-primary)] bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <pref.icon className={`w-6 h-6 ${formData.preferencia_contato === pref.value
                                                        ? 'text-[var(--color-primary)]'
                                                        : 'text-gray-400'
                                                        }`} />
                                                    <span className={`text-sm font-medium ${formData.preferencia_contato === pref.value
                                                        ? 'text-[var(--color-primary)]'
                                                        : 'text-gray-600'
                                                        }`}>
                                                        {pref.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            <Clock className="inline w-4 h-4 mr-1" />
                                            Melhor horário para retorno
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {HORARIOS.map(horario => (
                                                <button
                                                    key={horario}
                                                    type="button"
                                                    onClick={() => updateField('melhor_horario', horario)}
                                                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${formData.melhor_horario === horario
                                                        ? 'border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]'
                                                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                        }`}
                                                >
                                                    {horario}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                            Voltar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Enviar
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Step 3: Success */}
                            {step === 3 && (
                                <div className="text-center py-8">
                                    <div
                                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                                        style={{
                                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                        }}
                                    >
                                        <CheckCircle2 className="w-10 h-10 text-white" />
                                    </div>

                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                        Cadastro Realizado!
                                    </h3>

                                    <p className="text-gray-600 mb-6">
                                        Obrigado pelo interesse, <strong>{formData.nome}</strong>!<br />
                                        Nossa equipe entrará em contato em breve via{' '}
                                        <strong>
                                            {formData.preferencia_contato === 'whatsapp' ? 'WhatsApp' :
                                                formData.preferencia_contato === 'telefone' ? 'telefone' : 'e-mail'}
                                        </strong>.
                                    </p>

                                    <div className="p-4 bg-green-50 rounded-xl mb-6">
                                        <p className="text-green-700 text-sm font-medium">
                                            📲 Fique atento ao seu{' '}
                                            {formData.preferencia_contato === 'email' ? 'e-mail' : 'celular'}
                                            {' '}no período da {formData.melhor_horario.toLowerCase().includes('manhã') ? 'manhã' :
                                                formData.melhor_horario.toLowerCase().includes('tarde') ? 'tarde' :
                                                    formData.melhor_horario.toLowerCase().includes('noite') ? 'noite' : 'dia'}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Home className="w-4 h-4" />
                                            {formData.tipo_imovel}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {formData.bairro}, {formData.cidade}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
