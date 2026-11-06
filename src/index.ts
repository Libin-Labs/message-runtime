export interface MessageLimits {
  maxLength?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxOutput?: number;
}

export type MessageValues = Readonly<Record<string, string | number | boolean | null>>;
export interface CompiledMessage {
  format(values?: MessageValues): string;
}

type TextNode = { type: 'text'; value: string };
type ArgumentNode = { type: 'argument'; name: string };
type ChoiceNode = {
  type: 'choice';
  name: string;
  kind: 'plural' | 'select';
  options: ReadonlyMap<string, MessageNode[]>;
};
type MessageNode = TextNode | ArgumentNode | ChoiceNode;

class Parser {
  private index = 0;
  private nodes = 0;
  constructor(
    private readonly source: string,
    private readonly maxDepth: number,
    private readonly maxNodes: number,
  ) {}
  parse(): MessageNode[] {
    const result = this.sequence(0, false);
    if (this.index !== this.source.length) throw new SyntaxError('Unexpected closing brace.');
    return result;
  }
  private add<T extends MessageNode>(node: T): T {
    this.nodes += 1;
    if (this.nodes > this.maxNodes) throw new RangeError('Message node limit exceeded.');
    return node;
  }
  private sequence(depth: number, nested: boolean): MessageNode[] {
    if (depth > this.maxDepth) throw new RangeError('Message nesting limit exceeded.');
    const nodes: MessageNode[] = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push(this.add({ type: 'text', value: text }));
      text = '';
    };
    while (this.index < this.source.length) {
      const char = this.source[this.index]!;
      if (char === '}') {
        if (!nested) throw new SyntaxError('Unexpected closing brace.');
        flush();
        this.index += 1;
        return nodes;
      }
      if (char !== '{') {
        text += char;
        this.index += 1;
        continue;
      }
      flush();
      nodes.push(this.argument(depth));
    }
    if (nested) throw new SyntaxError('Unclosed message option.');
    flush();
    return nodes;
  }
  private whitespace(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }
  private token(pattern: RegExp, label: string): string {
    const match = pattern.exec(this.source.slice(this.index));
    if (!match || match.index !== 0)
      throw new SyntaxError(`Expected ${label} at position ${this.index}.`);
    this.index += match[0].length;
    return match[0];
  }
  private argument(depth: number): MessageNode {
    this.index += 1;
    this.whitespace();
    const name = this.token(/[A-Za-z_][\w.-]*/, 'an argument name');
    this.whitespace();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return this.add({ type: 'argument', name });
    }
    if (this.source[this.index] !== ',') throw new SyntaxError('Expected comma or closing brace.');
    this.index += 1;
    this.whitespace();
    const kind = this.token(/[A-Za-z]+/, 'a choice type');
    if (kind !== 'plural' && kind !== 'select') {
      throw new SyntaxError(`Unsupported message format "${kind}".`);
    }
    this.whitespace();
    if (this.source[this.index] !== ',')
      throw new SyntaxError('Expected comma before choice options.');
    this.index += 1;
    const options = new Map<string, MessageNode[]>();
    while (true) {
      this.whitespace();
      if (this.source[this.index] === '}') {
        this.index += 1;
        break;
      }
      const rawKey = this.token(
        kind === 'plural'
          ? /(?:=-?(?:\d+(?:\.\d+)?|\.\d+)|[A-Za-z][A-Za-z0-9_-]*)/
          : /[A-Za-z0-9_-]+/,
        'an option key',
      );
      const key =
        kind === 'plural' && rawKey.startsWith('=') ? `=${Number(rawKey.slice(1))}` : rawKey;
      if (kind === 'plural' && key.startsWith('=') && !Number.isFinite(Number(key.slice(1)))) {
        throw new SyntaxError(
          `Exact plural selector "${rawKey}" is outside the finite number range.`,
        );
      }
      if (
        kind === 'plural' &&
        !key.startsWith('=') &&
        !['zero', 'one', 'two', 'few', 'many', 'other'].includes(key)
      ) {
        throw new SyntaxError(`Unsupported plural category "${key}".`);
      }
      if (options.has(key)) throw new SyntaxError(`Duplicate option "${key}".`);
      this.whitespace();
      if (this.source[this.index] !== '{') throw new SyntaxError(`Expected body for "${key}".`);
      this.index += 1;
      options.set(key, this.sequence(depth + 1, true));
    }
    if (!options.has('other')) throw new SyntaxError(`${kind} choices require an "other" option.`);
    return this.add({ type: 'choice', name, kind, options });
  }
}

function valueString(value: string | number | boolean | null | undefined, name: string): string {
  if (value === undefined) throw new TypeError(`Missing message value "${name}".`);
  if (value === null) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`Message value "${name}" must be finite.`);
  }
  return String(value);
}

function render(
  nodes: readonly MessageNode[],
  values: MessageValues,
  locale: string,
  pluralValue?: number,
  maxOutput = 100_000,
): string {
  let result = '';
  const append = (value: string) => {
    if (result.length + value.length > maxOutput)
      throw new RangeError('Message output limit exceeded.');
    result += value;
  };
  for (const node of nodes) {
    if (node.type === 'text') {
      append(
        pluralValue === undefined
          ? node.value
          : node.value.replaceAll('#', new Intl.NumberFormat(locale).format(pluralValue)),
      );
    } else if (node.type === 'argument') {
      append(valueString(readValue(values, node.name), node.name));
    } else {
      const value = readValue(values, node.name);
      if (value === undefined || value === null)
        throw new TypeError(`Missing choice value "${node.name}".`);
      let key: string;
      let count: number | undefined;
      if (node.kind === 'plural') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new TypeError(`Plural value "${node.name}" must be a finite number.`);
        }
        count = value;
        key = node.options.has(`=${value}`)
          ? `=${value}`
          : new Intl.PluralRules(locale).select(value);
      } else {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          throw new TypeError(`Select value "${node.name}" must be a string, number, or boolean.`);
        }
        key = String(value);
      }
      const body = node.options.get(key) ?? node.options.get('other')!;
      append(render(body, values, locale, count ?? pluralValue, maxOutput - result.length));
    }
  }
  return result;
}

function readValue(
  values: MessageValues,
  name: string,
): string | number | boolean | null | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(values, name);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) {
    throw new TypeError(`Message value "${name}" must be a data property.`);
  }
  return descriptor.value as string | number | boolean | null | undefined;
}

export function compileMessage(
  source: string,
  locale = 'en',
  limits: MessageLimits = {},
): CompiledMessage {
  if (typeof source !== 'string') throw new TypeError('Message source must be a string.');
  const maxLength = limits.maxLength ?? 10_000;
  const maxDepth = limits.maxDepth ?? 8;
  const maxNodes = limits.maxNodes ?? 2_000;
  const maxOutput = limits.maxOutput ?? 100_000;
  if (
    !Number.isSafeInteger(maxLength) ||
    maxLength < 1 ||
    maxLength > 1_000_000 ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 32 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 1 ||
    maxNodes > 100_000 ||
    !Number.isSafeInteger(maxOutput) ||
    maxOutput < 1 ||
    maxOutput > 10_000_000
  ) {
    throw new RangeError('Message limits are outside their supported bounds.');
  }
  if (source.length > maxLength) throw new RangeError('Message source length limit exceeded.');
  new Intl.PluralRules(locale);
  const nodes = new Parser(source, maxDepth, maxNodes).parse();
  return { format: (values = {}) => render(nodes, values, locale, undefined, maxOutput) };
}
