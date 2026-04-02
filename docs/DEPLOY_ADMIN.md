# 🚀 Guia de Deploy - Admin Billing Dashboard

> **URL Final:** https://admin.quadradois.com.br

---

## 📋 Pré-requisitos

- [ ] Acesso SSH ao servidor
- [ ] Docker e Docker Compose instalados
- [ ] DNS de `admin.quadradois.com.br` apontando para o IP do servidor
- [ ] Repositório clonado em `/opt/elyon`

---

## 🔧 Passo a Passo

### 1. Atualizar o repositório

```bash
cd /opt/elyon
git pull origin main
```

### 2. Verificar arquivos do admin

Confirme que estes arquivos existem:

```bash
ls -la site-quadradois/admin/
```

Deve mostrar:

```
Dockerfile
nginx.conf
index.html
dashboard.html
```

### 3. Build e Deploy

```bash
# Parar containers atuais (se estiverem rodando)
docker compose -f docker-compose.prod.yml down

# Rebuildar todos os containers (incluindo o novo 'admin')
docker compose -f docker-compose.prod.yml build

# Iniciar todos os containers
docker compose -f docker-compose.prod.yml up -d
```

### 4. Verificar se o container admin está rodando

```bash
docker ps | grep admin
```

Deve mostrar algo como:

```
elyon_admin   Up 2 minutes   80/tcp
```

### 5. Verificar logs do admin

```bash
docker compose -f docker-compose.prod.yml logs admin
```

Deve mostrar nginx iniciando sem erros.

### 6. Verificar certificado SSL

```bash
docker compose -f docker-compose.prod.yml logs traefik | grep admin
```

Deve mostrar que o certificado foi gerado para `admin.quadradois.com.br`.

### 7. Testar acesso

```bash
curl -I https://admin.quadradois.com.br
```

Deve retornar `HTTP/2 200`.

---

## 🐛 Troubleshooting

### Erro: "Container admin não inicia"

```bash
# Ver logs detalhados
docker compose -f docker-compose.prod.yml logs admin --tail 50

# Verificar se o build funcionou
docker images | grep admin
```

### Erro: "502 Bad Gateway"

O container admin pode não estar rodando:

```bash
docker compose -f docker-compose.prod.yml restart admin
```

### Erro: "Certificado SSL inválido"

Aguarde alguns minutos para o Let's Encrypt gerar o certificado:

```bash
# Verificar status do Traefik
docker compose -f docker-compose.prod.yml logs traefik | grep -i acme
```

### Erro: "DNS não resolve"

Verifique se o DNS está configurado:

```bash
nslookup admin.quadradois.com.br
```

Deve retornar o IP do servidor.

---

## 📁 Estrutura do Admin

```
site-quadradois/admin/
├── Dockerfile        # Build do container nginx
├── nginx.conf        # Configuração do nginx
├── index.html        # Página de login (6KB)
└── dashboard.html    # Dashboard principal (50KB)
```

---

## 🌐 URLs do Sistema

| Serviço           | URL                                 | Container         |
| ----------------- | ----------------------------------- | ----------------- |
| Dashboard Elyon   | https://elyon.quadradois.com.br     | `elyon_frontend`  |
| API Backend       | https://api.elyon.quadradois.com.br | `elyon_backend`   |
| **Admin Billing** | **https://admin.quadradois.com.br** | **`elyon_admin`** |
| Traefik Dashboard | https://traefik.quadradois.com.br   | `elyon_traefik`   |

---

## ✅ Checklist Final

- [ ] `git pull` executado
- [ ] `docker compose build` sem erros
- [ ] `docker compose up -d` sem erros
- [ ] Container `elyon_admin` rodando
- [ ] https://admin.quadradois.com.br acessível
- [ ] Certificado SSL válido (cadeado verde)

---

## 📞 Suporte

Se persistirem problemas, colete estas informações:

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Logs do admin
docker compose -f docker-compose.prod.yml logs admin --tail 100

# Logs do Traefik
docker compose -f docker-compose.prod.yml logs traefik --tail 100
```

E entre em contato com a equipe de desenvolvimento.
