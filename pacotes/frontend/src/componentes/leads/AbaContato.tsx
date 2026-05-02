/**
 * AbaContato — Dados de contato e identificação do lead
 * Layout em grid 2 colunas, seguindo o padrão visual da AbaImovel.
 */

import { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  User,
  Hash,
  Users,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LeadPriorizado } from '../../ganchos/useLeadsPriorizados';
import { formatarCpf } from '../../lib/formatters';

interface AbaContatoProps {
  lead: LeadPriorizado;
}

function formatarData(data: string | null | undefined): string | null {
  if (!data) return null;
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Card de campo (igual ao padrão AbaImovel) ───────────────────────────────

function Campo({
  icone: Icone,
  label,
  valor,
  copiavel = false,
  mono = false,
  col2 = false,
}: {
  icone?: React.ElementType;
  label: string;
  valor: string | number | null | undefined;
  copiavel?: boolean;
  mono?: boolean;
  col2?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  if (!valor && valor !== 0) return null;

  const copiar = async () => {
    await navigator.clipboard.writeText(String(valor));
    setCopiado(true);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className={`bg-white rounded-xl p-3 border border-slate-200 flex items-start gap-2 ${col2 ? 'col-span-2' : ''}`}>
      {Icone && <Icone className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-slate-800 break-words leading-snug ${mono ? 'font-mono' : ''}`}>
          {valor}
        </p>
      </div>
      {copiavel && (
        <button
          onClick={copiar}
          className="w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0"
          title={`Copiar ${label}`}
        >
          {copiado
            ? <Check className="w-3 h-3 text-emerald-500" />
            : <Copy className="w-3 h-3 text-slate-300" />}
        </button>
      )}
    </div>
  );
}

// ─── Divisor de seção ─────────────────────────────────────────────────────────

function Divisor({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-100" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{titulo}</span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function AbaContato({ lead }: AbaContatoProps) {
  const temContato    = lead.telefone || lead.email || lead.telefone2 || lead.telefone3;
  const temIdent      = lead.cpf || lead.dataNascimento || lead.sexo || lead.idade;
  const temEndereco   = lead.enderecoPrincipal || lead.cidade;
  const temProfissional = lead.profissao || lead.empresaAtual || lead.rendaEstimada || lead.faixaSalarial || lead.scoreAssertiva;
  const temOrigem     = lead.campanhaOrigem || lead.origem;

  const temAlgumDado = temContato || temIdent || temEndereco || temProfissional || temOrigem;

  if (!temAlgumDado) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <User className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Sem dados de contato</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
          O agente coletará os dados do proprietário durante a conversa.
        </p>
      </div>
    );
  }

  const nascimento = lead.dataNascimento
    ? `${formatarData(lead.dataNascimento)}${lead.idade ? ` · ${lead.idade} anos` : ''}`
    : null;

  return (
    <div className="p-3 space-y-4">

      {/* ══ Contato ══ */}
      {temContato && (
        <div className="space-y-2">
          <Divisor titulo="Contato" />
          <div className="grid grid-cols-2 gap-2">
            <Campo icone={Phone} label="Telefone principal" valor={lead.telefone}  copiavel />
            <Campo icone={Phone} label="Telefone 2"         valor={lead.telefone2} copiavel />
            <Campo icone={Phone} label="Telefone 3"         valor={lead.telefone3} copiavel />
            <Campo icone={Mail}  label="E-mail"             valor={lead.email}     copiavel />
          </div>
        </div>
      )}

      {/* ══ Identificação ══ */}
      {temIdent && (
        <div className="space-y-2">
          <Divisor titulo="Identificação" />
          <div className="grid grid-cols-2 gap-2">
            <Campo label="CPF"        valor={lead.cpf ? formatarCpf(lead.cpf) : null} copiavel mono />
            <Campo label="Nascimento" valor={nascimento} />
            <Campo label="Sexo"       valor={lead.sexo} />
          </div>
        </div>
      )}

      {/* ══ Endereço ══ */}
      {temEndereco && (
        <div className="space-y-2">
          <Divisor titulo="Endereço" />
          <div className="grid grid-cols-2 gap-2">
            <Campo icone={MapPin} label="Endereço" valor={lead.enderecoPrincipal} copiavel col2 />
            <Campo label="Cidade" valor={lead.cidade} />
            <Campo label="Estado" valor={lead.estado} />
            <Campo label="CEP"    valor={lead.cep} mono />
          </div>
        </div>
      )}

      {/* ══ Perfil Profissional ══ */}
      {temProfissional && (
        <div className="space-y-2">
          <Divisor titulo="Perfil Profissional" />
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Profissão"      valor={lead.profissao} />
            <Campo label="Empresa"        valor={lead.empresaAtual} />
            <Campo label="Renda estimada" valor={lead.rendaEstimada} />
            <Campo label="Faixa salarial" valor={lead.faixaSalarial} />
          </div>
          {lead.scoreAssertiva && (
            <div className="bg-white rounded-xl p-3 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Score Assertiva
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${lead.scoreAssertiva >= 70 ? 'bg-emerald-500' : lead.scoreAssertiva >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, lead.scoreAssertiva)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-700 w-8 text-right">{lead.scoreAssertiva}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Origem ══ */}
      {temOrigem && (
        <div className="space-y-2">
          <Divisor titulo="Origem" />
          <div className="grid grid-cols-2 gap-2">
            <Campo icone={Hash}  label="Canal"    valor={lead.origem} />
            <Campo icone={Users} label="Campanha" valor={lead.campanhaOrigem?.nome} />
          </div>
        </div>
      )}

    </div>
  );
}
