# Tutorial: build a domain with a coding agent

In this tutorial, you and a coding agent make a domain, `shipping`, with one operation, `quote_shipping`. The operation takes a parcel and gives the price to send it. Then you add a refusal, and you make the checks strict. It takes about 20 minutes.

Each part says what you ask the agent, what the agent does, and what you check. The outputs on this page are from real runs of the commands that the agent runs. An agent's own words are different on each run, so this page does not show them. You can also do each step by hand: the files and the commands are the same.

The result of each part is in [`packages/urn-forge/tutorial/`](https://github.com/heyshadowsmith/urn-forge/tree/main/packages/urn-forge/tutorial/) of the repository: `1-first-domain`, `2-declared-errors` and `3-edges`. If the agent's result is different, compare its files with these files.

## 1. Set up the project

You must have Node.js 22 or later. urn-forge is not on npm yet. In a clone of the repository, run `npm ci`, then `npm run pack:tarball`. This writes `urn-forge-0.2.0.tgz`. Then make the project:

```bash
mkdir my-shipping
cd my-shipping
git init
npm init -y
npm install /path/to/urn-forge-0.2.0.tgz
npx urn-forge init --namespace demo --domain shipping
```

```
wrote      .claude/skills/urn-forge/SKILL.md
wrote      AGENTS.md
wrote      cucumber.json
wrote      domain.manifest.yaml
wrote      features/split.feature
wrote      features/support/steps.ts
wrote      register-tsx.mjs
wrote      src/core.ts
wrote      tsconfig.json
wrote      urn-forge.config.ts
updated    package.json
next: npm install, then npx urn-forge compile, then npx urn-forge verify
```

The starter is a complete domain that splits a bill. `AGENTS.md` gives the agent its instructions, and `.claude/skills/urn-forge/` gives Claude Code a skill that runs the loop.

The starter is strict: a missing scenario fails `verify`. In this tutorial, start with gaps as warnings, so that you can see them. Replace `urn-forge.config.ts`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/urn-forge.config.ts

Part 4 makes it strict again. Commit the project (`git add -A && git commit -m start`), so that later you can compare each change with this one. Then start your coding agent in `my-shipping`.

## 2. Build the shipping domain

**Ask the agent:** "Replace the bill with shipping. One operation, `quote_shipping`, takes a parcel with a weight from 1 to 30000 grams, a zone (domestic or international) and an optional express flag, and gives a quote in cents."

**The agent writes the contract first**, in `domain.manifest.yaml`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/domain.manifest.yaml

**You check the contract.** This is the part to read with care:

- `definitions` gives a name to each value, with a type and its `rules`. `weight_grams` is an integer from 1 to 30000, as you asked.
- `parcel` lists its properties. Its `required` rule does not list `express`, so `express` is optional, as you asked.
- `quote_shipping` takes a `parcel` and gives a `quote`.

**The agent compiles.** `npx urn-forge compile` writes `src/generated/domain.generated.ts`, which no one edits. It holds the type of the code that the agent must write:

```ts
/** The answers of quote_shipping. */
export type QuoteShippingAnswer = Answer<"quote", Quote>;

/** The core: a function for each operation, from its input to one of its answers. */
export interface DomainCore {
  /** Calculate the price to send a parcel */
  readonly quote_shipping: (input: Parcel) => QuoteShippingAnswer;
}
```

**The agent writes the code**, `src/core.ts`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/src/core.ts

The code does not check its input. The harness checks the input before the code runs, and the answer after it.

**The agent writes the scenarios**, in `features/quote_shipping.feature`, and removes `features/split.feature`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/features/quote_shipping.feature{gherkin}

**You check the expected values.** The gates make sure that a scenario exists. Only you know that a domestic parcel of 800 grams costs 600 cents.

**The agent runs the checks** until both pass:

```
10 scenarios (10 passed)
30 steps (30 passed)
```

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 10 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

Gate 1 checks the code against the contract. Gate 2 makes sure that nothing calls the code without the harness. Gate 3 makes sure that the scenarios run each operation, give each answer, and break each of the six rules. Gate 4 makes sure that the generated file is current.

## 3. Add a refusal

**Ask the agent:** "Express delivery takes parcels of 5000 grams or less. Refuse a heavier express parcel, and say its weight."

**The agent changes the contract.** The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/domain.manifest.yaml{46-67,74-75}

**You check the new rules.** A refusal is an answer, `too_heavy_for_express`, that names the weight. The code can give a `quote` only if the parcel `fits_express`, and the refusal only if it is `over_express_limit`. Read each `rule`: `input.weight_grams > 5000` in `over_express_limit` is "more than 5000 grams", as you asked. Each rule also has a `message`, which a failure shows.

If a rule reads `express` without first testing that it is there, `compile` stops, and the agent corrects the rule:

```
domain.manifest.yaml:75  error  rule-guard  over_express_limit: input.express can be absent: read it after has(input.express) &&, or after !has(input.express) ||
  fix: Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.
```

**The checks find the gaps.** After `compile`, `verify` gives two warnings, because no scenario covers the new answer and its rule:

```
gate 3  gherkin       PASS  1 feature(s), 10 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
    features  warning  uncovered-output  no scenario of quote_shipping answers too_heavy_for_express; add one that ends with Then the output is "too_heavy_for_express"
      fix: Add a scenario of the operation that ends with Then the output is "<output>".
    features  warning  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
      fix: Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>".
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed with 2 warning(s) (gates 1, 2, 3, 4)
```

The agent adds the two scenarios that the fixes ask for. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/features/quote_shipping.feature{18-24,50-54 gherkin}

**The harness catches the code.** The code still gives a quote for each parcel, so the new scenario fails in `npx cucumber-js`:

```
  1) An express parcel over 5000 grams is refused # features/quote_shipping.feature:18
           Error: quote_shipping did not answer: ContractViolation: fits_express of quote_shipping: An express parcel can weigh 5000 grams at most
12 scenarios (11 passed, 1 failed)
```

The harness found that the answer breaks `fits_express`. The agent corrects the code. The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/2-declared-errors/src/core.ts{7,11}

Now 12 of 12 scenarios pass, and `verify` passes with no warning:

```
gate 3  gherkin       PASS  1 feature(s), 12 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
```

## 4. Make it strict

### Make a gap an error

Make a missing scenario fail `verify` again. Change `urn-forge.config.ts` yourself, because this setting is a decision about how strict the checks are:

<<< @/../packages/urn-forge/tutorial/3-edges/urn-forge.config.ts{6-7}

Now a gap fails gate 3. For example, without the scenario `A refusal needs the weight`:

```
gate 3  gherkin       FAIL  1 feature(s), 11 scenario(s), 1/1 operation(s) run, 6 rule(s) broken
    features  error  uncovered-rule  no scenario breaks required of too_heavy_for_express; add one that ends with Then the input is rejected by "required" of "too_heavy_for_express", or Then the value is rejected by …
      fix: Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>".
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify failed: gate 3
```

From now on, each new operation, answer or rule that the agent adds must have a scenario.

### Test the edges

Gate 3 asks for one scenario for each rule. It does not ask for the values at the edges of a rule, where code is wrong most frequently. Suppose that the agent writes `>=` in place of `>`:

```ts
    if (express && weight_grams >= EXPRESS_LIMIT_GRAMS) return answer('too_heavy_for_express', { weight_grams });
```

All scenarios still pass, but the code refuses an express parcel of exactly 5000 grams. **Ask the agent:** "Add scenarios at the edges of each rule." The highlighted lines are new:

<<< @/../packages/urn-forge/tutorial/3-edges/features/quote_shipping.feature{26-45 gherkin}

```
  1) An express parcel of exactly 5000 grams is quoted # features/quote_shipping.feature:39
           Error: quote_shipping did not answer: ContractViolation: over_express_limit of quote_shipping: The parcel fits express delivery
15 scenarios (14 passed, 1 failed)
```

Because `over_express_limit` allows the refusal only above 5000 grams, the harness found the error. The agent changes `>=` back to `>`. All 15 scenarios pass, and `verify` passes:

```
gate 1  completeness  PASS  tsc: 0 error(s) over src/core.ts; core satisfies DomainCore
gate 2  boundary      PASS  1 core file(s), 0 shell file(s): 0 problem(s)
gate 3  gherkin       PASS  1 feature(s), 15 scenario(s), 1/1 operation(s) run, 7 rule(s) broken
gate 4  drift         PASS  1 generated file(s) compared byte for byte against src/generated
verify passed (gates 1, 2, 3, 4)
```

The skill tells Claude Code to add these edges without a request. Check that they are there when you review.

## What you made

- **You** wrote a contract of one operation, one refusal and seven rules, and checked each expected value.
- **The agent** wrote the code and fifteen scenarios, and ran the checks until they passed.
- **urn-forge** found two gaps, a wrong answer and a wrong edge, with no help from you.

Next, [set up CI](../how-to/run-verify-in-ci), so that gate 5 also stops a change that makes the contract weaker. Then read [Review an agent's change](../how-to/review-an-agents-change).
