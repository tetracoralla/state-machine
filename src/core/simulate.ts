import { SimulationRequestSchema } from "../model/schemas.js";
import type { OperationError, SimulationRequest, SimulationResult, StepRejection, StepSuccess } from "../model/types.js";
import { initialSnapshot, stepValidatedMachine, validateSnapshotForMachine } from "./step.js";
import { cloneObject } from "./value-source.js";
import { validateMachine } from "./validation.js";

export function simulateMachine(input: SimulationRequest | unknown): SimulationResult | OperationError {
  const parsed = SimulationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: { code: "INPUT_INVALID", message: parsed.error.issues[0]?.message ?? "Simulation request is invalid." } };
  }
  const request = parsed.data as SimulationRequest;
  const validation = validateMachine(request.machine);
  if (validation.status === "invalid") {
    return {
      status: "error",
      error: { code: "MACHINE_INVALID", message: "Machine failed semantic validation.", details: validation.diagnostics },
    };
  }
  const initial = request.snapshot
    ? { state: request.snapshot.state, context: cloneObject(request.snapshot.context) }
    : initialSnapshot(request.machine);
  const snapshotFailure = validateSnapshotForMachine(request.machine, initial);
  if (snapshotFailure) return snapshotFailure;
  let current = initial;
  const steps: Array<StepSuccess | StepRejection> = [];
  let accepted = true;
  let stoppedAt: number | null = null;
  const stopOnRejection = request.stop_on_rejection !== false;

  for (let index = 0; index < request.events.length; index += 1) {
    const item = request.events[index];
    if (!item) continue;
    const result = stepValidatedMachine(request.machine, current, item.event, item.guard_results);
    if (result.status === "error") return result;
    steps.push(result);
    if (result.accepted) current = result.after;
    else {
      accepted = false;
      if (stopOnRejection) {
        stoppedAt = index;
        break;
      }
    }
  }

  return { status: "ok", accepted, initial, final: current, steps, stopped_at: stoppedAt };
}
