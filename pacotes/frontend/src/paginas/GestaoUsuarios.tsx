import { useState, useEffect, useRef } from "react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Card, CardContent } from "../componentes/ui/card";
import { PageHeader } from "../componentes/ui/page-header";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../componentes/ui/dialog";
import {
  Search,
  MoreHorizontal,
  UserPlus,
  RefreshCw,
  Users,
  Shield,
  Eye,
  KeyRound,
  UserX,
  UserCheck,
  Copy,
  Check,
  Loader2,
  Camera,
} from "lucide-react";
import { servicoUsuarios, Usuario } from "../servicos/servico-usuarios";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAPEIS = {
  SUPER_ADMIN: { label: "Super Admin", cor: "#7c3aed", bg: "#ede9fe" },
  ADMIN: { label: "Admin", cor: "#0369a1", bg: "#e0f2fe" },
  CORRETOR: { label: "Corretor", cor: "#065f46", bg: "#d1fae5" },
  VISUALIZADOR: { label: "Visualizador", cor: "#92400e", bg: "#fef3c7" },
} as const;

function Iniciais({ nome, avatar, tamanho = 40 }: { nome: string; avatar?: string; tamanho?: number }) {
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const cores = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
    "#f97316", "#0ea5e9", "#10b981", "#14b8a6",
  ];
  const cor = cores[nome.charCodeAt(0) % cores.length];

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={nome}
        style={{ width: tamanho, height: tamanho, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: "50%",
        background: cor,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: tamanho * 0.35,
        flexShrink: 0,
      }}
    >
      {iniciais}
    </div>
  );
}

function BadgePapel({ papel }: { papel: keyof typeof PAPEIS }) {
  const config = PAPEIS[papel] || PAPEIS.CORRETOR;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 99,
        background: config.bg,
        color: config.cor,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {config.label}
    </span>
  );
}

function CopiarSenha({ senha }: { senha: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(senha);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <code
        style={{
          background: "#1e1e2e",
          color: "#a6e3a1",
          padding: "6px 14px",
          borderRadius: 8,
          fontSize: 15,
          letterSpacing: 2,
          fontFamily: "monospace",
          flex: 1,
          textAlign: "center",
        }}
      >
        {senha}
      </code>
      <button
        onClick={copiar}
        style={{
          background: copiado ? "#22c55e" : "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          transition: "background 0.2s",
        }}
      >
        {copiado ? <Check size={14} /> : <Copy size={14} />}
        {copiado ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

// ─── Modal Criar Usuário ──────────────────────────────────────────────────────
function ModalCriarUsuario({
  aberto,
  onFechar,
  onSucesso,
  papelCriador,
}: {
  aberto: boolean;
  onFechar: () => void;
  onSucesso: () => void;
  papelCriador: string;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState<"CORRETOR" | "ADMIN" | "VISUALIZADOR">("CORRETOR");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  const papelOpcoes = papelCriador === "SUPER_ADMIN"
    ? [["ADMIN", "Admin"], ["CORRETOR", "Corretor"], ["VISUALIZADOR", "Visualizador"]]
    : [["CORRETOR", "Corretor"], ["VISUALIZADOR", "Visualizador"]];

  const handleCriar = async () => {
    if (!nome.trim() || !email.trim()) {
      setErro("Nome e email são obrigatórios");
      return;
    }
    setErro("");
    setCarregando(true);
    try {
      const resultado = await servicoUsuarios.criar({ nome: nome.trim(), email: email.trim(), papel, telefone: telefone || undefined });
      setSenhaGerada(resultado.senhaTemporaria);
      onSucesso();
    } catch (e: any) {
      setErro(e?.response?.data?.erro || "Erro ao criar usuário");
    } finally {
      setCarregando(false);
    }
  };

  const handleFechar = () => {
    setNome(""); setEmail(""); setTelefone(""); setPapel("CORRETOR");
    setErro(""); setSenhaGerada(null);
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={handleFechar}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={20} /> {senhaGerada ? "Usuário Criado!" : "Novo Usuário"}
          </DialogTitle>
        </DialogHeader>

        {senhaGerada ? (
          <div style={{ padding: "8px 0" }}>
            <p style={{ color: "#65a30d", fontWeight: 600, marginBottom: 8 }}>
              ✅ Usuário criado com sucesso!
            </p>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
              Compartilhe a senha temporária abaixo com o usuário. Ele poderá alterá-la após o primeiro login.
            </p>
            <CopiarSenha senha={senhaGerada} />
            <p style={{ fontSize: 12, color: "#f97316", marginTop: 8 }}>
              ⚠️ Anote agora — esta senha não será exibida novamente.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
            <div>
              <label htmlFor="novo-usuario-nome" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Nome completo *</label>
              <Input id="novo-usuario-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <label htmlFor="novo-usuario-email" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Email *</label>
              <Input id="novo-usuario-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@imobiliaria.com" />
            </div>
            <div>
              <label htmlFor="novo-usuario-telefone" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Telefone</label>
              <Input id="novo-usuario-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label htmlFor="novo-usuario-papel" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Papel</label>
              <select
                id="novo-usuario-papel"
                value={papel}
                onChange={(e) => setPapel(e.target.value as any)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 14 }}
              >
                {papelOpcoes.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            {erro && <p style={{ color: "#dc2626", fontSize: 13 }}>{erro}</p>}
          </div>
        )}

        <DialogFooter>
          {senhaGerada ? (
            <Button onClick={handleFechar}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleFechar} disabled={carregando}>Cancelar</Button>
              <Button onClick={handleCriar} disabled={carregando}>
                {carregando ? <Loader2 size={14} className="animate-spin" /> : "Criar Usuário"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Editar Usuário ─────────────────────────────────────────────────────
function ModalEditarUsuario({
  usuario,
  onFechar,
  onSucesso,
  papelCriador,
}: {
  usuario: Usuario | null;
  onFechar: () => void;
  onSucesso: () => void;
  papelCriador: string;
}) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadando, setUploadando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome);
      setPapel(usuario.papel);
      setTelefone(usuario.telefone || "");
      setErro("");
    }
  }, [usuario]);

  if (!usuario) return null;

  const papelOpcoes = papelCriador === "SUPER_ADMIN"
    ? [["ADMIN", "Admin"], ["CORRETOR", "Corretor"], ["VISUALIZADOR", "Visualizador"]]
    : [["CORRETOR", "Corretor"], ["VISUALIZADOR", "Visualizador"]];

  const handleSalvar = async () => {
    setErro("");
    setCarregando(true);
    try {
      await servicoUsuarios.atualizar(usuario.id, {
        nome: nome.trim(),
        papel: papel as any,
        telefone: telefone || undefined,
      });
      onSucesso();
      onFechar();
    } catch (e: any) {
      setErro(e?.response?.data?.erro || "Erro ao salvar");
    } finally {
      setCarregando(false);
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setUploadando(true);
    try {
      const { avatarUrl } = await servicoUsuarios.uploadAvatar(usuario.id, arquivo);
      await servicoUsuarios.atualizar(usuario.id, { avatar: avatarUrl });
      onSucesso();
    } catch {
      setErro("Erro ao fazer upload do avatar");
    } finally {
      setUploadando(false);
    }
  };

  return (
    <Dialog open={!!usuario} onOpenChange={onFechar}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <Iniciais nome={usuario.nome} avatar={usuario.avatar} tamanho={64} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadando}
                style={{
                  position: "absolute", bottom: -4, right: -4,
                  background: "#6366f1", border: "2px solid #fff",
                  borderRadius: "50%", width: 24, height: 24,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                }}
              >
                {uploadando ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUploadAvatar} />
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Clique no ícone para alterar a foto.<br />
              JPG, PNG ou WebP — máx. 2MB.
            </div>
          </div>

          <div>
            <label htmlFor="editar-usuario-nome" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Nome</label>
            <Input id="editar-usuario-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label htmlFor="editar-usuario-telefone" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Telefone</label>
            <Input id="editar-usuario-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label htmlFor="editar-usuario-papel" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Papel</label>
            <select
              id="editar-usuario-papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 14 }}
            >
              {papelOpcoes.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {erro && <p style={{ color: "#dc2626", fontSize: 13 }}>{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={carregando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={carregando}>
            {carregando ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Senha Resetada ─────────────────────────────────────────────────────
function ModalSenhaResetada({ senha, onFechar }: { senha: string | null; onFechar: () => void }) {
  return (
    <Dialog open={!!senha} onOpenChange={onFechar}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={20} /> Senha Resetada
          </DialogTitle>
        </DialogHeader>
        <div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
            Compartilhe a nova senha temporária com o usuário:
          </p>
          {senha && <CopiarSenha senha={senha} />}
          <p style={{ fontSize: 12, color: "#f97316", marginTop: 8 }}>
            ⚠️ Esta senha não será exibida novamente após fechar esta janela.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);

  const [modalCriar, setModalCriar] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [senhaResetada, setSenhaResetada] = useState<string | null>(null);

  const usuarioLogado = JSON.parse(localStorage.getItem("elyon_usuario") || "{}");
  const papelCriador = usuarioLogado.papel || "CORRETOR";

  const carregarUsuarios = async (pagina = 1) => {
    setCarregando(true);
    try {
      const resultado = await servicoUsuarios.listar({ pagina, busca });
      setUsuarios(resultado.dados);
      setTotalPaginas(resultado.paginacao.totalPaginas);
      setTotalUsuarios(resultado.paginacao.total);
    } catch (e) {
      console.error("Erro ao carregar usuários", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios(paginaAtual);
  }, [paginaAtual, busca]);

  const handleToggleAtivo = async (usuario: Usuario) => {
    try {
      if (usuario.estaAtivo) {
        await servicoUsuarios.desativar(usuario.id);
      } else {
        await servicoUsuarios.atualizar(usuario.id, { estaAtivo: true });
      }
      carregarUsuarios(paginaAtual);
    } catch (e: any) {
      alert(e?.response?.data?.erro || "Erro ao alterar status");
    }
  };

  const handleResetarSenha = async (id: string) => {
    if (!confirm("Deseja resetar a senha desse usuário?")) return;
    try {
      const { senhaTemporaria } = await servicoUsuarios.resetarSenha(id);
      setSenhaResetada(senhaTemporaria);
    } catch {
      alert("Erro ao resetar senha");
    }
  };

  const ativos = usuarios.filter((u) => u.estaAtivo).length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title="Gestão de Equipe"
        description={`${totalUsuarios} usuário${totalUsuarios !== 1 ? "s" : ""} · ${ativos} ativo${ativos !== 1 ? "s" : ""}`}
        icon={<Users size={20} />}
        actions={<div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" onClick={() => carregarUsuarios(paginaAtual)} title="Atualizar">
            <RefreshCw size={15} />
          </Button>
          {["ADMIN", "SUPER_ADMIN"].includes(papelCriador) && (
            <Button onClick={() => setModalCriar(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <UserPlus size={16} /> Novo Usuário
            </Button>
          )}
        </div>}
      />

      {/* Stats rápidas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(["ADMIN", "CORRETOR", "VISUALIZADOR", "SUPER_ADMIN"] as const).map((papel) => {
          const config = PAPEIS[papel];
          const count = usuarios.filter((u) => u.papel === papel).length;
          return (
            <Card key={papel} style={{ border: `1px solid ${config.bg}` }}>
              <CardContent style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: config.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={16} style={{ color: config.cor }} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{count}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{config.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Busca */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
        <Input
          placeholder="Buscar por nome ou email..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent style={{ padding: 0, overflow: "hidden" }}>
          {carregando ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto" }} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ width: 48 }}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} style={{ textAlign: "center", padding: 40, color: "#888" }}>
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  usuarios.map((usuario) => (
                    <TableRow key={usuario.id} style={{ opacity: usuario.estaAtivo ? 1 : 0.5 }}>
                      <TableCell>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Iniciais nome={usuario.nome} avatar={usuario.avatar} tamanho={36} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{usuario.nome}</div>
                            {usuario.telefone && (
                              <div style={{ fontSize: 12, color: "#888" }}>{usuario.telefone}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell style={{ fontSize: 13, color: "#555" }}>{usuario.email}</TableCell>
                      <TableCell><BadgePapel papel={usuario.papel as keyof typeof PAPEIS} /></TableCell>
                      <TableCell style={{ fontSize: 12, color: "#888" }}>
                        {usuario.ultimoLoginEm
                          ? new Date(usuario.ultimoLoginEm).toLocaleDateString("pt-BR")
                          : "Nunca acessou"}
                      </TableCell>
                      <TableCell>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
                          background: usuario.estaAtivo ? "#dcfce7" : "#fee2e2",
                          color: usuario.estaAtivo ? "#15803d" : "#b91c1c",
                        }}>
                          {usuario.estaAtivo ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {["ADMIN", "SUPER_ADMIN"].includes(papelCriador) && usuario.id !== usuarioLogado.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setUsuarioEditando(usuario)}>
                                <Eye size={14} style={{ marginRight: 8 }} /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetarSenha(usuario.id)}>
                                <KeyRound size={14} style={{ marginRight: 8 }} /> Resetar Senha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleAtivo(usuario)}
                                style={{ color: usuario.estaAtivo ? "#dc2626" : "#16a34a" }}
                              >
                                {usuario.estaAtivo
                                  ? <><UserX size={14} style={{ marginRight: 8 }} /> Desativar</>
                                  : <><UserCheck size={14} style={{ marginRight: 8 }} /> Reativar</>}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === paginaAtual ? "default" : "outline"}
              size="sm"
              onClick={() => setPaginaAtual(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      )}

      {/* Modais */}
      <ModalCriarUsuario
        aberto={modalCriar}
        onFechar={() => setModalCriar(false)}
        onSucesso={() => carregarUsuarios(1)}
        papelCriador={papelCriador}
      />
      <ModalEditarUsuario
        usuario={usuarioEditando}
        onFechar={() => setUsuarioEditando(null)}
        onSucesso={() => carregarUsuarios(paginaAtual)}
        papelCriador={papelCriador}
      />
      <ModalSenhaResetada senha={senhaResetada} onFechar={() => setSenhaResetada(null)} />
    </div>
  );
}
