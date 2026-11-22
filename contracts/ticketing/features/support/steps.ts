// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { DispatchMap, executeOperation, idempotencyConflict, idempotencyOf } from '../../src/generated/domain.runtime.generated';

// The shell gives each event its message id: here 00000000-0000-4000-8000-000000000001, 2, ... within a scenario.
let ids = 0;
const newEventId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload, options) => {
    ids = 0;
    return executeOperation(urn, payload, core, { ...options, newEventId });
  },
  // The steps keep the answers of a scenario with the rules of the generated runOnce.
  idempotency: { idempotencyOf, idempotencyConflict },
});
