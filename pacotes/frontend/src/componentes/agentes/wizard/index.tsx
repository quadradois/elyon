import { useState } from "react";
import { Button } from "../../ui/button";
import { 
  Loader2, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Palette,
  Target,
  Eye,
  Zap,
  Settings2,
  Shield,
  Code2,
  Wrench
} from "lucide-react";
import { cn } from "../../../lib/utils";

// Tipos e dados compartilhados
import { DadosAgente, Etapa, PERFIL_PADRAO } from "./types";

// Etapas
import { EtapaModo } from "./EtapaModo";
import { EtapaIdentidade } from "./EtapaIdentidade";
import { EtapaPersonalidade } from "./EtapaPersonalidade";
import { EtapaTermos } from "./EtapaTermos";
import { EtapaRevisar } from "./EtapaRevisar";
import { EtapaObjetivo } from "./EtapaObjetivo";
import { EtapaPrompt } from "./EtapaPrompt";
import { EtapaFerramentas } from "./EtapaFerramentas";

interface WizardCriacaoAgenteProps {
  onConcluir: (dados: DadosAgente) => Promise<void>;
  onCancelar: () => void;
  dadosIniciais?: Partial<DadosAgente>;
  salvando?: boolean;
}

// Gerador de saudação para dados finais
const gerarSaudacao = (d: DadosAgente) => {
  const emoji = d.personalidade.usarEmojis ? ' 😊' : '';
  switch (d.personalidade.tom) {
    case 'formal':
      return `Bom dia! Sou ${d.nome}, assistente virtual. Como posso ajudá-lo(a)?`;
    case 'entusiasta':
      return `Oi! 🎉 Aqui é a ${d.nome}! Que ótimo falar com você! Como posso ajudar?`;
    default:
      return `Olá! Sou a ${d.nome}, sua assistente virtual.${emoji} Como posso ajudar você hoje?`;
  }
};

const gerarDespedida = (d: DadosAgente) => {
  const emoji = d.personalidade.usarEmojis ? ' 👋' : '';
  switch (d.personalidade.tom) {
    case 'formal':
      return `Agradeço o contato. Caso precise de mais informações, estou à disposição.`;
    case 'entusiasta':
      return `Foi incrível ajudar você! Qualquer coisa, é só chamar! 🚀`;
    default:
      return `Foi um prazer ajudar! Se precisar de algo mais, estou por aqui.${emoji}`;
  }
};

export function WizardCriacaoAgente({ 
  onConcluir, 
  onCancelar, 
  dadosIniciais,
  salvando = false 
}: WizardCriacaoAgenteProps) {
  const [etapaAtual, setEtapaAtual] = useState<Etapa>('modo');
  const [dados, setDados] = useState<DadosAgente>({
    nome: dadosIniciais?.nome || 'Sofia',
    avatar: dadosIniciais?.avatar || 'sofia',
    tipoAgente: dadosIniciais?.tipoAgente || 'SDR_CAPTACAO',
    modoCreacao: dadosIniciais?.modoCreacao || 'PRE_TREINADO',
    personalidade: {
      tom: dadosIniciais?.personalidade?.tom || 'amigavel',
      usarEmojis: dadosIniciais?.personalidade?.usarEmojis ?? true,
      nivelFormalidade: dadosIniciais?.personalidade?.nivelFormalidade || 3,
    },
    expertise: {
      bairros: dadosIniciais?.expertise?.bairros || [],
      tiposImovel: dadosIniciais?.expertise?.tiposImovel || [],
    },
    scripts: {
      saudacao: dadosIniciais?.scripts?.saudacao || '',
      despedida: dadosIniciais?.scripts?.despedida || '',
    },
    // Perfil da Imobiliária (Quiz)
    perfilImobiliaria: dadosIniciais?.perfilImobiliaria || PERFIL_PADRAO,
    termosAceitos: false,
    // Campos do modo avançado
    objetivo: dadosIniciais?.objetivo || '',
    contexto: dadosIniciais?.contexto || '',
    promptCustomizado: dadosIniciais?.promptCustomizado || '',
    toolsCustomizadas: dadosIniciais?.toolsCustomizadas || [],
    restricoes: dadosIniciais?.restricoes || [],
  });
  
  // Etapas variam de acordo com o modo
  const etapas: { id: Etapa; titulo: string; icone: React.ReactNode }[] = dados.modoCreacao === 'PRE_TREINADO' 
    ? [
        { id: 'modo', titulo: 'Modo', icone: <Zap className="w-5 h-5" /> },
        { id: 'identidade', titulo: 'Identidade', icone: <User className="w-5 h-5" /> },
        { id: 'termos', titulo: 'Termos', icone: <Shield className="w-5 h-5" /> },
        { id: 'revisar', titulo: 'Revisar', icone: <Eye className="w-5 h-5" /> },
      ]
    : [
        // Modo Avançado: mais etapas para customização completa
        { id: 'modo', titulo: 'Modo', icone: <Settings2 className="w-5 h-5" /> },
        { id: 'identidade', titulo: 'Identidade', icone: <User className="w-5 h-5" /> },
        { id: 'objetivo', titulo: 'Objetivo', icone: <Target className="w-5 h-5" /> },
        { id: 'prompt', titulo: 'Prompt', icone: <Code2 className="w-5 h-5" /> },
        { id: 'ferramentas', titulo: 'Tools', icone: <Wrench className="w-5 h-5" /> },
        { id: 'personalidade', titulo: 'Tom', icone: <Palette className="w-5 h-5" /> },
        { id: 'termos', titulo: 'Termos', icone: <Shield className="w-5 h-5" /> },
        { id: 'revisar', titulo: 'Revisar', icone: <Eye className="w-5 h-5" /> },
      ];

  const indiceAtual = etapas.findIndex(e => e.id === etapaAtual);
  const podeVoltar = indiceAtual > 0;
  const podeAvancar = indiceAtual < etapas.length - 1;
  const ehUltimaEtapa = indiceAtual === etapas.length - 1;

  const voltar = () => {
    if (podeVoltar) {
      setEtapaAtual(etapas[indiceAtual - 1].id);
    }
  };

  const avancar = () => {
    if (etapaAtual === 'modo') {
      // Sempre vai para identidade agora (removemos etapa de tipo)
      setEtapaAtual('identidade');
      return;
    }
    
    if (etapaAtual === 'termos' && !dados.termosAceitos) {
      return;
    }
    
    if (podeAvancar) {
      setEtapaAtual(etapas[indiceAtual + 1].id);
    }
  };

  const concluir = async () => {
    if (!dados.termosAceitos) return;
    
    const dadosFinais: DadosAgente = {
      ...dados,
      // No modo avançado, tipoAgente é PERSONALIZADO
      tipoAgente: dados.modoCreacao === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'SDR_CAPTACAO',
      scripts: {
        saudacao: dados.scripts.saudacao || gerarSaudacao(dados),
        despedida: dados.scripts.despedida || gerarDespedida(dados),
      },
    };
    
    await onConcluir(dadosFinais);
  };

  // Renderizar etapa atual
  const renderEtapa = () => {
    switch (etapaAtual) {
      case 'modo':
        return <EtapaModo dados={dados} setDados={setDados} />;
      case 'identidade':
        return <EtapaIdentidade dados={dados} setDados={setDados} />;
      case 'objetivo':
        return <EtapaObjetivo dados={dados} setDados={setDados} />;
      case 'prompt':
        return <EtapaPrompt dados={dados} setDados={setDados} />;
      case 'ferramentas':
        return <EtapaFerramentas dados={dados} setDados={setDados} />;
      case 'personalidade':
        return <EtapaPersonalidade dados={dados} setDados={setDados} />;
      case 'termos':
        return <EtapaTermos dados={dados} setDados={setDados} />;
      case 'revisar':
        return <EtapaRevisar dados={dados} setDados={setDados} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {etapas.map((etapa, index) => (
            <div key={etapa.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div 
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                    indiceAtual >= index 
                      ? "bg-blue-600 text-white" 
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  {indiceAtual > index ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    etapa.icone
                  )}
                </div>
                <span className={cn(
                  "mt-2 text-sm font-medium",
                  indiceAtual >= index ? "text-blue-600" : "text-slate-400"
                )}>
                  {etapa.titulo}
                </span>
              </div>
              {index < etapas.length - 1 && (
                <div className={cn(
                  "flex-1 h-1 mx-2 rounded",
                  indiceAtual > index ? "bg-blue-600" : "bg-slate-200"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo da Etapa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 min-h-[450px]">
        {renderEtapa()}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={podeVoltar ? voltar : onCancelar}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {podeVoltar ? 'Voltar' : 'Cancelar'}
        </Button>

        {ehUltimaEtapa ? (
          <Button
            onClick={concluir}
            disabled={salvando || !dados.termosAceitos}
            className="bg-green-600 hover:bg-green-700"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando agente...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Criar Agente
              </>
            )}
          </Button>
        ) : (
          <Button onClick={avancar} disabled={etapaAtual === 'termos' && !dados.termosAceitos}>
            Próximo
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Re-exportar tipos para uso externo
export type { DadosAgente, TipoAgente, ModoCreacao } from "./types";
