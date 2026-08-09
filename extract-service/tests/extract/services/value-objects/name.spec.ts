import { Name } from '../../../../src/extract/services/value-objects/name';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';

describe('Name', () => {
  it('accepts a non-empty string', () => {
    expect(new Name('John Smith').getValue()).toBe('John Smith');
  });

  it('rejects an empty string', () => {
    expect(() => new Name('')).toThrow(InvalidValueException);
  });
});
