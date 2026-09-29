import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Receipt, 
  ShoppingBag, 
  History, 
  ArrowRight, 
  Check, 
  RefreshCcw, 
  AlertTriangle,
  Sparkles,
  Percent,
  Copy,
  Clock,
  Printer
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, CartItem, PaymentMethod, Sale } from '../types';
import { fetchAllProducts, recordSale, fetchAllSales } from '../services/supabase';
import { soundManager } from '../utils/sound';
import { useAuth } from '../context/AuthContext';
import { ReceiptModal } from './ReceiptModal';
import { CATEGORIES } from '../data/defaultProducts';

export const SalesScreen: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCompletedSale, setSelectedCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load products and sales history on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { products: prods } = await fetchAllProducts();
    setProducts(prods);
    const sales = await fetchAllSales();
    setSalesHistory(sales);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus barcode on F2
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
      // Finalize sale on F4
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        handleFinishSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentMethod, amountPaidInput, discountInput]);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.total_price, 0);
  const total = Math.max(0, subtotal - discountInput);
  const amountPaidNumber = parseFloat(amountPaidInput.replace(',', '.')) || (paymentMethod === 'dinheiro' ? 0 : total);
  const changeAmount = paymentMethod === 'dinheiro' ? Math.max(0, amountPaidNumber - total) : 0;
  const isPaymentSufficient = paymentMethod !== 'dinheiro' || amountPaidNumber >= total;

  // Add product to cart
  const addToCart = (product: Product, qty: number = 1) => {
    if (product.stock_quantity <= 0) {
      soundManager.playError();
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const existing = prevCart[existingIndex];
        const newQty = existing.quantity + qty;
        
        // Prevent exceeding stock
        if (newQty > product.stock_quantity) {
          soundManager.playError();
          alert(`Estoque insuficiente! Disponível em estoque: ${product.stock_quantity} ${product.unit}`);
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          total_price: Number((newQty * existing.unit_price).toFixed(2)),
        };
        soundManager.playScanBeep();
        return updated;
      } else {
        if (qty > product.stock_quantity) {
          soundManager.playError();
          alert(`Estoque insuficiente! Disponível em estoque: ${product.stock_quantity} ${product.unit}`);
          return prevCart;
        }

        soundManager.playScanBeep();
        return [
          ...prevCart,
          {
            product,
            quantity: qty,
            unit_price: product.price,
            total_price: Number((qty * product.price).toFixed(2)),
          },
        ];
      }
    });

    setQuantityInput(1);
    setSearchTerm('');
    barcodeInputRef.current?.focus();
  };

  // Barcode / Search handle Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return;

    // Exact barcode match first
    const matchByCode = products.find((p) => p.code.toLowerCase() === query);
    if (matchByCode) {
      addToCart(matchByCode, quantityInput);
      return;
    }

    // Name match
    const matchByName = products.find((p) => p.name.toLowerCase().includes(query));
    if (matchByName) {
      addToCart(matchByName, quantityInput);
      return;
    }

    soundManager.playError();
    alert(`Produto não encontrado com o código ou nome: "${searchTerm}"`);
  };

  const updateCartItemQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        // remove
        return prev.filter((_, i) => i !== index);
      }
      if (newQty > item.product.stock_quantity) {
        soundManager.playError();
        alert(`Estoque máximo atingido (${item.product.stock_quantity} ${item.product.unit})`);
        return prev;
      }

      const updated = [...prev];
      updated[index] = {
        ...item,
        quantity: newQty,
        total_price: Number((newQty * item.unit_price).toFixed(2)),
      };
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Deseja realmente cancelar esta venda e limpar o carrinho?')) {
      setCart([]);
      setDiscountInput(0);
      setAmountPaidInput('');
    }
  };

  // Finalize Sale
  const handleFinishSale = async () => {
    if (cart.length === 0) {
      soundManager.playError();
      return;
    }

    if (paymentMethod === 'dinheiro' && amountPaidNumber < total) {
      soundManager.playError();
      alert(`Valor em dinheiro insuficiente! Faltam R$ ${(total - amountPaidNumber).toFixed(2)}`);
      return;
    }

    const nextSaleNumber = salesHistory.length > 0 
      ? Math.max(...salesHistory.map((s) => s.sale_number)) + 1 
      : 1001;

    const newSale: Sale = {
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sale_number: nextSaleNumber,
      cashier_name: user?.name || 'Operador Caixa',
      cashier_username: user?.username || 'Venda_Edu',
      subtotal,
      discount: discountInput,
      total,
      payment_method: paymentMethod,
      amount_paid: paymentMethod === 'dinheiro' ? amountPaidNumber : total,
      change_amount: changeAmount,
      items: [...cart],
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    // Save
    await recordSale(newSale);
    setLastSale(newSale);
    setIsReceiptOpen(true);

    // Audio & Visual celebratory effect
    soundManager.playSuccessChime();
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch (e) {
      console.warn('Confetti error', e);
    }

    // Reset checkout state
    setCart([]);
    setDiscountInput(0);
    setAmountPaidInput('');
    loadData(); // reload stock and sales
  };

  // Filter products for quick selection
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'Todos' || prod.category === selectedCategory;
    const matchesSearch = searchTerm.length > 1
      ? prod.name.toLowerCase().includes(searchTerm.toLowerCase()) || prod.code.includes(searchTerm)
      : true;
    return matchesCategory && matchesSearch;
  });

  // Today stats
  const todaySales = salesHistory.filter((s) => {
    const saleDate = new Date(s.created_at).toDateString();
    return saleDate === new Date().toDateString();
  });
  const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner / Cashier Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Registro de Vendas (PDV)
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <p className="text-xs text-slate-400">
              Terminal #01 • Caixa Ativo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block">Total Vendido Hoje:</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              R$ {todayTotal.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Histórico ({todaySales.length} vendas)</span>
          </button>
        </div>
      </div>

      {/* Main PDV Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Barcode Scan, Cart Items & Touch Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Barcode and Search Input Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              {/* Quantity modifier */}
              <div className="w-24 shrink-0">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Qtd
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Main barcode/search */}
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-emerald-400" /> Código de Barras (EAN) ou Nome do Produto [F2]
                </label>
                <div className="relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Passe o leitor ou digite o nome/código (Ex: 7891000100101 ou Arroz)"
                    className="w-full pl-3 pr-24 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>
              </div>
            </form>

            {/* Quick quantity chips */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-[11px]">Multiplicador rápido:</span>
              {[1, 2, 3, 5, 10].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantityInput(q)}
                  className={`px-2 py-0.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    quantityInput === q
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}x
                </button>
              ))}
            </div>
          </div>

          {/* Current Cart Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Itens da Venda em Andamento ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Carrinho
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="p-10 text-center text-slate-500 space-y-2">
                <Barcode className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p className="text-sm font-medium text-slate-400">Nenhum produto registrado no momento.</p>
                <p className="text-xs text-slate-500">
                  Escaneie o código de barras ou clique nos produtos do catálogo abaixo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Produto</th>
                      <th className="px-4 py-2.5 text-center">Qtd</th>
                      <th className="px-4 py-2.5 text-right">Unitário</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {cart.map((item, index) => (
                      <tr key={item.product.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 font-mono">{index + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-white font-semibold truncate max-w-[220px]">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.product.code} • {item.product.category}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-700/80 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartItemQuantity(index, -1)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-bold text-white font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartItemQuantity(index, 1)}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          R$ {item.unit_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                          R$ {item.total_price.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeCartItem(index)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Product Touch Catalog */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Catálogo Rápido de Produtos (Clique para adicionar)
              </h2>
              <span className="text-xs text-slate-500">
                {filteredProducts.length} itens disponíveis
              </span>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[280px] overflow-y-auto pr-1">
              {filteredProducts.map((prod) => {
                const isOutOfStock = prod.stock_quantity <= 0;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(prod, 1)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'opacity-40 bg-slate-950/40 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/50 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[10px] text-slate-400 font-mono">{prod.code.slice(-6)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          prod.stock_quantity <= prod.min_stock 
                            ? 'bg-amber-500/20 text-amber-300' 
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {prod.stock_quantity} {prod.unit}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mt-1 line-clamp-2">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-400 font-mono">
                        R$ {prod.price.toFixed(2)}
                      </span>
                      <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px]">
                        +1
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Checkout & Payment Terminal (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-20 space-y-5">
            
            {/* Display de Valor Total */}
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-5 text-center shadow-inner relative overflow-hidden">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Total do Caixa
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-400 tracking-tight">
                R$ {total.toFixed(2)}
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                <span>Subtotal: R$ {subtotal.toFixed(2)}</span>
                {discountInput > 0 && (
                  <span className="text-amber-400">Desc: -R$ {discountInput.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Discount input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-medium">
                <Percent className="w-3.5 h-3.5 text-amber-400" /> Desconto (R$):
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                max={subtotal}
                value={discountInput || ''}
                onChange={(e) => setDiscountInput(Math.min(subtotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('dinheiro')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'dinheiro'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>Dinheiro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'pix'
                      ? 'bg-teal-600/20 border-teal-500 text-teal-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-teal-400" />
                  <span>PIX</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cartao_credito')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'cartao_credito'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span>Crédito</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cartao_debito')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'cartao_debito'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span>Débito</span>
                </button>
              </div>
            </div>

            {/* Dinheiro specifics (Valor Recebido & Troco) */}
            {paymentMethod === 'dinheiro' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Valor Recebido (R$):
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Total: R$ {total.toFixed(2)}
                  </span>
                </div>
                
                <input
                  type="text"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  placeholder={`Ex: ${Math.ceil(total)} ou valor entregue`}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-lg font-mono font-bold text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Quick note buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[total, 10, 20, 50, 100, 200].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmountPaidInput(val.toFixed(2))}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {val === total ? 'Exato' : `R$ ${val}`}
                    </button>
                  ))}
                </div>

                {/* Troco Display */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Troco a devolver:</span>
                  <span className="text-lg font-mono font-extrabold text-emerald-400">
                    R$ {changeAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* PIX specifics (QR Code & Chave) */}
            {paymentMethod === 'pix' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-center space-y-3 animate-fadeIn">
                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
                  {/* Simulated QR Code graphic */}
                  <div className="w-full h-full border-4 border-slate-900 p-1 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-7 h-7 bg-slate-900"></div>
                      <div className="w-7 h-7 bg-slate-900"></div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1">
                      <div className="h-2 bg-slate-900"></div>
                      <div className="h-2 bg-slate-900 col-span-2"></div>
                      <div className="h-2 bg-slate-900"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="w-7 h-7 bg-slate-900"></div>
                      <div className="w-7 h-7 border-2 border-slate-900 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-slate-900"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Escaneie o QR Code ou use a chave PIX copia e cola:
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`00020126580014br.gov.bcb.pix0136supercaixa-venda-${total.toFixed(2)}`);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2000);
                  }}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {pixCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-400" /> Chave PIX copiada!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Código PIX (R$ {total.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Finalize Button */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={cart.length === 0 || !isPaymentSufficient}
                onClick={handleFinishSale}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-950/60 cursor-pointer active:scale-[0.99]"
              >
                <span>Finalizar Venda [F4]</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-[11px] text-slate-500">
                  Teclas de atalho: <strong>F2</strong> (Buscar/Código) • <strong>F4</strong> (Finalizar)
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Sales History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Histórico de Vendas Realizadas</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {salesHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>Nenhuma venda registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {salesHistory.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">
                            Cupom #{String(s.sale_number).padStart(5, '0')}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                            {s.payment_method}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>{new Date(s.created_at).toLocaleString('pt-BR')}</span>
                          <span>•</span>
                          <span>{s.items.length} itens</span>
                          <span>•</span>
                          <span>Op: {s.cashier_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-emerald-400 text-base">
                          R$ {s.total.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompletedSale(s);
                            setIsReceiptOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Reemitir Cupom
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        sale={selectedCompletedSale || lastSale}
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedCompletedSale(null);
        }}
      />
    </div>
  );
};
