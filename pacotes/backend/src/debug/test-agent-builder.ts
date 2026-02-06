
import { agentBuilder } from '../servicos/agent-builder';
import { AgenteConfiguracao } from '../agentes/types';

async function testBuilder() {
    console.log('🏁 Iniciando teste do AgentBuilder...');

    const mockConfig: AgenteConfiguracao = {
        id: 'test-agent-sales',
        tenantId: 'tenant-debug',
        especialista: 'SALES',
        subtipo: 'LANCAMENTO',
        skills: [
            { id: 'PERFIL_COMPRADOR', versao: '1.0.0' },
            {
                id: 'AGENDAMENTO',
                versao: '1.0.0',
                parametros: {
                    horarioInicio: '09:00',
                    horarioFim: '19:00',
                    diasDisponiveis: ['Sábado', 'Domingo']
                }
            },
            { id: 'RAG_SEARCH', versao: '1.0.0' }
        ],
        parametrosGlobais: {
            nomeAgente: 'Carlos',
            nomeEmpresa: 'Incorporadora Elite',
            cidade: 'Rio de Janeiro'
        },
        versaoConfig: 1
    };

    try {
        const agent = await agentBuilder.build(mockConfig);

        console.log('\n✅ Agente construído com sucesso!');
        console.log('🆔 ID:', agent.id);
        console.log('🤖 System Prompt Preview:\n');
        console.log(agent.systemPrompt.substring(0, 500) + '...');
        console.log('\n🛠️ Tools:', agent.tools.map(t => t.name));
        console.log('📚 Skills Ativas:', agent.metadata.skillsAtivas);

    } catch (error) {
        console.error('❌ Erro no build:', error);
    }
}

testBuilder();
