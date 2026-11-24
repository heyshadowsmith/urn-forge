// Connects the steps of urn-forge to this domain's generated file and core.
import { registerSteps } from 'urn-forge/cucumber';
import { core } from '../../src/core';
import { check, Definitions, Operations, runOperation } from '../../src/generated/domain.generated';

registerSteps({ Definitions, Operations, check, run: (operation, input) => runOperation(core, operation, input) });
