import { ExtractDataTypeEnum } from '../../contracts/extract.interface';
import { ValueObject } from './value-object';

export class Name extends ValueObject {
  protected isValid(value: string): boolean {
    return value.length > 0;
  }

  static getType(): string {
    return ExtractDataTypeEnum.NAME;
  }

  static getDescription(): string {
    return "the scammer's stated name or alias. Any non-empty string.";
  }
}
