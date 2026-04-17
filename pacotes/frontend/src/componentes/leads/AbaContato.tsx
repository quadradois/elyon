/**
 * AbaContato — Dados de contato e identificação do lead
 *
 * Centraliza todas as informações pessoais do proprietário:
 * telefone, email, CPF, endereço, nascimento, profissão, renda, score Assertiva.
 */

import { useState } from 'react';
import {
  Phone,
  Mail,
  BadgeCheck,
  MapPin,
  Calendar,
  Briefcase,
  TrendingUp,
  Copy,
  Check,
  Users,
  User,
  Hash,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LeadPriorizado } from '../../ganchos/useLeadsPriorizados';

interface AbaContatoProps {
  lead: LeadPriorizado;
}

// ─── Helper: formata CPF ─────────────────────────

function formatarCpf(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '');
  return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

// ─── Helper: formata data ────────────────────────

function formatarData(data: string | null): string | null {
  if (!data) return null;
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Linha de informação ─────────────────────────

function LinhaInfo({
  icone: Icone,
  label,
  valor,
  copiavel = false,
  mono = false,
  destaque = false,
}: {
  icone: React.ElementType;
  label: string;
  valor: string | number | null | undefined;
  copiavel?: boolean;
  mono?: boolean;
  destaque?: boolean;
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
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${destaque ? 'bg-indigo-50' : 'bg-slate-50'}`}>
        <Icone className={`w-3.5 h-3.5 ${destaque ? 'text-indigo-500' : 'text-slate-400'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className={`text-xs text-slate-700 break-words leading-relaxed ${mono ? 'font-mono' : 'font-medium'} ${destaque ? 'text-indigo-700' : ''}`}>
          {valor}
        </p>
      </div>
      {copiavel && (
        <button
          onClick={copiar}
          className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5"
          title={`Copiar ${label}`}
        >
          {copiado
            ? <Check className="w-3 h-3 text-emerald-500" />
            : <Copy className="w-3 h-3 text-slate-300" />
          }
        </button>
      )}
    </div>
  );
}

// ─── Seção com título ────────────────────────────

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2 bg-slate-50 border-y border-slate-100">
        {titulo}
      </p>
      <div className="px-4">
        {children}
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────

export function AbaContato({ lead }: AbaContatoProps) {
  const temContato = lead.telefone || lead.email || lead.telefone2 || lead.telefone3;
  const temIdentificacao = lead.cpf || lead.dataNascimento || lead.sexo || lead.idade;
  const temEndereco = lead.enderecoPrincipal;
  const temProfissional = lead.profissao || lead.empresaAtual || lead.rendaEstimada || lead.faixaSalarial || lead.scoreAssertiva;
  const temOrigem = lead.campanhaOrigem || lead.origem;

  const temAlgumDado = temContato || temIdentificacao || temEndereco || temProfissional || temOrigem;

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

  return (
    <div className="pb-4">

      {/* ══ Identificação ══ */}
      {temIdentificacao && (
        <Secao titulo="Identificação">
          <LinhaInfo
            icone={BadgeCheck}
            label="CPF"
            valor={lead.cpf ? formatarCpf(lead.cpf) : null}
            copiavel
            mono
            destaque
          />
          <LinhaInfo
            icone={Calendar}
            label="Data de nascimento"
            valor={
              lead.dataNascimento
                ? `${formatarData(lead.dataNascimento)}${lead.idade ? ` · ${lead.idade} anos` : ''}`
                : null
            }
          />
          <LinhaInfo icone={User} label="Sexo" valor={lead.sexo} />
        </Secao>
      )}

      {/* ══ Contato ══ */}
      {temContato && (
        <Secao titulo="Contato">
          <LinhaInfo icone={Phone} label="Telefone principal" valor={lead.telefone} copiavel />
          <LinhaInfo icone={Phone} label="Telefone 2" valor={lead.telefone2} copiavel />
          <LinhaInfo icone={Phone} label="Telefone 3" valor={lead.telefone3} copiavel />
          <LinhaInfo icone={Mail} label="E-mail" valor={lead.email} copiavel />
        </Secao>
      )}

      {/* ══ Endereço ══ */}
      {temEndereco && (
        <Secao titulo="Endereço">
          <LinhaInfo icone={MapPin} label="Endereço" valor={lead.enderecoPrincipal} copiavel />
        </Secao>
      )}

      {/* ══ Perfil profissional ══ */}
      {temProfissional && (
        <Secao titulo="Perfil Profissional">
          <LinhaInfo icone={Briefcase} label="Profissão" valor={lead.profissao} />
          <LinhaInfo icone={Users} label="Empresa" valor={lead.empresaAtual} />
          <LinhaInfo icone={DollarSign} label="Renda estimada" valor={lead.rendaEstimada} />
          <LinhaInfo icone={DollarSign} label="Faixa salarial" valor={lead.faixaSalarial} />
          {lead.scoreAssertiva && (
            <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-none mb-1">Score Assertiva</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lead.scoreAssertiva >= 70 ? 'bg-emerald-500' : lead.scoreAssertiva >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, lead.scoreAssertiva)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{lead.scoreAssertiva}</span>
                </div>
              </div>
            </div>
          )}
        </Secao>
      )}

      {/* ══ Origem ══ */}
      {temOrigem && (
        <Secao titulo="Origem">
          <LinhaInfo icone={Hash} label="Canal de origem" valor={lead.origem} />
          <LinhaInfo icone={Users} label="Campanha" valor={lead.campanhaOrigem?.nome} />
        </Secao>
      )}

    </div>
  );
}
