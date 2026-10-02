import Anthropic from "@anthropic-ai/sdk";
import { toolDefs, runTool } from "./tools.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// Switch models without editing code:
//   MODEL=sonnet npm run migrate -- file.js   (final eval runs)
//   MODEL=haiku  npm run migrate -- file.js   (cheap dev runs, default)
const MODEL_ALIASES: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-5-5",
};
const requested = process.env.MODEL ?? "haiku";
const MODEL = MODEL_ALIASES[requested] ?? requested; // full model strings also work
console.log(`Using model: ${MODEL}`);

const MAX_STEPS = 8; // hard cap so the loop can never run away

// Packages preinstalled in package.json. The agent may NOT install anything:
// it proposes dependencies, a human (or CI) approves and installs them.
const INSTALLED = ["@angular/core", "@angular/common", "rxjs"];

const SYSTEM = `You migrate AngularJS (1.x) code to modern Angular (standalone components, TypeScript).
Rules:
- Replace $scope with component properties; replace $http with HttpClient; replace $q/promises with RxJS/async.
- Only use packages already installed: ${INSTALLED.join(", ")}. Do not import anything else.
- Output a .ts file next to the source, same base name.
- Always call run_tsc after writing. If it reports errors, fix them and re-check.
- Stop when run_tsc returns OK. Then reply with a 2-3 line summary, followed by a final line in exactly this form:
DEPENDENCIES: pkg1, pkg2
List every npm package the migrated code imports. Write "DEPENDENCIES: none" if there are none.`;

export interface MigrationResult {
  steps: number;
  summary: string;
  tscOk: boolean; // verified by code, not by the model's own claim
  dependencies: string[]; // packages the agent says the output needs
  missing: string[]; // proposed packages that are NOT preinstalled -> human must approve
}

// "@angular/common/http" -> "@angular/common"; "rxjs/operators" -> "rxjs"
function pkgName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function parseDependencies(text: string): string[] {
  const m = text.match(/^DEPENDENCIES:\s*(.+)$/im);
  if (!m || m[1].trim().toLowerCase() === "none") return [];
  return [...new Set(m[1].split(",").map((s) => pkgName(s.trim())).filter(Boolean))];
}

export async function migrate(file: string): Promise<MigrationResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Migrate workspace file "${file}" to Angular. Start by reading it.` },
  ];
  let tscOk = false; // last run_tsc result; any write invalidates it

  for (let step = 1; step <= MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: toolDefs,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    // No more tool calls -> the model is done
    if (res.stop_reason !== "tool_use") {
      const summary = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const dependencies = parseDependencies(summary);
      const missing = dependencies.filter((d) => !INSTALLED.includes(d));
      return { steps: step, summary, tscOk, dependencies, missing };
    }

    // Run every requested tool and send results back
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      console.log(`[step ${step}] ${block.name}`, JSON.stringify(block.input).slice(0, 80));
      try {
        const out = await runTool(block.name, block.input);
        if (block.name === "write_file") tscOk = false; // edits invalidate the last check
        if (block.name === "run_tsc") tscOk = out === "OK";
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      } catch (e: any) {
        // Surface tool errors to the model instead of crashing
        results.push({ type: "tool_result", tool_use_id: block.id, content: e.message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error(`Agent did not finish within ${MAX_STEPS} steps`);
}