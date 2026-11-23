// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { DispatchMap, executeOperation, idempotencyOf, refusalOf, UniqueContract } from '../../src/generated/domain.runtime.generated';

// The shell gives each event its id. Here a counter makes them, so a run is deterministic.
let ids = 0;
const newEventId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload, options) => executeOperation(urn, payload, core, { ...options, newEventId }),
  // The answers of the idempotent writes, kept with the rules of the generated runOnce.
  idempotency: { idempotencyOf },
  // The stored subscriptions of "Given these subscription records are stored:": an answer that clashes
  // with a live one of the same customer and plan is refused with conflict, as commitOnce does.
  unique: { contract: UniqueContract, refusalOf },
});
