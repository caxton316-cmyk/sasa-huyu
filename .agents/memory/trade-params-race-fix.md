---
name: Trade parameters dropdown race condition
description: Why Market/Trade Type/Contract Type dropdowns show blank in the bot builder, and the fix applied.
---

## The problem
All three dropdowns (Market, Trade Type, Contract Type) in the "Trade parameters" Blockly block initialize with `[['', '']]` (blank). They rely on a cascade of Blockly events to populate:

1. Fake `BLOCK_CREATE` → `populateMarketDropdown()` (needs `active_symbols` data)
2. MARKET_LIST change → submarket updates
3. SUBMARKET_LIST change → symbol updates
4. SYMBOL_LIST change → trade type categories (async via `contracts_for`)
5. TRADETYPECAT_LIST change → trade types
6. TRADETYPE_LIST change → contract type options

## Root cause
In `app-store.ts`, `registerOnAccountSwitch` fires a re-population when `is_socket_opened` changes to `true`. But since `initWorkspace` is called **after** the socket is already open, `is_socket_opened` never changes again — so the MobX `reaction` never fires.

Result: workspace loads with blank dropdowns and nothing triggers re-population.

## Fix applied
In `app-store.ts` `onMount`, directly after `initWorkspace` resolves, proactively call `retrieveActiveSymbols()` and fire fake `BLOCK_CREATE` events on all `trade_definition_market` blocks — mirroring the exact same logic already in `registerOnAccountSwitch`.

**Why:** MobX `reaction` only fires on *changes* to the observed value, not on the current value at registration time. Since the socket is already open when `onMount` runs, no change fires.

**How to apply:** Any future change to the workspace initialization order must ensure that after `initWorkspace` resolves, a re-population of market blocks is triggered if `ApiHelpers.instance` already has data.
