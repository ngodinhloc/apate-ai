import { ObjectValidator } from '../../../src/extract/services/object.validator';
import {
  ExtractDataTypeEnum,
  ExtractItem,
} from '../../../src/extract/contracts/extract.interface';

describe('ObjectValidator', () => {
  const validator = new ObjectValidator();

  const item = (dataType: ExtractDataTypeEnum, value: string): ExtractItem => ({
    dataType,
    value,
  });

  describe('name', () => {
    it('returns the trimmed value for a non-empty name', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.NAME, '  John  ')),
      ).toBe('John');
    });

    it('returns null for an empty name', () => {
      expect(validator.validate(item(ExtractDataTypeEnum.NAME, '   '))).toBe(
        null,
      );
    });
  });

  describe('address', () => {
    it('returns the trimmed value for a non-empty address', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.ADDRESS, ' 1 Main St ')),
      ).toBe('1 Main St');
    });

    it('returns null for an empty address', () => {
      expect(validator.validate(item(ExtractDataTypeEnum.ADDRESS, ''))).toBe(
        null,
      );
    });
  });

  describe('email', () => {
    it('returns the value for a well-formed email', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.EMAIL, 'scammer@example.com'),
        ),
      ).toBe('scammer@example.com');
    });

    it('returns null for a malformed email', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.EMAIL, 'not-an-email')),
      ).toBe(null);
    });
  });

  describe('phone', () => {
    it('returns the value for a well-formed phone number', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.PHONE, '0412345678')),
      ).toBe('0412345678');
    });

    it('returns null for a phone number with letters', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.PHONE, 'call-me')),
      ).toBe(null);
    });
  });

  describe('bank_account_au', () => {
    it('returns the value for a valid BSB + account number', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_AU, '062-000 12345678'),
        ),
      ).toBe('062-000 12345678');
    });

    it('returns null when the account number is missing', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_AU, '062-000'),
        ),
      ).toBe(null);
    });
  });

  describe('bank_account_uk', () => {
    it('returns the value for a valid sort code + account number', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_UK, '12-34-56 12345678'),
        ),
      ).toBe('12-34-56 12345678');
    });

    it('returns null when the account number is missing', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_UK, '12-34-56'),
        ),
      ).toBe(null);
    });
  });

  describe('pay_id', () => {
    it('returns the value when it is an email', () => {
      expect(
        validator.validate(
          item(ExtractDataTypeEnum.PAYID, 'scammer@example.com'),
        ),
      ).toBe('scammer@example.com');
    });

    it('returns the value when it is an ABN', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.PAYID, '51 824 753 556')),
      ).toBe('51 824 753 556');
    });

    it('returns null when it matches none of email, phone, or ABN', () => {
      expect(
        validator.validate(item(ExtractDataTypeEnum.PAYID, 'not-a-payid')),
      ).toBe(null);
    });
  });

  it('returns null for an unrecognized data type', () => {
    expect(
      validator.validate({
        dataType: 'unknown' as ExtractDataTypeEnum,
        value: 'anything',
      }),
    ).toBe(null);
  });
});
