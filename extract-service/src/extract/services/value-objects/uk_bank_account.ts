import { ValueObject } from './value-object';

// Sort code NN-NN-NN + account NNNNNNNN, e.g. "12-34-56 12345678"
const UK_BANK_ACCOUNT = /^\d{2}-\d{2}-\d{2}\s+\d{6,10}$/;

export class UkBankAccount extends ValueObject {
  protected isValid(value: string): boolean {
    return UK_BANK_ACCOUNT.test(value);
  }

  static getDescription(): string {
    return 'a UK sort code + account number, format "NN-NN-NN NNNNNNNN" (sort code as three two-digit groups separated by dashes; then the account number, 6-10 digits). Only extract this if both the sort code and the account number appear together.';
  }
}
