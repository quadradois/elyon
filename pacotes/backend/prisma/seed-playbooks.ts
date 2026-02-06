/**
 * Seed de Playbooks de Exemplo
 * 
 * Execute com: npx ts-node prisma/seed-playbooks.ts
 * 
 * Cria 3 playbooks completos:
 * 1. Qualificação Venda Residencial
 * 2. Captação de Imóveis
 * 3. Qualificação Locação
 */

import { PrismaClient, TipoPlaybook, TipoItemPlaybook } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlaybooks() {
    console.log('🌱 Iniciando seed de playbooks...');

    // Buscar primeiro tenant (para desenvolvimento)
    const tenant = await prisma.tenant.findFirst();

    if (!tenant) {
        console.error('❌ Nenhum tenant encontrado. Crie um tenant primeiro.');
        return;
    }

    console.log(`📍 Usando tenant: ${tenant.nome} (${tenant.id})`);

    // ============================================
    // PLAYBOOK 1: Qualificação Venda Residencial
    // ============================================
    const playbookVenda = await prisma.playbook.upsert({
        where: {
            nome_tenantId: {
                nome: 'Qualificação Venda Residencial',
                tenantId: tenant.id
            }
        },
        update: {},
        create: {
            tenantId: tenant.id,
            nome: 'Qualificação Venda Residencial',
            descricao: 'Playbook padrão para qualificação de leads interessados em comprar imóveis residenciais',
            tipo: 'QUALIFICACAO',
            ePadrao: true,
            etapas: {
                create: [
                    {
                        nome: 'Abertura',
                        descricao: 'Primeiro contato e aquecimento',
                        icone: '👋',
                        ordem: 0,
                        scriptTexto: 'Olá! Que bom falar com você. Vi que você tem interesse em imóveis. Posso te ajudar a encontrar o imóvel ideal?',
                        itens: {
                            create: [
                                {
                                    texto: 'Se apresentou',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 5,
                                    ordem: 0
                                },
                                {
                                    texto: 'Confirmou interesse do lead',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 1
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Agora não é um bom momento',
                                    respostaTexto: 'Entendo perfeitamente! Posso te enviar algumas opções por WhatsApp para você analisar com calma. Qual tipo de imóvel te interessa mais?',
                                    ordem: 0
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Descoberta',
                        descricao: 'Entender necessidades do cliente',
                        icone: '🔍',
                        ordem: 1,
                        scriptTexto: 'Para te ajudar melhor, preciso entender algumas coisas sobre o que você busca...',
                        itens: {
                            create: [
                                {
                                    texto: 'Região de interesse',
                                    tipoItem: 'TEXTO',
                                    placeholder: 'Ex: Setor Bueno, Marista',
                                    obrigatorio: true,
                                    scorePontos: 15,
                                    atualizaCampo: 'localizacaoDesejada',
                                    aiExtrairPadrao: 'região|bairro|setor|cidade',
                                    aiPreencherAuto: true,
                                    ordem: 0
                                },
                                {
                                    texto: 'Número de quartos',
                                    tipoItem: 'SELECT',
                                    opcoes: ['1 quarto', '2 quartos', '3 quartos', '4+ quartos'],
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 1
                                },
                                {
                                    texto: 'Precisa de vaga de garagem?',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 5,
                                    ordem: 2
                                },
                                {
                                    texto: 'Aceita financiamento?',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 10,
                                    ordem: 3
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Ainda estou só pesquisando',
                                    respostaTexto: 'Ótimo! Pesquisar bem é muito importante. Posso te mandar opções interessantes para você ir criando sua lista de favoritos. Qual faixa de valor você está considerando?',
                                    ordem: 0
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Qualificação Financeira',
                        descricao: 'Entender capacidade de pagamento',
                        icone: '💰',
                        ordem: 2,
                        scriptTexto: 'Agora uma pergunta importante para encontrar as melhores opções pra você...',
                        itens: {
                            create: [
                                {
                                    texto: 'Faixa de investimento',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Até R$ 300 mil', 'R$ 300 - 500 mil', 'R$ 500 - 800 mil', 'Acima de R$ 800 mil'],
                                    obrigatorio: true,
                                    scorePontos: 20,
                                    ordem: 0
                                },
                                {
                                    texto: 'Forma de pagamento',
                                    tipoItem: 'SELECT',
                                    opcoes: ['À vista', 'Financiamento', 'FGTS + Financiamento', 'Permuta'],
                                    obrigatorio: true,
                                    scorePontos: 15,
                                    ordem: 1
                                },
                                {
                                    texto: 'Já foi pré-aprovado no banco?',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 20,
                                    ordem: 2
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Não sei se consigo financiamento',
                                    respostaTexto: 'Posso te ajudar com isso! Temos parceria com correspondentes bancários que fazem simulação gratuita em vários bancos. Quer que eu passe o contato?',
                                    ordem: 0
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Agendamento',
                        descricao: 'Converter em visita',
                        icone: '📅',
                        ordem: 3,
                        scriptTexto: 'Tenho algumas opções incríveis que combinam com o que você busca! Qual o melhor dia para visitarmos?',
                        itens: {
                            create: [
                                {
                                    texto: 'Visita agendada',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 30,
                                    ordem: 0
                                },
                                {
                                    texto: 'Data/hora da visita',
                                    tipoItem: 'DATA',
                                    obrigatorio: false,
                                    scorePontos: 0,
                                    ordem: 1
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Preciso falar com minha esposa/marido',
                                    respostaTexto: 'Claro! Seria ótimo se vocês pudessem ir juntos na visita. Assim vocês já decidem ali. Qual horário seria bom para os dois?',
                                    ordem: 0
                                }
                            ]
                        }
                    }
                ]
            }
        }
    });

    console.log(`✅ Playbook criado: ${playbookVenda.nome}`);

    // ============================================
    // PLAYBOOK 2: Captação de Imóveis
    // ============================================
    const playbookCaptacao = await prisma.playbook.upsert({
        where: {
            nome_tenantId: {
                nome: 'Captação de Imóveis',
                tenantId: tenant.id
            }
        },
        update: {},
        create: {
            tenantId: tenant.id,
            nome: 'Captação de Imóveis',
            descricao: 'Playbook para captar imóveis de proprietários para venda ou locação',
            tipo: 'CAPTACAO',
            etapas: {
                create: [
                    {
                        nome: 'Contato Inicial',
                        descricao: 'Primeiro contato com proprietário',
                        icone: '📞',
                        ordem: 0,
                        scriptTexto: 'Olá! Sou corretor da [Imobiliária]. Vi que você tem um imóvel na região e nossa carteira de clientes está buscando algo assim. Posso saber mais sobre o imóvel?',
                        itens: {
                            create: [
                                {
                                    texto: 'Proprietário confirmou interesse',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 20,
                                    ordem: 0
                                },
                                {
                                    texto: 'Tipo de imóvel',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Casa', 'Apartamento', 'Terreno', 'Comercial', 'Rural'],
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 1
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Avaliação',
                        descricao: 'Coletar dados do imóvel',
                        icone: '📋',
                        ordem: 1,
                        scriptTexto: 'Vou precisar de algumas informações para fazer uma avaliação de mercado gratuita...',
                        itens: {
                            create: [
                                {
                                    texto: 'Endereço completo',
                                    tipoItem: 'TEXTO',
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 0
                                },
                                {
                                    texto: 'Área construída (m²)',
                                    tipoItem: 'NUMERO',
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 1
                                },
                                {
                                    texto: 'Número de quartos',
                                    tipoItem: 'NUMERO',
                                    obrigatorio: true,
                                    scorePontos: 5,
                                    ordem: 2
                                },
                                {
                                    texto: 'Valor pretendido',
                                    tipoItem: 'NUMERO',
                                    obrigatorio: false,
                                    scorePontos: 15,
                                    ordem: 3
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Apresentação',
                        descricao: 'Apresentar proposta de captação',
                        icone: '🤝',
                        ordem: 2,
                        scriptTexto: 'Fiz uma análise de mercado e o valor justo seria [X]. Trabalhamos com exclusividade por 90 dias para garantir a melhor divulgação.',
                        itens: {
                            create: [
                                {
                                    texto: 'Proprietário aceitou visita para fotos',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 20,
                                    ordem: 0
                                },
                                {
                                    texto: 'Valor acordado',
                                    tipoItem: 'NUMERO',
                                    scorePontos: 10,
                                    ordem: 1
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Outra imobiliária ofereceu comissão menor',
                                    respostaTexto: 'Entendo! Mas nossa estratégia de marketing e carteira de clientes fazem o imóvel vender mais rápido, compensando a comissão. Posso te mostrar nossos cases de sucesso?',
                                    ordem: 0
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Fechamento',
                        descricao: 'Assinatura do contrato',
                        icone: '✍️',
                        ordem: 3,
                        scriptTexto: 'Ótimo! Vou preparar o contrato de autorização. Posso enviar por WhatsApp para assinatura digital?',
                        itens: {
                            create: [
                                {
                                    texto: 'Contrato de captação assinado',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 30,
                                    ordem: 0
                                }
                            ]
                        }
                    }
                ]
            }
        }
    });

    console.log(`✅ Playbook criado: ${playbookCaptacao.nome}`);

    // ============================================
    // PLAYBOOK 3: Qualificação Locação
    // ============================================
    const playbookLocacao = await prisma.playbook.upsert({
        where: {
            nome_tenantId: {
                nome: 'Qualificação Locação',
                tenantId: tenant.id
            }
        },
        update: {},
        create: {
            tenantId: tenant.id,
            nome: 'Qualificação Locação',
            descricao: 'Playbook para qualificar interessados em alugar imóveis',
            tipo: 'QUALIFICACAO',
            etapas: {
                create: [
                    {
                        nome: 'Perfil do Inquilino',
                        descricao: 'Entender necessidades de locação',
                        icone: '👤',
                        ordem: 0,
                        scriptTexto: 'Olá! Para te ajudar a encontrar o imóvel ideal para alugar, preciso entender algumas coisas...',
                        itens: {
                            create: [
                                {
                                    texto: 'Região de interesse',
                                    tipoItem: 'TEXTO',
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 0
                                },
                                {
                                    texto: 'Tipo de imóvel',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Apartamento', 'Casa', 'Kitnet/Studio', 'Comercial'],
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 1
                                },
                                {
                                    texto: 'Aceita pet?',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 5,
                                    ordem: 2
                                },
                                {
                                    texto: 'Urgência de mudança',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Imediato', '30 dias', '60 dias', 'Sem pressa'],
                                    obrigatorio: true,
                                    scorePontos: 10,
                                    ordem: 3
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Análise Financeira',
                        descricao: 'Verificar capacidade de pagamento',
                        icone: '💳',
                        ordem: 1,
                        scriptTexto: 'Agora preciso entender sobre a parte financeira para te apresentar as melhores opções...',
                        itens: {
                            create: [
                                {
                                    texto: 'Faixa de aluguel',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Até R$ 1.500', 'R$ 1.500 - 2.500', 'R$ 2.500 - 4.000', 'Acima de R$ 4.000'],
                                    obrigatorio: true,
                                    scorePontos: 15,
                                    ordem: 0
                                },
                                {
                                    texto: 'Possui comprovante de renda?',
                                    tipoItem: 'CHECKBOX',
                                    scorePontos: 20,
                                    ordem: 1
                                },
                                {
                                    texto: 'Garantia disponível',
                                    tipoItem: 'SELECT',
                                    opcoes: ['Fiador', 'Seguro Fiança', 'Caução', 'Título de Capitalização'],
                                    obrigatorio: true,
                                    scorePontos: 20,
                                    ordem: 2
                                }
                            ]
                        },
                        objecoes: {
                            create: [
                                {
                                    objecaoTexto: 'Não tenho fiador',
                                    respostaTexto: 'Sem problemas! Trabalhamos com Seguro Fiança, que é prático e rápido. O valor é cerca de 1,5x o aluguel anual, parcelável em até 12x. Posso simular para você?',
                                    ordem: 0
                                }
                            ]
                        }
                    },
                    {
                        nome: 'Agendamento de Visita',
                        descricao: 'Converter em visita ao imóvel',
                        icone: '🏠',
                        ordem: 2,
                        scriptTexto: 'Encontrei [X] opções que combinam com o que você busca! Vamos agendar visitas?',
                        itens: {
                            create: [
                                {
                                    texto: 'Visita agendada',
                                    tipoItem: 'CHECKBOX',
                                    obrigatorio: true,
                                    scorePontos: 25,
                                    ordem: 0
                                }
                            ]
                        }
                    }
                ]
            }
        }
    });

    console.log(`✅ Playbook criado: ${playbookLocacao.nome}`);

    // Resumo
    const total = await prisma.playbook.count({
        where: { tenantId: tenant.id }
    });

    console.log(`\n🎉 Seed concluído! Total de playbooks: ${total}`);
}

seedPlaybooks()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
