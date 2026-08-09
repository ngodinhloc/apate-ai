import { AuBankAccount } from '../../../../src/extract/services/value-objects/au_bank_account';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('AuBankAccount', () => {
  it('accepts a BSB + account number', () => {
    expect(new AuBankAccount('062-000 12345678').getValue()).toBe(
      '062-000 12345678',
    );
  });

  it('rejects a BSB with no account number', () => {
    expect(() => new AuBankAccount('062-000')).toThrow(InvalidValueException);
  });

  it('rejects a malformed BSB', () => {
    expect(() => new AuBankAccount('062000 12345678')).toThrow(
      InvalidValueException,
    );
  });
});
