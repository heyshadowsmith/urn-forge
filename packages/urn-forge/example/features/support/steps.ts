// Wires urn-forge's generic operation steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../core';
import { DispatchMap, executeOperation } from '../../generated/domain.runtime.generated';

registerOperationSteps({
  dispatch: DispatchMap,
  execute: (urn, payload) => executeOperation(urn, payload, core),
});
