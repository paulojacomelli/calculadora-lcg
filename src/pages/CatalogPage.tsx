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
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserCatalog, saveUserCatalog, type Product } from '../services/catalogService';

// A interface Product foi movida para o service para evitar duplicação

// Mapeamento de campos internos para labels amigáveis
const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  descricao: 'Descrição',
  custoCDP: 'Custo Produto (R$)',
  impostosIMP: 'Imposto (%)',
  despesaFixaDF: 'Despesa Fixa (%)',
  outrasDespesasOD: 'Outras Despesas (%)',
  adsADS: 'Ads (%)',
  rebateCR: 'Rebate (%)'
};

const CatalogPage: React.FC = () => {
  // Estado para o usuário autenticado
  const [userId, setUserId] = useState<string | null>(null);

  // Estado para os dois estoques
  const [activeWarehouse, setActiveWarehouse] = useState<'SP' | 'SC'>('SP');
  const [productsSP, setProductsSP] = useState<Product[]>([]);
  const [productsSC, setProductsSC] = useState<Product[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setLoading(true);
        
        try {
          // Primeiro tenta carregar do Firestore
          const [cloudSP, cloudSC] = await Promise.all([
            getUserCatalog(user.uid, 'SP'),
            getUserCatalog(user.uid, 'SC')
          ]);

          if (cloudSP.length > 0 || cloudSC.length > 0) {
            setProductsSP(cloudSP);
            setProductsSC(cloudSC);
            // Sincroniza o localStorage para fallback offline
            localStorage.setItem('@shopperPCC:catalog_SP', JSON.stringify(cloudSP));
            localStorage.setItem('@shopperPCC:catalog_SC', JSON.stringify(cloudSC));
          } else {
            // Se não houver na nuvem, tenta o localStorage (migração legacy)
            const savedSP = localStorage.getItem('@shopperPCC:catalog_SP');
            const savedSC = localStorage.getItem('@shopperPCC:catalog_SC');
            
            if (savedSP) setProductsSP(JSON.parse(savedSP));
            if (savedSC) setProductsSC(JSON.parse(savedSC));

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
                rebateCR: 0
              }];
              setProductsSP(initial);
              setProductsSC(initial);
            }
          }
        } catch (error) {
          console.error("Erro ao sincronizar catálogo:", error);
          // Fallback para localStorage em caso de erro de rede
          const savedSP = localStorage.getItem('@shopperPCC:catalog_SP');
          const savedSC = localStorage.getItem('@shopperPCC:catalog_SC');
          if (savedSP) try { setProductsSP(JSON.parse(savedSP)); } catch(e){}
          if (savedSC) try { setProductsSC(JSON.parse(savedSC)); } catch(e){}
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

  const activeProducts = activeWarehouse === 'SP' ? productsSP : productsSC;
  const setActiveProducts = activeWarehouse === 'SP' ? setProductsSP : setProductsSC;

  const handleSave = async () => {
    if (!userId) {
      alert("Você precisa estar logado para salvar o catálogo na nuvem.");
      return;
    }

    setSaveStatus('saving');
    
    try {
      // Salva no Firestore
      await Promise.all([
        saveUserCatalog(userId, 'SP', productsSP),
        saveUserCatalog(userId, 'SC', productsSC)
      ]);

      // Também mantém no localStorage por segurança/cache
      localStorage.setItem('@shopperPCC:catalog_SP', JSON.stringify(productsSP));
      localStorage.setItem('@shopperPCC:catalog_SC', JSON.stringify(productsSC));
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      alert("Erro ao salvar catálogo no servidor. Tente novamente.");
      setSaveStatus('idle');
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
      rebateCR: 0
    };
    setActiveProducts([newProduct, ...activeProducts]);
  };

  const removeProduct = (id: string) => {
    if (window.confirm('Deseja realmente excluir este produto?')) {
      setActiveProducts(activeProducts.filter(p => p.id !== id));
      const nextSelected = new Set(selectedIds);
      nextSelected.delete(id);
      setSelectedIds(nextSelected);
    }
  };

  const updateProduct = (id: string, field: keyof Product, value: string) => {
    setActiveProducts(activeProducts.map(p => {
      if (p.id === id) {
        if (field === 'sku' || field === 'descricao') {
          return { ...p, [field]: value };
        }
        const numVal = value === '' ? 0 : parseFloat(value.replace(',', '.'));
        return { ...p, [field]: isNaN(numVal) ? 0 : numVal };
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
    if (window.confirm(`Deseja excluir ${selectedIds.size} produtos selecionados?`)) {
      setActiveProducts(activeProducts.filter((p: Product) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    }
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
      'Rebate (%)': p.rebateCR
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Catálogo_${activeWarehouse}`);
    XLSX.writeFile(wb, `catalogo_lcg_${activeWarehouse.toLowerCase()}.xlsx`);
  };

  const parseBRNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/\./g, '').replace(',', '.').trim();
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
      rebateCR: ['rebate', 'cr', 'comissao', 'comissão']
    };

    const usedCols = new Set<string>();

    // Pass 1: Prioritize exact matches (normalized)
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

    // Pass 2: Partial matches for unmapped fields, avoiding double mapping
    Object.keys(rules).forEach(field => {
      if (mapping[field]) return;
      const keywords = rules[field as keyof typeof rules];
      const match = cols.find(col => {
        if (usedCols.has(col)) return false;
        const slug = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return keywords.some(k => {
          if (k.length <= 2) return slug === k; // Short keywords must be exact
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
        } catch { alert('Erro ao ler Excel.'); }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = '';
  };

  const processMapping = () => {
    const processed = importRawData.map(row => ({
      id: crypto.randomUUID(),
      sku: String(row[columnMapping['sku']] || '').trim(),
      descricao: String(row[columnMapping['descricao']] || '').trim(),
      custoCDP: parseBRNumber(row[columnMapping['custoCDP']] || 0),
      impostosIMP: parseBRNumber(row[columnMapping['impostosIMP']] || 0),
      despesaFixaDF: parseBRNumber(row[columnMapping['despesaFixaDF']] || 0),
      outrasDespesasOD: parseBRNumber(row[columnMapping['outrasDespesasOD']] || 0),
      adsADS: parseBRNumber(row[columnMapping['adsADS']] || 0),
      rebateCR: parseBRNumber(row[columnMapping['rebateCR']] || 0),
    })) as Product[];

    setImportPreview(processed);
    setShowMappingModal(false);
    setShowImportModal(true);
  };

  const confirmImport = (replace: boolean) => {
    if (replace) {
      setActiveProducts(importPreview);
    } else {
      const importedSkus = new Set(importPreview.map(p => p.sku.trim().toLowerCase()).filter(s => s !== ""));
      const remainingProducts = activeProducts.filter(p => !importedSkus.has(p.sku.trim().toLowerCase()));
      setActiveProducts([...importPreview, ...remainingProducts]);
    }
    
    setShowImportModal(false);
    setImportPreview([]);
    setImportRawData([]);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const filteredProducts = activeProducts.filter(p => 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                    <select className="mapping-select" value={columnMapping[field] || ''} onChange={(e) => setColumnMapping({...columnMapping, [field]: e.target.value})}>
                      <option value="">-- Ignorar --</option>
                      {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowMappingModal(false)}>Cancelar</button><button className="btn-primary" onClick={processMapping}>Próximo</button></div>
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
          <button className="btn-secondary" onClick={triggerImport}><FileUp size={20} /> Importar</button>
          <button className="btn-secondary" onClick={exportToExcel}><FileDown size={20} /> Exportar</button>
          <div className="v-divider"></div>
          <button className="btn-primary" onClick={handleSave} disabled={saveStatus !== 'idle'} 
            style={{ minWidth: '200px', background: saveStatus === 'saved' ? '#10b981' : 'var(--red-main)', borderColor: saveStatus === 'saved' ? '#10b981' : 'var(--red-main)' }}>
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? <><CheckCircle2 size={20} /> Catálogo Salvo!</> : <><Save size={20} /> Salvar Catálogo</>}
          </button>
        </div>
      </div>

      {/* Barra de Ações em Massa */}
      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar fade-in">
          <div className="bulk-info">
            <CheckSquare size={20} />
            <span><strong>{selectedIds.size}</strong> itens selecionados</span>
          </div>
          <div className="bulk-buttons">
            <button className="btn-bulk-edit" onClick={() => setShowBulkEditModal(true)}><Edit3 size={18} /> Editar em Massa</button>
            <button className="btn-bulk-delete" onClick={bulkDelete}><Trash2 size={18} /> Excluir Selecionados</button>
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
        <button className="btn-success add-btn" onClick={addProduct}><Plus size={24} /> Novo no {activeWarehouse}</button>
      </div>

      <div className="card catalog-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="catalog-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                   <button className="select-all-btn" onClick={toggleSelectAll}>
                      {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={20} color="var(--red-main)" /> : <Square size={20} />}
                   </button>
                </th>
                <th>SKU</th><th>Descrição</th><th>Custo Produto (R$)</th><th>Imposto (%)</th><th>Despesa Fixa (%)</th><th>Outras Despesas (%)</th><th>Ads (%)</th><th>Rebate (%)</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p: Product) => (
                <tr key={p.id} className={`catalog-row ${selectedIds.has(p.id) ? 'row-selected' : ''}`}>
                  <td className="text-center">
                    <button className="row-select-btn" onClick={() => toggleSelect(p.id)}>
                       {selectedIds.has(p.id) ? <CheckSquare size={20} color="var(--red-main)" /> : <Square size={20} color="#cbd5e1" />}
                    </button>
                  </td>
                  <td><input className="cell-input" value={p.sku} onChange={(e) => updateProduct(p.id, 'sku', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input" value={p.descricao} onChange={(e) => updateProduct(p.id, 'descricao', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center text-green" value={p.custoCDP ?? ''} onChange={(e) => updateProduct(p.id, 'custoCDP', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={p.impostosIMP ?? ''} onChange={(e) => updateProduct(p.id, 'impostosIMP', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={p.despesaFixaDF ?? ''} onChange={(e) => updateProduct(p.id, 'despesaFixaDF', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={p.outrasDespesasOD ?? ''} onChange={(e) => updateProduct(p.id, 'outrasDespesasOD', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={p.adsADS ?? ''} onChange={(e) => updateProduct(p.id, 'adsADS', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td><input className="cell-input text-center" value={p.rebateCR ?? ''} onChange={(e) => updateProduct(p.id, 'rebateCR', e.target.value)} onKeyDown={(e) => handleKeyDown(e, p)} /></td>
                  <td className="text-center"><button onClick={() => removeProduct(p.id)} className="delete-btn"><Trash2 size={20} /></button></td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10}>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding: 1.5rem; background: white; border-radius: 20px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .header-icon { background: var(--red-main); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 8px 16px rgba(223, 26, 34, 0.2); }
        .header-title { font-size: 1.5rem; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em; }
        .header-subtitle { color: #6b7280; font-size: 0.9rem; font-weight: 500; margin: 2px 0 0 0; }
        
        .warehouse-selector-large { display: flex; background: #f1f5f9; padding: 6px; border-radius: 18px; gap: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
        .wh-option-large { border: none; padding: 0.8rem 2rem; border-radius: 14px; font-weight: 800; font-size: 1rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #64748b; background: transparent; }
        .wh-option-large.active { background: white; color: var(--red-main); box-shadow: 0 10px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
        
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
        .cell-input:focus { outline: none; background: white; border-color: var(--red-main); }
        .catalog-table th:nth-child(2), .catalog-table td:nth-child(2) { width: 180px; min-width: 180px; } /* SKU */
        .catalog-table th:nth-child(3), .catalog-table td:nth-child(3) { min-width: 350px; } /* Descrição */
        .catalog-table th:nth-child(4), .catalog-table td:nth-child(4) { width: 220px; min-width: 220px; } /* Custo */
        .catalog-table th:nth-child(5), .catalog-table td:nth-child(5) { width: 140px; min-width: 140px; } /* Imposto */
        .catalog-table th:nth-child(6), .catalog-table td:nth-child(6) { width: 160px; min-width: 160px; } /* Despesa Fixa */
        .catalog-table th:nth-child(7), .catalog-table td:nth-child(7) { width: 230px; min-width: 230px; } /* Outras Despesas */
        .catalog-table th:nth-child(8), .catalog-table td:nth-child(8) { width: 110px; min-width: 110px; } /* Ads */
        .catalog-table th:nth-child(9), .catalog-table td:nth-child(9) { width: 110px; min-width: 110px; } /* Rebate */
        .text-center { text-align: center; }
        .text-green { color: #059669; font-weight: 700; }
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
      `}} />
    </div>
  );
};

export default CatalogPage;
