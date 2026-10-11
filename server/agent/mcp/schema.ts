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
