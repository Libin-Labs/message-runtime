import messages = require('@lp-labs/message-runtime');
const text: string = messages.compileMessage('Hi {name}').format({ name: 'Ada' });
void text;
