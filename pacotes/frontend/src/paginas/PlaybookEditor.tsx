import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../componentes/ui/dialog";
import {
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Save,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Download,
} from "lucide-react";
import { api } from "../servicos/api";
import { toast } from "sonner";

// Types
interface PlaybookItem {
    id?: string;
    texto: string;
    tipoItem: string;
    opcoes: string[];
    placeholder?: string;
    scorePontos: number;
    atualizaCampo?: string;
    obrigatorio: boolean;
    aiExtrairPadrao?: string;
    aiPreencherAuto: boolean;
    ordem: number;
}

interface PlaybookObjection {
    id?: string;
    objecaoTexto: string;
    respostaTexto: string;
    ordem: number;
}

interface PlaybookStage {
    id?: string;
    nome: string;
    descricao?: string;
    icone: string;
    ordem: number;
    scriptTexto?: string;
    aiPromptContext?: string;
    itens: PlaybookItem[];
    objecoes: PlaybookObjection[];
    expanded?: boolean;
}

interface Playbook {
    id: string;
    nome: string;
    descricao?: string;
    tipo: string;
    ePadrao: boolean;
    estaAtivo: boolean;
    agenteId?: string;
    etapas: PlaybookStage[];
}

export function PlaybookEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Dialog state for adding stage
    const [dialogNovaEtapa, setDialogNovaEtapa] = useState(false);
    const [novaEtapa, setNovaEtapa] = useState({ nome: "", descricao: "", icone: "📋" });

    useEffect(() => {
        if (id) carregarPlaybook();
    }, [id]);

    const carregarPlaybook = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/playbooks/${id}`);
            const data = response.data.playbook;

            // Add expanded state to stages
            data.etapas = data.etapas.map((e: PlaybookStage) => ({ ...e, expanded: true }));

            setPlaybook(data);
        } catch (error) {
            toast.error("Erro ao carregar playbook");
            navigate("/dashboard/playbooks");
        } finally {
            setLoading(false);
        }
    };

    const salvarPlaybook = async () => {
        if (!playbook) return;

        try {
            setSaving(true);

            // Prepare data for API
            const payload = {
                nome: playbook.nome,
                descricao: playbook.descricao,
                tipo: playbook.tipo,
                estaAtivo: playbook.estaAtivo,
                etapas: playbook.etapas.map((etapa, eIndex) => ({
                    id: etapa.id,
                    nome: etapa.nome,
                    descricao: etapa.descricao,
                    icone: etapa.icone,
                    ordem: eIndex,
                    scriptTexto: etapa.scriptTexto,
                    aiPromptContext: etapa.aiPromptContext,
                    itens: etapa.itens.map((item, iIndex) => ({
                        id: item.id,
                        texto: item.texto,
                        tipoItem: item.tipoItem,
                        opcoes: item.opcoes,
                        placeholder: item.placeholder,
                        scorePontos: item.scorePontos,
                        atualizaCampo: item.atualizaCampo,
                        obrigatorio: item.obrigatorio,
                        aiExtrairPadrao: item.aiExtrairPadrao,
                        aiPreencherAuto: item.aiPreencherAuto,
                        ordem: iIndex,
                    })),
                    objecoes: etapa.objecoes.map((obj, oIndex) => ({
                        id: obj.id,
                        objecaoTexto: obj.objecaoTexto,
                        respostaTexto: obj.respostaTexto,
                        ordem: oIndex,
                    })),
                })),
            };

            await api.put(`/playbooks/${id}`, payload);
            toast.success("Playbook salvo com sucesso!");
            setHasChanges(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Erro ao salvar playbook");
        } finally {
            setSaving(false);
        }
    };

    const adicionarEtapa = () => {
        if (!playbook || !novaEtapa.nome) return;

        const newStage: PlaybookStage = {
            nome: novaEtapa.nome,
            descricao: novaEtapa.descricao,
            icone: novaEtapa.icone,
            ordem: playbook.etapas.length,
            itens: [],
            objecoes: [],
            expanded: true,
        };

        setPlaybook({
            ...playbook,
            etapas: [...playbook.etapas, newStage],
        });
        setNovaEtapa({ nome: "", descricao: "", icone: "📋" });
        setDialogNovaEtapa(false);
        setHasChanges(true);
    };

    const removerEtapa = (index: number) => {
        if (!playbook) return;
        if (!confirm("Remover esta etapa e todos seus itens?")) return;

        const newEtapas = playbook.etapas.filter((_, i) => i !== index);
        setPlaybook({ ...playbook, etapas: newEtapas });
        setHasChanges(true);
    };

    const toggleEtapaExpanded = (index: number) => {
        if (!playbook) return;

        const newEtapas = [...playbook.etapas];
        newEtapas[index].expanded = !newEtapas[index].expanded;
        setPlaybook({ ...playbook, etapas: newEtapas });
    };

    const adicionarItem = (stageIndex: number) => {
        if (!playbook) return;

        const newItem: PlaybookItem = {
            texto: "Nova pergunta",
            tipoItem: "CHECKBOX",
            opcoes: [],
            scorePontos: 0,
            obrigatorio: false,
            aiPreencherAuto: false,
            ordem: playbook.etapas[stageIndex].itens.length,
        };

        const newEtapas = [...playbook.etapas];
        newEtapas[stageIndex].itens.push(newItem);
        setPlaybook({ ...playbook, etapas: newEtapas });
        setHasChanges(true);
    };

    const atualizarItem = (stageIndex: number, itemIndex: number, field: string, value: any) => {
        if (!playbook) return;

        const newEtapas = [...playbook.etapas];
        (newEtapas[stageIndex].itens[itemIndex] as any)[field] = value;
        setPlaybook({ ...playbook, etapas: newEtapas });
        setHasChanges(true);
    };

    const removerItem = (stageIndex: number, itemIndex: number) => {
        if (!playbook) return;

        const newEtapas = [...playbook.etapas];
        newEtapas[stageIndex].itens.splice(itemIndex, 1);
        setPlaybook({ ...playbook, etapas: newEtapas });
        setHasChanges(true);
    };

    const adicionarObjecao = (stageIndex: number) => {
        if (!playbook) return;

        const newObj: PlaybookObjection = {
            objecaoTexto: 'Cliente diz: "..."',
            respostaTexto: "Resposta sugerida...",
            ordem: playbook.etapas[stageIndex].objecoes.length,
        };

        const newEtapas = [...playbook.etapas];
        newEtapas[stageIndex].objecoes.push(newObj);
        setPlaybook({ ...playbook, etapas: newEtapas });
        setHasChanges(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!playbook) {
        return (
            <div className="text-center py-16">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium">Playbook não encontrado</h3>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/playbooks")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{playbook.nome}</h1>
                        {playbook.descricao && (
                            <p className="text-slate-500">{playbook.descricao}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <span className="text-sm text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            Alterações não salvas
                        </span>
                    )}
                    <Button variant="outline" onClick={() => {
                        const { id, ePadrao, agenteId, ...exportData } = playbook as any;
                        const json = JSON.stringify(exportData, null, 2);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `playbook-${playbook.nome.replace(/\s+/g, '-').toLowerCase()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('JSON exportado!');
                    }}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar JSON
                    </Button>
                    <Button onClick={salvarPlaybook} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Salvar
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Stages */}
            <div className="space-y-4">
                {playbook.etapas.map((etapa, eIndex) => (
                    <div
                        key={etapa.id || eIndex}
                        className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                    >
                        {/* Stage Header */}
                        <div
                            className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
                            onClick={() => toggleEtapaExpanded(eIndex)}
                        >
                            <div className="flex items-center gap-3">
                                <GripVertical className="h-5 w-5 text-slate-400" />
                                <span className="text-2xl">{etapa.icone}</span>
                                <div>
                                    <h3 className="font-semibold text-slate-900">
                                        {eIndex + 1}. {etapa.nome}
                                    </h3>
                                    {etapa.descricao && (
                                        <p className="text-sm text-slate-500">{etapa.descricao}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">
                                    {etapa.itens.length} itens
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); removerEtapa(eIndex); }}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                                {etapa.expanded ? (
                                    <ChevronUp className="h-5 w-5 text-slate-400" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                        </div>

                        {/* Stage Content */}
                        {etapa.expanded && (
                            <div className="p-4 space-y-4">
                                {/* Script */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Script Sugerido (opcional)
                                    </label>
                                    <textarea
                                        className="w-full mt-1 p-3 border border-slate-200 rounded-lg text-sm"
                                        rows={2}
                                        placeholder="Ex: Olá! Para começar, pode me dizer quantos quartos você busca?"
                                        value={etapa.scriptTexto || ""}
                                        onChange={(e) => {
                                            const newEtapas = [...playbook.etapas];
                                            newEtapas[eIndex].scriptTexto = e.target.value;
                                            setPlaybook({ ...playbook, etapas: newEtapas });
                                            setHasChanges(true);
                                        }}
                                    />
                                </div>

                                {/* Items */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-700">
                                            Checklist / Perguntas
                                        </label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => adicionarItem(eIndex)}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Adicionar Item
                                        </Button>
                                    </div>

                                    {etapa.itens.map((item, iIndex) => (
                                        <div
                                            key={item.id || iIndex}
                                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                                        >
                                            <CheckCircle2 className="h-5 w-5 text-slate-400 mt-1" />
                                            <div className="flex-1 space-y-2">
                                                <Input
                                                    value={item.texto}
                                                    onChange={(e) => atualizarItem(eIndex, iIndex, "texto", e.target.value)}
                                                    placeholder="Texto da pergunta/ação"
                                                />
                                                <div className="flex gap-2">
                                                    <select
                                                        className="text-sm border border-slate-200 rounded px-2 py-1"
                                                        value={item.tipoItem}
                                                        onChange={(e) => atualizarItem(eIndex, iIndex, "tipoItem", e.target.value)}
                                                    >
                                                        <option value="CHECKBOX">✓ Checkbox</option>
                                                        <option value="TEXTO">📝 Texto</option>
                                                        <option value="SELECT">📋 Seleção</option>
                                                        <option value="NUMERO">🔢 Número</option>
                                                        <option value="DATA">📅 Data</option>
                                                    </select>
                                                    <label className="flex items-center gap-1 text-sm">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.obrigatorio}
                                                            onChange={(e) => atualizarItem(eIndex, iIndex, "obrigatorio", e.target.checked)}
                                                        />
                                                        Obrigatório
                                                    </label>
                                                    <Input
                                                        className="w-20"
                                                        type="number"
                                                        value={item.scorePontos}
                                                        onChange={(e) => atualizarItem(eIndex, iIndex, "scorePontos", parseInt(e.target.value) || 0)}
                                                        placeholder="Pts"
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removerItem(eIndex, iIndex)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {/* Objections */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-700">
                                            Quebra de Objeções
                                        </label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => adicionarObjecao(eIndex)}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Adicionar Objeção
                                        </Button>
                                    </div>

                                    {etapa.objecoes.map((obj, oIndex) => (
                                        <div
                                            key={obj.id || oIndex}
                                            className="p-3 bg-amber-50 rounded-lg space-y-2"
                                        >
                                            <Input
                                                value={obj.objecaoTexto}
                                                onChange={(e) => {
                                                    const newEtapas = [...playbook.etapas];
                                                    newEtapas[eIndex].objecoes[oIndex].objecaoTexto = e.target.value;
                                                    setPlaybook({ ...playbook, etapas: newEtapas });
                                                    setHasChanges(true);
                                                }}
                                                placeholder='Se o cliente disser: "..."'
                                            />
                                            <textarea
                                                className="w-full p-2 border border-slate-200 rounded text-sm"
                                                value={obj.respostaTexto}
                                                onChange={(e) => {
                                                    const newEtapas = [...playbook.etapas];
                                                    newEtapas[eIndex].objecoes[oIndex].respostaTexto = e.target.value;
                                                    setPlaybook({ ...playbook, etapas: newEtapas });
                                                    setHasChanges(true);
                                                }}
                                                placeholder='Responda: "..."'
                                                rows={2}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Stage Button */}
                <Dialog open={dialogNovaEtapa} onOpenChange={setDialogNovaEtapa}>
                    <Button
                        variant="outline"
                        className="w-full border-dashed"
                        onClick={() => setDialogNovaEtapa(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Etapa
                    </Button>

                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nova Etapa</DialogTitle>
                            <DialogDescription>
                                Adicione uma nova etapa ao playbook
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="text-sm font-medium">Nome da Etapa *</label>
                                <Input
                                    placeholder="Ex: Descoberta de Necessidades"
                                    value={novaEtapa.nome}
                                    onChange={(e) => setNovaEtapa({ ...novaEtapa, nome: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Descrição</label>
                                <Input
                                    placeholder="Objetivo desta etapa"
                                    value={novaEtapa.descricao}
                                    onChange={(e) => setNovaEtapa({ ...novaEtapa, descricao: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Ícone</label>
                                <Input
                                    placeholder="📋"
                                    value={novaEtapa.icone}
                                    onChange={(e) => setNovaEtapa({ ...novaEtapa, icone: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setDialogNovaEtapa(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={adicionarEtapa}>
                                    Adicionar
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

export default PlaybookEditor;
