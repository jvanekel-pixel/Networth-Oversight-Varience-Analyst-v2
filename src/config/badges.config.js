export const BADGES = [
  { id: 'first_log', name: 'First Log', description: 'First transaction logged', earned: false, earnedAt: null, icon: '📝' },
  { id: 'rollover_king', name: 'Rollover King', description: 'First ENT Checking rollover sweep', earned: false, earnedAt: null, icon: '🏆' },
  { id: 'grocery_discipline', name: 'Grocery Discipline', description: '4 consecutive weeks under grocery budget', earned: false, earnedAt: null, icon: '🥦' },
  { id: 'balance_confirmed', name: 'Balance Confirmed', description: '7-day Confirm Balance streak', earned: false, earnedAt: null, icon: '✅' },
  { id: 'comma_club', name: 'Comma Club', description: 'Any savings account reaches $1,000', earned: false, earnedAt: null, icon: '💰' },
  { id: 'llc_launched', name: 'LLC Launched', description: 'First Cleaning LLC expense logged', earned: false, earnedAt: null, icon: '🏢' },
  { id: 'massage_income', name: 'First Session', description: 'First massage income logged', earned: false, earnedAt: null, icon: '💆' },
  { id: 'cycle_complete', name: 'Full Cycle', description: 'Complete one full calendar month with all bills marked paid', earned: false, earnedAt: null, icon: '📅' },
];

export const getDefaultBadges = () => BADGES.map(b => ({ ...b }));
