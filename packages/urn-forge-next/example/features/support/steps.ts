// Connects the steps of urn-forge to this domain's generated file and core.
import { registerSteps } from 'urn-forge-next/cucumber';
import { core } from '../../core.js';
import { check, Definitions, Operations, runOperation } from '../../generated/domain.generated.js';

registerSteps({ Definitions, Operations, check, run: (operation, input) => runOperation(core, operation, input) });
