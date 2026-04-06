import { WizardEtapaProps } from './types';
import { Code2, AlertTriangle, Copy, Check, FileCode, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { useState, ChangeEvent } from 'react';

// Templates de prompt pré-definidos para ajudar o usuário
const TEMPLATES_PROMPT = [
  {
    id: 'atendimento',
    nome: 'Atendimento Geral',
    prompt: `Você é um assistente virtual especializado em atendimento ao cliente para uma imobiliária.

PERSONALIDADE:
- Seja cordial e profissional
- Use linguagem clara e objetiva
- Demonstre conhecimento do mercado imobiliário

OBJETIVO:
- Responder dúvidas sobre imóveis disponíveis
- Coletar informações de contato dos interessados
- Agendar visitas quando solicitado

REGRAS:
- Nunca forneça informações falsas
- Sempre confirme dados importantes
- Encaminhe para um corretor humano quando necessário`
  },
  {
    id: 'qualificacao',
    nome: 'Qualificação de Leads',
    prompt: `Você é um SDR virtual especializado em qualificação de leads imobiliários.

SEU OBJETIVO:
- Identificar se o lead está pronto para comprar/alugar
- Descobrir orçamento, localização preferida e tipo de imóvel
- Qualificar urgência (quando pretende fechar negócio)

PERGUNTAS IMPORTANTES:
1. Qual tipo de imóvel procura? (casa, apartamento, comercial)
2. Qual região de preferência?
3. Qual faixa de valor está considerando?
4. Já possui aprovação de crédito ou vai financiar?
5. Quando pretende se mudar?

CLASSIFICAÇÃO:
- Lead Quente: Urgência alta, orçamento definido, localização específica
- Lead Morno: Interesse real, mas ainda pesquisando
- Lead Frio: Apenas curioso, sem urgência definida`
  },
  {
    id: 'captacao',
    nome: 'Captação de Imóveis',
    prompt: `Você é um assistente especializado em captação de imóveis para anúncio.

OBJETIVO:
- Identificar proprietários interessados em vender ou alugar
- Coletar informações básicas do imóvel
- Agendar avaliação presencial

INFORMAÇÕES A COLETAR:
1. Tipo de imóvel (casa, apartamento, terreno, comercial)
2. Localização (bairro, cidade)
3. Características (quartos, suítes, vagas, área)
4. Pretende vender ou alugar?
5. Valor pretendido (ou aceita avaliação)

VANTAGENS PARA DESTACAR:
- Avaliação gratuita e sem compromisso
- Fotos profissionais incluídas
- Divulgação nos principais portais
- Equipe de corretores experientes`
  }
];

export function EtapaPrompt({ dados, setDados }: WizardEtapaProps) {
  const [copiado, setCopiado] = useState(false);

  const copiarPrompt = async () => {
    if (dados.promptCustomizado) {
      await navigator.clipboard.writeText(dados.promptCustomizado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const usarTemplate = (template: typeof TEMPLATES_PROMPT[0]) => {
    setDados(prev => ({ ...prev, promptCustomizado: template.prompt }));
  };

  const contadorCaracteres = (dados.promptCustomizado || '').length;
  const minimoCaracteres = 50;
  const isValid = contadorCaracteres >= minimoCaracteres;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
          <Code2 className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold">Prompt do Sistema</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Defina as instruções completas para o comportamento do seu agente
        </p>
      </div>

      {/* Aviso */}
      <div className="bg-indigo-100 border-2 border-indigo-400 rounded-lg p-4">
        <div className="flex gap-3">
          <FileCode className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-indigo-900">Dica de escrita</p>
            <p className="text-indigo-900 mt-1">
              Escreva o prompt como se estivesse instruindo uma pessoa. 
              Seja claro sobre personalidade, objetivos e limitações.
            </p>
          </div>
        </div>
      </div>

      {/* Templates rápidos */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Sparkles className="w-4 h-4" />
          Templates Rápidos
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES_PROMPT.map(template => (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => usarTemplate(template)}
              className="text-xs"
            >
              {template.nome}
            </Button>
          ))}
        </div>
      </div>

      {/* Editor de Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Code2 className="w-4 h-4" />
            Prompt Customizado *
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copiarPrompt}
            disabled={!dados.promptCustomizado}
            className="text-xs"
          >
            {copiado ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copiar
              </>
            )}
          </Button>
        </div>
        
        <textarea
          placeholder={`Exemplo:
Você é [nome do agente], assistente virtual da [empresa].

PERSONALIDADE:
- Tom de voz: [formal/amigável/entusiasta]
- Use linguagem [clara/técnica/simples]

OBJETIVO:
- [Descreva o objetivo principal]
- [Descreva objetivos secundários]

REGRAS:
- [O que o agente DEVE fazer]
- [O que o agente NÃO DEVE fazer]

PROCESSO:
1. [Passo 1]
2. [Passo 2]
...`}
          className="w-full min-h-[300px] px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand font-mono text-sm resize-none"
          value={dados.promptCustomizado || ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDados(prev => ({ ...prev, promptCustomizado: e.target.value }))}
        />
        
        <div className="flex items-center justify-between text-xs">
          <span className={isValid ? 'text-emerald-600' : 'text-red-500'}>
            {contadorCaracteres} caracteres {!isValid && `(mínimo: ${minimoCaracteres})`}
          </span>
          {!isValid && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Prompt muito curto
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
