import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Search,
  Database,
  LayoutGrid,
  CheckCircle2,
  FileDown,
  FileUp,
  X,
  FileText,
  Settings2,
  Warehouse,
  CheckSquare,
  Square,
  Edit3,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { getUserCatalog, saveUserCatalog } from '../services/catalogService';


/**
 * CatalogPage - Gestão Central de Produtos
 * Versão: 0.9.0-beta
 * 
 * Funcionalidades:
 * - Sincronização inteligente com Firestore (Estoque SP e SC)
 * - Importação CSV/Excel com mapeador de colunas
 * - Edição em massa e exclusão múltipla
 * - Auto-save e fallback localStorage
 */

// Tipo Product
interface Product {
  id: string;
  sku: string;
  descricao: string;
  custoCDP: number;
  impostosIMP: number;
  despesaFixaDF: number;
  outrasDespesasOD: number;
  adsADS: number;
  rebateCR: number;
  comissaoClassico: number;
  comissaoPremium: number;
}

// Mapeamento de campos internos para labels amigáveis
const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  descricao: 'Descrição',
  custoCDP: 'Custo Produto (R$)',
  impostosIMP: 'Imposto (%)',
  despesaFixaDF: 'Despesa Fixa (%)',
  outrasDespesasOD: 'Outras Despesas (%)',
  adsADS: 'Ads (%)',
  rebateCR: 'Rebate (%)',
  comissaoClassico: 'Comis. Clássico (%)',
  comissaoPremium: 'Comis. Premium (%)'
};

const CatalogPage: React.FC = () => {
  // Estado para o nível de acesso
  const { userLevel } = useAuth();
  const isAdmin = userLevel === 1;

  // Estado para o usuário autenticado
  const [userId, setUserId] = useState<string | null>(null);

  // Estado para os dois estoques
  const [activeWarehouse, setActiveWarehouse] = useState<'SP' | 'SC'>('SP');
  const [productsSP, setProductsSP] = useState<Product[]>([]);
  const [productsSC, setProductsSC] = useState<Product[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Sistema de Notificações Internas
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Estado para Modal de Confirmação Genérico
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => { } });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'pending'>('idle');
  const [loading, setLoading] = useState(true);

  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados para Importação Inteligente
  const [importRawData, setImportRawData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Product[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(false);

  // Modal de Edição em Massa
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<keyof Product | ''>('');
  const [bulkEditValue, setBulkEditValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitorar autenticação e carregar dados
  useEffect(() => {
    // Primeiro carrega do localStorage (sempre, independente de login)
    const savedSP = localStorage.getItem('@shopperPCC:catalog_SP');
    const savedSC = localStorage.getItem('@shopperPCC:catalog_SC');

    if (savedSP) {
      try {
        const parsed = JSON.parse(savedSP);
        setProductsSP(parsed);
        console.log('[load] Carregado SP do localStorage:', parsed.length, 'produtos');
      } catch (e) { }
    }
    if (savedSC) {
      try {
        const parsed = JSON.parse(savedSC);
        setProductsSC(parsed);
        console.log('[load] Carregado SC do localStorage:', parsed.length, 'produtos');
      } catch (e) { }
    }

    // Se não houver dados locais, cria exemplo
    if (!savedSP && !savedSC) {
      const initial = [{
        id: crypto.randomUUID(),
        sku: 'EX-001',
        descricao: 'Produto Exemplo',
        custoCDP: 50.00,
        impostosIMP: 6.5,
        despesaFixaDF: 8.0,
        outrasDespesasOD: 1.0,
        adsADS: 2.0,
        rebateCR: 0,
        comissaoClassico: 12,
        comissaoPremium: 17
      }];
      setProductsSP(initial);
      setProductsSC(initial);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        // Carregar do Firestore
        setLoading(true);
        try {
          const [cloudSP, cloudSC] = await Promise.all([
            getUserCatalog(user.uid, 'SP'),
            getUserCatalog(user.uid, 'SC')
          ]);

          if (cloudSP.length > 0 || cloudSC.length > 0) {
            setProductsSP(cloudSP);
            setProductsSC(cloudSC);
            localStorage.setItem('@shopperPCC:catalog_SP', JSON.stringify(cloudSP));
            localStorage.setItem('@shopperPCC:catalog_SC', JSON.stringify(cloudSC));
          }
        } catch (error) {
          console.error("Erro ao sincronizar catálogo:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Removido auto-save em background - salvamento local apenas via botão

  const activeProducts = activeWarehouse === 'SP' ? productsSP : productsSC;
  const setActiveProducts = (newProducts: Product[]) => {
    console.log(`[setActiveProducts] Salvando ${newProducts.length} produtos no ${activeWarehouse}`);
    if (activeWarehouse === 'SP') {
      setProductsSP(newProducts);
      saveToLocalStorage('SP', newProducts);
    } else {
      setProductsSC(newProducts);
      saveToLocalStorage('SC', newProducts);
    }
    // Marca que há alterações pendentes de sincronização
    // setPendingSync(true); // Removido - funcionalidade não utilizada
  };

  // Função auxiliar para garantir salvamento no localStorage
  const saveToLocalStorage = (warehouse: 'SP' | 'SC', products: Product[]) => {
    const key = `@shopperPCC:catalog_${warehouse}`;
    try {
      localStorage.setItem(key, JSON.stringify(products));
      console.log(`[saveToLocalStorage] ${warehouse}: ${products.length} produtos salvos`);
      return true;
    } catch (e) {
      console.error(`[saveToLocalStorage] Erro ao salvar ${warehouse}:`, e);
      return false;
    }
  };

  // Lógica de Paginação e Filtragem (Consolidada)
  const filteredProducts = activeProducts.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSave = async (targetWarehouse?: 'SP' | 'SC') => {
    console.log("Salvando...", targetWarehouse || 'ambos');

    // Sempre salvar no localStorage
    if (targetWarehouse === 'SP' || !targetWarehouse) {
      saveToLocalStorage('SP', productsSP);
    }
    if (targetWarehouse === 'SC' || !targetWarehouse) {
      saveToLocalStorage('SC', productsSC);
    }

    // Salvar no Firebase se usuário estiver logado
    if (userId) {
      try {
        setSaveStatus('saving');
        const warehousesToSave = targetWarehouse ? [targetWarehouse] : ['SP', 'SC'] as ('SP' | 'SC')[];

        const savePromises = warehousesToSave.map(wh =>
          saveUserCatalog(userId, wh, wh === 'SP' ? productsSP : productsSC)
        );

        await Promise.all(savePromises);
        console.log("Sincronização com Firebase concluída!");
        setSaveStatus('saved');
        notify("Catálogo salvo e sincronizado com a nuvem!", "success");
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (error: any) {
        console.error("Erro ao sincronizar com Firebase:", error);
        setSaveStatus('saved');
        notify("Salvo localmente. Erro ao sincronizar com nuvem.", "error");
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } else {
      setSaveStatus('saved');
      notify("Catálogo salvo localmente!", "success");
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };


  const addProduct = () => {
    const newProduct: Product = {
      id: crypto.randomUUID(),
      sku: '',
      descricao: '',
      custoCDP: 0,
      impostosIMP: 0,
      despesaFixaDF: 0,
      outrasDespesasOD: 0,
      adsADS: 0,
      rebateCR: 0,
      comissaoClassico: 12,
      comissaoPremium: 17
    };
    setActiveProducts([newProduct, ...activeProducts]);
  };

  const removeProduct = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir Produto',
      message: 'Deseja realmente excluir este produto?',
      onConfirm: () => {
        setActiveProducts(activeProducts.filter(p => p.id !== id));
        const nextSelected = new Set(selectedIds);
        nextSelected.delete(id);
        setSelectedIds(nextSelected);
        setConfirmModal(prev => ({ ...prev, show: false }));
        notify("Produto excluído com sucesso!");
      }
    });
  };

  const [focusedCusto, setFocusedCusto] = useState<string | null>(null);
  const [focusedPercent, setFocusedPercent] = useState<{ id: string, field: string } | null>(null);

  const formatCustoDisplay = (valor: number | undefined): string => {
    if (valor === undefined || valor === null || valor === 0) return '';
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercentDisplay = (valor: number | undefined): string => {
    if (valor === undefined || valor === null || valor === 0) return '';
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  };

  const getPercentEditValue = (valor: number | undefined): string => {
    if (valor === undefined || valor === null || valor === 0) return '';
    // Converte para string com vírgula (ex: 6,55)
    return (Math.round(valor * 100) / 100).toFixed(2).replace('.', ',');
  };

  const updateProduct = (id: string, field: keyof Product, value: string) => {
    setActiveProducts(activeProducts.map(p => {
      if (p.id === id) {
        if (field === 'sku' || field === 'descricao') {
          return { ...p, [field]: value };
        }
        if (field === 'custoCDP') {
          // Permite digitar com vírgula ou ponto, mantendo precisão de até 4 casas
          const cleaned = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
          const numVal = cleaned === '' ? 0 : parseFloat(cleaned);
          return { ...p, [field]: isNaN(numVal) ? 0 : numVal };
        }
        // Máscara Financeira padrão: trata os dígitos como centavos (2 casas)
        const digits = value.replace(/\D/g, '');
        if (digits === '') {
          return { ...p, [field]: 0 };
        }
        const numericValue = parseInt(digits, 10) / 100;
        return { ...p, [field]: numericValue };
      }
      return p;
    }));
  };

  // Funções para Ações em Massa
  const toggleSelect = (id: string) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(id)) nextSelected.delete(id);
    else nextSelected.add(id);
    setSelectedIds(nextSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p: Product) => p.id)));
    }
  };

  const bulkDelete = () => {
    setConfirmModal({
      show: true,
      title: 'Excluir em Massa',
      message: `Deseja realmente excluir ${selectedIds.size} produtos selecionados?`,
      onConfirm: () => {
        setActiveProducts(activeProducts.filter((p: Product) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setCurrentPage(1);
        setConfirmModal(prev => ({ ...prev, show: false }));
        notify(`${selectedIds.size} produtos excluídos.`);
      }
    });
  };

  const applyBulkEdit = () => {
    if (!bulkEditField) return;

    const numVal = bulkEditValue === '' ? 0 : parseFloat(bulkEditValue.replace(',', '.'));
    const finalVal = isNaN(numVal) ? 0 : numVal;

    setActiveProducts(activeProducts.map((p: Product) => {
      if (selectedIds.has(p.id)) {
        return { ...p, [bulkEditField]: finalVal };
      }
      return p;
    }));

    setShowBulkEditModal(false);
    setSelectedIds(new Set());
    setBulkEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, product: Product) => {
    if (e.key === 'Enter') {
      const isNotBlank = product.sku.trim() !== '' || product.descricao.trim() !== '';
      if (isNotBlank) addProduct();
    }
  };

  const exportToExcel = () => {
    const exportData = activeProducts.map(p => ({
      'SKU': p.sku,
      'Descrição': p.descricao,
      'Custo Produto (R$)': p.custoCDP,
      'Imposto (%)': p.impostosIMP,
      'Despesa Fixa (%)': p.despesaFixaDF,
      'Outras Despesas (%)': p.outrasDespesasOD,
      'Ads (%)': p.adsADS,
      'Rebate (%)': p.rebateCR,
      'Comis. Clássico (%)': p.comissaoClassico,
      'Comis. Premium (%)': p.comissaoPremium
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Catálogo_${activeWarehouse}`);
    XLSX.writeFile(wb, `catalogo_lcg_${activeWarehouse.toLowerCase()}.xlsx`);
  };

  /**
   * Converte strings brasileiras (R$ 50,00 ou 50.000,00) em número JS
   */
  const parseBRNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/R\$/g, '').replace(/[^\d.,]/g, '').replace(/\s/g, '').trim();

    if (cleaned.includes(',') && cleaned.includes('.')) {
      const parts = cleaned.split(',');
      const withDot = parts[0].replace(/\./g, '') + '.' + parts[1];
      const num = parseFloat(withDot);
      return isNaN(num) ? 0 : num;
    }

    if (cleaned.includes(',')) {
      const num = parseFloat(cleaned.replace(',', '.'));
      return isNaN(num) ? 0 : num;
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const autoDetectMapping = (cols: string[]) => {
    const mapping: Record<string, string> = {};
    const rules: Record<string, string[]> = {
      sku: ['sku', 'codigo', 'ref', 'cod'],
      descricao: ['descricao', 'descrição', 'nome', 'item'],
      custoCDP: ['custo', 'custo produto', 'prod', 'vlr', 'vl', 'preço', 'preco', 'cdp'],
      impostosIMP: ['imposto', 'imp', 'taxa', 'tributo'],
      despesaFixaDF: ['fixa', 'df', 'despesa fixa'],
      outrasDespesasOD: ['outras', 'od', 'outras despesas'],
      adsADS: ['ads', 'shopee ads', 'marketing'],
      rebateCR: ['rebate', 'cr', 'comissao', 'comissão'],
      comissaoClassico: ['classico', 'clássico', 'comissao classico'],
      comissaoPremium: ['premium', 'comissao premium']
    };

    const usedCols = new Set<string>();

    Object.keys(rules).forEach(field => {
      const keywords = rules[field as keyof typeof rules];
      const match = cols.find(col => {
        const slug = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return keywords.some(k => slug === k);
      });
      if (match) {
        mapping[field] = match;
        usedCols.add(match);
      }
    });

    Object.keys(rules).forEach(field => {
      if (mapping[field]) return;
      const keywords = rules[field as keyof typeof rules];
      const match = cols.find(col => {
        if (usedCols.has(col)) return false;
        const slug = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return keywords.some(k => {
          if (k.length <= 2) return slug === k;
          return slug.includes(k);
        });
      });
      if (match) {
        mapping[field] = match;
        usedCols.add(match);
      }
    });

    setColumnMapping(mapping);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    const onDataRead = (data: any[]) => {
      if (data.length === 0) return;
      const filtered = data.filter((row: any) => {
        const values = Object.values(row).join('').toLowerCase();
        return values.length > 0 && !values.includes('#valor!');
      });

      const cols = Object.keys(filtered[0] || {});
      setImportRawData(filtered);
      setAvailableColumns(cols);
      autoDetectMapping(cols);
      setShowMappingModal(true);
    };

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: "",
        complete: (results) => onDataRead(results.data)
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          onDataRead(data);
        } catch { notify('Erro ao ler arquivo Excel.', 'error'); }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = '';
  };

  const processMapping = () => {
    const processed = importRawData
      .map(row => {
        const sku = String(row[columnMapping['sku']] || '').trim();
        const desc = String(row[columnMapping['descricao']] || '').trim();

        if ((!sku || sku === 'undefined') && (!desc || desc === 'undefined')) return null;

        return {
          id: crypto.randomUUID(),
          sku: sku === 'undefined' ? '' : sku,
          descricao: desc === 'undefined' ? '' : desc,
          custoCDP: parseBRNumber(row[columnMapping['custoCDP']] || 0),
          impostosIMP: parseBRNumber(row[columnMapping['impostosIMP']] || 0),
          despesaFixaDF: parseBRNumber(row[columnMapping['despesaFixaDF']] || 0),
          outrasDespesasOD: parseBRNumber(row[columnMapping['outrasDespesasOD']] || 0),
          adsADS: parseBRNumber(row[columnMapping['adsADS']] || 0),
          rebateCR: parseBRNumber(row[columnMapping['rebateCR']] || 0),
          comissaoClassico: parseBRNumber(row[columnMapping['comissaoClassico']] || 12),
          comissaoPremium: parseBRNumber(row[columnMapping['comissaoPremium']] || 17),
        } as Product;
      })
      .filter(p => p !== null) as Product[];

    setImportPreview(processed);
    setShowMappingModal(false);
    setShowImportModal(true);
  };

  const confirmImport = async (replace: boolean) => {
    let newList = [];
    if (replace) {
      newList = importPreview;
    } else {
      const importedSkus = new Set(importPreview.map(p => p.sku.trim().toLowerCase()).filter(s => s !== ""));
      const remainingProducts = activeProducts.filter(p => !importedSkus.has(p.sku.trim().toLowerCase()));
      newList = [...importPreview, ...remainingProducts];
    }

    setActiveProducts(newList);
    // Salvar também no localStorage do outro estoque para manter sincronizado
    saveToLocalStorage(activeWarehouse, newList);
    setShowImportModal(false);
    setImportPreview([]);
    setImportRawData([]);

    // Forçar salvamento na nuvem imediatamente
    setTimeout(() => {
      handleSave();
    }, 500);
  };

  const triggerImport = () => fileInputRef.current?.click();

  // Resetar página quando a busca ou o estoque mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeWarehouse]);


  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid var(--red-main)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: '#64748b', fontWeight: 600 }}>Sincronizando com a nuvem...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="container fade-in">

      {/* 1. Modal de Mapeamento */}
      {showMappingModal && (
        <div className="modal-overlay">
          <div className="modal-content card slide-up" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="icon-circle bg-blue"><Settings2 size={24} color="#1d4ed8" /></div>
                <div><h2 style={{ margin: 0 }}>Mapear Colunas ({activeWarehouse})</h2></div>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="mapping-grid">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="mapping-row">
                    <div className="field-info"><span className="field-label">{label}</span></div>
                    <select className="mapping-select" value={columnMapping[field] || ''} onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}>
                      <option value="">-- Ignorar --</option>
                      {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMappingModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={processMapping}>Próximo</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Preview de Importação */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content card slide-up">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="icon-circle bg-yellow"><FileText size={24} color="#b45309" /></div>
                <div><h2 style={{ margin: 0 }}>Importar em {activeWarehouse}</h2></div>
              </div>
              <button className="close-btn" onClick={() => setShowImportModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="table-preview-wrapper">
                <table className="preview-table">
                  <thead><tr><th>SKU</th><th>Custo (R$)</th></tr></thead>
                  <tbody>{importPreview.slice(0, 5).map((p, idx) => (
                    <tr key={idx}><td>{p.sku || '-'}</td><td>{p.custoCDP.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="import-options">
                <label className="checkbox-container">
                  <input type="checkbox" checked={replaceOnImport} onChange={(e) => setReplaceOnImport(e.target.checked)} />
                  Substituir catálogo atual (apagar dados existentes)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowImportModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => confirmImport(replaceOnImport)}><FileUp size={18} /> Iniciar Importação</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal de Edição em Massa */}
      {showBulkEditModal && (
        <div className="modal-overlay">
          <div className="modal-content card slide-up" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="icon-circle bg-blue"><Edit3 size={24} color="#1d4ed8" /></div>
                <div><h2 style={{ margin: 0 }}>Edição em Massa</h2></div>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: '#64748b' }}>Defina o valor para os <strong>{selectedIds.size}</strong> itens selecionados.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <select className="mapping-select" value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value as keyof Product)}>
                  <option value="">Selecione o campo...</option>
                  <option value="impostosIMP">Imposto (%)</option>
                  <option value="despesaFixaDF">Despesa Fixa (%)</option>
                  <option value="outrasDespesasOD">Outras Despesas (%)</option>
                  <option value="adsADS">Ads (%)</option>
                  <option value="rebateCR">Rebate (%)</option>
                  <option value="comissaoClassico">Comis. Clássico (%)</option>
                  <option value="comissaoPremium">Comis. Premium (%)</option>
                  <option value="custoCDP">Custo CDP (R$)</option>
                </select>
                <input
                  className="input-field"
                  placeholder="Novo valor (ex: 6,5)"
                  value={bulkEditValue}
                  onChange={(e) => setBulkEditValue(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBulkEditModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={applyBulkEdit} disabled={!bulkEditField}>Aplicar Alteração</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />

      {/* Seletor de Estoque */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div className="warehouse-selector-large">
          <button className={`wh-option-large ${activeWarehouse === 'SP' ? 'active' : ''}`} onClick={() => { setActiveWarehouse('SP'); setSelectedIds(new Set()); }}>
            <Warehouse size={18} /> Estoque São Paulo
          </button>
          <button className={`wh-option-large ${activeWarehouse === 'SC' ? 'active' : ''}`} onClick={() => { setActiveWarehouse('SC'); setSelectedIds(new Set()); }}>
            <Warehouse size={18} /> Estoque Santa Catarina
          </button>
        </div>
      </div>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className="header-icon"><Database size={24} color="white" /></div>
          <div>
            <h1 className="header-title">Catálogo de Produtos</h1>
            <p className="header-subtitle">Gerencie parâmetros fixos do estoque {activeWarehouse}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isAdmin && (
            <>
              <button className="btn-secondary" onClick={triggerImport}><FileUp size={20} /> Importar</button>
              <button className="btn-secondary" onClick={exportToExcel}><FileDown size={20} /> Exportar</button>
              <div className="v-divider"></div>
              <button className="btn-primary" onClick={() => handleSave(activeWarehouse)} disabled={saveStatus === 'saving'}
                style={{
                  minWidth: '200px',
                  background: saveStatus === 'saved' ? '#10b981' : 'var(--primary-main)',
                  borderColor: saveStatus === 'saved' ? '#10b981' : 'var(--primary-main)'
                }}>
                {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? <><CheckCircle2 size={20} /> Salvo!</> : <><Save size={20} /> Salvar</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra de Ações em Massa */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bulk-actions-bar fade-in">
          <div className="bulk-info">
            <CheckSquare size={20} />
            <span><strong>{selectedIds.size}</strong> itens selecionados</span>
          </div>
          <div className="bulk-buttons">
            <button className="btn-bulk-edit" onClick={() => setShowBulkEditModal(true)} disabled={!isAdmin}><Edit3 size={18} /> Editar em Massa</button>
            <button className="btn-bulk-delete" onClick={bulkDelete} disabled={!isAdmin}><Trash2 size={18} /> Excluir Selecionados</button>
            <div className="v-divider" style={{ background: 'rgba(255,255,255,0.2)' }}></div>
            <button className="bulk-close" onClick={() => setSelectedIds(new Set())}><X size={18} /></button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={22} className="search-icon" />
          <input type="text" placeholder={`Buscar no estoque ${activeWarehouse}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field search-input" />
        </div>
        {isAdmin && (
          <button className="btn-success add-btn" onClick={addProduct}><Plus size={24} /> Novo no {activeWarehouse}</button>
        )}
      </div>

      <div className="card catalog-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="catalog-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  {isAdmin && (
                    <button className="select-all-btn" onClick={toggleSelectAll}>
                      {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={20} color="var(--primary-main)" /> : <Square size={20} />}
                    </button>
                  )}
                </th>
                <th>SKU</th><th>Descrição</th><th>Custo Produto (R$)</th><th>Imposto (%)</th><th>Fixa (%)</th><th>Outras (%)</th><th>Ads (%)</th><th>Rebate (%)</th><th>Clássico (%)</th><th>Premium (%)</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((p: Product) => (
                <tr key={p.id} className={`catalog-row ${selectedIds.has(p.id) ? 'row-selected' : ''}`}>
                  <td className="text-center">
                    {isAdmin && (
                      <button className="row-select-btn" onClick={() => toggleSelect(p.id)}>
                        {selectedIds.has(p.id) ? <CheckSquare size={20} color="var(--primary-main)" /> : <Square size={20} color="#cbd5e1" />}
                      </button>
                    )}
                  </td>
                  <td><input className="cell-input" value={p.sku} readOnly={!isAdmin} onChange={(e) => updateProduct(p.id, 'sku', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input" value={p.descricao} readOnly={!isAdmin} onChange={(e) => updateProduct(p.id, 'descricao', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center text-green custo-input" value={focusedCusto === p.id ? (p.custoCDP ? p.custoCDP.toString().replace('.', ',') : '') : formatCustoDisplay(p.custoCDP)} readOnly={!isAdmin} onFocus={() => setFocusedCusto(p.id)} onBlur={() => setFocusedCusto(null)} onChange={(e) => updateProduct(p.id, 'custoCDP', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={focusedPercent?.id === p.id && focusedPercent?.field === 'impostosIMP' ? getPercentEditValue(p.impostosIMP) : formatPercentDisplay(p.impostosIMP)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'impostosIMP' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'impostosIMP', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={focusedPercent?.id === p.id && focusedPercent?.field === 'despesaFixaDF' ? getPercentEditValue(p.despesaFixaDF) : formatPercentDisplay(p.despesaFixaDF)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'despesaFixaDF' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'despesaFixaDF', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={focusedPercent?.id === p.id && focusedPercent?.field === 'outrasDespesasOD' ? getPercentEditValue(p.outrasDespesasOD) : formatPercentDisplay(p.outrasDespesasOD)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'outrasDespesasOD' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'outrasDespesasOD', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={focusedPercent?.id === p.id && focusedPercent?.field === 'adsADS' ? getPercentEditValue(p.adsADS) : formatPercentDisplay(p.adsADS)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'adsADS' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'adsADS', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={focusedPercent?.id === p.id && focusedPercent?.field === 'rebateCR' ? getPercentEditValue(p.rebateCR) : formatPercentDisplay(p.rebateCR)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'rebateCR' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'rebateCR', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center text-blue" style={{ fontWeight: 700 }} value={focusedPercent?.id === p.id && focusedPercent?.field === 'comissaoClassico' ? getPercentEditValue(p.comissaoClassico) : formatPercentDisplay(p.comissaoClassico)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'comissaoClassico' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'comissaoClassico', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center text-blue" style={{ fontWeight: 700 }} value={focusedPercent?.id === p.id && focusedPercent?.field === 'comissaoPremium' ? getPercentEditValue(p.comissaoPremium) : formatPercentDisplay(p.comissaoPremium)} readOnly={!isAdmin} onFocus={() => setFocusedPercent({ id: p.id, field: 'comissaoPremium' })} onBlur={() => setFocusedPercent(null)} onChange={(e) => updateProduct(p.id, 'comissaoPremium', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td className="text-center">
                    {isAdmin && (
                      <button onClick={() => removeProduct(p.id)} className="delete-btn"><Trash2 size={20} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state-container">
                      <div className="empty-icon"><LayoutGrid size={48} /></div>
                      <p className="empty-text">Nenhum produto encontrado em <strong>{activeWarehouse}</strong></p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>Adicione um novo produto ou importe um arquivo para começar.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="pagination-container fade-in">
          <button
            className="pagination-arr-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            title="Página Anterior"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                // Lógica para mostrar apenas algumas páginas (primeira, última e arredores da atual)
                if (totalPages <= 7) return true;
                if (page === 1 || page === totalPages) return true;
                return page >= currentPage - 1 && page <= currentPage + 1;
              })
              .map((page, idx, arr) => {
                const elements = [];
                // Adicionar reticências se houver salto
                if (idx > 0 && page - arr[idx - 1] > 1) {
                  elements.push(<span key={`dots-${page}`} className="pagination-dots">...</span>);
                }
                elements.push(
                  <button
                    key={page}
                    className={`pagination-num-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
                return elements;
              })}
          </div>

          <button
            className="pagination-arr-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            title="Próxima Página"
          >
            <ChevronRight size={20} />
          </button>

          <div className="pagination-info">
            Mostrando <strong>{paginatedProducts.length}</strong> de <strong>{filteredProducts.length}</strong> produtos
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding: 1.5rem; background: white; border-radius: 20px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .header-icon { background: var(--primary-main); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 8px 16px rgba(223, 26, 34, 0.2); }
        .header-title { font-size: 1.5rem; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em; }
        .header-subtitle { color: #6b7280; font-size: 0.9rem; font-weight: 500; margin: 2px 0 0 0; }
        
        .warehouse-selector-large { display: flex; background: #f1f5f9; padding: 6px; border-radius: 18px; gap: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
        .wh-option-large { border: none; padding: 0.8rem 2rem; border-radius: 14px; font-weight: 800; font-size: 1rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #64748b; background: transparent; }
        .wh-option-large.active { background: white; color: var(--primary-main); box-shadow: 0 10px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
        
        .bulk-actions-bar { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 0.75rem 1.5rem; border-radius: 16px; display: flex; align-items: center; gap: 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.3); z-index: 1000; border: 1px solid rgba(255,255,255,0.1); }
        .bulk-info { display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; }
        .bulk-buttons { display: flex; align-items: center; gap: 1rem; }
        .btn-bulk-edit { background: #3b82f6; color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
        .btn-bulk-delete { background: #ef4444; color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
        .btn-bulk-edit:hover, .btn-bulk-delete:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .bulk-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.5rem; transition: color 0.2s; }
        .bulk-close:hover { color: white; }

        .select-all-btn, .row-select-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.5rem; border-radius: 6px; transition: all 0.2s; }
        .row-selected { background: rgba(223, 26, 34, 0.03) !important; }

        .v-divider { width: 1px; background: #e5e7eb; margin: 0 0.5rem; }
        .search-icon { position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input { padding-left: 3.5rem; height: 54px; font-size: 1.05rem; border: 2px solid #e5e7eb; border-radius: 14px; width: 100%; transition: all 0.2s; }
        .add-btn { height: 54px; padding: 0 2rem; white-space: nowrap; font-size: 1.05rem; }
        .catalog-card { padding: 0; overflow: hidden; border-radius: 20px; }
        .catalog-table { width: 100%; border-collapse: collapse; min-width: 1000px; }
        .catalog-table th { padding: 1.25rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 800; color: #374151; background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; white-space: nowrap; }
        .catalog-table tbody tr { border-bottom: 1px solid #f3f4f6; transition: background 0.2s; }
        .catalog-table tbody tr:hover { background: #fdfcfc; }
        .cell-input { width: 100%; border: 2px solid transparent; padding: 0.75rem 0.5rem; border-radius: 8px; background: transparent; font-size: 0.95rem; color: #334155; font-weight: 500; text-align: inherit; }
        .cell-input:focus { outline: none; background: white; border-color: var(--primary-main); }
        .catalog-table th:nth-child(2), .catalog-table td:nth-child(2) { width: 120px; min-width: 120px; } /* SKU */
        .catalog-table th:nth-child(3), .catalog-table td:nth-child(3) { min-width: 200px; max-width: 300px; } /* Descrição */
        .catalog-table td:nth-child(3) .cell-input {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .catalog-table th:nth-child(4), .catalog-table td:nth-child(4) { width: 150px; min-width: 150px; } /* Custo */
        .custo-input { font-weight: 700; color: #059669; }
        .custo-input:focus { background: white; border-color: var(--primary-main); }
        .catalog-table th:nth-child(5), .catalog-table td:nth-child(5) { width: 90px; min-width: 90px; } /* Imposto */
        .catalog-table th:nth-child(6), .catalog-table td:nth-child(6) { width: 80px; min-width: 80px; } /* Fixa */
        .catalog-table th:nth-child(7), .catalog-table td:nth-child(7) { width: 80px; min-width: 80px; } /* Outras */
        .catalog-table th:nth-child(8), .catalog-table td:nth-child(8) { width: 70px; min-width: 70px; } /* Ads */
        .catalog-table th:nth-child(9), .catalog-table td:nth-child(9) { width: 80px; min-width: 80px; } /* Rebate */
        .catalog-table th:nth-child(10), .catalog-table td:nth-child(10) { width: 100px; min-width: 100px; } /* Clássico */
        .catalog-table th:nth-child(11), .catalog-table td:nth-child(11) { width: 100px; min-width: 100px; } /* Premium */
        .text-center { text-align: center; }
        .text-green { color: #059669; font-weight: 700; }
        .text-blue { color: #2563eb; }
        .delete-btn { color: #cbd5e1; background: none; border: none; cursor: pointer; padding: 0.6rem; }
        .delete-btn:hover { color: #ef4444; }

        .empty-state-container { padding: 8rem 0; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-width: 1000px; }
        .empty-icon { background: #f8fafb; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #cbd5e1; border: 2px dashed #e2e8f0; }
        .empty-text { font-size: 1.25rem; font-weight: 700; color: #475569; margin: 0; }
        .row-select-btn:hover, .select-all-btn:hover { background: #f1f5f9; }
        .catalog-table th:first-child, .catalog-table td:first-child { padding: 1.25rem 0.5rem; text-align: center; width: 60px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 2rem; }
        .modal-content { width: 100%; max-width: 600px; background: white; padding: 2rem; border-radius: 24px; }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
        .mapping-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .mapping-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
        .mapping-select { padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-size: 0.95rem; }
        .modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; margin-top: 1rem; }
        
        .table-preview-wrapper { background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 1rem; max-height: 300px; overflow-y: auto; }
        .preview-table { width: 100%; border-collapse: collapse; }
        .preview-table th { background: #f1f5f9; padding: 0.75rem; text-align: left; font-size: 0.7rem; color: #475569; }
        .preview-table td { padding: 0.75rem; font-size: 0.85rem; border-top: 1px solid #e2e8f0; }
        .checkbox-container { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600; padding: 0.5rem 0; }

        /* Notificações Toast */
        .toast-notification { position: fixed; bottom: 2rem; right: 2rem; padding: 1rem 1.5rem; border-radius: 12px; background: #1e293b; color: white; display: flex; align-items: center; gap: 0.75rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 10002; font-weight: 600; font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.1); }
        .toast-notification.error { background: #ef4444; border-color: #f87171; }
        .toast-notification.success { background: #10b981; border-color: #34d399; }

        /* Estilo para Círculo de Ícone nos Modais */
        .icon-circle { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .bg-blue { background: #eff6ff; }
        .bg-yellow { background: #fefce8; }
        .bg-red { background: #fef2f2; }

        /* Paginação */
        .pagination-container { display: flex; align-items: center; justify-content: center; margin-top: 2rem; gap: 1rem; flex-wrap: wrap; }
        .pagination-numbers { display: flex; align-items: center; gap: 0.5rem; }
        .pagination-num-btn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; color: #64748b; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .pagination-num-btn:hover { border-color: var(--primary-main); color: var(--primary-main); background: #fef2f2; }
        .pagination-num-btn.active { background: var(--primary-main); color: white; border-color: var(--primary-main); box-shadow: 0 4px 12px rgba(223, 26, 34, 0.2); }
        
        .pagination-arr-btn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; color: #64748b; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .pagination-arr-btn:hover:not(:disabled) { border-color: var(--primary-main); color: var(--primary-main); background: #fef2f2; }
        .pagination-arr-btn:disabled { opacity: 0.4; cursor: not-allowed; background: #f8fafc; }
        
        .pagination-dots { color: #94a3b8; font-weight: 700; padding: 0 0.5rem; }
        .pagination-info { font-size: 0.9rem; color: #6b7280; font-weight: 500; margin-left: 1rem; }
      `}} />

      {/* 4. Sistema de Notificações Toast */}
      {notification && (
        <div className={`toast-notification ${notification.type} slide-up`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {notification.message}
        </div>
      )}

      {/* 5. Modal de Confirmação Genérico */}
      {confirmModal.show && (
        <div className="modal-overlay">
          <div className="modal-content card slide-up" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="icon-circle bg-red"><Info size={24} color="#ef4444" /></div>
                <div><h2 style={{ margin: 0 }}>{confirmModal.title}</h2></div>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ color: '#64748b', lineHeight: 1.5 }}>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>Cancelar</button>
              <button className="btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
