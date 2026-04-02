# CRM Professionalization Tasks

## 1. 🚀 Manual Promotion (Contact -> Lead)
**Status:** DONE ✅
**Goal:** Allow the broker to manually transform a Contact (Cold) into a Lead (CRM Opportunity) directly from the Contact Details screen.

### Subtasks:
- [x] **Backend:** Create `POST /contatos/:id/promover` endpoint.
    - Copy data from Contact to Lead.
    - Handle `imovel` relationship correctly.
    - Mark Contact as converted.
- [x] **Frontend:** Add "Promote to Lead" button in `ContatoDetalhes.tsx`.
    - Show confirmation modal.
    - Redirect to the new Lead page upon success.

## 2. 📊 Kanban Pipeline (Visual CRM)
**Status:** DONE ✅
**Goal:** Replace/Augment the Lead List view with a Drag & Drop Kanban board.

### Subtasks:
- [x] **UI:** Create `KanbanBoard` component.
- [x] **Logic:** Implement Drag & Drop (native API).
- [x] **Data:** Group leads by `status` or `estagio`.

## 3. 🔍 Global Contacts Base
**Status:** BACKEND READY 🏗️
**Goal:** A centralized screen to search all mined contacts across all campaigns.

### Subtasks:
- [x] **Backend:** Create global search endpoint (paginated) `/api/contatos`.
- [x] **Frontend:** Create `ContatosGlobal.tsx` page.
