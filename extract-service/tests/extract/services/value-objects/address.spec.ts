import { Address } from '../../../../src/extract/services/value-objects/address';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('Address', () => {
  it('accepts a non-empty string', () => {
    expect(new Address('1 Main St, Sydney').getValue()).toBe(
      '1 Main St, Sydney',
    );
  });

  it('rejects an empty string', () => {
    expect(() => new Address('')).toThrow(InvalidValueException);
  });
});
