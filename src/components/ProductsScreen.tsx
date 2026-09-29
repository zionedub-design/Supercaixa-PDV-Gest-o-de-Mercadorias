import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Barcode, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  Boxes, 
  Sparkles, 
  RefreshCw, 
  Upload, 
  Download, 
  RotateCcw,
  X,
  Database
} from 'lucide-react';
import { Product } from '../types';
import { fetchAllProducts, saveProduct, deleteProductById } from '../services/supabase';
import { soundManager } from '../utils/sound';
import { INITIAL_PRODUCTS, CATEGORIES } from '../data/defaultProducts';
import { useAuth } from '../context/AuthContext';

export const ProductsScreen: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Alimentos');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('10');
  const [formMinStock, setFormMinStock] = useState<string>('5');
  const [formUnit, setFormUnit] = useState<Product['unit']>('UN');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    const { products: loaded } = await fetchAllProducts();
    setProducts(loaded);
    setIsLoading(false);
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormCode(generateRandomEAN());
    setFormName('');
    setFormCategory('Alimentos');
    setFormPrice('');
    setFormCostPrice('');
    setFormStock('20');
    setFormMinStock('5');
    setFormUnit('UN');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormCode(product.code);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormPrice(String(product.price));
    setFormCostPrice(product.cost_price ? String(product.cost_price) : '');
    setFormStock(String(product.stock_quantity));
    setFormMinStock(String(product.min_stock));
    setFormUnit(product.unit);
    setFormError(null);
    setIsModalOpen(true);
  };

  const generateRandomEAN = () => {
    // Generate valid looking 13-digit EAN starting with 789 (Brazil)
    let code = '789';
    for (let i = 0; i < 10; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCode.trim()) {
      setFormError('Código de barras é obrigatório.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Nome do produto é obrigatório.');
      return;
    }

    const priceNum = parseFloat(formPrice.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Informe um preço de venda válido maior que zero.');
      return;
    }

    const costNum = parseFloat(formCostPrice.replace(',', '.')) || 0;
    const stockNum = parseFloat(formStock.replace(',', '.')) || 0;
    const minStockNum = parseFloat(formMinStock.replace(',', '.')) || 5;

    // Check code duplication if new product
    if (!editingProduct) {
      const duplicate = products.find((p) => p.code === formCode.trim());
      if (duplicate) {
        setFormError(`Já existe um produto cadastrado com o código "${formCode.trim()}": ${duplicate.name}`);
        return;
      }
    }

    const productPayload: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: formCode.trim(),
      name: formName.trim(),
      category: formCategory,
      price: priceNum,
      cost_price: costNum,
      stock_quantity: stockNum,
      min_stock: minStockNum,
      unit: formUnit,
      created_at: editingProduct?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await saveProduct(productPayload);
    soundManager.playSuccessChime();
    setIsModalOpen(false);
    loadProducts();
  };

  const handleDeleteProduct = async (product: Product) => {
    if (confirm(`Tem certeza que deseja remover o produto "${product.name}"?`)) {
      await deleteProductById(product.id);
      soundManager.playScanBeep();
      loadProducts();
    }
  };

  const handleQuickStockChange = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock_quantity + delta);
    const updated: Product = {
      ...product,
      stock_quantity: newStock,
      updated_at: new Date().toISOString(),
    };
    await saveProduct(updated);
    loadProducts();
  };

  const handleRestoreInitialCatalog = async () => {
    if (confirm('Deseja restaurar os produtos padrão do supermercado? Isso adicionará os produtos base da mercearia.')) {
      for (const p of INITIAL_PRODUCTS) {
        await saveProduct(p);
      }
      loadProducts();
      alert('Catálogo padrão restaurado com sucesso!');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Codigo_Barras', 'Nome', 'Categoria', 'Preco_Venda', 'Preco_Custo', 'Estoque', 'Estoque_Minimo', 'Unidade'];
    const rows = products.map((p) => [
      p.id,
      p.code,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.price.toFixed(2),
      (p.cost_price || 0).toFixed(2),
      p.stock_quantity,
      p.min_stock,
      p.unit,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `produtos_supercaixa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Profit margin calculation for form
  const calcSalePrice = parseFloat(formPrice.replace(',', '.')) || 0;
  const calcCostPrice = parseFloat(formCostPrice.replace(',', '.')) || 0;
  const profitMargin = calcCostPrice > 0 && calcSalePrice > calcCostPrice
    ? (((calcSalePrice - calcCostPrice) / calcCostPrice) * 100).toFixed(1)
    : null;

  // Stats
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.stock_quantity), 0);
  const lowStockCount = products.filter((p) => p.stock_quantity <= p.min_stock && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = searchTerm.trim() === '' || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = p.stock_quantity <= p.min_stock && p.stock_quantity > 0;
    } else if (stockFilter === 'out') {
      matchesStock = p.stock_quantity <= 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            Cadastro e Gestão de Produtos
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie itens, códigos de barra (EAN), preços de venda e estoque
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar catálogo em planilha CSV"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-950/50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Total de Itens</span>
            <span className="text-xl font-extrabold text-white font-mono">{totalProducts}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Valor em Estoque</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              R$ {totalStockValue.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Estoque Baixo</span>
            <span className="text-xl font-extrabold text-amber-300 font-mono">{lowStockCount} itens</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Itens Esgotados</span>
            <span className="text-xl font-extrabold text-rose-400 font-mono">{outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search box */}
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou código de barras..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Stock status filter pills */}
          <div className="flex items-center gap-1.5 self-start md:self-auto">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                stockFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                stockFilter === 'low'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-amber-400 hover:text-white'
              }`}
            >
              Estoque Baixo ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                stockFilter === 'out'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-rose-400 hover:text-white'
              }`}
            >
              Zerados ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Código (EAN)</th>
                <th className="px-4 py-3">Produto / Categoria</th>
                <th className="px-4 py-3 text-right">Preço Venda</th>
                <th className="px-4 py-3 text-right">Preço Custo</th>
                <th className="px-4 py-3 text-center">Estoque Atual</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Nenhum produto encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stock_quantity <= p.min_stock && p.stock_quantity > 0;
                  const isOut = p.stock_quantity <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Code */}
                      <td className="px-4 py-3 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-slate-500" />
                          <span>{p.code}</span>
                        </div>
                      </td>

                      {/* Name & Category */}
                      <td className="px-4 py-3">
                        <div className="text-white font-bold">{p.name}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60">
                          {p.category}
                        </span>
                      </td>

                      {/* Sale Price */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        R$ {p.price.toFixed(2)}
                      </td>

                      {/* Cost Price */}
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        {p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : '—'}
                      </td>

                      {/* Stock Adjuster */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(p, -1)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Diminuir 1 no estoque"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-bold font-mono text-white">
                            {p.stock_quantity}
                          </span>
                          <span className="text-[10px] text-slate-400 pr-1">{p.unit}</span>
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(p, 1)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Aumentar 1 no estoque"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 text-center">
                        {isOut ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Esgotado
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Estoque Baixo
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Excluir produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <span>Exibindo {filteredProducts.length} de {products.length} produtos cadastrados</span>
          <button
            onClick={handleRestoreInitialCatalog}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar catálogo de exemplo
          </button>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Barcode EAN */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Código de Barras (EAN / SKU) *</span>
                  <button
                    type="button"
                    onClick={() => setFormCode(generateRandomEAN())}
                    className="text-blue-400 hover:text-blue-300 font-semibold normal-case text-[11px] underline cursor-pointer"
                  >
                    Gerar EAN Aleatório
                  </button>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="Ex: 7891000100101"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Café Torrado Especial 500g"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'Todos').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as Product['unit'])}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="L">L (Litro)</option>
                    <option value="PCT">PCT (Pacote)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="G">G (Grama)</option>
                  </select>
                </div>
              </div>

              {/* Prices: Venda and Custo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="text"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex: 19.90"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="text"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="Ex: 14.50"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {profitMargin && (
                    <span className="text-[11px] text-emerald-400 mt-1 block">
                      Margem estimada: <strong>+{profitMargin}%</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Stock and Min Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Quantidade em Estoque
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Modal buttons */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-950/60 transition-colors cursor-pointer"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
