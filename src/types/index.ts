export interface Product {
  id: string;
  code: string; // Código de barras / EAN
  name: string;
  category: string;
  price: number; // Preço de venda
  cost_price?: number; // Preço de custo
  stock_quantity: number;
  min_stock: number;
  unit: 'UN' | 'KG' | 'L' | 'PCT' | 'CX' | 'G';
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type PaymentMethod = 
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'pix'
  | 'vale_alimentacao';

export interface Sale {
  id: string;
  sale_number: number;
  cashier_name: string;
  cashier_username: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  amount_paid?: number;
  change_amount?: number;
  items: CartItem[];
  created_at: string;
  status: 'completed' | 'cancelled';
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastChecked?: string;
}
