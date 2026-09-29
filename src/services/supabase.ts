import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Sale, SupabaseConfig } from '../types';
import { INITIAL_PRODUCTS } from '../data/defaultProducts';

const STORAGE_KEY_PRODUCTS = 'supercaixa_products_v1';
const STORAGE_KEY_SALES = 'supercaixa_sales_v1';
const STORAGE_KEY_CONFIG = 'supercaixa_supabase_config_v1';

// Default / fallback values (can come from env or localStorage)
let supabaseClient: SupabaseClient | null = null;

export function getStoredConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        url: parsed.url || '',
        anonKey: parsed.anonKey || '',
        isConnected: Boolean(parsed.isConnected),
        lastChecked: parsed.lastChecked,
      };
    }
  } catch (e) {
    console.error('Error reading Supabase config from storage', e);
  }

  // Fallback to Vite env variables if present
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

  return {
    url: envUrl,
    anonKey: envKey,
    isConnected: Boolean(envUrl && envKey),
  };
}

export function initSupabaseClient(): SupabaseClient | null {
  const config = getStoredConfig();
  if (config.url && config.anonKey) {
    try {
      supabaseClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
  return supabaseClient;
}

// Initial initialization
initSupabaseClient();

export function saveConfig(url: string, anonKey: string): SupabaseConfig {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  const config: SupabaseConfig = {
    url: cleanUrl,
    anonKey: cleanKey,
    isConnected: false,
    lastChecked: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  initSupabaseClient();
  return config;
}

export async function testConnection(): Promise<{ success: boolean; message: string; tableFound?: boolean }> {
  const client = initSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'URL ou Anon Key não configurados. Insira suas credenciais do Supabase.',
    };
  }

  try {
    // Attempt a light select to check connection
    const { data, error } = await client.from('products').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        // Relation does not exist
        return {
          success: true,
          tableFound: false,
          message: 'Conectado ao Supabase com sucesso! Porém a tabela "products" ainda não foi criada. Use o script SQL fornecido na aba ao lado para criá-la.',
        };
      }
      return {
        success: false,
        message: `Erro na resposta do Supabase: ${error.message} (${error.code || ''})`,
      };
    }

    // Update config as connected
    const currentConfig = getStoredConfig();
    currentConfig.isConnected = true;
    currentConfig.lastChecked = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(currentConfig));

    return {
      success: true,
      tableFound: true,
      message: `Conexão estabelecida com sucesso! Tabela "products" verificada (${data ? 'ativa' : 'vazia'}).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Falha na requisição: ${errorMsg}`,
    };
  }
}

// ---- Local Storage Fallbacks ----

export function getLocalProducts(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local products:', e);
  }
  // Initialize with default catalog if none
  setLocalProducts(INITIAL_PRODUCTS);
  return INITIAL_PRODUCTS;
}

export function setLocalProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Error saving local products:', e);
  }
}

export function getLocalSales(): Sale[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SALES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading local sales:', e);
  }
  return [];
}

export function setLocalSales(sales: Sale[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
  } catch (e) {
    console.error('Error saving local sales:', e);
  }
}

// ---- Data Methods (Dual Supabase + Local Sync) ----

export async function fetchAllProducts(): Promise<{ products: Product[]; source: 'supabase' | 'local'; error?: string }> {
  const client = initSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        // Map Supabase rows
        const mappedProducts: Product[] = data.map((row) => ({
          id: String(row.id),
          code: String(row.code || ''),
          name: String(row.name || ''),
          category: String(row.category || 'Alimentos'),
          price: Number(row.price || 0),
          cost_price: Number(row.cost_price || 0),
          stock_quantity: Number(row.stock_quantity ?? 0),
          min_stock: Number(row.min_stock ?? 5),
          unit: (row.unit as Product['unit']) || 'UN',
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at,
        }));
        // Update local backup
        setLocalProducts(mappedProducts);
        return { products: mappedProducts, source: 'supabase' };
      } else if (error) {
        console.warn('Supabase query error, using local fallback:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local:', e);
    }
  }

  // Fallback to local
  const localList = getLocalProducts();
  return { products: localList, source: 'local' };
}

export async function saveProduct(product: Product): Promise<{ success: boolean; product: Product; error?: string }> {
  // Update local immediately for responsive UI
  const localList = getLocalProducts();
  const existingIdx = localList.findIndex((p) => p.id === product.id || (p.code && p.code === product.code));
  
  let updatedList: Product[];
  const finalProduct: Product = {
    ...product,
    updated_at: new Date().toISOString(),
    created_at: product.created_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = finalProduct;
  } else {
    updatedList = [finalProduct, ...localList];
  }
  setLocalProducts(updatedList);

  // Sync to Supabase if connected
  const client = initSupabaseClient();
  if (client) {
    try {
      const payload = {
        id: finalProduct.id,
        code: finalProduct.code,
        name: finalProduct.name,
        category: finalProduct.category,
        price: finalProduct.price,
        cost_price: finalProduct.cost_price || 0,
        stock_quantity: finalProduct.stock_quantity,
        min_stock: finalProduct.min_stock,
        unit: finalProduct.unit,
        updated_at: finalProduct.updated_at,
      };

      const { error } = await client.from('products').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase save error (local saved successfully):', error.message);
        return { success: true, product: finalProduct, error: `Salvo localmente. Aviso Supabase: ${error.message}` };
      }
    } catch (e) {
      console.warn('Supabase save failed:', e);
    }
  }

  return { success: true, product: finalProduct };
}

export async function deleteProductById(id: string): Promise<{ success: boolean; error?: string }> {
  // Delete from local
  const localList = getLocalProducts();
  setLocalProducts(localList.filter((p) => p.id !== id));

  // Delete from Supabase
  const client = initSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) {
        console.warn('Supabase delete error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase delete exception:', e);
    }
  }

  return { success: true };
}

export async function recordSale(sale: Sale): Promise<{ success: boolean; sale: Sale; error?: string }> {
  // Update local sales
  const sales = getLocalSales();
  const updatedSales = [sale, ...sales];
  setLocalSales(updatedSales);

  // Decrement product stock in local
  const products = getLocalProducts();
  const updatedProducts = products.map((prod) => {
    const itemInSale = sale.items.find((item) => item.product.id === prod.id);
    if (itemInSale) {
      return {
        ...prod,
        stock_quantity: Math.max(0, prod.stock_quantity - itemInSale.quantity),
        updated_at: new Date().toISOString(),
      };
    }
    return prod;
  });
  setLocalProducts(updatedProducts);

  // If Supabase is connected, record sale and items
  const client = initSupabaseClient();
  if (client) {
    try {
      // Insert sale record
      const { error: saleErr } = await client.from('sales').insert({
        id: sale.id,
        sale_number: sale.sale_number,
        cashier_name: sale.cashier_name,
        cashier_username: sale.cashier_username,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        payment_method: sale.payment_method,
        amount_paid: sale.amount_paid || sale.total,
        change_amount: sale.change_amount || 0,
        status: sale.status,
        created_at: sale.created_at,
      });

      if (!saleErr) {
        // Insert sale items
        const itemsPayload = sale.items.map((it) => ({
          sale_id: sale.id,
          product_id: it.product.id,
          product_name: it.product.name,
          product_code: it.product.code,
          unit_price: it.unit_price,
          quantity: it.quantity,
          total_price: it.total_price,
        }));

        await client.from('sale_items').insert(itemsPayload);

        // Update stock in Supabase for each item
        for (const it of sale.items) {
          const targetProd = updatedProducts.find((p) => p.id === it.product.id);
          if (targetProd) {
            await client
              .from('products')
              .update({ stock_quantity: targetProd.stock_quantity, updated_at: new Date().toISOString() })
              .eq('id', targetProd.id);
          }
        }
      } else {
        console.warn('Supabase sale insert warning:', saleErr.message);
      }
    } catch (e) {
      console.warn('Supabase recordSale error:', e);
    }
  }

  return { success: true, sale };
}

export async function fetchAllSales(): Promise<Sale[]> {
  const client = initSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mappedSales: Sale[] = data.map((row) => ({
          id: row.id,
          sale_number: row.sale_number,
          cashier_name: row.cashier_name,
          cashier_username: row.cashier_username,
          subtotal: Number(row.subtotal),
          discount: Number(row.discount || 0),
          total: Number(row.total),
          payment_method: row.payment_method,
          amount_paid: Number(row.amount_paid || row.total),
          change_amount: Number(row.change_amount || 0),
          status: row.status,
          created_at: row.created_at,
          items: (row.sale_items || []).map((si: Record<string, unknown>) => ({
            product: {
              id: String(si.product_id),
              code: String(si.product_code || ''),
              name: String(si.product_name || ''),
              price: Number(si.unit_price || 0),
              stock_quantity: 0,
              min_stock: 0,
              category: 'Geral',
              unit: 'UN',
            },
            quantity: Number(si.quantity || 1),
            unit_price: Number(si.unit_price || 0),
            total_price: Number(si.total_price || 0),
          })),
        }));
        setLocalSales(mappedSales);
        return mappedSales;
      }
    } catch (e) {
      console.warn('Supabase fetch sales error:', e);
    }
  }

  return getLocalSales();
}

// Push all local products and sales to Supabase
export async function syncLocalDataToSupabase(): Promise<{ success: boolean; countProducts: number; countSales: number; message: string }> {
  const client = initSupabaseClient();
  if (!client) {
    return { success: false, countProducts: 0, countSales: 0, message: 'Supabase não conectado. Configure a URL e Anon Key primeiro.' };
  }

  const products = getLocalProducts();
  const sales = getLocalSales();

  try {
    // 1. Upsert products
    if (products.length > 0) {
      const payloadProducts = products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        price: p.price,
        cost_price: p.cost_price || 0,
        stock_quantity: p.stock_quantity,
        min_stock: p.min_stock,
        unit: p.unit,
        updated_at: new Date().toISOString(),
      }));

      const { error: prodErr } = await client.from('products').upsert(payloadProducts, { onConflict: 'id' });
      if (prodErr) throw new Error(`Erro ao enviar produtos: ${prodErr.message}`);
    }

    // 2. Insert sales
    let syncedSalesCount = 0;
    for (const sale of sales) {
      const { error: saleErr } = await client.from('sales').upsert({
        id: sale.id,
        sale_number: sale.sale_number,
        cashier_name: sale.cashier_name,
        cashier_username: sale.cashier_username,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        payment_method: sale.payment_method,
        amount_paid: sale.amount_paid,
        change_amount: sale.change_amount,
        status: sale.status,
        created_at: sale.created_at,
      }, { onConflict: 'id' });

      if (!saleErr && sale.items && sale.items.length > 0) {
        syncedSalesCount++;
        const saleItemsPayload = sale.items.map((it) => ({
          sale_id: sale.id,
          product_id: it.product.id,
          product_name: it.product.name,
          product_code: it.product.code,
          unit_price: it.unit_price,
          quantity: it.quantity,
          total_price: it.total_price,
        }));
        await client.from('sale_items').upsert(saleItemsPayload, { onConflict: 'id' as never });
      }
    }

    return {
      success: true,
      countProducts: products.length,
      countSales: syncedSalesCount,
      message: `${products.length} produtos e ${syncedSalesCount} vendas sincronizados com o Supabase com sucesso!`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      countProducts: 0,
      countSales: 0,
      message: `Erro na sincronização: ${errorMsg}`,
    };
  }
}

// SQL Schema code to share with the user
export const SUPABASE_SQL_SCHEMA = `-- =======================================================
-- SUPERCAIXA MERCADO - SCHEMA COMPLETO PARA O SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase
-- =======================================================

-- 1. CRIAÇÃO OU ATUALIZAÇÃO DA TABELA DE PRODUTOS
create table if not exists public.products (
    id text primary key,
    name text
);

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

-- 4. ÍNDICES DE PERFORMANCE
create index if not exists idx_products_code on public.products(code);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_sales_created_at on public.sales(created_at desc);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);

-- 5. HABILITAR ROW LEVEL SECURITY (RLS) NAS TABELAS
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Limpar políticas anteriores
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

-- Políticas de acesso para o Caixa e Gestão
create policy "Permitir leitura de produtos" on public.products for select using (true);
create policy "Permitir insercao de produtos" on public.products for insert with check (true);
create policy "Permitir atualizacao de produtos" on public.products for update using (true) with check (true);
create policy "Permitir exclusao de produtos" on public.products for delete using (true);

create policy "Permitir leitura de vendas" on public.sales for select using (true);
create policy "Permitir insercao de vendas" on public.sales for insert with check (true);
create policy "Permitir atualizacao de vendas" on public.sales for update using (true) with check (true);

create policy "Permitir leitura de itens de vendas" on public.sale_items for select using (true);
create policy "Permitir insercao de itens de vendas" on public.sale_items for insert with check (true);

-- 6. BUCKET DE ARMAZENAMENTO (STORAGE) E POLÍTICAS ATIVADAS
insert into storage.buckets (id, name, public)
values ('supercaixa-storage', 'supercaixa-storage', true)
on conflict (id) do update set public = true;

drop policy if exists "Permitir visualizacao publica de arquivos" on storage.objects;
drop policy if exists "Permitir upload de arquivos" on storage.objects;
drop policy if exists "Permitir atualizacao de arquivos" on storage.objects;
drop policy if exists "Permitir exclusao de arquivos" on storage.objects;

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
`;
