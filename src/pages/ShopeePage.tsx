import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Calculator,
    CircleDollarSign,
    AlertCircle,
    AlertTriangle,
    RotateCcw,
    Sparkles,
    RefreshCcw,
    ShoppingCart,
    TrendingUp,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle2,
    Maximize2,
    Minimize2,
    HelpCircle,
    ChevronDown,
    ShieldCheck,
    Lock,
    Table,
    Search,
    Plus,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Area, Line, ReferenceLine
} from 'recharts';
import type { ShopeeInput, ShopeeOutput, CenarioPreco, OtimizacaoPrecoResult /* , ResultadoSweetSpot */ } from '../utils/shopeeLogic';
import { getUserCatalog } from '../services/catalogService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Componente de Insight de Preço (Sweet Spot)
 */
/* Componente desativado
const CardInsightPreco = ({ input }: { input: ShopeeInput }) => {
    ...
};
*/
import { logCalculo, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { calcularTaxasShopee, calcularPrecoIdeal, calcularPrecoIdealDetalhado, simularCenariosPreco, arredondar } from '../utils/shopeeLogic';

const moeda = (val: number | undefined | null) => arredondar(val || 0, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Formata número como porcentagem com 2 casas decimais
const porc = (val: number | undefined | null) => arredondar(val || 0, 2).toFixed(2).replace('.', ',');

// =============================================================
// COMPONENTES DE GRÁFICO — Removidos
// =============================================================


const defaultInputs: ShopeeInput = {
    custoProduto: undefined,
    precoVenda: undefined,
    despesaFixa: undefined,
    despesaFixaTipo: 'porcentagem',
    despesaAdicional: undefined,
    despesaAdicionalTipo: 'porcentagem',
    impostoPorcentagem: undefined,
    impostoTipo: 'porcentagem',
    adsValor: undefined,
    adsTipo: 'porcentagem',
    rebatePorcentagem: undefined,
    rebateTipo: 'porcentagem',
    cupomDesconto: undefined,
    cupomTipo: 'porcentagem',
    fatorAlavancagem: undefined
};

const ShopeePage: React.FC = () => {
    const [aba, setAba] = useState<'margem' | 'ideal'>('ideal');
    const [tipoMargemIdeal, setTipoMargemIdeal] = useState<'venda' | 'custo' | 'reais'>('custo');
    const [inputs, setInputs] = useState<ShopeeInput>(defaultInputs);
    const [margemDesejada, setMargemDesejada] = useState<number | undefined>(undefined);
    const [results, setResults] = useState<ShopeeOutput | null>(null);
    const [lastCalculatedInputs, setLastCalculatedInputs] = useState<ShopeeInput | null>(null);
    const [simulacao, setSimulacao] = useState<any>(null);
    const [otimizacaoIdeal, setOtimizacaoIdeal] = useState<OtimizacaoPrecoResult | null>(null);
    // const [sweetSpot, setSweetSpot] = useState<ResultadoSweetSpot | null>(null);


    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [qtdMultiplier, setQtdMultiplier] = useState<number | string>(1);

    // Sistema de Notificações Toast
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info'; show: boolean } | null>(null);

    const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setNotification({ message, type, show: true });
        setTimeout(() => {
            setNotification(prev => prev ? { ...prev, show: false } : null);
        }, 5000);
    };

    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    // Estado da barra de pesquisa de Catálogo
    const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [catalogPage, setCatalogPage] = useState(1);
    // Produto selecionado da busca (exibido como chip de referência)
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<{ sku: string; descricao: string; _wh: string } | null>(null);

    const [focusedValue, setFocusedValue] = useState<string>('');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

    // Sistema de Autenticação Centralizado
    const { user, userLevel, loading } = useAuth();
    const isLevel3 = !loading && userLevel === 3;

    // Estados auxiliares de senha
    const [isPasswordAuthorized, setIsPasswordAuthorized] = useState<boolean>(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
    const [passwordInput, setPasswordInput] = useState<string>('');
    const [isVerifyingPassword, setIsVerifyingPassword] = useState<boolean>(false);
    const [passwordError, setPasswordError] = useState<boolean>(false);
    const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            const loadUserData = async () => {
                try {
                    const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'shopee');
                    const userSettingsSnap = await getDoc(userSettingsRef);

                    if (userSettingsSnap.exists()) {
                        const data = userSettingsSnap.data();
                        if (data.aba) setAba(data.aba);
                        if (data.tipoMargemIdeal) setTipoMargemIdeal(data.tipoMargemIdeal);
                        if (data.isAdvancedOpen !== undefined) setIsAdvancedOpen(data.isAdvancedOpen);
                        isInitialLoadDone.current = true;
                    }

                    const [cloudSP, cloudSC] = await Promise.all([
                        getUserCatalog(user.uid, 'SP'),
                        getUserCatalog(user.uid, 'SC')
                    ]);

                    const combined = [
                        ...cloudSP.map((p: any) => ({ ...p, _wh: 'SP' })),
                        ...cloudSC.map((p: any) => ({ ...p, _wh: 'SC' }))
                    ];
                    setCatalogProducts(combined);
                } catch (error) {
                    console.error("Erro ao carregar dados do usuário:", error);
                }
            };
            loadUserData();
        } else {
            const sp = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SP') || '[]');
            const sc = JSON.parse(localStorage.getItem('@shopperPCC:catalog_SC') || '[]');
            const combined = [
                ...sp.map((p: any) => ({ ...p, _wh: 'SP' })),
                ...sc.map((p: any) => ({ ...p, _wh: 'SC' }))
            ];
            setCatalogProducts(combined);
        }
    }, [user]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isVerifyingPassword) return;

        setIsVerifyingPassword(true);
        setPasswordErrorMessage(null);

        try {
            console.log("Iniciando verificação de senha no Firestore...");
            // Consulta a senha no Firestore (caminho: config/access)
            const docRef = doc(db, 'config', 'access');
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.warn("Documento 'config/access' não encontrado no Firestore.");
                setPasswordErrorMessage("Configuração não encontrada no servidor.");
                throw new Error('Documento não encontrado');
            }

            const data = docSnap.data();
            if (passwordInput === data.password) {
                console.log("Senha validada com sucesso via Firestore.");
                setIsPasswordAuthorized(true);
                setShowPasswordPrompt(false);
                setIsAdvancedOpen(true);
                setPasswordError(false);
                setPasswordInput('');
            } else {
                console.warn("Senha digitada incorreta.");
                setPasswordErrorMessage("Senha incorreta.");
                throw new Error('Senha inválida');
            }
        } catch (error: any) {
            console.error("Erro ao verificar senha no Firestore:", error);

            // Tratamento específico para o erro de banco não encontrado (comum se não foi ativado no console)
            if (error.message?.includes('Database') && error.message?.includes('not found')) {
                setPasswordErrorMessage("O banco de dados Firestore não foi ativado no seu projeto Firebase Console. É necessário criar o banco '(default)' lá.");
            } else if (error.code === 'permission-denied') {
                setPasswordErrorMessage("Erro de permissão. Verifique as 'Rules' do Firestore no console.");
            } else {
                setPasswordErrorMessage("Erro ao conectar com o servidor.");
            }

            setPasswordError(true);
            setTimeout(() => {
                setPasswordError(false);
                // Mantemos a mensagem por 10 segundos para dar tempo de ler
                setTimeout(() => setPasswordErrorMessage(null), 10000);
            }, 500);
        } finally {
            setIsVerifyingPassword(false);
        }
    };

    // Sair do fullscreen com a tecla ESC (Mantido por compatibilidade se houver modais futuros)
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Futuros modais podem usar isso
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const getInputValue = (name: string, value: any) => {
        if (focusedInput === name) {
            return focusedValue;
        }
        if (value === undefined || value === null || value === '') return '';

        // Se for margem desejada (venda ou custo), pegamos do estado específico
        if (name === 'margemDesejada' || name === 'margemDesejadaMSC' || name === 'margemDesejada2') {
            return (typeof margemDesejada === 'number' && !isNaN(margemDesejada)) ? arredondar(margemDesejada, 2).toFixed(2).replace('.', ',') : '';
        }

        // Força conversão para número caso venha como string do localStorage
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

        return (typeof num === 'number' && !isNaN(num)) ? arredondar(num, 2).toFixed(2).replace('.', ',') : '';
    };

    const s = (key: string) => <span style={{ color: '#7c3aed', fontWeight: 600, marginLeft: '4px' }}>[{key}]</span>;

    const isInitialLoadDone = useRef(false);

    // Efeito para salvar configurações no Firestore com Debounce - APENAS CONFIGURAÇÕES (não inputs)
    useEffect(() => {
        if (!user || !isInitialLoadDone.current) return;

        // Debounce para não sobrecarregar o Firestore
        const timer = setTimeout(async () => {
            try {
                console.log("Salvando configurações no Firestore...");
                const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'shopee');
                await setDoc(userSettingsRef, {
                    aba,
                    tipoMargemIdeal,
                    // inputs removido - persistência apenas por sessão
                    // margemDesejada removido - persistência apenas por sessão
                    isAdvancedOpen,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log("Salvo com sucesso!");
            } catch (error) {
                console.error("Erro ao salvar configurações no Firestore:", error);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [aba, tipoMargemIdeal, isAdvancedOpen, user]);

    // Função mantida por compatibilidade com onBlur de inputs, mas sem ação em modo manual
    const triggerCalculation = () => {
        // Modo manual: cálculo só via botão. Não executa nada aqui.
    };

    // Persistência removida - dados duram apenas a sessão
    // Os inputs são perdidos quando a página é recarregada


    const updateNumericValue = (name: string, val: number | undefined) => {
        if (name === 'margemDesejada' || name === 'margemDesejada2' || name === 'margemDesejadaMSC') {
            setMargemDesejada(val);
        } else {
            // Regra: Mínimo de 2.0 para o fator de alavancagem
            let finalVal = val;
            if (name === 'fatorAlavancagem' && val !== undefined && val < 2) {
                finalVal = 2;
            }

            setInputs((prev) => ({
                ...prev,
                [name]: finalVal,
            }));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, type } = target;

        if (type === 'checkbox') {
            setInputs(prev => ({ ...prev, [name]: target.checked }));
            return;
        }

        const val = target.value;

        // Todos os campos exceto os que terminam em 'Tipo' ou a aba são numéricos
        const constitutesNumber = !name.endsWith('Tipo') && name !== 'aba' && name !== 'tipoMargemIdeal' && name !== 'status';

        if (constitutesNumber && target.tagName === 'INPUT') {
            // Máscara Financeira: remove tudo que não for dígito e trata como centavos
            const digits = val.replace(/\D/g, '');

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
            // Lógica para select e outros campos não mascarados
            if (focusedInput === name) {
                setFocusedValue(val);
            }

            if (name === 'aba') {
                setAba(val as any);
            } else if (name === 'tipoMargemIdeal') {
                setTipoMargemIdeal(val as any);
            } else {
                setInputs((prev) => ({
                    ...prev,
                    [name]: val,
                }));
            }
        }
    };

    // Prevenir scroll nos inputs
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        (e.target as HTMLInputElement).blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCalcular();
        }
    };

    const handleCalcular = () => {
        setIsCalculating(true);

        // Simulação de processamento para feedback visual (800ms conforme solicitado)
        setTimeout(() => {
            executarCalculo();
            setIsCalculating(false);
        }, 800);
    };

    const executarCalculo = () => {
        let resultado: ShopeeOutput;
        let precoFinalStr = "";

        const inputsCalc = {
            ...inputs,
            custoProduto: inputs.custoProduto !== undefined ? inputs.custoProduto * (Number(qtdMultiplier) || 1) : undefined
        };

        // 1. Determina o resultado principal (DRE) - Sempre baseado no PA manual do usuário
        if (aba === 'margem') {
            if (inputsCalc.precoVenda === undefined) {
                setResults(null);
                return;
            }
            resultado = calcularTaxasShopee(inputsCalc);
            precoFinalStr = resultado.precoComCupom.toFixed(2);
        } else {
            if (inputsCalc.custoProduto === undefined) {
                setResults(null);
                return;
            }
            // No modo Ideal, primeiro pegamos o preço alvo detalhado
            const detalhesIdeal = calcularPrecoIdealDetalhado(inputsCalc, margemDesejada, tipoMargemIdeal);

            // Se encontrou uma redução esperta que aumenta lucro, armazena no state pra exibir
            if (detalhesIdeal.isOtimizado) {
                setOtimizacaoIdeal(detalhesIdeal);
            } else {
                setOtimizacaoIdeal(null);
            }

            // Arredondar para 2 casas para bater com a entrada manual e evitar dízimas periódicas no cálculo
            const pIdeal = arredondar(detalhesIdeal.precoOtimizado, 2);

            resultado = calcularTaxasShopee({ ...inputsCalc, precoVenda: pIdeal });
            precoFinalStr = pIdeal.toFixed(2);

            // Notificar se houve otimização
            if (detalhesIdeal.isOtimizado) {
                const msg = detalhesIdeal.isAlavancagem
                    ? "Sensor de Otimização: Estratégia de Giro (Alavancagem) aplicada!"
                    : "Sensor de Otimização: Sweet Spot encontrado para aumentar seu lucro!";
                notify(msg, "success");
            }
        }

        // 2. Com o resultado em mãos, gera a simulação analítica para os gráficos
        // IDEAL: Agora fixo em 15% conforme solicitado pelo usuário
        const pIdeal15 = calcularPrecoIdeal(inputsCalc, 15, tipoMargemIdeal);
        const resIdeal15 = calcularTaxasShopee({ ...inputsCalc, precoVenda: pIdeal15 });

        const margemReferencia = margemDesejada ?? 0;
        const sim = simularCenariosPreco({ ...inputsCalc, precoVenda: parseFloat(precoFinalStr) }, margemReferencia, tipoMargemIdeal);

        // 3. Injeção de Pontos Críticos para Interatividade no Gráfico
        const pAtualVal = parseFloat(precoFinalStr) || 0;
        const resAtual = calcularTaxasShopee({ ...inputsCalc, precoVenda: pAtualVal });

        const pontosExtras: CenarioPreco[] = [
            { ...resAtual, pesoTaxas: (resAtual.comissaoValor + resAtual.tarifaFixa + resAtual.impostoValor + resAtual.custoAds) / (resAtual.precoVenda || 1) * 100, eficiencia: 100 },
            { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.tarifaFixa + resIdeal15.impostoValor + resIdeal15.custoAds) / (resIdeal15.precoVenda || 1) * 100, eficiencia: 100 },
            sim.pontoIdeal // Ponto Alvo
        ];

        // Mescla, remove duplicados e ordena por preço
        const cenariosCompletos = [...sim.cenarios, ...pontosExtras]
            .sort((a, b) => a.precoVenda - b.precoVenda)
            .filter((v, i, a) => i === 0 || Math.abs(v.precoVenda - a[i - 1].precoVenda) > 0.01);

        const simComIdeal = {
            ...sim,
            cenarios: cenariosCompletos,
            pAlvo: sim.pontoIdeal,
            pIdeal15: { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.tarifaFixa + resIdeal15.impostoValor + resIdeal15.custoAds) / (resIdeal15.precoVenda || 1) * 100, eficiencia: 100 }
        };

        setSimulacao(simComIdeal as any);

        setResults(resultado);
        setLastCalculatedInputs(inputsCalc);

        logCalculo(parseFloat(precoFinalStr), resultado.margemSobreVenda, "CNPJ");
    };

    const handleLimpar = () => {
        setIsResetModalOpen(true);
    };

    const confirmReset = () => {
        setInputs(defaultInputs);
        setMargemDesejada(undefined);
        setResults(null);
        setLastCalculatedInputs(null);
        setSimulacao(null);
        setOtimizacaoIdeal(null);
        setSelectedCatalogProduct(null); // Limpa o chip de produto ao reiniciar
        setIsResetModalOpen(false);
    };

    // --- ESTADO DERIVADO PARA RENDERIZAÇÃO ---

    // --- ESTADO DERIVADO PARA RENDERIZAÇÃO ---
    // resultsRef mantém o último cálculo realizado para evitar "flashing" ou retorno ao tempo real indesejado
    const resultsRef = useRef<ShopeeOutput | null>(null);
    if (results) resultsRef.current = results;



    // activeResults usa apenas o último resultado calculado pelo botão.
    // Enquanto não há cálculo, retorna null para indicar estado de espera.
    const activeResults: ShopeeOutput | null = results || resultsRef.current;

    // activeInputs sempre usa o snapshot do último cálculo (modo 100% manual)
    const activeInputs = lastCalculatedInputs || inputs;

    let statusClass = 'status-orange';
    let statusIcon = <AlertCircle size={20} />;
    let statusText = 'Margem apertada';

    if (activeResults) {
        if (activeResults.margemSobreVenda <= 0) {
            statusClass = 'status-red';
            statusIcon = <AlertCircle size={20} />;
            statusText = 'Prejuízo!';
        } else if (activeResults.margemSobreVenda >= 15) {
            statusClass = 'status-green';
            statusIcon = <CheckCircle2 size={20} />;
            statusText = 'Boa margem de lucro';
        }
    }

    const renderResultsCards = (res: ShopeeOutput | null, isIdealFull: boolean = false) => {
        if (!res) {
            return (
                <div className="waiting-params-container" style={{
                    gridColumn: '1 / -1',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    borderRadius: '20px',
                    border: '2px dashed #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#64748b'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                        marginBottom: '8px'
                    }}>
                        <Calculator size={24} style={{ color: '#94a3b8' }} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#475569' }}>Aguardando Parâmetros</div>
                    <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Preencha os dados e clique em CALCULAR AGORA</div>
                </div>
            );
        }

        return (
            <div className="premium-results-grid">
                <div className="result-card primary" style={{
                    backgroundColor: res.margemSobreVenda <= 0 ? '#fef2f2' : (res.margemSobreVenda < 15 ? '#fff7ed' : '#f0fdf4'),
                    borderColor: res.margemSobreVenda <= 0 ? '#fecaca' : (res.margemSobreVenda < 15 ? '#fed7aa' : '#bbf7d0'),
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}>
                    <div className="result-label" style={{
                        color: res.margemSobreVenda <= 0 ? '#991b1b' : (res.margemSobreVenda < 15 ? '#9a3412' : '#166534')
                    }}>
                        {isIdealFull ? <>PREÇO DE VENDA IDEAL {s('PDVI')}</> : <>PREÇO DE VENDA {s('PDV')}</>}
                    </div>
                    <div className="result-value" style={{
                        color: res.margemSobreVenda <= 0 ? '#dc2626' : (res.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                    }}>
                        R$ {moeda(res.precoComCupom)}
                    </div>
                    <div className="result-sub" style={{
                        color: res.margemSobreVenda <= 0 ? '#b91c1c' : (res.margemSobreVenda < 15 ? '#c2410c' : '#15803d'),
                        opacity: 1,
                        fontWeight: 600
                    }}>
                        {isIdealFull ? "Valor efetivo da venda" : "Valor efetivo da venda"}
                    </div>
                    <ShoppingCart size={24} className="card-icon" style={{
                        opacity: 0.1,
                        color: res.margemSobreVenda <= 0 ? '#dc2626' : (res.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                    }} />
                </div>

                <div className="result-card secondary" style={{
                    backgroundColor: '#eff6ff',
                    borderColor: '#bfdbfe'
                }}>
                    <div className="result-label" style={{ color: '#1e3a8a' }}>
                        {isIdealFull ? <>PREÇO IDEAL ANUNCIADO {s('PIA')}</> : <>PREÇO ANUNCIADO {s('PA')}</>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', zIndex: 2, position: 'relative' }}>
                        <span style={{
                            fontSize: '2.1rem',
                            fontWeight: 900,
                            color: '#1e40af'
                        }}>
                            R$ {moeda(res.precoVenda)}
                        </span>
                    </div>

                    <div className="result-sub" style={{ color: '#1e40af', opacity: 1, marginTop: '0.5rem' }}>
                        {isIdealFull ? "Valor a ser configurado no painel" : "Valor configurado no painel"}
                    </div>
                    <TrendingUp size={24} className="card-icon" style={{
                        opacity: 0.1,
                        color: '#3b82f6'
                    }} />
                </div>
            </div>
        );
    };

    const mainResultsContent = renderResultsCards(activeResults, aba === 'ideal');

    // Sugestões do Sensor - Refeito com base na lógica exata do calcularPrecoIdealDetalhado
    const sensorData = React.useMemo(() => {
        if (aba === 'ideal') return { melhorAnteriorComp: null, melhorLeverageComp: null };

        let melhorAnteriorComp: any = null;
        let melhorLeverageComp: any = null;

        const lucroAtualComp = activeResults?.lucroLiquido || 0;
        const precoAtualSimComp = activeResults?.precoComCupom || 0; // Usando o PA como base para descida


        if (activeResults?.precoVenda && (activeInputs.custoProduto || 0) > 0) {

            const resAtualComp = calcularTaxasShopee(activeInputs, true);
            const lucroRefArredondado = resAtualComp.lucroLiquido;

            // 1. Busca por Otimização "Sweet Spot" (VERDE) - PRIORIDADE MÁXIMA
            for (let i = 1; i <= 5000; i++) {
                const paTeste = arredondar(precoAtualSimComp - (i / 100), 2);
                if (paTeste <= (activeInputs.custoProduto || 0.01)) break;

                const resTeste = calcularTaxasShopee({ ...activeInputs, precoVenda: paTeste }, true);

                // Regra do Sensor de Otimização (VERDE):
                // 1. O lucro aumentou de verdade (> 0,5 centavo)
                // 2. O lucro se manteve, mas o preço caiu drasticamente (> R$ 5,00) ou atingiu ponto crítico
                const diffLucro = resTeste.lucroLiquido - lucroRefArredondado;
                const isLucroMaiorOuIgual = diffLucro >= 0;
                const isPrecoMenor = paTeste < precoAtualSimComp - 0.01;

                if (isLucroMaiorOuIgual && isPrecoMenor) {
                    melhorAnteriorComp = resTeste;
                    break;
                }
            }

            // 2. Só busca Estratégia de Giro (ROXA) se Sweet Spot NÃO encontrou nada
            if (!melhorAnteriorComp) {
                const MAX_LUCRO_PERDIDO_PCT = 0.15;
                const MIN_ALAVANCAGEM = activeInputs.fatorAlavancagem ?? 5.0;

                for (let i = 1; i <= 5000; i++) {
                    const paTeste = arredondar(precoAtualSimComp - (i / 100), 2);
                    if (paTeste <= (activeInputs.custoProduto || 0.01)) break;

                    const resTeste = calcularTaxasShopee({ ...activeInputs, precoVenda: paTeste }, true);

                    const qPreco = precoAtualSimComp - paTeste;
                    const qLucro = lucroAtualComp - resTeste.lucroLiquido;

                    if (qLucro > 0) {
                        const fator = qPreco / qLucro;
                        const pctPerdaLucro = qLucro / (lucroAtualComp || 1);

                        if (pctPerdaLucro <= MAX_LUCRO_PERDIDO_PCT && fator >= MIN_ALAVANCAGEM) {
                            const finalGiro = calcularTaxasShopee({ ...activeInputs, precoVenda: paTeste }, true);
                            melhorLeverageComp = {
                                ...finalGiro,
                                fator: fator
                            };
                            break;
                        }
                    }
                }
            } else {
                melhorLeverageComp = null;
            }
        }
        return { melhorAnteriorComp, melhorLeverageComp };
    }, [activeInputs, activeResults?.precoVenda, activeResults?.precoComCupom, activeResults?.lucroLiquido, aba]);

    const { melhorAnteriorComp, melhorLeverageComp } = sensorData;

    // Efeito para disparar notificações do sensor após o cálculo (Aba Margem)
    useEffect(() => {
        // Se estivermos no modo Ideal ou sem resultados, não dispara o observer genérico
        if (!results || aba === 'ideal') return;

        if (melhorAnteriorComp) {
            notify("Oportunidade Detectada: Sweet Spot encontrado para aumentar seu lucro!", "success");
        } else if (melhorLeverageComp) {
            notify("Estratégia de Giro: Alavancagem sugerida para aumentar exposição.", "info");
        }
    }, [melhorAnteriorComp, melhorLeverageComp, results, aba]);

    return (
        <div className="container">
            <div className="header">
                <div className="hero-logos">
                    <div className="hero-icon-container lcg">
                        <img src="/lcg-logo.svg" alt="Logo LCG" className="hero-icon" />
                    </div>
                    <span className="hero-x">|</span>
                    <div className="hero-icon-container shopee">
                        <img src="/Shopee_logo.png" alt="Logo Shopee" className="hero-icon" />
                    </div>
                </div>
                <h1 className="hero-title">Calculadora de Margem Shopee</h1>
                <p className="hero-subtitle">
                    Descubra sua margem de contribuição com as novas regras de comissão 2026. Resultado em segundos!
                </p>
            </div>

            <div className="calculator-main">
                <div className="calculator-left">
                    <div className="tabs">
                        <button
                            className={`tab ${aba === 'margem' ? 'active' : ''} `}
                            onClick={() => setAba('margem')}
                        >
                            <Calculator size={18} /> Calcular margem
                        </button>
                        <button
                            className={`tab ${aba === 'ideal' ? 'active' : ''} `}
                            onClick={() => setAba('ideal')}
                        >
                            <CircleDollarSign size={18} /> Preço Ideal
                        </button>
                    </div>

                    <div className="card">
                        <div className="card-title">
                            <span className="number-badge">1</span> Parâmetros de Cálculo {s('PDL')}
                        </div>

                        <div className="parameters-grid">
                            <div className="input-section-title">Valores Base</div>

                            {/* Busca no Catálogo — visível apenas para usuários autenticados (oculto no nível 3) */}
                            {user && !isLevel3 && (
                                <div className="input-group" style={{ position: 'relative', marginBottom: '1rem', zIndex: showSearchDropdown ? 100 : 1 }}>
                                    <label style={{ color: '#4b5563', fontWeight: 700 }}><Search size={16} /> Buscar no Catálogo</label>

                                    {!selectedCatalogProduct ? (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Digite SKU ou descrição para carregar os custos..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setShowSearchDropdown(true);
                                                }}
                                                onFocus={() => setShowSearchDropdown(true)}
                                                // Timeout para permitir clique na lista antes de sumir
                                                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                                                autoComplete="off"
                                                className="input-field"
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}
                                            />
                                            {showSearchDropdown && searchQuery.trim().length > 1 && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                                    background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
                                                    maxHeight: '380px', overflowY: 'auto', zIndex: 1000,
                                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginTop: '4px',
                                                    display: 'flex', flexDirection: 'column'
                                                }}>
                                                    {(() => {
                                                        const searchLower = searchQuery.toLowerCase();
                                                        return catalogProducts
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
                                                    })().length === 0 ? (
                                                        <div style={{ padding: '0.8rem', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
                                                            Nenhum produto encontrado no catálogo.
                                                        </div>
                                                    ) : (() => {
                                                        const searchLower = searchQuery.toLowerCase();
                                                        const catalogResults = catalogProducts
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

                                                        const ITEMS_PER_PAGE = 10;
                                                        const totalPages = Math.ceil(catalogResults.length / ITEMS_PER_PAGE);
                                                        const currentResults = catalogResults.slice((catalogPage - 1) * ITEMS_PER_PAGE, catalogPage * ITEMS_PER_PAGE);

                                                        return (
                                                            <>
                                                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                                                    {currentResults.map((p, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                                            onClick={() => {
                                                                                setSelectedCatalogProduct({ sku: p.sku || '', descricao: p.descricao || '', _wh: p._wh || '' });
                                                                                setSearchQuery('');
                                                                                setShowSearchDropdown(false);
                                                                                setInputs(prev => ({
                                                                                    ...prev,
                                                                                    custoProduto: p.custoCDP !== undefined && p.custoCDP !== 0 ? p.custoCDP : prev.custoProduto,
                                                                                    impostoPorcentagem: p.impostosIMP !== undefined && p.impostosIMP !== 0 ? p.impostosIMP : prev.impostoPorcentagem,
                                                                                    despesaFixa: p.despesaFixaDF !== undefined && p.despesaFixaDF !== 0 ? p.despesaFixaDF : prev.despesaFixa,
                                                                                    despesaAdicional: p.outrasDespesasOD !== undefined && p.outrasDespesasOD !== 0 ? p.outrasDespesasOD : prev.despesaAdicional,
                                                                                    adsValor: p.adsADS !== undefined && p.adsADS !== 0 ? p.adsADS : prev.adsValor,
                                                                                    rebatePorcentagem: p.rebateCR !== undefined && p.rebateCR !== 0 ? p.rebateCR : prev.rebatePorcentagem
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
                                                                {totalPages > 1 && (
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        padding: '0.75rem 1rem',
                                                                        borderTop: '1px solid #e5e7eb',
                                                                        backgroundColor: '#f8fafc',
                                                                        borderBottomLeftRadius: '8px',
                                                                        borderBottomRightRadius: '8px',
                                                                        boxShadow: '0 -2px 10px rgba(0,0,0,0.02)'
                                                                    }}
                                                                        onMouseDown={(e) => e.preventDefault()} // Evitar blur
                                                                    >
                                                                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                                                            Página {catalogPage} de {totalPages}
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    setCatalogPage(p => Math.max(1, p - 1));
                                                                                }}
                                                                                disabled={catalogPage === 1}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    padding: '0.4rem',
                                                                                    background: catalogPage === 1 ? '#f1f5f9' : '#fff',
                                                                                    color: catalogPage === 1 ? '#94a3b8' : '#3b82f6',
                                                                                    border: `1px solid ${catalogPage === 1 ? '#e2e8f0' : '#bfdbfe'}`,
                                                                                    borderRadius: '6px',
                                                                                    cursor: catalogPage === 1 ? 'not-allowed' : 'pointer',
                                                                                    transition: 'all 0.2s ease',
                                                                                    boxShadow: catalogPage === 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    if (catalogPage !== 1) {
                                                                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                                                                        e.currentTarget.style.borderColor = '#93c5fd';
                                                                                    }
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    if (catalogPage !== 1) {
                                                                                        e.currentTarget.style.backgroundColor = '#fff';
                                                                                        e.currentTarget.style.borderColor = '#bfdbfe';
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <ChevronLeft size={16} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    setCatalogPage(p => Math.min(totalPages, p + 1));
                                                                                }}
                                                                                disabled={catalogPage === totalPages}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    padding: '0.4rem',
                                                                                    background: catalogPage === totalPages ? '#f1f5f9' : '#fff',
                                                                                    color: catalogPage === totalPages ? '#94a3b8' : '#3b82f6',
                                                                                    border: `1px solid ${catalogPage === totalPages ? '#e2e8f0' : '#bfdbfe'}`,
                                                                                    borderRadius: '6px',
                                                                                    cursor: catalogPage === totalPages ? 'not-allowed' : 'pointer',
                                                                                    transition: 'all 0.2s ease',
                                                                                    boxShadow: catalogPage === totalPages ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    if (catalogPage !== totalPages) {
                                                                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                                                                        e.currentTarget.style.borderColor = '#93c5fd';
                                                                                    }
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    if (catalogPage !== totalPages) {
                                                                                        e.currentTarget.style.backgroundColor = '#fff';
                                                                                        e.currentTarget.style.borderColor = '#bfdbfe';
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <ChevronRight size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        /* Exibição do produto dentro da "barra" */
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
                            )}

                            <div className="input-group">
                                <label><ShoppingCart size={16} /> Custo do Produto (R$) {s('CDP')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="custoProduto"
                                        className="input-main"
                                        placeholder="0,00"
                                        value={getInputValue('custoProduto', inputs.custoProduto)}
                                        onFocus={() => {
                                            setFocusedInput('custoProduto');
                                            setFocusedValue(inputs.custoProduto !== undefined ? inputs.custoProduto.toFixed(2).replace('.', ',') : '');
                                        }}
                                        onBlur={() => {
                                            setFocusedInput(null);
                                            setFocusedValue('');
                                        }}
                                        onChange={handleChange}
                                        onWheel={handleWheel}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <div className="input-unit" style={{ padding: 0, display: 'flex', alignItems: 'center', background: '#f8fafc', cursor: 'default' }}>
                                        <span style={{ paddingLeft: '12px', paddingRight: '4px', color: '#64748b', fontWeight: 600 }}>x</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={qtdMultiplier}
                                            onChange={(e) => setQtdMultiplier(e.target.value)}
                                            style={{ width: '48px', border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', padding: '0.75rem 0', fontWeight: 600, color: 'inherit' }}
                                            title="Multiplicador de quantidade (Ex: Kit com 2)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="input-group">
                                {aba === 'margem' ? (
                                    <>
                                        <div className="input-group">
                                            <label><CircleDollarSign size={16} /> Preço Anunciado (R$) {s('PA')}</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="precoVenda"
                                                placeholder="0,00"
                                                value={getInputValue('precoVenda', inputs.precoVenda)}
                                                onFocus={() => {
                                                    setFocusedInput('precoVenda');
                                                    setFocusedValue(inputs.precoVenda !== undefined ? inputs.precoVenda.toFixed(2).replace('.', ',') : '');
                                                }}
                                                onBlur={() => {
                                                    setFocusedInput(null);
                                                    setFocusedValue('');
                                                }}
                                                onChange={handleChange}
                                                onWheel={handleWheel}
                                                onKeyDown={handleKeyDown}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="input-group">
                                            <label style={{ margin: 0, marginBottom: '0.4rem', display: 'flex' }}>
                                                <TrendingUp size={16} />
                                                <span>Lucro desejado {tipoMargemIdeal !== 'reais' ? '(%)' : '(R$)'}:</span>
                                                {tipoMargemIdeal === 'custo' ? (aba === 'ideal' ? s('MSCD') : s('MSC')) : (tipoMargemIdeal === 'venda' ? (aba === 'ideal' ? s('LLVD') : s('LLV')) : '')}
                                                <HelpCircle size={14} className="label-help" />
                                            </label>

                                            <div className="margin-type-tabs">
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
                                                    onFocus={() => {
                                                        setFocusedInput('margemDesejada');
                                                        setFocusedValue(margemDesejada !== undefined ? margemDesejada.toFixed(2).replace('.', ',') : '');
                                                    }}
                                                    onBlur={() => {
                                                        setFocusedInput(null);
                                                        setFocusedValue('');
                                                    }}
                                                    onChange={handleChange}
                                                    onWheel={handleWheel}
                                                    onKeyDown={handleKeyDown}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>


                            <div className="input-group">
                                <label><Sparkles size={16} /> Crédito de Rebate {s('CR')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="rebatePorcentagem"
                                        className="input-main"
                                        value={getInputValue('rebatePorcentagem', inputs.rebatePorcentagem)}
                                        onFocus={() => {
                                            setFocusedInput('rebatePorcentagem');
                                            setFocusedValue(inputs.rebatePorcentagem !== undefined ? inputs.rebatePorcentagem.toFixed(2).replace('.', ',') : '');
                                        }}
                                        onBlur={() => {
                                            setFocusedInput(null);
                                            setFocusedValue('');
                                            triggerCalculation();
                                        }}
                                        onChange={handleChange}
                                        onWheel={handleWheel}
                                        placeholder="0,00"
                                    />
                                    <select
                                        name="rebateTipo"
                                        className="input-unit"
                                        value={inputs.rebateTipo}
                                        onChange={handleChange}
                                    >
                                        <option value="porcentagem">%</option>
                                        <option value="fixo">R$</option>
                                    </select>
                                </div>
                                <span className="input-hint">Rebate de campanhas Shopee</span>
                            </div>

                            <div className="input-group">
                                <label><CircleDollarSign size={16} /> Cupom de Desconto {s('CD')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="cupomDesconto"
                                        className="input-main"
                                        value={getInputValue('cupomDesconto', inputs.cupomDesconto)}
                                        onFocus={() => {
                                            setFocusedInput('cupomDesconto');
                                            setFocusedValue(inputs.cupomDesconto !== undefined ? inputs.cupomDesconto.toFixed(2).replace('.', ',') : '');
                                        }}
                                        onBlur={() => {
                                            setFocusedInput(null);
                                            setFocusedValue('');
                                            triggerCalculation();
                                        }}
                                        onChange={handleChange}
                                        onWheel={handleWheel}
                                        placeholder="0,00"
                                    />
                                    <select
                                        name="cupomTipo"
                                        className="input-unit"
                                        value={inputs.cupomTipo}
                                        onChange={handleChange}
                                    >
                                        <option value="fixo">R$</option>
                                        <option value="porcentagem">%</option>
                                    </select>
                                </div>
                                <span className="input-hint">Valor do cupom da loja</span>
                            </div>

                            {/* Seção de Configurações Avançadas Colapsável — oculta para nível 3 */}
                            {!isLevel3 && (
                                <div
                                    className={`advanced-settings-header ${isAdvancedOpen ? 'open' : ''}`}
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="header-title">
                                        <ChevronDown size={20} className="chevron-icon" />
                                        <span>Configurações Avançadas</span>
                                    </div>
                                    <div className="header-line"></div>
                                </div>
                            )}

                            {/* Prompt de Senha */}
                            {showPasswordPrompt && !user && !isPasswordAuthorized && (
                                <div className="password-prompt-container">
                                    <form onSubmit={handlePasswordSubmit} className={`password-form ${passwordError ? 'shake' : ''}`}>
                                        <Lock size={16} />
                                        <input
                                            type="password"
                                            placeholder={isVerifyingPassword ? "Verificando..." : "Digite a senha"}
                                            value={passwordInput}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordInput(e.target.value)}
                                            disabled={isVerifyingPassword}
                                            autoFocus
                                        />
                                        <button type="submit" disabled={isVerifyingPassword}>
                                            {isVerifyingPassword ? '...' : 'OK'}
                                        </button>
                                    </form>
                                    <p className="password-hint">
                                        {passwordErrorMessage ? (
                                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{passwordErrorMessage}</span>
                                        ) : (
                                            "Acesso exclusivo para administradores"
                                        )}
                                    </p>
                                </div>
                            )}

                            <div className={`advanced-settings-content ${(isAdvancedOpen && (user || isPasswordAuthorized)) ? 'open' : ''}`}>


                                <div className="input-group">
                                    <label><RefreshCcw size={16} /> Fator de Alavancagem (Giro)</label>
                                    <div className="input-with-icon">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="fatorAlavancagem"
                                            placeholder="5,00"
                                            value={getInputValue('fatorAlavancagem', inputs.fatorAlavancagem)}
                                            onFocus={() => {
                                                setFocusedInput('fatorAlavancagem');
                                                setFocusedValue(inputs.fatorAlavancagem !== undefined ? inputs.fatorAlavancagem.toFixed(2).replace('.', ',') : '');
                                            }}
                                            onBlur={() => {
                                                setFocusedInput(null);
                                                setFocusedValue('');
                                                triggerCalculation();
                                            }}
                                            onChange={handleChange}
                                            onKeyDown={handleKeyDown}
                                            style={{ color: '#8b5cf6', fontWeight: 'bold' }}
                                        />
                                    </div>
                                    <span className="input-hint">Ex: {moeda(inputs.fatorAlavancagem ?? 5)} significa que para cada R$ 1 perdido, o cliente ganha R$ {moeda(inputs.fatorAlavancagem ?? 5)} de desconto.</span>
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
                                            value={getInputValue('impostoPorcentagem', inputs.impostoPorcentagem)}
                                            onFocus={() => {
                                                setFocusedInput('impostoPorcentagem');
                                                setFocusedValue(inputs.impostoPorcentagem !== undefined ? inputs.impostoPorcentagem.toFixed(2).replace('.', ',') : '');
                                            }}
                                            onBlur={() => {
                                                setFocusedInput(null);
                                                setFocusedValue('');
                                                triggerCalculation();
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
                                            onKeyDown={handleKeyDown}
                                            placeholder="0,00"
                                        />
                                        <select
                                            name="impostoTipo"
                                            className="input-unit"
                                            value={inputs.impostoTipo}
                                            onChange={handleChange}
                                        >
                                            <option value="porcentagem">%</option>
                                            <option value="fixo">R$</option>
                                        </select>
                                    </div>
                                    <span className="input-hint">DAS, Simples Nacional, etc.</span>
                                </div>

                                <div className="input-group">
                                    <label><RotateCcw size={16} /> Despesa fixa {s('DF')}</label>
                                    <div className="input-composite">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="despesaFixa"
                                            className="input-main"
                                            value={getInputValue('despesaFixa', inputs.despesaFixa)}
                                            onFocus={() => {
                                                setFocusedInput('despesaFixa');
                                                setFocusedValue(inputs.despesaFixa !== undefined ? inputs.despesaFixa.toFixed(2).replace('.', ',') : '');
                                            }}
                                            onBlur={() => {
                                                setFocusedInput(null);
                                                setFocusedValue('');
                                                triggerCalculation();
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
                                            onKeyDown={handleKeyDown}
                                            placeholder="0,00"
                                        />
                                        <select
                                            name="despesaFixaTipo"
                                            className="input-unit"
                                            value={inputs.despesaFixaTipo}
                                            onChange={handleChange}
                                        >
                                            <option value="fixo">R$</option>
                                            <option value="porcentagem">%</option>
                                        </select>
                                    </div>
                                    <span className="input-hint">Caixa, fita, etiqueta...</span>
                                </div>

                                <div className="input-group">
                                    <label><Calculator size={16} /> Outras Despesas {s('OD')}</label>
                                    <div className="input-composite">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="despesaAdicional"
                                            className="input-main"
                                            value={getInputValue('despesaAdicional', inputs.despesaAdicional)}
                                            onFocus={() => {
                                                setFocusedInput('despesaAdicional');
                                                setFocusedValue(inputs.despesaAdicional !== undefined ? inputs.despesaAdicional.toFixed(2).replace('.', ',') : '');
                                            }}
                                            onBlur={() => {
                                                setFocusedInput(null);
                                                setFocusedValue('');
                                                triggerCalculation();
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
                                            onKeyDown={handleKeyDown}
                                            placeholder="0,00"
                                        />
                                        <select
                                            name="despesaAdicionalTipo"
                                            className="input-unit"
                                            value={inputs.despesaAdicionalTipo}
                                            onChange={handleChange}
                                        >
                                            <option value="porcentagem">%</option>
                                            <option value="fixo">R$</option>
                                        </select>
                                    </div>
                                    <span className="input-hint">Custos operacionais diversos</span>
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
                                            value={getInputValue('adsValor', inputs.adsValor)}
                                            onFocus={() => {
                                                setFocusedInput('adsValor');
                                                setFocusedValue(inputs.adsValor !== undefined ? inputs.adsValor.toFixed(2).replace('.', ',') : '');
                                            }}
                                            onBlur={() => {
                                                setFocusedInput(null);
                                                setFocusedValue('');
                                                triggerCalculation();
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
                                            onKeyDown={handleKeyDown}
                                            placeholder="0,00"
                                        />
                                        <select
                                            name="adsTipo"
                                            className="input-unit"
                                            value={inputs.adsTipo}
                                            onChange={handleChange}
                                        >
                                            <option value="fixo">R$</option>
                                            <option value="porcentagem">%</option>
                                            <option value="roas">ROAS</option>
                                        </select>
                                    </div>
                                    <span className="input-hint">Shopee Ads por venda</span>
                                </div>

                                {/* Parâmetros de elasticidade removidos conforme nova lógica baseada em volume relativo */}
                            </div>

                        </div>
                        <div className="actions" style={{ flexDirection: 'column' }}>
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
                                    transition: 'all 0.3s ease',
                                    opacity: isCalculating ? 0.8 : 1
                                }}
                                onClick={handleCalcular}
                                disabled={isCalculating}
                            >
                                {isCalculating ? (
                                    <RefreshCcw size={22} className="animate-spin" />
                                ) : (
                                    <Calculator size={22} />
                                )}
                                {isCalculating ? ' CALCULANDO...' : ' CALCULAR AGORA'}
                            </button>
                            <button className="btn-outline" style={{ width: '100%' }} onClick={handleLimpar}>
                                <RotateCcw size={18} /> Reiniciar Calculadora
                            </button>
                            {!isLevel3 && (
                                <Link to="/shopee/lote" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: '#3b82f6', borderColor: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Table size={18} /> Processar Lote
                                </Link>
                            )}

                        </div>
                    </div>
                </div>

                <div className="calculator-right">
                    {!activeResults ? (
                        <div className="empty-results-card">
                            <div className="empty-results-content">
                                <div className="empty-results-icon-container">
                                    <div className="empty-results-icon-pulse"></div>
                                    <Sparkles size={48} className="empty-results-icon" style={{ color: '#EF4C29' }} />
                                </div>
                                <h3>Pronto para Calcular?</h3>
                                <p>Insira os dados do seu produto ao lado para ver uma análise detalhada de margem e lucro na Shopee.</p>
                            </div>
                        </div>
                    ) : (
                        <div id="quick-results">
                            <div className="results-container-3col">
                                <div className="results-column-main">
                                    {/* Sensores de Otimização */}
                                    {(() => {
                                        // 1. Otimização da Aba Ideal (Sensor Integrado)
                                        if (aba === 'ideal' && otimizacaoIdeal?.isOtimizado) {
                                            const paOri = otimizacaoIdeal.precoOriginal;
                                            const paOpt = otimizacaoIdeal.precoOtimizado;

                                            if (otimizacaoIdeal.isAlavancagem) {
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="sensor-inner-alert purple">
                                                            <RefreshCcw size={20} />
                                                            <span>
                                                                <strong>Estratégia de Giro Identificada:</strong> O preço anunciado ideal seria <strong>R$ {moeda(paOri)}</strong>.
                                                                Porém, ao reduzir para <strong>R$ {moeda(paOpt)}</strong>, você dá um super desconto de <strong>R$ {moeda(otimizacaoIdeal.quedaPreco)}</strong> para o cliente,
                                                                sacrificando apenas <strong>R$ {moeda(otimizacaoIdeal.quedaLucro)}</strong> de margem (Alavancagem de <strong>{(otimizacaoIdeal.fatorAlavancagem || 0).toFixed(1)}x</strong>).
                                                            </span>
                                                        </div>
                                                        {mainResultsContent}
                                                    </div>
                                                );
                                            }

                                            return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="sensor-inner-alert">
                                                            <TrendingUp size={20} />
                                                            <span>
                                                                <strong className="block mb-1">Sensor de Otimização Automática Ativado:</strong>
                                                                Anunciando por <span className="font-bold underline text-green-600">R$ {moeda(paOri)}</span> voce obtem o lucro de <span className="font-bold">R$ {moeda(otimizacaoIdeal.lucroOriginal)}</span>, entretanto, ao vasculhar as regras da Shopee eu identifiquei que reduzindo seu preço para <span className="font-bold text-green-900 underline"> R$ {moeda(paOpt)}</span> você muda a faixa de impostos e seu lucro líquido final subirá em <span style={{ fontWeight: 'bold', color: '#064e3b' }}> R$ {moeda(otimizacaoIdeal.lucroOtimizado)}!</span>
                                                            </span>
                                                        </div>
                                                        {mainResultsContent}
                                                    </div>
                                            );
                                        }

                                        // 2. Otimização da Aba Margem (Detecção via Simulação)
                                        if (melhorAnteriorComp && aba !== 'ideal') {
                                            return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="sensor-inner-alert">
                                                            <TrendingUp size={20} />
                                                            <span>
                                                                <strong>Sensor de Otimização Ativado:</strong> Ao mudar o Preço Anunciado {s('PA')} para <strong>R$ {moeda(melhorAnteriorComp.precoVenda)}</strong> seu lucro líquido final <strong>subirá para R$ {moeda(melhorAnteriorComp.lucroLiquido)}!</strong>
                                                            </span>
                                                        </div>
                                                        {mainResultsContent}
                                                    </div>
                                            );
                                        }

                                        if (melhorLeverageComp && aba !== 'ideal') {
                                            const qP = activeResults.precoComCupom - melhorLeverageComp.precoComCupom;
                                            const qL = activeResults.lucroLiquido - melhorLeverageComp.lucroLiquido;
                                            const f = melhorLeverageComp.fator;

                                            return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="sensor-inner-alert purple">
                                                            <RefreshCcw size={20} />
                                                            <span>
                                                                <strong>Estratégia de Giro Identificada:</strong> O preço anunciado ideal seria <strong>R$ {moeda(activeResults.precoComCupom)}</strong>.
                                                                Porém, ao reduzir para <strong>R$ {moeda(melhorLeverageComp.precoComCupom)}</strong>, você dá um super desconto de <strong>R$ {moeda(qP)}</strong> para o cliente,
                                                                sacrificando apenas <strong>R$ {moeda(qL)}</strong> de margem (Alavancagem de <strong>{(f || 0).toFixed(1)}x</strong>).
                                                            </span>
                                                        </div>
                                                        {mainResultsContent}
                                                    </div>
                                            );
                                        }

                                        // 3. Resultado Padrão (Sem otimização disponível ou desativada)
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div className={`alert-box-result ${statusClass}`}>
                                                    {statusIcon} <span>{statusText}</span>
                                                </div>
                                                {mainResultsContent}
                                            </div>
                                        );
                                    })()}

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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ fontSize: '0.95rem', color: '#c2410c', fontWeight: 700 }}>Lucro líquido custo:</span>
                                                    <span style={{ fontSize: '0.95rem', color: '#c2410c', fontWeight: 700 }}>({porc(activeResults.margemLiquidaSobreCusto)}%)</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ fontSize: '0.95rem', color: '#1e40af', fontWeight: 700 }}>Lucro líquido venda:</span>
                                                    <span style={{ fontSize: '0.95rem', color: '#1e40af', fontWeight: 700 }}>({porc(activeResults.margemSobreVenda)}%)</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lucro Líquido Final</div>
                                                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1, whiteSpace: 'nowrap' }}>R$ {moeda(activeResults.lucroLiquido)}</div>
                                            </div>
                                        </div>

                                        {(inputs.cupomDesconto ?? 0) > 0 && (
                                            <>
                                                <div className="detail-row">
                                                    <span style={{ fontWeight: 700 }}>Preço Anunciado {s('PA')}:</span>
                                                    <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(activeResults.precoVenda)}</span>
                                                </div>
                                                <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                                    <span>Desconto aplicado {s('CD')}:</span>
                                                    <div className="detail-values">
                                                        <span className="perc">({porc((activeResults.cupomValor || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                        <span className="val text-red">- R$ {moeda(activeResults.cupomValor)}</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <div className="detail-row">
                                            <span style={{ fontWeight: 700 }}>Preço de Venda {s('PDV')}:</span>
                                            <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(activeResults.precoComCupom)}</span>
                                        </div>

                                        <div className="details-group-header">Política da Shopee {s('PDS')} <HelpCircle size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle', opacity: 0.6 }} /></div>
                                        <div className="detail-row">
                                            <span>Comissão Shopee ({arredondar(activeResults.comissaoPorcentagem, 0)}%) {s('CS')}:</span>
                                            <div className="detail-values">
                                                <span className="perc">({porc(activeResults.comissaoPorcentagem)}%)</span>
                                                <span className="val text-red">- R$ {moeda(activeResults.comissaoValor)}</span>
                                            </div>
                                        </div>
                                        <div className="detail-row">
                                            <span>Tarifa Fixa Shopee {s('TFS')}:</span>
                                            <div className="detail-values">
                                                <span className="perc">({porc((activeResults.tarifaFixa || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                <span className="val text-red">- R$ {moeda(activeResults.tarifaFixa)}</span>
                                            </div>
                                        </div>

                                        <div className="details-group-header">Política da LCG {s('PDL')}</div>
                                        <div className="detail-row">
                                            <span>Custo do Produto {s('CDP')}:</span>
                                            <div className="detail-values">
                                                <span className="perc">({porc((activeInputs.custoProduto || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                <span className="val text-red">- R$ {moeda(activeInputs.custoProduto)}</span>
                                            </div>
                                        </div>
                                        {(activeResults.impostoValor ?? 0) > 0 && (
                                            <div className="detail-row">
                                                <span>Imposto {s('IMP')}:</span>
                                                <div className="detail-values">
                                                    <span className="perc">({porc((activeResults.impostoValor || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                    <span className="val text-red">- R$ {moeda(activeResults.impostoValor)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {(activeResults.custoAds ?? 0) > 0 && (
                                            <div className="detail-row">
                                                <span>Ads Shopee {s('ADS')}:</span>
                                                <div className="detail-values">
                                                    <span className="perc">({porc((activeResults.custoAds || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                    <span className="val text-red">- R$ {moeda(activeResults.custoAds)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {(activeResults.despesaFixaValor ?? 0) > 0 && (
                                            <div className="detail-row">
                                                <span>Despesa fixa {s('DF')}:</span>
                                                <div className="detail-values">
                                                    <span className="perc">({porc((activeResults.despesaFixaValor || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                    <span className="val text-red">- R$ {moeda(activeResults.despesaFixaValor)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {(activeResults.despesaAdicionalValor ?? 0) > 0 && (
                                            <div className="detail-row">
                                                <span>Outras Despesas {s('OD')}:</span>
                                                <div className="detail-values">
                                                    <span className="perc">({porc((activeResults.despesaAdicionalValor || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                    <span className="val text-red">- R$ {moeda(activeResults.despesaAdicionalValor || 0)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {(activeResults.rebateValor ?? 0) > 0 && (
                                            <div className="detail-row">
                                                <span>Crédito de Rebate {s('CR')}:</span>
                                                <div className="detail-values">
                                                    <span className="perc">({porc((activeResults.rebateValor || 0) / (activeResults.precoComCupom || 1) * 100)}%)</span>
                                                    <span className="val text-green">(+ R$ {moeda(activeResults.rebateValor)})</span>
                                                </div>
                                            </div>
                                        )}
                                    </div> {/* Fecha details */}

                                    <div className="result-card mini large">
                                        <div className="result-header">
                                            {activeResults.margemSobreVenda >= 15 ? (
                                                <ArrowUpRight size={18} className="text-green" />
                                            ) : (
                                                <ArrowDownRight size={18} className="text-red" />
                                            )} Margem de Contribuição {s('MC')}
                                        </div>
                                        <div className="result-body">
                                            <span className={`percentage ${activeResults.margemSobreVenda <= 0 ? 'text-red' :
                                                activeResults.margemSobreVenda < 15 ? 'text-orange' : 'text-green'
                                                }`}>
                                                {(() => {
                                                    const mc = (activeResults.custoProdutoValor / (activeResults.precoVenda || 1)) * 100;
                                                    return arredondar(mc, 2).toFixed(2).replace('.', ',');
                                                })()}%
                                            </span>
                                            <span className="nominal">R$ {arredondar((activeResults.precoVenda - activeResults.custoProdutoValor) || 0, 2).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    </div>
                                </div> {/* Fecha results-column-main */}


                            </div>
                        </div>
                    )}
                </div>
            </div >

            <div className="table-section">
                <h2 className="table-title">Escopo de Taxas Shopee 2026 {s('PDS')}</h2>
                <div className="table-responsive">
                    <table className="shopee-table">
                        <thead>
                            <tr>
                                <th>Faixa de Preço</th>
                                <th>Comissão % {s('CS')}</th>
                                <th>Tarifa Fixa {s('TFS')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Até R$ 79,99</td><td>20%</td><td>R$ 4,00</td></tr>
                            <tr><td>R$ 80,00 a R$ 99,99</td><td>14%</td><td>R$ 16,00</td></tr>
                            <tr><td>R$ 100,00 a R$ 199,99</td><td>14%</td><td>R$ 20,00</td></tr>
                            <tr><td>R$ 200,00 a R$ 499,99</td><td>14%</td><td>R$ 26,00</td></tr>
                            <tr><td>Acima de R$ 500,00</td><td>14%</td><td>R$ 26,00</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmação de Reset */}
            {
                isResetModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-container">
                            <div className="modal-icon-container">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="modal-title">Reiniciar Calculadora?</h3>
                            <p className="modal-description">
                                Isso irá limpar todos os dados preenchidos nos parâmetros. Esta ação não pode ser desfeita.
                            </p>
                            <div className="modal-actions">
                                <button
                                    className="btn-modal-cancel"
                                    onClick={() => setIsResetModalOpen(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn-modal-confirm"
                                    onClick={confirmReset}
                                >
                                    Reiniciar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="bottom-shopee-info">
                <div className="info-card-premium">
                    <div className="info-card-icon">
                        <RefreshCcw size={32} />
                    </div>
                    <div className="info-card-text">
                        <h5>
                            <Sparkles size={18} /> Novas Regras de Comissão 2026
                        </h5>
                        <p>
                            Sistema atualizado com as vigências de <strong>01/03/2026</strong>.
                            A comissão agora varia por faixa de preço (14% a 20%) com tarifas fixas de R$4 a R$26.
                            Vendedores CPF com alto volume (450+ pedidos em 90 dias) pagam R$3 adicionais por item.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sistema de Notificações Toast */}
            {notification?.show && (
                <div className={`toast-notification ${notification.type} slide-up`}>
                    {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {notification.message}
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
        </div >
    );
};

export default ShopeePage;
