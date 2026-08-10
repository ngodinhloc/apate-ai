import { ObjectFactory } from '../../../src/extract/services/object.factory';
import {
  ExtractDataTypeEnum,
  ExtractItem,
} from '../../../src/extract/contracts/extract.interface';

describe('ObjectFactory', () => {
  const factory = new ObjectFactory();

  const item = (dataType: ExtractDataTypeEnum, value: string): ExtractItem => ({
    dataType,
    value,
  });

  describe('name', () => {
    it('returns the trimmed value for a non-empty name', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.NAME, '  John  '))?.getValue(),
      ).toBe('John');
    });

    it('returns null for an empty name', () => {
      expect(factory.create(item(ExtractDataTypeEnum.NAME, '   '))).toBe(
        null,
      );
    });
  });

  describe('address', () => {
    it('returns the trimmed value for a non-empty address', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.ADDRESS, ' 1 Main St '))?.getValue(),
      ).toBe('1 Main St');
    });

    it('returns null for an empty address', () => {
      expect(factory.create(item(ExtractDataTypeEnum.ADDRESS, ''))).toBe(
        null,
      );
    });
  });

  describe('email', () => {
    it('returns the value for a well-formed email', () => {
      expect(
        factory
          .create(item(ExtractDataTypeEnum.EMAIL, 'scammer@example.com'))
          ?.getValue(),
      ).toBe('scammer@example.com');
    });

    it('returns null for a malformed email', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.EMAIL, 'not-an-email')),
      ).toBe(null);
    });
  });

  describe('phone', () => {
    it('returns the value for a well-formed phone number', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.PHONE, '0412345678'))?.getValue(),
      ).toBe('0412345678');
    });

    it('returns null for a phone number with letters', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.PHONE, 'call-me')),
      ).toBe(null);
    });
  });

  describe('bank_account_au', () => {
    it('returns the value for a valid BSB + account number', () => {
      expect(
        factory
          .create(item(ExtractDataTypeEnum.BANK_ACCOUNT_AU, '062-000 12345678'))
          ?.getValue(),
      ).toBe('062-000 12345678');
    });

    it('returns null when the account number is missing', () => {
      expect(
        factory.create(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_AU, '062-000'),
        ),
      ).toBe(null);
    });
  });

  describe('bank_account_uk', () => {
    it('returns the value for a valid sort code + account number', () => {
      expect(
        factory
          .create(item(ExtractDataTypeEnum.BANK_ACCOUNT_UK, '12-34-56 12345678'))
          ?.getValue(),
      ).toBe('12-34-56 12345678');
    });

    it('returns null when the account number is missing', () => {
      expect(
        factory.create(
          item(ExtractDataTypeEnum.BANK_ACCOUNT_UK, '12-34-56'),
        ),
      ).toBe(null);
    });
  });

  describe('domain', () => {
    it('returns the value for a well-formed domain', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.DOMAIN, 'example.com'))
          ?.getValue(),
      ).toBe('example.com');
    });

    it('returns null for a domain with no TLD', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.DOMAIN, 'localhost')),
      ).toBe(null);
    });
  });

  describe('pay_id', () => {
    it('returns the value when it is an email', () => {
      expect(
        factory
          .create(item(ExtractDataTypeEnum.PAYID, 'scammer@example.com'))
          ?.getValue(),
      ).toBe('scammer@example.com');
    });

    it('returns the value when it is an ABN', () => {
      expect(
        factory
          .create(item(ExtractDataTypeEnum.PAYID, '51 824 753 556'))
          ?.getValue(),
      ).toBe('51 824 753 556');
    });

    it('returns null when it matches none of email, phone, or ABN', () => {
      expect(
        factory.create(item(ExtractDataTypeEnum.PAYID, 'not-a-payid')),
      ).toBe(null);
    });
  });

  it('returns null for an unrecognized data type', () => {
    expect(
      factory.create({
        dataType: 'unknown' as ExtractDataTypeEnum,
        value: 'anything',
      }),
    ).toBe(null);
  });
});
