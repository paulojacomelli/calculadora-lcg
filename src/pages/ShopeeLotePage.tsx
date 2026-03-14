import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, ArrowLeft, CheckCircle2, Info, TrendingUp, Sparkles, Zap } from 'lucide-react';
import Papa from 'papaparse';
import { Link } from 'react-router-dom';
import type { ShopeeInput } from '../utils/shopeeLogic';
import { calcularTaxasShopee, calcularPrecoIdealDetalhado } from '../utils/shopeeLogic';

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
        for (const col of possíveisColunas) {
            if (row[col] !== undefined && row[col] !== null && row[col].toString().trim() !== '') {
                const valStr = row[col].toString().replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
                const valNum = parseFloat(valStr);
                if (!isNaN(valNum)) return valNum;
            }
        }
        return undefined;
    };

    const processFile = () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rows = results.data as any[];
                    const output = rows.map((row) => {
                        const sku = row.sku || row.SKU || row.id || row.ID || row.item || '';
                        const custoProduto = extrairValor(row, ['custo_produto', 'custo', 'Custo', 'Custo Produto', 'CDP']);
                        const precoVendaCampo = extrairValor(row, ['preco_venda', 'preco', 'Preço', 'Preco Venda', 'PA']);
                        const margemDesejadaCampo = extrairValor(row, ['margem_desejada', 'margem', 'Margem', 'Margem Desejada']);

                        let outRow: any = { ...row, SKU_REF: sku, CUSTO_BASE: custoProduto };

                        if (custoProduto === undefined) {
                            outRow['ERRO_STATUS'] = 'Custo não encontrado';
                            return outRow;
                        }

                        if (operationType === 'margem') {
                            if (precoVendaCampo === undefined) {
                                outRow['ERRO_STATUS'] = 'Preço de venda não encontrado';
                                return outRow;
                            }
                            const inputsComLinha: ShopeeInput = { ...settings, custoProduto, precoVenda: precoVendaCampo };
                            const res = calcularTaxasShopee(inputsComLinha, true);

                            outRow['PRECO_VITRINE'] = precoVendaCampo;
                            outRow['PRECO_PDV_FINAL'] = res.precoVenda;
                            outRow['LUCRO_REAIS'] = res.lucroLiquido.toFixed(2).replace('.', ',');
                            outRow['MARGEM_CONTRIB_PCT'] = res.margemSobreVenda.toFixed(2).replace('.', ',');
                            outRow['TAXAS_TOTAL'] = (res.comissaoValor + res.tarifaFixa).toFixed(2).replace('.', ',');
                            outRow['STATUS'] = 'Processado com Sucesso';
                        } else {
                            const margemAlvo = margemDesejadaCampo !== undefined ? margemDesejadaCampo : 15;
                            const inputsComLinha: ShopeeInput = { ...settings, custoProduto };
                            const otimizacao = calcularPrecoIdealDetalhado(inputsComLinha, margemAlvo, 'venda');
                            
                            outRow['MARGEM_ALVO_PCT'] = margemAlvo;
                            outRow['PRECO_BASE_SUGERIDO'] = otimizacao.precoOriginal.toFixed(2).replace('.', ',');
                            outRow['PRECO_OTIMIZADO_SENSOR'] = otimizacao.precoOtimizado.toFixed(2).replace('.', ',');
                            outRow['LUCRO_FINAL'] = otimizacao.lucroOtimizado.toFixed(2).replace('.', ',');
                            outRow['TIPO_ESTRATEGIA'] = otimizacao.isAlavancagem ? 'GIRO/ALAVANCAGEM' : 'OTIMIZACÃO PURA';
                            outRow['STATUS'] = 'Processado com Sucesso';
                        }

                        return outRow;
                    });

                    setProcessedData(output);
                    setIsProcessing(false);
                } catch (err: any) {
                    setError('Erro interno no processamento: ' + err.message);
                    setIsProcessing(false);
                }
            },
            error: (err) => {
                setError('Erro ao ler arquivo CSV: ' + err.message);
                setIsProcessing(false);
            }
        });
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
                                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Arraste seu CSV aqui</h4>
                                    <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Ou clique para selecionar em seu computador</p>
                                    <input 
                                        type="file" 
                                        accept=".csv, .txt" 
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    <div className="btn-primary" style={{ display: 'inline-flex', marginTop: '1rem' }}>Selecionar Arquivo</div>
                                </label>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        {processedData.length > 0 ? (
                            <button className="btn-primary" onClick={downloadResults} style={{ background: '#10b981', borderColor: '#10b981', padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
                                <Download size={20} /> Baixar Planilha Final ({processedData.length} itens)
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
                        <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                            Seu arquivo deve ser um <strong>CSV</strong> (separado por vírgula ou ponto-e-vírgula) e conter os seguintes nomes de colunas:
                        </p>

                        <div style={{ fontSize: '0.85rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <strong style={{ color: '#1e293b' }}>Obrigatório em todos:</strong>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                    <code style={{ background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>custo</code>
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
