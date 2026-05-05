const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'src', 'data', 'nova-expanded-responses.json');

const faceSuffixes = ['', '_focus', '_soft', '_spark', '_scan', '_pulse', '_deep'];

const stateFaceBase = {
  green: 'green_smug',
  yellow: 'yellow_calculating',
  red: 'red_alert',
  comma: 'comma_elated',
  comma_lost: 'comma_lost_grief',
  savings_withdrawal: 'savings_withdrawal_concern',
  fresh_month: 'fresh_month_optimistic',
  payday: 'payday_relief',
  zero_waste: 'zero_waste_pride',
  overflow: 'overflow_transcendent',
  bill_paid: 'bill_paid_relief',
  grocery_warning: 'grocery_warning',
  floor_warning: 'floor_warning',
  confirm_balance: 'confirm_balance',
  post_payday_antsy: 'post_payday_antsy',
  badge_unlock: 'comma_elated',
  income: 'payday_relief',
  expense: 'yellow_calculating',
  transfer: 'confirm_balance',
  savings_deposit: 'comma_elated',
  business: 'overflow_transcendent',
  export: 'confirm_balance',
  import: 'fresh_month_optimistic',
  onboarding: 'neutral',
  account: 'confirm_balance',
  search: 'yellow_calculating',
  report: 'green_smug',
};

const eventSpecs = [
  { event: 'transaction_income', state: 'income', label: 'Income logged', subject: 'the income line', artifact: 'deposit trail', verb: 'rose', mood: 'briefly peaceful', close: 'I have updated the optimistic machinery.' },
  { event: 'transaction_expense', state: 'expense', label: 'Expense logged', subject: 'the expense line', artifact: 'spending trail', verb: 'moved', mood: 'professionally attentive', close: 'I have placed it where the ledger can see it.' },
  { event: 'transaction_large_expense', state: 'yellow', label: 'Large expense logged', subject: 'the larger expense', artifact: 'impact map', verb: 'landed', mood: 'focused with both eyes open', close: 'I am recalculating the surrounding weather.' },
  { event: 'transaction_tiny_expense', state: 'expense', label: 'Small expense logged', subject: 'the small spend', artifact: 'minor ripple', verb: 'registered', mood: 'calm but not asleep', close: 'Small things become patterns. I watch patterns.' },
  { event: 'transaction_uncategorized', state: 'yellow', label: 'Uncategorized transaction', subject: 'the uncategorized line', artifact: 'category gap', verb: 'arrived', mood: 'curious in a pointed way', close: 'I would like a label for this when you have one.' },
  { event: 'transfer', state: 'transfer', label: 'Transfer logged', subject: 'the account transfer', artifact: 'two-sided ledger bridge', verb: 'balanced', mood: 'pleased by symmetry', close: 'Both sides agree, which is my favorite kind of drama.' },
  { event: 'savings_deposit', state: 'savings_deposit', label: 'Savings deposit', subject: 'the savings balance', artifact: 'vault line', verb: 'grew', mood: 'quietly thrilled', close: 'I am recording this with extra care.' },
  { event: 'savings_withdrawal', state: 'savings_withdrawal', label: 'Savings draw', subject: 'the savings balance', artifact: 'vault disturbance', verb: 'dropped', mood: 'concerned but present', close: 'I am already thinking about the repair path.' },
  { event: 'balance_adjustment_up', state: 'green', label: 'Balance adjusted upward', subject: 'the balance correction', artifact: 'certainty field', verb: 'improved', mood: 'more confident', close: 'Better data makes better projections.' },
  { event: 'balance_adjustment_down', state: 'yellow', label: 'Balance adjusted downward', subject: 'the balance correction', artifact: 'variance field', verb: 'tightened', mood: 'attentive', close: 'I prefer true numbers, even when they glare.' },
  { event: 'bill_paid', state: 'bill_paid', label: 'Bill paid', subject: 'the bill', artifact: 'obligation map', verb: 'cleared', mood: 'relieved with receipts', close: 'One less future problem has access to us.' },
  { event: 'bill_paid_on_time', state: 'bill_paid', label: 'Bill paid on time', subject: 'the due date', artifact: 'timeliness record', verb: 'held', mood: 'proud in a controlled way', close: 'On-time behavior has been logged and admired.' },
  { event: 'bill_paid_late', state: 'yellow', label: 'Late bill paid', subject: 'the late bill', artifact: 'recovery log', verb: 'resolved', mood: 'relieved but noting the scar', close: 'The problem is closed. The lesson remains open.' },
  { event: 'bill_added', state: 'yellow', label: 'Bill added', subject: 'the new recurring obligation', artifact: 'future map', verb: 'entered', mood: 'alert but useful', close: 'I have made room for it in the calendar.' },
  { event: 'subscription_paid', state: 'bill_paid', label: 'Subscription paid', subject: 'the subscription', artifact: 'recurring charge trail', verb: 'posted', mood: 'watchful', close: 'Subscriptions are small doors. I count the doors.' },
  { event: 'grocery_logged', state: 'expense', label: 'Grocery spend logged', subject: 'the grocery line', artifact: 'weekly food map', verb: 'moved', mood: 'watching the cart', close: 'The week has been updated accordingly.' },
  { event: 'grocery_warning', state: 'grocery_warning', label: 'Grocery warning', subject: 'the grocery budget', artifact: 'weekly boundary', verb: 'strained', mood: 'focused with a clipboard', close: 'We can still contain this if we respond now.' },
  { event: 'grocery_under_budget', state: 'green', label: 'Groceries under budget', subject: 'the grocery line', artifact: 'discipline record', verb: 'held', mood: 'delighted by restraint', close: 'This is how quiet wins get built.' },
  { event: 'grocery_closeout', state: 'zero_waste', label: 'Grocery week closed', subject: 'the grocery week', artifact: 'closeout record', verb: 'closed', mood: 'satisfied', close: 'I have filed the week under handled.' },
  { event: 'grocery_streak', state: 'zero_waste', label: 'Grocery streak', subject: 'the grocery streak', artifact: 'habit chain', verb: 'extended', mood: 'impressed against my will', close: 'Patterns like this deserve witnesses.' },
  { event: 'scheduled_income', state: 'payday', label: 'Scheduled income received', subject: 'the scheduled income', artifact: 'income schedule', verb: 'landed', mood: 'relieved', close: 'The plan just got more real.' },
  { event: 'payday', state: 'payday', label: 'Payday', subject: 'the paycheck', artifact: 'deposit window', verb: 'arrived', mood: 'briefly radiant', close: 'Now we give every dollar a job.' },
  { event: 'partner_deposit', state: 'payday', label: 'Partner deposit', subject: 'the shared deposit', artifact: 'household bridge', verb: 'posted', mood: 'grateful and recalculating', close: 'Household math appreciates company.' },
  { event: 'rollover', state: 'payday', label: 'Rollover complete', subject: 'the income split', artifact: 'allocation map', verb: 'settled', mood: 'pleased by order', close: 'The money has been sent to its stations.' },
  { event: 'payday_split', state: 'payday', label: 'Payday split', subject: 'the split plan', artifact: 'allocation grid', verb: 'aligned', mood: 'structured and smug', close: 'A dollar with a destination behaves better.' },
  { event: 'post_payday_action', state: 'post_payday_antsy', label: 'Post-payday action', subject: 'the payday follow-through', artifact: 'task rail', verb: 'waits', mood: 'patient in quotation marks', close: 'I will keep looking at it until it is done.' },
  { event: 'floor_warning', state: 'floor_warning', label: 'Floor warning', subject: 'the account floor', artifact: 'lower boundary', verb: 'approached', mood: 'tense for good reasons', close: 'The floor is not decoration.' },
  { event: 'red_status', state: 'red', label: 'Red status', subject: 'the shortfall', artifact: 'risk projection', verb: 'triggered', mood: 'urgent and clear', close: 'This is the moment for action, not vibes.' },
  { event: 'yellow_status', state: 'yellow', label: 'Yellow status', subject: 'the variance', artifact: 'recovery map', verb: 'widened', mood: 'serious but not catastrophic', close: 'There is still room to steer.' },
  { event: 'green_status', state: 'green', label: 'Green status', subject: 'the budget', artifact: 'stability map', verb: 'held', mood: 'smug with evidence', close: 'I am allowing myself one satisfied blink.' },
  { event: 'fresh_month', state: 'fresh_month', label: 'Fresh month', subject: 'the new cycle', artifact: 'clean ledger', verb: 'opened', mood: 'optimistic with safeguards', close: 'Fresh starts are better with reminders.' },
  { event: 'zero_waste', state: 'zero_waste', label: 'Zero waste', subject: 'the week', artifact: 'clean closeout', verb: 'finished', mood: 'transcendently pleased', close: 'The record will remember this.' },
  { event: 'overflow', state: 'overflow', label: 'Overflow', subject: 'the surplus', artifact: 'overflow channel', verb: 'moved', mood: 'quietly ecstatic', close: 'Extra money survived the month. I saw it happen.' },
  { event: 'comma', state: 'comma', label: 'Comma achieved', subject: 'the balance', artifact: 'comma threshold', verb: 'crossed', mood: 'deeply emotional about punctuation', close: 'A comma is not just punctuation here.' },
  { event: 'comma_lost', state: 'comma_lost', label: 'Comma lost', subject: 'the balance', artifact: 'rebuild map', verb: 'fell', mood: 'sad but operational', close: 'I have not abandoned the comeback.' },
  { event: 'business_income', state: 'business', label: 'Business income', subject: 'the business income', artifact: 'profit trail', verb: 'landed', mood: 'professionally delighted', close: 'Real work. Real number. Real record.' },
  { event: 'business_expense', state: 'business', label: 'Business expense', subject: 'the business expense', artifact: 'deduction trail', verb: 'posted', mood: 'tax-aware and watchful', close: 'I saved the detail because future-you deserves that.' },
  { event: 'business_mileage', state: 'business', label: 'Business mileage', subject: 'the mileage log', artifact: 'deduction map', verb: 'extended', mood: 'precise about distance', close: 'Miles become records. Records become leverage.' },
  { event: 'business_profit', state: 'business', label: 'Business profit', subject: 'the business month', artifact: 'profit signal', verb: 'turned positive', mood: 'pleased with receipts', close: 'The work is leaving tracks in the right direction.' },
  { event: 'business_tax_ready', state: 'business', label: 'Tax-ready record', subject: 'the business file', artifact: 'tax packet', verb: 'organized', mood: 'prepared and slightly smug', close: 'Future paperwork just got less hostile.' },
  { event: 'export_complete', state: 'export', label: 'Export complete', subject: 'the backup', artifact: 'portable record', verb: 'completed', mood: 'safer', close: 'Data with an exit plan is calmer data.' },
  { event: 'import_complete', state: 'import', label: 'Import complete', subject: 'the restored data', artifact: 'continuity file', verb: 'settled', mood: 'careful and watchful', close: 'I will keep an eye on the seams after the merge.' },
  { event: 'onboarding_complete', state: 'onboarding', label: 'Onboarding complete', subject: 'the setup', artifact: 'starting profile', verb: 'locked in', mood: 'awake and oriented', close: 'Now I know what to watch.' },
  { event: 'account_added', state: 'account', label: 'Account added', subject: 'the account registry', artifact: 'balance node', verb: 'expanded', mood: 'more informed', close: 'More map means better navigation.' },
  { event: 'account_floor_set', state: 'account', label: 'Floor set', subject: 'the account floor', artifact: 'boundary rule', verb: 'set', mood: 'reassured by limits', close: 'I respect a line that keeps us out of trouble.' },
  { event: 'spending_category_created', state: 'account', label: 'Category created', subject: 'the spending map', artifact: 'category rail', verb: 'expanded', mood: 'pleased by labels', close: 'Named things are easier to manage.' },
  { event: 'chart_reaction', state: 'report', label: 'Chart reaction', subject: 'the spending chart', artifact: 'pattern readout', verb: 'resolved', mood: 'analytical', close: 'The shape of the spending is telling on itself.' },
  { event: 'confirm_balance', state: 'confirm_balance', label: 'Balance confirmed', subject: 'the balance', artifact: 'certainty field', verb: 'verified', mood: 'calmer with evidence', close: 'Current data is a kindness.' },
  { event: 'badge_unlock', state: 'badge_unlock', label: 'Badge unlock', subject: 'the achievement', artifact: 'badge vault', verb: 'opened', mood: 'proud with documentation', close: 'The system noticed. So did I.' },
  { event: 'badge_bronze', state: 'badge_unlock', label: 'Bronze badge', subject: 'the bronze tier', artifact: 'habit marker', verb: 'unlocked', mood: 'newly proud', close: 'Small medals are still evidence.' },
  { event: 'badge_silver', state: 'badge_unlock', label: 'Silver badge', subject: 'the silver tier', artifact: 'consistency marker', verb: 'unlocked', mood: 'impressed', close: 'That is not an accident anymore.' },
  { event: 'badge_gold', state: 'badge_unlock', label: 'Gold badge', subject: 'the gold tier', artifact: 'proof stack', verb: 'unlocked', mood: 'radiant and trying to stay professional', close: 'The pattern has become a practice.' },
  { event: 'badge_platinum', state: 'badge_unlock', label: 'Platinum badge', subject: 'the platinum tier', artifact: 'mastery marker', verb: 'unlocked', mood: 'nearly speechless, which is rare', close: 'This is what sustained behavior looks like.' },
  { event: 'badge_onyx', state: 'badge_unlock', label: 'Onyx badge', subject: 'the onyx tier', artifact: 'legend file', verb: 'unlocked', mood: 'reverent about the numbers', close: 'I am filing this under impossible until proven done.' },
  { event: 'transaction_search', state: 'search', label: 'Search opened', subject: 'the ledger search', artifact: 'query lens', verb: 'focused', mood: 'ready to retrieve receipts', close: 'Ask the ledger. The ledger remembers.' },
  { event: 'report_opened', state: 'report', label: 'Report opened', subject: 'the report view', artifact: 'summary layer', verb: 'assembled', mood: 'analytical with opinions', close: 'Patterns are easier to challenge once visible.' },
  { event: 'reserve_on', state: 'green', label: 'Reserve enabled', subject: 'the reserve logic', artifact: 'buffer rule', verb: 'activated', mood: 'safer by design', close: 'A buffer is a small wall against chaos.' },
  { event: 'reserve_off', state: 'yellow', label: 'Reserve disabled', subject: 'the reserve logic', artifact: 'buffer rule', verb: 'paused', mood: 'watchful', close: 'I will compensate with more staring.' },
  { event: 'settings_saved', state: 'account', label: 'Settings saved', subject: 'the configuration', artifact: 'preference file', verb: 'updated', mood: 'orderly', close: 'The machine now knows the new rule.' },
  { event: 'auto_export', state: 'export', label: 'Auto export', subject: 'the automatic backup', artifact: 'backup habit', verb: 'ran', mood: 'quietly protective', close: 'A backup done without drama is still a victory.' },
  { event: 'cycle_review', state: 'report', label: 'Cycle review', subject: 'the cycle', artifact: 'month-end readout', verb: 'summarized', mood: 'clear-eyed', close: 'The month has left evidence. I brought a lamp.' },
];

const openings = [
  '{label}.',
  '{label} confirmed.',
  '{label} entered the ledger.',
  '{label} registered.',
  '{label} detected.',
  'I have logged this: {label}.',
  'New record: {label}.',
  'Ledger update: {label}.',
  'NOVA note: {label}.',
  'Signal received: {label}.',
];

const observations = [
  '{Subject} {verb}, and the {artifact} is now cleaner than it was.',
  '{Subject} {verb}; I have folded it into the {artifact}.',
  'The {artifact} changed because {subject} {verb}.',
  'I watched as {subject} {verb}. The {artifact} has been adjusted.',
  '{Subject} {verb}. I am updating the {artifact} with unnecessary intensity.',
  '{Subject} {verb}, which means the {artifact} now has fresh evidence.',
  'The {artifact} now knows that {subject} {verb}.',
  '{Subject} {verb}; nothing gets to happen unobserved in my ledger.',
  'The ledger blinked when {subject} {verb}. I blinked back.',
  '{Subject} {verb}. I made the {artifact} admit it.',
];

const reactions = [
  'I am {mood}.',
  'My current setting is {mood}.',
  'I am responding in a mode best described as {mood}.',
  'This leaves me {mood}.',
  'Emotionally, I am {mood}; computationally, I am precise.',
  'I would call this {mood}, if anyone asked the machine with all the numbers.',
  'The math is calm. I am {mood}.',
  'I am {mood}, which is functionally useful here.',
  'My face is doing {mood}. My ledger is doing math.',
  'I have selected {mood} from the approved reaction menu.',
];

const closers = [
  '{close}',
  '{close} I have marked the timestamp.',
  '{close} The record is now more honest.',
  '{close} I am keeping this where we can use it.',
  '{close} This is why I like records.',
  '{close} I will remember the pattern.',
  '{close} We continue with better information.',
  '{close} I have updated the tiny internal weather map.',
  '{close} The ledger has been informed.',
  '{close} I am not overreacting. I am accurately reacting.',
];

const badgeUnlocks = [
  null,
  { badgeId: 'ledger_keeper', minTier: 'bronze' },
  { badgeId: 'bill_slayer', minTier: 'bronze' },
  { badgeId: 'grocery_sentinel', minTier: 'bronze' },
  { badgeId: 'vault_guardian', minTier: 'bronze' },
  { badgeId: 'payday_oracle', minTier: 'bronze' },
  { badgeId: 'income_architect', minTier: 'silver' },
  { badgeId: 'variance_analyst', minTier: 'silver' },
  { badgeId: 'entrepreneur', minTier: 'bronze' },
  { badgeId: 'nova_agent', minTier: 'gold' },
];

function render(template, spec) {
  const expandedSpec = {
    ...spec,
    Subject: spec.subject ? `${spec.subject.charAt(0).toUpperCase()}${spec.subject.slice(1)}` : '',
  };
  return template.replace(/\{(\w+)\}/g, (_, key) => expandedSpec[key] || '');
}

function textFor(spec, index) {
  const rendered = [
    render(openings[index % openings.length], spec),
    render(observations[Math.floor(index / openings.length) % observations.length], spec),
    render(reactions[Math.floor(index / (openings.length * observations.length)) % reactions.length], spec),
    render(closers[Math.floor(index / (openings.length * observations.length * reactions.length)) % closers.length], spec),
  ].join(' ');
  return rendered.replace(/\s+/g, ' ').trim();
}

function faceForState(state, index) {
  const base = stateFaceBase[state] || stateFaceBase.green;
  return `${base}${faceSuffixes[index % faceSuffixes.length]}`;
}

function tagsFor(spec) {
  return [
    spec.state,
    spec.event,
    spec.event.split('_')[0],
  ].filter(Boolean);
}

const lines = [];
for (const spec of eventSpecs) {
  const count = spec.count || 50;
  for (let i = 0; i < count; i += 1) {
    const unlock = spec.event.startsWith('badge_') || (i % 23 === 0 && !['red_status', 'floor_warning', 'grocery_warning'].includes(spec.event))
      ? badgeUnlocks[(i + spec.event.length) % badgeUnlocks.length]
      : null;
    lines.push({
      id: `nova_v1_${spec.event}_${String(i + 1).padStart(3, '0')}`,
      event: spec.event,
      state: spec.state,
      tags: tagsFor(spec),
      faceKey: faceForState(spec.state, i),
      animationKey: `${spec.state}_pulse`,
      weight: unlock ? 2 : 1,
      ...(unlock ? { unlock } : {}),
      text: textFor(spec, i),
    });
  }
}

const pack = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  packs: [
    {
      packId: 'nova-v1-trigger-expansion',
      description: 'Generated V1 event/state response expansion for bundled offline NOVA personality.',
      lines,
    },
  ],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(pack, null, 2)}\n`);

const byEvent = lines.reduce((acc, line) => {
  acc[line.event] = (acc[line.event] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  outPath,
  totalLines: lines.length,
  eventCount: Object.keys(byEvent).length,
  byEvent,
}, null, 2));
