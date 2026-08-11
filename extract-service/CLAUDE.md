# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev   # nest start --watch, http://localhost:8000 (mapped to 8001 in docker-compose)
npm run build         # nest build
npm run start
npm run lint           # eslint "{src,test}/**/*.ts"
npm run format         # prettier --write "{src,test}/**/*.ts"
npm run test             # jest, runs tests/**/*.spec.ts
npx jest tests/extract/services/value-objects/au_bank_account.spec.ts   # single test file
```

Needs Postgres and RabbitMQ reachable — set `DATABASE_URL`/`RABBITMQ_URL` (see `.env.example`), or run `docker compose up --build` from the repo root to start everything together, including `chat-service`, which is what actually feeds this service conversations in normal operation.

## Architecture

This is extract-service, the NestJS/TypeORM backend that mines ended conversations for scammer intelligence in Apate AI. It is one of three services in the monorepo (`chat-frontend`, `chat-service`, `extract-service`) — see the root `README.md` and `SPECS.md` for the system-wide architecture. It shares one Postgres instance with `chat-service`, but in a separate schema (`extract_service` vs `chat_service` — see `EnvService.getDbSchema()`); the two services' `conversations` tables are independent copies, not shared rows.

**Two ingestion paths feed the same pipeline**, both landing on `ExtractService.persistConversation` (upsert into `conversations` with `status = NEW`):
- **Sync** — `POST /api/extract` (`ExtractController`), called directly by chat-service when `EXTRACT_ACTION=1`. `ExtractService.extractAll` persists then immediately extracts the batch inline (bypassing the cron's NEW/PROCESSING claim) and returns the result in the response.
- **Async** — a RabbitMQ consumer (`RabbitMqConsumer`, queue `extract-service.queue`) bound to the `apate` exchange (constant `EXCHANGE_APATE`, actually `'apapte'` — a typo shared verbatim with chat-service's contract; the two must match byte-for-byte) under routing key `apate.conversation.ended`. Messages are dispatched through `MessageProcessor` → `EVENT_REGISTRY` (`event/configs/event.config.ts`, a name→handler map — see Claude skill `event-processor-pattern` before adding a new event type) → `ConversationEndedHandler`, which only persists; extraction itself waits for the next cron tick.

**Cron-driven batch extraction** (`CronService`, `@Cron(EVERY_MINUTE)`) — `claimNewConversations` runs a `SELECT ... FOR UPDATE` + status update to `PROCESSING` inside one transaction, so concurrent instances can't double-claim the same rows (a competing transaction blocks on the row lock, then finds nothing left at `NEW`). The claimed batch is sent to Claude in a single call via `AnthropicAdapter.extractBatch` (Sonnet, `output_config.effort: 'low'`, system prompt behind `cache_control: { type: 'ephemeral' }` for prompt caching) rather than one call per conversation — this is the batching `README.md` cites as the main cost lever over the old design. On any failure the whole batch is reset back to `NEW` (`resetToNew`) for a later retry, since a batch-level failure can't be attributed to one conversation.

**Extraction persistence** — for each conversation in Claude's structured `ExtractOutput`, `ExtractService.processBatch` writes the scam probability as its own row (`dataType = ExtractDataTypeEnum.SCAM_PROBABILITY`) alongside the extracted items, all upserted into `extractions` on the unique index `(conversation_uuid, data_type, value)` — re-running extraction on the same conversation is idempotent. `ExtractDataTypeEnum` (`extract/contracts/extract.interface.ts`) has two members beyond what `SPECS.md` documents — `DOMAIN` and `SCAM_PROBABILITY` — the interface doc predates them.

**Value-object validation** — before persisting, every LLM-extracted item is re-validated by `ObjectFactory.create`, which maps `dataType` to a `ValueObject` subclass (`extract/services/value-objects/*`: `AuBankAccount`, `UkBankAccount`, `Email`, `Phone`, `PayId`, `Name`, `Address`, `Domain`). A constructor throwing `InvalidValueException` makes the factory return `null` and the item is dropped (logged, not erroring the batch) — Claude's structured output is schema-valid JSON but not format-valid data, so this is the actual format gate described in `SPECS.md` (BSB/account format for AU bank accounts, sort code/account for UK, email/phone/ABN for PayID).

**Config/logging** — `EnvService`/`AppLogger` follow this codebase's standard `env-module-pattern`/`logger-module-pattern` Claude skills.

**Testing** — this service has the fuller spec suite of the two backends: `extract.service`, `cron.service`, `object.factory`, every value object, and `anthropic.adapter` all have coverage under `tests/`.
