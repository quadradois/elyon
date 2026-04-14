import { analisarSentimento, gerarInstrucaoSentimento } from '../sentiment-analyzer';

// ============================================
// analisarSentimento
// ============================================

describe('analisarSentimento', () => {
  // --- NEUTRO ---
  it('retorna NEUTRO para mensagem vazia', () => {
    expect(analisarSentimento('')).toMatchObject({ sentimento: 'NEUTRO' });
  });

  it('retorna NEUTRO para mensagem genérica sem sinal', () => {
    expect(analisarSentimento('Boa tarde')).toMatchObject({ sentimento: 'NEUTRO' });
  });

  it('retorna NEUTRO para frase descritiva sem emoção', () => {
    expect(analisarSentimento('Meu apartamento tem 3 quartos e 120m²')).toMatchObject({ sentimento: 'NEUTRO' });
  });

  // --- POSITIVO ---
  it('detecta POSITIVO em "sim, quero saber mais"', () => {
    const r = analisarSentimento('Sim, quero saber mais');
    expect(r.sentimento).toBe('POSITIVO');
    expect(r.sinaisDetectados.length).toBeGreaterThan(0);
  });

  it('detecta POSITIVO com emojis 👍', () => {
    expect(analisarSentimento('Legal 👍')).toMatchObject({ sentimento: 'POSITIVO' });
  });

  it('detecta POSITIVO em "pode ser, faz sentido"', () => {
    expect(analisarSentimento('Pode ser, faz sentido')).toMatchObject({ sentimento: 'POSITIVO' });
  });

  // --- NEGATIVO ---
  it('detecta NEGATIVO em "não tenho interesse"', () => {
    const r = analisarSentimento('não tenho interesse, desculpe');
    expect(r.sentimento).toBe('NEGATIVO');
  });

  it('detecta NEGATIVO para "muito caro"', () => {
    expect(analisarSentimento('Achei muito caro, absurdo')).toMatchObject({ sentimento: 'NEGATIVO' });
  });

  it('detecta NEGATIVO com emoji 😔', () => {
    expect(analisarSentimento('Não deu certo 😔')).toMatchObject({ sentimento: 'NEGATIVO' });
  });

  // --- IRRITADO ---
  it('detecta IRRITADO em "para de me mandar mensagem"', () => {
    const r = analisarSentimento('Para de me mandar mensagem!!!');
    expect(r.sentimento).toBe('IRRITADO');
  });

  it('detecta IRRITADO com ameaça legal', () => {
    expect(analisarSentimento('Vou chamar meu advogado se não parar')).toMatchObject({ sentimento: 'IRRITADO' });
  });

  it('detecta IRRITADO com emoji 🤬', () => {
    expect(analisarSentimento('🤬')).toMatchObject({ sentimento: 'IRRITADO' });
  });

  it('detecta IRRITADO com pontuação excessiva', () => {
    const r = analisarSentimento('Quem é você???');
    expect(r.sentimento).toBe('IRRITADO');
  });

  // --- CAPS LOCK corrigido ---
  it('NÃO classifica IRRITADO para frase normal com 15+ chars', () => {
    // Este era o bug: "Olá Bom Dia Como Vai" com espaços passava no regex antigo
    const r = analisarSentimento('Olá bom dia como vai você tudo certo');
    expect(r.sentimento).not.toBe('IRRITADO');
  });

  it('NÃO classifica IRRITADO para nome próprio em caps', () => {
    const r = analisarSentimento('Sou o JOÃO DA SILVA e moro no Setor Bueno');
    expect(r.sentimento).not.toBe('IRRITADO');
  });

  it('detecta IRRITADO para múltiplas palavras ALL CAPS consecutivas', () => {
    const r = analisarSentimento('PARA DE MANDAR MENSAGEM AGORA');
    expect(r.sentimento).toBe('IRRITADO');
  });

  it('NÃO classifica IRRITADO quando a frase contém apenas siglas curtas', () => {
    // "para" (preposição) casa com o padrão de irritação — isso é limitação aceita do
    // analisador léxico. Aqui testamos que siglas em caps NÃO disparam sozinhas.
    const r = analisarSentimento('Preciso da NF e do IR');
    expect(r.sentimento).not.toBe('IRRITADO');
  });

  // --- Emoji misto ---
  it('dá prioridade a IRRITADO quando há emoji misto positivo+irritado', () => {
    // 😊 é positivo mas 🤬 é irritado. IRRITADO tem prioridade.
    const r = analisarSentimento('Seu serviço é horrível 🤬 mas obrigado 😊');
    expect(r.sentimento).toBe('IRRITADO');
  });

  // --- Confiança ---
  it('confiança de IRRITADO é >= 80 com múltiplos sinais', () => {
    const r = analisarSentimento('CHEGA!!! Me bloqueia, golpe, spam!!!');
    expect(r.sentimento).toBe('IRRITADO');
    expect(r.confianca).toBeGreaterThanOrEqual(80);
  });
});

// ============================================
// gerarInstrucaoSentimento
// ============================================

describe('gerarInstrucaoSentimento', () => {
  it('retorna instrução vazia para NEUTRO', () => {
    expect(gerarInstrucaoSentimento({ sentimento: 'NEUTRO', confianca: 50, sinaisDetectados: [] })).toBe('');
  });

  it('retorna instrução com "IRRITAÇÃO" para sentimento IRRITADO', () => {
    const instrucao = gerarInstrucaoSentimento({
      sentimento: 'IRRITADO',
      confianca: 85,
      sinaisDetectados: ['IRRITADO: "para"'],
    });
    expect(instrucao).toContain('IRRITAÇÃO');
    expect(instrucao).toContain('85%');
  });

  it('retorna instrução com "NEGATIVO" para sentimento negativo', () => {
    const instrucao = gerarInstrucaoSentimento({
      sentimento: 'NEGATIVO',
      confianca: 60,
      sinaisDetectados: ['NEGATIVO: "não"'],
    });
    expect(instrucao).toContain('NEGATIVO');
  });

  it('retorna instrução com "POSITIVO" para sentimento positivo', () => {
    const instrucao = gerarInstrucaoSentimento({
      sentimento: 'POSITIVO',
      confianca: 70,
      sinaisDetectados: ['POSITIVO: "sim"'],
    });
    expect(instrucao).toContain('POSITIVO');
  });
});
