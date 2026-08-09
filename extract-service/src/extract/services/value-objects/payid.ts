import { ValueObject } from './value-object';
import { Email } from './email';
import { Phone } from './phone';
import { InvalidValueException } from '../../exceptions/invalid-value.exception';

// Australian ABN, e.g. "51 824 753 556"
const ABN = /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/;

export class PayId extends ValueObject {
  protected isValid(value: string): boolean {
    return isEmail(value) || isPhone(value) || ABN.test(value);
  }

  static getDescription(): string {
    return 'a PayID — this is always one of an email address, a phone number, or an Australian ABN (11 digits, optionally grouped as "NN NNN NNN NNN"). Only classify a value as pay_id when the scammer explicitly referred to it as a PayID or as the identifier to send a payment to.';
  }
}

function isEmail(value: string): boolean {
  try {
    new Email(value);
    return true;
  } catch (err) {
    if (err instanceof InvalidValueException) return false;
    throw err;
  }
}

function isPhone(value: string): boolean {
  try {
    new Phone(value);
    return true;
  } catch (err) {
    if (err instanceof InvalidValueException) return false;
    throw err;
  }
}
