# PLAN: Fix LLM Configuration Validation Error (HTTP 400)

> **Objective:** Resolve "Dados inválidos" error caused by empty string in optional URL field.

## 🚨 Diagnosis (CONFIRMED)
- **Root Cause:**
  - Frontend sends `baseUrl: ""` (empty string) when field is left blank.
  - Backend Zod Schema: `baseUrl: z.string().url().optional()`.
  - **Conflict:** Empty string `""` is NOT a valid URL, causing Zod to throw validation error.

## 👥 Agent Role Allocation
| Agent | Focus Area |
|-------|------------|
| **frontend-specialist** | Modify `ConfiguracaoLLM.tsx` to Convert `""` to `undefined` or `null` before sending. |
| **backend-specialist** | Update `config-llm.ts` to use `z.preprocess` or `.or(z.literal(''))` for robustness. |
| **test-engineer** | Verify fix by saving config without baseUrl. |

## 📋 Execution Steps

### Phase 1: Frontend Fix (Frontend Specialist)
- [ ] **Payload Sanitization**: In `salvar()`, filter `formData` to remove keys with empty strings (or set them to undefined).

### Phase 2: Backend Robustness (Backend Specialist)
- [ ] **Schema Update**: Update `createConfigSchema` and `updateConfigSchema`.
  - Change `baseUrl` validation to: `z.string().url().optional().or(z.literal(''))`.
  - Alternatively, use `z.preprocess` to convert `""` to `undefined`.

### Phase 3: Verification (Test Engineer)
- [ ] **Manual Test**: Save configuration with empty baseUrl via UI.
- [ ] **Edge Case**: Save with valid baseUrl.

## 🛡️ Validation Criteria
1. `POST /api/configuracao/llm` returns 201 Created.
2. User sees success message.
