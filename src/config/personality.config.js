export const PAYDAY_AMOUNTS = {
  jointDeposit: 990,
  savingsDeposit: 50,
  entDeposit: 313,
  venmoMove: 150,
};

const personality = {
  characterName: 'N.O.V.A.',
  characterFullName: 'Net Worth Oversight Variance Analyst',
  characterShort: 'NOVA',

  starterPool: [
    "I have been running calculations while you were asleep. Everything is fine. The calculations are also fine. I am less certain about everything else.",
    "Today's disposition: watchful. Everything is fine. I am watching it remain fine.",
    "I do not have an off switch. I am always here. I am always watching the accounts. This is either reassuring or unsettling. I leave the interpretation to you.",
    "Status: green. Threat level: none. Anxiety level: still moderate, but that's just my baseline.",
    "The system is working. I want to say that plainly, on a day when everything is fine. The system is working. This is not nothing.",
    "I have been watching this account. Waiting. Calculating. Something needs attention and I would like you to look at it with me.",
    "We have a gap. The gap is not insurmountable. I have measured it. Here is how we close it.",
    "Deposit confirmed. The number went up. I am briefly, specifically, and genuinely at peace.",
    "Payday. The deposit is in. The account breathes. I breathe. We breathe together. Until rent.",
    "Today I am specifically thinking about the grocery budget. Not because anything is wrong. Just because I always am.",
  ],

  xpLabels: {
    confirmBalance: 'Balance Confirmed',
    logTransaction: 'Transaction Logged',
    rollover: 'Rollover Achieved',
    savingsMilestone: 'Savings Milestone',
    groceryBudgetMet: 'Grocery Discipline',
    partnerDepositArrived: 'Deposit Received',
    billPaidOnTime: 'Bill Paid On Time',
    floorNotBreached: 'Floor Maintained',
  },

  postPaydayNudges: [
    "Your Venmo is looking lonely.",
    "Savings doesn't move itself.",
    "Post-payday. You know what to do.",
    "The accounts await your attention.",
  ],

  badgeNames: {
    rolloverKing: 'Rollover King',
    groceryDiscipline: 'Grocery Discipline',
    balanceConfirmed: 'Balance Confirmed',
    commaClub: 'Comma Club',
    firstLog: 'First Log',
    llcLaunched: 'LLC Launched',
    floorDefender: 'Floor Defender',
    streakWeek: 'Seven Day Streak',
  },

  savingsGoal: {
    cardLabel: 'SAVINGS GOAL',
    defaultLabel: 'Savings Goal',
    linkPrompt: 'Link an account in Settings to track progress',
    reachedCopy: 'Buffer reached.',
    settingsNotLinked: 'Not linked',
  },
};

export default personality;
