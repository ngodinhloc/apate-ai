# Apate AI 
Aptea AI is a scam detection chatbot that plays along with the scammer conversation to collect intelligent information, e.g: bank account details, email addresses, phone numbers, and PayIDs

## chat-frontend:
- NextJS, App Router: very similar to ../architect-multi-agent/frontend
- Expandable left menu: New Chat button, Chat History
- - New Chat button -> new chat page includes a chat interface. Request to send to chat-service at api/chat/, then open a websockt to api/chat/{uuid}
- - Chat History -> list the chat history. Request to GET: api/chat/historym and GET: api/chat/history/{uuid} for detail of each conversation

## chat-service
- NestJS, TypeORM: very similar to ../architect-multi-agent/backend

### Interfaces
Message {
    sender: "user" | "agent",
    text: string,
    timestamp: date,
}

Conversation {
    conversationId: uui,
    messages: MessageInterface[],
    scamProbability: number,
    status: StatusEnum
    createdAt: date,
    modfiefAt: date
}

StatusEnum {
    Inprogress: 0,
    Ended: 1;
}

ChatMessage {
    conversationId: uui,
    text: string,
}

ChatEnd {
    conversationId: uui,
}

ChatResponse {
    conversationId: uui,
    text: string,
    scamProbability: float (0-1)
}

ConversationEvent {
    eventName: apate.conversation.ended,
    data: {
        conversationId: uui,
        messages: MessageInterface[],
        scamProbability: number,
        status: StatusEnum
        createdAt: date,
        modfiefAt: date
    }
}

### Database:
conversations table {
    id: int, auto-increment,
    uuid: string,
    title: string,
    messages: MessageInterface[] (jsonb),
    scam_probability: float (0-1),
    status: StatusEnum (smallint)
    created_at: date,
    modified_at: data 
}

### Endpoints:
- POST api/chat/: create a new record in conversations table, title = substring of the message, store an item in redis with key uuid, and value = Conversation

- POST api/chat/{uuid}: frontend will send a ChatMessageInteface, chat-service will converte ChatMessage to Message (sender="user", add timespatem), then apend the new Message to Conversation.messages in redis, then send the full conversation to Claude, Claude will respone with output structure ChatResponse, chat-service then append new Message(sender="agent") to Conversation.messages, and update Conversation.scamProbability.

- POST: api/chat/{uuid}/end: on frontend, when user close or navigate away the chat page of a current conversation -> frontend send request ChatEnd to this endpoint, chat-service then retrieve the Conversation from redis, upsert the record in conversations table. Introduce an env EXTRACT_ACTION=1|2 (SYNC|ASYNC), if  EXTRACT_ACTION=1 then send a request o extract-service at: api/extract with payload = Conversation, if EXTRACT_ACTION =2 then publish an event message ConversationEvent to exchange apapte with routing key = apate.conversation.ended

- GET api/chat/: return the list of conversations ()
- GET api/chat/{uuid}: return detail of one conversation

## extract-service
- NestJS, TypeORM: use ../architect-multi-agent/backend for style and pattern

### Intefaces
ExtractDataTypeEnum {
    NAME: name,
    EMAIL: email,
    PHONE: phone,
    ADDRESS: address,
    BANK_ACCOUNT_AU: banka_account_au,
    BANK_ACCOUNT_UK: bank_account_uk,
    PAYID: pay_id
}
// Format vaidation
BANK_ACCOUNT_AU: BSB (NNN-NNN) + ACCOUNT(NNNNNNNN)
BANK_ACCOUNT_UK: sort code (NN-NN-NN) + ACCOUNT(NNNNNNNN)
PAYID: email / phone / ABN


ExtractOutput {
    conversations: ExtractConversation[],     
}

ExtractConversation {
    conversationUuid: string,
    items: ExtractItem[]
}

ExtractItem {
    dataType: ExtractDataTypeEnum,
    value: string,
}

### Database
ExtractStatusEnum {
    NEW: 0,
    PROCESSED: 1,
    PROCESSING: 2,
}

conversations table {
    id: int, auto-increment,
    uuid: string,
    title: string,
    messages: MessageInterface[] (jsonb),
    scam_probability: float (0-1),
    status: ExtractStatusEnum (smallint)
    created_at: date,
    modified_at: data 
}

extractions table {
    id: int, auto-increment,
    conversation_uuid: string,
    data_type: ExtractDataTypeEnum|string,
    value: string,
    created_at: date,
    unique index: (conversation_uuid,data_type,value)
}

### Endpoints
- POST api/extract: payload = Conversation, extract-service feed the a list of  conversation (with one item) to Claude to extract intelligent data , the System promt should include all instruction for each ExtractDataTypeEnum, for each conversation, Claude should response with a structure output ExtractOutput, extract-service then process ExtractOutput and upinsert to extractions table (see unique index: (conversation_uuid,date_type,value)

Note: chat-service and extract-service use the same PostgreSQL, different schema (chat_service, extract_service)


### RabbitMQ Consumer
- Please refer to ../code-inspect/checkout-service for the pattern, and implementation of EventModule
- rabbitMQ consumer subscribe to apapte exchange for routing key apate.conversation.ended, extract the Conversation data from the event data and upsert to table conversations (by uuid)

### Cron task
- Implement a cron task that run every minutes, get all the conversations with status = ExtractStatusEnum.New, send them to Claude to extract intelligent data. While processing: update these conversation.status = ExtractStatusEnum.PROCESSING so that other instances do not pick them up again, when received response from LLM update conversation.status = ExtractStatusEnum.PROCESSED