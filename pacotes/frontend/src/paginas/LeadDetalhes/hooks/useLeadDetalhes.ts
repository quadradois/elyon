/**
 * Hook para gerenciar estado e dados do Lead
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../servicos/api';
import { toast } from 'sonner';
import type { Lead, FormEditar, FormPerdido, FormCaptado, FormAtividade } from '../tipos';

interface UseLeadDetalhesReturn {
    // Estado
    lead: Lead | null;
    carregando: boolean;
    erro: string | null;
    salvando: boolean;

    // Formulários
    formEditar: FormEditar;
    setFormEditar: React.Dispatch<React.SetStateAction<FormEditar>>;
    formPerdido: FormPerdido;
    setFormPerdido: React.Dispatch<React.SetStateAction<FormPerdido>>;
    formCaptado: FormCaptado;
    setFormCaptado: React.Dispatch<React.SetStateAction<FormCaptado>>;
    formAtividade: FormAtividade;
    setFormAtividade: React.Dispatch<React.SetStateAction<FormAtividade>>;

    // Ações
    carregarLead: () => Promise<void>;
    salvarEdicao: () => Promise<boolean>;
    marcarPerdido: () => Promise<boolean>;
    marcarCaptado: () => Promise<boolean>;
    arquivar: () => Promise<boolean | { requiresConfirmation: true; dadosVinculados: any; mensagem: string }>;
    excluirComConfirmacao: () => Promise<boolean>;
    reativar: () => Promise<boolean>;
    criarAtividade: () => Promise<boolean>;
    acaoAtividade: (atividadeId: string, acao: string) => Promise<boolean>;

    // Navegação
    voltar: () => void;

    // Helpers
    copiarTelefone: () => void;
    isPerdidoOuArquivado: boolean;
    isCaptado: boolean;
}

export function useLeadDetalhes(): UseLeadDetalhesReturn {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Estado principal
    const [lead, setLead] = useState<Lead | null>(null);
    const commandRequestIds = useRef(new Map<string, string>());
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    // Formulários
    const [formEditar, setFormEditar] = useState<FormEditar>({});
    const [formPerdido, setFormPerdido] = useState<FormPerdido>({ motivo: '', observacoes: '' });
    const [formCaptado, setFormCaptado] = useState<FormCaptado>({ tipoContrato: '', valorContrato: '', observacoes: '' });
    const [formAtividade, setFormAtividade] = useState<FormAtividade>({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '' });

    // ============================================
    // CARREGAR LEAD
    // ============================================

    const carregarLead = useCallback(async () => {
        if (!id) return;

        try {
            setCarregando(true);
            setErro(null);
            const response = await api.get(`/leads/${id}`);
            const data = response.data;

            setLead(data);

            // Preencher form de edição com dados atuais
            setFormEditar({
                nome: data.nome,
                telefone: data.telefone,
                email: data.email,
                cpf: data.cpf,
                enderecoPrincipal: data.enderecoPrincipal,
                complementoPrincipal: data.complementoPrincipal,
                temperatura: data.temperatura,
                enderecoImovel: data.imovel?.endereco,
                tipoImovel: data.imovel?.tipo,
                valorPretendido: data.imovel?.valorPretendido,
                inscricaoIptu: data.inscricaoIptu,
                // Novos campos do playbook
                situacaoFinanceira: data.situacaoFinanceira,
                temDividas: data.temDividas,
                estadoConservacao: data.estadoConservacao,
                comissaoAcordada: data.comissaoAcordada,
                tipoAutorizacao: data.tipoAutorizacao,
                prazoTrabalho: data.prazoTrabalho,
                autorizouAnuncio: data.autorizouAnuncio,
            });
        } catch (error: any) {
            console.error('Erro ao carregar lead:', error);
            setErro(error.response?.data?.erro || 'Erro ao carregar dados do lead');
            toast.error('Erro ao carregar lead');
        } finally {
            setCarregando(false);
        }
    }, [id]);

    useEffect(() => {
        carregarLead();
    }, [carregarLead]);

    // ============================================
    // AÇÕES
    // ============================================

    const salvarEdicao = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.patch(`/leads/${id}`, formEditar);
            toast.success('Lead atualizado com sucesso!');
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao atualizar lead');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const marcarPerdido = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.post(`/leads/${id}/perder`, formPerdido);
            toast.success('Lead marcado como perdido');
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao marcar como perdido');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const marcarCaptado = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.post(`/leads/${id}/captar`, formCaptado);
            toast.success('🎉 Parabéns! Imóvel captado com sucesso!');
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao registrar captação');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const arquivar = async (): Promise<boolean | { requiresConfirmation: true; dadosVinculados: any; mensagem: string }> => {
        try {
            setSalvando(true);
            await api.delete(`/leads/${id}`);
            toast.success('Lead excluído permanentemente');
            navigate('/dashboard/proprietarios');
            return true;
        } catch (error: any) {
            // Verificar se precisa de confirmação
            if (error.response?.data?.requiresConfirmation) {
                return {
                    requiresConfirmation: true,
                    dadosVinculados: error.response.data.dadosVinculados,
                    mensagem: error.response.data.mensagem
                };
            }
            toast.error(error.response?.data?.erro || 'Erro ao excluir');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const excluirComConfirmacao = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.delete(`/leads/${id}`, { data: { confirmacao: 'excluir' } });
            toast.success('Lead e todos os dados vinculados excluídos permanentemente');
            navigate('/dashboard/proprietarios');
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao excluir');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const reativar = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.post(`/leads/${id}/reativar`, { temperatura: 'MORNO' });
            toast.success('Lead reativado!');
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao reativar');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const criarAtividade = async (): Promise<boolean> => {
        try {
            setSalvando(true);
            await api.post(`/leads/${id}/atividades`, formAtividade);
            toast.success('Atividade criada!');
            setFormAtividade({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '' });
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao criar atividade');
            return false;
        } finally {
            setSalvando(false);
        }
    };

    const acaoAtividade = async (atividadeId: string, acao: string): Promise<boolean> => {
        try {
            const atividadeAtual = lead?.atividades?.find((item: any) => item.id === atividadeId)
                || (lead?.proximaAtividade?.id === atividadeId ? lead.proximaAtividade : null);
            const payload: Record<string, unknown> = { acao };
            if (['cancelar', 'reagendar', 'nao_compareceu'].includes(acao)) {
                payload.expectedVersion = atividadeAtual?.versao ?? 0;
                const key = `${atividadeId}:${payload.expectedVersion}:${acao}`;
                const existing = commandRequestIds.current.get(key);
                payload.requestId = existing || crypto.randomUUID();
                commandRequestIds.current.set(key, payload.requestId as string);
            }
            await api.patch(`/leads/${id}/atividades/${atividadeId}`, payload);
            toast.success('Atividade atualizada');
            await carregarLead();
            return true;
        } catch (error: any) {
            toast.error('Erro ao atualizar atividade');
            return false;
        }
    };

    // ============================================
    // HELPERS
    // ============================================

    const voltar = () => navigate('/dashboard/proprietarios');

    const copiarTelefone = () => {
        if (lead?.telefone) {
            navigator.clipboard.writeText(lead.telefone);
            toast.success('Telefone copiado!');
        }
    };

    const isPerdidoOuArquivado = lead?.status === 'PERDIDO' || lead?.status === 'ARQUIVADO';
    const isCaptado = lead?.status === 'CAPTADO' || lead?.status === 'CONVERTIDO';

    return {
        lead,
        carregando,
        erro,
        salvando,
        formEditar,
        setFormEditar,
        formPerdido,
        setFormPerdido,
        formCaptado,
        setFormCaptado,
        formAtividade,
        setFormAtividade,
        carregarLead,
        salvarEdicao,
        marcarPerdido,
        marcarCaptado,
        arquivar,
        excluirComConfirmacao,
        reativar,
        criarAtividade,
        acaoAtividade,
        voltar,
        copiarTelefone,
        isPerdidoOuArquivado,
        isCaptado,
    };
}
