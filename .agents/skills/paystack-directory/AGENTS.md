# Paystack MCP Directory

Quick reference for `@paystack/mcp-server` operation IDs. Use with project skill `paystack-directory/SKILL.md`.

## MCP tools

| Tool | Purpose |
|------|---------|
| `list_paystack_operations` | Discover available API operations |
| `get_paystack_operation` | Schema for one operation ID |
| `make_paystack_request` | Execute a Paystack API call |

## Common operation IDs

| Area | Operation IDs (examples) |
|------|--------------------------|
| Transactions | `initialize_transaction`, `verify_transaction`, `list_transactions` |
| Transfers | `create_transfer_recipient`, `initiate_transfer`, `list_transfers` |
| Refunds | `create_refund` |
| Subaccounts | `create_subaccount`, `list_subaccounts` |
| Banks | `list_banks`, `resolve_account_number` |

Exact IDs vary by MCP version — always `list_paystack_operations` first.

## Rules

- Test secret keys only (`sk_test_`) — MCP rejects `sk_live_`
- Never expose secret keys client-side
- App runtime uses `lib/paystack/client.ts`, not MCP
