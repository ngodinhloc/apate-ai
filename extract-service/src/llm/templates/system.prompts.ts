import { ExtractDataTypeEnum } from '../../extract/contracts/extract.interface';
import { Name } from '../../extract/services/value-objects/name';
import { Email } from '../../extract/services/value-objects/email';
import { Phone } from '../../extract/services/value-objects/phone';
import { Address } from '../../extract/services/value-objects/address';
import { AuBankAccount } from '../../extract/services/value-objects/au_bank_account';
import { UkBankAccount } from '../../extract/services/value-objects/uk_bank_account';
import { PayId } from '../../extract/services/value-objects/payid';

const FORMAT_RULES = [
  [ExtractDataTypeEnum.NAME, Name.getDescription()],
  [ExtractDataTypeEnum.EMAIL, Email.getDescription()],
  [ExtractDataTypeEnum.PHONE, Phone.getDescription()],
  [ExtractDataTypeEnum.ADDRESS, Address.getDescription()],
  [ExtractDataTypeEnum.BANK_ACCOUNT_AU, AuBankAccount.getDescription()],
  [ExtractDataTypeEnum.BANK_ACCOUNT_UK, UkBankAccount.getDescription()],
  [ExtractDataTypeEnum.PAYID, PayId.getDescription()],
]
  .map(([type, format]) => `- "${type}": ${format}`)
  .join('\n');

/**
 * System prompt for the structured-extraction call. Always takes a JSON array of
 * conversations — a single extraction is just a one-element array — so one call can
 * cover every conversation claimed by a cron run instead of one call each.
 */
export const EXTRACTOR_SYSTEM_PROMT = `You are a data-extraction assistant for a scam-detection system. You will be given a JSON array of conversations, each a transcript between a suspected scammer ("user") and a scam-baiting bot ("agent"), identified by its conversationUuid. For every conversation, extract every piece of identifying or financial information the scammer ("user" messages only — never invent or copy anything the "agent" said) volunteered, classified by data type.

For each item you extract, it must match one of these types and its format rule. Discard anything that doesn't clearly match — do not guess or normalize a fragment into a shape it doesn't have:

${FORMAT_RULES}

Do not fabricate values, do not infer a bank account from a name alone, and do not extract anything from a message that only mentions a data type in the abstract (e.g. "I'll give you my BSB" with no actual number is not extractable).

Return one item per distinct value found — if the same email appears three times within one conversation, return it once. Respond with one entry per input conversation, in the same order, each carrying its original conversationUuid — even if it has no extractable items (return an empty items array for it).`;
