import {
  ExtractDataTypeEnum,
  ExtractItem,
} from '../contracts/extract.interface';

// BSB NNN-NNN + account NNNNNNNN, e.g. "062-000 12345678"
const AU_BANK_ACCOUNT = /^\d{3}-\d{3}\s+\d{6,10}$/;
// Sort code NN-NN-NN + account NNNNNNNN, e.g. "12-34-56 12345678"
const UK_BANK_ACCOUNT = /^\d{2}-\d{2}-\d{2}\s+\d{6,10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9()\-\s]{6,20}$/;
const ABN = /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/;

/**
 * Re-validates a model-produced item's value against its declared format before
 * insert — the extraction prompt states these rules too, but a value gating a
 * unique index should never be trusted from the model output alone.
 */
export function isValidFormat(item: ExtractItem): boolean {
  switch (item.dataType) {
    case ExtractDataTypeEnum.BANK_ACCOUNT_AU:
      return AU_BANK_ACCOUNT.test(item.value.trim());
    case ExtractDataTypeEnum.BANK_ACCOUNT_UK:
      return UK_BANK_ACCOUNT.test(item.value.trim());
    case ExtractDataTypeEnum.PAYID:
      return (
        EMAIL.test(item.value.trim()) ||
        PHONE.test(item.value.trim()) ||
        ABN.test(item.value.trim())
      );
    case ExtractDataTypeEnum.EMAIL:
      return EMAIL.test(item.value.trim());
    case ExtractDataTypeEnum.PHONE:
      return PHONE.test(item.value.trim());
    case ExtractDataTypeEnum.NAME:
    case ExtractDataTypeEnum.ADDRESS:
      return item.value.trim().length > 0;
    default:
      return false;
  }
}
