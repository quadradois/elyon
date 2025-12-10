// Serviço de Integração com Supabase
// Busca leads do site de vendas (lista VIP)

// Configuração Supabase
const SUPABASE_URL = 'https://qtlpkxbvrhgqmrwcmcfp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bHBreGJ2cmhncW1yd2NtY2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODc2OTksImV4cCI6MjA4MDg2MzY5OX0.x4zez24C_dG94wWuSZRaHDbLk_X9eAjhkjcrbcoChcs';

// ====================================
// TIPOS
// ====================================

export interface LeadVIP {
  id?: number;
  nome: string;
  email: string;
  whatsapp: string;
  empresa: string;
  tipo: string;       // 'corretor', 'imobiliaria', 'incorporadora'
  creci: string;
  plano: string;      // 'Starter', 'Growth', 'Pro'
  origem: string;
  created_at?: string;
  status?: string;    // Para controle interno
  atendido?: boolean;
  notas?: string;
}

// ====================================
// FUNÇÕES
// ====================================

/**
 * Buscar todos os leads VIP do Supabase
 */
export async function listarLeadsVIP(opcoes?: {
  limite?: number;
  offset?: number;
  apenasNaoAtendidos?: boolean;
}): Promise<LeadVIP[]> {
  try {
    const limite = opcoes?.limite || 100;
    const offset = opcoes?.offset || 0;
    
    let url = `${SUPABASE_URL}/rest/v1/leads_vip?select=*&order=created_at.desc&limit=${limite}&offset=${offset}`;
    
    // Filtro por não atendidos
    if (opcoes?.apenasNaoAtendidos) {
      url += '&or=(atendido.is.null,atendido.eq.false)';
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro Supabase: ${response.status}`);
    }
    
    const leads = await response.json() as LeadVIP[];
    console.log(`[Supabase] ✅ ${leads.length} leads VIP carregados`);
    
    return leads;
  } catch (erro) {
    console.error('[Supabase] Erro ao listar leads VIP:', erro);
    throw erro;
  }
}

/**
 * Buscar contagem total de leads
 */
export async function contarLeadsVIP(): Promise<{ total: number; naoAtendidos: number }> {
  try {
    // Total
    const responseTotal = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_vip?select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    // Não atendidos
    const responseNaoAtendidos = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_vip?select=id&or=(atendido.is.null,atendido.eq.false)`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      }
    );
    
    const total = parseInt(responseTotal.headers.get('content-range')?.split('/')[1] || '0');
    const naoAtendidos = parseInt(responseNaoAtendidos.headers.get('content-range')?.split('/')[1] || '0');
    
    return { total, naoAtendidos };
  } catch (erro) {
    console.error('[Supabase] Erro ao contar leads:', erro);
    return { total: 0, naoAtendidos: 0 };
  }
}

/**
 * Marcar lead como atendido
 */
export async function marcarComoAtendido(leadId: number, notas?: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_vip?id=eq.${leadId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          atendido: true,
          status: 'ATENDIDO',
          notas: notas || null
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao atualizar: ${response.status}`);
    }
    
    console.log(`[Supabase] ✅ Lead ${leadId} marcado como atendido`);
    return true;
  } catch (erro) {
    console.error('[Supabase] Erro ao marcar como atendido:', erro);
    return false;
  }
}

/**
 * Atualizar status do lead
 */
export async function atualizarStatusLead(leadId: number, status: string, notas?: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_vip?id=eq.${leadId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status,
          notas: notas || null
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erro ao atualizar: ${response.status}`);
    }
    
    console.log(`[Supabase] ✅ Lead ${leadId} atualizado para ${status}`);
    return true;
  } catch (erro) {
    console.error('[Supabase] Erro ao atualizar status:', erro);
    return false;
  }
}

/**
 * Buscar lead por ID
 */
export async function buscarLeadVIP(leadId: number): Promise<LeadVIP | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_vip?id=eq.${leadId}`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erro: ${response.status}`);
    }
    
    const leads = await response.json() as LeadVIP[];
    return leads[0] || null;
  } catch (erro) {
    console.error('[Supabase] Erro ao buscar lead:', erro);
    return null;
  }
}
