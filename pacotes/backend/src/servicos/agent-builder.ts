import { AgenteConfiguracao, AgenteExecutavel, Especialista, Skill, Condicao } from '../agentes/types';
import { Tool } from '@openai/agents';
import { prisma } from '../lib/db'; // Placeholder para acesso a DB se necessário
import fs from 'fs/promises';
import path from 'path';

export class AgentBuilder {
    private specialistsPath = path.join(__dirname, '../templates/specialists');
    private skillsPath = path.join(__dirname, '../templates/skills');

    /**
     * Constrói um agente executável a partir de uma configuração
     */
    async build(config: AgenteConfiguracao): Promise<AgenteExecutavel> {
        console.log(`[AgentBuilder] 🔨 Construindo agente: ${config.id}`);

        // 1. Carregar componentes (Mockando repositório com arquivos JSON por enquanto)
        const especialista = await this.carregarEspecialista(config.especialista);
        const skills = await this.carregarSkills(config.skills);

        // 2. Validações
        this.validarCompatibilidade(especialista, skills);
        this.validarIncompatibilidades(skills);
        this.validarSkillsObrigatorias(especialista, skills);

        // 3. Resolver dependências (ordenação topológica)
        const skillsOrdenadas = this.resolverDependencias(skills);

        // 4. Compilar agente
        const systemPrompt = await this.compilarPrompt(
            especialista,
            config.subtipo,
            skillsOrdenadas,
            config.parametrosGlobais
        );

        const tools = this.compilarTools(
            especialista.toolsBase,
            skillsOrdenadas
        );

        // 5. Retornar agente executável
        return {
            id: config.id,
            tenantId: config.tenantId,
            especialista: especialista.id,
            subtipo: config.subtipo,
            systemPrompt,
            tools,
            skills: skillsOrdenadas,
            fluxo: especialista.fluxoBase,
            hooks: especialista.hooks,
            metadata: {
                versao: config.versaoConfig,
                skillsAtivas: skills.map(s => `${s.id}@${s.versao}`),
                compiladoEm: new Date()
            }
        };
    }

    // ====================================
    // CARREGAMENTO (IO)
    // ====================================

    private async carregarEspecialista(id: string): Promise<Especialista> {
        try {
            // Em produção, isso viria de um DB ou Cache. MVP: Arquivo JSON
            // Se o arquivo não existir, usaremos um mock para não travar o desenvolvimento
            const filePath = path.join(this.specialistsPath, `${id.toLowerCase()}.json`);
            const exists = await fs.access(filePath).then(() => true).catch(() => false);

            if (exists) {
                const data = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(data);
            }

            // Fallback para dev (se não criou os JSONs ainda)
            throw new Error(`Template de especialista não encontrado: ${id}`);
        } catch (error: any) {
            throw new Error(`Erro ao carregar especialista ${id}: ${error.message}`);
        }
    }

    private async carregarSkills(skillsConfig: AgenteConfiguracao['skills']): Promise<Skill[]> {
        const skills: Skill[] = [];

        for (const skillConfig of skillsConfig) {
            try {
                const filePath = path.join(this.skillsPath, `${skillConfig.id.toLowerCase()}.json`);
                // Lógica de versionamento seria aqui (buscar arquivo específico v1/v2)

                // Mock load
                const exists = await fs.access(filePath).then(() => true).catch(() => false);
                if (!exists) {
                    throw new Error(`Skill não encontrada no disco: ${skillConfig.id}`);
                }

                const data = await fs.readFile(filePath, 'utf-8');
                const skill: Skill = JSON.parse(data);

                // Aplicar parâmetros customizados
                if (skillConfig.parametros) {
                    skill.parametrosAtivos = {
                        ...this.getParametrosPadrao(skill),
                        ...skillConfig.parametros
                    };
                } else {
                    skill.parametrosAtivos = this.getParametrosPadrao(skill);
                }

                skills.push(skill);
            } catch (error: any) {
                console.error(`[AgentBuilder] ⚠️ Erro ao carregar skill ${skillConfig.id}:`, error.message);
                throw error;
            }
        }

        return skills;
    }

    // ====================================
    // VALIDAÇÕES
    // ====================================

    private validarCompatibilidade(especialista: Especialista, skills: Skill[]): void {
        skills.forEach(skill => {
            if (skill.especialistasCompativeis && !skill.especialistasCompativeis.includes(especialista.id)) {
                throw new Error(`Skill "${skill.nome}" não é compatível com especialista "${especialista.nome}"`);
            }
        });
    }

    private validarIncompatibilidades(skills: Skill[]): void {
        for (let i = 0; i < skills.length; i++) {
            for (let j = i + 1; j < skills.length; j++) {
                const skillA = skills[i];
                const skillB = skills[j];

                if (skillA.incompativelCom?.includes(skillB.id)) {
                    throw new Error(`Conflito: Skills "${skillA.nome}" e "${skillB.nome}" são incompatíveis.`);
                }
                if (skillB.incompativelCom?.includes(skillA.id)) {
                    throw new Error(`Conflito: Skills "${skillB.nome}" e "${skillA.nome}" são incompatíveis.`);
                }
            }
        }
    }

    private validarSkillsObrigatorias(especialista: Especialista, skills: Skill[]): void {
        const skillIds = skills.map(s => s.id);
        especialista.skillsObrigatorias?.forEach(obrigatoria => {
            if (!skillIds.includes(obrigatoria)) {
                throw new Error(`Skill obrigatória ausente: "${obrigatoria}" para especialista "${especialista.nome}"`);
            }
        });
    }

    // ====================================
    // RESOLUÇÃO DE DEPENDÊNCIAS (DAG)
    // ====================================

    private resolverDependencias(skills: Skill[]): Skill[] {
        const grafo = new Map<string, Set<string>>();
        const grauEntrada = new Map<string, number>();
        const skillMap = new Map<string, Skill>();

        // Init
        skills.forEach(skill => {
            skillMap.set(skill.id, skill);
            grafo.set(skill.id, new Set(skill.dependeDe || []));
            grauEntrada.set(skill.id, skill.dependeDe?.length || 0); // Quantos eu dependo
        });

        // Ajuste no grauEntrada: só contar dependências que ESTÃO na lista de skills ativas
        // Se uma skill depende de outra que NÃO está ativa, isso é um erro ou deve ser ignorado?
        // Assumindo erro por integridade.
        skills.forEach(skill => {
            if (skill.dependeDe) {
                skill.dependeDe.forEach(depId => {
                    if (!skillMap.has(depId)) {
                        // Opcional: throw new Error(`Skill ${skill.id} depende de ${depId} que não foi incluída.`);
                        // Por ser MVP, vamos apenas ignorar dependências externas não satisfeitas por enquanto ou lançar erro
                    }
                });
            }
        });

        // Kahn's Algorithm Simplificado
        // Ordenar skills para que dependências venham antes

        // 1. Identificar dependencias dentro do conjunto atual
        const adjList = new Map<string, string[]>(); //quem depende de key
        const inDegree = new Map<string, number>();

        skills.forEach(s => {
            adjList.set(s.id, []);
            inDegree.set(s.id, 0);
        });

        skills.forEach(s => {
            if (s.dependeDe) {
                s.dependeDe.forEach(dependencyId => {
                    // Só nos importamos se a dependência estiver no conjunto de skills sendo construídas
                    if (skillMap.has(dependencyId)) {
                        adjList.get(dependencyId)?.push(s.id);
                        inDegree.set(s.id, (inDegree.get(s.id) || 0) + 1);
                    }
                });
            }
        });

        const queue: string[] = [];
        inDegree.forEach((degree, id) => {
            if (degree === 0) queue.push(id);
        });

        const sorted: Skill[] = [];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            sorted.push(skillMap.get(currentId)!);

            const neighbors = adjList.get(currentId) || [];
            neighbors.forEach(neighborId => {
                inDegree.set(neighborId, (inDegree.get(neighborId)!) - 1);
                if (inDegree.get(neighborId) === 0) {
                    queue.push(neighborId);
                }
            });
        }

        if (sorted.length !== skills.length) {
            throw new Error('Ciclo de dependência detectado entre as skills.');
        }

        // Se skill A depende de B, B vem antes em sorted.
        // O prompt geralmente é construído sequencialmente ou por prioridade?
        // O plano diz "prioridade: number; // 0-100 (Maior vence)".
        // Dependência dita ordem lógica de execução de ação (Search -> Financing).
        // PROMPT: Prioridade dita quem aparece em destaque ou sobrescreve.
        // TOOLS: Namespacing resolve colisão.

        // Vamos retornar sorted para garantir consistência lógica se precisarmos invocar hooks em ordem.
        return sorted;
    }

    // ====================================
    // COMPILAÇÃO
    // ====================================

    private async compilarPrompt(
        especialista: Especialista,
        subtipo: string | undefined,
        skills: Skill[],
        parametrosGlobais: Record<string, any>
    ): Promise<string> {
        let prompt = especialista.systemPromptBase;

        // Subtipo
        if (subtipo) {
            const subtipoConfig = especialista.subtipos.find(s => s.id === subtipo);
            if (subtipoConfig) {
                prompt += `\n\n${subtipoConfig.promptDelta}`;
            }
        }

        // Restrições Globais
        if (especialista.restricoesGlobais?.length) {
            prompt += '\n\n# RESTRIÇÕES CRÍTICAS (GLOBAL)\n';
            especialista.restricoesGlobais.forEach(r => prompt += `- ${r}\n`);
        }

        // Skills - ORDENAÇÃO POR PRIORIDADE para construção do Prompt
        // (A DAG é útil para execução, mas no prompt queremos as mais importantes visíveis ou por último se for Recency bias... 
        // Geralmente "Maior Prioridade" significa "Instrução Predominante". 
        // Se append, ordem importa pouco, mas se override, importa.)
        // Vamos ordenar por prioridade decrescente (mais importantes primeiro ou por último?)
        // Vamos seguir: Mais alta prioridade = processada por último se quisermos que ela "vença" instruções anteriores em LLMs clássicos,
        // mas com "Sections", a ordem visual ajuda. Vamos colocar alta prioridade no topo da seção de Skills.
        const skillsPorPrioridade = [...skills].sort((a, b) => b.prioridade - a.prioridade);

        prompt += '\n\n# HABILIDADES & MÓDULOS ATIVOS\n';

        for (const skill of skillsPorPrioridade) {
            let injection = this.interpolarParametros(
                skill.promptInjection,
                skill.parametrosAtivos || this.getParametrosPadrao(skill)
            );

            if (skill.mergeStrategy === 'OVERRIDE') {
                // Implementação simples de Override: Adiciona aviso de prioridade máxima
                injection = `⚠️ PRIORIDADE MÁXIMA (SOBRESCREVE REGRAS ANTERIORES):\n${injection}`;
            }

            prompt += `\n## [${skill.nome.toUpperCase()}]\n${injection}\n`;
        }

        // Interpolar variáveis globais ({{nomeAgente}}, etc)
        prompt = this.interpolarParametros(prompt, parametrosGlobais);

        return prompt;
    }

    private compilarTools(toolsBase: Tool[], skills: Skill[]): Tool[] {
        const tools = [...toolsBase];

        skills.forEach(skill => {
            skill.tools.forEach(tool => {
                const namespacedTool: Tool = {
                    ...tool,
                    name: `${skill.id.toUpperCase()}__${tool.name}`, // EX: AGENDAMENTO__criar_evento
                    description: `[Módulo: ${skill.nome}] ${(tool as any).description}`
                } as any; // Cast as any to avoid Type definition conflict with @openai/agents
                tools.push(namespacedTool);
            });
        });

        return tools;
    }

    private interpolarParametros(template: string, parametros: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const val = parametros[key];
            if (val !== undefined) {
                return Array.isArray(val) ? val.join(', ') : String(val);
            }
            return match;
        });
    }

    private getParametrosPadrao(skill: Skill): Record<string, any> {
        const padrao: Record<string, any> = {};
        skill.parametros?.forEach(p => {
            if (p.valorPadrao !== undefined) padrao[p.nome] = p.valorPadrao;
        });
        return padrao;
    }
}

export const agentBuilder = new AgentBuilder();
