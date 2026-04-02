import { Shield } from "lucide-react";
import { WizardEtapaProps } from "./types";

export function EtapaTermos({ dados, setDados }: WizardEtapaProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Termos de Uso
        </h2>
        <p className="text-slate-500 mt-2">
          Leia e aceite os termos antes de ativar seu agente
        </p>
      </div>

      {/* Termos */}
      <div className="bg-slate-50 rounded-xl p-6 max-h-[280px] overflow-y-auto space-y-4 text-sm text-slate-700">
        <h4 className="font-bold text-slate-900">1. Natureza do Serviço</h4>
        <p>
          O agente de IA é uma ferramenta de assistência que utiliza inteligência artificial 
          para interagir com leads via WhatsApp. As respostas são geradas automaticamente 
          com base em modelos de linguagem e podem conter imprecisões.
        </p>

        <h4 className="font-bold text-slate-900">2. Limitações e Responsabilidades</h4>
        <p>
          <strong>2.1.</strong> O agente NÃO substitui um corretor de imóveis licenciado. 
          Todas as negociações devem ser finalizadas por um profissional habilitado.
        </p>
        <p>
          <strong>2.2.</strong> Valores, condições de pagamento e disponibilidade de imóveis 
          devem ser confirmados com a imobiliária antes de qualquer compromisso.
        </p>
        <p>
          <strong>2.3.</strong> A empresa contratante é responsável por revisar e corrigir 
          informações imprecisas geradas pelo agente.
        </p>

        <h4 className="font-bold text-slate-900">3. Proteção de Dados</h4>
        <p>
          Os dados coletados pelo agente são armazenados de forma segura e utilizados 
          exclusivamente para fins de atendimento e melhoria do serviço, em conformidade 
          com a LGPD (Lei Geral de Proteção de Dados).
        </p>

        <h4 className="font-bold text-slate-900">4. Isenção de Responsabilidade</h4>
        <p>A plataforma não se responsabiliza por:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Negociações mal sucedidas devido a informações do agente</li>
          <li>Perda de leads por falhas de integração ou indisponibilidade</li>
          <li>Danos decorrentes de uso indevido do serviço</li>
          <li>Conteúdo gerado pelo modelo de IA que viole diretrizes</li>
        </ul>

        <h4 className="font-bold text-slate-900">5. Uso Ético</h4>
        <p>
          O agente deve ser utilizado de forma ética e transparente. O lead deve ser 
          informado que está interagindo com uma IA quando solicitado expressamente.
        </p>

        <h4 className="font-bold text-slate-900">6. Monitoramento</h4>
        <p>
          Recomendamos o monitoramento regular das conversas do agente para garantir 
          qualidade e precisão das informações prestadas.
        </p>
      </div>

      {/* Checkbox de aceite */}
      <label className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
        <input
          type="checkbox"
          checked={dados.termosAceitos}
          onChange={(e) => setDados({ ...dados, termosAceitos: e.target.checked })}
          className="w-5 h-5 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <p className="font-medium text-slate-900">
            Li e aceito os Termos de Uso
          </p>
          <p className="text-sm text-slate-500">
            Ao marcar esta opção, você concorda com todas as condições descritas acima.
          </p>
        </div>
      </label>

      {/* Alerta */}
      <div className="bg-amber-50 p-4 rounded-lg flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          <strong>Importante:</strong> Este agente é uma ferramenta de assistência. 
          Sempre tenha um corretor qualificado para finalizar negociações e 
          confirmar informações importantes.
        </p>
      </div>
    </div>
  );
}
