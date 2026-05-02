// Utilitários de formatação e extração compartilhados entre páginas.
// Centraliza funções que eram duplicadas em ProprietarioDetalhes, LeadDetalhes, Proprietarios, etc.

// ─── Limpeza de strings ───────────────────────────────────────────────────────

export function limparTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.toLowerCase() === '[object object]') return null;
  return texto;
}

export function normalizarLista(valor: unknown): any[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

export function formatarTelefone(numero: string): string {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return numero;
}

export function formatarCpf(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length === 11) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
  return cpf;
}

export function formatarMoeda(valor: number | string): string {
  const texto = String(valor).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(texto);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num);
}

export function formatarDataCurta(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function tempoRelativo(data?: string): string {
  if (!data) return '-';
  const diffMin = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (diffMin < 1)  return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHora = Math.floor(diffMin / 60);
  if (diffHora < 24) return `${diffHora}h`;
  return `${Math.floor(diffHora / 24)}d`;
}

export function iconeTemperatura(temp?: string | null): string {
  if (temp === 'QUENTE') return '🔥';
  if (temp === 'MORNO')  return '⚡';
  return '❄️';
}

export function formatarTipoImovel(tipo: string | null): string {
  if (!tipo) return '-';
  const t = tipo.toUpperCase();
  if (t.includes('PREDIAL') || t.includes('APTO') || t.includes('APARTAMENTO')) return 'Apartamento';
  if (t.includes('TERRITORIAL') || t.includes('LOTE') || t.includes('TERRENO'))  return 'Terreno/Lote';
  if (t.includes('CASA') && t.includes('CONDOMINIO')) return 'Casa em Condomínio';
  if (t.includes('CASA'))     return 'Casa';
  if (t.includes('COMERCIAL')) return 'Comercial';
  return tipo;
}

// ─── Extratores de contato ────────────────────────────────────────────────────

export interface TelefoneItem {
  numero: string;
  principal?: boolean;
  whatsapp?: boolean;
  tipo?: string;
}

export interface EmailItem {
  email: string;
}

export function extrairTelefones(lead: any): TelefoneItem[] {
  if (lead?.telefonesJson) {
    try {
      const parsed = typeof lead.telefonesJson === 'string'
        ? JSON.parse(lead.telefonesJson)
        : lead.telefonesJson;
      if (Array.isArray(parsed)) {
        return parsed
          .map((t: any) => (typeof t === 'string' ? { numero: t } : t))
          .filter((t: any) => limparTexto(t?.numero)) as TelefoneItem[];
      }
    } catch { /* fallback abaixo */ }
  }

  const base: TelefoneItem[] = [];
  const push = (numero: unknown, principal = false, whatsapp = false) => {
    const n = limparTexto(numero);
    if (n) base.push({ numero: n, principal, whatsapp });
  };
  push(lead?.telefone,  true, true);
  push(lead?.telefone2, false, true);
  push(lead?.telefone3);
  push(lead?.telefone4);
  push(lead?.telefone5);
  return base;
}

export function extrairEmails(lead: any): EmailItem[] {
  if (lead?.emailsJson) {
    try {
      const parsed = typeof lead.emailsJson === 'string'
        ? JSON.parse(lead.emailsJson)
        : lead.emailsJson;
      if (Array.isArray(parsed)) {
        return parsed
          .map((e: any) => (typeof e === 'string' ? { email: e } : e))
          .filter((e: any) => limparTexto(e?.email)) as EmailItem[];
      }
    } catch { /* fallback abaixo */ }
  }

  const base: EmailItem[] = [];
  const push = (email: unknown) => {
    const e = limparTexto(email);
    if (e) base.push({ email: e });
  };
  push(lead?.email);
  push(lead?.email2);
  push(lead?.email3);
  return base;
}

// ─── URL WhatsApp ─────────────────────────────────────────────────────────────

// BUG-FIX: evita duplicar o prefixo 55 quando o número já o contém
export function urlWhatsApp(numero: string): string {
  const limpo = numero.replace(/\D/g, '');
  const comPais = limpo.startsWith('55') ? limpo : `55${limpo}`;
  return `https://wa.me/${comPais}`;
}
