# Angular Migration Agent

An LLM agent that migrates AngularJS (1.x) code to modern Angular, built on the Claude API with tool use. It writes the migrated file, **type-checks it with the real TypeScript compiler**, fixes its own errors, and reports which packages the result needs.

> Status: work in progress. See [docs/DEVLOG.md](docs/DEVLOG.md) for daily progress.

## Why I built this

I have years of hands-on AngularJS-to-Angular migration experience. I wanted to see how far an agent can go on this task, and, more importantly, how to **measure** it rather than trust it.

## How it works

```
read_file  ->  write_file  ->  run_tsc  ->  (errors? fix + re-check)  ->  done
                                   \-> pass/fail decided by CODE, not by the model
```

| Piece | Role |
|---|---|
| `src/agent.ts` | Agent loop: call Claude, run requested tools, feed results back. Capped at 8 steps. |
| `src/tools.ts` | `read_file`, `write_file`, `run_tsc`, sandboxed to `workspace/`. |
| `src/index.ts` | CLI. Prints type-check result and proposed dependencies. |
| `workspace/` | Input AngularJS files and migrated output. |

## Quickstart

```bash
npm install
cp .env.example .env        # add your ANTHROPIC_API_KEY
npx tsx --env-file=.env src/index.ts user.controller.js
```

Switch models with the `MODEL` variable: `haiku` (default, cheap) or `sonnet`.

## Design decisions

- **Verification is independent of the model.** In an early run the model announced "Migration complete" while the compile check had not passed. The loop now tracks the last `run_tsc` result in code, and any later write resets it.
- **The agent proposes, a human approves.** It cannot install packages. It may only use preinstalled ones and must end with a `DEPENDENCIES:` line, which the CLI checks against the allowlist. This avoids hallucinated or typosquatted packages and keeps runs reproducible.
- **Sandboxed file access.** Tools cannot read or write outside `workspace/`.
- **Step cap.** The loop stops after 8 steps instead of running away.

## Results

TODO (Day 4): eval set of AngularJS snippets, scored on compiles, no leftover `$scope`, and behavior checks.

| Model | Prompt version | Pass rate |
|---|---|---|
| Haiku | v1 | TBD |
| Sonnet | v1 | TBD |

## Known limitations / failure analysis

TODO (Day 5-6): where the agent breaks (directives, `$watch`, `$q`, templates) and why.
Note: passing the type-check means the file compiles, not that the behavior is correct.

## Roadmap

- [ ] Harder inputs: directives, services, `$watch`
- [ ] Eval harness with scored results
- [ ] Run evals in GitHub Actions
- [ ] Stretch: constrained install tool (allowlist, `--ignore-scripts`, sandbox) and compare scores
