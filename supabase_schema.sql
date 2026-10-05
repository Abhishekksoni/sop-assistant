-- 1. Enable pgvector and UUID extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- 2. Drop all previous function overloads dynamically
do $$
declare
    r record;
begin
    for r in (
        select oid::regprocedure as func_signature
        from pg_proc
        where proname in ('match_document_chunks', 'match_documents')
    ) loop
        execute 'drop function if exists ' || r.func_signature || ' cascade';
    end loop;
end;
$$;

-- 3. Drop existing tables if upgrading schema
drop table if exists document_access cascade;
drop table if exists document_chunks cascade;
drop table if exists documents cascade;
drop table if exists users cascade;

-- 4. Create users table with 3 roles: 'master_admin', 'admin', 'employee'
create table users (
    user_id uuid primary key default gen_random_uuid(),
    email text unique not null,
    password_hash text not null,
    full_name text,
    role text not null default 'employee' check (role in ('master_admin', 'admin', 'employee')),
    department text,
    is_master_admin boolean default false,
    created_at timestamp with time zone default now()
);

-- 5. Create parent documents table (with Supabase storage columns)
create table documents (
    document_id uuid primary key default gen_random_uuid(),
    name text not null,
    filename text not null,
    version text default '1.0',
    department text,
    status text default 'active',
    is_public boolean default false,
    storage_path text,               -- Path inside Supabase sop-bucket
    file_url text,                   -- Public Supabase Storage URL
    created_by uuid references users(user_id) on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 6. Create document_access table (granting selective access to employees)
create table document_access (
    access_id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(document_id) on delete cascade,
    user_id uuid not null references users(user_id) on delete cascade,
    granted_by uuid references users(user_id) on delete set null,
    granted_at timestamp with time zone default now(),
    constraint uq_document_user_access unique (document_id, user_id)
);

-- 7. Create the document_chunks table with vector embeddings
create table document_chunks (
    chunk_id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(document_id) on delete cascade,
    content text not null,
    embedding vector(768),
    page_number int not null default 1,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now()
);

-- 8. Create indexes for fast querying, joins, and similarity search
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_email on users(email);
create index if not exists idx_documents_department on documents(department);
create index if not exists idx_documents_status on documents(status);
create index if not exists idx_document_access_user_id on document_access(user_id);
create index if not exists idx_document_access_document_id on document_access(document_id);
create index if not exists idx_document_chunks_document_id on document_chunks(document_id);
create index if not exists idx_document_chunks_embedding on document_chunks using hnsw (embedding vector_cosine_ops);

-- 9. Row Level Security (RLS) Configuration
alter table users disable row level security;
alter table documents disable row level security;
alter table document_access disable row level security;
alter table document_chunks disable row level security;

-- 10. Seed Master Admin User (abhishekad152003@gmail.com / pass: 123456)
insert into users (email, password_hash, full_name, role, department, is_master_admin)
values (
    'abhishekad152003@gmail.com',
    '$2b$12$5YlP/RAD7SukRe2rhUhTqefweQOpk9fip8f5qls34KHRDwsOP1QNq',
    'Master Administrator',
    'master_admin',
    'Management',
    true
)
on conflict (email) do update
set role = 'master_admin',
    is_master_admin = true,
    password_hash = '$2b$12$5YlP/RAD7SukRe2rhUhTqefweQOpk9fip8f5qls34KHRDwsOP1QNq';

-- 11. Create the Supabase Storage Bucket 'sop-bucket' & policies
insert into storage.buckets (id, name, public)
values ('sop-bucket', 'sop-bucket', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow public read access to sop-bucket" on storage.objects;
drop policy if exists "Allow public insert access to sop-bucket" on storage.objects;
drop policy if exists "Allow public update access to sop-bucket" on storage.objects;
drop policy if exists "Allow public delete access to sop-bucket" on storage.objects;

create policy "Allow public read access to sop-bucket"
on storage.objects for select
using (bucket_id = 'sop-bucket');

create policy "Allow public insert access to sop-bucket"
on storage.objects for insert
with check (bucket_id = 'sop-bucket');

create policy "Allow public update access to sop-bucket"
on storage.objects for update
using (bucket_id = 'sop-bucket');

create policy "Allow public delete access to sop-bucket"
on storage.objects for delete
using (bucket_id = 'sop-bucket');

-- 12. RPC Function with 3-Role Based Access Filtering (master_admin, admin, employee)
create or replace function match_document_chunks (
    query_embedding vector(768),
    match_count int default 4,
    filter_department text default null,
    filter_status text default null,
    filter_document_id uuid default null,
    for_user_id uuid default null,
    user_role text default 'master_admin'
) returns table (
    chunk_id uuid,
    document_id uuid,
    document_name text,
    filename text,
    version text,
    department text,
    status text,
    file_url text,
    storage_path text,
    content text,
    page_number int,
    metadata jsonb,
    similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
    return query
    select
        c.chunk_id,
        c.document_id,
        d.name as document_name,
        d.filename,
        d.version,
        d.department,
        d.status,
        d.file_url,
        d.storage_path,
        c.content,
        c.page_number,
        c.metadata,
        1 - (c.embedding <=> query_embedding) as similarity
    from document_chunks c
    inner join documents d on c.document_id = d.document_id
    where (filter_department is null or d.department = filter_department)
      and (filter_status is null or d.status = filter_status)
      and (filter_document_id is null or d.document_id = filter_document_id)
      and (
          -- Master Admin & Admin can access all documents
          user_role in ('master_admin', 'admin')
          or for_user_id is null
          -- Employee can access public documents OR explicitly assigned documents
          or (
              user_role = 'employee'
              and (
                  d.is_public = true
                  or exists (
                      select 1 from document_access da
                      where da.document_id = d.document_id
                        and da.user_id = for_user_id
                  )
              )
          )
      )
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- 12. Create conversations and chat_messages tables for persistent user histories
create table if not exists conversations (
    conversation_id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(user_id) on delete cascade,
    title text not null default 'New Conversation',
    department_filter text,
    document_id_filter uuid references documents(document_id) on delete set null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists chat_messages (
    message_id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(conversation_id) on delete cascade,
    user_id uuid not null references users(user_id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    sources jsonb default '[]'::jsonb,
    created_at timestamp with time zone default now()
);

create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_conversations_updated_at on conversations(updated_at desc);
create index if not exists idx_chat_messages_conversation_id on chat_messages(conversation_id);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at asc);

alter table conversations disable row level security;
alter table chat_messages disable row level security;

