import { useEffect, useState } from "react";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)): [T, SetState<T>] {
  const [state, setState] = useState<T>(() => {
    const fromStorage = safeParseJson<T>(localStorage.getItem(key));
    if (fromStorage !== null) return fromStorage;
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }, [key, state]);

  return [state, setState];
}

