import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
    Calculator, 
    CircleDollarSign, 
    AlertCircle, 
    AlertTriangle, 
    RotateCcw, 
    Sparkles, 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    CheckCircle2, 
    Truck, 
    Search, 
    ShoppingCart, 
    Plus, 
    RefreshCcw, 
    Info, 
    MousePointer2, 
    Zap, 
    Award, 
    Tag, 
    Minimize2, 
    Maximize2, 
    HelpCircle, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    ShieldCheck, 
    Table
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
    ComposedChart,
    Area,
    Line,
    ReferenceLine
} from 'recharts';

import type { MeliInput, MeliOutput, ResultadoSimulacaoMeli, CenarioPrecoMeli } from '../utils/meliLogic';
import { calcularTaxasMeli, calcularPrecoIdealMeli, simularCenariosPrecoMeli, arredondar, getFaixaPesoAutomatico } from '../utils/meliLogic';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logCalculo, auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserCatalog } from '../services/catalogService';

const defaultInputs: MeliInput = {
    custoProduto: undefined,
    precoVenda: undefined,
    precoAnunciadoClassico: undefined, // PAC
    precoAnunciadoPremium: undefined,  // PAP
    tipoAnuncio: 'classico',
    // comissaoPorcentagem removido - usa automático: 12% Clássico / 17% Premium
    freteGratis: undefined,
    pesoRealKg: undefined,
    despesaFixa: undefined,
    despesaFixaTipo: 'porcentagem',
    despesaAdicional: undefined,
    despesaAdicionalTipo: 'porcentagem',
    impostoPorcentagem: undefined,
    impostoTipo: 'porcentagem',
    adsValor: undefined,
    // Mantemos o Ads como porcentagem por padrão para evitar ROAS oculto distorcendo o cálculo.
    adsTipo: 'porcentagem',
    rebatePorcentagem: undefined,
    rebateTipo: 'porcentagem',
    cupomDesconto: undefined,
    cupomTipo: 'porcentagem',
    descontoCadastro: undefined,
    descontoCadastroTipo: 'porcentagem',
    reputacao: 'cinza' // Padrão: cinza (sem reputação)
};

const porc = (valor: number) => {
    return (valor || 0).toFixed(1).replace('.', ',');
};

const MeliPage: React.FC = () => {
    const [aba, setAba] = useState<'margem' | 'ideal'>(() => {
        return (localStorage.getItem('@meliPCC:aba') as 'margem' | 'ideal') || 'ideal';
    });

    const [tipoMargemIdeal, setTipoMargemIdeal] = useState<'venda' | 'custo' | 'reais'>(() => {
        return (localStorage.getItem('@meliPCC:tipoMargemIdeal') as 'venda' | 'custo' | 'reais') || 'venda';
    });

    const [compararTipos, setCompararTipos] = useState<boolean>(() => {
        return localStorage.getItem('@meliPCC:compararTipos') === 'true';
    });

    const [inputs, setInputs] = useState<MeliInput>(defaultInputs);

    useEffect(() => {
        document.title = 'Calculadora Mercado Livre 2026';
    }, []);

    const [margemDesejada, setMargemDesejada] = useState<number | undefined>(undefined);

    const [isAutoCalcMode, setIsAutoCalcMode] = useState<boolean>(false);

    const [results, setResults] = useState<MeliOutput | null>(null);
    const [resultsClassico, setResultsClassico] = useState<MeliOutput | null>(null);
    const [resultsPremium, setResultsPremium] = useState<MeliOutput | null>(null);
    const [modoCalculo, setModoCalculo] = useState<'classico' | 'premium' | 'ambos'>('classico');
    const [tipoAnuncioCalculado, setTipoAnuncioCalculado] = useState<'classico' | 'premium'>('classico');

    const [simulacao, setSimulacao] = useState<ResultadoSimulacaoMeli | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);

    // Estados para gráficos e tela cheia (paridade Shopee)
    const [isFullscreenStrategy, setIsFullscreenStrategy] = useState(false);
    const [isFullscreenScope, setIsFullscreenScope] = useState(false);

    const [statusClass, setStatusClass] = useState('');
    const [statusText, setStatusText] = useState('');
    const [statusIcon, setStatusIcon] = useState<React.ReactNode>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info'; show: boolean } | null>(null);

    const isInitialLoadDone = useRef(false);

    const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setNotification({ message, type, show: true });
        setTimeout(() => {
            setNotification(prev => prev ? { ...prev, show: false } : null);
        }, 5000);
    };

    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const [focusedValue, setFocusedValue] = useState<string>('');
    const [user, setUser] = useState<any>(null);

    // Gestão do Menu Avançado (Paridade Shopee)
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [catalogPage, setCatalogPage] = useState(1);
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<{ sku: string, descricao: string, _wh: string } | null>(null);

    // Carregar dados do Firestore quando usuário logar
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            
            if (currentUser) {
                try {
                    console.log("Meli: Carregando configurações do Firestore...");
                    const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'meli');
                    const userSettingsSnap = await getDoc(userSettingsRef);
                    
                    if (userSettingsSnap.exists()) {
                        const data = userSettingsSnap.data();
                        console.log("Meli: Configurações recuperadas com sucesso.");
                        
                        // Apenas configurações gerais, não inputs (persistência apenas por sessão)
                        if (data.aba) setAba(data.aba);
                        if (data.compararTipos !== undefined) setCompararTipos(data.compararTipos);
                        if (data.isAutoCalcMode !== undefined) setIsAutoCalcMode(data.isAutoCalcMode);
                        if (data.tipoMargemIdeal) setTipoMargemIdeal(data.tipoMargemIdeal);
                        if (data.reputacao) setInputs(prev => ({ ...prev, reputacao: data.reputacao }));
                    }
                    
                    // Carregar catálogo do Firestore
                    console.log("Meli: Sincronizando catálogo com Firestore...");
                    const [cloudSP, cloudSC] = await Promise.all([
                        getUserCatalog(currentUser.uid, 'SP'),
                        getUserCatalog(currentUser.uid, 'SC')
                    ]);
                    
                    let finalSP = cloudSP;
                    let finalSC = cloudSC;
                    
                    // Se a nuvem estiver vazia, tenta o localStorage
                    if (finalSP.length === 0 && finalSC.length === 0) {
                        console.log("Meli: Nuvem vazia, tentando localStorage...");
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
                }
            } else {
                // Usuário não logado - carrega do localStorage
                const sp = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SP') || '[]');
                const sc = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SC') || '[]');
                const combined = [
                    ...sp.map((p: any) => ({ ...p, _wh: 'SP' })),
                    ...sc.map((p: any) => ({ ...p, _wh: 'SC' }))
                ];
                setCatalogProducts(combined);
            }
        });

        return () => unsubscribe();
    }, []);

    // Efeito para salvar dados no Firestore com Debounce - APENAS CONFIGURAÇÕES (não inputs)
    useEffect(() => {
        if (!user || !isInitialLoadDone.current) return;
        
        const timer = setTimeout(async () => {
            try {
                console.log("Meli: Salvando configurações no Firestore...");
                const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'meli');
                
                // Preparar dados para salvar, removendo valores undefined
                const dadosParaSalvar: Record<string, any> = {
                    aba,
                    compararTipos,
                    isAutoCalcMode,
                    tipoMargemIdeal,
                    reputacao: inputs.reputacao || 'cinza',
                    updatedAt: new Date().toISOString()
                };
                
                // Só adiciona margemDesejada se estiver definida
                if (margemDesejada !== undefined && margemDesejada !== null) {
                    dadosParaSalvar.margemDesejada = margemDesejada;
                }
                
                await setDoc(userSettingsRef, dadosParaSalvar, { merge: true });
                console.log("Meli: Salvo com sucesso!");
            } catch (error) {
                console.error("Meli: Erro ao salvar configurações no Firestore:", error);
            }
        }, 5000); 

        return () => clearTimeout(timer);
    }, [aba, margemDesejada, compararTipos, isAutoCalcMode, tipoMargemIdeal, user, inputs.reputacao]);

    const handleFocus = (name: string, value: number | undefined) => {
        setFocusedInput(name);
        if (value === undefined || value === 0) {
            setFocusedValue('');
        } else {
            setFocusedValue(arredondar(value, 2).toFixed(2).replace('.', ','));
        }
    };

    const getInputValue = (name: string, value: any) => {
        if (focusedInput === name) return focusedValue;
        if (value === undefined || value === null || value === '') return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        return (typeof num === 'number' && !isNaN(num)) ? arredondar(num, 2).toFixed(2).replace('.', ',') : '';
    };

    const s = (key: string) => <span className="tech-abbr">[{key}]</span>;

    // Persistência removida - dados duram apenas a sessão
    // Os inputs são perdidos quando a página é recarregada

    const updateNumericValue = (name: string, val: number | undefined) => {
        if (name === 'margemDesejada') {
            setMargemDesejada(val);
        } else {
            setInputs((prev: MeliInput) => ({
                ...prev,
                [name]: val,
            }));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCalcular();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, type, value } = target;

        if (type === 'checkbox') {
            // @ts-ignore
            setInputs(prev => ({ ...prev, [name]: target.checked }));
            return;
        }

        const isNotNumeric = name.endsWith('Tipo') || name === 'tipoAnuncio' || name === 'pesoKg' || name === 'aba';

        if (!isNotNumeric && target.tagName === 'INPUT') {
            // Máscara Financeira: remove tudo que não for dígito e trata como centavos
            const digits = value.replace(/\D/g, '');

            if (digits === '') {
                if (focusedInput === name) setFocusedValue('');
                updateNumericValue(name, undefined);
                return;
            }

            const numericValue = parseInt(digits, 10) / 100;
            const formatted = numericValue.toFixed(2).replace('.', ',');

            if (focusedInput === name) {
                setFocusedValue(formatted);
            }
            updateNumericValue(name, numericValue);
        } else {
            if (focusedInput === name) {
                setFocusedValue(value);
            }

            if (name === 'aba') {
                setAba(value as any);
            } else {
                setInputs((prev: MeliInput) => ({
                    ...prev,
                    [name]: value,
                }));
            }
        }
    };


    const handleCalcular = () => {
        // Validação: peso é obrigatório
        if (!inputs.pesoRealKg || inputs.pesoRealKg <= 0) {
            notify('Preencha o peso do produto para calcular', 'error');
            return;
        }
        
        // Validação: custo do produto é obrigatório
        if (!inputs.custoProduto || inputs.custoProduto <= 0) {
            notify('Preencha o custo do produto para calcular', 'error');
            return;
        }
        
        // Validação: preço anunciado é obrigatório conforme modo de cálculo
        if (modoCalculo === 'classico') {
            if (!inputs.precoVenda || inputs.precoVenda <= 0) {
                notify('Preencha o preço anunciado para calcular', 'error');
                return;
            }
        } else if (modoCalculo === 'premium') {
            if (!inputs.precoVenda || inputs.precoVenda <= 0) {
                notify('Preencha o preço anunciado para calcular', 'error');
                return;
            }
        } else if (modoCalculo === 'ambos') {
            if (!inputs.precoAnunciadoClassico || inputs.precoAnunciadoClassico <= 0) {
                notify('Preencha o preço anunciado clássico para calcular', 'error');
                return;
            }
            if (!inputs.precoAnunciadoPremium || inputs.precoAnunciadoPremium <= 0) {
                notify('Preencha o preço anunciado premium para calcular', 'error');
                return;
            }
        }
        
        setIsCalculating(true);
        setTimeout(() => {
            executarCalculo();
            setIsCalculating(false);
        }, 800);
    };


    const executarCalculo = () => {
        // console.log('[executarCalculo] Iniciando cálculo:', { aba, custoProduto: inputs.custoProduto, margemDesejada, tipoMargemIdeal });
        let resultado: MeliOutput;
        let resultadoClassico: MeliOutput | null = null;
        let resultadoPremium: MeliOutput | null = null;

        if (aba === 'margem') {
            // Calcular conforme o modo selecionado
            if (modoCalculo === 'classico' || modoCalculo === 'ambos') {
                const paClassico = modoCalculo === 'ambos' 
                    ? inputs.precoAnunciadoClassico 
                    : inputs.precoVenda;
                if (paClassico === undefined) {
                    notify('Preencha o preço anunciado clássico', 'error');
                    return;
                }
                resultadoClassico = calcularTaxasMeli({ ...inputs, precoVenda: paClassico, tipoAnuncio: 'classico' });
            }
            if (modoCalculo === 'premium' || modoCalculo === 'ambos') {
                const paPremium = modoCalculo === 'ambos' 
                    ? inputs.precoAnunciadoPremium 
                    : inputs.precoVenda;
                if (paPremium === undefined) {
                    notify('Preencha o preço anunciado premium', 'error');
                    return;
                }
                resultadoPremium = calcularTaxasMeli({ ...inputs, precoVenda: paPremium, tipoAnuncio: 'premium' });
            }
            
            // Resultado principal para compatibilidade
            resultado = modoCalculo === 'premium' ? resultadoPremium! : resultadoClassico!;
            
            // Guardar tipo de anúncio usado no cálculo para exibir na DRE
            setTipoAnuncioCalculado(modoCalculo === 'premium' ? 'premium' : 'classico');
            
        } else {
            if (inputs.custoProduto === undefined) {
                setResults(null);
                setResultsClassico(null);
                setResultsPremium(null);
                setSimulacao(null);
                return;
            }
            const pIdeal = calcularPrecoIdealMeli(inputs, margemDesejada, tipoMargemIdeal === 'reais' ? 'venda' : tipoMargemIdeal);
            // console.log('[executarCalculo] Preço ideal calculado:', pIdeal);
            resultado = calcularTaxasMeli({ ...inputs, precoVenda: pIdeal });
            resultadoClassico = null;
            resultadoPremium = null;
        }

        // Salvar resultados dos dois tipos
        setResultsClassico(resultadoClassico);
        setResultsPremium(resultadoPremium);
        setResults(resultado);

        const tipoBaseEfetivo: 'custo' | 'venda' = tipoMargemIdeal === 'reais' ? 'venda' : tipoMargemIdeal;
        const sim = simularCenariosPrecoMeli(inputs, isAutoCalcMode ? resultado.margemSobreVenda : margemDesejada, tipoBaseEfetivo);
        const pIdeal15 = calcularPrecoIdealMeli(inputs, 15, tipoBaseEfetivo);
        const resIdeal15 = calcularTaxasMeli({ ...inputs, precoVenda: pIdeal15 });

        const simComIdeal = {
            ...sim,
            pAlvo: sim.pontoIdeal,
            pIdeal15: { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.taxaFixa + resIdeal15.freteGratisValor) / (resIdeal15.precoVenda || 1) * 100 }
        };

        setSimulacao(simComIdeal as any);

        // Status baseado no resultado principal
        const msv = resultado.margemSobreVenda;
        if (msv <= 0) {
            setStatusClass('status-red');
            setStatusText('Prejuízo!');
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
        notify(msv <= 0 ? "Atenção: Margem negativa detectada!" : "Cálculo realizado com sucesso!", msv <= 0 ? "error" : "success");
    };


    // Componentes de Gráficos (Paridade Shopee)
    const ComposicaoPrecoChart = ({ res }: { res: MeliOutput }) => {
        const data = [
            { name: 'PA', Lucro: res.lucroLiquido, Custo: res.custoProdutoValor, Ads: res.custoAds, Operacao: res.despesaFixaValor + res.despesaAdicionalValor, Taxas: res.comissaoValor + res.taxaFixa + res.freteGratisValor, fullPreco: `R$ ${res.precoAnunciado.toFixed(2)}` }
        ];

        return (
            <div className="chart-container" style={{ background: '#fff', padding: '10px' }}>
                <h4 className="chart-title">Composição do Preço Anunciado</h4>
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
                            formatter={(value: any, name: any) => [`R$ ${Number(value).toFixed(2)}`, name]}
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
                            formatter={(value: any, name: any) => [
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
        setInputs({
            ...defaultInputs,
            pesoRealKg: undefined // Deixa o peso sem valor pré-definido (campo vazio)
        });
        setModoCalculo('classico'); // Resetar modo de cálculo para o padrão
        setMargemDesejada(undefined);
        setIsAutoCalcMode(false);
        setCompararTipos(false);
        setResults(null);
        setSimulacao(null);
        setSelectedCatalogProduct(null);
        setSearchQuery('');
        setShowSearchDropdown(false);
        setIsResetModalOpen(false);
    };

    const moeda = (val: number | undefined) => arredondar(val || 0, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="container theme-meli">
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
                <p className="hero-subtitle">Descubra sua margem de contribuição após comissão, custo de envio e publicidade. Resultado em segundos!</p>
            </div>

            <div className="calculator-main">
                <div className="calculator-left">
                    <div className="tabs" style={{ marginBottom: '1.5rem' }}>
                        <button
                            className={`tab ${aba === 'margem' ? 'active' : ''}`}
                            onClick={() => setAba('margem')}
                        >
                            <Calculator size={18} /> Calcular margem
                        </button>
                        <button
                            className={`tab ${aba === 'ideal' ? 'active' : ''}`}
                            onClick={() => setAba('ideal')}
                        >
                            <CircleDollarSign size={18} /> Preço Ideal
                        </button>
                    </div>
                    {/* Card de Parâmetros Consolidado (Padrão Shopee) */}
                    <div className="card input-card-highlight">
                        <div className="card-title">
                            <span className="number-badge">1</span> Parâmetros de Cálculo {s('PDL')}
                        </div>

                        <div className="parameters-grid" style={{ padding: '0.5rem 0' }}>
                            <div className="input-section-title">Valores Base</div>

                            {/* Barra de Busca de Catálogo - Integrada no Card como na Shopee */}
                            <div className="input-group" style={{ position: 'relative', marginBottom: '1rem', zIndex: showSearchDropdown ? 100 : 1 }}>
                                <label style={{ color: '#4b5563', fontWeight: 700 }}><Search size={16} /> Buscar no Catálogo</label>

                                {!selectedCatalogProduct ? (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Digite SKU ou descrição..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setShowSearchDropdown(true);
                                                setCatalogPage(1); // Reset page on search
                                            }}
                                            onFocus={() => setShowSearchDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                                            autoComplete="off"
                                            className="input-field"
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}
                                            onKeyDown={handleKeyDown}
                                        />
                                        {showSearchDropdown && searchQuery.trim().length > 1 && (
                                            <div className="catalog-dropdown" style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0,
                                                background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
                                                maxHeight: '400px', overflowY: 'auto', zIndex: 1000,
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '4px'
                                            }}>
                                                {(() => {
                                                    const searchLower = searchQuery.toLowerCase();
                                                    const filtered = catalogProducts
                                                        .map(p => {
                                                            let score = 0;
                                                            const skuLower = (p.sku || '').toLowerCase();
                                                            const descLower = (p.descricao || '').toLowerCase();

                                                            if (skuLower === searchLower) score = 100;
                                                            else if (skuLower.startsWith(searchLower)) score = 80;
                                                            else if (descLower.startsWith(searchLower)) score = 60;
                                                            else if (skuLower.includes(searchLower)) score = 40;
                                                            else if (descLower.includes(searchLower)) score = 20;

                                                            return { ...p, _score: score };
                                                        })
                                                        .filter(p => p._score > 0)
                                                        .sort((a, b) => b._score - a._score);

                                                    const itemsPerPage = 20;
                                                    const totalPages = Math.ceil(filtered.length / itemsPerPage);
                                                    const paginatedItems = filtered.slice((catalogPage - 1) * itemsPerPage, catalogPage * itemsPerPage);

                                                    if (filtered.length === 0) {
                                                        return (
                                                            <div style={{ padding: '0.8rem', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
                                                                Nenhum produto encontrado.
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <>
                                                            {paginatedItems.map((p, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                                    onClick={() => {
                                                                        setSelectedCatalogProduct({ sku: p.sku || '', descricao: p.descricao || '', _wh: p._wh || '' });
                                                                        setInputs(prev => ({
                                                                            ...prev,
                                                                            custoProduto: p.custoCDP || prev.custoProduto,
                                                                            impostoPorcentagem: p.impostosIMP || prev.impostoPorcentagem,
                                                                            despesaFixa: p.despesaFixaDF || prev.despesaFixa,
                                                                            despesaAdicional: p.outrasDespesasOD || prev.despesaAdicional,
                                                                            adsValor: p.adsADS || prev.adsValor,
                                                                            rebatePorcentagem: p.rebateCR || prev.rebatePorcentagem
                                                                        }));
                                                                        setShowSearchDropdown(false);
                                                                    }}
                                                                    className="catalog-item-hover"
                                                                >
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '85%' }}>
                                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2937' }}>
                                                                            <span style={{ color: p._wh === 'SP' ? '#0284c7' : '#b45309', marginRight: '4px' }}>[{p._wh}]</span> {p.sku} - {p.descricao}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                                            CDP: R$ {(p.custoCDP || 0).toFixed(2)} | IMP: {(p.impostosIMP || 0)}%
                                                                        </span>
                                                                    </div>
                                                                    <Plus size={16} color="#9ca3af" />
                                                                </div>
                                                            ))}
                                                            {totalPages > 1 && (
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '0.85rem 1rem',
                                                                    backgroundColor: '#ffffff',
                                                                    borderTop: '1px solid #f3f4f6',
                                                                    borderBottomLeftRadius: '12px',
                                                                    borderBottomRightRadius: '12px'
                                                                }}>
                                                                    <button
                                                                        disabled={catalogPage === 1}
                                                                        onClick={(e) => { e.stopPropagation(); setCatalogPage(p => p - 1); }}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 12px',
                                                                            borderRadius: '8px',
                                                                            border: '1px solid #e5e7eb',
                                                                            backgroundColor: catalogPage === 1 ? '#f9fafb' : '#ffffff',
                                                                            color: catalogPage === 1 ? '#9ca3af' : '#374151',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 600,
                                                                            cursor: catalogPage === 1 ? 'not-allowed' : 'pointer',
                                                                            transition: 'all 0.2s ease',
                                                                            boxShadow: catalogPage === 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (catalogPage !== 1) {
                                                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                                                e.currentTarget.style.borderColor = '#d1d5db';
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (catalogPage !== 1) {
                                                                                e.currentTarget.style.backgroundColor = '#ffffff';
                                                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                                                            }
                                                                        }}
                                                                    >
                                                                        <ChevronLeft size={14} /> Anterior
                                                                    </button>

                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                                        <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Página</span>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827' }}>{catalogPage} <span style={{ color: '#9ca3af', fontWeight: 400 }}>de</span> {totalPages}</span>
                                                                    </div>

                                                                    <button
                                                                        disabled={catalogPage === totalPages}
                                                                        onClick={(e) => { e.stopPropagation(); setCatalogPage(p => p + 1); }}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 12px',
                                                                            borderRadius: '8px',
                                                                            border: '1px solid #e5e7eb',
                                                                            backgroundColor: catalogPage === totalPages ? '#f9fafb' : '#ffffff',
                                                                            color: catalogPage === totalPages ? '#9ca3af' : '#374151',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 600,
                                                                            cursor: catalogPage === totalPages ? 'not-allowed' : 'pointer',
                                                                            transition: 'all 0.2s ease',
                                                                            boxShadow: catalogPage === totalPages ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (catalogPage !== totalPages) {
                                                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                                                e.currentTarget.style.borderColor = '#d1d5db';
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (catalogPage !== totalPages) {
                                                                                e.currentTarget.style.backgroundColor = '#ffffff';
                                                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                                                            }
                                                                        }}
                                                                    >
                                                                        Próximo <ChevronRight size={14} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Exibição do produto dentro da "barra" - Seguindo padrão Shopee */
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
                                            onClick={() => {
                                                setSelectedCatalogProduct(null);
                                                setInputs(prev => ({
                                                    ...prev,
                                                    custoProduto: undefined,
                                                    impostoPorcentagem: undefined,
                                                    despesaFixa: undefined,
                                                    despesaAdicional: undefined,
                                                    adsValor: undefined,
                                                    rebatePorcentagem: undefined
                                                }));
                                            }}
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
                                                fontSize: '1.2rem',
                                                lineHeight: 0,
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = '#fecaca')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                            title="Limpar seleção"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="input-group">
                                <label><ShoppingCart size={16} /> Custo do Produto (R$) {s('CDP')}</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    name="custoProduto"
                                    placeholder="0,00"
                                    value={getInputValue('custoProduto', inputs.custoProduto)}
                                    onFocus={() => handleFocus('custoProduto', inputs.custoProduto)}
                                    onBlur={() => { setFocusedInput(null); setFocusedValue(''); }}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            {/* Campos de Preço Anunciado - PAC, PAP e Ambos */}
                            {aba === 'margem' && (
                                <>
                                    <div className="input-section-title">Preço Anunciado</div>
                                    
                                    {/* Alternador de tipo de anúncio - 3 opções: Clássico, Premium, Ambos */}
                                    <div className="input-group">
                                        <div className="margin-type-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '0.75rem' }}>
                                            <button
                                                className={`margin-tab ${modoCalculo === 'classico' ? 'active' : ''}`}
                                                onClick={() => setModoCalculo('classico')}
                                                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                                            >
                                                Clássico (12%)
                                            </button>
                                            <button
                                                className={`margin-tab ${modoCalculo === 'premium' ? 'active' : ''}`}
                                                onClick={() => setModoCalculo('premium')}
                                                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                                            >
                                                Premium (17%)
                                            </button>
                                            <button
                                                className={`margin-tab ${modoCalculo === 'ambos' ? 'active' : ''}`}
                                                onClick={() => setModoCalculo('ambos')}
                                                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                                            >
                                                Ambos
                                            </button>
                                        </div>
                                        
                                        <label>
                                            <span> Preço Anunciado (R$) </span>
                                            {modoCalculo === 'classico' ? s('PAC') : modoCalculo === 'premium' ? s('PAP') : s('PA')}
                                        </label>
                                        
                                        {/* Input único para Clássico ou Premium */}
                                        {modoCalculo !== 'ambos' && (
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="precoVenda"
                                                placeholder="0,00"
                                                value={getInputValue('precoVenda', inputs.precoVenda)}
                                                onFocus={() => handleFocus('precoVenda', inputs.precoVenda)}
                                                onChange={handleChange}
                                                onKeyDown={handleKeyDown}
                                            />
                                        )}
                                        
                                        {/* Dois inputs separados quando modo for Ambos */}
                                        {modoCalculo === 'ambos' && (
                                            <>
                                                <div style={{ marginBottom: '0.75rem' }}>
                                                    <label style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <TrendingUp size={14} /> Clássico {s('PAC')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        name="precoAnunciadoClassico"
                                                        placeholder="0,00"
                                                        value={getInputValue('precoAnunciadoClassico', inputs.precoAnunciadoClassico)}
                                                        onFocus={() => handleFocus('precoAnunciadoClassico', inputs.precoAnunciadoClassico)}
                                                        onChange={handleChange}
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Award size={14} /> Premium {s('PAP')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        name="precoAnunciadoPremium"
                                                        placeholder="0,00"
                                                        value={getInputValue('precoAnunciadoPremium', inputs.precoAnunciadoPremium)}
                                                        onFocus={() => handleFocus('precoAnunciadoPremium', inputs.precoAnunciadoPremium)}
                                                        onChange={handleChange}
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <span className="input-hint">
                                            {modoCalculo === 'classico' 
                                                ? 'Comissão 12% + taxa fixa abaixo de R$79' 
                                                : modoCalculo === 'premium'
                                                    ? 'Comissão 17% + taxa fixa abaixo de R$79'
                                                    : 'Mesmo preço para ambos os tipos de anúncio'}
                                        </span>
                                    </div>
                                </>
                            )}

                            {aba === 'ideal' && (
                                <div className="input-group">
                                    <label style={{ margin: 0, marginBottom: '0.4rem', display: 'flex' }}>
                                        <TrendingUp size={16} />
                                        <span>Lucro desejado {tipoMargemIdeal !== 'reais' ? '(%)' : '(R$)'}:</span>
                                        {tipoMargemIdeal === 'custo' ? (aba === 'ideal' ? s('MSCD') : s('MSC')) : (tipoMargemIdeal === 'venda' ? (aba === 'ideal' ? s('LLVD') : s('LLV')) : '')}
                                        <HelpCircle size={14} className="label-help" />
                                    </label>

                                    <div className="margin-type-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                                        <button
                                            className={`margin-tab ${tipoMargemIdeal === 'custo' ? 'active' : ''}`}
                                            onClick={() => { setTipoMargemIdeal('custo'); }}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                        >
                                            Sobre o Custo
                                        </button>
                                        <button
                                            className={`margin-tab ${tipoMargemIdeal === 'venda' ? 'active' : ''}`}
                                            onClick={() => { setTipoMargemIdeal('venda'); }}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                        >
                                            Sobre a Venda
                                        </button>
                                        <button
                                            className={`margin-tab ${tipoMargemIdeal === 'reais' ? 'active' : ''}`}
                                            onClick={() => { setTipoMargemIdeal('reais'); }}
                                            style={{ fontSize: '0.8rem', padding: '0.4rem', whiteSpace: 'nowrap' }}
                                        >
                                            Ou (R$)
                                        </button>
                                    </div>

                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="margemDesejada"
                                            placeholder="0,00"
                                            value={getInputValue('margemDesejada', margemDesejada)}
                                            onFocus={() => handleFocus('margemDesejada', margemDesejada)}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <span className="input-hint">Meta de lucro líquido para esta venda</span>
                                </div>
                            )}

                            <div className="input-group">
                                <label><Truck size={16} /> Peso do Produto (Kg) {s('PES')}</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="pesoRealKg"
                                        placeholder="0,00"
                                        value={getInputValue('pesoRealKg', inputs.pesoRealKg)}
                                        onFocus={() => handleFocus('pesoRealKg', inputs.pesoRealKg)}
                                        onBlur={() => { setFocusedInput(null); setFocusedValue(''); }}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                    />
                                    {inputs.pesoRealKg !== undefined && (
                                        <div style={{
                                            fontSize: '0.72rem',
                                            color: '#3b82f6',
                                            marginTop: '6px',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            background: '#eff6ff',
                                            borderRadius: '4px',
                                            width: 'fit-content'
                                        }}>
                                            <Info size={12} /> Faixa detectada: Até {getFaixaPesoAutomatico(inputs.pesoRealKg)}kg
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Descontos — sempre visível, fora das Avançadas */}
                            <div className="input-section-title">Descontos</div>

                            <div className="input-group">
                                <label><Sparkles size={16} /> Crédito de Rebate {s('CR')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="rebatePorcentagem"
                                        className="input-main"
                                        placeholder="0,00"
                                        value={getInputValue('rebatePorcentagem', inputs.rebatePorcentagem)}
                                        onFocus={() => handleFocus('rebatePorcentagem', inputs.rebatePorcentagem)}
                                        onChange={handleChange}
                                    />
                                    <select
                                        name="rebateTipo"
                                        value={inputs.rebateTipo}
                                        onChange={handleChange}
                                        className="input-unit"
                                    >
                                        <option value="porcentagem">%</option>
                                        <option value="fixo">R$</option>
                                    </select>
                                </div>
                            </div>

                            <div className="input-group">
                                <label><CircleDollarSign size={16} /> Cupom de Desconto {s('CD')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="cupomDesconto"
                                        className="input-main"
                                        placeholder="0,00"
                                        value={getInputValue('cupomDesconto', inputs.cupomDesconto)}
                                        onFocus={() => handleFocus('cupomDesconto', inputs.cupomDesconto)}
                                        onChange={handleChange}
                                    />
                                    <select
                                        name="cupomTipo"
                                        value={inputs.cupomTipo}
                                        onChange={handleChange}
                                        className="input-unit"
                                    >
                                        <option value="fixo">R$</option>
                                        <option value="porcentagem">%</option>
                                    </select>
                                </div>
                            </div>

                            <div className="input-group">
                                <label><CircleDollarSign size={16} /> Desconto no cadastro {s('DC')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="descontoCadastro"
                                        className="input-main"
                                        placeholder="0,00"
                                        value={getInputValue('descontoCadastro', inputs.descontoCadastro)}
                                        onFocus={() => handleFocus('descontoCadastro', inputs.descontoCadastro)}
                                        onChange={handleChange}
                                    />
                                    <select
                                        name="descontoCadastroTipo"
                                        value={inputs.descontoCadastroTipo}
                                        onChange={handleChange}
                                        className="input-unit"
                                    >
                                        <option value="porcentagem">%</option>
                                        <option value="fixo">R$</option>
                                    </select>
                                </div>
                            </div>

                            {/* Seção de Configurações Avançadas Colapsável (Paridade Shopee) */}
                            <div
                                className={`advanced-settings-header ${isAdvancedOpen ? 'open' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAdvancedOpen(!isAdvancedOpen);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="header-title">
                                    <ChevronDown size={20} className="chevron-icon" />
                                    <span>Configurações Avançadas</span>
                                </div>
                                <div className="header-line"></div>
                            </div>

                            {isAdvancedOpen && (
                                <div className={`advanced-settings-content ${isAdvancedOpen ? 'open' : ''}`}>
                                    {/* Alternador de Reputação - Minimalista */}
                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label style={{ 
                                            color: '#374151', 
                                            fontWeight: 600, 
                                            marginBottom: '0.5rem', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px',
                                            fontSize: '0.9rem'
                                        }}>
                                            <Award size={18} style={{ color: '#f59e0b' }} /> 
                                            Reputação do Vendedor
                                        </label>
                                        
                                        {/* Seletor de barras */}
                                        <div style={{ 
                                            display: 'flex', 
                                            gap: '2px',
                                            marginBottom: '0.5rem'
                                        }}>
                                            {[
                                                { key: 'cinza', color: '#9ca3af40', activeColor: '#6b7280' },
                                                { key: 'verde_sem_reputacao', color: '#86efac60', activeColor: '#22c55e' },
                                                { key: 'amarela', color: '#fde04760', activeColor: '#eab308' },
                                                { key: 'laranja', color: '#fdba7460', activeColor: '#f97316' },
                                                { key: 'vermelha', color: '#fca5a560', activeColor: '#ef4444' }
                                            ].map(({ key, color, activeColor }) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handleChange({ target: { name: 'reputacao', value: key } } as any)}
                                                    style={{
                                                        flex: 1,
                                                        height: '20px',
                                                        borderRadius: '2px',
                                                        border: 'none',
                                                        background: inputs.reputacao === key ? activeColor : color,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s ease'
                                                    }}
                                                    title={(() => {
                                                        const titles: Record<string, string> = {
                                                            'cinza': 'Sem Reputação',
                                                            'verde_sem_reputacao': 'Verde',
                                                            'amarela': 'Amarela',
                                                            'laranja': 'Laranja',
                                                            'vermelha': 'Vermelha'
                                                        };
                                                        return titles[key];
                                                    })()}
                                                />
                                            ))}
                                        </div>
                                        
                                        {/* Status atual - sem fundo */}
                                        <div style={{ 
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: (() => {
                                                    const cores: Record<string, string> = {
                                                        'cinza': '#6b7280',
                                                        'verde_sem_reputacao': '#22c55e',
                                                        'amarela': '#eab308',
                                                        'laranja': '#f97316',
                                                        'vermelha': '#ef4444'
                                                    };
                                                    return cores[inputs.reputacao || 'cinza'];
                                                })()
                                            }} />
                                            <span style={{
                                                fontWeight: 500,
                                                fontSize: '0.8rem',
                                                color: '#4b5563'
                                            }}>
                                                {(() => {
                                                    const labels: Record<string, string> = {
                                                        'cinza': 'Sem Reputação',
                                                        'verde_sem_reputacao': 'Reputação Verde',
                                                        'amarela': 'Reputação Amarela',
                                                        'laranja': 'Reputação Laranja',
                                                        'vermelha': 'Reputação Vermelha'
                                                    };
                                                    return labels[inputs.reputacao || 'cinza'];
                                                })()}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px dashed rgba(139, 92, 246, 0.2)',
                                        opacity: 0.8
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#6d28d9', fontWeight: 700 }}>
                                                <Zap size={16} /> Sensor de Otimização
                                            </label>
                                            <span className="input-hint" style={{ margin: 0, fontSize: '0.75rem' }}>Sugere preços estratégicos e alavancagem de giro</span>
                                        </div>
                                        <div className="toggle-switch-premium">
                                            <input
                                                type="checkbox"
                                                id="fatorAlavancagemAtivoCheck"
                                                name="fatorAlavancagemAtivo"
                                                checked={inputs.fatorAlavancagemAtivo !== false}
                                                onChange={handleChange}
                                            />
                                            <label htmlFor="fatorAlavancagemAtivoCheck" className="switch-slider"></label>
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label><RefreshCcw size={16} /> Fator de Alavancagem (Giro)</label>
                                        <div className="input-with-icon">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="fatorAlavancagem"
                                                placeholder="5,00"
                                                value={getInputValue('fatorAlavancagem', inputs.fatorAlavancagem)}
                                                onFocus={() => handleFocus('fatorAlavancagem', inputs.fatorAlavancagem)}
                                                onChange={handleChange}
                                                style={{ color: 'var(--primary-main)', fontWeight: 'bold' }}
                                            />
                                        </div>
                                        <span className="input-hint">Ex: {(inputs.fatorAlavancagem ?? 5).toFixed(0).replace('.', ',')}x significa que para cada R$ 1 perdido, o cliente ganha R$ {(inputs.fatorAlavancagem ?? 5).toFixed(0).replace('.', ',')} de desconto.</span>
                                    </div>

                                    <div className="input-section-title">Impostos e Custos Fixos</div>

                                    <div className="input-group">
                                        <label><ShieldCheck size={16} /> Imposto {s('IMP')}</label>
                                        <div className="input-composite">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="impostoPorcentagem"
                                                className="input-main"
                                                placeholder="0,00"
                                                value={getInputValue('impostoPorcentagem', inputs.impostoPorcentagem)}
                                                onFocus={() => handleFocus('impostoPorcentagem', inputs.impostoPorcentagem)}
                                                onChange={handleChange}
                                            />
                                            <select name="impostoTipo" value={inputs.impostoTipo} onChange={handleChange} className="input-unit">
                                                <option value="porcentagem">%</option>
                                                <option value="fixo">R$</option>
                                            </select>
                                        </div>
                                        <span className="input-hint">Alíquota efetiva de impostos (Simples/DAS)</span>
                                    </div>



                                    <div className="input-group">
                                        <label><RotateCcw size={16} /> Despesa fixa {s('DF')}</label>
                                        <div className="input-composite">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="despesaFixa"
                                                className="input-main"
                                                placeholder="0,00"
                                                value={getInputValue('despesaFixa', inputs.despesaFixa)}
                                                onFocus={() => handleFocus('despesaFixa', inputs.despesaFixa)}
                                                onChange={handleChange}
                                            />
                                            <select name="despesaFixaTipo" value={inputs.despesaFixaTipo} onChange={handleChange} className="input-unit">
                                                <option value="porcentagem">%</option>
                                                <option value="fixo">R$</option>
                                            </select>
                                        </div>
                                        <span className="input-hint">Custos fixos mensais rateados</span>
                                    </div>

                                    <div className="input-group">
                                        <label><Calculator size={16} /> Outras Despesas {s('OD')}</label>
                                        <div className="input-composite">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="despesaAdicional"
                                                className="input-main"
                                                placeholder="0,00"
                                                value={getInputValue('despesaAdicional', inputs.despesaAdicional)}
                                                onFocus={() => handleFocus('despesaAdicional', inputs.despesaAdicional)}
                                                onChange={handleChange}
                                            />
                                            <select name="despesaAdicionalTipo" value={inputs.despesaAdicionalTipo} onChange={handleChange} className="input-unit">
                                                <option value="porcentagem">%</option>
                                                <option value="fixo">R$</option>
                                            </select>
                                        </div>
                                        <span className="input-hint">Outros custos variáveis não previstos</span>
                                    </div>

                                    <div className="input-section-title">Marketing e Descontos</div>

                                    <div className="input-group">
                                        <label><RefreshCcw size={16} /> Ads (Marketing) {s('ADS')}</label>
                                        <div className="input-composite">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="adsValor"
                                                className="input-main"
                                                placeholder="0,00"
                                                value={getInputValue('adsValor', inputs.adsValor)}
                                                onFocus={() => handleFocus('adsValor', inputs.adsValor)}
                                                onChange={handleChange}
                                            />
                                            <select name="adsTipo" value={inputs.adsTipo} onChange={handleChange} className="input-unit">
                                                <option value="porcentagem">%</option>
                                                <option value="fixo">R$</option>
                                            </select>
                                        </div>
                                        <span className="input-hint">Investimento direto em Mercado Ads</span>
                                    </div>
                                </div>
                            )}

                            <div className="actions" style={{ display: 'flex', flexDirection: 'column', marginTop: '1.5rem' }}>
                                <button
                                    className="btn-primary"
                                    style={{
                                        width: '100%',
                                        background: '#ee4d2d',
                                        borderColor: '#ee4d2d',
                                        marginBottom: '0.5rem',
                                        fontWeight: 'bold',
                                        fontSize: '1.1rem',
                                        padding: '0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onClick={handleCalcular}
                                    disabled={isCalculating}
                                >
                                    {isCalculating ? (
                                        <RefreshCcw size={22} className="animate-spin" />
                                    ) : (
                                        <Calculator size={22} />
                                    )}
                                    {isCalculating ? ' CALCULANDO...' : ' CALCULAR MARGEM'}
                                </button>

                                <button className="btn-outline" style={{ width: '100%' }} onClick={handleLimpar}>
                                    <RotateCcw size={18} /> Reiniciar Calculadora
                                </button>

                                <Link to="/meli/lote" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: '#3b82f6', borderColor: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Table size={18} /> Processar Lote (CSV)
                                </Link>
                            </div>
                        </div> {/* Fim parameters-grid */}
                    </div> {/* Fim card */}
                </div> {/* Fim calculator-left */}


                <div className="calculator-right">
                    {/* ── Abas de Tipo de Anúncio ── */}
                    {results && modoCalculo === 'ambos' && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1.5rem',
                            marginBottom: '1.5rem'
                        }}>
                            {(['classico', 'premium'] as const).map((tipo) => {
                                const isActive = inputs.tipoAnuncio === tipo;
                                const isClassico = tipo === 'classico';
                                // Calcula valores para cada tipo - usa preço específico quando modo é 'ambos'
                                const paEspecifico = isClassico 
                                    ? inputs.precoAnunciadoClassico 
                                    : inputs.precoAnunciadoPremium;
                                const inputsCalc = { 
                                    ...inputs, 
                                    tipoAnuncio: tipo,
                                    precoVenda: paEspecifico || inputs.precoVenda // Usa preço específico se disponível
                                };
                                const resultadoTipo = aba === 'margem'
                                    ? calcularTaxasMeli(inputsCalc)
                                    : calcularTaxasMeli({ ...inputsCalc, precoVenda: calcularPrecoIdealMeli(inputsCalc, margemDesejada, tipoMargemIdeal === 'reais' ? 'venda' : tipoMargemIdeal) });
                                const lucroTipo = resultadoTipo.lucroLiquido;
                                const margemTipo = resultadoTipo.margemSobreVenda;
                                const paTipo = resultadoTipo.precoAnunciado;
                                const dcDeTipo = resultadoTipo.descontoCadastroValorDe;
                                const dcPorTipo = resultadoTipo.descontoCadastroValorPor;
                                const dcValorTipo = resultadoTipo.descontoCadastroValor;

                                return (
                                    <button
                                        key={tipo}
                                        onClick={() => {
                                            setInputs(prev => ({ ...prev, tipoAnuncio: tipo }));
                                            if (results) {
                                                setTimeout(() => {
                                                    const inputsAtualizados = { ...inputs, tipoAnuncio: tipo };
                                                    const res = aba === 'margem'
                                                        ? calcularTaxasMeli(inputsAtualizados)
                                                        : calcularTaxasMeli({ ...inputsAtualizados, precoVenda: calcularPrecoIdealMeli(inputsAtualizados, margemDesejada, tipoMargemIdeal === 'reais' ? 'venda' : tipoMargemIdeal) });
                                                    const tipoBase: 'custo' | 'venda' = tipoMargemIdeal === 'reais' ? 'venda' : tipoMargemIdeal;
                                                    const sim = simularCenariosPrecoMeli(inputsAtualizados, isAutoCalcMode ? res.margemSobreVenda : margemDesejada, tipoBase);
                                                    const pIdeal15 = calcularPrecoIdealMeli(inputsAtualizados, 15, tipoBase);
                                                    const resIdeal15 = calcularTaxasMeli({ ...inputsAtualizados, precoVenda: pIdeal15 });
                                                    setSimulacao({ ...sim, pAlvo: sim.pontoIdeal, pIdeal15: { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.taxaFixa + resIdeal15.freteGratisValor) / (resIdeal15.precoVenda || 1) * 100 } } as any);
                                                    setResults(res);
                                                    const msv = res.margemSobreVenda;
                                                    if (msv <= 0) { setStatusClass('status-red'); setStatusText('Prejuízo!'); setStatusIcon(<AlertCircle size={24} />); }
                                                    else if (msv < 15) { setStatusClass('status-orange'); setStatusText('Atenção: Margem abaixo do ideal (15%)'); setStatusIcon(<AlertTriangle size={24} />); }
                                                    else { setStatusClass('status-green'); setStatusText('Parabéns: Sua margem está saudável!'); setStatusIcon(<CheckCircle2 size={24} />); }
                                                }, 0);
                                            }
                                        }}
                                        style={{
                                            padding: '1.25rem',
                                            borderRadius: '12px',
                                            border: isActive
                                                ? `3px solid ${isClassico ? '#3b82f6' : '#f59e0b'}`
                                                : '2px solid #cbd5e1',
                                            background: isActive
                                                ? (isClassico
                                                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                                                    : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)')
                                                : '#ffffff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isActive
                                                ? `0 8px 20px ${isClassico ? 'rgba(59, 130, 246, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
                                                : '0 2px 8px rgba(0,0,0,0.06)',
                                            textAlign: 'left',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
                                                e.currentTarget.style.borderColor = isClassico ? '#93c5fd' : '#fcd34d';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                                                e.currentTarget.style.borderColor = '#cbd5e1';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            {isClassico ? <Tag size={18} color={isActive ? '#3b82f6' : '#94a3b8'} /> : <Award size={18} color={isActive ? '#f59e0b' : '#94a3b8'} />}
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                                color: isActive ? (isClassico ? '#1d4ed8' : '#b45309') : '#94a3b8'
                                            }}>
                                                {isClassico ? 'CLÁSSICO' : 'PREMIUM'}
                                            </span>
                                            {isActive && (
                                                <input
                                                    type="checkbox"
                                                    checked={isActive}
                                                    readOnly
                                                    style={{
                                                        marginLeft: 'auto',
                                                        width: '18px',
                                                        height: '18px',
                                                        accentColor: isClassico ? '#3b82f6' : '#f59e0b'
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>PREÇO ANUNCIADO {s('PA')}</span>
                                            {dcValorTipo > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{
                                                        fontSize: '1.4rem',
                                                        color: '#94a3b8',
                                                        fontWeight: 500
                                                    }}>
                                                        De: R$ {moeda(dcDeTipo)}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600 }}>{s('PDC')}</span>
                                                </div>
                                            )}
                                            <span style={{
                                                fontSize: '1.5rem',
                                                fontWeight: 800,
                                                color: isActive ? (isClassico ? '#1d4ed8' : '#b45309') : '#64748b'
                                            }}>
                                                Por: R$ {moeda(dcPorTipo)}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: `1px solid ${isActive ? (isClassico ? '#bfdbfe' : '#fde68a') : '#e2e8f0'}` }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>LUCRO</span>
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: 700,
                                                    color: lucroTipo >= 0 ? '#10B981' : '#EF4444'
                                                }}>
                                                    R$ {moeda(lucroTipo)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>MARGEM</span>
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: 700,
                                                    color: margemTipo >= 15 ? '#10B981' : margemTipo >= 0 ? '#f59e0b' : '#EF4444'
                                                }}>
                                                    {margemTipo.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: isActive ? (isClassico ? '#3b82f6' : '#f59e0b') : '#94a3b8',
                                            fontWeight: 500,
                                            marginTop: '0.25rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <MousePointer2 size={12} />
                                            {'Clique para comparar'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* --- Resultados lado a lado quando modo for 'ambos' --- */}
                    {resultsClassico && resultsPremium && modoCalculo === 'ambos' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            {/* Cards removidos - agora mostra apenas o resultado principal */}
                        </div>
                    )}

                    {!results ? (
                        <div className="empty-results-card">
                            <div className="empty-results-content">
                                <div className="empty-results-icon-container">
                                    <div className="empty-results-icon-pulse"></div>
                                    <Sparkles size={48} className="empty-results-icon" style={{ color: '#F3D148' }} />
                                </div>
                                <h3>Pronto para Calcular?</h3>
                                <p>Insira os dados do seu produto ao lado para ver uma análise detalhada de margem e lucro no Mercado Livre.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="results-display-area">
                            <div className={`alert-box-result ${statusClass}`}>
                                {statusIcon} <span>{statusText}</span>
                            </div>

                            <div className="premium-results-grid" style={{ 
                                marginTop: '1rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '1rem'
                            }}>
                                {/* Card PDV - Preço de Venda */}
                                <div className="result-card primary" style={{
                                    backgroundColor: results.margemSobreVenda <= 0 ? '#fef2f2' : (results.margemSobreVenda < 15 ? '#fff7ed' : '#f0fdf4'),
                                    borderColor: results.margemSobreVenda <= 0 ? '#fecaca' : (results.margemSobreVenda < 15 ? '#fed7aa' : '#bbf7d0'),
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                }}>
                                    <div className="result-label" style={{
                                        color: results.margemSobreVenda <= 0 ? '#991b1b' : (results.margemSobreVenda < 15 ? '#9a3412' : '#166534')
                                    }}>
                                        {aba === 'ideal' ? <>PREÇO DE VENDA IDEAL {s('PDVI')}</> : <>PREÇO DE VENDA {s('PDV')}</>}
                                    </div>
                                    <div className="result-value" style={{
                                        color: results.margemSobreVenda <= 0 ? '#dc2626' : (results.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                                    }}>
                                        R$ {moeda(results.precoVenda)}
                                    </div>
                                    <div className="result-sub" style={{
                                        color: results.margemSobreVenda <= 0 ? '#b91c1c' : (results.margemSobreVenda < 15 ? '#c2410c' : '#15803d'),
                                        opacity: 1,
                                        fontWeight: 600
                                    }}>
                                        {aba === 'ideal' ? "Melhor preço identificado" : "Valor sem cupom"}
                                    </div>
                                    <ShoppingCart size={24} className="card-icon" style={{
                                        opacity: 0.1,
                                        color: results.margemSobreVenda <= 0 ? '#dc2626' : (results.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                                    }} />
                                </div>

                                {/* Card PA - Preço Anunciado */}
                                <div className="result-card secondary" style={{
                                    backgroundColor: '#eff6ff',
                                    borderColor: '#bfdbfe'
                                }}>
                                    <div className="result-label" style={{ color: '#1e3a8a' }}>
                                        {aba === 'ideal' ? <>PREÇO IDEAL ANUNCIADO {s('PIA')}</> : <>PREÇO ANUNCIADO {s('PA')}</>}
                                    </div>
                                    <div className="result-value" style={{ color: '#1e40af' }}>
                                        R$ {moeda(results.precoAnunciado)}
                                    </div>
                                    <div className="result-sub" style={{ color: '#1e40af', opacity: 1 }}>
                                        Valor exibido na vitrine
                                    </div>
                                    <TrendingUp size={24} className="card-icon" style={{
                                        opacity: 0.1,
                                        color: '#3b82f6'
                                    }} />
                                </div>

                                {/* Card PDC - Preço de Cadastro */}
                                {results.descontoCadastroValor > 0 && (
                                    <div className="result-card" style={{
                                        backgroundColor: '#f5f3ff',
                                        borderColor: '#c4b5fd'
                                    }}>
                                        <div className="result-label" style={{ color: '#6b21a8' }}>
                                            <>PREÇO DE CADASTRO {s('PDC')}</>
                                        </div>
                                        <div className="result-value" style={{ color: '#7c3aed' }}>
                                            R$ {moeda(results.descontoCadastroValorDe)}
                                        </div>
                                        <div className="result-sub" style={{ color: '#7c3aed', opacity: 1 }}>
                                            Valor original
                                        </div>
                                        <Tag size={24} className="card-icon" style={{
                                            opacity: 0.1,
                                            color: '#8b5cf6'
                                        }} />
                                    </div>
                                )}
                            </div>

                            
                            <div className="details">
                                <div className="details-group-header" style={{ marginTop: '0', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', color: '#1e3a8a' }}>
                                    Demonstração do Resultado do Exercício (DRE)
                                </div>
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '1.5rem',
                                    background: '#f8fafc',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.95rem', color: '#1e40af', fontWeight: 700 }}>Lucro líquido venda:</span>
                                            <span style={{ fontSize: '0.95rem', color: '#1e40af', fontWeight: 700 }}>({porc(results.margemSobreVenda)}%)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.95rem', color: '#c2410c', fontWeight: 700 }}>Lucro líquido custo:</span>
                                            <span style={{ fontSize: '0.95rem', color: '#c2410c', fontWeight: 700 }}>({porc(results.margemSobreCusto)}%)</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lucro Líquido Final</div>
                                        <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1, whiteSpace: 'nowrap' }}>R$ {moeda(results.lucroLiquido)}</div>
                                    </div>
                                </div>

                                {/* Linha de Preço de Cadastro - valor original com desconto */}
                                {results.descontoCadastroValor > 0 && (
                                    <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 700 }}>Preço de cadastro {s('PC')}:</span>
                                        <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results.descontoCadastroValorDe)}</span>
                                    </div>
                                )}

                                {results.descontoCadastroValor > 0 && (
                                    <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                                        <span>Desconto no cadastro {s('DC')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.descontoCadastroValor || 0) / (results.descontoCadastroValorDe || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.descontoCadastroValor)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 700 }}>Preço Anunciado {s('PA')}:</span>
                                    <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results.precoAnunciado)}</span>
                                </div>

                                {results.cupomValor > 0 && (
                                    <div className="detail-row" style={{ marginBottom: '0.5rem' }}>
                                        <span>Desconto aplicado {s('CD')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.cupomValor || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.cupomValor)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '2px dashed #cbd5e1', marginBottom: '1rem' }}>
                                    <span style={{ fontWeight: 700 }}>Preço de Venda {s('PDV')}:</span>
                                    <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results.precoVenda)}</span>
                                </div>

                                <div className="details-group-header">Política do Mercado Livre {s('PDS')}</div>
                                <div className="detail-row">
                                    <span>Comissão Mercado Livre ({tipoAnuncioCalculado === 'premium' ? '17%' : '12%'}) {s('CML')}:</span>
                                    <div className="detail-values">
                                        <span className="perc">{tipoAnuncioCalculado === 'premium' ? '17%' : '12%'}</span>
                                        <span className="val text-red">- R$ {moeda(results.comissaoValor)}</span>
                                    </div>
                                </div>
                                {(results.taxaFixa ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Tarifa Fixa Mercado Livre {s('TFM')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.taxaFixa || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.taxaFixa)}</span>
                                        </div>
                                    </div>
                                )}
                                {(results.freteGratisValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Frete Grátis Mercado Livre {s('FG')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.freteGratisValor || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.freteGratisValor)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="details-group-header">Política da LCG {s('PDL')}</div>
                                <div className="detail-row">
                                    <span>Custo do Produto {s('CDP')}:</span>
                                    <div className="detail-values">
                                        <span className="perc">({porc((inputs.custoProduto || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                        <span className="val text-red">- R$ {moeda(inputs.custoProduto)}</span>
                                    </div>
                                </div>
                                {(results.impostoValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Imposto {s('IMP')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.impostoValor || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.impostoValor)}</span>
                                        </div>
                                    </div>
                                )}
                                {(results.custoAds ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Ads Mercado Livre {s('ADS')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.custoAds || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.custoAds)}</span>
                                        </div>
                                    </div>
                                )}
                                {(results.despesaFixaValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Despesa fixa {s('DF')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.despesaFixaValor || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.despesaFixaValor)}</span>
                                        </div>
                                    </div>
                                )}
                                {(results.despesaAdicionalValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Outras Despesas {s('OD')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.despesaAdicionalValor || 0) / (results.precoAnunciado || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.despesaAdicionalValor || 0)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="result-card mini large" style={{ marginTop: '0.75rem' }}>
                                <div className="result-header">
                                    {results.margemSobreVenda >= 15 ? (
                                        <ArrowUpRight size={18} className="text-green" />
                                    ) : (
                                        <ArrowDownRight size={18} className="text-red" />
                                    )} Margem de Contribuição {s('MC')}
                                </div>
                                <div className="result-body">
                                    <span className={`percentage ${results.margemSobreVenda <= 0 ? 'text-red' :
                                        results.margemSobreVenda < 15 ? 'text-orange' : 'text-green'
                                        }`}>
                                        {(() => {
                                            const mc = ((results.precoAnunciado - results.lucroLiquido) / (results.precoAnunciado || 1)) * 100;
                                            return arredondar(100 - mc, 2).toFixed(2).replace('.', ',');
                                        })()}%
                                    </span>
                                    <span className="nominal">R$ {arredondar((results.precoAnunciado - results.custoProdutoValor) || 0, 2).toFixed(2).replace('.', ',')}</span>
                                </div>
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
                            <ComposicaoPrecoChart res={results!} />
                            <div style={{ display: 'flex', alignItems: 'start', gap: '10px', marginTop: '1.5rem', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                                <Info size={18} style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                                    Este gráfico mostra como cada real do faturamento é distribuído. O <strong>Lucro Líquido (Verde)</strong> é o que realmente sobra no seu bolso.
                                </p>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '20px' }}>
                            <EstrategiaPrecoChart
                                dados={simulacao!.cenarios}
                                precoAtual={results!.precoVenda}
                                pontoIdeal={simulacao!.pontoIdeal}
                                pontoAlvo={simulacao!.pAlvo || simulacao!.pontoIdeal}
                                onPriceSelect={(p) => setInputs(prev => ({ ...prev, precoVenda: p }))}
                                isFullscreen={isFullscreenStrategy}
                                onToggleFullscreen={() => setIsFullscreenStrategy(!isFullscreenStrategy)}
                            />
                        </div>
                    </div>

                    <div className="card" style={{ padding: '20px' }}>
                        <TaxasPrecoChart
                            inputs={inputs}
                            precoAtual={results!.precoVenda}
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
                        <div className="modal-icon-container">
                            <RotateCcw size={32} />
                        </div>
                        <h3 className="modal-title">Limpar Dados?</h3>
                        <p className="modal-description">Deseja zerar todos os campos e tabelas desta calculadora?</p>
                        <div className="modal-actions">
                            <button className="btn-modal-cancel" onClick={() => setIsResetModalOpen(false)}>Cancelar</button>
                            <button className="btn-modal-confirm" onClick={confirmReset}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {notification?.show && (
                <div className={`toast-notification ${notification.type} slide-up`}>
                    {notification.type === 'success' && <CheckCircle2 size={18} />}
                    {notification.type === 'error' && <AlertCircle size={18} />}
                    {notification.type === 'info' && <TrendingUp size={18} />}
                    <span>{notification.message}</span>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .toast-notification { 
                    position: fixed; 
                    bottom: 2rem; 
                    right: 2rem; 
                    padding: 1rem 1.5rem; 
                    border-radius: 12px; 
                    background: #1e293b; 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2); 
                    z-index: 10002; 
                    font-weight: 600; 
                    font-size: 0.95rem; 
                    border: 1px solid rgba(255,255,255,0.1); 
                }
                .toast-notification.error { background: #ef4444; border-color: #f87171; }
                .toast-notification.success { background: #10b981; border-color: #34d399; }
                .toast-notification.info { background: #3b82f6; border-color: #60a5fa; }
                
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .slide-up { animation: slideUp 0.3s ease-out; }
            `}} />
        </div>

    );
};

export default MeliPage;
