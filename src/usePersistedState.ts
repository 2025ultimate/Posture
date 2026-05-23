import { useState, useEffect, useRef } from "react";

export function usePersistedState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return initial;
      return JSON.parse(stored) as T;
    } catch {
      return initial;
    }
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // localStorage may be full or disabled (private mode, etc.)
    }
  }, [value]);

  return [value, setValue];
}
