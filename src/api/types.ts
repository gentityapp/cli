// Wire-level types for the gentity HTTP API. These are intentionally
// duplicated from the control plane's TypeScript — the CLI talks to the API
// as an external client, no shared imports. If the API contract changes the
// CLI bumps these and the version range it claims to support.

export type InstanceStatus =
  | "creating"
  | "running"
  | "stopped"
  | "stopping"
  | "starting"
  | "error";

export interface Instance {
  id: string;
  name: string;
  subdomain: string;
  agentType: string;
  modelProvider: string;
  modelName: string;
  status: InstanceStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateInstanceBody {
  name?: string;
  agentType: string;
  modelProvider: string;
  modelName: string;
  apiKey: string;
  region?: string;
}

export interface CreateInstanceResponse {
  id: string;
  subdomain: string;
  status: InstanceStatus;
}
