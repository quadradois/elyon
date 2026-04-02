import { 
  Search, 
  Users, 
  MessageSquare, 
  Inbox,
  Target,
  Building2,
  Home,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  tipo: 
    | "busca-sem-resultado" 
    | "nenhum-lead" 
    | "nenhuma-campanha" 
    | "nenhuma-conversa"
    | "nenhuma-selecao"
    | "nenhum-imovel"
    | "generico";
  titulo?: string;
  descricao?: string;
  acao?: {
    texto: string;
    onClick: () => void;
  };
  className?: string;
}

const CONFIGURACOES = {
  "busca-sem-resultado": {
    icone: Search,
    titulo: "Nenhum resultado encontrado",
    descricao: "Tente buscar com outros termos ou verifique a ortografia.",
    cor: "text-gray-400"
  },
  "nenhum-lead": {
    icone: Users,
    titulo: "Nenhum lead ainda",
    descricao: "Comece minerando propriedades para criar seus primeiros leads.",
    cor: "text-blue-400"
  },
  "nenhuma-campanha": {
    icone: Target,
    titulo: "Nenhuma campanha criada",
    descricao: "Crie uma campanha para organizar e acompanhar suas captações.",
    cor: "text-purple-400"
  },
  "nenhuma-conversa": {
    icone: MessageSquare,
    titulo: "Nenhuma conversa iniciada",
    descricao: "As conversas aparecerão aqui quando você começar a se comunicar com os leads.",
    cor: "text-green-400"
  },
  "nenhuma-selecao": {
    icone: Building2,
    titulo: "Nenhuma unidade selecionada",
    descricao: "Selecione as unidades que deseja minerar clicando no checkbox.",
    cor: "text-orange-400"
  },
  "nenhum-imovel": {
    icone: Home,
    titulo: "Nenhum imóvel encontrado",
    descricao: "Busque por edifícios ou condomínios para começar a mineração.",
    cor: "text-indigo-400"
  },
  "generico": {
    icone: Inbox,
    titulo: "Nada por aqui",
    descricao: "Este espaço está vazio no momento.",
    cor: "text-gray-400"
  }
};

export function EmptyState({ 
  tipo, 
  titulo, 
  descricao, 
  acao,
  className 
}: EmptyStateProps) {
  const config = CONFIGURACOES[tipo];
  const Icone = config.icone;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center",
      "animate-in fade-in-50 duration-500",
      className
    )}>
      {/* Ilustração com ícone */}
      <div className={cn(
        "relative mb-6",
        "animate-in zoom-in-50 duration-700"
      )}>
        {/* Círculos decorativos de fundo */}
        <div className="absolute inset-0 -m-4">
          <div className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-24 h-24 rounded-full bg-gray-100/50 animate-pulse"
          )} />
          <div className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-16 h-16 rounded-full bg-gray-100"
          )} />
        </div>
        
        {/* Ícone principal */}
        <div className={cn(
          "relative z-10 p-4 rounded-full",
          "bg-gradient-to-br from-gray-50 to-gray-100",
          "shadow-sm border border-gray-200/50"
        )}>
          <Icone className={cn("h-8 w-8", config.cor)} strokeWidth={1.5} />
        </div>
        
        {/* Sparkles decorativos */}
        <Sparkles 
          className={cn(
            "absolute -top-1 -right-1 h-4 w-4",
            config.cor,
            "opacity-60 animate-pulse"
          )} 
        />
      </div>

      {/* Texto */}
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        {titulo || config.titulo}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {descricao || config.descricao}
      </p>

      {/* Ação opcional */}
      {acao && (
        <Button 
          onClick={acao.onClick}
          className="gap-2 animate-in slide-in-from-bottom-4 duration-500"
        >
          {acao.texto}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Componente simplificado para uso inline
export function EmptyStateInline({
  mensagem = "Nenhum item encontrado",
  icone: Icone = Inbox
}: {
  mensagem?: string;
  icone?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
      <Icone className="h-5 w-5" />
      <span className="text-sm">{mensagem}</span>
    </div>
  );
}
