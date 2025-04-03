export const getUsageDataFromLocalStorage = (timePeriod) => {
    const storageKey = `usageData_${timePeriod}`;
    const storedData = localStorage.getItem(storageKey);
    if (storedData) {
      return JSON.parse(storedData);
    }
    return null;
  };