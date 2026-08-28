import { collectCitedSourceIds } from "@/lib/prism/evidence";

/**
 * Patches a JSON Schema (as produced by `z.toJSONSchema`) so every
 * `sourceIds` property anywhere in the tree is constrained to the real
 * ids that exist for this call — Gemini's structured output honors an
 * `enum` constraint during generation, so an id outside the list becomes
 * something the model cannot emit, not just something a prompt instructs
 * it not to. `sourceIds` is a name reserved exclusively for "cite a real
 * research source id" across every PRISM phase schema (see
 * `collectCitedSourceIds`, which every phase composer already relies on
 * this same way), so a plain key-name walk is safe and needs no
 * per-phase-schema change as agent schemas evolve. An empty vocabulary
 * forces the field to `maxItems: 0` — there is nothing valid to cite.
 */
export function constrainSourceIdsInJsonSchema(node: unknown, validSourceIds: readonly string[]): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => constrainSourceIdsInJsonSchema(item, validSourceIds));
  }
  if (!node || typeof node !== "object") return node;

  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const properties = value as Record<string, unknown>;
      const newProperties: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(properties)) {
        if (propName === "sourceIds" && propSchema && typeof propSchema === "object") {
          const propObj = propSchema as Record<string, unknown>;
          newProperties[propName] =
            validSourceIds.length > 0
              ? { ...propObj, items: { type: "string", enum: [...validSourceIds] } }
              : { ...propObj, maxItems: 0 };
        } else {
          newProperties[propName] = constrainSourceIdsInJsonSchema(propSchema, validSourceIds);
        }
      }
      result[key] = newProperties;
    } else {
      result[key] = constrainSourceIdsInJsonSchema(value, validSourceIds);
    }
  }
  return result;
}

/**
 * The runtime counterpart to `constrainSourceIdsInJsonSchema`: finds the
 * first `sourceIds` citation anywhere in a parsed output tree that isn't
 * in the real vocabulary. Gemini's own schema adherence isn't
 * guaranteed, so this is what actually rejects a value the generation
 * constraint failed to prevent — before the caller's own schema even
 * gets a chance to parse it, and well before any phase composer would.
 */
export function findUnknownCitedSourceId(
  value: unknown,
  validSourceIds: readonly string[],
): string | undefined {
  const cited = new Set<string>();
  collectCitedSourceIds(value, cited);
  const known = new Set(validSourceIds);
  for (const id of cited) {
    if (!known.has(id)) return id;
  }
  return undefined;
}
