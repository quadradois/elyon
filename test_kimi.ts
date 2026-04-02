import { OpenAI } from 'openai';
import { Agent, run } from '@openai/agents';
import { OpenAIResponsesModel } from '@openai/agents-openai';
import { converterParaLeadTool } from './src/ferramentas/sdr-tools-agents';

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { descriptografar } = require('./src/lib/crypto');
  
  const t = await prisma.tenant.findUnique({ where: { slug: 'quadradois' } });
  
  if (!t.llmApiKeyCriptografada) {
    console.log("Sem key");
    process.exit(1);
  }
  
  const key = descriptografar(t.llmApiKeyCriptografada);
  console.log("Usando provider:", t.llmProvedor, "Model:", t.llmModelo);
  
  const client = new OpenAI({
    apiKey: key,
    baseURL: t.llmBaseUrl || 'https://openrouter.ai/api/v1',
  });
  
  const model = new OpenAIResponsesModel(client, t.llmModelo || 'moonshotai/kimi-k2-0905:exacto');
  
  const agent = new Agent({
    name: 'test_agent',
    model,
    instructions: `Você é um corretor. O lead falou que o apartamento tem 59m² e tem interesse em vender.
    
    # 📦 SALVANDO DADOS NO LEAD (OBRIGATÓRIO!)

Quando chamar converter_para_lead ou qualificar_lead, passe TODOS os dados que coletou:
- tipoImovel (apartamento, casa, terreno)
- quartosImovel (número)
- areaImovel ("54m²", "100m²")
- valorPretendido ("R$ 650.000")
- ocupacaoImovel ("vazio", "ocupado", "alugado")
- motivacaoVenda ("mudança de cidade")
- situacaoAtual ("imóvel vazio há 6 meses")
- doresIdentificadas (array: ["sem visitantes", "pagando condomínio"])

Para converter o lead, CHAME a ferramenta AGORA MESMO.`,
    tools: [converterParaLeadTool]
  });

  try {
    const response = await run(agent, [
        { role: 'user', content: 'sim eu tenho interesse em vender meu apartamento, mas não sei como é o processo!' },
        { role: 'assistant', content: 'Show! Qual é a metragem do seu? Tem 54m² ou 59m²?' },
        { role: 'user', content: 'ele tem 59' },
    ]);
    console.log("RESULTADO RAW:");
    console.log(response);
  } catch (error) {
    console.error("ERRO NO AGENT:", error);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
