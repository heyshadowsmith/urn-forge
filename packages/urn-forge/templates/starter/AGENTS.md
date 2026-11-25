# Instructions for coding agents

This project keeps its domain in a contract, `domain.manifest.yaml`, with urn-forge. The reference of urn-forge is `node_modules/urn-forge/AGENTS.md`: the manifest, the rule language, the steps and each code with its fix. Read it before you change the contract.

## The loop

1. Change the contract in `domain.manifest.yaml`.
2. Run `npm run compile`. It writes `src/generated/`.
3. Change the core, `src/core.ts`: one function for each operation, `satisfies DomainCore`.
4. Change the scenarios in `features/`: each operation, each output and each rule of a definition has one. Add a scenario at each edge of each rule: the last value that the rule accepts, and the first value that it rejects.
5. Run `npm run verify`, then `npm run test:features`. Repeat until both pass.

Run `npx urn-forge verify --format json` to get each problem as JSON, with its `code` and its `fix`.

## Rules of this project

- Do not edit `src/generated/`. Change the manifest, and run `npm run compile`.
- Do not add `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`. Correct the type error.
- Call the core only through `runOperation(core, operation, input)`.
- Keep the business logic in `src/core.ts`. The manifest says what must be true; the core decides.
- Do not remove or weaken a rule, an output or a scenario to make a check pass. Correct the core or the scenario.

## Stop and ask a person

Do not continue on your own when:

- the only way to make a check pass is to remove or weaken a rule, an output or a scenario;
- the change needs a new `version` in the manifest;
- a rule of the request cannot be written in the rule language of urn-forge.

Say what you found, what you propose, and what the person must decide.
