export type SchemaType = 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'null';

export interface Schema {
  type?: SchemaType | SchemaType[];
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: readonly (string | number | boolean | null)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
}

const AJV_LOCATION = /^data((?:\/[^\s]*)?)(?=\s)/;
const CF_LOCATION = /^#((?:\/[^\s:]*)?):/;
const REQUIRED_PROPERTY = /required property\s+['"]?([^'"\s.]+)/;

function segments(location: string): string[] {
  return location.split('/').filter((part) => part !== '').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function walk(schema: Schema, parts: string[]): Schema | undefined {
  let current: Schema | undefined = schema;
  for (const part of parts) {
    current = /^\d+$/.test(part) && current?.items ? current.items : current?.properties?.[part];
    if (!current) return undefined;
  }
  return current;
}

function name(parts: string[]): string {
  if (parts.length === 0) return 'arguments';
  return parts.reduce((out, part) => (/^\d+$/.test(part) ? `${out}[${part}]` : out ? `${out}.${part}` : part), '');
}

function expectation(schema: Schema | undefined): string {
  if (!schema) return 'a value the tool accepts';
  const bits: string[] = [];
  if (schema.type && !schema.enum) bits.push((Array.isArray(schema.type) ? schema.type : [schema.type]).join(' or '));
  if (schema.enum) bits.push(`one of ${schema.enum.join(', ')}`);
  if (schema.minimum !== undefined) bits.push(`at least ${schema.minimum}`);
  if (schema.maximum !== undefined) bits.push(`at most ${schema.maximum}`);
  if (schema.minLength !== undefined) bits.push(`at least ${schema.minLength} characters`);
  if (schema.maxLength !== undefined) bits.push(`at most ${schema.maxLength} characters`);
  if (schema.minItems !== undefined) bits.push(`at least ${schema.minItems} items`);
  if (schema.maxItems !== undefined) bits.push(`at most ${schema.maxItems} items`);
  return bits.length > 0 ? bits.join(', ') : 'a value the tool accepts';
}

export function describeIssue(schema: Schema, messages: readonly string[]): string {
  const message = messages.flatMap((entry) => entry.split(/;\s+(?=#)/)).at(-1) ?? '';
  const location = AJV_LOCATION.exec(message)?.[1] ?? CF_LOCATION.exec(message)?.[1] ?? '';
  const parts = segments(location);
  const missing = REQUIRED_PROPERTY.exec(message)?.[1];
  if (missing) return `${name([...parts, missing])} is required`;
  if (/additional propert/i.test(message)) return `${name(parts)} has properties the tool does not accept`;
  return `${name(parts)} must be ${expectation(walk(schema, parts))}`;
}
