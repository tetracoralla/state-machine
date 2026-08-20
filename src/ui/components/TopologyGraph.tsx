import { useEffect, useMemo, useState } from "react";

import { findPath } from "../../core/graph.js";
import { codeUnitCompare } from "../../model/ordering.js";
import type { MachineSpec, OperationError, PathResult } from "../../model/types.js";

interface TopologyGraphProps {
  machine: MachineSpec;
  currentState: string;
}

interface Position {
  x: number;
  y: number;
}

const NODE_WIDTH = 164;
const NODE_HEIGHT = 58;
const COLUMN_GAP = 108;
const ROW_GAP = 56;
const PADDING = 56;

function graphLayout(machine: MachineSpec) {
  const levels = new Map<string, number>([[machine.initial, 0]]);
  const queue = [machine.initial];
  while (queue.length > 0) {
    const stateId = queue.shift();
    if (!stateId) continue;
    const nextLevel = (levels.get(stateId) ?? 0) + 1;
    const targets = Object.values(machine.states[stateId]?.on ?? {})
      .map((transition) => transition.target)
      .sort(codeUnitCompare);
    for (const target of targets) {
      const known = levels.get(target);
      if (known === undefined || nextLevel < known) {
        levels.set(target, nextLevel);
        queue.push(target);
      }
    }
  }
  const fallbackLevel = Math.max(0, ...levels.values()) + 1;
  for (const stateId of Object.keys(machine.states)) if (!levels.has(stateId)) levels.set(stateId, fallbackLevel);

  const columns = new Map<number, string[]>();
  for (const [stateId, level] of [...levels.entries()].sort(([left], [right]) => codeUnitCompare(left, right))) {
    const column = columns.get(level) ?? [];
    column.push(stateId);
    columns.set(level, column);
  }
  const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
  const positions = new Map<string, Position>();
  for (const [level, stateIds] of columns) {
    const columnHeight = stateIds.length * NODE_HEIGHT + Math.max(0, stateIds.length - 1) * ROW_GAP;
    const totalHeight = maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP;
    const offset = (totalHeight - columnHeight) / 2;
    stateIds.forEach((stateId, row) => {
      positions.set(stateId, {
        x: PADDING + level * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + offset + row * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }
  return {
    positions,
    width: PADDING * 2 + (Math.max(...levels.values()) + 1) * NODE_WIDTH + Math.max(...levels.values()) * COLUMN_GAP,
    height: PADDING * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP,
  };
}

function edgePath(from: Position, to: Position): string {
  if (from.x === to.x && from.y === to.y) {
    const startX = from.x + NODE_WIDTH * 0.7;
    const startY = from.y;
    return `M ${startX} ${startY} C ${startX + 58} ${startY - 48}, ${startX + 58} ${startY + 48}, ${startX} ${startY + 8}`;
  }
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const direction = endX >= startX ? 1 : -1;
  const bend = Math.max(52, Math.abs(endX - startX) * 0.48);
  return `M ${startX} ${startY} C ${startX + bend * direction} ${startY}, ${endX - bend * direction} ${endY}, ${endX} ${endY}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function TopologyGraph({ machine, currentState }: TopologyGraphProps) {
  const stateIds = useMemo(() => Object.keys(machine.states).sort(codeUnitCompare), [machine]);
  const [target, setTarget] = useState(stateIds.find((id) => machine.states[id]?.final) ?? stateIds[0] ?? "");
  const [path, setPath] = useState<PathResult | OperationError | null>(null);
  const layout = useMemo(() => graphLayout(machine), [machine]);
  const transitions = useMemo(
    () =>
      Object.entries(machine.states).flatMap(([from, state]) =>
        Object.entries(state.on ?? {}).map(([event, transition]) => ({ from, event, transition })),
      ),
    [machine],
  );

  useEffect(() => {
    if (!machine.states[target]) setTarget(stateIds.find((id) => machine.states[id]?.final) ?? stateIds[0] ?? "");
    setPath(null);
  }, [machine, stateIds, target]);

  function calculatePath() {
    const result = findPath({ machine, from: currentState, target });
    setPath(result);
  }

  return (
    <section className="panel topology-panel" aria-labelledby="topology-title">
      <div className="panel-heading topology-heading">
        <div>
          <h2 id="topology-title">Topology</h2>
          <span>{stateIds.length} states · {transitions.length} transitions</span>
        </div>
        <div className="path-controls">
          <label htmlFor="path-target">Path to</label>
          <select id="path-target" value={target} onChange={(event) => setTarget(event.target.value)}>
            {stateIds.map((stateId) => <option key={stateId}>{stateId}</option>)}
          </select>
          <button type="button" className="dark-button" onClick={calculatePath}>Find</button>
        </div>
      </div>
      {path && (
        <div className={`path-result path-${path.status}`} role={path.status === "error" ? "alert" : "status"}>
          {path.status === "error" ? (
            <span>{path.error.code}: {path.error.message}</span>
          ) : path.status === "found" ? (
            path.steps.length === 0 ? <span>Already at {path.target}</span> : (
              <>
                {path.steps.map((step, index) => (
                  <span className="path-step" key={`${step.from}-${step.event}-${index}`}>
                    <strong>{step.event}</strong>{step.guard ? <em>{step.guard}</em> : null}
                  </span>
                ))}
              </>
            )
          ) : <span>No structural path from {path.from} to {path.target}</span>}
        </div>
      )}
      <div className="graph-scroll" tabIndex={0} aria-label="State topology diagram">
        <svg className="state-graph" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-labelledby="graph-title graph-description">
          <title id="graph-title">{machine.title ?? machine.id} topology</title>
          <desc id="graph-description">States and directed event transitions. The current simulator state is highlighted.</desc>
          <defs>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <g className="graph-edges">
            {transitions.map(({ from, event, transition }) => {
              const start = layout.positions.get(from);
              const end = layout.positions.get(transition.target);
              if (!start || !end) return null;
              const labelX = (start.x + NODE_WIDTH + end.x) / 2;
              const labelY = (start.y + end.y) / 2 + NODE_HEIGHT / 2 - 7;
              return (
                <g key={`${from}-${event}`}>
                  <path className="edge-line" d={edgePath(start, end)} markerEnd="url(#edge-arrow)" />
                  <text className="edge-label" x={labelX} y={labelY} textAnchor="middle">{truncate(event, 18)}</text>
                </g>
              );
            })}
          </g>
          <g className="graph-nodes">
            {stateIds.map((stateId) => {
              const position = layout.positions.get(stateId);
              const state = machine.states[stateId];
              if (!position || !state) return null;
              const active = currentState === stateId;
              return (
                <g key={stateId} className={`state-node ${active ? "state-node-active" : ""} ${state.final ? "state-node-final" : ""}`} transform={`translate(${position.x} ${position.y})`}>
                  <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="12" />
                  {state.final && <rect className="final-ring" x="5" y="5" width={NODE_WIDTH - 10} height={NODE_HEIGHT - 10} rx="8" />}
                  <text x="16" y="25">{truncate(state.title ?? stateId, 21)}</text>
                  <text className="state-id" x="16" y="43">{stateId}{stateId === machine.initial ? " · initial" : state.final ? " · final" : ""}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
