import { consoleFramework } from '../frameworks/console';
import { consoleActs } from '../director/pipeline/console-plan';
import { bootOne } from './harness';

const act = consoleActs({ maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 })[0]!;
bootOne(act, consoleFramework, '导师').catch(console.error);
