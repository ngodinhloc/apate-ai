import { ExtractDataTypeEnum } from '../../contracts/extract.interface';
import { ValueObject } from './value-object';

const DOMAIN = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;

export class Domain extends ValueObject {
  protected isValid(value: string): boolean {
    return DOMAIN.test(value);
  }

  static getType(): string {
    return ExtractDataTypeEnum.DOMAIN;
  }

  static getDescription(): string {
    return 'a website or email domain (e.g. example.com), no scheme or path.';
  }
}
