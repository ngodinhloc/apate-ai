import { Email } from '../../../../src/extract/services/value-objects/email';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('Email', () => {
  it('accepts a well-formed email address', () => {
    expect(new Email('scammer@example.com').getValue()).toBe(
      'scammer@example.com',
    );
  });

  it('rejects a string with no @', () => {
    expect(() => new Email('not-an-email')).toThrow(InvalidValueException);
  });

  it('rejects a string with no domain', () => {
    expect(() => new Email('foo@')).toThrow(InvalidValueException);
  });
});
