import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "openadam.state-machine.draft.v0.1";

interface History {
  past: string[];
  present: string;
  future: string[];
}

const PERSISTENCE_ERROR = "Draft persistence is unavailable. Changes remain in this tab but may be lost on reload.";

function loadInitialDocument(sample: string): { source: string; persistenceError: string | null } {
  try {
    return { source: window.localStorage.getItem(STORAGE_KEY) ?? sample, persistenceError: null };
  } catch {
    return { source: sample, persistenceError: PERSISTENCE_ERROR };
  }
}

export function useDocumentSource(sample: string) {
  const [initialDocument] = useState(() => loadInitialDocument(sample));
  const [history, setHistory] = useState<History>(() => ({ past: [], present: initialDocument.source, future: [] }));
  const [persistenceError, setPersistenceError] = useState<string | null>(initialDocument.persistenceError);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, history.present);
      setPersistenceError(null);
    } catch {
      setPersistenceError(PERSISTENCE_ERROR);
    }
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
    persistenceError,
  };
}
