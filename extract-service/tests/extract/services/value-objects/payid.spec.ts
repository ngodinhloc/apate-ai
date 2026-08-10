import { PayId } from '../../../../src/extract/services/value-objects/payid';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

describe('PayId', () => {
  it('accepts an email address', () => {
    expect(new PayId('scammer@example.com').getValue()).toBe(
      'scammer@example.com',
    );
  });

  it('accepts a phone number', () => {
    expect(new PayId('0412345678').getValue()).toBe('0412345678');
  });

  it('accepts an ABN', () => {
    expect(new PayId('51 824 753 556').getValue()).toBe('51 824 753 556');
  });

  it('rejects a value that is none of email, phone, or ABN', () => {
    expect(() => new PayId('not-a-payid')).toThrow(InvalidValueException);
  });

  it('getType returns the pay_id data type', () => {
    expect(PayId.getType()).toBe(ExtractDataTypeEnum.PAYID);
  });

  it('getDescription returns a non-empty description', () => {
    expect(PayId.getDescription()).toBe(
      'a PayID — this is always one of an email address, a phone number, or an Australian ABN (11 digits, optionally grouped as "NN NNN NNN NNN"). Only classify a value as pay_id when the scammer explicitly referred to it as a PayID or as the identifier to send a payment to.',
    );
  });
});
