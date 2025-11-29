import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../componentes/ui/table";
import {
  Search,
  Building2,
  MapPin,
  CheckSquare,
  Square,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";

interface ImovelResultado {
  nrinscr: string;
  nmedificio: string;
  incompl: string;
  nmlogradou: string;
  nmbairro: string;
}

import { ModalProcessamento } from "../componentes/ModalProcessamento";

export function Mineracao() {
  // Debug log to verify module loading
  useEffect(() => {
    console.log("Módulo Mineração carregado");
  }, []);

  const [termo, setTermo] = useState("");
  const [bairro, setBairro] = useState("");
  const [iptu, setIptu] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ImovelResultado[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  // Carregar resultados salvos ao iniciar
  useEffect(() => {
    const salvos = localStorage.getItem("mineracao_resultados");
    if (salvos) {
      try {
        setResultados(JSON.parse(salvos));
      } catch (e) {
        console.error("Erro ao carregar cache local", e);
      }
    }
  }, []);

  // Salvar resultados sempre que mudarem
  useEffect(() => {
    if (resultados.length > 0) {
      localStorage.setItem("mineracao_resultados", JSON.stringify(resultados));
    }
  }, [resultados]);

  const handleLimparBusca = () => {
    setResultados([]);
    setSelecionados([]);
    setTermo("");
    setBairro("");
    setIptu("");
    localStorage.removeItem("mineracao_resultados");
  };

  const handleBusca = async () => {
    if (!termo && !bairro && !iptu) return;
    setLoading(true);
    setErro("");
    setResultados([]);

    try {
      const response = await api.post("/mineracao/buscar", {
        nmedificio: termo,
        nmbairro: bairro,
        nrinscr: iptu,
      });

      if (Array.isArray(response.data)) {
        setResultados(response.data);
        if (response.data.length === 0) {
          setErro("Nenhum imóvel encontrado com esses filtros.");
        }
      }
    } catch (error) {
      console.error(error);
      setErro("Erro ao buscar imóveis. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelecao = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((item) => item !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const toggleTodos = () => {
    if (selecionados.length === resultados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(resultados.map((r) => r.nrinscr));
    }
  };

  const handleProcessar = () => {
    if (selecionados.length === 0) return;
    setModalOpen(true);
  };

  const handleConclusao = () => {
    setModalOpen(false);
    setSelecionados([]);
    navigate("/dashboard/leads");
  };

  // Filtra os objetos completos dos itens selecionados para passar ao modal
  const imoveisSelecionados = resultados.filter((r) =>
    selecionados.includes(r.nrinscr)
  );

  return (
    <div className="space-y-8">
      {/* Modal de Processamento */}
      <ModalProcessamento
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        imoveis={imoveisSelecionados}
        onConcluido={handleConclusao}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-8 h-8 text-blue-600" />
          Mineração de Leads
        </h1>
        <p className="text-slate-500 mt-1">
          Busque por edifícios, condomínios ou bairros para captar
          proprietários.
        </p>
      </div>

      {/* Busca */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Nome do Edifício (ex: Reserva Buriti)..."
              className="pl-10 h-11 text-lg"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBusca()}
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Bairro ou Condomínio (ex: Jardins Florença)..."
              className="pl-10 h-11 text-lg"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBusca()}
            />
          </div>
          <div className="relative md:col-span-2">
            <CheckSquare className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Inscrição IPTU (ex: 32313702960010)..."
              className="pl-10 h-11 text-lg font-mono"
              value={iptu}
              onChange={(e) => setIptu(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBusca()}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {resultados.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-6 text-slate-600 border-slate-300 hover:bg-slate-50"
              onClick={handleLimparBusca}
            >
              Limpar Buscas
            </Button>
          )}

          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 h-11 px-8 w-full md:w-auto"
            onClick={handleBusca}
            disabled={loading || (!termo && !bairro && !iptu)}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Buscar Unidades"
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="w-4 h-4" />
          <span>
            Fonte: Cadastro Imobiliário Oficial de Goiânia (FeatureServer/3)
          </span>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">
                {resultados.length} unidades encontradas
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-blue-600 font-medium">
                {selecionados.length} selecionadas
              </span>
            </div>

            <Button
              onClick={handleProcessar}
              disabled={selecionados.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Minerar Leads ({selecionados.length})
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <button onClick={toggleTodos} className="hover:text-blue-600">
                    {selecionados.length === resultados.length &&
                    resultados.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Edifício</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Inscrição IPTU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((item) => {
                const isSelected = selecionados.includes(item.nrinscr);
                return (
                  <TableRow
                    key={item.nrinscr}
                    className={`hover:bg-blue-50 cursor-pointer ${isSelected ? "bg-blue-50/50" : ""}`}
                    onClick={() => toggleSelecao(item.nrinscr)}
                  >
                    <TableCell>
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.nmedificio}
                    </TableCell>
                    <TableCell>
                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                        {item.incompl || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {item.nmlogradou}, {item.nmbairro}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {item.nrinscr}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
