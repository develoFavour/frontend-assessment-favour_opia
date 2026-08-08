import { useSyncExternalStore } from 'react';

const store = {
  subscribe(callback: () => void) {
    window.addEventListener('popstate', callback);
    window.addEventListener('urlchange', callback);
    return () => {
      window.removeEventListener('popstate', callback);
      window.removeEventListener('urlchange', callback);
    };
  },
  getSnapshot() {
    return window.location.search;
  }
};

export function useURLStore() {
  const search = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const params = new URLSearchParams(search);

  const setFilter = (key: string, value: string | string[] | null) => {
    const newParams = new URLSearchParams(window.location.search);
    
    if (Array.isArray(value)) {
      newParams.delete(key);
      value.forEach(v => newParams.append(key, v));
    } else if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }

    const newSearch = newParams.toString();
    const newUrl = newSearch ? `?${newSearch}` : window.location.pathname;
    
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new Event('urlchange'));
  };

  return { params, setFilter };
}
