import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  X, 
  UploadCloud, 
  Key, 
  Globe 
} from 'lucide-react';
import { 
  getStoredConfig, 
  saveConfig, 
  testConnection, 
  syncLocalDataToSupabase, 
  SUPABASE_SQL_SCHEMA 
} from '../services/supabase';
import { SupabaseConfig } from '../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (isConnected: boolean) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onStatusChange }) => {
  const [config, setConfig] = useState<SupabaseConfig>(getStoredConfig());
  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; tableFound?: boolean } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'instructions'>('config');

  useEffect(() => {
    if (isOpen) {
      const current = getStoredConfig();
      setConfig(current);
      setUrlInput(current.url);
      setKeyInput(current.anonKey);
      setTestResult(null);
      setSyncResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const saved = saveConfig(urlInput, keyInput);
    setConfig(saved);

    const result = await testConnection();
    setTestResult(result);
    setIsTesting(false);

    if (result.success && onStatusChange) {
      onStatusChange(true);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    const res = await syncLocalDataToSupabase();
    setSyncResult(res);
    setIsSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Conexão com o Supabase
                {config.isConnected ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Modo Local Ativo
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Sincronize produtos cadastrados e vendas diretamente com seu banco na nuvem Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" /> Credenciais & Status
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> Script SQL das Tabelas
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'instructions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ExternalLink className="w-4 h-4" /> Como Configurar
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-sm text-slate-300">
                <p>
                  O sistema está <strong>pronto para guardar as informações no Supabase</strong>. Insira sua URL e Anon Key do seu projeto Supabase abaixo. Caso prefira continuar sem banco agora, o sistema opera de forma autônoma e com persistência local no navegador!
                </p>
              </div>

              <form onSubmit={handleSaveAndTest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" /> Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzprojectid.supabase.co"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Encontrado em: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" /> Supabase Public / Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Encontrado em: Supabase Dashboard &gt; Project Settings &gt; API &gt; anon / public key
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/60 text-white font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Conectando &amp; Testando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Salvar &amp; Testar Conexão
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncData}
                    disabled={isSyncing || !urlInput || !keyInput}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium text-sm rounded-xl flex items-center gap-2 transition-colors border border-slate-700"
                  >
                    <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce text-emerald-400' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Enviar Dados Locais para o Supabase'}
                  </button>
                </div>
              </form>

              {/* Feedback messages */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="text-sm">
                    <p className="font-semibold">{testResult.success ? 'Conexão Supabase OK' : 'Aviso de Conexão'}</p>
                    <p className="text-xs opacity-90 mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              {syncResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    syncResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {syncResult.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="text-sm">
                    <p className="font-semibold">Sincronização com o Supabase</p>
                    <p className="text-xs opacity-90 mt-0.5">{syncResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Script SQL para Criar as Tabelas</h4>
                  <p className="text-xs text-slate-400">
                    Copie e cole este script no <strong>SQL Editor</strong> do Supabase para criar as tabelas `products`, `sales` e `sale_items`.
                  </p>
                </div>
                <button
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar SQL
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[350px] leading-relaxed">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">1</span>
                  Criar o projeto no Supabase
                </h4>
                <p className="text-xs text-slate-400 pl-8">
                  Acesse <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline">supabase.com</a> e crie um novo projeto (ou use um já existente).
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">2</span>
                  Executar o script SQL
                </h4>
                <p className="text-xs text-slate-400 pl-8">
                  No menu lateral esquerdo do Supabase, clique em <strong>SQL Editor</strong>, crie uma "New Query", cole o conteúdo da aba <strong>Script SQL das Tabelas</strong> e clique em <strong>RUN</strong>.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">3</span>
                  Obter as credenciais
                </h4>
                <p className="text-xs text-slate-400 pl-8">
                  Vá em <strong>Project Settings &gt; API</strong> e copie a <strong>Project URL</strong> e a <strong>anon / public key</strong>.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">4</span>
                  Salvar na aplicação
                </h4>
                <p className="text-xs text-slate-400 pl-8">
                  Cole os dados na aba <strong>Credenciais & Status</strong> deste modal e clique em <strong>Salvar & Testar Conexão</strong>. A partir desse momento, cada produto cadastrado e venda registrada será salvo no Supabase!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
