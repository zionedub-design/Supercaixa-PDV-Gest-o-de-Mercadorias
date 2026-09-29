-- ==============================================================================
-- SUPERCAIXA MERCADO - SCRIPT SQL CORRIGIDO & COMPLETO PARA O SUPABASE
-- Funciona tanto em bancos novos quanto em bancos onde as tabelas já existiam
-- ==============================================================================

-- 1. CRIAÇÃO OU ATUALIZAÇÃO DA TABELA DE PRODUTOS
---------------------------------------------------------------------------------
create table if not exists public.products (
    id text primary key,
    name text
);

-- Garante que todas as colunas necessárias existam (evita erro "column code does not exist")
alter table public.products add column if not exists code text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists category text default 'Alimentos';
alter table public.products add column if not exists price numeric(10,2) default 0;
alter table public.products add column if not exists cost_price numeric(10,2) default 0;
alter table public.products add column if not exists stock_quantity numeric(10,2) default 0;
alter table public.products add column if not exists min_stock numeric(10,2) default 5;
alter table public.products add column if not exists unit text default 'UN';
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());
alter table public.products add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());


-- 2. CRIAÇÃO OU ATUALIZAÇÃO DA TABELA DE VENDAS
---------------------------------------------------------------------------------
create table if not exists public.sales (
    id text primary key
);

alter table public.sales add column if not exists sale_number bigint;
alter table public.sales add column if not exists cashier_name text;
alter table public.sales add column if not exists cashier_username text;
alter table public.sales add column if not exists subtotal numeric(10,2) default 0;
alter table public.sales add column if not exists discount numeric(10,2) default 0;
alter table public.sales add column if not exists total numeric(10,2) default 0;
alter table public.sales add column if not exists payment_method text;
alter table public.sales add column if not exists amount_paid numeric(10,2) default 0;
alter table public.sales add column if not exists change_amount numeric(10,2) default 0;
alter table public.sales add column if not exists status text default 'completed';
alter table public.sales add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());


-- 3. CRIAÇÃO OU ATUALIZAÇÃO DA TABELA DE ITENS DA VENDA
---------------------------------------------------------------------------------
create table if not exists public.sale_items (
    id uuid default gen_random_uuid() primary key
);

alter table public.sale_items add column if not exists sale_id text references public.sales(id) on delete cascade;
alter table public.sale_items add column if not exists product_id text;
alter table public.sale_items add column if not exists product_name text;
alter table public.sale_items add column if not exists product_code text;
alter table public.sale_items add column if not exists unit_price numeric(10,2) default 0;
alter table public.sale_items add column if not exists quantity numeric(10,2) default 1;
alter table public.sale_items add column if not exists total_price numeric(10,2) default 0;
alter table public.sale_items add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());


-- 4. ÍNDICES DE PERFORMANCE (AGORA GARANTIDAMENTE COM A COLUNA CODE EXISTINDO)
---------------------------------------------------------------------------------
create index if not exists idx_products_code on public.products(code);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_sales_created_at on public.sales(created_at desc);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);


-- 5. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS) NAS TABELAS
---------------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Limpar políticas anteriores para evitar erros de duplicidade
drop policy if exists "Permissao livre produtos" on public.products;
drop policy if exists "Permitir leitura de produtos" on public.products;
drop policy if exists "Permitir insercao de produtos" on public.products;
drop policy if exists "Permitir atualizacao de produtos" on public.products;
drop policy if exists "Permitir exclusao de produtos" on public.products;
drop policy if exists "Acesso livre a produtos" on public.products;

drop policy if exists "Permissao livre vendas" on public.sales;
drop policy if exists "Permitir leitura de vendas" on public.sales;
drop policy if exists "Permitir insercao de vendas" on public.sales;
drop policy if exists "Permitir atualizacao de vendas" on public.sales;
drop policy if exists "Acesso livre a vendas" on public.sales;

drop policy if exists "Permissao livre itens" on public.sale_items;
drop policy if exists "Permitir leitura de itens de vendas" on public.sale_items;
drop policy if exists "Permitir insercao de itens de vendas" on public.sale_items;
drop policy if exists "Acesso livre a itens de vendas" on public.sale_items;

-- Ativar políticas completas nas tabelas
create policy "Permitir leitura de produtos" on public.products for select using (true);
create policy "Permitir insercao de produtos" on public.products for insert with check (true);
create policy "Permitir atualizacao de produtos" on public.products for update using (true) with check (true);
create policy "Permitir exclusao de produtos" on public.products for delete using (true);

create policy "Permitir leitura de vendas" on public.sales for select using (true);
create policy "Permitir insercao de vendas" on public.sales for insert with check (true);
create policy "Permitir atualizacao de vendas" on public.sales for update using (true) with check (true);

create policy "Permitir leitura de itens de vendas" on public.sale_items for select using (true);
create policy "Permitir insercao de itens de vendas" on public.sale_items for insert with check (true);


-- 6. BUCKET DE ARMAZENAMENTO (SUPABASE STORAGE) & POLÍTICAS ATIVADAS
---------------------------------------------------------------------------------
-- Cria o bucket se não existir
insert into storage.buckets (id, name, public)
values ('supercaixa-storage', 'supercaixa-storage', true)
on conflict (id) do update set public = true;

-- Limpar políticas antigas de storage se existirem
drop policy if exists "Permitir visualizacao publica de arquivos" on storage.objects;
drop policy if exists "Permitir upload de arquivos" on storage.objects;
drop policy if exists "Permitir atualizacao de arquivos" on storage.objects;
drop policy if exists "Permitir exclusao de arquivos" on storage.objects;

-- Políticas de Armazenamento ativadas:
create policy "Permitir visualizacao publica de arquivos"
    on storage.objects for select
    using (bucket_id = 'supercaixa-storage');

create policy "Permitir upload de arquivos"
    on storage.objects for insert
    with check (bucket_id = 'supercaixa-storage');

create policy "Permitir atualizacao de arquivos"
    on storage.objects for update
    using (bucket_id = 'supercaixa-storage')
    with check (bucket_id = 'supercaixa-storage');

create policy "Permitir exclusao de arquivos"
    on storage.objects for delete
    using (bucket_id = 'supercaixa-storage');
