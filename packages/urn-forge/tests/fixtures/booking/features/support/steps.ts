// Connects the steps of urn-forge to the generated file and the core of the booking fixture.
import { registerSteps } from '../../../../../src/gherkin/steps.js';
import { core } from '../../core.js';
import { check, Definitions, Operations, runOperation } from '../../generated/domain.generated.js';

registerSteps({ Definitions, Operations, check, run: (operation, input) => runOperation(core, operation, input) });
