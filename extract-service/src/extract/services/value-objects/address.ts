import { ValueObject } from './value-object';

export class Address extends ValueObject {
  protected isValid(value: string): boolean {
    return value.length > 0;
  }

  static getDescription(): string {
    return 'a physical address the scammer gave. Any non-empty string.';
  }
}
