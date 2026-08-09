import { ValueObject } from './value-object';

// BSB NNN-NNN + account NNNNNNNN, e.g. "062-000 12345678"
const AU_BANK_ACCOUNT = /^\d{3}-\d{3}\s+\d{6,10}$/;

export class AuBankAccount extends ValueObject {
  protected isValid(value: string): boolean {
    return AU_BANK_ACCOUNT.test(value);
  }

  static getDescription(): string {
    return 'an Australian BSB + account number, format "NNN-NNN NNNNNNNN" (BSB as three digits, dash, three digits; then the account number, 6-10 digits). Only extract this if both the BSB and the account number appear together.';
  }
}
