// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { CallerContract, DispatchMap, executeOperation } from '../../src/generated/domain.runtime.generated';

// The shell gives each event its id: here 3f0c8a52-6d1e-4b7a-9c2f-000000000001, 2, ... within a scenario.
let ids = 0;
const newEventId = () => `3f0c8a52-6d1e-4b7a-9c2f-${String((ids += 1)).padStart(12, '0')}`;

registerOperationSteps({
  dispatch: DispatchMap,
  caller: CallerContract,
  execute: (urn, payload, options) => {
    ids = 0;
    return executeOperation(urn, payload, core, { ...options, newEventId });
  },
});
