import { CheckCircle, Palette, Building2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps, TEMPLATE_CAPTACAO, AVATARES, DadosAgente } from "./types";

type EtapaRevisarProps = WizardEtapaProps;

// Gerador de saudação
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

export function EtapaRevisar({ dados }: EtapaRevisarProps) {
  const perfil = dados.perfilImobiliaria;
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Tudo pronto! 🎉
        </h2>
        <p className="text-slate-500 mt-2">
          Revise as configurações de {dados.nome} antes de finalizar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Card Identidade */}
        <div className="bg-slate-50 p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
              {AVATARES.find(a => a.id === dados.avatar)?.emoji || dados.nome.charAt(0)}
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">{dados.nome}</h4>
              <p className="text-sm text-slate-500">
                {perfil?.dadosGerais.nomeImobiliaria || 'Assistente Virtual'}
              </p>
            </div>
          </div>
        </div>

        {/* Card Tipo */}
        <div className="bg-slate-50 p-5 rounded-xl space-y-2">
          <h4 className="font-medium text-slate-700 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Tipo de Agente
          </h4>
          {dados.tipoAgente === 'SDR_CAPTACAO' ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{TEMPLATE_CAPTACAO.emoji}</span>
              <span className="font-medium text-slate-900">{TEMPLATE_CAPTACAO.nome}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-medium">Personalizado</span> - Configuração manual
            </p>
          )}
          <span className={cn(
            "inline-block text-xs font-bold px-2 py-1 rounded-full",
            dados.modoCreacao === 'PRE_TREINADO' 
              ? "bg-blue-100 text-blue-700" 
              : "bg-purple-100 text-purple-700"
          )}>
            {dados.modoCreacao === 'PRE_TREINADO' ? 'PRÉ-TREINADO' : 'PERSONALIZADO'}
          </span>
        </div>

        {/* Card Personalidade */}
        <div className="bg-slate-50 p-5 rounded-xl space-y-2">
          <h4 className="font-medium text-slate-700 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Personalidade
          </h4>
          <p className="text-sm text-slate-600">
            Tom: <span className="font-medium capitalize">{dados.personalidade.tom}</span>
          </p>
          <p className="text-sm text-slate-600">
            Emojis: <span className="font-medium">{dados.personalidade.usarEmojis ? 'Sim' : 'Não'}</span>
          </p>
        </div>

        {/* Card Termos */}
        <div className="bg-green-50 p-5 rounded-xl space-y-2">
          <h4 className="font-medium text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Termos de Uso
          </h4>
          <p className="text-sm text-green-600">
            ✓ Aceitos em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Card Perfil da Imobiliária */}
        {perfil && (
          <div className="bg-slate-50 p-5 rounded-xl space-y-3 col-span-2">
            <h4 className="font-medium text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Perfil da Imobiliária
            </h4>
            
            {/* Nome da Imobiliária */}
            {perfil.dadosGerais.nomeImobiliaria && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">{perfil.dadosGerais.nomeImobiliaria}</span>
                {perfil.dadosGerais.tempoMercado && (
                  <span className="text-slate-400 ml-2">
                    • {perfil.dadosGerais.tempoMercado} anos no mercado
                  </span>
                )}
              </p>
            )}
            
            {/* Resumo Locação e Venda - apenas se selecionados */}
            <div className="flex flex-wrap gap-4 mt-2">
              {perfil.dadosGerais.trabalhaComLocacao && (
                <div className="text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                  <span className="font-medium text-green-700">🔑 Locação:</span>
                  <span className="text-slate-600 ml-2">
                    {perfil.locacao.taxaAdministracao}% adm
                  </span>
                  <span className="text-slate-400 mx-1">•</span>
                  <span className="text-slate-600">
                    {perfil.locacao.garantiasAceitas.length} garantias
                  </span>
                </div>
              )}
              {perfil.dadosGerais.trabalhaComVenda && (
                <div className="text-sm bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                  <span className="font-medium text-purple-700">🏠 Venda:</span>
                  <span className="text-slate-600 ml-2">
                    {perfil.venda.comissaoPadrao}% comissão
                  </span>
                  {perfil.venda.aceitaExclusividade && (
                    <>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-slate-600">Exclusividade</span>
                    </>
                  )}
                </div>
              )}
              {!perfil.dadosGerais.trabalhaComLocacao && !perfil.dadosGerais.trabalhaComVenda && (
                <p className="text-sm text-amber-600">⚠️ Nenhum serviço selecionado</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview de mensagem */}
      <div className="space-y-2">
        <h4 className="font-medium text-slate-700">Preview da primeira mensagem</h4>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              {dados.nome.charAt(0)}
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm max-w-md">
              <p className="text-sm text-slate-700">{gerarSaudacao(dados)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
