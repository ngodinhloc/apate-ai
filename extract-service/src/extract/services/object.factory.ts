import { Injectable } from '@nestjs/common';
import {
  ExtractDataTypeEnum,
  ExtractItem,
} from '../contracts/extract.interface';
import { InvalidValueException } from '../exceptions/invalid-value.exception';
import { ValueObject } from './value-objects/value-object';
import { AuBankAccount } from './value-objects/au_bank_account';
import { UkBankAccount } from './value-objects/uk_bank_account';
import { Email } from './value-objects/email';
import { Phone } from './value-objects/phone';
import { PayId } from './value-objects/payid';
import { Name } from './value-objects/name';
import { Address } from './value-objects/address';
import { Domain } from './value-objects/domain';

@Injectable()
export class ObjectFactory {
  create(item: ExtractItem): ValueObject | null {
    const value = item.value.trim();
    try {
      switch (item.dataType) {
        case ExtractDataTypeEnum.BANK_ACCOUNT_AU:
          return new AuBankAccount(value);
        case ExtractDataTypeEnum.BANK_ACCOUNT_UK:
          return new UkBankAccount(value);
        case ExtractDataTypeEnum.PAYID:
          return new PayId(value);
        case ExtractDataTypeEnum.EMAIL:
          return new Email(value);
        case ExtractDataTypeEnum.PHONE:
          return new Phone(value);
        case ExtractDataTypeEnum.NAME:
          return new Name(value);
        case ExtractDataTypeEnum.ADDRESS:
          return new Address(value);
        case ExtractDataTypeEnum.DOMAIN:
          return new Domain(value);
        default:
          return null;
      }
    } catch (err) {
      if (err instanceof InvalidValueException) return null;
      throw err;
    }
  }
}
