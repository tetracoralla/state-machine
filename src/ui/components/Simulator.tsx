import { useEffect, useMemo, useState } from "react";

import { initialSnapshot, stepMachine } from "../../core/step.js";
import type { GuardCheck, MachineSpec, Snapshot, StepRejection, StepSuccess } from "../../model/types.js";
import { EventPayloadForm, payloadFromForm } from "./EventPayloadForm.js";

interface SimulatorProps {
  machine: MachineSpec;
  revision: string;
  onStateChange: (state: string) => void;
}

type TraceStep = StepSuccess | StepRejection;

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function guardText(guards: GuardCheck[]): string | null {
  const guard = guards[0];
  if (!guard) return null;
  return `${guard.name}: ${guard.outcome === null ? "unset" : guard.outcome ? "pass" : "fail"}`;
}

export function Simulator({ machine, revision, onStateChange }: SimulatorProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => initialSnapshot(machine));
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [payloadValues, setPayloadValues] = useState<Record<string, string | boolean>>({});
  const [guardOutcome, setGuardOutcome] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = useMemo(
    () => Object.keys(machine.states[snapshot.state]?.on ?? {}).sort(codeUnitCompare),
    [machine, snapshot.state],
  );

  useEffect(() => {
    const next = initialSnapshot(machine);
    setSnapshot(next);
    setTrace([]);
    setSelectedEvent(Object.keys(machine.states[next.state]?.on ?? {}).sort(codeUnitCompare)[0] ?? "");
    setPayloadValues({});
    setGuardOutcome(null);
    setError(null);
    onStateChange(next.state);
  }, [machine, revision, onStateChange]);

  useEffect(() => {
    if (!enabled.includes(selectedEvent)) setSelectedEvent(enabled[0] ?? "");
  }, [enabled, selectedEvent]);

  useEffect(() => {
    setPayloadValues({});
    setGuardOutcome(null);
    setError(null);
  }, [selectedEvent]);

  const transition = machine.states[snapshot.state]?.on?.[selectedEvent];
  const eventDefinition = machine.events[selectedEvent];

  function reset() {
    const next = initialSnapshot(machine);
    setSnapshot(next);
    setTrace([]);
    setError(null);
    setGuardOutcome(null);
    onStateChange(next.state);
  }

  function runEvent() {
    if (!selectedEvent || !eventDefinition || !transition) return;
    const payloadResult = payloadFromForm(eventDefinition, payloadValues);
    if (!payloadResult.ok) {
      setError(payloadResult.message);
      return;
    }
    const result = stepMachine({
      machine,
      snapshot,
      event: {
        type: selectedEvent,
        ...(Object.keys(payloadResult.payload).length > 0 ? { payload: payloadResult.payload } : {}),
      },
      ...(transition.guard && guardOutcome !== null ? { guard_results: { [transition.guard]: guardOutcome } } : {}),
    });
    if (result.status === "error") {
      setError(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setTrace((current) => [...current, result]);
    setError(null);
    if (result.accepted) {
      setSnapshot(result.after);
      onStateChange(result.after.state);
    }
  }

  return (
    <section className="panel simulator-panel" aria-labelledby="simulator-title">
      <div className="panel-heading simulator-heading">
        <div>
          <h2 id="simulator-title">Simulator</h2>
          <span>Side-effect free</span>
        </div>
        <button type="button" className="quiet-button" onClick={reset}>Reset run</button>
      </div>
      <div className="simulator-layout">
        <div className="snapshot-column">
          <p className="eyebrow">Current state</p>
          <div className="current-state-card">
            <strong>{machine.states[snapshot.state]?.title ?? snapshot.state}</strong>
            <span>{snapshot.state}</span>
          </div>
          <details className="context-details">
            <summary>Context</summary>
            <pre>{JSON.stringify(snapshot.context, null, 2)}</pre>
          </details>
        </div>

        <div className="event-column">
          <p className="eyebrow">Available events</p>
          {enabled.length === 0 ? (
            <div className="terminal-state">Final state reached</div>
          ) : (
            <>
              <div className="event-tabs" aria-label="Available events">
                {enabled.map((eventName) => (
                  <button
                    key={eventName}
                    type="button"
                    aria-pressed={selectedEvent === eventName}
                    className={selectedEvent === eventName ? "event-tab event-tab-active" : "event-tab"}
                    onClick={() => setSelectedEvent(eventName)}
                  >
                    {eventName}
                  </button>
                ))}
              </div>
              {eventDefinition && (
                <EventPayloadForm definition={eventDefinition} values={payloadValues} onChange={setPayloadValues} />
              )}
              {transition?.guard && (
                <fieldset className="guard-control">
                  <legend>{transition.guard}</legend>
                  <div className="segmented-control">
                    <button type="button" aria-pressed={guardOutcome === null} onClick={() => setGuardOutcome(null)}>Unset</button>
                    <button type="button" aria-pressed={guardOutcome === true} onClick={() => setGuardOutcome(true)}>Pass</button>
                    <button type="button" aria-pressed={guardOutcome === false} onClick={() => setGuardOutcome(false)}>Fail</button>
                  </div>
                </fieldset>
              )}
              {error && <p className="inline-error" role="alert">{error}</p>}
              <button type="button" className="run-button" onClick={runEvent}>Run {selectedEvent}</button>
            </>
          )}
        </div>

        <div className="trace-column">
          <p className="eyebrow">Trace · {trace.length}</p>
          {trace.length === 0 ? (
            <div className="trace-start"><span>{snapshot.state}</span></div>
          ) : (
            <ol className="trace-list">
              {trace.map((step, index) => (
                <li key={`${step.before.state}-${step.event.type}-${index}`} className={step.accepted ? "trace-accepted" : "trace-rejected"}>
                  <div className="trace-line">
                    <span>{step.before.state}</span>
                    <strong>{step.event.type}</strong>
                    <span>{step.accepted ? step.after.state : "rejected"}</span>
                  </div>
                  <div className="trace-meta">
                    {!step.accepted && <span>{step.reason}</span>}
                    {guardText(step.guards) && <span>{guardText(step.guards)}</span>}
                    {step.effects.map((effect, effectIndex) => <span key={`${effect.type}-${effectIndex}`}>effect: {effect.type}</span>)}
                  </div>
                  {step.accepted && (Object.keys(step.context_changes).length > 0 || step.effects.length > 0) && (
                    <details className="trace-details">
                      <summary>Resolved changes</summary>
                      {Object.keys(step.context_changes).length > 0 && (
                        <div>
                          <strong>Context changes</strong>
                          <pre>{JSON.stringify(step.context_changes, null, 2)}</pre>
                        </div>
                      )}
                      {step.effects.length > 0 && (
                        <div>
                          <strong>Effect intents</strong>
                          <pre>{JSON.stringify(step.effects, null, 2)}</pre>
                        </div>
                      )}
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
