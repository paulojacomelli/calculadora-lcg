import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, ArrowLeft, CheckCircle2, Info, TrendingUp, Sparkles, Zap } from 'lucide-react';
import Papa from 'papaparse';
import { Link } from 'react-router-dom';
import type { ShopeeInput } from '../utils/shopeeLogic';
import { calcularTaxasShopee, calcularPrecoIdealDetalhado } from '../utils/shopeeLogic';
import * as XLSX from 'xlsx';

const defaultSettings: ShopeeInput = {
    custoProduto: undefined,
    precoVenda: undefined,
    despesaFixa: 0,
    despesaFixaTipo: 'porcentagem',
    despesaAdicional: 0,
    despesaAdicionalTipo: 'porcentagem',
    impostoPorcentagem: 0,
    impostoTipo: 'porcentagem',
    adsValor: 0,
    adsTipo: 'porcentagem',
    rebatePorcentagem: 0,
    rebateTipo: 'porcentagem',
    cupomDesconto: 0,
    cupomTipo: 'fixo',
    fatorAlavancagem: 5.0,
    fatorAlavancagemAtivo: true,
};

const ShopeeLotePage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processedData, setProcessedData] = useState<any[]>([]);
    const [operationType, setOperationType] = useState<'margem' | 'ideal'>('margem');

    const [settings] = useState<ShopeeInput>(() => {
        const saved = localStorage.getItem('@shopperPCC:inputs');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
            setProcessedData([]);
        }
    };

    const extrairValor = (row: any, possíveisColunas: string[]) => {
        const normalizedPossibleCols = possíveisColunas.map(c => c.toLowerCase().trim());
        const rowKeys = Object.keys(row);

        for (const key of rowKeys) {
            const normalizedKey = key.toLowerCase().trim();
            if (normalizedPossibleCols.includes(normalizedKey)) {
                const val = row[key];
                if (val !== undefined && val !== null && val.toString().trim() !== '') {
                    const valStr = val.toString().replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
                    const valNum = parseFloat(valStr);
                    if (!isNaN(valNum)) return valNum;
                }
            }
        }
        return undefined;
    };

    const downloadSample = () => {
        const data = [
            { sku: 'PRODUTO-TESTE-01', custo: 50.00, preco: 89.90, margem: 15 },
            { sku: 'PRODUTO-TESTE-02', custo: 120.50, preco: 199.00, margem: 20 }
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
        XLSX.writeFile(workbook, "modelo_calculo_shopee.xlsx");
    };

    const processDataRows = (rows: any[]) => {
        try {
            const output = rows.map((row) => {
                const sku = row.sku || row.SKU || row.id || row.ID || row.item || row.SKU_REF || 'S/ SKU';
                const custoProduto = extrairValor(row, ['custo_produto', 'custo', 'Custo', 'Custo Produto', 'CDP', 'custo prod', 'Custo do Produto']);
                const precoVendaCampo = extrairValor(row, ['preco_venda', 'preco', 'Preço', 'Preco Venda', 'PA', 'pr vda', 'P.V.', 'Preço Anunciado']);
                const margemDesejadaCampo = extrairValor(row, ['margem_desejada', 'margem', 'Margem', 'Margem Desejada', 'Margem (%)', 'mrg', 'lucro desejado', 'lucro desejado (%)', 'lucro']);
                
                // Extração de configurações específicas da linha (se existirem)
                const impostoLinha = extrairValor(row, ['imposto', 'IMP', 'Taxa Imposto', 'Imposto (%)', 'aliquota', 'Imposto']);
                const adsLinha = extrairValor(row, ['ads', 'ADS', 'Marketing', 'Ads (%)', 'Ads']);
                const despesaFixaLinha = extrairValor(row, ['despesa_fixa', 'despesa fixa', 'DF', 'Investimento', 'Despesa fixa']);
                const despesaAdicionalLinha = extrairValor(row, ['despesa_adicional', 'outras despesas', 'DA', 'extras', 'Outras Despesas']);
                const cupomLinha = extrairValor(row, ['cupom', 'cupom de desconto', 'CD', 'Cupom de Desconto']);
                const rebateLinha = extrairValor(row, ['rebate', 'REB', 'Crédito de Rebate', 'Crédito de rebate']);
                const freteGratisLinha = row['frete_gratis']?.toString().toLowerCase().trim() === 'sim' || row['Frete Grátis']?.toString().toLowerCase().trim() === 'sim' || row['FRETE']?.toString().toLowerCase().trim() === 'sim';

                // Criar um "settings" específico para esta linha com nomes corretos da interface ShopeeInput
                const settingsLinha: ShopeeInput = { 
                    ...settings,
                    impostoPorcentagem: impostoLinha !== undefined ? impostoLinha : settings.impostoPorcentagem,
                    adsValor: adsLinha !== undefined ? adsLinha : settings.adsValor,
                    despesaFixa: despesaFixaLinha !== undefined ? despesaFixaLinha : settings.despesaFixa,
                    despesaAdicional: despesaAdicionalLinha !== undefined ? despesaAdicionalLinha : settings.despesaAdicional,
                    cupomDesconto: cupomLinha !== undefined ? cupomLinha : settings.cupomDesconto,
                    rebatePorcentagem: rebateLinha !== undefined ? rebateLinha : settings.rebatePorcentagem,
                    fatorAlavancagemAtivo: freteGratisLinha || (settings.fatorAlavancagemAtivo ?? false)
                };

                let outRow: any = { SKU: sku };

                if (custoProduto === undefined) {
                    outRow['STATUS'] = 'ERRO';
                    outRow['OBS'] = 'Custo não encontrado';
                    return outRow;
                }

                outRow['CUSTO_BASE'] = custoProduto;

                if (operationType === 'margem') {
                    if (precoVendaCampo === undefined) {
                        outRow['STATUS'] = 'ERRO';
                        outRow['OBS'] = 'Preço não encontrado';
                        return outRow;
                    }
                    const inputsComLinha: ShopeeInput = { ...settingsLinha, custoProduto, precoVenda: precoVendaCampo };
                    const res = calcularTaxasShopee(inputsComLinha, true);

                    outRow['PRECO_ANUNCIADO'] = precoVendaCampo;
                    outRow['LUCRO_REAIS'] = res.lucroLiquido;
                    outRow['MARGEM_PCT'] = res.margemSobreVenda;
                    outRow['STATUS'] = 'OK';
                } else {
                    const margemAlvo = margemDesejadaCampo !== undefined ? margemDesejadaCampo : 15;
                    const inputsComLinha: ShopeeInput = { ...settingsLinha, custoProduto };
                    const otimizacao = calcularPrecoIdealDetalhado(inputsComLinha, margemAlvo, 'venda');
                    
                    outRow['MARGEM_ALVO'] = margemAlvo;
                    outRow['PRECO_SUGERIDO'] = otimizacao.precoOtimizado;
                    outRow['LUCRO_FINAL'] = otimizacao.lucroOtimizado;
                    outRow['ESTRATEGIA'] = otimizacao.isAlavancagem ? 'GIRO' : 'OTIMIZADO';
                    outRow['STATUS'] = 'OK';
                }

                return outRow;
            });

            setProcessedData(output);
            setIsProcessing(false);
        } catch (err: any) {
            setError('Erro interno no processamento: ' + err.message);
            setIsProcessing(false);
        }
    };

    const processFile = () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);

        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    processDataRows(json);
                } catch (err: any) {
                    setError('Erro ao ler Excel: ' + err.message);
                    setIsProcessing(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    processDataRows(results.data);
                },
                error: (err) => {
                    setError('Erro ao ler arquivo CSV: ' + err.message);
                    setIsProcessing(false);
                }
            });
        }
    };

    const downloadResults = () => {
        if (processedData.length === 0) return;
        const csvContent = Papa.unparse(processedData, { delimiter: ';' });
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `calculo_massa_shopee_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container" style={{ paddingTop: '2rem' }}>
            <div className="header" style={{ textAlign: 'left', marginBottom: '3rem' }}>
                <Link to="/shopee" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '1rem', fontWeight: 600 }}>
                    <ArrowLeft size={18} /> Voltar para Calculadora Individual
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#eff6ff', color: '#3b82f6', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileSpreadsheet size={30} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2rem', margin: 0 }}>Cálculo em Massa (CSV)</h1>
                        <p style={{ color: '#64748b', margin: 0 }}>Processe centenas de anúncios Shopee simultaneamente.</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
                <div className="card" style={{ padding: '2.5rem' }}>
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
                            Configurações do Lote
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div 
                                style={{ 
                                    padding: '1.5rem', 
                                    borderRadius: '12px', 
                                    border: `2px solid ${operationType === 'margem' ? '#3b82f6' : '#e2e8f0'}`,
                                    background: operationType === 'margem' ? '#f0f7ff' : 'white',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setOperationType('margem')}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div style={{ background: '#3b82f6', color: 'white', padding: '0.4rem', borderRadius: '8px' }}>
                                        <TrendingUp size={20} />
                                    </div>
                                    <input type="radio" checked={operationType === 'margem'} readOnly />
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>Análise de Lucratividade</h4>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Descubra a margem e o lucro líquido para preços já definidos.</p>
                            </div>

                            <div 
                                style={{ 
                                    padding: '1.5rem', 
                                    borderRadius: '12px', 
                                    border: `2px solid ${operationType === 'ideal' ? '#3b82f6' : '#e2e8f0'}`,
                                    background: operationType === 'ideal' ? '#f0f7ff' : 'white',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setOperationType('ideal')}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div style={{ background: '#10b981', color: 'white', padding: '0.4rem', borderRadius: '8px' }}>
                                        <Sparkles size={20} />
                                    </div>
                                    <input type="radio" checked={operationType === 'ideal'} readOnly />
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>Definição de Preço Alvo</h4>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>Encontre o preço ideal para atingir sua margem desejada.</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>2</span>
                            Upload de Arquivos
                        </h3>
                        
                        <div 
                            style={{ 
                                border: '2px dashed #cbd5e1', 
                                borderRadius: '16px', 
                                padding: '3rem', 
                                textAlign: 'center',
                                background: '#f8fafc',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {file ? (
                                <div>
                                    <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
                                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{file.name}</h4>
                                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{Math.round(file.size / 1024)} KB - Pronto para processar</p>
                                    <button className="btn-outline" onClick={() => setFile(null)}>Alterar Arquivo</button>
                                </div>
                            ) : (
                                <label style={{ cursor: 'pointer', display: 'block' }}>
                                    <Upload size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Arraste seu arquivo aqui</h4>
                                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Suporta Excel (.xlsx, .xls) e CSV</p>
                                    <input 
                                        type="file" 
                                        accept=".csv, .xlsx, .xls, .txt" 
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    <div className="btn-primary" style={{ display: 'inline-flex', marginTop: '1rem' }}>Selecionar Arquivo</div>
                                </label>
                            )}
                        </div>
                    </div>

                    {processedData.length > 0 && (
                        <div style={{ marginTop: '2.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h4 style={{ margin: 0, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileSpreadsheet size={20} color="#3b82f6" /> Prévia dos Resultados
                                </h4>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {processedData.filter(r => r.STATUS === 'OK').length} Sucessos</span>
                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {processedData.filter(r => r.STATUS === 'ERRO').length} Falhas</span>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', background: 'white' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', color: '#64748b' }}>SKU</th>
                                            {operationType === 'margem' ? (
                                                <>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Venda</th>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Lucro</th>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Margem</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Sugerido</th>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Lucro</th>
                                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#64748b' }}>Estratégia</th>
                                                </>
                                            )}
                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#64748b' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedData.slice(0, 10).map((row, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: row.STATUS === 'ERRO' ? '#fff1f2' : 'transparent' }}>
                                                <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{row.SKU}</td>
                                                {row.STATUS === 'ERRO' ? (
                                                    <td colSpan={3} style={{ padding: '0.85rem 1rem', color: '#ef4444', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                        {row.OBS}
                                                    </td>
                                                ) : (
                                                    <>
                                                        {operationType === 'margem' ? (
                                                            <>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>R$ {row.PRECO_ANUNCIADO?.toFixed(2).replace('.', ',')}</td>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: row.LUCRO_REAIS > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                    R$ {row.LUCRO_REAIS?.toFixed(2).replace('.', ',')}
                                                                </td>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{row.MARGEM_PCT?.toFixed(2).replace('.', ',')}%</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700 }}>R$ {row.PRECO_SUGERIDO?.toFixed(2).replace('.', ',')}</td>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>R$ {row.LUCRO_FINAL?.toFixed(2).replace('.', ',')}</td>
                                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.8rem' }}>
                                                                    <span style={{ 
                                                                        background: row.ESTRATEGIA === 'GIRO' ? '#ede9fe' : '#dcfce7', 
                                                                        color: row.ESTRATEGIA === 'GIRO' ? '#7c3aed' : '#166534',
                                                                        padding: '0.2rem 0.5rem',
                                                                        borderRadius: '4px'
                                                                    }}>
                                                                        {row.ESTRATEGIA}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    {row.STATUS === 'OK' ? <CheckCircle2 size={20} color="#10b981" /> : <AlertCircle size={20} color="#ef4444" />}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {processedData.length > 10 && (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                                        + {processedData.length - 10} itens não mostrados na prévia.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                        {processedData.length > 0 ? (
                            <button className="btn-primary" onClick={downloadResults} style={{ background: '#10b981', borderColor: '#10b981', padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
                                <Download size={20} /> Baixar Planilha Final
                            </button>
                        ) : (
                            <button className="btn-primary" onClick={processFile} disabled={!file || isProcessing} style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
                                {isProcessing ? 'Calculando...' : <><Zap size={20} /> Iniciar Processamento</>}
                            </button>
                        )}
                    </div>

                    {error && (
                        <div style={{ marginTop: '1.5rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="sidebar">
                    <div className="card" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info size={18} /> Instruções da Tabela
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '1rem' }}>
                            Seu arquivo deve ser um <strong>Excel</strong> ou <strong>CSV</strong> e conter os seguintes nomes de colunas:
                        </p>

                        <button 
                            onClick={downloadSample}
                            style={{ 
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem', 
                                padding: '0.75rem', 
                                background: 'white', 
                                border: '1px solid #3b82f6', 
                                color: '#3b82f6', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                marginBottom: '1.5rem'
                            }}
                        >
                            <Download size={16} /> Baixar Modelo (.xlsx)
                        </button>

                        <div style={{ fontSize: '0.85rem' }}>
                             <div style={{ marginBottom: '1rem' }}>
                                <strong style={{ color: '#1e293b' }}>Opcionais por linha:</strong>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0.5rem 0' }}>Se presentes, substituem as configurações da calculadora.</p>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                    {['imposto', 'ads', 'despesa fixa', 'outras despesas', 'cupom'].map(tag => (
                                        <code key={tag} style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.7rem' }}>{tag}</code>
                                    ))}
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: '1rem' }}>
                                <strong style={{ color: '#1e293b' }}>Para Lucratividade:</strong>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                    <code style={{ background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>preco</code>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <strong style={{ color: '#1e293b' }}>Para Preço Ideal:</strong>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                    <code style={{ background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>margem</code>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '8px', fontSize: '0.85rem', color: '#1e40af' }}>
                            🔥 <strong>Configurações Ativas:</strong> O cálculo usará seu imposto de <strong>{settings.impostoPorcentagem}%</strong>, ADS de <strong>{settings.adsValor}{settings.adsTipo === 'porcentagem' ? '%' : 'R$'}</strong> e demais taxas salvas na calculadora.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopeeLotePage;
