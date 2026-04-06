import { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  Save,
  Loader2,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Instagram,
  Facebook,
  Clock,
  Key,
  Eye,
  EyeOff,
  Home,
  Percent,
  ShieldCheck,
  FileCheck,
  Camera,
  Users,
  Upload,
  Info
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Switch } from "../componentes/ui/switch";
import { Slider } from "../componentes/ui/slider";
import { Progress } from "../componentes/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../componentes/ui/tabs";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../componentes/ui/tooltip";
import { api } from "../servicos/api";
import { toast } from "sonner";
import { cn } from "../lib/utils";

// ==============================================
// TIPOS
// ==============================================

type TipoGarantia = 'FIADOR' | 'SEGURO_FIANCA' | 'TITULO_CAPITALIZACAO' | 'CAUCAO' | 'CARTAO_CREDITO';

interface PerfilLocacao {
  garantiasAceitas: TipoGarantia[];
  taxaAdministracao: number;
  taxaPrimeiroAluguel: boolean;
  prazoMinimoContrato: number;
  aceitaPet: boolean;
  fazVistoriaEntrada: boolean;
  fazVistoriaSaida: boolean;
}

interface PerfilVenda {
  comissaoPadrao: number;
  aceitaExclusividade: boolean;
  tempoExclusividade?: number;
  fazAvaliacaoGratuita: boolean;
  fazFotoProfissional: boolean;
  fazTourVirtual: boolean;
  anunciaPortais: string[];
  temParcerias: boolean;
  percentualParceria?: number;
}

interface TenantPerfil {
  id: string;
  nome: string;
  slug: string;
  cnpj?: string;
  endereco?: string;
  cidade?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  instagram?: string;
  facebook?: string;
  logoUrl?: string;
  horarioAtendimento?: string;
  atendeFinalDeSemana?: boolean;
  tempoMercado?: number;
  diferenciais?: string[];
  perfilLocacao?: PerfilLocacao;
  perfilVenda?: PerfilVenda;
}

// ==============================================
// CONSTANTES
// ==============================================

const GARANTIAS_OPCOES = [
  { value: 'FIADOR' as TipoGarantia, label: 'Fiador', descricao: 'Pessoa física como garantidor' },
  { value: 'SEGURO_FIANCA' as TipoGarantia, label: 'Seguro Fiança', descricao: 'Seguro contratado pelo inquilino' },
  { value: 'TITULO_CAPITALIZACAO' as TipoGarantia, label: 'Título de Capitalização', descricao: 'Investimento como garantia' },
  { value: 'CAUCAO' as TipoGarantia, label: 'Caução', descricao: 'Depósito em dinheiro' },
  { value: 'CARTAO_CREDITO' as TipoGarantia, label: 'Cartão de Crédito', descricao: 'Garantia via cartão' },
];

const PORTAIS_OPCOES = ['ZAP Imóveis', 'Viva Real', 'OLX', 'Chaves na Mão', 'iMóveis', 'Site Próprio', 'Redes Sociais'];

const LOCACAO_INICIAL: PerfilLocacao = {
  garantiasAceitas: ['FIADOR', 'SEGURO_FIANCA'],
  taxaAdministracao: 10,
  taxaPrimeiroAluguel: false,
  prazoMinimoContrato: 12,
  aceitaPet: true,
  fazVistoriaEntrada: true,
  fazVistoriaSaida: true,
};

const VENDA_INICIAL: PerfilVenda = {
  comissaoPadrao: 6,
  aceitaExclusividade: true,
  tempoExclusividade: 90,
  fazAvaliacaoGratuita: true,
  fazFotoProfissional: true,
  fazTourVirtual: false,
  anunciaPortais: ['ZAP Imóveis', 'Viva Real'],
  temParcerias: true,
  percentualParceria: 50,
};

const PERFIL_INICIAL: TenantPerfil = {
  id: '',
  nome: '',
  slug: '',
  cidade: 'Goiânia - GO',
  horarioAtendimento: '08:00 às 18:00',
  atendeFinalDeSemana: false,
  perfilLocacao: LOCACAO_INICIAL,
  perfilVenda: VENDA_INICIAL,
};

// ==============================================
// COMPONENTES AUXILIARES
// ==============================================

// Tooltip de ajuda
function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3.5 h-3.5 text-slate-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Campo com label padronizado
function Campo({ 
  label, 
  children, 
  help,
  required,
  className 
}: { 
  label: string; 
  children: React.ReactNode; 
  help?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-slate-700 flex items-center">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {help && <HelpTip>{help}</HelpTip>}
      </label>
      {children}
    </div>
  );
}

// Switch com label inline
function SwitchField({ 
  label, 
  description, 
  checked, 
  onChange,
  icon: Icon
}: { 
  label: string; 
  description?: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <div>
          <p className="font-medium text-slate-700 text-sm">{label}</p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Função de máscara para telefone brasileiro
// Formata para (XX) XXXXX-XXXX (celular) ou (XX) XXXX-XXXX (fixo)
function aplicarMascaraTelefone(valor: string): string {
  // Remove tudo que não é número
  const numeros = valor.replace(/\D/g, '');
  
  // Limita a 11 dígitos
  const numerosLimitados = numeros.slice(0, 11);
  
  // Aplica máscara progressivamente
  if (numerosLimitados.length === 0) return '';
  if (numerosLimitados.length <= 2) return `(${numerosLimitados}`;
  if (numerosLimitados.length <= 6) return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2)}`;
  if (numerosLimitados.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2, 6)}-${numerosLimitados.slice(6)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2, 7)}-${numerosLimitados.slice(7)}`;
}

// ==============================================
// COMPONENTE PRINCIPAL
// ==============================================

export function PerfilImobiliaria() {
  const [perfil, setPerfil] = useState<TenantPerfil>(PERFIL_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("empresa");
  
  // Campos de alteração de senha
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  
  // Calcular progresso de preenchimento
  const progresso = useMemo(() => {
    let total = 0;
    let preenchidos = 0;
    
    // Empresa (5 campos)
    total += 5;
    if (perfil.nome) preenchidos++;
    if (perfil.cnpj) preenchidos++;
    if (perfil.tempoMercado) preenchidos++;
    if (perfil.horarioAtendimento) preenchidos++;
    preenchidos++; // atendeFinalDeSemana sempre tem valor
    
    // Contato (7 campos)
    total += 7;
    if (perfil.endereco) preenchidos++;
    if (perfil.cidade) preenchidos++;
    if (perfil.telefone) preenchidos++;
    if (perfil.whatsapp) preenchidos++;
    if (perfil.email) preenchidos++;
    if (perfil.site) preenchidos++;
    if (perfil.instagram) preenchidos++;
    
    // Locação (sempre preenchido com defaults)
    total += 4;
    preenchidos += 4;
    
    // Venda (sempre preenchido com defaults)
    total += 4;
    preenchidos += 4;
    
    return Math.round((preenchidos / total) * 100);
  }, [perfil]);
  
  // Buscar dados ao carregar
  useEffect(() => {
    carregarPerfil();
  }, []);
  
  const carregarPerfil = async () => {
    try {
      setCarregando(true);
      const response = await api.get('/tenant/perfil');
      setPerfil({
        ...PERFIL_INICIAL,
        ...response.data,
        perfilLocacao: { ...LOCACAO_INICIAL, ...response.data?.perfilLocacao },
        perfilVenda: { ...VENDA_INICIAL, ...response.data?.perfilVenda },
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast.error('Erro ao carregar dados do perfil');
    } finally {
      setCarregando(false);
    }
  };
  
  const salvarPerfil = async () => {
    if (!perfil.nome?.trim()) {
      toast.error('Nome da imobiliária é obrigatório');
      setTabAtiva('empresa');
      return;
    }
    
    try {
      setSalvando(true);
      await api.put('/tenant/perfil', perfil);
      
      // Atualizar localStorage
      const tenantAtual = JSON.parse(localStorage.getItem('elyon_tenant') || '{}');
      localStorage.setItem('elyon_tenant', JSON.stringify({
        ...tenantAtual,
        nome: perfil.nome
      }));
      
      toast.success('Perfil salvo com sucesso!');
      setAlterado(false);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  };
  
  const alterarSenha = async () => {
    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não conferem');
      return;
    }
    
    if (novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      setAlterandoSenha(true);
      await api.put('/auth/alterar-senha', { senhaAtual, novaSenha });
      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao alterar senha';
      toast.error(msg);
    } finally {
      setAlterandoSenha(false);
    }
  };
  
  // Funções de atualização
  const atualizarCampo = (campo: keyof TenantPerfil, valor: any) => {
    setPerfil(prev => ({ ...prev, [campo]: valor }));
    setAlterado(true);
  };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }
    
    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      toast.loading('Fazendo upload da logo...');
      
      const response = await api.post('/tenant/perfil/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setPerfil(prev => ({ ...prev, logoUrl: response.data.logoUrl }));
      setAlterado(true);
      toast.dismiss();
      toast.success('Logo atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);
      toast.dismiss();
      toast.error('Erro ao fazer upload da logo');
    }
  };
  
  const atualizarLocacao = (dados: Partial<PerfilLocacao>) => {
    setPerfil(prev => ({
      ...prev,
      perfilLocacao: { ...(prev.perfilLocacao || LOCACAO_INICIAL), ...dados }
    }));
    setAlterado(true);
  };
  
  const toggleGarantia = (garantia: TipoGarantia) => {
    const atual = perfil.perfilLocacao?.garantiasAceitas || [];
    const novas = atual.includes(garantia)
      ? atual.filter(g => g !== garantia)
      : [...atual, garantia];
    atualizarLocacao({ garantiasAceitas: novas });
  };
  
  const atualizarVenda = (dados: Partial<PerfilVenda>) => {
    setPerfil(prev => ({
      ...prev,
      perfilVenda: { ...(prev.perfilVenda || VENDA_INICIAL), ...dados }
    }));
    setAlterado(true);
  };
  
  const togglePortal = (portal: string) => {
    const atual = perfil.perfilVenda?.anunciaPortais || [];
    const novos = atual.includes(portal)
      ? atual.filter(p => p !== portal)
      : [...atual, portal];
    atualizarVenda({ anunciaPortais: novos });
  };
  
  // Loading state
  if (carregando) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand mx-auto" />
          <p className="text-slate-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* ========== HEADER ========== */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Building2 className="w-7 h-7 text-brand" />
              Perfil da Imobiliária
            </h1>
            <p className="text-slate-500 mt-1">
              Configure as informações da sua imobiliária
            </p>
          </div>
          
          {/* Progresso */}
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
              <Progress value={progresso} className="w-32 h-2" />
              <span className="text-sm font-medium text-slate-600">{progresso}%</span>
            </div>
            <p className="text-xs text-slate-500">Perfil completo</p>
          </div>
        </div>
      </div>
      
      {/* ========== TABS ========== */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
        <TabsList className="grid grid-cols-5 w-full mb-6">
          <TabsTrigger value="empresa" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="contato" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Contato</span>
          </TabsTrigger>
          <TabsTrigger value="locacao" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Locação</span>
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
        </TabsList>
        
        {/* ========== TAB: EMPRESA ========== */}
        <TabsContent value="empresa" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-brand mb-2">
              <Building2 className="w-5 h-5" />
              <h2 className="font-semibold">Dados da Empresa</h2>
            </div>
            
            {/* Logo + Nome */}
            <div className="flex gap-6">
              {/* Upload Logo */}
              <div className="flex-shrink-0">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <label
                  htmlFor="logo-upload"
                  className="block w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all"
                >
                  {perfil.logoUrl ? (
                    <img src={perfil.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs text-slate-500 mt-1">Logo</span>
                    </>
                  )}
                </label>
              </div>
              
              {/* Nome da Imobiliária */}
              <div className="flex-1">
                <Campo 
                  label="Nome da Imobiliária" 
                  required 
                  help="Este nome será usado pelo agente SDR nas conversas"
                >
                  <Input
                    value={perfil.nome}
                    onChange={(e) => atualizarCampo('nome', e.target.value)}
                    placeholder="Ex: Imobiliária Exemplo"
                    className="text-lg"
                  />
                </Campo>
              </div>
            </div>
            
            {/* CNPJ + Tempo de Mercado */}
            <div className="grid grid-cols-2 gap-4">
              <Campo label="CNPJ">
                <Input
                  value={perfil.cnpj || ''}
                  onChange={(e) => atualizarCampo('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </Campo>
              
              <Campo label="Tempo no Mercado" help="Quantos anos sua imobiliária está ativa">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={perfil.tempoMercado || ''}
                    onChange={(e) => atualizarCampo('tempoMercado', parseInt(e.target.value) || undefined)}
                    placeholder="5"
                    className="w-24"
                    min={0}
                  />
                  <span className="text-slate-500">anos</span>
                </div>
              </Campo>
            </div>
            
            {/* Horário + Fim de Semana */}
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Horário de Atendimento">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <Input
                    value={perfil.horarioAtendimento || ''}
                    onChange={(e) => atualizarCampo('horarioAtendimento', e.target.value)}
                    placeholder="08:00 às 18:00"
                  />
                </div>
              </Campo>
              
              <div className="flex items-end pb-2">
                <SwitchField
                  label="Atende fim de semana"
                  checked={perfil.atendeFinalDeSemana || false}
                  onChange={(checked) => atualizarCampo('atendeFinalDeSemana', checked)}
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* ========== TAB: CONTATO ========== */}
        <TabsContent value="contato" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Phone className="w-5 h-5" />
              <h2 className="font-semibold">Informações de Contato</h2>
            </div>
            
            {/* Endereço */}
            <Campo label="Endereço Completo">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <Input
                  value={perfil.endereco || ''}
                  onChange={(e) => atualizarCampo('endereco', e.target.value)}
                  placeholder="Rua, número, bairro"
                />
              </div>
            </Campo>
            
            {/* Cidade + Telefone */}
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Cidade">
                <Input
                  value={perfil.cidade || ''}
                  onChange={(e) => atualizarCampo('cidade', e.target.value)}
                  placeholder="Goiânia - GO"
                />
              </Campo>
              
              <Campo label="Telefone">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <Input
                    value={perfil.telefone || ''}
                    onChange={(e) => atualizarCampo('telefone', aplicarMascaraTelefone(e.target.value))}
                    placeholder="(62) 3333-4444"
                  />
                </div>
              </Campo>
            </div>
            
            {/* WhatsApp + Email */}
            <div className="grid grid-cols-2 gap-4">
              <Campo label="WhatsApp" help="Número principal para contato">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  <Input
                    value={perfil.whatsapp || ''}
                    onChange={(e) => atualizarCampo('whatsapp', aplicarMascaraTelefone(e.target.value))}
                    placeholder="(62) 99999-8888"
                  />
                </div>
              </Campo>
              
              <Campo label="Email">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <Input
                    value={perfil.email || ''}
                    onChange={(e) => atualizarCampo('email', e.target.value)}
                    placeholder="contato@imobiliaria.com"
                  />
                </div>
              </Campo>
            </div>
            
            {/* Redes Sociais */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-slate-700 mb-4">Redes Sociais e Site</p>
              <div className="grid grid-cols-3 gap-4">
                <Campo label="Site">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <Input
                      value={perfil.site || ''}
                      onChange={(e) => atualizarCampo('site', e.target.value)}
                      placeholder="www.site.com.br"
                    />
                  </div>
                </Campo>
                
                <Campo label="Instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-500" />
                    <Input
                      value={perfil.instagram || ''}
                      onChange={(e) => atualizarCampo('instagram', e.target.value)}
                      placeholder="@usuario"
                    />
                  </div>
                </Campo>
                
                <Campo label="Facebook">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-brand" />
                    <Input
                      value={perfil.facebook || ''}
                      onChange={(e) => atualizarCampo('facebook', e.target.value)}
                      placeholder="/pagina"
                    />
                  </div>
                </Campo>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* ========== TAB: LOCAÇÃO ========== */}
        <TabsContent value="locacao" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Home className="w-5 h-5" />
              <h2 className="font-semibold">Política de Locação</h2>
            </div>
            
            {/* Garantias Aceitas */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Garantias Aceitas
                <HelpTip>Selecione todas as formas de garantia que sua imobiliária aceita</HelpTip>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {GARANTIAS_OPCOES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGarantia(g.value)}
                    className={cn(
                      "p-3 rounded-lg text-left transition-all border-2",
                      perfil.perfilLocacao?.garantiasAceitas?.includes(g.value)
                        ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200"
                        : "bg-slate-50 border-transparent hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {perfil.perfilLocacao?.garantiasAceitas?.includes(g.value) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      <span className="font-medium text-slate-700 text-sm">{g.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Taxa de Administração */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Taxa de Administração
                <span className="ml-auto text-emerald-600 font-bold">{perfil.perfilLocacao?.taxaAdministracao || 10}%</span>
              </label>
              <Slider
                value={[perfil.perfilLocacao?.taxaAdministracao || 10]}
                onValueChange={(vals) => atualizarLocacao({ taxaAdministracao: vals[0] })}
                min={5}
                max={15}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>5%</span>
                <span>10%</span>
                <span>15%</span>
              </div>
            </div>
            
            {/* Opções de Locação */}
            <div className="grid grid-cols-2 gap-3">
              <SwitchField
                label="Cobra 1º aluguel"
                description="Taxa única na entrada"
                checked={perfil.perfilLocacao?.taxaPrimeiroAluguel || false}
                onChange={(checked) => atualizarLocacao({ taxaPrimeiroAluguel: checked })}
              />
              
              <Campo label="Prazo mínimo" className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={perfil.perfilLocacao?.prazoMinimoContrato || 12}
                    onChange={(e) => atualizarLocacao({ prazoMinimoContrato: parseInt(e.target.value) || 12 })}
                    className="w-20"
                    min={6}
                    max={36}
                  />
                  <span className="text-sm text-slate-500">meses</span>
                </div>
              </Campo>
            </div>
            
            {/* Mais opções */}
            <div className="grid grid-cols-2 gap-3">
              <SwitchField
                label="Vistoria entrada"
                checked={perfil.perfilLocacao?.fazVistoriaEntrada || false}
                onChange={(checked) => atualizarLocacao({ fazVistoriaEntrada: checked })}
              />
              <SwitchField
                label="Vistoria saída"
                checked={perfil.perfilLocacao?.fazVistoriaSaida || false}
                onChange={(checked) => atualizarLocacao({ fazVistoriaSaida: checked })}
              />
            </div>
          </div>
        </TabsContent>
        
        {/* ========== TAB: VENDAS ========== */}
        <TabsContent value="vendas" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-violet-600 mb-2">
              <Percent className="w-5 h-5" />
              <h2 className="font-semibold">Política de Vendas</h2>
            </div>
            
            {/* Comissão Padrão */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Comissão Padrão
                <span className="ml-auto text-violet-600 font-bold">{perfil.perfilVenda?.comissaoPadrao || 6}%</span>
              </label>
              <Slider
                value={[perfil.perfilVenda?.comissaoPadrao || 6]}
                onValueChange={(vals) => atualizarVenda({ comissaoPadrao: vals[0] })}
                min={3}
                max={8}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>3%</span>
                <span>6%</span>
                <span>8%</span>
              </div>
            </div>
            
            {/* Exclusividade */}
            <div className="space-y-3">
              <SwitchField
                label="Oferece exclusividade"
                description="Trabalha com imóveis exclusivos"
                checked={perfil.perfilVenda?.aceitaExclusividade || false}
                onChange={(checked) => atualizarVenda({ aceitaExclusividade: checked })}
              />
              
              {perfil.perfilVenda?.aceitaExclusividade && (
                <div className="ml-4 p-3 bg-violet-50 rounded-lg border border-violet-100 animate-in slide-in-from-top-2 duration-200">
                  <Campo label="Tempo padrão de exclusividade">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={perfil.perfilVenda?.tempoExclusividade || 90}
                        onChange={(e) => atualizarVenda({ tempoExclusividade: parseInt(e.target.value) || 90 })}
                        className="w-24"
                        min={30}
                        max={180}
                      />
                      <span className="text-sm text-slate-500">dias</span>
                    </div>
                  </Campo>
                </div>
              )}
            </div>
            
            {/* Serviços Inclusos */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Serviços Inclusos</p>
              <div className="grid grid-cols-3 gap-3">
                <SwitchField
                  label="Avaliação grátis"
                  icon={FileCheck}
                  checked={perfil.perfilVenda?.fazAvaliacaoGratuita || false}
                  onChange={(checked) => atualizarVenda({ fazAvaliacaoGratuita: checked })}
                />
                <SwitchField
                  label="Fotos profissionais"
                  icon={Camera}
                  checked={perfil.perfilVenda?.fazFotoProfissional || false}
                  onChange={(checked) => atualizarVenda({ fazFotoProfissional: checked })}
                />
                <SwitchField
                  label="Tour virtual"
                  icon={Globe}
                  checked={perfil.perfilVenda?.fazTourVirtual || false}
                  onChange={(checked) => atualizarVenda({ fazTourVirtual: checked })}
                />
              </div>
            </div>
            
            {/* Portais */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Onde anuncia os imóveis?
              </label>
              <div className="flex flex-wrap gap-2">
                {PORTAIS_OPCOES.map((portal) => (
                  <button
                    key={portal}
                    type="button"
                    onClick={() => togglePortal(portal)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                      perfil.perfilVenda?.anunciaPortais?.includes(portal)
                        ? "bg-violet-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {perfil.perfilVenda?.anunciaPortais?.includes(portal) && (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {portal}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Parcerias */}
            <div className="space-y-3">
              <SwitchField
                label="Faz parceria com outras imobiliárias"
                description="Divide comissão em negócios conjuntos"
                icon={Users}
                checked={perfil.perfilVenda?.temParcerias || false}
                onChange={(checked) => atualizarVenda({ temParcerias: checked })}
              />
              
              {perfil.perfilVenda?.temParcerias && (
                <div className="ml-4 p-3 bg-violet-50 rounded-lg border border-violet-100 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                    Percentual da parceria
                    <span className="ml-auto text-violet-600 font-bold">{perfil.perfilVenda?.percentualParceria || 50}%</span>
                  </label>
                  <Slider
                    value={[perfil.perfilVenda?.percentualParceria || 50]}
                    onValueChange={(vals) => atualizarVenda({ percentualParceria: vals[0] })}
                    min={30}
                    max={70}
                    step={5}
                    className="w-full mt-3"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>30%</span>
                    <span>50/50</span>
                    <span>70%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        {/* ========== TAB: SEGURANÇA ========== */}
        <TabsContent value="seguranca" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="bg-white border rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Key className="w-5 h-5" />
              <h2 className="font-semibold">Alterar Senha de Acesso</h2>
            </div>
            
            <div className="max-w-md space-y-4">
              {/* Senha Atual */}
              <Campo label="Senha Atual">
                <div className="relative">
                  <Input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Campo>
              
              {/* Nova Senha + Confirmar */}
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nova Senha">
                  <Input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="••••••••"
                  />
                </Campo>
                
                <Campo label="Confirmar Nova Senha">
                  <Input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                  />
                </Campo>
              </div>
              
              {/* Info + Botão */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  A senha deve ter no mínimo 6 caracteres
                </p>
                
                <Button
                  onClick={alterarSenha}
                  disabled={alterandoSenha || !senhaAtual || !novaSenha || !confirmarSenha}
                  variant="outline"
                  size="sm"
                >
                  {alterandoSenha ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* ========== BOTÃO SALVAR FLUTUANTE ========== */}
      {alterado && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <Button 
            size="lg" 
            onClick={salvarPerfil} 
            disabled={salvando}
            className="shadow-xl hover:shadow-2xl transition-shadow"
          >
            {salvando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
