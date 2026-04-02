import React, { useState, useEffect } from 'react';
import {
    Download, AlertCircle, ArrowLeft,
    CheckCircle2, Info, TrendingUp, Zap,
    Database, Target, Percent, DollarSign, LayoutGrid,
    RefreshCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ShopeeInput } from '../utils/shopeeLogic';
import { calcularPrecoIdealDetalhado, calcularTaxasShopee } from '../utils/shopeeLogic';
import { getUserCatalog } from '../services/catalogService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

// Estilos globais para tooltips
const tooltipStyles = `
    .tooltip-container {
        position: relative;
        cursor: help;
    }
    .tooltip-box {
        position: absolute;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-size: 0.75rem;
        width: 220px;
        line-height: 1.4;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 100;
        text-align: left;
        pointer-events: none;
    }
    .tooltip-container:hover .tooltip-box {
        opacity: 1;
        visibility: visible;
        bottom: 140%;
    }
    .tooltip-box::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #1e293b;
    }
`;

const ShopeeLotePage: React.FC = () => {
    const { user, userLevel } = useAuth();

    // Injetar estilos
    React.useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = tooltipStyles;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);
    // Helpers de persistência por sessão (sessionStorage expira ao fechar a aba)
    const SESSION_KEY = 'shopeeLote_session';
    const loadSession = <T,>(key: string, fallback: T): T => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed[key] !== undefined ? parsed[key] : fallback;
        } catch { return fallback; }
    };
    const saveSession = (patch: Record<string, unknown>) => {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            const existing = raw ? JSON.parse(raw) : {};
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...patch }));
        } catch { }
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [processedData, setProcessedData] = useState<any[]>(() => loadSession('processedData', []));
    const [catalog, setCatalog] = useState<any[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [lotePage, setLotePage] = useState(1); // Página atual da tabela de resultados

    // Configurações Globais e do Lote
    const [targetType, setTargetType] = useState<'venda' | 'custo' | 'reais'>(() => loadSession('targetType', 'custo' as 'venda' | 'custo' | 'reais'));
    const [targetValue, setTargetValue] = useState<number | undefined>(() => loadSession('targetValue', undefined));
    const [activeWarehouse, setActiveWarehouse] = useState<'SP' | 'SC'>(() => loadSession('activeWarehouse', 'SP' as 'SP' | 'SC'));

    const [useCatalog, setUseCatalog] = useState(() => loadSession('useCatalog', {
        imposto: true,
        ads: true,
        fixa: true,
        adicional: true,
        cupom: false, // Cupom não existe no catálogo, forçar global
        rebate: true  // Rebate usa catálogo por padrão
    }));

    const [filters, setFilters] = useState({
        search: '',
        minCusto: undefined as number | undefined,
        maxCusto: undefined as number | undefined,
        rangeStart: undefined as number | undefined,
        rangeEnd: undefined as number | undefined,
    });

    const [globalVals, setGlobalVals] = useState<ShopeeInput>(() => loadSession('globalVals', {
        despesaFixa: 0,
        despesaFixaTipo: 'porcentagem',
        despesaAdicional: 0,
        despesaAdicionalTipo: 'porcentagem',
        impostoPorcentagem: 6.5,
        impostoTipo: 'porcentagem',
        adsValor: 1,
        adsTipo: 'porcentagem',
        rebatePorcentagem: undefined,
        rebateTipo: 'porcentagem',
        cupomDesconto: undefined,
        cupomTipo: 'porcentagem',
        fatorAlavancagem: undefined,
        fatorAlavancagemAtivo: true,
    }));

    // Persistir configurações e resultados no sessionStorage ao mudar
    useEffect(() => { saveSession({ processedData }); }, [processedData]);
    useEffect(() => { saveSession({ globalVals }); }, [globalVals]);
    useEffect(() => { saveSession({ targetType, targetValue, activeWarehouse, useCatalog }); }, [targetType, targetValue, activeWarehouse, useCatalog]);


    const handleGlobalChange = (field: keyof ShopeeInput, value: any) => {
        setGlobalVals(prev => ({ ...prev, [field]: value }));
    };

    // Carregar catálogo ao carregar a página ou mudar o armazém
    React.useEffect(() => {
        const load = async () => {
            if (!user) return;
            setIsLoadingCatalog(true);
            try {
                const prods = await getUserCatalog(user.uid, activeWarehouse);
                setCatalog(prods);
            } catch (err) {
                console.error("Erro ao carregar catálogo:", err);
            } finally {
                setIsLoadingCatalog(false);
            }
        };
        load();
    }, [user, activeWarehouse]);

    const getFilteredProducts = () => {
        let prods = [...catalog];

        // 1. Filtros de busca e custo
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            prods = prods.filter(p =>
                p.sku?.toLowerCase().includes(searchLower) ||
                p.descricao?.toLowerCase().includes(searchLower)
            );
        }
        if (filters.minCusto !== undefined) {
            prods = prods.filter(p => p.custoCDP >= filters.minCusto!);
        }
        if (filters.maxCusto !== undefined) {
            prods = prods.filter(p => p.custoCDP <= filters.maxCusto!);
        }

        // 2. Filtro de faixa (índice)
        const start = (filters.rangeStart || 1) - 1;
        const end = filters.rangeEnd || prods.length;

        return prods.slice(start, end);
    };

    const filteredCount = getFilteredProducts().length;

    const runBulkCalculation = async () => {
        if (!user) return;

        if (targetValue === undefined || targetValue === null) {
            setError("O 'Valor do Alvo' é obrigatório para iniciar o cálculo.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress(0);
        setProcessedCount(0);
        setProcessedData([]);

        try {
            const products = getFilteredProducts();

            if (products.length === 0) {
                setError(`Nenhum produto encontrado com os filtros aplicados no catálogo ${activeWarehouse}.`);
                setIsProcessing(false);
                return;
            }

            setTotalCount(products.length);
            const results: any[] = [];
            const fallbackAlavancagem = globalVals.fatorAlavancagem ?? 5.0; // Aplica o 5.0 se estiver vazio

            // Processamento em pequenos lotes para não travar a UI e mostrar progresso
            for (let i = 0; i < products.length; i++) {
                const prod = products[i];

                // Montar o input para este produto
                const input: ShopeeInput = {
                    custoProduto: prod.custoCDP,
                    // Usar do catalogo ou global
                    impostoPorcentagem: useCatalog.imposto ? prod.impostosIMP : globalVals.impostoPorcentagem,
                    impostoTipo: globalVals.impostoTipo,
                    adsValor: useCatalog.ads ? prod.adsADS : globalVals.adsValor,
                    adsTipo: globalVals.adsTipo,
                    despesaFixa: useCatalog.fixa ? prod.despesaFixaDF : globalVals.despesaFixa,
                    despesaFixaTipo: globalVals.despesaFixaTipo,
                    despesaAdicional: useCatalog.adicional ? prod.outrasDespesasOD : globalVals.despesaAdicional,
                    despesaAdicionalTipo: globalVals.despesaAdicionalTipo,
                    rebatePorcentagem: useCatalog.rebate ? prod.rebateCR : globalVals.rebatePorcentagem,
                    rebateTipo: globalVals.rebateTipo,
                    cupomDesconto: useCatalog.cupom ? (prod.cupomCP || 0) : globalVals.cupomDesconto,
                    cupomTipo: globalVals.cupomTipo,
                    fatorAlavancagem: fallbackAlavancagem,
                    fatorAlavancagemAtivo: globalVals.fatorAlavancagemAtivo
                };

                // Executar Preço Ideal
                const res = calcularPrecoIdealDetalhado(input, targetValue, targetType);

                // Para pegar o PDV (Preço de Venda líquido após cupom) do preço de anúncio otimizado
                const taxasIdeal = calcularTaxasShopee({ ...input, precoVenda: res.precoOtimizado }, true);

                // Determinar Tags de Otimização
                let tag = '';
                if (res.isAlavancagem) {
                    tag = 'Estratégia de giro';
                } else if (res.isOtimizado) {
                    tag = 'Sensor de otimização';
                }

                results.push({
                    SKU: prod.sku,
                    Produto: prod.descricao,
                    Custo: prod.custoCDP,
                    Cupom: input.cupomDesconto,
                    Rebate: input.rebatePorcentagem,
                    'Preço de Anúncio': res.precoOtimizado,
                    'Preço de Venda': taxasIdeal.precoVenda,
                    Lucro: res.lucroOtimizado,
                    Análise: tag,
                    // Dados para tooltip dinâmico
                    isOtimizado: res.isOtimizado,
                    isAlavancagem: res.isAlavancagem,
                    quedaPreco: res.quedaPreco,
                    quedaLucro: res.quedaLucro,
                    fatorAlavancagem: res.fatorAlavancagem,
                    esforcoPercentual: res.esforcoPercentual,
                    // Campos extras para controle interno/exportação
                    'PA Original': res.precoOriginal,
                    'Lucro Original': res.lucroOriginal
                });

                // Atualizar progresso a cada 5 itens ou no final
                if (i % 5 === 0 || i === products.length - 1) {
                    setProcessedCount(i + 1);
                    setProgress(Math.round(((i + 1) / products.length) * 100));
                    // Pequena pausa para a UI respirar e o modal animar
                    await new Promise(r => setTimeout(r, 5));
                }
            }

            setProcessedData(results);
            setIsProcessing(false);
        } catch (err: any) {
            setError('Erro no processamento: ' + err.message);
            setIsProcessing(false);
        }
    };

    const downloadResults = () => {
        if (processedData.length === 0) return;
        // Criar uma cópia formatada para o Excel se necessário, 
        // mas aqui vamos baixar os dados brutos para o usuário manipular.
        const worksheet = XLSX.utils.json_to_sheet(processedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Otimização Shopee");
        XLSX.writeFile(workbook, `shopee_bulk_${activeWarehouse}_${Date.now()}.xlsx`);
    };

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
            {/* Header */}
            <div className="header" style={{ textAlign: 'left', marginBottom: '3rem' }}>
                <Link to="/shopee" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '1rem', fontWeight: 600 }}>
                    <ArrowLeft size={18} /> Voltar para Calculadora Individual
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#eff6ff', color: '#3b82f6', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={30} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '2rem', margin: 0 }}>Cálculo em Massa (Catálogo)</h1>
                        <p style={{ color: '#64748b', margin: 0 }}>Otimização automática baseada no seu catálogo de produtos.</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
                <div className="card" style={{ padding: '2rem' }}>
                    {/* 1. Objetivo */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                            <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
                            Objetivo do Cálculo
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                            {[
                                { id: 'custo', label: 'Margem sobre Custo', icon: <TrendingUp size={20} /> },
                                { id: 'venda', label: 'Margem sobre Venda', icon: <Percent size={20} /> },
                                { id: 'reais', label: 'Lucro desejado', icon: <DollarSign size={20} /> },
                            ].map((opt) => (
                                <div
                                    key={opt.id}
                                    onClick={() => setTargetType(opt.id as any)}
                                    style={{
                                        padding: '1.25rem 0.75rem',
                                        borderRadius: '12px',
                                        border: `2px solid ${targetType === opt.id ? '#3b82f6' : '#e2e8f0'}`,
                                        background: targetType === opt.id ? '#f0f7ff' : 'white',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        minHeight: '110px'
                                    }}
                                >
                                    <div style={{ color: targetType === opt.id ? '#3b82f6' : '#94a3b8' }}>{opt.icon}</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: targetType === opt.id ? '#1e40af' : '#475569', lineHeight: '1.2' }}>{opt.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="input-group">
                            <label>Valor do Alvo ({targetType === 'reais' ? 'R$' : '%'})</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    value={targetValue ?? ''}
                                    onChange={(e) => setTargetValue(e.target.value === '' ? undefined : Number(e.target.value))}
                                    className="input-field"
                                    placeholder="Ex: 15"
                                />
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                    {targetType === 'reais' ? <DollarSign size={18} /> : <Target size={18} />}
                                </div>
                            </div>
                        </div>

                        {/* Novos campos de Cupom e Rebate na Seção 1 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            {/* Cupom: Apenas Global conforme solicitado */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Cupom Desconto</label>
                                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '1px', borderRadius: '4px' }}>
                                        <button
                                            onClick={() => handleGlobalChange('cupomTipo', 'porcentagem')}
                                            style={{ padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', background: globalVals.cupomTipo === 'porcentagem' ? 'white' : 'transparent', color: globalVals.cupomTipo === 'porcentagem' ? '#3b82f6' : '#64748b', border: 'none', cursor: 'pointer' }}
                                        >
                                            %
                                        </button>
                                        <button
                                            onClick={() => handleGlobalChange('cupomTipo', 'fixo')}
                                            style={{ padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', background: globalVals.cupomTipo === 'fixo' ? 'white' : 'transparent', color: globalVals.cupomTipo === 'fixo' ? '#3b82f6' : '#64748b', border: 'none', cursor: 'pointer' }}
                                        >
                                            R$
                                        </button>
                                    </div>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem', height: '36px', paddingRight: '1.5rem' }}
                                        value={globalVals.cupomDesconto as number ?? ''}
                                        onChange={(e) => handleGlobalChange('cupomDesconto', e.target.value === '' ? undefined : Number(e.target.value))}
                                        placeholder="Valor..."
                                    />
                                    <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                                        {globalVals.cupomTipo === 'porcentagem' ? '%' : 'R$'}
                                    </div>
                                </div>
                            </div>

                            {/* Rebate: Flexível (Catálogo ou Global) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Crédito Rebate (CR)</label>
                                        <div
                                            onClick={() => setUseCatalog(p => ({ ...p, rebate: !p.rebate }))}
                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', color: useCatalog.rebate ? '#10b981' : '#64748b', fontWeight: 700 }}
                                        >
                                            {useCatalog.rebate ? <><Database size={10} /> Catálogo</> : <><LayoutGrid size={10} /> Global</>}
                                        </div>
                                    </div>
                                    {!useCatalog.rebate && (
                                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '1px', borderRadius: '4px' }}>
                                            <button
                                                onClick={() => handleGlobalChange('rebateTipo', 'porcentagem')}
                                                style={{ padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', background: globalVals.rebateTipo === 'porcentagem' ? 'white' : 'transparent', color: globalVals.rebateTipo === 'porcentagem' ? '#3b82f6' : '#64748b', border: 'none', cursor: 'pointer' }}
                                            >
                                                %
                                            </button>
                                            <button
                                                onClick={() => handleGlobalChange('rebateTipo', 'fixo')}
                                                style={{ padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, borderRadius: '3px', background: globalVals.rebateTipo === 'fixo' ? 'white' : 'transparent', color: globalVals.rebateTipo === 'fixo' ? '#3b82f6' : '#64748b', border: 'none', cursor: 'pointer' }}
                                            >
                                                R$
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {useCatalog.rebate ? (
                                    <div style={{ height: '36px', display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                                        Usando do catálogo
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem', height: '36px', paddingRight: '1.5rem' }}
                                            value={globalVals.rebatePorcentagem as number ?? ''}
                                            onChange={(e) => handleGlobalChange('rebatePorcentagem', e.target.value === '' ? undefined : Number(e.target.value))}
                                            placeholder="Valor..."
                                        />
                                        <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                                            {globalVals.rebateTipo === 'porcentagem' ? '%' : 'R$'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Filtros de Seleção */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                            <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>2</span>
                            Filtros de Seleção (Opcional)
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Buscar SKU ou Nome</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Deixe vazio para todos..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Custo Min</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="R$ 0,00"
                                    value={filters.minCusto ?? ''}
                                    onChange={(e) => setFilters(prev => ({ ...prev, minCusto: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Custo Max</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="R$ 1.000..."
                                    value={filters.maxCusto ?? ''}
                                    onChange={(e) => setFilters(prev => ({ ...prev, maxCusto: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                />
                            </div>
                        </div>

                        {/* Seleção de Faixa de Itens */}
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Faixa de Processamento (Índices)
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>De (Item nº)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="Ex: 1"
                                        value={filters.rangeStart ?? ''}
                                        onChange={(e) => setFilters(prev => ({ ...prev, rangeStart: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Até (Item nº)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="Ex: 100"
                                        value={filters.rangeEnd ?? ''}
                                        onChange={(e) => setFilters(prev => ({ ...prev, rangeEnd: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contador em tempo real */}
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369a1', fontSize: '0.9rem' }}>
                            <Info size={16} />
                            {isLoadingCatalog ? (
                                <span>Carregando catálogo...</span>
                            ) : (
                                <span><strong>{filteredCount}</strong> produtos selecionados para o cálculo.</span>
                            )}
                        </div>
                    </div>

                    {/* 3. Vínculo ao Catálogo */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                            <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>3</span>
                            Vincular Dados do Catálogo
                        </h3>

                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                {[
                                    { id: 'imposto', label: 'Impostos', key: 'impostoPorcentagem' },
                                    { id: 'ads', label: 'Ads (%)', key: 'adsValor' },
                                    { id: 'fixa', label: 'Despesa Fixa', key: 'despesaFixa' },
                                    { id: 'adicional', label: 'Outras Despesas', key: 'despesaAdicional' },
                                ].map((field) => (
                                    <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{field.label}</label>
                                            <div
                                                onClick={() => setUseCatalog(p => ({ ...p, [field.id]: !p[field.id as keyof typeof useCatalog] }))}
                                                style={{
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    fontSize: '0.75rem',
                                                    color: useCatalog[field.id as keyof typeof useCatalog] ? '#10b981' : '#64748b',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {useCatalog[field.id as keyof typeof useCatalog] ? (
                                                    <><Database size={14} /> Do Catálogo</>
                                                ) : (
                                                    <><LayoutGrid size={14} /> Global</>
                                                )}
                                            </div>
                                        </div>
                                        {!useCatalog[field.id as keyof typeof useCatalog] && (
                                            <input
                                                type="number"
                                                className="input-field"
                                                style={{ padding: '0.5rem 0.8rem', fontSize: '0.9rem' }}
                                                value={globalVals[field.key as keyof ShopeeInput] as number ?? ''}
                                                onChange={(e) => handleGlobalChange(field.key as keyof ShopeeInput, Number(e.target.value))}
                                                placeholder="Valor global..."
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4. Configurações Avançadas (Restrito para Nível 3) */}
                    {userLevel < 3 && (
                        <div style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                                <span style={{ background: '#3b82f6', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>4</span>
                                Configurações Avançadas
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="input-group">
                                    <label>Fator de Alavancagem</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={globalVals.fatorAlavancagem ?? ''}
                                        onChange={(e) => handleGlobalChange('fatorAlavancagem', e.target.value === '' ? undefined : Number(e.target.value))}
                                        placeholder="5.0"
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Padrão: 5.0 (Cálculo sugerido para escala)</span>
                                </div>
                                <div className="input-group">
                                    <label>Estoque para Cálculo</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {['SP', 'SC'].map(wh => (
                                            <button
                                                key={wh}
                                                onClick={() => setActiveWarehouse(wh as any)}
                                                className={activeWarehouse === wh ? 'btn-primary' : 'btn-outline'}
                                                style={{ flex: 1, padding: '0.6rem' }}
                                            >
                                                Estoque {wh}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        {processedData.length > 0 && !isProcessing && (
                            <button className="btn-outline" onClick={() => setProcessedData([])} style={{ gap: '0.5rem' }}>
                                <RefreshCcw size={18} /> Novo Cálculo
                            </button>
                        )}
                        <button
                            className="btn-primary"
                            onClick={runBulkCalculation}
                            disabled={isProcessing}
                            style={{
                                padding: '1rem 3rem',
                                fontSize: '1.1rem',
                                background: '#ee4d2d',
                                borderColor: '#ee4d2d',
                                boxShadow: '0 4px 14px rgba(238, 77, 45, 0.4)'
                            }}
                        >
                            <Zap size={20} fill="currentColor" /> INICIAR CÁLCULO
                        </button>
                    </div>

                    {error && (
                        <div style={{ marginTop: '1.5rem', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Sidebar Info */}
                <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info size={18} /> Como Funciona?
                        </h4>
                        <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                            <p style={{ marginBottom: '0.75rem' }}>
                                Esta ferramenta processa seu <strong>Catálogo Shopee</strong> inteiro em segundos, aplicando a inteligência de <strong>Preço Ideal</strong> para cada item.
                            </p>
                            <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
                                <li><strong>Preço Ideal:</strong> Encontra automaticamente o menor preço que maximize as chances de venda mantendo seu lucro.</li>
                                <li><strong>Otimização:</strong> Identifica degraus de taxas que permitem abaixar o preço sem perder lucro.</li>
                                <li><strong>Giro:</strong> Sugere preços agressivos para escala total.</li>
                            </ul>
                        </div>
                    </div>

                    {processedData.length > 0 && (
                        <div className="card" style={{ padding: '1.5rem', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534' }}>
                                <CheckCircle2 size={18} /> Resultados Prontos
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '1.5rem' }}>
                                Foram processados <strong>{processedData.length}</strong> produtos com sucesso.
                            </p>
                            <button
                                className="btn-primary"
                                onClick={downloadResults}
                                style={{ width: '100%', background: '#10b981', borderColor: '#10b981' }}
                            >
                                <Download size={18} /> BAIXAR PLANILHA (XLSX)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabela de Resultados */}
            {processedData.length > 0 && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '3rem' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <LayoutGrid size={22} color="#3b82f6" /> Prévia do Cálculo em Massa
                        </h3>
                    </div>

                    <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'visible' }}>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b' }}>SKU</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#64748b' }}>Produto</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b' }}>Custo</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Cupom</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Rebate</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Preço de Anúncio</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Preço de Venda</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#64748b' }}>Lucro</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#64748b', minWidth: '160px' }}>Análise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    // Paginação: 20 itens por página
                                    const ITEMS_PER_PAGE = 20;
                                    const pageData = processedData.slice((lotePage - 1) * ITEMS_PER_PAGE, lotePage * ITEMS_PER_PAGE);
                                    return pageData;
                                })().map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1rem', fontWeight: 700 }}>{row.SKU}</td>
                                        <td style={{ padding: '1rem', color: '#64748b', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.Produto}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            R$ {row.Custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                            {row.Cupom > 0 ? `R$ ${row.Cupom.toFixed(2).replace('.', ',')}` : '-'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                            {row.Rebate > 0 ? `${row.Rebate}%` : '-'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' }}>
                                                R$ {row['Preço de Anúncio'].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#f97316' }}>
                                            R$ {row['Preço de Venda']?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                            R$ {row.Lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {row.Análise ? (
                                                <div className="tooltip-container" style={{ display: 'inline-block' }}>
                                                    <span style={{
                                                        padding: '0.35rem 0.85rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 800,
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-block',
                                                        background: row.Análise === 'Estratégia de giro' ? '#ede9fe' : '#dcfce7',
                                                        color: row.Análise === 'Estratégia de giro' ? '#7c3aed' : '#15803d',
                                                        border: `1px solid ${row.Análise === 'Estratégia de giro' ? '#ddd6fe' : '#bbf7d0'}`
                                                    }}>
                                                        {row.Análise}
                                                    </span>
                                                    <div className="tooltip-box" style={{ width: '280px' }}>
                                                        {row.isAlavancagem ? (
                                                            <>
                                                                <div style={{ fontWeight: 800, marginBottom: '0.4rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <RefreshCcw size={14} /> Estratégia de Giro
                                                                </div>
                                                                O sistema reduziu o preço em <strong>R$ {row.quedaPreco?.toFixed(2)}</strong> para ganhar competitividade massiva.
                                                                A perda de lucro foi de apenas R$ {row.quedaLucro?.toFixed(2)}, mas sua visibilidade aumenta drasticamente.
                                                                <div style={{ marginTop: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa' }}>
                                                                    Alavancagem: <strong>{row.fatorAlavancagem?.toFixed(1)}x</strong>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div style={{ fontWeight: 800, marginBottom: '0.4rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <Zap size={14} /> Sensor de Otimização
                                                                </div>
                                                                Identificamos que ao reduzir o preço, o produto entra em uma faixa de comissão/taxa menor da Shopee.
                                                                Isso permite vender mais barato mantendo (ou até aumentando) o lucro por venda.
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="tooltip-container" style={{ display: 'inline-block' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Sem otimização</span>
                                                    <div className="tooltip-box">
                                                        <strong>Sem mudanças:</strong><br />
                                                        O preço original já é o ideal para o seu alvo ou os custos não permitiram ajuste seguro.
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Controles de Paginação */}
                    {(() => {
                        const ITEMS_PER_PAGE = 20;
                        const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
                        if (totalPages <= 1) return null;
                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0.5rem 0' }}>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Exibindo {(lotePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(lotePage * ITEMS_PER_PAGE, processedData.length)} de {processedData.length} produtos
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        onClick={() => setLotePage(p => Math.max(1, p - 1))}
                                        disabled={lotePage === 1}
                                        style={{ padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: lotePage === 1 ? '#f8fafc' : '#fff', color: lotePage === 1 ? '#cbd5e1' : '#1e293b', cursor: lotePage === 1 ? 'default' : 'pointer', fontWeight: 600 }}
                                    >
                                        ← Anterior
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setLotePage(page)}
                                            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid', borderColor: page === lotePage ? '#3b82f6' : '#e2e8f0', background: page === lotePage ? '#3b82f6' : '#fff', color: page === lotePage ? '#fff' : '#1e293b', cursor: 'pointer', fontWeight: 700, minWidth: '36px' }}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setLotePage(p => Math.min(totalPages, p + 1))}
                                        disabled={lotePage === totalPages}
                                        style={{ padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: lotePage === totalPages ? '#f8fafc' : '#fff', color: lotePage === totalPages ? '#cbd5e1' : '#1e293b', cursor: lotePage === totalPages ? 'default' : 'pointer', fontWeight: 600 }}
                                    >
                                        Próxima →
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                </>
            )}

            {/* Modal de Carregamento Progressivo */}
            {isProcessing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div className="card" style={{ width: '450px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 2rem' }}>
                            <div style={{
                                position: 'absolute', width: '100%', height: '100%',
                                border: '4px solid #f1f5f9', borderRadius: '50%'
                            }}></div>
                            <div style={{
                                position: 'absolute', width: '100%', height: '100%',
                                border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%',
                                animation: 'spin 1.5s linear infinite'
                            }}></div>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#3b82f6' }}>
                                <RefreshCcw size={32} />
                            </div>
                        </div>

                        <h2 style={{ margin: '0 0 0.5rem 0' }}>Processando Lote</h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Otimizando preços do estoque <strong>{activeWarehouse}</strong>...</p>

                        <div style={{ marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                <span>{processedCount} / {totalCount} Produtos</span>
                                <span>{progress}%</span>
                            </div>
                            <div style={{ background: '#f1f5f9', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                                <div style={{
                                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                    width: `${progress}%`,
                                    height: '100%',
                                    transition: 'width 0.3s ease'
                                }}></div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                            Por favor, aguarde a conclusão. Não feche esta aba.
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .tooltip-container { position: relative; display: inline-block; cursor: help; }
                .tooltip-box { 
                    display: none; position: absolute; bottom: 125%; right: 0; 
                    width: 300px; padding: 1.25rem; background: #1e293b; color: #f8fafc; border-radius: 12px;
                    font-size: 0.8rem; line-height: 1.5; z-index: 9999; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.1); text-align: left;
                    pointer-events: none;
                }
                .tooltip-container:hover .tooltip-box { display: block; }
                .tooltip-box::after { 
                    content: ""; position: absolute; top: 100%; right: 20px; 
                    border-width: 8px; border-style: solid; border-color: #1e293b transparent transparent transparent; 
                }
            `}</style>
        </div>
    );
};

export default ShopeeLotePage;
