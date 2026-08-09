import { PayId } from '../../../../src/extract/services/value-objects/payid';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

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
});
