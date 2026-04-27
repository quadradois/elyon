import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, Home, Activity, FileText, Briefcase, UserPlus } from 'lucide-react';
import { Button } from '../../componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../componentes/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../componentes/ui/tabs';
import { CardImovel, CardNegociacao, CardContrato, CardProprietario } from '../LeadDetalhes/componentes';
import { useProprietarioDetalhes } from './hooks/useProprietarioDetalhes';
import { api } from '../../servicos/api';
import { toast } from 'sonner';

const limparTexto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.toLowerCase() === '[object object]') return null;
  return texto;
};

export default function ProprietarioDetalhes() {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useProprietarioDetalhes();
  const [convertendo, setConvertendo] = useState(false);

  const nome = dados?.contato?.nome || dados?.lead?.nome || 'Proprietário';
  const campanha = dados?.campanha;
  const lead = dados?.lead;
  const contato = dados?.contato;
  const temLeadReal = !!lead;

  const leadVisual = useMemo(() => {
    if (lead) return lead;
    if (!contato) return null;

    return {
      id: contato.id,
      nome: contato.nome,
      telefone: limparTexto(contato.telefone),
      telefone2: limparTexto(contato.telefone2),
      telefone3: limparTexto(contato.telefone3),
      email: limparTexto(contato.email),
      email2: limparTexto(contato.email2),
      cpf: limparTexto(contato.cpf),
      idade: contato.idade,
      sexo: limparTexto(contato.sexo),
      rendaEstimada: limparTexto(contato.rendaEstimada),
      faixaSalarial: limparTexto(contato.faixaSalarial),
      scoreAssertiva: contato.scoreAssertiva,
      empresaAtual: limparTexto(contato.empresaAtual),
      profissao: limparTexto(contato.profissao),
      setor: limparTexto(contato.setor),
      cnpjEmpresa: limparTexto(contato.cnpjEmpresa),
      enderecoImovel: limparTexto(contato.enderecoImovel),
      tipoImovel: limparTexto(contato.tipoImovel),
      nomeEdificio: limparTexto(contato.nomeEdificio),
      bairroImovel: limparTexto(contato.bairroImovel),
      inscricaoIptu: limparTexto(contato.inscricaoIptu),
      valorVenal: limparTexto(contato.valorVenal),
      imovel: {
        endereco: limparTexto(contato.enderecoImovel),
        tipo: limparTexto(contato.tipoImovel),
        area: limparTexto(contato.areaConstruida),
        quartos: null,
        vagas: null,
        valorPretendido: null,
        ocupacao: null,
        interesseEm: null
      },
      status: 'NOVO'
    };
  }, [lead, contato]);

  const mostrarConversao = useMemo(() => {
    return contato?.statusProspeccao === 'INTERESSADO' && !contato?.virouLead;
  }, [contato]);

  const converterParaLead = async () => {
    if (!contato?.id || convertendo) return;
    try {
      setConvertendo(true);
      await api.post('/leads', { contatoId: contato.id });
      toast.success('Proprietário convertido para lead');
      await recarregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao converter para lead');
    } finally {
      setConvertendo(false);
    }
  };

  if (carregando) {
    return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  }

  if (erro || !dados) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/proprietarios')}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
        <Card><CardContent className="p-6 text-sm text-red-600">{erro || 'Proprietário não encontrado'}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" className="-ml-3" onClick={() => navigate('/dashboard/proprietarios')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar para Proprietários
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{nome}</h1>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">{dados.estagio}</span>
            {campanha?.id && (
              <button className="text-brand hover:underline" onClick={() => navigate(`/dashboard/campanhas/${campanha.id}`)}>
                {campanha.nome}
              </button>
            )}
          </div>
        </div>
        {mostrarConversao && (
          <Button onClick={converterParaLead} disabled={convertendo}>
            {convertendo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Converter para Lead
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Tabs defaultValue="prospeccao" className="w-full">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="prospeccao"><MessageSquare className="w-4 h-4 mr-1" />Prospecção</TabsTrigger>
              <TabsTrigger value="imovel"><Home className="w-4 h-4 mr-1" />Imóvel</TabsTrigger>
              <TabsTrigger value="qualificacao"><Briefcase className="w-4 h-4 mr-1" />Qualificação</TabsTrigger>
              <TabsTrigger value="negociacao">Negociação</TabsTrigger>
              <TabsTrigger value="contrato"><FileText className="w-4 h-4 mr-1" />Contrato</TabsTrigger>
              <TabsTrigger value="atividades"><Activity className="w-4 h-4 mr-1" />Atividades</TabsTrigger>
            </TabsList>

            <TabsContent value="prospeccao">
              <Card>
                <CardHeader><CardTitle>Histórico de Mensagens</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[50vh] overflow-auto">
                  {(dados.mensagensProspecao || []).map((m: any) => (
                    <div key={m.id} className={`rounded-lg p-3 border ${m.direcao === 'SAIDA' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                      <p className="text-xs text-slate-500 mb-1">{m.direcao === 'SAIDA' ? 'Saída' : 'Entrada'} · {new Date(m.dataHora).toLocaleString('pt-BR')}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
                    </div>
                  ))}
                  {(dados.mensagensProspecao || []).length === 0 && <p className="text-sm text-slate-500">Sem mensagens de prospecção.</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="imovel">
              {leadVisual ? (
                <CardImovel
                  lead={leadVisual as any}
                  isPerdidoOuArquivado={true}
                  isCaptado={false}
                  onEditar={() => {}}
                />
              ) : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="qualificacao">
              {leadVisual ? <CardProprietario lead={leadVisual as any} /> : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="negociacao">
              {temLeadReal ? <CardNegociacao lead={lead as any} /> : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="contrato">
              {temLeadReal ? <CardContrato lead={lead as any} onUpdate={recarregar} /> : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>}
            </TabsContent>

            <TabsContent value="atividades">
              <Card>
                <CardHeader><CardTitle>Atividades</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(dados.atividades || []).map((a: any) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-semibold">{a.titulo || a.tipo}</p>
                      <p className="text-xs text-slate-500">{a.descricao || 'Sem descrição'}</p>
                    </div>
                  ))}
                  {(dados.atividades || []).length === 0 && <p className="text-sm text-slate-500">Sem atividades registradas.</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Dados do Proprietário</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Nome:</strong> {nome}</p>
              <p><strong>CPF:</strong> {limparTexto(contato?.cpf) ? `***.***.***-${String(contato?.cpf).slice(-2)}` : '-'}</p>
              <p><strong>Telefone:</strong> {limparTexto(contato?.telefone) || limparTexto(lead?.telefone) || '-'}</p>
              <p><strong>Email:</strong> {limparTexto(contato?.email) || limparTexto(lead?.email) || '-'}</p>
              <p><strong>Faixa salarial:</strong> {limparTexto(contato?.faixaSalarial) || limparTexto(lead?.faixaSalarial) || '-'}</p>
              <p><strong>Empresa:</strong> {limparTexto(contato?.empresaAtual) || limparTexto(lead?.empresaAtual) || '-'}</p>
              <p><strong>IPTU:</strong> {limparTexto(contato?.inscricaoIptu) || limparTexto(lead?.inscricaoIptu) || '-'}</p>
              <p><strong>Endereço imóvel:</strong> {limparTexto(contato?.enderecoImovel) || limparTexto(lead?.enderecoImovel) || '-'}</p>
              <p><strong>Valor venal:</strong> {limparTexto(contato?.valorVenal) || limparTexto(lead?.valorVenal) || '-'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
