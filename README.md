# @lp-labs/message-runtime

Safely parse a deliberately small, bounded message syntax and format data placeholders. Messages
are parsed as data; they are never evaluated as code.

## Install and quick start

```sh
npm install @lp-labs/message-runtime
```

```js
import { compileMessage } from '@lp-labs/message-runtime';

const message = compileMessage('{name}: {count, plural, one{# item} other{# items}}', 'en');
console.log(message.format({ name: 'Ada', count: 2 })); // Ada: 2 items
```

## Syntax and API

- `{name}` substitutes a required string, finite number, boolean, or `null` (`null` becomes empty).
- `{count, plural, one{...} other{...}}` selects an `Intl.PluralRules` category. Exact numeric
  branches such as `=0{...}` are supported and take precedence. `#` in the selected plural branch
  formats the count with `Intl.NumberFormat`.
- `{kind, select, female{...} other{...}}` selects an exact string/number/boolean key.
- Choice bodies may nest. Every choice must define `other`.
- `compileMessage(source, locale?, limits?)` validates once and returns a reusable `CompiledMessage`.
  `MessageLimits`, `MessageValues`, and `CompiledMessage` are exported types.

Default limits are 10,000 source characters, nesting depth 8, 2,000 syntax nodes, and 100,000 output
characters. The corresponding maximums are 1,000,000 characters, depth 32, 100,000 nodes, and
10,000,000 output characters. Malformed or
unsupported syntax throws `SyntaxError`; excessive source/structure throws `RangeError`; missing or
incorrectly typed placeholders throw `TypeError`. Invalid locale identifiers propagate the platform
`Intl` `RangeError`.

## Limits and customization

This is an explicit syntax subset, not an ICU implementation: no offsets, number/date styles,
apostrophe escaping, or arbitrary formatters are supported. Literal braces must be represented by
message text that does not use this grammar (there is no brace-escape syntax). Placeholder text is
inserted verbatim and is not HTML-escaped; apply context-appropriate escaping before using output in
an interpreted context. Plural categories come from the host platform's `Intl.PluralRules`; this
package does not include or copy ICU data. There are no runtime or peer dependencies.

ESM, CommonJS, and TypeScript declarations are included. TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
