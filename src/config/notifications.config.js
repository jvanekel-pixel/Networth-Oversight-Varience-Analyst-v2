const notifications = {
  billDueAlert: {
    title: 'BILL INCOMING',
    body: '{billName} is due in {daysUntil} days. I have been tracking it. You should now also track it.',
  },
  spendingFloorWarning: {
    title: 'FLOOR APPROACHING',
    body: '{accountName} is at {percentRemaining}% above floor. I am noting this without alarm. You should note it with mild alarm.',
  },
  partnerDepositMissed: {
    title: 'DEPOSIT NOT LOGGED',
    body: 'No partner deposit has been recorded this month. Either it has not arrived or you have not told me. Either way: I am waiting.',
  },
  balanceConfirmationNudge: {
    title: 'I REQUIRE CONFIRMATION',
    body: 'It has been over 48 hours since you confirmed your balance. The numbers may have drifted. Open the app.',
  },
  weeklyVarianceSummary: {
    title: 'WEEKLY VARIANCE — {zone}',
    body: 'Zone {zone} is currently {state}. I have run the projections. You should look at them.',
  },
  savingsMilestone: {
    title: 'MILESTONE',
    body: 'Savings have reached {amount}. I am recording this. It is a meaningful number. Well done.',
  },
  novaDailyDisposition: {
    title: 'N.O.V.A. DAILY',
    bodies: [
      'I have been watching the accounts. Nothing has changed. I find this both reassuring and suspicious.',
      'Today is a good day to confirm your balance. Not because anything is wrong. Because precision matters.',
      'I have run projections. The month is trending within expected parameters. Proceed with moderate confidence.',
      'The grocery budget exists for a reason. I am not saying you overspent. I am saying I noticed.',
      'All bills are logged. All floors are intact. I am, briefly, at rest. Do not make me regret this.',
      'I do not sleep. I track. Open the app and let me confirm that everything is still fine.',
      'Variance is a signal, not a verdict. Check your zones. Then decide how to feel.',
      'A reminder: the paycheck is coming. The bills are also coming. One of these is more useful than the other.',
      'I have calculated your net trajectory this month. It is directionally correct. Execution is on you.',
      'Status nominal. Threat level: low. Suggestion: log something today so I have more data to work with.',
    ],
    defaultTime: '09:00',
  },
  payCycleReminder: {
    title: 'PAYDAY APPROACHING',
    body: 'Paycheck expected on {paycheckDate}. Rollover sweep will run automatically. Verify your account floors are correct.',
  },
  paydayReminder: {
    enabled: true,
    title: 'Payday 💰',
    body: 'Your paycheck should be in. Head to NOVA and record it.',
  },
};

export default notifications;
