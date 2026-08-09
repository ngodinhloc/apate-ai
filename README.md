# Apate AI

A **scam-baiting chatbot** system. Named for Apate, the Greek goddess of deceit.

---

## The concerns with current design

- **Extraction fires on every message, not on conversation stop/end.** Extraction should only need to run once a conversation is actually over — running it on every turn does redundant work, since a conversation can span many turns before it ends.
- **Conversations are extracted one at a time.** Each conversation incurs its own LLM call and its own fixed system-prompt cost, instead of amortizing that cost across a batch.
- **chat bot calls extract-service synchronously over HTTP**, coupling the two services directly. This makes the system fragile: if extract-service is unavailable at the moment a conversation ends, that conversation's data is silently lost.

## The new architecture

![architecture](architecture.png)

### Implementation

- Time: 3-4 hours
- Please refer to [SPECS.md](SPECS.md) and [PLANS.md](PLANS.md)

### Technical improvements

- Redis holds in-progress conversations as ephemeral state. When a conversation ends (e.g. the user closes the tab), chat-service publishes an event to RabbitMQ instead of calling extract-service directly.
- chat-service and extract-service are fully decoupled — all handoff between them happens over RabbitMQ, removing the synchronous dependency and the failure mode it created.
- extract-service persists each incoming event with `status = NEW`. A cron job periodically claims new conversations and extracts them from the LLM as a single batch.

### Cost optimization

- **Batched extraction** — one LLM request covers a batch of conversations, rather than one request per conversation.
- **Prompt caching** — the system prompt is cached, so its token cost is paid once per cache window instead of on every call.
- **Right-sized models** — chat replies run on a lightweight model (Haiku), reserving the stronger, costlier model (Sonnet) for extraction, where accuracy matters more than latency.

### Quick start

```bash
# 1. Set Anthropic API keys
cp chat-service/.env.example chat-service/.env
cp extract-service/.env.example extract-service/.env
# edit both — set ANTHROPIC_API_KEY=sk-ant-...

# 2. Start everything
docker compose up --build
```

- chat-frontend: [http://localhost:3000](http://localhost:3000)
- chat-service health: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- extract-service health: [http://localhost:8001/api/health](http://localhost:8001/api/health)

