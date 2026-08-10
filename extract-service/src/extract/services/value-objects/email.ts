import { ExtractDataTypeEnum } from '../../contracts/extract.interface';
import { ValueObject } from './value-object';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email extends ValueObject {
  protected isValid(value: string): boolean {
    return EMAIL.test(value);
  }

  static getType(): string {
    return ExtractDataTypeEnum.EMAIL;
  }

  static getDescription(): string {
    return 'a well-formed email address (local@domain.tld).';
  }
}
