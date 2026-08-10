import { Domain } from '../../../../src/extract/services/value-objects/domain';
import { InvalidValueException } from '../../../../src/extract/exceptions/invalid-value.exception';
import { ExtractDataTypeEnum } from '../../../../src/extract/contracts/extract.interface';

describe('Domain', () => {
  it('accepts a well-formed domain', () => {
    expect(new Domain('example.com').getValue()).toBe('example.com');
  });

  it('accepts a domain with a subdomain', () => {
    expect(new Domain('pay.example.co.uk').getValue()).toBe(
      'pay.example.co.uk',
    );
  });

  it('rejects a string with no TLD', () => {
    expect(() => new Domain('localhost')).toThrow(InvalidValueException);
  });

  it('rejects a URL with a scheme', () => {
    expect(() => new Domain('https://example.com')).toThrow(
      InvalidValueException,
    );
  });

  it('getType returns the domain data type', () => {
    expect(Domain.getType()).toBe(ExtractDataTypeEnum.DOMAIN);
  });

  it('getDescription returns a non-empty description', () => {
    expect(Domain.getDescription()).toBe(
      'a website or email domain (e.g. example.com), no scheme or path.',
    );
  });
});
