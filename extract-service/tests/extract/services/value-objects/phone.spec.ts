import { Phone } from '../../../../src/extract/services/value-objects/phone';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('Phone', () => {
  it('accepts a phone number with an optional + prefix', () => {
    expect(new Phone('+61 412 345 678').getValue()).toBe('+61 412 345 678');
  });

  it('accepts a phone number with hyphens and parentheses', () => {
    expect(new Phone('(02) 1234-5678').getValue()).toBe('(02) 1234-5678');
  });

  it('rejects a value with letters', () => {
    expect(() => new Phone('call-me-maybe')).toThrow(InvalidValueException);
  });

  it('rejects a value that is too short', () => {
    expect(() => new Phone('123')).toThrow(InvalidValueException);
  });
});
