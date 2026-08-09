import { ValueObject } from './value-object';

export class Name extends ValueObject {
  protected isValid(value: string): boolean {
    return value.length > 0;
  }

  static getDescription(): string {
    return "the scammer's stated name or alias. Any non-empty string.";
  }
}
