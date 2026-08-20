import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "openadam.state-machine.draft.v0.1";

interface History {
  past: string[];
  present: string;
  future: string[];
}

export function useDocumentSource(sample: string) {
  const [history, setHistory] = useState<History>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return { past: [], present: saved ?? sample, future: [] };
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, history.present);
  }, [history.present]);

  const setSource = useCallback((next: string) => {
    setHistory((current) => {
      if (current.present === next) return current;
      return {
        past: [...current.past.slice(-99), current.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (previous === undefined) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (next === undefined) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback(() => setSource(sample), [sample, setSource]);

  return {
    source: history.present,
    setSource,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

