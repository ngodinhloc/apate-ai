import { ExtractDataTypeEnum } from '../../contracts/extract.interface';
import { ValueObject } from './value-object';

export class Address extends ValueObject {
  protected isValid(value: string): boolean {
    return value.length > 0;
  }

  static getType(): string {
    return ExtractDataTypeEnum.ADDRESS;
  }

  static getDescription(): string {
    return 'a physical address the scammer gave. Any non-empty string.';
  }
}
