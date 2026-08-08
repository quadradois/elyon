#!/usr/bin/env node
/**
 * Extrator de contratos backend <-> frontend do Elyon.
 *
 * Monta dois inventários (rotas Express + chamadas api.*) e cruza.
 * Só reporta o que é mecanicamente verificável; o julgamento fica no relatório.
 *
 * Uso:
 *   node extrair-contratos.mjs [raizDoRepo] [--json] [--filtro <regex>] [--orfas]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const posicionais = args.filter((a) => !a.startsWith('--'));
const idxFiltro = args.indexOf('--filtro');
const filtro = idxFiltro >= 0 && args[idxFiltro + 1] ? new RegExp(args[idxFiltro + 1], 'i') : null;

const RAIZ = resolve(posicionais[0] || process.cwd());
const DIR_BACKEND = join(RAIZ, 'pacotes/backend/src');
const DIR_FRONTEND = join(RAIZ, 'pacotes/frontend/src');
const SERVIDOR = join(DIR_BACKEND, 'servidor.ts');

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];
/** Em axios, o 2º argumento de get/delete é config, não corpo. */
const SEM_CORPO = new Set(['GET', 'DELETE']);

// ============================================================
// UTIL
// ============================================================

function listarArquivos(dir, exts) {
  const saida = [];
  const pilha = [dir];
  while (pilha.length) {
    const atual = pilha.pop();
    let entradas;
    try {
      entradas = readdirSync(atual);
    } catch {
      continue;
    }
    for (const nome of entradas) {
      if (nome === 'node_modules' || nome === 'dist' || nome === 'coverage') continue;
      const caminho = join(atual, nome);
      if (statSync(caminho).isDirectory()) pilha.push(caminho);
      else if (exts.some((e) => nome.endsWith(e))) saida.push(caminho);
    }
  }
  return saida;
}

const rel = (p) => p.replace(RAIZ + '/', '');
const linhaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;

function juntar(prefixo, sufixo) {
  const a = prefixo.replace(/\/+$/, '');
  const b = sufixo.startsWith('/') ? sufixo : '/' + sufixo;
  return a + (b === '/' ? '' : b) || '/';
}

/**
 * Quebra o caminho em segmentos tipados.
 * tipo: 'lit' (literal), 'par' (param do Express), 'dyn' (interpolação do frontend)
 */
function segmentar(caminho) {
  return caminho
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((s) => {
      if (s.includes('${')) return { tipo: 'dyn', valor: s };
      if (s.startsWith(':')) return { tipo: 'par', valor: s.replace(/\(.*$/, '') };
      return { tipo: 'lit', valor: s };
    });
}

function exibir(segs) {
  return '/' + segs.map((s) => (s.tipo === 'lit' ? s.valor : ':p')).join('/');
}

/** Extrai as chaves de primeiro nível de um literal de objeto que começa em `inicio`. */
function chavesDoObjeto(texto, inicio) {
  if (texto[inicio] !== '{') return null;
  let profundidade = 0;
  let fim = -1;
  let str = null;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (str) {
      if (c === str && texto[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if ('{[('.includes(c)) profundidade++;
    else if ('}])'.includes(c)) {
      profundidade--;
      if (profundidade === 0) { fim = i; break; }
    }
  }
  if (fim < 0) return null;

  const corpo = texto.slice(inicio + 1, fim);
  const chaves = [];
  let nivel = 0;
  let str2 = null;
  let token = '';
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i];
    if (str2) {
      if (c === str2 && corpo[i - 1] !== '\\') str2 = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str2 = c; continue; }
    if ('{[('.includes(c)) { nivel++; continue; }
    if ('}])'.includes(c)) { nivel--; continue; }
    if (nivel !== 0) continue;

    if (c === ':') {
      const m = token.trim().match(/([A-Za-z_$][\w$]*)\s*$/);
      if (m) chaves.push(m[1]);
      token = '';
      // pular o valor até a próxima vírgula de nível 0
      let n2 = 0, s2 = null, j = i + 1;
      for (; j < corpo.length; j++) {
        const d = corpo[j];
        if (s2) { if (d === s2 && corpo[j - 1] !== '\\') s2 = null; continue; }
        if (d === '"' || d === "'" || d === '`') { s2 = d; continue; }
        if ('{[('.includes(d)) n2++;
        else if ('}])'.includes(d)) n2--;
        else if (d === ',' && n2 === 0) break;
      }
      i = j;
    } else if (c === ',' || c === '\n') {
      const m = token.trim().match(/^([A-Za-z_$][\w$]*)$/); // shorthand
      if (m) chaves.push(m[1]);
      token = '';
    } else {
      token += c;
    }
  }
  const m = token.trim().match(/^([A-Za-z_$][\w$]*)$/);
  if (m) chaves.push(m[1]);
  return [...new Set(chaves)];
}

// ============================================================
// BACKEND
// ============================================================

function resolverImport(origem, especificador) {
  const base = join(dirname(origem), especificador);
  for (const c of [base + '.ts', join(base, 'index.ts')]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch { /* segue */ }
  }
  return null;
}

function importsDeRouter(arquivo, texto) {
  const mapa = new Map();
  const re = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(texto))) {
    const destino = resolverImport(arquivo, m[2]);
    if (destino) mapa.set(m[1], destino);
  }
  return mapa;
}

/** Schemas Zod nomeados no escopo do módulo: `const X = z.object({...})`. */
function schemasDoModulo(texto) {
  const mapa = new Map();
  const re = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*z\.object\(/g;
  let m;
  while ((m = re.exec(texto))) {
    const ab = texto.indexOf('{', m.index + m[0].length - 1);
    if (ab >= 0) {
      const chaves = chavesDoObjeto(texto, ab);
      if (chaves && chaves.length) mapa.set(m[1], chaves);
    }
  }
  return mapa;
}

/**
 * Campos que o handler realmente aceita no corpo.
 * Prioriza o schema que é aplicado a req.body — não o primeiro z.object que aparecer.
 */
function camposAceitos(corpo, schemasModulo) {
  // 1) NomeDoSchema.parse(req.body)
  // O escopo local vence: nomes genéricos como `const schema` se repetem entre
  // handlers, e o mapa do módulo guardaria só a última ocorrência do arquivo.
  const nomeado = corpo.match(/([A-Za-z_$][\w$]*)\s*\.\s*(?:safeParse|parse)\s*\(\s*req\.body/);
  if (nomeado) {
    const local = schemasDoModulo(corpo);
    if (local.has(nomeado[1])) return { campos: local.get(nomeado[1]), origem: 'zod' };
    if (schemasModulo.has(nomeado[1])) return { campos: schemasModulo.get(nomeado[1]), origem: 'zod' };
  }

  // 2) z.object({...}).parse(req.body) inline
  const inline = corpo.search(/z\.object\(\s*\{[\s\S]*?\}\s*\)\s*\.\s*(?:safeParse|parse)\s*\(\s*req\.body/);
  if (inline >= 0) {
    const ab = corpo.indexOf('{', corpo.indexOf('z.object(', inline));
    const chaves = chavesDoObjeto(corpo, ab);
    if (chaves?.length) return { campos: chaves, origem: 'zod' };
  }

  // 3) const { a, b } = req.body
  const desestr = corpo.match(/const\s*\{([^}]*)\}\s*=\s*req\.body/);
  if (desestr) {
    const campos = desestr[1]
      .split(',')
      .map((s) => s.split(':')[0].split('=')[0].trim())
      .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
    if (campos.length) return { campos, origem: 'destructuring' };
  }

  return { campos: null, origem: null };
}

function coletarRotas(arquivo, prefixo, vistos, saida) {
  const chave = arquivo + '::' + prefixo;
  if (vistos.has(chave)) return;
  vistos.add(chave);

  let texto;
  try {
    texto = readFileSync(arquivo, 'utf8');
  } catch {
    return;
  }
  const imports = importsDeRouter(arquivo, texto);
  const schemasModulo = schemasDoModulo(texto);

  const reUse = /router\.use\(\s*['"]([^'"]*)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
  let u;
  while ((u = reUse.exec(texto))) {
    const alvo = imports.get(u[2]);
    if (alvo) coletarRotas(alvo, juntar(prefixo, u[1]), vistos, saida);
  }

  const reRota = new RegExp(`router\\.(${METODOS.join('|')})\\(\\s*['"\`]([^'"\`]*)['"\`]`, 'g');
  let r;
  while ((r = reRota.exec(texto))) {
    const metodo = r[1].toUpperCase();
    const caminho = juntar(prefixo, r[2]);
    const restante = texto.slice(r.index + r[0].length);
    const proxima = restante.search(new RegExp(`\\nrouter\\.(${METODOS.join('|')})\\(`));
    const corpo = proxima > 0 ? restante.slice(0, proxima) : restante;
    const aceitos = SEM_CORPO.has(metodo) ? { campos: null, origem: null } : camposAceitos(corpo, schemasModulo);

    saida.push({
      metodo,
      caminho,
      segmentos: segmentar(caminho),
      arquivo: rel(arquivo),
      linha: linhaDe(texto, r.index),
      camposAceitos: aceitos.campos,
      origemValidacao: aceitos.origem,
    });
  }
}

function inventarioBackend() {
  const texto = readFileSync(SERVIDOR, 'utf8');
  const imports = importsDeRouter(SERVIDOR, texto);
  const saida = [];
  const vistos = new Set();
  const montagens = [];
  const re = /app\.use\(\s*['"](\/api[^'"]*)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
  let m;
  while ((m = re.exec(texto))) {
    const alvo = imports.get(m[2]);
    if (alvo) montagens.push({ prefixo: m[1], arquivo: alvo });
  }
  for (const mo of montagens) coletarRotas(mo.arquivo, mo.prefixo, vistos, saida);
  return { rotas: saida, montagens };
}

// ============================================================
// FRONTEND
// ============================================================

function inventarioFrontend() {
  const chamadas = [];
  const re = new RegExp(
    `\\bapi(?:Agenda|Followup)?\\.(${METODOS.join('|')})(?:<[^>]*>)?\\(\\s*(['"\`])([^'"\`]*)\\2`,
    'g'
  );
  for (const arquivo of listarArquivos(DIR_FRONTEND, ['.ts', '.tsx'])) {
    if (/\.test\.tsx?$/.test(arquivo)) continue;
    const texto = readFileSync(arquivo, 'utf8');
    let m;
    while ((m = re.exec(texto))) {
      const metodo = m[1].toUpperCase();
      const bruto = m[3].startsWith('/') ? m[3] : '/' + m[3];

      let camposEnviados = null;
      if (!SEM_CORPO.has(metodo)) {
        const depois = texto.slice(m.index + m[0].length);
        const mv = depois.match(/^\s*,\s*/);
        if (mv && depois[mv[0].length] === '{') camposEnviados = chavesDoObjeto(depois, mv[0].length);
      }

      chamadas.push({
        metodo,
        caminho: '/api' + bruto,
        segmentos: segmentar('/api' + bruto),
        arquivo: rel(arquivo),
        linha: linhaDe(texto, m.index),
        camposEnviados: camposEnviados?.length ? camposEnviados : null,
      });
    }
  }
  return chamadas;
}

// ============================================================
// CRUZAMENTO
// ============================================================

/**
 * Casa uma chamada com uma rota.
 * 'exata'   — todos os segmentos batem literal-com-literal / param-com-dyn
 * 'provavel'— um segmento interpolado no frontend caiu num literal do backend
 *             (ex.: `/${endpoint}` onde endpoint ∈ {ativar, pausar})
 */
function casar(chamada, rota) {
  if (chamada.metodo !== rota.metodo) return null;
  const a = chamada.segmentos;
  const b = rota.segmentos;
  if (a.length !== b.length) return null;
  let exata = true;
  for (let i = 0; i < a.length; i++) {
    const fs = a[i];
    const bs = b[i];
    if (bs.tipo === 'par') continue;
    if (fs.tipo === 'lit' && fs.valor === bs.valor) continue;
    if (fs.tipo === 'dyn') { exata = false; continue; }
    return null;
  }
  return exata ? 'exata' : 'provavel';
}

const backend = inventarioBackend();
const frontend = inventarioFrontend();

const fantasmas = [];
const camposIgnorados = [];
const resolvidasPorVariavel = [];
const consumidas = new Set();

for (const c of frontend) {
  if (filtro && !filtro.test(c.caminho) && !filtro.test(c.arquivo)) continue;

  const exatas = [];
  const provaveis = [];
  for (const r of backend.rotas) {
    const nivel = casar(c, r);
    if (nivel === 'exata') exatas.push(r);
    else if (nivel === 'provavel') provaveis.push(r);
  }

  if (!exatas.length && !provaveis.length) {
    const mesmoCaminho = backend.rotas
      .filter((r) => casar({ ...c, metodo: r.metodo }, r))
      .map((r) => `${r.metodo} ${exibir(r.segmentos)}`);
    fantasmas.push({ ...c, metodosDisponiveis: [...new Set(mesmoCaminho)] });
    continue;
  }

  const alvo = exatas[0] || provaveis[0];
  for (const r of [...exatas, ...provaveis]) consumidas.add(`${r.metodo} ${r.caminho}`);
  if (!exatas.length) {
    resolvidasPorVariavel.push({ chamada: c, candidatas: provaveis.map((r) => exibir(r.segmentos)) });
  }

  if (c.camposEnviados && alvo.camposAceitos) {
    const desconhecidos = c.camposEnviados.filter((k) => !alvo.camposAceitos.includes(k));
    if (desconhecidos.length) camposIgnorados.push({ chamada: c, rota: alvo, desconhecidos });
  }
}

const semConsumidor = backend.rotas
  .filter((r) => !consumidas.has(`${r.metodo} ${r.caminho}`))
  .filter((r) => !filtro || filtro.test(r.caminho) || filtro.test(r.arquivo));

// ============================================================
// SAÍDA
// ============================================================

if (flags.has('--json')) {
  console.log(JSON.stringify({ fantasmas, camposIgnorados, resolvidasPorVariavel, semConsumidor, totais: { backend: backend.rotas.length, frontend: frontend.length } }, null, 2));
  process.exit(fantasmas.length || camposIgnorados.length ? 1 : 0);
}

const hr = '─'.repeat(74);
console.log(hr);
console.log('AUDITORIA DE CONTRATOS  ·  ' + RAIZ);
console.log(hr);
console.log(`Backend: ${backend.rotas.length} rotas (${backend.montagens.length} montagens)   |   Frontend: ${frontend.length} chamadas`);
console.log();

console.log(`## 1. ROTA FANTASMA — o frontend chama, o backend não expõe (${fantasmas.length})`);
console.log('   Impacto: 404 em runtime. O usuário preenche a tela e nada é salvo.');
if (!fantasmas.length) console.log('   nenhuma');
for (const f of fantasmas) {
  console.log(`\n   ✗ ${f.metodo} ${exibir(f.segmentos)}`);
  console.log(`     chamada em ${f.arquivo}:${f.linha}`);
  if (f.metodosDisponiveis.length) console.log(`     backend expõe nesse caminho: ${f.metodosDisponiveis.join(', ')}`);
  if (f.camposEnviados) console.log(`     payload descartado: ${f.camposEnviados.join(', ')}`);
}
console.log();

console.log(`## 2. CAMPO IGNORADO — enviado pelo frontend, ausente na validação do backend (${camposIgnorados.length})`);
console.log('   Impacto: Zod remove o campo silenciosamente. Salva com 200 e perde o dado.');
if (!camposIgnorados.length) console.log('   nenhum');
for (const ci of camposIgnorados) {
  console.log(`\n   ✗ ${ci.chamada.metodo} ${exibir(ci.chamada.segmentos)} — descarta: ${ci.desconhecidos.join(', ')}`);
  console.log(`     envia:  ${ci.chamada.arquivo}:${ci.chamada.linha} → ${ci.chamada.camposEnviados.join(', ')}`);
  console.log(`     aceita: ${ci.rota.arquivo}:${ci.rota.linha} (${ci.rota.origemValidacao}) → ${ci.rota.camposAceitos.join(', ')}`);
}
console.log();

console.log(`## 3. CASADA POR SEGMENTO VARIÁVEL — confira à mão (${resolvidasPorVariavel.length})`);
console.log('   O caminho tem `${variavel}` num trecho que o backend declara literal.');
for (const rv of resolvidasPorVariavel) {
  console.log(`   ~ ${rv.chamada.metodo} ${exibir(rv.chamada.segmentos)}  ${rv.chamada.arquivo}:${rv.chamada.linha}`);
  console.log(`     candidatas: ${[...new Set(rv.candidatas)].join(', ')}`);
}
console.log();

if (flags.has('--orfas')) {
  console.log(`## 4. ROTA SEM CONSUMIDOR — backend expõe, nenhum api.* chama (${semConsumidor.length})`);
  console.log('   Esperado para webhooks, cron e uso interno. Não remova sem checar.');
  for (const r of semConsumidor) console.log(`   · ${r.metodo} ${exibir(r.segmentos)}   ${r.arquivo}:${r.linha}`);
} else {
  console.log(`## 4. ROTA SEM CONSUMIDOR: ${semConsumidor.length} (use --orfas para listar)`);
}

process.exit(fantasmas.length || camposIgnorados.length ? 1 : 0);
