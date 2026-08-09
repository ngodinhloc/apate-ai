import { InvalidValueException } from '../../exceptions/invalid-value.exception';

export abstract class ValueObject {
  private readonly value: string;

  constructor(value: string) {
    if (!this.isValid(value)) {
      throw new InvalidValueException(new.target.name, value);
    }
    this.value = value;
  }

  getValue(): string {
    return this.value;
  }

  protected abstract isValid(value: string): boolean;
}
