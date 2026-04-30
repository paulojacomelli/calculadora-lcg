-- migration 20260402190000_meli_auth.sql
-- Habilitar extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Criar tabela meli_auth para gerenciar tokens do Mercado Livre
create table if not exists public.meli_auth (
    id int primary key default 1,
    access_token text not null,
    refresh_token text not null,
    expires_at timestamp with time zone not null,
    updated_at timestamp with time zone default now(),
    -- Garantir que haja apenas uma linha de credenciais
    constraint only_one_row check (id = 1)
);

-- Inserir registro inicial para facilitar o bootstrap via UPDATE
insert into public.meli_auth (id, access_token, refresh_token, expires_at)
values (1, 'pending_bootstrap', 'pending_bootstrap', now())
on conflict (id) do nothing;

-- Comentários para documentação no banco
comment on table public.meli_auth is 'Tabela central para armazenamento seguro e renovação de tokens da API do Mercado Livre.';
comment on column public.meli_auth.access_token is 'Token de acesso atual (vida útil de 6h).';
comment on column public.meli_auth.refresh_token is 'Token de renovação usado para obter novos access_tokens.';
comment on column public.meli_auth.expires_at is 'Data e hora exata em que o access_token expira.';

-- Agendamento do Cron (pg_cron) - roda a cada 5 horas
-- OBS: A URL precisa refletir a URL de produção do seu Supabase.
-- Por enquanto configurado para assumir o host atual se suportado, ou passe fixo na Vercel/Supabase.
select cron.schedule(
  'refresh-meli-token',
  '0 */5 * * *',
  $$
    select net.http_post(
        url:= 'https://' || current_setting('request.headers', true)::json->>'host' || '/functions/v1/meli-refresh-token',
        headers:= '{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
