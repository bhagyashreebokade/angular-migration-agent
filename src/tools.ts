import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

const exec = promisify(execFile);
export const WORKDIR = path.resolve("workspace");

// Keep the agent sandboxed to ./workspace
function safePath(p: string): string {
  const full = path.resolve(WORKDIR, p);
  if (!full.startsWith(WORKDIR + path.sep)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return full;
}

export const toolDefs: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read a file from the workspace directory.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path inside workspace/" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write (overwrite) a file in the workspace directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path inside workspace/" },
        content: { type: "string", description: "Full file contents" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_tsc",
    description:
      "Type-check a TypeScript file in the workspace. Returns 'OK' or the compiler errors. Use after every write.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path inside workspace/" } },
      required: ["path"],
    },
  },
];

export async function runTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "read_file":
      return await readFile(safePath(input.path), "utf8");
    case "write_file":
      await writeFile(safePath(input.path), input.content, "utf8");
      return `Wrote ${input.path}`;
    case "run_tsc": {
      try {
        await exec("npx", [
          "tsc", "--noEmit", "--strict", "--experimentalDecorators",
          "--skipLibCheck", "--target", "ES2022", "--module", "ESNext",
          "--moduleResolution", "Bundler", safePath(input.path),
        ]);
        return "OK";
      } catch (e: any) {
        return `Compile errors:\n${e.stdout || e.message}`;
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
