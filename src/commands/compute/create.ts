import { apiRequest, ApiError } from "../../api/client";
import { Spinner } from "../../ui/spinner";
import { c } from "../../ui/colors";
import type { CreateInstanceBody, CreateInstanceResponse, Instance } from "../../api/types";
import { loadConfig } from "../../config";

interface CreateOpts {
  agent: string;
  model: string;
  apiKey?: string;
  name?: string;
  region?: string;
  // If true, return as soon as the API responds with the row id — don't
  // poll for `running`. Useful for scripted flows that don't care about
  // boot time.
  detach?: boolean;
}

// `gentity compute create` — mirrors the LP screenshot UX:
//   :: Provisioning isolated microVM in iad...
//   :: Attaching persistent volume...
//   :: Pulling <image>...
//   ✓ Agent <subdomain> ready in 8.3s
//     Open https://<subdomain>.gentity.ai
//
// The control plane's POST /api/instances is currently synchronous (it
// blocks until the machine is started), so we just spin while we wait. When
// the control plane moves to an async pattern we'll switch to polling
// GET /api/instances/:id and reading `status`.
export async function runComputeCreate(opts: CreateOpts): Promise<number> {
  const apiKey = opts.apiKey ?? envForProvider();
  if (!apiKey) {
    console.error(
      c.red("error:"),
      "no model API key supplied. Pass --api-key, or set ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY for the provider you picked.",
    );
    return 1;
  }

  // Provider is inferred from the model name format if the user didn't pass
  // it explicitly. We don't ask for it on the CLI — same model id always
  // maps to the same provider on the control plane today.
  const modelProvider = inferProvider(opts.model);

  const body: CreateInstanceBody = {
    name: opts.name,
    agentType: opts.agent,
    modelProvider,
    modelName: opts.model,
    apiKey,
    region: opts.region,
  };

  const spinner = new Spinner();
  spinner.start(`Provisioning isolated microVM${opts.region ? ` in ${opts.region}` : ""}…`);

  const start = Date.now();
  let result: CreateInstanceResponse;
  try {
    result = await apiRequest<CreateInstanceResponse>("/api/instances", {
      method: "POST",
      body,
    });
  } catch (err) {
    spinner.fail("provisioning failed");
    if (err instanceof ApiError) {
      console.error(c.red("error:"), err.message);
    } else {
      console.error(c.red("error:"), err);
    }
    return 1;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  spinner.succeed(
    `Agent ${c.bold(result.subdomain)} ready in ${c.bold(elapsed + "s")}`,
  );

  // If detach, we're done. Otherwise print the workspace URL (handy for
  // copy-paste even though the POST already returned).
  const cfg = await loadConfig();
  const host = hostnameFromApi(cfg.apiUrl);
  if (host) {
    console.log(`  Open ${c.cyan(`https://${result.subdomain}.${host}`)}`);
  }

  if (!opts.detach && result.status !== "running") {
    // Best-effort follow-up: poll until status flips out of creating. The
    // control plane already waits inside the POST, but if that contract
    // changes this guards us.
    await waitForRunning(result.id, spinner);
  }

  return 0;
}

function inferProvider(modelName: string): string {
  if (modelName.startsWith("claude")) return "anthropic";
  if (modelName.startsWith("gpt") || modelName.startsWith("o1") || modelName.startsWith("o3")) {
    return "openai";
  }
  if (modelName.startsWith("gemini")) return "google";
  if (modelName.startsWith("deepseek")) return "deepseek";
  if (modelName.startsWith("grok")) return "xai";
  // openrouter/auto, openrouter/<vendor>/<model>, etc.
  if (modelName.startsWith("openrouter/") || modelName.includes("/")) return "openrouter";
  // Default — let the control plane reject if it can't route.
  return "openrouter";
}

function envForProvider(): string | null {
  return (
    process.env.GENTITY_AGENT_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.XAI_API_KEY ??
    null
  );
}

function hostnameFromApi(apiUrl: string): string | null {
  // "https://gentity.ai" → "gentity.ai". "http://localhost:3000" → null.
  try {
    const u = new URL(apiUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

async function waitForRunning(id: string, spinner: Spinner): Promise<void> {
  spinner.start("waiting for instance to start…");
  const deadline = Date.now() + 120_000; // 2 min cap
  while (Date.now() < deadline) {
    try {
      const { instance } = await apiRequest<{ instance: Instance }>(`/api/instances/${id}`);
      if (instance.status === "running") {
        spinner.succeed("running");
        return;
      }
      if (instance.status === "error") {
        spinner.fail(`instance errored: ${instance.errorMessage ?? "(unknown)"}`);
        return;
      }
    } catch {
      // transient — keep polling
    }
    await Bun.sleep(1000);
  }
  spinner.fail("timed out waiting for running state");
}
