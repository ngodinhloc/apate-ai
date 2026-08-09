import { Injectable } from '@nestjs/common';
import {
  ExtractDataTypeEnum,
  ExtractItem,
} from '../contracts/extract.interface';
import { InvalidValueException } from '../exceptions/invalid-value.exception';
import { AuBankAccount } from './value-objects/au_bank_account';
import { UkBankAccount } from './value-objects/uk_bank_account';
import { Email } from './value-objects/email';
import { Phone } from './value-objects/phone';
import { PayId } from './value-objects/payid';
import { Name } from './value-objects/name';
import { Address } from './value-objects/address';

@Injectable()
export class ObjectValidator {
  /**
   * Re-validates a model-produced item's value against its declared format
   */
  validate(item: ExtractItem): string | null {
    const value = item.value.trim();
    try {
      switch (item.dataType) {
        case ExtractDataTypeEnum.BANK_ACCOUNT_AU:
          return new AuBankAccount(value).getValue();
        case ExtractDataTypeEnum.BANK_ACCOUNT_UK:
          return new UkBankAccount(value).getValue();
        case ExtractDataTypeEnum.PAYID:
          return new PayId(value).getValue();
        case ExtractDataTypeEnum.EMAIL:
          return new Email(value).getValue();
        case ExtractDataTypeEnum.PHONE:
          return new Phone(value).getValue();
        case ExtractDataTypeEnum.NAME:
          return new Name(value).getValue();
        case ExtractDataTypeEnum.ADDRESS:
          return new Address(value).getValue();
        default:
          return null;
      }
    } catch (err) {
      if (err instanceof InvalidValueException) return null;
      throw err;
    }
  }
}
