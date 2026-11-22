// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { DispatchMap, executeOperation } from '../../src/generated/domain.runtime.generated';

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload, options) => executeOperation(urn, payload, core, options),
});
