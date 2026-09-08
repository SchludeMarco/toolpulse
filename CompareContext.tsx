import { createContext, useContext, useState, type ReactNode } from "react";

interface CompareState {
  selected: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareState | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev
    );
  };

  const clear = () => setSelected([]);

  return (
    <CompareContext.Provider value={{ selected, toggle, clear }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare muss innerhalb von CompareProvider stehen");
  return ctx;
}
