import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Building2, Lock, Mail } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Formulário de login
  const [form, setForm] = useState({
    email: "",
    senha: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    try {
      const { data } = await api.post("/auth/login", form);

      // Salvar sessão
      localStorage.setItem("elyon_token", data.token);
      localStorage.setItem("elyon_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("elyon_tenant", JSON.stringify(data.tenant));

      // Redirecionar
      navigate("/dashboard");
    } catch (err: any) {
      setErro(err.response?.data?.erro || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg border border-slate-100">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
            <Building2 className="w-6 h-6 text-brand" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            ELYON
          </h2>
          <p className="text-sm text-slate-500">
            Acesse sua conta para gerenciar seus agentes
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {erro && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-100">
              {erro}
            </div>
          )}

          <div className="space-y-4">

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar na Plataforma"}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Quadra Dois © 2025 • ELYON Platform
        </div>
      </div>
    </div>
  );
}
