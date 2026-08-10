# Apate AI

A **scam-baiting chatbot** system. Named after Apate, the Greek goddess of deceit.

---

## The concerns with current design

- **Extraction fires on every message, not on conversation stop/end.** Extraction should only need to run once a conversation is actually over — running it on every turn does redundant work, since a conversation can span many turns before it ends.
- **Conversations are extracted one at a time.** Each conversation incurs its own LLM call and its own fixed system-prompt cost, instead of amortizing that cost across a batch.
- **chat bot calls extract-service synchronously over HTTP**, coupling the two services directly. This makes the system fragile: if extract-service is unavailable at the moment a conversation ends, that conversation's data is silently lost.

## The architecture

![architecture](architecture.png)

### Technical improvements

- Redis holds in-progress conversations as ephemeral state. When a conversation ends (e.g. the user closes the tab), chat-service publishes an event to RabbitMQ instead of calling extract-service directly.
- chat-service and extract-service are fully decoupled — all handoff between them happens over RabbitMQ, removing the synchronous dependency and the failure mode it created.
- extract-service persists each incoming event with `status = NEW`. A cron job periodically claims new conversations and extracts them from the LLM as a single batch.

### Cost optimization

- **Batched extraction** — one LLM request covers a batch of conversations, rather than one request per conversation.
- **Prompt caching** — the system prompt is cached, so its token cost is paid once per cache window instead of on every call.
- **Right-sized models** — chat replies run on a lightweight model (Haiku), reserving the stronger, costlier model (Sonnet) for extraction, where accuracy matters more than latency.

### Implementation

- Time: 3-4 hours
- Please refer to [SPECS.md](SPECS.md) and [PLANS.md](PLANS.md)
- Built using [claude-skills](https://github.com/ngodinhloc/claude-skills)

Sample LLM response from chat-service's `AnthropicAdapter.reply` (Haiku):

```json
{
  "text": "oh no, is my account actually locked?? what do i need to do to fix it",
  "scamProbability": 0.82
}
```

Sample LLM response from extract-service's `AnthropicAdapter.extractBatch` (Sonnet):

```json
{
  "conversations": [
    {
      "conversationUuid": "238538e3-8fdf-4d15-b856-f20155ad908f",
      "items": [
        { "dataType": "name", "value": "John Smith" },
        { "dataType": "email", "value": "scammer@example.com" },
        { "dataType": "phone", "value": "0412345678" },
        { "dataType": "bank_account_au", "value": "062-000 12345678" }
      ]
    },
    {
      "conversationUuid": "1db0efbd-b9cd-411a-b809-95b31b0ccd6e",
      "items": []
    }
  ]
}
```

### With more time

- **Configurable personas** — support multiple scam-baiter personas (e.g. a busy parent, an elderly user unfamiliar with technology) and have the LLM select the most convincing one from the scammer's opening message. Personas should be stored in the database, not code, so new ones can be added without a deployment.
- **Configurable extraction types** — move the set of extractable data types into the database as well, so new types can be added without a code change.
- **Configurable system prompts** — move system prompts into the database (or a config service) so they can be tuned and A/B tested without a redeploy.
- **Dynamic `max_tokens`** — size the extraction request's `max_tokens` based on the number and length of conversations in the batch, instead of a fixed cap, to avoid truncating large batches while not over-provisioning for small ones.
- **LLM-as-judge evaluation framework** — feed each completed conversation, its persona, and its system prompt to a judge LLM that scores bait quality and flags what worked and what didn't. We can use the result to fine tune personas and promts. 

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

