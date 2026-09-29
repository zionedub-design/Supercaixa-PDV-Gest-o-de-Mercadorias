import React from 'react';
import { Printer, X, CheckCircle2, Download, Store } from 'lucide-react';
import { Sale } from '../types';

interface ReceiptModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, isOpen, onClose }) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const paymentLabels: Record<string, string> = {
    dinheiro: 'DINHEIRO',
    cartao_credito: 'CARTÃO DE CRÉDITO',
    cartao_debito: 'CARTÃO DE DÉBITO',
    pix: 'PIX INSTANTÂNEO',
    vale_alimentacao: 'VALE ALIMENTAÇÃO',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Venda Concluída com Sucesso!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 text-xs px-2.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Style */}
        <div className="p-6 overflow-y-auto flex-1 bg-amber-50/95 text-slate-900 font-mono text-xs shadow-inner">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <div className="flex items-center justify-center gap-1 font-bold text-base tracking-tight text-slate-950">
              <Store className="w-4 h-4" /> SUPERCAIXA MERCADO LTDA
            </div>
            <p className="text-[11px] text-slate-700">AV. BRASIL, 1500 - CENTRO</p>
            <p className="text-[10px] text-slate-600">CNPJ: 12.345.678/0001-90 | IE: 123.456.789.000</p>
            <div className="pt-1 font-bold text-xs uppercase text-slate-950">
              DOCUMENTO AUXILIAR DE VENDA (CUPOM NÃO FISCAL)
            </div>
          </div>

          {/* Sale details */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>CUPOM Nº: <strong>#{String(sale.sale_number).padStart(5, '0')}</strong></span>
              <span>DATA: {new Date(sale.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span>HORA: {new Date(sale.created_at).toLocaleTimeString('pt-BR')}</span>
              <span>TERM: 01</span>
            </div>
            <div className="flex justify-between">
              <span>OPERADOR: {sale.cashier_name}</span>
            </div>
          </div>

          {/* Items Header */}
          <div className="py-2 border-b border-dashed border-slate-400">
            <div className="grid grid-cols-12 font-bold text-[10px] pb-1">
              <span className="col-span-1">#</span>
              <span className="col-span-5">ITEM / DESCRIÇÃO</span>
              <span className="col-span-2 text-center">QTD</span>
              <span className="col-span-2 text-right">VL.UN</span>
              <span className="col-span-2 text-right">TOTAL</span>
            </div>

            {/* Item list */}
            <div className="space-y-1.5 pt-1">
              {sale.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[10.5px]">
                  <span className="col-span-1 text-slate-600">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="col-span-5 truncate pr-1">
                    <span className="font-semibold block truncate">{item.product.name}</span>
                    <span className="text-[9px] text-slate-500 font-normal">{item.product.code}</span>
                  </div>
                  <span className="col-span-2 text-center font-medium">{item.quantity}</span>
                  <span className="col-span-2 text-right">{item.unit_price.toFixed(2)}</span>
                  <span className="col-span-2 text-right font-bold">{item.total_price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>TOTAL DE ITENS:</span>
              <span className="font-bold">{sale.items.reduce((acc, i) => acc + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>R$ {sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>DESCONTO:</span>
                <span>- R$ {sale.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-slate-400 text-slate-950">
              <span>TOTAL A PAGAR:</span>
              <span>R$ {sale.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-xs">
            <div className="flex justify-between font-semibold">
              <span>FORMA DE PAGAMENTO:</span>
              <span>{paymentLabels[sale.payment_method] || sale.payment_method.toUpperCase()}</span>
            </div>
            {sale.amount_paid && sale.amount_paid > 0 && (
              <div className="flex justify-between">
                <span>VALOR RECEBIDO:</span>
                <span>R$ {sale.amount_paid.toFixed(2)}</span>
              </div>
            )}
            {sale.change_amount !== undefined && sale.change_amount > 0 && (
              <div className="flex justify-between font-bold text-slate-950">
                <span>TROCO:</span>
                <span>R$ {sale.change_amount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Receipt Footer with simulated Barcode */}
          <div className="pt-4 text-center space-y-2">
            <p className="text-[10px] text-slate-700 font-sans">
              Obrigado pela preferência! Volte sempre.
            </p>
            {/* Simulated barcode stripes */}
            <div className="flex justify-center items-center h-8 gap-0.5 px-4 overflow-hidden">
              {Array.from({ length: 42 }).map((_, i) => (
                <div
                  key={i}
                  className={`bg-slate-900 h-full ${
                    i % 3 === 0 ? 'w-1' : i % 5 === 0 ? 'w-1.5' : 'w-0.5'
                  }`}
                />
              ))}
            </div>
            <p className="text-[9px] text-slate-500 font-mono tracking-widest">
              {sale.id.toUpperCase().slice(0, 24)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <span className="text-xs text-slate-400">Cupom salvo no histórico</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Nova Venda (F2)
          </button>
        </div>
      </div>
    </div>
  );
};
