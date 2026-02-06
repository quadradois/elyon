# PLAN: Fix WebSocket & Network Connectivity Issues

> **Objective:** Restore stable WebSocket connections and fix "Network Error" on API calls.

## 🎯 Context
- **Symptoms:** 
  - `wss://crm.elyon.ia.br/ws/?EIO=4` interrupted.
  - `AxiosError: Network Error` on WhatsApp status check.
- **Environment:** Docker, Traefik, Node.js Backend, React Frontend.
- **Recent Changes:** Database recovery, Auth fix, BYOK update.

## 👥 Agent Role Allocation
| Agent | Focus Area |
|-------|------------|
| **debugger** | Analyze docker logs (backend, traefik, socket_proxy) for error patterns. |
| **devops-engineer** | Inspect Traefik middleware/labels and Docker network configuration. |
| **frontend-specialist** | Verify Socket.io client version compatibility and CORS handling. |

## 📋 Execution Steps

### Phase 1: Diagnosis (Debugger)
- [ ] **Log Analysis**: Check `elyon_backend` logs for Socket.io connection attempts/rejects.
- [ ] **Proxy Analysis**: Check `elyon_traefik` logs for 400/500 errors or dropped connections.
- [ ] **Network Check**: Verify internal container communication (`backend` <-> `socket_proxy`).

### Phase 2: Configuration Review (DevOps)
- [ ] **Traefik Labels**: Verify `docker-compose.yml` has correct WebSocket headers (`Upgrade`, `Connection`).
- [ ] **CORS Config**: Ensure Backend Socket.io `cors` settings match the domain `crm.elyon.ia.br`.
- [ ] **Port Mapping**: Confirm internal port 3000/backend matches proxy routing.

### Phase 3: Client Fixes (Frontend)
- [ ] **Socket Client**: Verify `socket.io-client` version matches backend (v4).
- [ ] **Env Variables**: Check `VITE_API_URL` and `VITE_SOCKET_URL` consistency.
- [ ] **Error Handling**: Add better error logging for Axios network errors.

### Phase 4: Verification (Test Engineer)
- [ ] **Connectivity Test**: `wscat` or browser console test to default namespace.
- [ ] **API Check**: Validate status endpoints return 200 OK.
- [ ] **Security Scan**: Ensure no open proxy vulnerabilities.

## 🛡️ Validation Criteria
1. WebSocket connection status switches to `OPEN/CONNECTED`.
2. No `Network Error` toasts in UI.
3. Real-time updates (WhatsApp status) flow correctly.
