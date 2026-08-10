import { Address } from '../../../../src/extract/services/value-objects/address';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

describe('Address', () => {
  it('accepts a non-empty string', () => {
    expect(new Address('1 Main St, Sydney').getValue()).toBe(
      '1 Main St, Sydney',
    );
  });

  it('rejects an empty string', () => {
    expect(() => new Address('')).toThrow(InvalidValueException);
  });

  it('getType returns the address data type', () => {
    expect(Address.getType()).toBe(ExtractDataTypeEnum.ADDRESS);
  });

  it('getDescription returns a non-empty description', () => {
    expect(Address.getDescription()).toBe(
      'a physical address the scammer gave. Any non-empty string.',
    );
  });
});
