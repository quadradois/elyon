import { useState } from "react";
import { 
  Building2, 
  Clock, 
  ShieldCheck, 
  Percent, 
  FileCheck, 
  Home, 
  Camera, 
  Globe, 
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { Slider } from "../../ui/slider";
import { cn } from "../../../lib/utils";
import { 
  WizardEtapaProps, 
  PerfilImobiliaria,
  TipoGarantia,
  GARANTIAS_OPCOES, 
  PORTAIS_OPCOES, 
  DIFERENCIAIS_OPCOES,
  PERFIL_PADRAO 
} from "./types";

interface EtapaPerfilImobiliariaProps extends WizardEtapaProps {
  // Props removidas - em Goiânia trabalham a cidade toda
}

type SecaoAtiva = 'geral' | 'locacao' | 'venda' | null;

export function EtapaPerfilImobiliaria({ 
  dados, 
  setDados
}: EtapaPerfilImobiliariaProps) {
  const [secaoExpandida, setSecaoExpandida] = useState<SecaoAtiva>('geral');

  // Inicializar perfil se não existir
  const perfil: PerfilImobiliaria = dados.perfilImobiliaria || PERFIL_PADRAO;

  const atualizarPerfil = (updates: Partial<PerfilImobiliaria>) => {
    setDados(prev => ({
      ...prev,
      perfilImobiliaria: {
        ...perfil,
        ...updates,
      }
    }));
  };

  const atualizarDadosGerais = (updates: Partial<PerfilImobiliaria['dadosGerais']>) => {
    atualizarPerfil({
      dadosGerais: { ...perfil.dadosGerais, ...updates }
    });
  };

  const atualizarLocacao = (updates: Partial<PerfilImobiliaria['locacao']>) => {
    atualizarPerfil({
      locacao: { ...perfil.locacao, ...updates }
    });
  };

  const atualizarVenda = (updates: Partial<PerfilImobiliaria['venda']>) => {
    atualizarPerfil({
      venda: { ...perfil.venda, ...updates }
    });
  };

  const toggleGarantia = (garantia: TipoGarantia) => {
    const atual = perfil.locacao.garantiasAceitas;
    const novas = atual.includes(garantia)
      ? atual.filter(g => g !== garantia)
      : [...atual, garantia];
    atualizarLocacao({ garantiasAceitas: novas });
  };

  const togglePortal = (portal: string) => {
    const atual = perfil.venda.anunciaPortais;
    const novos = atual.includes(portal)
      ? atual.filter(p => p !== portal)
      : [...atual, portal];
    atualizarVenda({ anunciaPortais: novos });
  };

  const toggleDiferencial = (diferencial: string) => {
    const atual = perfil.dadosGerais.diferenciais;
    const novos = atual.includes(diferencial)
      ? atual.filter(d => d !== diferencial)
      : [...atual, diferencial];
    atualizarDadosGerais({ diferenciais: novos });
  };

  const SecaoHeader = ({ 
    titulo, 
    icone: Icone, 
    secao, 
    cor 
  }: { 
    titulo: string; 
    icone: React.ElementType; 
    secao: SecaoAtiva; 
    cor: string;
  }) => (
    <button
      type="button"
      onClick={() => setSecaoExpandida(secaoExpandida === secao ? null : secao)}
      className={cn(
        "w-full flex items-center justify-between p-4 rounded-lg transition-all",
        secaoExpandida === secao 
          ? `bg-${cor}-50 border-2 border-${cor}-200` 
          : "bg-slate-50 hover:bg-slate-100 border-2 border-transparent"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          secaoExpandida === secao ? `bg-${cor}-100` : "bg-slate-200"
        )}>
          <Icone className={cn(
            "w-5 h-5",
            secaoExpandida === secao ? `text-${cor}-600` : "text-slate-600"
          )} />
        </div>
        <span className={cn(
          "font-semibold",
          secaoExpandida === secao ? `text-${cor}-700` : "text-slate-700"
        )}>
          {titulo}
        </span>
      </div>
      {secaoExpandida === secao ? (
        <ChevronUp className="w-5 h-5 text-slate-400" />
      ) : (
        <ChevronDown className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );

  // Flags de serviços
  const trabalhaLocacao = perfil.dadosGerais.trabalhaComLocacao;
  const trabalhaVenda = perfil.dadosGerais.trabalhaComVenda;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Perfil da Imobiliária
        </h2>
        <p className="text-slate-500 mt-2">
          Responda o quiz para que {dados.nome} aprenda como sua imobiliária trabalha
        </p>
      </div>

      {/* Seletor de Serviços - Destaque no topo */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-5 rounded-xl border-2 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-2 text-center">
          Quais serviços sua imobiliária oferece?
        </h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          Clique para selecionar. Você pode escolher um ou os dois!
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* Locação */}
          <button
            type="button"
            onClick={() => atualizarDadosGerais({ trabalhaComLocacao: !trabalhaLocacao })}
            className={cn(
              "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
              trabalhaLocacao
                ? "bg-green-50 border-green-500 shadow-md"
                : "bg-white border-slate-200 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
              trabalhaLocacao ? "bg-green-100" : "bg-slate-100"
            )}>
              🔑
            </div>
            <span className={cn(
              "font-semibold",
              trabalhaLocacao ? "text-green-700" : "text-slate-600"
            )}>
              Locação
            </span>
            {trabalhaLocacao && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </button>

          {/* Venda */}
          <button
            type="button"
            onClick={() => atualizarDadosGerais({ trabalhaComVenda: !trabalhaVenda })}
            className={cn(
              "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
              trabalhaVenda
                ? "bg-purple-50 border-purple-500 shadow-md"
                : "bg-white border-slate-200 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-2xl",
              trabalhaVenda ? "bg-purple-100" : "bg-slate-100"
            )}>
              🏠
            </div>
            <span className={cn(
              "font-semibold",
              trabalhaVenda ? "text-purple-700" : "text-slate-600"
            )}>
              Venda
            </span>
            {trabalhaVenda && (
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
            )}
          </button>
        </div>
        
        {/* Feedback visual */}
        {trabalhaLocacao && trabalhaVenda && (
          <p className="text-center text-blue-600 text-sm mt-3 font-medium">
            ✨ Ótimo! Vamos configurar as duas políticas
          </p>
        )}
        {!trabalhaLocacao && !trabalhaVenda && (
          <p className="text-center text-amber-600 text-sm mt-3">
            ⚠️ Selecione pelo menos um serviço
          </p>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg flex items-start gap-3 border border-purple-100">
        <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <strong className="text-purple-700">ELYON vai aprender com você!</strong>
          <p className="text-purple-600 mt-1">
            As respostas serão sintetizadas em conhecimento RAG para que o agente 
            qualifique leads de acordo com a política da sua imobiliária.
          </p>
        </div>
      </div>

      {/* Seções do Quiz */}
      <div className="space-y-3">
        
        {/* ===== SEÇÃO: DADOS GERAIS ===== */}
        <div>
          <SecaoHeader 
            titulo="Dados Gerais da Imobiliária" 
            icone={Building2} 
            secao="geral"
            cor="blue"
          />
          
          {secaoExpandida === 'geral' && (
            <div className="mt-3 p-4 bg-white border rounded-lg space-y-5">
              {/* Nome da Imobiliária */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Nome da Imobiliária
                </label>
                <Input
                  value={perfil.dadosGerais.nomeImobiliaria}
                  onChange={(e) => atualizarDadosGerais({ nomeImobiliaria: e.target.value })}
                  placeholder="Ex: Imobiliária Exemplo LTDA"
                />
              </div>

              {/* Tempo de Mercado */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Tempo no Mercado (anos)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={perfil.dadosGerais.tempoMercado || ''}
                  onChange={(e) => atualizarDadosGerais({ tempoMercado: parseInt(e.target.value) || undefined })}
                  placeholder="Ex: 15"
                />
              </div>

              {/* Atendimento */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-700">Atende final de semana?</p>
                  <p className="text-sm text-slate-500">Sábados e/ou domingos</p>
                </div>
                <Switch
                  checked={perfil.dadosGerais.atendeFinalDeSemana}
                  onCheckedChange={(checked: boolean) => atualizarDadosGerais({ atendeFinalDeSemana: checked })}
                />
              </div>

              {/* Informações de Contato */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  📍 Informações de Contato
                  <span className="text-xs font-normal text-blue-600">(para o agente informar aos clientes)</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endereço */}
                  <div className="space-y-1 col-span-2">
                    <label className="text-sm font-medium text-slate-700">Endereço</label>
                    <Input
                      value={perfil.dadosGerais.endereco || ''}
                      onChange={(e) => atualizarDadosGerais({ endereco: e.target.value })}
                      placeholder="Av. T-63, 1234 - Setor Bueno"
                    />
                  </div>
                  
                  {/* Cidade */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Cidade</label>
                    <Input
                      value={perfil.dadosGerais.cidade || ''}
                      onChange={(e) => atualizarDadosGerais({ cidade: e.target.value })}
                      placeholder="Goiânia - GO"
                    />
                  </div>
                  
                  {/* Telefone */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Telefone</label>
                    <Input
                      value={perfil.dadosGerais.telefone || ''}
                      onChange={(e) => atualizarDadosGerais({ telefone: e.target.value })}
                      placeholder="(62) 3333-4444"
                    />
                  </div>
                  
                  {/* WhatsApp */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">WhatsApp</label>
                    <Input
                      value={perfil.dadosGerais.whatsapp || ''}
                      onChange={(e) => atualizarDadosGerais({ whatsapp: e.target.value })}
                      placeholder="(62) 99999-8888"
                    />
                  </div>
                  
                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">E-mail</label>
                    <Input
                      type="email"
                      value={perfil.dadosGerais.email || ''}
                      onChange={(e) => atualizarDadosGerais({ email: e.target.value })}
                      placeholder="contato@imobiliaria.com.br"
                    />
                  </div>
                  
                  {/* Site */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Site</label>
                    <Input
                      value={perfil.dadosGerais.site || ''}
                      onChange={(e) => atualizarDadosGerais({ site: e.target.value })}
                      placeholder="www.imobiliaria.com.br"
                    />
                  </div>
                  
                  {/* Instagram */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Instagram</label>
                    <Input
                      value={perfil.dadosGerais.instagram || ''}
                      onChange={(e) => atualizarDadosGerais({ instagram: e.target.value })}
                      placeholder="@imobiliaria"
                    />
                  </div>
                  
                  {/* Facebook */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Facebook</label>
                    <Input
                      value={perfil.dadosGerais.facebook || ''}
                      onChange={(e) => atualizarDadosGerais({ facebook: e.target.value })}
                      placeholder="/imobiliaria"
                    />
                  </div>
                </div>
              </div>

              {/* Diferenciais */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Diferenciais da Imobiliária
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIFERENCIAIS_OPCOES.map((dif) => (
                    <button
                      key={dif}
                      type="button"
                      onClick={() => toggleDiferencial(dif)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1",
                        perfil.dadosGerais.diferenciais.includes(dif)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {perfil.dadosGerais.diferenciais.includes(dif) && (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {dif}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== SEÇÃO: LOCAÇÃO ===== */}
        {trabalhaLocacao && (
        <div>
          <SecaoHeader 
            titulo="Política de Locação" 
            icone={Home} 
            secao="locacao"
            cor="green"
          />
          
          {secaoExpandida === 'locacao' && (
            <div className="mt-3 p-4 bg-white border rounded-lg space-y-5">
              
              {/* Garantias Aceitas */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Garantias Aceitas
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {GARANTIAS_OPCOES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGarantia(g.value)}
                      className={cn(
                        "p-3 rounded-lg text-left transition-all border-2",
                        perfil.locacao.garantiasAceitas.includes(g.value)
                          ? "bg-green-50 border-green-300"
                          : "bg-slate-50 border-transparent hover:bg-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {perfil.locacao.garantiasAceitas.includes(g.value) && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        <span className="font-medium text-slate-700">{g.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{g.descricao}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Taxa de Administração */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Taxa de Administração: <span className="text-green-600 font-bold">{perfil.locacao.taxaAdministracao}%</span>
                </label>
                <Slider
                  value={[perfil.locacao.taxaAdministracao]}
                  onValueChange={(vals: number[]) => atualizarLocacao({ taxaAdministracao: vals[0] })}
                  min={5}
                  max={15}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>5%</span>
                  <span>15%</span>
                </div>
              </div>

              {/* Taxa Primeiro Aluguel */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-700">Cobra taxa do 1º aluguel?</p>
                  <p className="text-sm text-slate-500">Taxa única na entrada do contrato</p>
                </div>
                <Switch
                  checked={perfil.locacao.taxaPrimeiroAluguel}
                  onCheckedChange={(checked: boolean) => atualizarLocacao({ taxaPrimeiroAluguel: checked })}
                />
              </div>

              {/* Prazo Mínimo */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  Prazo Mínimo do Contrato (meses)
                </label>
                <Input
                  type="number"
                  min={6}
                  max={36}
                  value={perfil.locacao.prazoMinimoContrato ?? ''}
                  onChange={(e) => {
                    const valor = e.target.value;
                    atualizarLocacao({ 
                      prazoMinimoContrato: valor === '' ? undefined : parseInt(valor) 
                    });
                  }}
                  onBlur={(e) => {
                    const valor = parseInt(e.target.value);
                    if (!valor || valor < 6) {
                      atualizarLocacao({ prazoMinimoContrato: 12 });
                    }
                  }}
                  placeholder="12"
                />
              </div>

              {/* Aceita Pet */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-700">Trabalha com imóveis que aceitam pet?</p>
                  <p className="text-sm text-slate-500">Animais de estimação permitidos</p>
                </div>
                <Switch
                  checked={perfil.locacao.aceitaPet}
                  onCheckedChange={(checked: boolean) => atualizarLocacao({ aceitaPet: checked })}
                />
              </div>

              {/* Vistorias */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700 text-sm">Vistoria de entrada</span>
                  <Switch
                    checked={perfil.locacao.fazVistoriaEntrada}
                    onCheckedChange={(checked: boolean) => atualizarLocacao({ fazVistoriaEntrada: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700 text-sm">Vistoria de saída</span>
                  <Switch
                    checked={perfil.locacao.fazVistoriaSaida}
                    onCheckedChange={(checked: boolean) => atualizarLocacao({ fazVistoriaSaida: checked })}
                  />
                </div>
              </div>

            </div>
          )}
        </div>
        )}

        {/* ===== SEÇÃO: VENDA ===== */}
        {trabalhaVenda && (
        <div>
          <SecaoHeader 
            titulo="Política de Vendas" 
            icone={Percent} 
            secao="venda"
            cor="purple"
          />
          
          {secaoExpandida === 'venda' && (
            <div className="mt-3 p-4 bg-white border rounded-lg space-y-5">
              
              {/* Comissão */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Comissão Padrão: <span className="text-purple-600 font-bold">{perfil.venda.comissaoPadrao}%</span>
                </label>
                <Slider
                  value={[perfil.venda.comissaoPadrao]}
                  onValueChange={(vals: number[]) => atualizarVenda({ comissaoPadrao: vals[0] })}
                  min={3}
                  max={8}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>3%</span>
                  <span>8%</span>
                </div>
              </div>

              {/* Exclusividade */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-700">Oferece opção de exclusividade?</p>
                    <p className="text-sm text-slate-500">Trabalha com imóveis exclusivos e não exclusivos</p>
                  </div>
                  <Switch
                    checked={perfil.venda.aceitaExclusividade}
                    onCheckedChange={(checked: boolean) => atualizarVenda({ aceitaExclusividade: checked })}
                  />
                </div>
                
                {perfil.venda.aceitaExclusividade && (
                  <div className="pl-4 space-y-2 bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <label className="text-sm font-medium text-purple-700">
                      Tempo padrão de exclusividade (dias)
                    </label>
                    <Input
                      type="number"
                      min={30}
                      max={180}
                      value={perfil.venda.tempoExclusividade ?? ''}
                      onChange={(e) => {
                        const valor = e.target.value;
                        atualizarVenda({ 
                          tempoExclusividade: valor === '' ? undefined : parseInt(valor) 
                        });
                      }}
                      onBlur={(e) => {
                        // Se ficar vazio ou inválido, volta para 90
                        const valor = parseInt(e.target.value);
                        if (!valor || valor < 30) {
                          atualizarVenda({ tempoExclusividade: 90 });
                        }
                      }}
                      placeholder="90"
                    />
                    <p className="text-xs text-purple-600">
                      Quando o proprietário optar por exclusividade, este será o prazo sugerido
                    </p>
                  </div>
                )}
              </div>

              {/* Serviços Inclusos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700 text-sm">Avaliação grátis</span>
                  </div>
                  <Switch
                    checked={perfil.venda.fazAvaliacaoGratuita}
                    onCheckedChange={(checked: boolean) => atualizarVenda({ fazAvaliacaoGratuita: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700 text-sm">Fotos profissionais</span>
                  </div>
                  <Switch
                    checked={perfil.venda.fazFotoProfissional}
                    onCheckedChange={(checked: boolean) => atualizarVenda({ fazFotoProfissional: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700 text-sm">Tour virtual</span>
                  </div>
                  <Switch
                    checked={perfil.venda.fazTourVirtual}
                    onCheckedChange={(checked: boolean) => atualizarVenda({ fazTourVirtual: checked })}
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
                        perfil.venda.anunciaPortais.includes(portal)
                          ? "bg-purple-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {perfil.venda.anunciaPortais.includes(portal) && (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {portal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcerias */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-700">Faz parceria com outras imobiliárias?</p>
                      <p className="text-sm text-slate-500">Divide comissão em negócios conjuntos</p>
                    </div>
                  </div>
                  <Switch
                    checked={perfil.venda.temParcerias}
                    onCheckedChange={(checked: boolean) => atualizarVenda({ temParcerias: checked })}
                  />
                </div>
                
                {perfil.venda.temParcerias && (
                  <div className="pl-4 space-y-2">
                    <label className="text-sm font-medium text-slate-600">
                      Percentual da parceria: <span className="text-purple-600 font-bold">{perfil.venda.percentualParceria || 50}%</span>
                    </label>
                    <Slider
                      value={[perfil.venda.percentualParceria || 50]}
                      onValueChange={(vals: number[]) => atualizarVenda({ percentualParceria: vals[0] })}
                      min={30}
                      max={70}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>30%</span>
                      <span>50/50</span>
                      <span>70%</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
