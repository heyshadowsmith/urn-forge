// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { CallerContract, DispatchMap, executeOperation, idempotencyOf, refusalOf, UniqueContract } from '../../src/generated/domain.runtime.generated';

// The shell gives each event its id. Here a fixed one, so a scenario can check event_id.
const newEventId = () => '16fd2706-8baf-433b-82eb-8c7fed5c9b0e';

registerOperationSteps({
  dispatch: DispatchMap,
  caller: CallerContract,
  execute: (urn, payload, options) => executeOperation(urn, payload, core, { ...options, newEventId }),
  // A repeat of create_booking with its key follows the rules of runOnce in the store file.
  idempotency: { idempotencyOf },
  // A booking reference is used once (P01): an answer that gives a stored reference again is refused by the store.
  unique: { contract: UniqueContract, refusalOf },
});
