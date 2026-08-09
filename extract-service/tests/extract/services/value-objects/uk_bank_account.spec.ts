import { UkBankAccount } from '../../../../src/extract/services/value-objects/uk_bank_account';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('UkBankAccount', () => {
  it('accepts a sort code + account number', () => {
    expect(new UkBankAccount('12-34-56 12345678').getValue()).toBe(
      '12-34-56 12345678',
    );
  });

  it('rejects a sort code with no account number', () => {
    expect(() => new UkBankAccount('12-34-56')).toThrow(InvalidValueException);
  });

  it('rejects a malformed sort code', () => {
    expect(() => new UkBankAccount('123456 12345678')).toThrow(
      InvalidValueException,
    );
  });
});
