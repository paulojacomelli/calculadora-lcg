import React, { useState, useEffect } from 'react';
import { 
    Calculator,
    CircleDollarSign,
    AlertCircle,
    AlertTriangle,
    RotateCcw,
    Sparkles,
    TrendingUp,
    CheckCircle2,
    Truck,
    Package,
    Search,
    X,
    Plus,
    RefreshCcw,
    Info,
    Lock,
    Scale,
    MousePointer2,
    Zap,
    Award,
    Minimize2,
    Maximize2,
    ShoppingCart,
    HelpCircle
} from 'lucide-react';

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    ComposedChart,
    Area,
    Line,
    ReferenceLine
} from 'recharts';

import type { MeliInput, MeliOutput, ResultadoSimulacaoMeli, TipoAnuncio, OtimizacaoPrecoResult, CenarioPrecoMeli } from '../utils/meliLogic';
import { calcularTaxasMeli, calcularPrecoIdealMeli, simularCenariosPrecoMeli, arredondar, calcularPrecoIdealMeliDetalhado } from '../utils/meliLogic';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logCalculo, auth, db } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getUserCatalog } from '../services/catalogService';

const defaultInputs: MeliInput = {
    custoProduto: undefined,
    precoVenda: undefined,
    tipoAnuncio: 'classico',
    comissaoPorcentagem: 12,
    freteGratis: undefined,
    pesoKg: '0.3',
    custoEmbalagem: undefined,
    despesaFixa: undefined,
    despesaFixaTipo: 'porcentagem',
    despesaAdicional: undefined,
    despesaAdicionalTipo: 'porcentagem',
    impostoPorcentagem: undefined,
    impostoTipo: 'porcentagem',
    adsValor: undefined,
    adsTipo: 'roas'
};

const MeliPage: React.FC = () => {
    const [aba, setAba] = useState<'margem' | 'ideal'>(() => {
        return (localStorage.getItem('@meliPCC:aba') as 'margem' | 'ideal') || 'ideal';
    });

    const [tipoMargemIdeal] = useState<'venda' | 'custo'>(() => {
        return (localStorage.getItem('@meliPCC:tipoMargemIdeal') as 'venda' | 'custo') || 'venda';
    });

    const [compararTipos, setCompararTipos] = useState<boolean>(() => {
        return localStorage.getItem('@meliPCC:compararTipos') === 'true';
    });

    const [inputs, setInputs] = useState<MeliInput>(() => {
        const saved = localStorage.getItem('@meliPCC:inputs');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.keys(parsed).forEach(key => {
                    if (!key.endsWith('Tipo') && key !== 'tipoAnuncio' && key !== 'pesoKg' && typeof parsed[key] === 'string') {
                        const val = parseFloat(parsed[key].replace(',', '.'));
                        parsed[key] = isNaN(val) ? undefined : val;
                    }
                });
                return parsed;
            } catch (e) {
                return defaultInputs;
            }
        }
        return defaultInputs;
    });

    const [margemDesejada, setMargemDesejada] = useState<number | undefined>(() => {
        const saved = localStorage.getItem('@meliPCC:margemDesejada');
        if (saved) {
            const val = parseFloat(String(saved).replace(',', '.'));
            return isNaN(val) ? undefined : val;
        }
        return undefined;
    });

    const [isAutoCalcMode, setIsAutoCalcMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('@meliPCC:isAutoCalcMode');
        return saved === 'true';
    });

    const [results, setResults] = useState<MeliOutput | null>(null);
    const [resultsAlt, setResultsAlt] = useState<MeliOutput | null>(null);
    const [simulacao, setSimulacao] = useState<ResultadoSimulacaoMeli | null>(null);
    const [otimizacaoIdeal, setOtimizacaoIdeal] = useState<OtimizacaoPrecoResult | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    
    // Estados para gráficos e tela cheia (paridade Shopee)
    const [isFullscreenStrategy, setIsFullscreenStrategy] = useState(false);
    const [isFullscreenScope, setIsFullscreenScope] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);

    const [statusClass, setStatusClass] = useState('');
    const [statusText, setStatusText] = useState('');
    const [statusIcon, setStatusIcon] = useState<React.ReactNode>(null);

    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [focusedValue, setFocusedValue] = useState<string>('');
    const [user, setUser] = useState<any>(null);

    const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<{sku: string, descricao: string, _wh: string} | null>(null);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const isInitialLoadDone = React.useRef(false);

    // Carregar configurações e catálogo do usuário
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    // Carrega as configurações da Meli do Firestore
                    const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'meli');
                    const userSettingsSnap = await getDoc(userSettingsRef);
                    
                    if (userSettingsSnap.exists()) {
                        const data = userSettingsSnap.data();
                        if (data.aba) setAba(data.aba);
                        if (data.inputs) setInputs(data.inputs);
                        if (data.margemDesejada !== undefined) setMargemDesejada(data.margemDesejada);
                        if (data.compararTipos !== undefined) setCompararTipos(data.compararTipos);
                        if (data.isAutoCalcMode !== undefined) setIsAutoCalcMode(data.isAutoCalcMode);
                        
                        isInitialLoadDone.current = true;
                    }

                    setLoadingCatalog(true);
                    // Carrega o catálogo do Firestore
                    console.log("Meli: Sincronizando catálogo com Firestore...");
                    const [cloudSP, cloudSC] = await Promise.all([
                        getUserCatalog(currentUser.uid, 'SP'),
                        getUserCatalog(currentUser.uid, 'SC')
                    ]);

                    let finalSP = cloudSP;
                    let finalSC = cloudSC;

                    // Se a nuvem estiver vazia, tenta o localStorage (fallback)
                    if (finalSP.length === 0 && finalSC.length === 0) {
                        const localSP = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SP') || '[]');
                        const localSC = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SC') || '[]');
                        finalSP = localSP;
                        finalSC = localSC;
                    }

                    const combined = [
                        ...finalSP.map((p: any) => ({ ...p, _wh: 'SP' })), 
                        ...finalSC.map((p: any) => ({ ...p, _wh: 'SC' }))
                    ];
                    setCatalogProducts(combined);
                    isInitialLoadDone.current = true;
                } catch (error) {
                    console.error("Meli: Erro ao carregar dados do Firestore:", error);
                    // Fallback para localStorage
                    const sp = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SP') || '[]');
                    const sc = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SC') || '[]');
                    const combined = [
                        ...sp.map((p: any) => ({ ...p, _wh: 'SP' })), 
                        ...sc.map((p: any) => ({ ...p, _wh: 'SC' }))
                    ];
                    setCatalogProducts(combined);
                } finally {
                    setLoadingCatalog(false);
                }
            } else {
                setCatalogProducts([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Efeito para salvar dados no Firestore com Debounce
    useEffect(() => {
        if (!user || !isInitialLoadDone.current) return;
        
        const timer = setTimeout(async () => {
            try {
                console.log("Meli: Salvando configurações no Firestore...");
                const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'meli');
                await setDoc(userSettingsRef, {
                    aba,
                    inputs,
                    margemDesejada,
                    compararTipos,
                    isAutoCalcMode,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log("Meli: Salvo com sucesso!");
            } catch (error) {
                console.error("Meli: Erro ao salvar configurações no Firestore:", error);
            }
        }, 5000); 

        return () => clearTimeout(timer);
    }, [inputs, aba, margemDesejada, compararTipos, isAutoCalcMode, user]);

    const getInputValue = (name: string, value: any) => {
        if (focusedInput === name) return focusedValue;
        if (value === undefined || value === null || value === '') return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        return (typeof num === 'number' && !isNaN(num)) ? arredondar(num, 2).toFixed(2).replace('.', ',') : '';
    };

    const s = (key: string) => <span className="tech-abbr">[{key}]</span>;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('@meliPCC:aba', aba);
            localStorage.setItem('@meliPCC:inputs', JSON.stringify(inputs));
            localStorage.setItem('@meliPCC:isAutoCalcMode', String(isAutoCalcMode));
            localStorage.setItem('@meliPCC:compararTipos', String(compararTipos));
            if (margemDesejada !== undefined) {
                localStorage.setItem('@meliPCC:margemDesejada', String(margemDesejada));
            } else {
                localStorage.removeItem('@meliPCC:margemDesejada');
            }
        }
        handleCalcular();
    }, [inputs, aba, margemDesejada, isAutoCalcMode, compararTipos]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (focusedInput === name) setFocusedValue(value);

        let val: any = value;
        const isNotNumeric = name.endsWith('Tipo') || name === 'tipoAnuncio' || name === 'pesoKg';

        if (!isNotNumeric) {
            if (value === '' || value === '-' || value === ',' || value === '.') {
                val = undefined;
            } else {
                val = parseFloat(value.replace(',', '.'));
                if (isNaN(val)) val = undefined;
            }
        }

        if (name === 'margemDesejada') {
            setMargemDesejada(val);
        } else {
            setInputs((prev: MeliInput) => ({
                ...prev,
                [name]: val,
            }));
        }
    };


    const handleCalcular = () => {
        let resultado: MeliOutput;
        let resultadoAlt: MeliOutput | null = null;

        if (aba === 'margem') {
            if (inputs.precoVenda === undefined) {
                setResults(null);
                setResultsAlt(null);
                setSimulacao(null);
                return;
            }
            resultado = calcularTaxasMeli(inputs);
            if (compararTipos) {
                const altTipo: TipoAnuncio = inputs.tipoAnuncio === 'classico' ? 'premium' : 'classico';
                resultadoAlt = calcularTaxasMeli({ ...inputs, tipoAnuncio: altTipo });
            }
        } else {
            if (inputs.custoProduto === undefined) {
                setResults(null);
                setResultsAlt(null);
                setSimulacao(null);
                return;
            }
            const pIdeal = calcularPrecoIdealMeli(inputs, margemDesejada, tipoMargemIdeal);
            resultado = calcularTaxasMeli({ ...inputs, precoVenda: pIdeal });
            if (compararTipos) {
                const altTipo: TipoAnuncio = inputs.tipoAnuncio === 'classico' ? 'premium' : 'classico';
                const pIdealAlt = calcularPrecoIdealMeli({ ...inputs, tipoAnuncio: altTipo }, margemDesejada, tipoMargemIdeal);
                resultadoAlt = calcularTaxasMeli({ ...inputs, tipoAnuncio: altTipo, precoVenda: pIdealAlt });
            }
        }

        const sim = simularCenariosPrecoMeli(inputs, isAutoCalcMode ? resultado.margemSobreVenda : margemDesejada, tipoMargemIdeal);
        const pIdeal15 = calcularPrecoIdealMeli(inputs, 15, tipoMargemIdeal);
        const resIdeal15 = calcularTaxasMeli({ ...inputs, precoVenda: pIdeal15 });

        const simComIdeal = {
            ...sim,
            pAlvo: sim.pontoIdeal,
            pIdeal15: { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.taxaFixa + resIdeal15.freteGratisValor) / (resIdeal15.precoVenda || 1) * 100 }
        };

        const otim = calcularPrecoIdealMeliDetalhado(inputs, isAutoCalcMode ? resultado.margemSobreVenda : margemDesejada, tipoMargemIdeal);
        setOtimizacaoIdeal(otim);

        setSimulacao(simComIdeal as any);
        setResults(resultado);
        setResultsAlt(resultadoAlt);

        const msv = resultado.margemSobreVenda;
        if (msv <= 0) {
            setStatusClass('status-red');
            setStatusText('Cuidado: Prejuízo detectado!');
            setStatusIcon(<AlertCircle size={24} />);
        } else if (msv < 15) {
            setStatusClass('status-orange');
            setStatusText('Atenção: Margem abaixo do ideal (15%)');
            setStatusIcon(<AlertTriangle size={24} />);
        } else {
            setStatusClass('status-green');
            setStatusText('Parabéns: Sua margem está saudável!');
            setStatusIcon(<CheckCircle2 size={24} />);
        }

        logCalculo(resultado.precoVenda, msv, " MELI");
    };

    // Componentes de Gráficos (Paridade Shopee)
    const ComposicaoPrecoChart = ({ res }: { res: MeliOutput }) => {
        const data = [
            { name: 'PDV', Lucro: res.lucroLiquido, Custo: res.custoProdutoValor, Ads: res.custoAds, Operacao: res.despesaFixaValor + res.despesaAdicionalValor + res.custoEmbalagem, Taxas: res.comissaoValor + res.taxaFixa + res.freteGratisValor, fullPreco: `R$ ${res.precoVenda.toFixed(2)}` }
        ];

        return (
            <div className="chart-container" style={{ background: '#fff', padding: '10px' }}>
                <h4 className="chart-title">Composição do Preço de Venda</h4>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            hide 
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: string) => [`R$ ${Number(value).toFixed(2)}`, name]}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }} />
                        <Bar dataKey="Lucro" stackId="a" fill="#10B981" name="Lucro" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Custo" stackId="a" fill="#EF4444" name="Custo" />
                        <Bar dataKey="Ads" stackId="a" fill="#3b82f6" name="Ads" />
                        <Bar dataKey="Operacao" stackId="a" fill="#fbbf24" name="Op." />
                        <Bar dataKey="Taxas" stackId="a" fill="#f97316" name="Taxas" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const EstrategiaPrecoChart = ({ dados, precoAtual, pontoIdeal, pontoAlvo, onPriceSelect, isFullscreen, onToggleFullscreen }: {
        dados: CenarioPrecoMeli[],
        precoAtual: number,
        pontoIdeal: CenarioPrecoMeli,
        pontoAlvo: CenarioPrecoMeli,
        onPriceSelect: (price: number) => void,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        const isAlvoDifferentFromIdeal = Math.abs(pontoAlvo.precoVenda - pontoIdeal.precoVenda) > 0.01;
        
        const precosRelevantes = [precoAtual, pontoIdeal.precoVenda, pontoAlvo.precoVenda];
        const minP = Math.min(...precosRelevantes);
        const maxP = Math.max(...precosRelevantes);
        const diff = maxP - minP;
        const marginX = Math.max(diff * 0.15, 20);
        const domainX = [Math.max(0, minP - marginX), maxP + marginX];

        return (
            <div className={`chart-container ${isFullscreen ? 'fullscreen' : ''}`} style={{ cursor: 'crosshair', background: '#fff' }}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Análise de Lucratividade vs Preço</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "80%" : 280}>
                    <ComposedChart
                        data={dados}
                        margin={{ top: 40, right: 30, left: 0, bottom: 0 }}
                        onClick={(state: any) => {
                            if (state && state.activePayload && state.activePayload.length > 0) {
                                onPriceSelect(state.activePayload[0].payload.precoVenda);
                            }
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="precoVenda"
                            type="number"
                            domain={domainX}
                            tickFormatter={(val) => `R$${Math.round(val)}`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                        />
                        <YAxis
                            yAxisId="left"
                            tickFormatter={(val) => `R$${val}`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#10B981' }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(val) => `${val.toFixed(0)}%`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#f97316' }}
                        />

                        <Tooltip
                            shared={true}
                            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: string) => [
                                String(name).includes('%') ? `${Number(value).toFixed(1)}%` : `R$ ${Number(value).toFixed(2)}`,
                                name
                            ]}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />

                        <Area yAxisId="left" type="monotone" dataKey="lucroLiquido" name="Lucro Líquido (R$)" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                        <Line yAxisId="right" type="monotone" dataKey="pesoTaxas" name="Peso das Taxas (%)" stroke="#f97316" strokeWidth={2} dot={false} />

                        <ReferenceLine yAxisId="left" y={0} stroke="#64748b" strokeWidth={1} />
                        <ReferenceLine x={pontoIdeal.precoVenda} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'top', value: 'IDEAL', fontSize: 10, fill: '#065f46', dy: -20 }} />
                        {isAlvoDifferentFromIdeal && (
                            <ReferenceLine x={pontoAlvo.precoVenda} stroke="#f59e0b" strokeDasharray="5 5" label={{ position: 'top', value: 'ALVO', fontSize: 10, fill: '#b45309', dy: -10 }} />
                        )}
                        <ReferenceLine x={precoAtual} stroke="#3b82f6" strokeWidth={3} label={{ position: 'top', value: 'VOCÊ', fontSize: 11, fill: '#1e40af', fontWeight: 800, dy: -5 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const TaxasPrecoChart = ({ inputs, precoAtual, isFullscreen, onToggleFullscreen }: {
        inputs: MeliInput,
        precoAtual: number,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        const points = [];
        const minX = Math.max(20, (inputs.custoProduto || 0) * 0.5);
        const maxX = Math.max(precoAtual * 1.5, 300);
        const step = (maxX - minX) / 60;

        for (let x = minX; x <= maxX; x += step) {
            const res = calcularTaxasMeli({ ...inputs, precoVenda: x });
            points.push({
                x,
                lucro: res.lucroLiquido,
                taxas: res.comissaoValor + res.taxaFixa + res.freteGratisValor
            });
        }
        // Injetar pontos críticos
        [78.90, 79.00, 79.10, precoAtual].forEach(critical => {
            const res = calcularTaxasMeli({ ...inputs, precoVenda: critical });
            points.push({ x: critical, lucro: res.lucroLiquido, taxas: res.comissaoValor + res.taxaFixa + res.freteGratisValor });
        });
        points.sort((a, b) => a.x - b.x);

        return (
            <div className={`chart-container large-chart ${isFullscreen ? 'fullscreen' : ''}`}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Visualização do Escopo Meli 2026</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "85%" : 320}>
                    <ComposedChart data={points} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tickFormatter={(val) => `R$${val.toFixed(0)}`} />
                        <YAxis yAxisId="left" tickFormatter={(val) => `R$${val}`} />
                        <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                        <Legend verticalAlign="top" align="right" />
                        <Area yAxisId="left" type="monotone" dataKey="lucro" name="Lucro Líquido (R$)" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                        <Line yAxisId="left" type="monotone" dataKey="taxas" name="Taxas Totais (R$)" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                        <ReferenceLine x={79} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label={{ value: 'Regra Frete R$ 79', position: 'top', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine x={precoAtual} stroke="#3b82f6" strokeWidth={3} label={{ value: 'SEU PREÇO', position: 'top', fill: '#1d4ed8', fontSize: 11, fontWeight: 900 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const handleLimpar = () => setIsResetModalOpen(true);
    const confirmReset = () => {
        setInputs(defaultInputs);
        setMargemDesejada(undefined);
        setIsAutoCalcMode(false);
        setCompararTipos(false);
        setResults(null);
        setResultsAlt(null);
        setSimulacao(null);
        localStorage.removeItem('@meliPCC:inputs');
        setIsResetModalOpen(false);
    };

    const moeda = (val: number | undefined) => arredondar(val || 0, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="container">
            <div className="header">
                <div className="hero-logos">
                    <div className="hero-icon-container lcg">
                        <img src="/lcg-logo.svg" alt="Logo LCG" className="hero-icon" />
                    </div>
                    <span className="hero-x">|</span>
                    <div className="hero-icon-container meli">
                        <img src="/Meli_logo.png" alt="Logo Meli" className="hero-icon" />
                    </div>
                </div>
                <h1 className="hero-title">Calculadora de Margem Mercado Livre</h1>
                <p className="hero-subtitle">Descubra sua margem de contribuição após comissão, custo de envio e publicidade. Resultado em segundos! ⚡</p>

                <div className="alert-box alert-green" style={{ marginTop: '1.5rem' }}>
                    <Sparkles className="alert-icon" size={20} />
                    <p>
                        <strong>Atualizado!</strong> A partir de 02/03/2026, o Mercado Livre substituiu a tarifa fixa e o frete médio por uma <strong>tabela única de custos operacionais</strong> baseada no peso e preço do produto. Esta calculadora já usa os novos valores!
                    </p>
                </div>

                <div className="alert-box alert-blue" style={{ marginTop: '1rem' }}>
                    <AlertCircle className="alert-icon" size={20} />
                    <p>
                        💡 Configure <strong>embalagem, impostos, comissões e publicidade</strong> nas seções à esquerda para cálculos mais precisos.
                    </p>
                </div>
            </div>

            <div className="calculator-main">
                <div className="calculator-left">
                    {/* Barra de Busca de Catálogo */}
                    <div className="card" style={{ marginBottom: '1rem', position: 'relative', zIndex: 10 }}>
                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                            <Package size={18} /> BUSCAR NO CATÁLOGO
                            {loadingCatalog && <RefreshCcw size={14} className="spinning" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
                        </div>
                        
                        {!selectedCatalogProduct ? (
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', color: '#9ca3af' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Digite SKU ou Descrição do produto..." 
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowSearchDropdown(true);
                                        }}
                                        onFocus={() => setShowSearchDropdown(true)}
                                        autoComplete="off"
                                        style={{ 
                                            width: '100%', 
                                            padding: '0.75rem 0.75rem 0.75rem 2.5rem', 
                                            borderRadius: '8px', 
                                            border: '1px solid #e5e7eb',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                            backgroundColor: '#fff'
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') setShowSearchDropdown(false);
                                        }}
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => {
                                                setSearchQuery('');
                                                setShowSearchDropdown(false);
                                            }}
                                            style={{ 
                                                position: 'absolute', 
                                                right: '10px', 
                                                background: 'none', 
                                                border: 'none', 
                                                color: '#9ca3af',
                                                cursor: 'pointer',
                                                padding: '4px'
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {showSearchDropdown && searchQuery.length >= 2 && (
                                    <div style={{ 
                                        position: 'absolute', 
                                        top: '100%', 
                                        left: 0, 
                                        right: 0, 
                                        backgroundColor: '#fff', 
                                        borderRadius: '8px', 
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                        border: '1px solid #e5e7eb',
                                        marginTop: '4px',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        zIndex: 50
                                    }}>
                                        {catalogProducts.filter(p => 
                                            (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (p.descricao || '').toLowerCase().includes(searchQuery.toLowerCase())
                                        ).length === 0 ? (
                                            <div style={{ padding: '0.8rem', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
                                                Nenhum produto encontrado no catálogo.
                                            </div>
                                        ) : catalogProducts.filter(p => 
                                            (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (p.descricao || '').toLowerCase().includes(searchQuery.toLowerCase())
                                        ).slice(0, 15).map((p, idx) => (
                                            <div 
                                                key={idx}
                                                style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                onClick={() => {
                                                    setSelectedCatalogProduct({ sku: p.sku || '', descricao: p.descricao || '', _wh: p._wh || '' });
                                                    setSearchQuery('');
                                                    setShowSearchDropdown(false);
                                                    
                                                    // Preencher campos automaticamente
                                                    setInputs(prev => ({
                                                        ...prev,
                                                        custoProduto: p.custoCDP !== undefined && p.custoCDP !== 0 ? p.custoCDP : prev.custoProduto,
                                                        impostoPorcentagem: p.impostosIMP !== undefined && p.impostosIMP !== 0 ? p.impostosIMP : prev.impostoPorcentagem,
                                                        despesaFixa: p.despesaFixaDF !== undefined && p.despesaFixaDF !== 0 ? p.despesaFixaDF : prev.despesaFixa,
                                                        despesaAdicional: p.outrasDespesasOD !== undefined && p.outrasDespesasOD !== 0 ? p.outrasDespesasOD : prev.despesaAdicional,
                                                        adsValor: p.adsADS !== undefined && p.adsADS !== 0 ? p.adsADS : prev.adsValor,
                                                        freteGratis: p.freteLiquidoMELI !== undefined && p.freteLiquidoMELI !== 0 ? p.freteLiquidoMELI : prev.freteGratis
                                                    }));
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '85%' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        <span style={{ color: p._wh === 'SP' ? '#0284c7' : '#b45309', marginRight: '4px' }}>[{p._wh}]</span> {p.sku} - {p.descricao || '(Sem descrição)'}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                                                        Custo: R$ {(p.custoCDP || 0).toFixed(2).replace('.', ',')} | Imp: {(p.impostosIMP || 0).toFixed(2).replace('.', ',')}%
                                                    </span>
                                                </div>
                                                <div style={{ color: '#9ca3af' }}>
                                                    <Plus size={14} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                background: '#f9fafb', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '8px', 
                                padding: '0.65rem 0.75rem',
                                width: '100%',
                                minHeight: '45.6px'
                            }}>
                                <Search size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ 
                                        background: selectedCatalogProduct._wh === 'SP' ? '#e0f2fe' : '#fef08a', 
                                        color: selectedCatalogProduct._wh === 'SP' ? '#0284c7' : '#854d0e', 
                                        fontWeight: 800, 
                                        fontSize: '0.7rem', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px',
                                        flexShrink: 0
                                    }}>
                                        {selectedCatalogProduct._wh}
                                    </span>
                                    <span style={{ 
                                        color: '#1f2937', 
                                        fontWeight: 700, 
                                        fontSize: '0.85rem',
                                        whiteSpace: 'nowrap', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis' 
                                    }}>
                                        {selectedCatalogProduct.sku} — <span style={{ fontWeight: 500, opacity: 0.8 }}>{selectedCatalogProduct.descricao || 'Sem descrição'}</span>
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setSelectedCatalogProduct(null)}
                                    style={{ 
                                        background: '#f3f4f6', 
                                        border: 'none', 
                                        borderRadius: '50%', 
                                        width: '24px', 
                                        height: '24px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        cursor: 'pointer', 
                                        color: '#ef4444',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fecaca')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="tabs">
                        <button className={`tab ${aba === 'margem' ? 'active' : ''}`} onClick={() => setAba('margem')}><Calculator size={18} /> Calcular Margem</button>
                        <button className={`tab ${aba === 'ideal' ? 'active' : ''}`} onClick={() => setAba('ideal')}><CircleDollarSign size={18} /> Preço Ideal</button>
                    </div>

                    <div className="card input-card-highlight">
                        <div className="parameters-grid-rows">
                            <div className="input-row-flex">
                                <div className="input-group">
                                    <label><Package size={16} /> Custo do Produto (R$) {s('CDP')} *</label>
                                    <input type="text" inputMode="decimal" name="custoProduto" placeholder="0,00" value={getInputValue('custoProduto', inputs.custoProduto)} onFocus={() => setFocusedInput('custoProduto')} onChange={handleChange} />
                                    <span className="input-hint">Quanto você pagou pelo produto</span>
                                </div>
                                <div className="input-group">
                                    <label>
                                        {aba === 'margem' ? <TrendingUp size={16} /> : <CircleDollarSign size={16} />}
                                        {aba === 'margem' ? ' Preço de Venda (R$) ' : ' Margem Desejada (%) '}
                                        {aba === 'margem' ? s('PDV') : s('MAR')}
                                    </label>
                                    <input type="text" inputMode="decimal" name={aba === 'margem' ? 'precoVenda' : 'margemDesejada'} placeholder="0,00" value={aba === 'margem' ? getInputValue('precoVenda', inputs.precoVenda) : getInputValue('margemDesejada', margemDesejada)} onFocus={() => setFocusedInput(aba === 'margem' ? 'precoVenda' : 'margemDesejada')} onChange={handleChange} />
                                    <span className="input-hint">{aba === 'margem' ? 'Por quanto você está vendendo' : 'Ex: 15% de lucro sobre o preço final'}</span>
                                </div>
                            </div>

                            <div className="input-group" style={{ marginTop: '1rem' }}>
                                <label><Truck size={16} /> Faixa de Peso do Produto *</label>
                                <select name="pesoKg" value={inputs.pesoKg} onChange={handleChange} className="select-full">
                                    <option value="0.3">Até 0,3 kg</option>
                                    <option value="0.5">Até 0,5 kg</option>
                                    <option value="1">Até 1 kg</option>
                                    <option value="2">Até 2 kg</option>
                                    <option value="5">Até 5 kg</option>
                                    <option value="9">Até 9 kg</option>
                                    <option value="14">Até 14 kg</option>
                                    <option value="19">Até 19 kg</option>
                                    <option value="24">Até 24 kg</option>
                                    <option value="29">Até 29 kg</option>
                                </select>
                                <span className="input-hint">Peso do produto para calcular o custo de envio (Agência/Coleta)</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">CUSTOS PADRÃO</div>
                        <div className="parameters-grid-rows">
                            <div className="input-row-flex">
                                <div className="input-group">
                                    <label>Embalagem (R$) {s('EMB')}</label>
                                    <input type="text" inputMode="decimal" name="custoEmbalagem" placeholder="0,00" value={getInputValue('custoEmbalagem', inputs.custoEmbalagem)} onFocus={() => setFocusedInput('custoEmbalagem')} onChange={handleChange} />
                                </div>
                                <div className="input-group">
                                    <label>Alíquota de Imposto (%) {s('IMP')}</label>
                                    <input type="text" inputMode="decimal" name="impostoPorcentagem" placeholder="0,00" value={getInputValue('impostoPorcentagem', inputs.impostoPorcentagem)} onFocus={() => setFocusedInput('impostoPorcentagem')} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        <div className="card-title" style={{ marginTop: '1.5rem' }}>COMISSÕES MERCADO LIVRE</div>
                        <div className="parameters-grid-rows">
                            <div className="input-row-flex">
                                <div className="input-group">
                                    <label>Comissão Clássico (%)</label>
                                    <input type="text" inputMode="decimal" name="comissaoPorcentagem" placeholder="12,00" value={getInputValue('comissaoPorcentagem', inputs.comissaoPorcentagem)} onFocus={() => setFocusedInput('comissaoPorcentagem')} onChange={handleChange} />
                                </div>
                                <div className="input-group">
                                    <label>Comissão Premium (%)</label>
                                    <input type="text" placeholder="17,00" readOnly value="17,00" className="read-only-input" />
                                </div>
                            </div>

                            <div className="toggle-card-row">
                                <div className="toggle-text">
                                    <strong>Calcular os Dois Tipos?</strong>
                                    <span>Exibir resultados de Clássico e Premium simultaneamente</span>
                                </div>
                                <div className="toggle-switch">
                                    <input type="checkbox" id="compararTipos" checked={compararTipos} onChange={(e) => setCompararTipos(e.target.checked)} />
                                    <label htmlFor="compararTipos"></label>
                                </div>
                            </div>

                            <div className="input-group-radio">
                                <p className="radio-label">Tipo de Anúncio Padrão:</p>
                                <label className="radio-option">
                                    <input type="radio" name="tipoAnuncio" value="classico" checked={inputs.tipoAnuncio === 'classico'} onChange={handleChange} />
                                    <span>Anúncio Clássico ({inputs.comissaoPorcentagem || 12}% comissão)</span>
                                </label>
                                <label className="radio-option">
                                    <input type="radio" name="tipoAnuncio" value="premium" checked={inputs.tipoAnuncio === 'premium'} onChange={handleChange} />
                                    <span>Anúncio Premium (17% comissão)</span>
                                </label>
                            </div>
                        </div>

                        <div className="card-title" style={{ marginTop: '1.5rem' }}>PUBLICIDADE</div>
                        <div className="parameters-grid-rows">
                            <div className="toggle-card-row">
                                <div className="toggle-text">
                                    <strong>Usar Publicidade?</strong>
                                    <span>Incluir custos de Mercado Ads nos cálculos</span>
                                </div>
                                <div className="toggle-switch green">
                                    <input type="checkbox" id="useAds" checked={inputs.adsValor !== undefined} onChange={(e) => setInputs((p: MeliInput) => ({ ...p, adsValor: e.target.checked ? 5 : undefined }))} />
                                    <label htmlFor="useAds"></label>
                                </div>
                            </div>

                            {inputs.adsValor !== undefined && (
                                <>
                                    <div className="input-group-radio" style={{ marginTop: '0.5rem' }}>
                                        <label className="radio-option">
                                            <input type="radio" name="adsTipo" value="fixo" checked={inputs.adsTipo === 'fixo'} onChange={handleChange} />
                                            <span>Custo fixo por pedido</span>
                                        </label>
                                        <label className="radio-option">
                                            <input type="radio" name="adsTipo" value="roas" checked={inputs.adsTipo === 'roas'} onChange={handleChange} />
                                            <span>ROAS desejado</span>
                                        </label>
                                    </div>
                                    <div className="input-group">
                                        <label>{inputs.adsTipo === 'roas' ? 'ROAS Desejado' : 'Custo Ads (R$)'}</label>
                                        <input type="text" inputMode="decimal" name="adsValor" value={getInputValue('adsValor', inputs.adsValor)} onFocus={() => setFocusedInput('adsValor')} onChange={handleChange} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="calculator-right">
                    {results && (
                        <div className="results-display-area">
                            <div className={`status-pill ${statusClass}`}>
                                {statusIcon} <span>{statusText}</span>
                            </div>

                            <div className="premium-results-grid" style={{ marginTop: '1rem' }}>
                                <div className="result-card primary" style={{
                                    backgroundColor: results.lucroLiquido <= 0 ? '#fef2f2' : (results.lucroLiquido < 10 ? '#fff7ed' : '#f0fdf4'),
                                    borderColor: results.lucroLiquido <= 0 ? '#fecaca' : (results.lucroLiquido < 10 ? '#fed7aa' : '#bbf7d0')
                                }}>
                                    <div className="result-label" style={{ color: results.lucroLiquido <= 0 ? '#991b1b' : '#166534' }}>PREÇO DE VENDA {s('PDV')}</div>
                                    <div className="result-value" style={{ color: results.lucroLiquido <= 0 ? '#dc2626' : '#10B981' }}>R$ {moeda(results.precoVenda)}</div>
                                    <div className="result-sub">Valor do anúncio</div>
                                    <ShoppingCart size={24} className="card-icon" style={{ opacity: 0.1 }} />
                                </div>
                                <div className="result-card secondary" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                                    <div className="result-label" style={{ color: '#1e3a8a' }}>LUCRO LÍQUIDO {s('LLV')}</div>
                                    <div className="result-value" style={{ color: '#1e40af' }}>R$ {moeda(results.lucroLiquido)}</div>
                                    <div className="result-sub">Margem: {results.margemSobreVenda.toFixed(1)}%</div>
                                    <TrendingUp size={24} className="card-icon" style={{ opacity: 0.1 }} />
                                </div>
                            </div>

                            {/* --- Sensor de Otimização (Paridade Shopee) --- */}
                            {otimizacaoIdeal && (otimizacaoIdeal.isOtimizado || otimizacaoIdeal.isAlavancagem) && (
                                <div className="sensor-section" style={{ marginTop: '1.5rem' }}>
                                    <div className="sensor-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#1e40af' }}>
                                        <Zap size={20} className="flash-icon" /> 
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>SENSOR DE OTIMIZAÇÃO LCG</h3>
                                    </div>
                                    
                                    {otimizacaoIdeal.isOtimizado && (
                                        <div className="sensor-card opt-gold" style={{ 
                                            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                            border: '2px solid #fbbf24',
                                            padding: '1.25rem',
                                            borderRadius: '12px',
                                            marginBottom: '1rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div className="opt-icon-vibe" style={{ background: '#f59e0b', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Award size={24} color="white" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Oportunidade Sweet Spot Identificada!</div>
                                                    <p style={{ fontSize: '0.95rem', color: '#78350f', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                                                        Reduzindo o preço para <strong>R$ {moeda(otimizacaoIdeal.precoOtimizado)}</strong>, sua taxa fixa cai e seu lucro <strong>AUMENTA</strong> para <strong>R$ {moeda(otimizacaoIdeal.lucroOtimizado)}</strong>.
                                                    </p>
                                                    <button 
                                                        onClick={() => setInputs(p => ({ ...p, precoVenda: otimizacaoIdeal.precoOtimizado }))}
                                                        className="btn-opt-apply"
                                                        style={{ 
                                                            background: '#f59e0b', 
                                                            color: 'white', 
                                                            border: 'none', 
                                                            padding: '0.5rem 1rem', 
                                                            borderRadius: '6px', 
                                                            fontWeight: 700, 
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        <MousePointer2 size={16} /> Aplicar Preço Otimizado
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {otimizacaoIdeal.isAlavancagem && !otimizacaoIdeal.isOtimizado && (
                                        <div className="sensor-card leverage-card" style={{ 
                                            background: 'linear-gradient(135deg, #f0fdff 0%, #e0faff 100%)',
                                            border: '2px solid #06b6d4',
                                            padding: '1.25rem',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div style={{ background: '#06b6d4', padding: '10px', borderRadius: '10px' }}>
                                                    <TrendingUp size={24} color="white" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0e7490', textTransform: 'uppercase' }}>ESTRATÉGIA DE GIRO (ALAVANCAGEM: {otimizacaoIdeal.fatorAlavancagem}x)</div>
                                                    <p style={{ fontSize: '0.95rem', color: '#155e75', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                                                        Você sacrifica apenas <strong>R$ {moeda(otimizacaoIdeal.quedaLucro)}</strong> de margem para baixar <strong>R$ {moeda(otimizacaoIdeal.quedaPreco)}</strong> no preço. Alta chance de explodir em vendas!
                                                    </p>
                                                    <button 
                                                        onClick={() => setInputs(p => ({ ...p, precoVenda: otimizacaoIdeal.precoOtimizado }))}
                                                        style={{ background: '#06b6d4', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        Aplicar Estratégia de Giro
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="dre-container" style={{ marginTop: '1.5rem' }}>
                                <div className="dre-header">
                                    <div className="dre-col-label">CONTA</div>
                                    <div className="dre-col-val">{inputs.tipoAnuncio.toUpperCase()}</div>
                                    {compararTipos && <div className="dre-col-val">{inputs.tipoAnuncio === 'classico' ? 'PREMIUM' : 'CLÁSSICO'}</div>}
                                </div>
                                <div className="dre-row">
                                    <div className="dre-label">Faturamento (PDV)</div>
                                    <div className="dre-val">R$ {moeda(results.precoVenda)}</div>
                                    {resultsAlt && <div className="dre-val">R$ {moeda(resultsAlt.precoVenda)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Custo do Produto (CDP)</div>
                                    <div className="dre-val">- R$ {moeda(results.custoProdutoValor)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.custoProdutoValor)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Comissão ML</div>
                                    <div className="dre-val">- R$ {moeda(results.comissaoValor + results.taxaFixa)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.comissaoValor + resultsAlt.taxaFixa)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Envio (Frete)</div>
                                    <div className="dre-val">- R$ {moeda(results.freteGratisValor)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.freteGratisValor)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Publicidade (Ads)</div>
                                    <div className="dre-val">- R$ {moeda(results.custoAds)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.custoAds)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Impostos (IMP)</div>
                                    <div className="dre-val">- R$ {moeda(results.impostoValor)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.impostoValor)}</div>}
                                </div>
                                <div className="dre-row negative">
                                    <div className="dre-label">Despesas (DF + OD + EMB)</div>
                                    <div className="dre-val">- R$ {moeda(results.despesaFixaValor + results.despesaAdicionalValor + results.custoEmbalagem)}</div>
                                    {resultsAlt && <div className="dre-val">- R$ {moeda(resultsAlt.despesaFixaValor + resultsAlt.despesaAdicionalValor + resultsAlt.custoEmbalagem)}</div>}
                                </div>
                                <div className="dre-divider"></div>
                                <div className="dre-row highlight">
                                    <div className="dre-label">Lucro Líquido Final {s('LLV')}</div>
                                    <div className="dre-val">R$ {moeda(results.lucroLiquido)}</div>
                                    {resultsAlt && <div className="dre-val">R$ {moeda(resultsAlt.lucroLiquido)}</div>}
                                </div>
                                <div className="dre-row highlight">
                                    <div className="dre-label">Margem de Lucro (%)</div>
                                    <div className="dre-val">{results.margemSobreVenda.toFixed(2)}%</div>
                                    {resultsAlt && <div className="dre-val">{resultsAlt.margemSobreVenda.toFixed(2)}%</div>}
                                </div>
                            </div>

                            <div className="summary-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button className="btn-calculate-full" onClick={handleCalcular} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderRadius: '8px', border: 'none', background: '#00a650', color: 'white', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    <Calculator size={20} /> CALCULAR AGORA
                                </button>
                                <button className="btn-clear-outline" onClick={handleLimpar} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#ef4444', fontWeight: '600', cursor: 'pointer' }}>
                                    <RotateCcw size={18} /> LIMPAR TUDO
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {results && simulacao && (
                <div className="charts-main-section" style={{ marginTop: '3rem' }}>
                    <div className="section-divider" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }}></div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e2937', fontStyle: 'italic' }}>ANÁLISE ANALÍTICA LCG</h2>
                        <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }}></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="card" style={{ padding: '20px' }}>
                            <ComposicaoPrecoChart res={results} />
                            <div style={{ display: 'flex', alignItems: 'start', gap: '10px', marginTop: '1.5rem', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                                <Info size={18} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                                    Este gráfico mostra como cada real do faturamento é distribuído. O <strong>Lucro Líquido (Verde)</strong> é o que realmente sobra no seu bolso.
                                </p>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '20px' }}>
                            <EstrategiaPrecoChart 
                                dados={simulacao.cenarios} 
                                precoAtual={results.precoVenda} 
                                pontoIdeal={simulacao.pontoIdeal} 
                                pontoAlvo={simulacao.pAlvo || simulacao.pontoIdeal}
                                onPriceSelect={(p) => setInputs(prev => ({ ...prev, precoVenda: p }))}
                                isFullscreen={isFullscreenStrategy}
                                onToggleFullscreen={() => setIsFullscreenStrategy(!isFullscreenStrategy)}
                            />
                        </div>
                    </div>

                    <div className="card" style={{ padding: '20px' }}>
                        <TaxasPrecoChart 
                            inputs={inputs} 
                            precoAtual={results.precoVenda} 
                            isFullscreen={isFullscreenScope}
                            onToggleFullscreen={() => setIsFullscreenScope(!isFullscreenScope)}
                        />
                    </div>
                </div>
            )}


            <div className="info-section" style={{ marginTop: '5rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>O que é Margem de Contribuição?</h2>
                <div className="card" style={{ textAlign: 'left', lineHeight: '1.6', color: '#4b5563' }}>
                    <p style={{ marginBottom: '1rem' }}>
                        <strong>Margem de Contribuição</strong> é o dinheiro que realmente sobra depois de pagar <strong>todos os custos diretos</strong> de cada venda: comissão do marketplace, tarifas, frete, publicidade, impostos e embalagem. É diferente do "lucro bruto" que a maioria calcula errado (apenas preço de venda menos custo do produto).
                    </p>
                    <p style={{ marginBottom: '1rem' }}>
                        Na <strong>Shopee</strong>, você precisa descontar: <strong>comissão variável por categoria</strong> (5% a 18%), <strong>taxa fixa</strong> (R$ 2 a R$ 3,70 por pedido), <strong>frete grátis</strong> que você paga, custos de <strong>Shopee Ads</strong> se usar publicidade, <strong>impostos</strong> (Simples Nacional, MEI) e <strong>embalagem</strong>. Só assim você sabe se está lucrando de verdade.
                    </p>
                    <p style={{ marginBottom: '1.5rem' }}>
                        No <strong>Mercado Livre</strong>, a conta é ainda mais complexa: <strong>12% de comissão</strong> (anúncios clássicos) ou <strong>17% (premium)</strong>, <strong>tarifa fixa</strong> que varia de R$ 6 a R$ 37 conforme o preço de venda, <strong>frete grátis obrigatório</strong> em produtos novos acima de R$ 79, custos de <strong>Mercado Ads</strong>, impostos e embalagem.
                    </p>
                    <div className="alert-box alert-blue" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <AlertCircle className="alert-icon" size={20} style={{ color: '#3b82f6' }} />
                        <p style={{ color: '#1e40af' }}>
                            <strong>Exemplo prático:</strong> Produto que custa R$ 50 e você vende por R$ 100. Muita gente acha que lucrou R$ 50 (100%). Na realidade, após comissão (12% = R$ 12), tarifa fixa (R$ 8), frete (R$ 12), imposto (6% = R$ 6) e embalagem (R$ 3), você lucra apenas <strong>R$ 9 (margem de 9%)</strong>. Grande diferença, né?
                        </p>
                    </div>
                </div>
            </div>

            <div className="faq-section" style={{ marginTop: '5rem', marginBottom: '5rem' }}>
                <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '3rem' }}>Perguntas Frequentes</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>Como funciona a comissão do Mercado Livre?</span></h4>
                        <p>O Mercado Livre cobra <strong>12% de comissão</strong> para anúncios clássicos e <strong>17% para anúncios premium</strong>. Além da comissão, há um <strong>custo operacional de envio</strong> que varia conforme o peso e o preço do produto.</p>
                    </div>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>Qual a diferença entre anúncio clássico e premium?</span></h4>
                        <p><strong>Clássico:</strong> 12% de comissão, menor visibilidade. <strong>Premium:</strong> 17% de comissão, mas aparece melhor posicionado nas buscas e tem mais benefícios como frete grátis destacado.</p>
                    </div>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>Como funciona o novo custo de envio do ML?</span></h4>
                        <p>A partir de março de 2026, o Mercado Livre usa uma <strong>tabela única de custos operacionais</strong> baseada em peso do produto e preço de venda. Não existe mais tarifa fixa separada nem frete médio manual. O custo é calculado automaticamente pela combinação peso x preço. Os valores já incluem descontos por reputação.</p>
                    </div>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>O que mudou nos custos do Mercado Livre em 2026?</span></h4>
                        <p>O ML substituiu a <strong>tarifa fixa (R$ 6,25 a R$ 6,75)</strong> e o conceito de <strong>frete médio</strong> por uma tabela única. Agora o custo de envio depende de 29 faixas de peso e 8 faixas de preço, totalizando 232 combinações. O frete grátis continua a partir de R$ 19, e anúncios acima de R$ 79 oferecem frete grátis e rápido.</p>
                    </div>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>Vale a pena investir em Mercado Ads?</span></h4>
                        <p>Depende do seu <strong>ROAS</strong> (retorno sobre investimento). Se você gasta R$ 10 em anúncios e vende R$ 50 (ROAS 5), provavelmente vale a pena. Configure o ROAS desejado para calcular o impacto na margem.</p>
                    </div>
                    <div className="card faq-card">
                        <h4><span style={{ color: '#00a650' }}>Q:</span> <span>Qual margem ideal para o Mercado Livre?</span></h4>
                        <p>Uma margem saudável fica <strong>acima de 20%</strong>. Entre 10-20% é apertado mas viável. Abaixo de 10% você corre risco de prejuízo, especialmente considerando devoluções e custos operacionais.</p>
                    </div>
                </div>
            </div>

            <div className="info-section" style={{ marginTop: '5rem' }}>
                <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '3rem' }}>Tarifas de venda</h2>
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1.25rem' }}>Tipo de anúncio</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="meli-table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Grátis</th>
                                    <th>Clássico</th>
                                    <th>Premium</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Exposição nos resultados de busca</td>
                                    <td>Baixa</td>
                                    <td>Alta</td>
                                    <td>Máxima</td>
                                </tr>
                                <tr>
                                    <td>Duração</td>
                                    <td>60 dias</td>
                                    <td>Ilimitada</td>
                                    <td>Ilimitada</td>
                                </tr>
                                <tr>
                                    <td>Você oferece parcelamento sem juros</td>
                                    <td>X</td>
                                    <td>X</td>
                                    <td>Sim</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="info-section" style={{ marginTop: '5rem', marginBottom: '5rem' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Número de parcelas sem juros que você oferece no Premium</h3>
                <p style={{ color: '#4b5563', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    Sempre que anunciar no Premium, você oferece aos compradores a opção de parcelar sem juros. O número de parcelas depende do preço do produto ou do valor final de cada venda. Ao pagar com o Cartão Mercado Pago, seus compradores têm mais vantagens.
                </p>
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="meli-table">
                            <thead>
                                <tr>
                                    <th>Preço do produto ou valor da venda</th>
                                    <th>N.º máximo de parcelas sem juros ao pagar com o cartão Mercado Pago</th>
                                    <th>N.º máximo de parcelas sem juros com outros meios de pagamento</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>De R$ 0 a R$ 29,99</td><td>1</td><td>1</td></tr>
                                <tr><td>De R$ 30 a R$ 59,99</td><td>4</td><td>2</td></tr>
                                <tr><td>De R$ 60 a R$ 99,99</td><td>5</td><td>3</td></tr>
                                <tr><td>De R$ 100 a R$ 149,99</td><td>6</td><td>4</td></tr>
                                <tr><td>De R$ 150 a R$ 179,99</td><td>7</td><td>5</td></tr>
                                <tr><td>De R$ 180 a R$ 299,99</td><td>8</td><td>6</td></tr>
                                <tr><td>De R$ 300 a R$ 349,99</td><td>8</td><td>6</td></tr>
                                <tr><td>De R$ 350 a R$ 399,99</td><td>9</td><td>7</td></tr>
                                <tr><td>De R$ 400 a R$ 449,99</td><td>10</td><td>8</td></tr>
                                <tr><td>De R$ 450 a R$ 499,99</td><td>11</td><td>9</td></tr>
                                <tr><td>De R$ 500 a R$ 549,99</td><td>12</td><td>10</td></tr>
                                <tr><td>De R$ 550 a R$ 599,99</td><td>12</td><td>10</td></tr>
                                <tr><td>De R$ 600 a R$ 899,99</td><td>12</td><td>10</td></tr>
                                <tr><td>Mais de R$ 900</td><td>12</td><td>10</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: '1.6' }}>
                    <p>• Compradores que assinarem Meli+ terão até 3 parcelas extras sem juros em produtos abaixo de R$ 900 e em compras de até R$ 1300.</p>
                    <p>• Em produtos acima de R$ 600 na categoria Tecnologia e Eletrodomésticos, o comprador pode parcelar em até 18x sem juros com Cartão Mercado Pago.</p>
                    <p>• Para vendas com parcelas inferiores a 12x, daremos aos compradores a opção de parcelar em até 12x com acréscimo, com taxas significativamente inferiores aos acréscimos convencionais, lembrando que a parcela nunca será menor do que R$ 5.</p>
                    <p>• A oferta de parcelas sem juros pode variar para itens vendidos por Mercado Livre.</p>
                </div>
            </div>

            {isResetModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-icon-container"><RotateCcw size={32} /></div>
                        <h3 className="modal-title">Limpar Dados?</h3>
                        <p className="modal-description">Deseja zerar todos os campos e tabelas desta calculadora?</p>
                        <div className="modal-actions">
                            <button className="btn-modal-cancel" onClick={() => setIsResetModalOpen(false)}>Cancelar</button>
                            <button className="btn-advanced" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={confirmReset}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeliPage;
