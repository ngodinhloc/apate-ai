import { ValueObject } from './value-object';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject {
  protected isValid(value: string): boolean {
    return EMAIL.test(value);
  }

  static getDescription(): string {
    return 'a well-formed email address (local@domain.tld).';
  }
}
