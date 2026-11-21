import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../core';
import { DispatchMap, executeOperation } from '../../generated/domain.runtime.generated';

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload) => executeOperation(urn, payload, core),
});
