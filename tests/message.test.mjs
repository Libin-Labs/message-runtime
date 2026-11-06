import test from 'node:test';
import assert from 'node:assert/strict';
import { compileMessage } from '../dist/esm/index.js';

test('substitutes placeholders and selects exact plural branches', () => {
  const message = compileMessage(
    '{name}: {count, plural, =0{none} one{# item} other{# items}}',
    'en',
  );
  assert.equal(message.format({ name: 'Ada', count: 0 }), 'Ada: none');
  assert.equal(message.format({ name: 'Ada', count: 1 }), 'Ada: 1 item');
  assert.equal(message.format({ name: 'Ada', count: 4 }), 'Ada: 4 items');
  assert.equal(
    compileMessage('{n, plural, =1.0{exact} other{category}}').format({ n: 1 }),
    'exact',
  );
});

test('supports exact selects, nesting, and platform plural categories', () => {
  const message = compileMessage(
    '{gender, select, female{{count, plural, one{one} other{# things}}} other{unknown}}',
    'en',
  );
  assert.equal(message.format({ gender: 'female', count: 2 }), '2 things');
  assert.equal(message.format({ gender: 'other', count: 1 }), 'unknown');
});

test('validates message grammar and bounds', () => {
  assert.throws(() => compileMessage('{missing'), SyntaxError);
  assert.throws(() => compileMessage('{n, plural, one{x}}'), SyntaxError);
  assert.throws(() => compileMessage('{n, date, other{x}}'), SyntaxError);
  assert.throws(() => compileMessage('{n, plural, singlular{x} other{y}}'), SyntaxError);
  assert.throws(() => compileMessage('long', 'en', { maxLength: 2 }), RangeError);
  assert.throws(() => compileMessage('{n}').format(), TypeError);
  assert.throws(() => compileMessage('{n, plural, other{x}}').format({ n: '1' }), TypeError);
  assert.throws(() => compileMessage('x', 'not_a_locale'), RangeError);
  assert.throws(
    () => compileMessage('{value}', 'en', { maxOutput: 4 }).format({ value: 'large' }),
    RangeError,
  );
  assert.throws(() => compileMessage('{toString}').format(), TypeError);
  const getterValues = Object.defineProperty({}, 'name', {
    get() {
      throw new Error('not called');
    },
  });
  assert.throws(() => compileMessage('{name}').format(getterValues), TypeError);
});
