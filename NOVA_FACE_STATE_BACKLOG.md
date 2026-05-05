# NOVA Face And State Backlog

This is the next build-session checklist for replacing the generic SVG face placeholders with production NOVA expressions.

## Current Build Status

- Static custom SVG face family v1 is installed in `src/components/NovaFace.js`.
- The in-app faces now inherit the icon/splash model: circular scanner halo, inner clover contour, four cardinal ports, dot trails, reticle eyes, and signal-mouth expressions.
- The next art pass should add animation timing and polish line weights at final Android device scale.

## Implemented State Faces

- `neutral`: standby face for loading, idle, or no data.
- `green_smug`: all profiles stable, no detected shortfalls.
- `yellow_calculating`: recoverable budget strain or variance warning.
- `red_alert`: overdraft or projected shortfall risk.
- `comma_elated`: an account crosses the $1,000 comma threshold.
- `comma_lost_grief`: an account drops below the $1,000 comma threshold.
- `savings_withdrawal_concern`: savings balance decreases or savings is used for spending.
- `fresh_month_optimistic`: cycle/month reset with clean projections.
- `payday_relief`: paycheck or partner deposit arrives.
- `zero_waste_pride`: closed grocery week stays at or under budget.
- `overflow_transcendent`: monthly surplus moved to overflow.
- `bill_paid_relief`: bill marked paid without an immediate floor warning.
- `grocery_warning`: grocery budget exceeds weekly limit.
- `floor_warning`: account balance approaches or breaches configured floor.
- `confirm_balance`: user confirms account balances.
- `post_payday_antsy`: post-payday transfers are pending.

## Additional States To Script

- `cashflow_recovered`: red or yellow returns to green after a corrective transaction.
- `bill_due_soon`: bill due within the next 72 hours, covered but worth surfacing.
- `bill_past_due`: active bill due date passed without a paid marker.
- `partner_deposit_missing`: partnered mode month closes without expected partner deposit.
- `large_transaction`: unusually large debit or credit relative to the user's normal activity.
- `manual_balance_edit`: user edits a balance directly; good moment for verification language.
- `savings_goal_reached`: linked savings goal reaches target.
- `savings_goal_slipped`: linked savings goal was reached and then falls below target.
- `business_profit`: business profile moves from strained to profitable projection.
- `business_loss`: business profile drops into negative projected variance.
- `data_stale`: no balance confirmation or transaction activity for 48+ hours.
- `onboarding_complete`: first successful setup completion.
- `account_added`: new account enters the registry.
- `bill_added`: new recurring bill enters forecasting.
- `export_success`: data export completes.
- `export_failure`: data export fails or Android share sheet rejects.
- `notification_permission_needed`: alerts are configured but permissions are missing.

## Face Direction Notes

- Keep the face language scanner-like: reticle eyes, ring pulses, brow slashes, mouth as a vector signal, not a cartoon mouth.
- Each state needs a static expression first, then optional micro-animation: blink, scan sweep, pulse, or alert flicker.
- Red, floor warning, and bill past due should feel urgent without becoming visually noisy.
- Green, payday, zero waste, and overflow can glow brighter, but should stay in the same classified HUD family.
- Avoid literal human emotion drawing. NOVA should read as a machine intelligence simulating expression through tactical symbols.
