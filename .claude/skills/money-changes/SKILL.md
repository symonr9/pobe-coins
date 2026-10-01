---
name: money-changes
description: Safely change anything that moves pobe coins — earning, spending, IOUs/debt, refunds, gifts, bonuses, corrections, coin types, shop purchases, goal contributions. Use whenever touching coins.ts, ledger.ts, services/money.ts or any flow that changes a purse.
---

# Changing money flows

Coins are the one thing users will notice if they're wrong. Follow these invariants:

1. **One transaction per movement.** Use `commitMoney(deps, async () => plan)` from `packages/functions/src/services/money.ts`.
   - `build()` must **re-read** the members and related records on every attempt, because it's retried on version conflicts.
   - It returns `{ members: [updated members], entries: [ledger entries via newEntry(...)], ops: [related writes with conditions], result }`.
   - Related state changes (completion approved, purchase status, goal contribution) go in `ops` with a condition, so a double tap can't apply twice.
2. **The ledger is immutable.** Never update or delete a `L#` entry. Undo and corrections write a reversing entry (`REFUND`, `ADJUST`, `CORRECTION` with a reason, which is also audit-logged).
3. **The purse math lives in `@pobe/core/coins.ts`.** Don't do arithmetic on purses anywhere else.
   - `pay(purse, amount, coinTypes)` returns the coins out and the change in.
   - `payWithDebt(...)` covers IOUs, up to `settings.debtLimit`.
   - `receive(purse, debt, amount)` pays debt first.
   - `refund(...)` returns exactly the coins that were held.
4. **Invariant:** replaying a member's ledger entries (`coinsIn − coinsOut`, `debtDelta`) reproduces their purse and debt exactly. Assert it at the end of any new money test: `expect(await ledgerMismatches(h, hid)).toEqual([])` (from `testing/harness.ts`). The 'ledger invariant' test in `money.test.ts` runs a mixed day; extend it when you add a new kind of movement.
5. **Integers only.** Amounts are positive ints with an upper bound (enforced in the zod schema). Coin types are admin-configurable, so never assume 1/5/10/25/50/100.
6. **Approval flows** hold coins (`pending`) and then either finalize them or refund exactly what was held. You can't approve your own request.

## Tests (required)

- Core math: `packages/core/src/coins.test.ts`, including edge cases (exact change impossible, overpay + change, debt limit hit, custom coin types).
- API: `packages/functions/src/tests/money.test.ts`, covering:
  - the flow itself;
  - a concurrent/double submit (fire two calls with `Promise.all`; only one applies);
  - refunds that restore the exact purse;
  - the invariant after the flow.
- UI copy about IOUs stays gentle. Chubbybara never shames anyone about debt.
