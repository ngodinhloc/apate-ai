import { ValueObject } from './value-object';

const PHONE = /^\+?[0-9()\-\s]{6,20}$/;

export class Phone extends ValueObject {
  protected isValid(value: string): boolean {
    return PHONE.test(value);
  }

  static getDescription(): string {
    return 'a phone number, digits with optional +, spaces, hyphens, or parentheses.';
  }
}
