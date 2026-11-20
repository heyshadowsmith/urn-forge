// Listed first in cucumber.json's `import`, so tsx's hooks are registered before Cucumber
// loads the TypeScript support code (tsx refuses Cucumber's `loader` option on Node >= 20.6).
import { register } from 'tsx/esm/api';

register();
