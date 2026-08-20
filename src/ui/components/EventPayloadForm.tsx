import type { EventDefinition, JsonObject, JsonValue } from "../../model/types.js";

interface EventPayloadFormProps {
  definition: EventDefinition;
  values: Record<string, string | boolean>;
  onChange: (values: Record<string, string | boolean>) => void;
}

export function payloadFromForm(
  definition: EventDefinition,
  values: Record<string, string | boolean>,
): { ok: true; payload: JsonObject } | { ok: false; message: string } {
  const payload: JsonObject = {};
  for (const [name, field] of Object.entries(definition.fields ?? {})) {
    const raw = values[name];
    if ((raw === "" || raw === undefined) && field.required === false) continue;
    if (raw === "" || raw === undefined) return { ok: false, message: `${name} is required.` };
    let value: JsonValue;
    if (field.type === "number" || field.type === "integer") {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || (field.type === "integer" && !Number.isInteger(parsed))) {
        return { ok: false, message: `${name} must be ${field.type}.` };
      }
      value = parsed;
    } else if (field.type === "boolean") {
      value = raw === true || raw === "true";
    } else if (field.type === "object" || field.type === "array") {
      try {
        value = JSON.parse(String(raw)) as JsonValue;
      } catch {
        return { ok: false, message: `${name} must be valid JSON.` };
      }
      if ((field.type === "array") !== Array.isArray(value) || (field.type === "object" && (value === null || typeof value !== "object" || Array.isArray(value)))) {
        return { ok: false, message: `${name} must be ${field.type}.` };
      }
    } else value = String(raw);
    payload[name] = value;
  }
  return { ok: true, payload };
}

export function EventPayloadForm({ definition, values, onChange }: EventPayloadFormProps) {
  const fields = Object.entries(definition.fields ?? {});
  if (fields.length === 0) return null;
  return (
    <div className="payload-grid">
      {fields.map(([name, field]) => (
        <label key={name} className="payload-field">
          <span>{name}{field.required === false ? "" : " *"}</span>
          {field.type === "boolean" ? (
            <select
              value={String(values[name] ?? "")}
              onChange={(event) => onChange({ ...values, [name]: event.target.value })}
            >
              <option value="">Select</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : field.type === "object" || field.type === "array" ? (
            <textarea
              rows={2}
              value={String(values[name] ?? "")}
              placeholder={field.type === "array" ? "[]" : "{}"}
              onChange={(event) => onChange({ ...values, [name]: event.target.value })}
            />
          ) : (
            <input
              type={field.type === "number" || field.type === "integer" ? "number" : "text"}
              step={field.type === "integer" ? "1" : "any"}
              value={String(values[name] ?? "")}
              onChange={(event) => onChange({ ...values, [name]: event.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );
}

