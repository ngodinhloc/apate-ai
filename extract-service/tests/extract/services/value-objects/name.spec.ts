import { Name } from '../../../../src/extract/services/value-objects/name';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

describe('Name', () => {
  it('accepts a non-empty string', () => {
    expect(new Name('John Smith').getValue()).toBe('John Smith');
  });

  it('rejects an empty string', () => {
    expect(() => new Name('')).toThrow(InvalidValueException);
  });

  it('getType returns the name data type', () => {
    expect(Name.getType()).toBe(ExtractDataTypeEnum.NAME);
  });

  it('getDescription returns a non-empty description', () => {
    expect(Name.getDescription()).toBe(
      "the scammer's stated name or alias. Any non-empty string.",
    );
  });
});
