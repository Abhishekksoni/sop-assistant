-- =========================================================================
-- Chat History & User Conversation Persistence Tables
-- =========================================================================

-- 1. Create conversations table
create table if not exists conversations (
    conversation_id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(user_id) on delete cascade,
    title text not null default 'New Conversation',
    department_filter text,
    document_id_filter uuid references documents(document_id) on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 2. Create chat_messages table
create table if not exists chat_messages (
    message_id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(conversation_id) on delete cascade,
    user_id uuid not null references users(user_id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    sources jsonb default '[]'::jsonb,
    created_at timestamp with time zone default now()
);

-- 3. Create indexes for quick query by user_id and conversation_id
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_conversations_updated_at on conversations(updated_at desc);
create index if not exists idx_chat_messages_conversation_id on chat_messages(conversation_id);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at asc);

-- 4. Disable RLS or set open policy for API backend
alter table conversations disable row level security;
alter table chat_messages disable row level security;
