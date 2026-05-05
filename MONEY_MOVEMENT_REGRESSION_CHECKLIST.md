# N.O.V.A. Money Movement Regression Checklist

Run this before APK beta builds whenever ledger, forecast, import/export, or business tracking changes.

## Ledger Corrections

- Log grocery spend. Confirm account balance decreases, grocery week spend increases, and a transaction exists with `source: grocery`.
- Edit that grocery entry to a higher and lower amount. Confirm account balance changes by the delta, not by the full new amount.
- Delete that grocery entry. Confirm account balance reverses and the paired transaction is marked deleted.
- Add a bill with a default account, mark it paid with an actual amount, and confirm only the actual paid amount leaves the account.
- Edit/delete the bill payment transaction from recent activity/search. Confirm bill paid metadata and account balance reconcile.
- Record paycheck/scheduled income split. Confirm each destination account receives its configured amount and post-income action completion awards progress.

## Business Tracking

- Add business income for a setup-created business. Confirm the selected destination account increases and a business transaction is created.
- Edit that business income amount/account. Confirm old account/new account balances reconcile.
- Delete that business income. Confirm the linked transaction is deleted and cash reverses.
- Repeat the same add/edit/delete path for business expenses.
- Add/edit/delete mileage. Confirm mileage records validate miles greater than zero and do not move cash.

## Forecasts And NOVA State

- Create multiple accounts in the same profile. Set a floor on a secondary account and add upcoming bills/income. Confirm variance flags the secondary account if it dips.
- Open household, personal, and business calendar modes. Confirm rows use setup-created account names and business names.
- Trigger a red or yellow variance state, then log income. Confirm NOVA remains in the risk state instead of stale payday/green copy.

## Export And Import

- Export all JSON backup. Import it into a clean install and confirm accounts, transactions, bills, businesses, badges, config, and card settings restore.
- Export household JSON backup. Import it into an existing install and confirm household records merge without deleting business data.
- Export business JSON backup. Import it into an existing install and confirm businesses, accounts, income, expenses, mileage, and business transactions merge.
- Export business CSVs. Confirm summary, income, expenses, mileage, and transactions include ISO dates, cents-derived dollar values, account key/name, business id/name, and transaction ids.
- Export an account CSV after edits/deletes. Confirm `Balance After` follows real ledger balances.
