import { compileMessage, type CompiledMessage } from '@lp-labs/message-runtime';
const message: CompiledMessage = compileMessage('Hi {name}', 'en');
const output: string = message.format({ name: 'Ada' });
// @ts-expect-error values must use supported primitive types.
message.format({ name: {} });
void output;
