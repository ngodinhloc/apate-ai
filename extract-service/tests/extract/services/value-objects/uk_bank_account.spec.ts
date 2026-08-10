import { UkBankAccount } from '../../../../src/extract/services/value-objects/uk_bank_account';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

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

  it('getType returns the UK bank account data type', () => {
    expect(UkBankAccount.getType()).toBe(ExtractDataTypeEnum.BANK_ACCOUNT_UK);
  });

  it('getDescription returns a non-empty description', () => {
    expect(UkBankAccount.getDescription()).toBe(
      'a UK sort code + account number, format "NN-NN-NN NNNNNNNN" (sort code as three two-digit groups separated by dashes; then the account number, 6-10 digits). Only extract this if both the sort code and the account number appear together.',
    );
  });
});
