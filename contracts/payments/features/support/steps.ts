// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { DispatchMap, executeOperation } from '../../src/generated/domain.runtime.generated';

// The shell gives each event its id. Here the ids are deterministic, from 1 in each scenario's run
// of the operation, so that a scenario can check event_id.
let ids = 0;
const newEventId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload, options) => {
    ids = 0;
    return executeOperation(urn, payload, core, { ...options, newEventId });
  },
});
