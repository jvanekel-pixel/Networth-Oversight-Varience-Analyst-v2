import React, { createContext, useContext, useState } from 'react';

const WizardContext = createContext(null);

const initialWizardState = {
  userMode: null,
  entrepreneurMode: false,
  wizardAccounts: [],
  incomeConfig: {
    type: null,
    paydayDate: '',
    paycheckAmountCents: 0,
    payFrequency: 'biweekly',
  },
  bills: [],
  buckets: [],
  savingsGoal: null,
  wizardBusinesses: [],
};

export function WizardProvider({ children }) {
  const [wizardState, setWizardState] = useState(initialWizardState);

  const updateWizard = (partial) =>
    setWizardState((prev) => ({ ...prev, ...partial }));

  return (
    <WizardContext.Provider value={{ wizardState, updateWizard }}>
      {children}
    </WizardContext.Provider>
  );
}

export const useWizard = () => useContext(WizardContext);
