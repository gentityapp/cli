import { apiRequest } from "./client";
import type { Instance } from "./types";

// Resolve a user-supplied identifier into a full instance id (cuid).
//
// `compute list` shows the first 8 chars of the id for column tightness,
// and the subdomain (e.g. "cl-x7k2m9") is the human-memorable handle. So
// users will type any of:
//
//   cmp8ur44                 ← short id (8 chars)
//   cmp8ur44b0003naiz0n3od…  ← full id (cuid)
//   op-875qm75g              ← subdomain
//   op-                      ← ambiguous prefix
//
// We list once and resolve client-side. Matches are checked in this order
// of specificity:
//   1. exact full id
//   2. exact subdomain
//   3. id prefix
//   4. subdomain prefix
// Multiple hits at the same tier → ambiguity error.
export async function resolveInstanceId(arg: string): Promise<string> {
  const { instances } = await apiRequest<{ instances: Instance[] }>("/api/instances");

  const exactId = instances.find((i) => i.id === arg);
  if (exactId) return exactId.id;

  const exactSub = instances.find((i) => i.subdomain === arg);
  if (exactSub) return exactSub.id;

  const idPrefix = instances.filter((i) => i.id.startsWith(arg));
  if (idPrefix.length === 1) return idPrefix[0]!.id;
  if (idPrefix.length > 1) {
    throw new Error(
      `"${arg}" matches ${idPrefix.length} instances by id. Use a longer prefix.`,
    );
  }

  const subPrefix = instances.filter((i) => i.subdomain.startsWith(arg));
  if (subPrefix.length === 1) return subPrefix[0]!.id;
  if (subPrefix.length > 1) {
    throw new Error(
      `"${arg}" matches ${subPrefix.length} instances by subdomain. Use a longer prefix.`,
    );
  }

  throw new Error(`no instance matches "${arg}"`);
}
