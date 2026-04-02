import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Card, CardContent } from "../componentes/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../componentes/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import {
    Search,
    MoreHorizontal,
    Phone,
    MessageSquare,
    Loader2,
    AlertCircle,
    Eye,
    RefreshCw,
    Briefcase,
    ExternalLink,
} from "lucide-react";
import { ChatModal } from "../componentes/ChatModal";
import { api } from "../servicos/api";

// Tipos
interface Cliente {
    id: string;
    // Dados Pessoais
    nome: string;
    telefone: string | null;
    email: string | null;
    cpf: string | null;
    endereco: string | null;

    // Status
    status: string;
    origemLeadId: string | null;

    // Metadados
    criadoEm: string;
    atualizadoEm: string;

    // Relacionamento Lead (opcional, para exibir contrato)
    lead?: {
        contratoUrl?: string | null;
        dataAssinatura?: string | null;
        origem?: string;
    }
}

// Helpers
function formatarData(data: string | null): string {
    if (!data) return "-";
    return new Date(data).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    });
}

export function CarteiraClientes() {
    const navigate = useNavigate();

    // States
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [termoBusca, setTermoBusca] = useState("");

    // Modal
    const [chatOpen, setChatOpen] = useState(false);
    const [activeLead, setActiveLead] = useState<{ id: string, nome: string, telefone: string | null } | null>(null);

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            setLoading(true);
            setErro("");

            const res = await api.get("/clientes");
            setClientes(res.data);
        } catch (error) {
            console.error("Erro ao carregar clientes:", error);
            setErro("Não foi possível carregar sua carteira.");
        } finally {
            setLoading(false);
        }
    };

    const clientesFiltrados = clientes.filter((c) => {
        const nome = c.nome || "";
        const telefone = c.telefone || "";
        const email = c.email || "";

        return termoBusca === "" ||
            nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
            telefone.includes(termoBusca) ||
            email.toLowerCase().includes(termoBusca.toLowerCase());
    });



    const handleAbrirChat = (cliente: Cliente) => {
        setActiveLead({
            id: cliente.origemLeadId || cliente.id, // Fallback safe
            nome: cliente.nome,
            telefone: cliente.telefone
        });
        setChatOpen(true);
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-indigo-600" />
                        Minha Carteira
                    </h1>
                    <p className="text-slate-500">
                        Gestão dos seus clientes proprietários ativos e contratos vigentes.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={carregarDados}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Stats Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total na Carteira</p>
                            <p className="text-2xl font-bold text-slate-900">{clientes.length}</p>
                        </div>
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <Briefcase className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Busca */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar cliente por nome..."
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            className="pl-10 max-w-md"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Erro */}
            {erro && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {erro}
                </div>
            )}

            {/* Tabela */}
            <Card>
                {loading ? (
                    <CardContent className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </CardContent>
                ) : clientesFiltrados.length === 0 ? (
                    <CardContent className="p-12 flex flex-col items-center justify-center">
                        <div className="bg-indigo-50 p-4 rounded-full mb-4">
                            <Briefcase className="h-8 w-8 text-indigo-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum cliente na carteira
                        </h3>
                        <p className="text-gray-500 mb-4 text-center max-w-sm">
                            Os leads que você marcar como "Captado" no funil de vendas aparecerão aqui automaticamente.
                        </p>
                        <Button variant="outline" onClick={() => navigate('/dashboard/leads')}>
                            Ir para Funil de Captação
                        </Button>
                    </CardContent>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Data Captação</TableHead>
                                    <TableHead>Contrato</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clientesFiltrados.map((cliente) => (
                                    <TableRow
                                        key={cliente.id}
                                        className="cursor-pointer hover:bg-gray-50"
                                        onClick={() => navigate(`/dashboard/leads/${cliente.origemLeadId || cliente.id}`)}
                                    >
                                        <TableCell>
                                            <div className="font-medium text-slate-900">{cliente.nome || "Sem Nome"}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                Captado via {cliente.lead?.origem || "Manual"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {cliente.telefone && (
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                        <Phone className="h-3 w-3" />
                                                        {cliente.telefone}
                                                    </div>
                                                )}
                                                {cliente.email && (
                                                    <div className="text-xs text-gray-400 truncate max-w-[180px]">
                                                        {cliente.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-gray-600 font-medium">
                                                {formatarData(cliente.lead?.dataAssinatura || cliente.criadoEm)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {cliente.lead?.contratoUrl ? (
                                                <a
                                                    href={cliente.lead.contratoUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Abrir PDF
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-400">Pendente</span>
                                            )}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/dashboard/leads/${cliente.origemLeadId || cliente.id}`)}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Ver ficha completa
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleAbrirChat(cliente)}>
                                                        <MessageSquare className="h-4 w-4 mr-2" />
                                                        Abrir chat
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Footer da tabela */}
                        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Mostrando {clientesFiltrados.length} clientes ativos
                            </p>
                        </div>
                    </>
                )}
            </Card>

            <ChatModal
                lead={activeLead}
                open={chatOpen}
                onOpenChange={setChatOpen}
            />
        </div>
    );
}
