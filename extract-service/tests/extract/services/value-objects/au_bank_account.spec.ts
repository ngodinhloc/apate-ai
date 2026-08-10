import { AuBankAccount } from '../../../../src/extract/services/value-objects/au_bank_account';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

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

  it('getType returns the AU bank account data type', () => {
    expect(AuBankAccount.getType()).toBe(ExtractDataTypeEnum.BANK_ACCOUNT_AU);
  });

  it('getDescription returns a non-empty description', () => {
    expect(AuBankAccount.getDescription()).toBe(
      'an Australian BSB + account number, format "NNN-NNN NNNNNNNN" (BSB as three digits, dash, three digits; then the account number, 6-10 digits). Only extract this if both the BSB and the account number appear together.',
    );
  });
});
