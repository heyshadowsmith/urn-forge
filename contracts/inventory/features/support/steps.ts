// Connects urn-forge's generic steps to this domain's generated runtime and core.
import { registerOperationSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { CallerContract, DispatchMap, executeOperation, idempotencyOf, refusalOf, UniqueContract } from '../../src/generated/domain.runtime.generated';
import { commit } from '../../src/generated/domain.store.generated';

// The shell gives each event its id: here 7d3f1c2a-5b4e-4a6d-9c8b-000000000001, 2, ... within a scenario.
let ids = 0;
const newEventId = () => `7d3f1c2a-5b4e-4a6d-9c8b-${String((ids += 1)).padStart(12, '0')}`;

registerOperationSteps({
  dispatch: DispatchMap,
  // Who calls, for "Given the caller is:": the shell authenticates them and passes them on.
  caller: CallerContract,
  execute: (urn, payload, options) => {
    ids = 0;
    return executeOperation(urn, payload, core, { ...options, newEventId });
  },
  // The answers of a scenario, kept with the rules of runOnce: a repeat with the same key and body
  // within 24 hours returns the first answer, another body gets idempotency_conflict.
  idempotency: { idempotencyOf },
  // The statements of a call: "Then nothing changes" checks that a refusal gives none.
  commit,
  // The stored reservations of "Given these reservation records are stored:": an answer that clashes
  // with one is refused as commitOnce refuses it (open_reservation_exists for an order with an open one).
  unique: { contract: UniqueContract, refusalOf },
});
