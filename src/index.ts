import { migrate } from "./agent.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run migrate -- <file inside workspace/>");
  process.exit(1);
}

const result = await migrate(file);
console.log(`\nDone in ${result.steps} steps.\n${result.summary}\n`);
console.log(`Type-check: ${result.tscOk ? "PASS ✅" : "FAIL ❌"}`);
console.log(`Dependencies proposed: ${result.dependencies.join(", ") || "none"}`);
if (result.missing.length) {
  console.log(`⚠️  Not installed, needs human approval: ${result.missing.join(", ")}`);
}