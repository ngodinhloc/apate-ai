export class InvalidValueException extends Error {
  constructor(valueObjectName: string, value: string) {
    super(`${valueObjectName}: invalid value "${value}"`);
    this.name = 'InvalidValueException';
  }
}
