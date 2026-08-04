---
name: paystack-directory
description: >-
  Paystack MCP operation cheat sheet for Cursor agents using @paystack/mcp-server
  (get_paystack_operation / make_paystack_request). Use when calling Paystack via MCP.
---

# Paystack MCP Directory

## MCP tools

| Tool | Use |
|------|-----|
| `get_paystack_operation` | Fetch OpenAPI details by operationId |
| `make_paystack_request` | Execute API call |

Resource: `paystack://operations/list`, `paystack://skill`

## Common operations (verify via get_paystack_operation)

| Intent | Typical path |
|--------|----------------|
| Initialize charge | `POST /transaction/initialize` |
| Verify | `GET /transaction/verify/:reference` |
| List transactions | `GET /transaction` |
| Refund | `POST /refund` |
| Create recipient | `POST /transferrecipient` |
| Transfer | `POST /transfer` |
| Balance | `GET /balance` |
| Banks (KE) | `GET /bank?currency=KES` |

## Agent rules

1. Only use `sk_test_` with MCP.
2. Prefer app APIs (`lib/paystack`) for product flows; MCP for exploration/debug.
3. Always pass amounts in minor units; currency `KES` for KlikCollect.
4. After successful charge in prod path, ensure webhook + ledger append ran.
