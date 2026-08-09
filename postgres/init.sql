-- chat-service and extract-service share this database but each owns its own
-- schema (see PLANS.md). TypeORM's `schema` option qualifies table names but
-- does not create the schema itself, so it must exist before either service
-- runs `synchronize: true`.
CREATE SCHEMA IF NOT EXISTS chat_service;
CREATE SCHEMA IF NOT EXISTS extract_service;
