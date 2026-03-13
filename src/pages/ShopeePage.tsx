import React, { useState, useEffect } from 'react';
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
    Lock
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Area, Line, ReferenceLine
} from 'recharts';
import type { ShopeeInput, ShopeeOutput, CenarioPreco, OtimizacaoPrecoResult /* , ResultadoSweetSpot */ } from '../utils/shopeeLogic';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
    calcularTaxasShopee,
    calcularPrecoIdeal,
    calcularPrecoIdealDetalhado,
    simularCenariosPreco,
    // calcularCenariosDePreco,
    arredondar
} from '../utils/shopeeLogic';

/**
 * Componente de Insight de Preço (Sweet Spot)
 */
/* Componente desativado
const CardInsightPreco = ({ input }: { input: ShopeeInput }) => {
    ...
};
*/
import { logCalculo } from '../firebase';

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
    fatorAlavancagem: 5.0
};

const ShopeePage: React.FC = () => {
    const [aba, setAba] = useState<'margem' | 'ideal'>(() => {
        return (localStorage.getItem('@shopperPCC:aba') as 'margem' | 'ideal') || 'ideal';
    });
    const [tipoMargemIdeal, setTipoMargemIdeal] = useState<'venda' | 'custo' | 'reais'>(() => {
        return (localStorage.getItem('@shopperPCC:tipoMargemIdeal') as 'venda' | 'custo' | 'reais') || 'venda';
    });
    const [inputs, setInputs] = useState<ShopeeInput>(() => {
        const saved = localStorage.getItem('@shopperPCC:inputs');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Sanitização: converte strings numericas antigas para number real
                Object.keys(parsed).forEach(key => {
                    if (!key.endsWith('Tipo') && typeof parsed[key] === 'string') {
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
        const saved = localStorage.getItem('@shopperPCC:margemDesejada');
        if (saved) {
            const val = parseFloat(String(saved).replace(',', '.'));
            return isNaN(val) ? undefined : val;
        }
        return undefined;
    });
    const [results, setResults] = useState<ShopeeOutput | null>(null);
    const [simulacao, setSimulacao] = useState<any>(null);
    const [otimizacaoIdeal, setOtimizacaoIdeal] = useState<OtimizacaoPrecoResult | null>(null);
    // const [sweetSpot, setSweetSpot] = useState<ResultadoSweetSpot | null>(null);
    const [fullscreenChart, setFullscreenChart] = useState<'composicao' | 'estrategia' | 'taxas' | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isAutoCalcMode, setIsAutoCalcMode] = useState<boolean>(true); // Força true por padrão agora

    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [focusedValue, setFocusedValue] = useState<string>('');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(() => {
        return localStorage.getItem('@shopperPCC:isAdvancedOpen') === 'true';
    });

    // Monitorar estado de autenticação
    const [user, setUser] = useState<User | null>(null);
    const [isPasswordAuthorized, setIsPasswordAuthorized] = useState<boolean>(() => {
        return localStorage.getItem('@shopperPCC:isPasswordAuthorized') === 'true';
    });
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        // Sync entre múltiplas abas abertas
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === '@shopperPCC:inputs') {
                try {
                    const parsed = JSON.parse(e.newValue || '{}');
                    Object.keys(parsed).forEach(key => {
                        if (!key.endsWith('Tipo') && typeof parsed[key] === 'string') {
                            const val = parseFloat(parsed[key].replace(',', '.'));
                            parsed[key] = isNaN(val) ? undefined : val;
                        }
                    });
                    setInputs(parsed);
                } catch (err) {}
            }
            if (e.key === '@shopperPCC:margemDesejada') {
                const val = parseFloat((e.newValue || '').replace(',', '.'));
                setMargemDesejada(isNaN(val) ? undefined : val);
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            unsubscribe();
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

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

    // Cálculo automático quando houver mudança nos inputs ou no modo e persistência
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('@shopperPCC:aba', aba);
            localStorage.setItem('@shopperPCC:tipoMargemIdeal', tipoMargemIdeal);
            localStorage.setItem('@shopperPCC:inputs', JSON.stringify(inputs));
            if (margemDesejada !== undefined) {
                localStorage.setItem('@shopperPCC:margemDesejada', String(margemDesejada));
            } else {
                localStorage.removeItem('@shopperPCC:margemDesejada');
            }
            localStorage.setItem('@shopperPCC:isAutoCalcMode', String(isAutoCalcMode));
            localStorage.setItem('@shopperPCC:isAdvancedOpen', String(isAdvancedOpen));
            localStorage.setItem('@shopperPCC:isPasswordAuthorized', String(isPasswordAuthorized));
        }
        handleCalcular();
    }, [inputs, aba, margemDesejada, tipoMargemIdeal, isAutoCalcMode, isAdvancedOpen, isPasswordAuthorized]);


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
        const { name, value } = e.target;

        // Todos os campos exceto os que terminam em 'Tipo' ou a aba são numéricos
        const constitutesNumber = !name.endsWith('Tipo') && name !== 'aba' && name !== 'tipoMargemIdeal' && name !== 'status';

        if (constitutesNumber && e.target.tagName === 'INPUT') {
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
            // Lógica para select e outros campos não mascarados
            if (focusedInput === name) {
                setFocusedValue(value);
            }

            if (name === 'aba') {
                setAba(value as any);
            } else if (name === 'tipoMargemIdeal') {
                setTipoMargemIdeal(value as any);
            } else {
                setInputs((prev) => ({
                    ...prev,
                    [name]: value,
                }));
            }
        }
    };

    // Prevenir scroll nos inputs
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        (e.target as HTMLInputElement).blur();
    };

    const handleCalcular = () => {
        let resultado: ShopeeOutput;
        let precoFinalStr = "";

        // 1. Determina o resultado principal (DRE) - Sempre baseado no PA manual do usuário
        if (aba === 'margem') {
            if (inputs.precoVenda === undefined) {
                setResults(null);
                return;
            }
            resultado = calcularTaxasShopee(inputs);
            precoFinalStr = resultado.precoComCupom.toFixed(2);
        } else {
            if (inputs.custoProduto === undefined) {
                setResults(null);
                return;
            }
            // No modo Ideal, primeiro pegamos o preço alvo detalhado
            const detalhesIdeal = calcularPrecoIdealDetalhado(inputs, margemDesejada, tipoMargemIdeal);
            
            // Se encontrou uma redução esperta que aumenta lucro, armazena no state pra exibir
            if (detalhesIdeal.isOtimizado) {
                setOtimizacaoIdeal(detalhesIdeal);
            } else {
                setOtimizacaoIdeal(null);
            }

            // Arredondar para 2 casas para bater com a entrada manual e evitar dízimas periódicas no cálculo
            const pIdeal = arredondar(detalhesIdeal.precoOtimizado, 2);
            
            resultado = calcularTaxasShopee({ ...inputs, precoVenda: pIdeal });
            precoFinalStr = pIdeal.toFixed(2);
        }

        // 2. Com o resultado em mãos, gera a simulação analítica para os gráficos
        // IDEAL: Agora fixo em 15% conforme solicitado pelo usuário
        const pIdeal15 = calcularPrecoIdeal(inputs, 15, tipoMargemIdeal);
        const resIdeal15 = calcularTaxasShopee({ ...inputs, precoVenda: pIdeal15 });

        const margemReferencia = margemDesejada ?? 0;
        const sim = simularCenariosPreco({ ...inputs, precoVenda: parseFloat(precoFinalStr) }, margemReferencia, tipoMargemIdeal);

        // 3. Injeção de Pontos Críticos para Interatividade no Gráfico
        const pAtualVal = parseFloat(precoFinalStr) || 0;
        const resAtual = calcularTaxasShopee({ ...inputs, precoVenda: pAtualVal });

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


        logCalculo(parseFloat(precoFinalStr), resultado.margemSobreVenda, "CNPJ");
    };

    // --- Sub-componentes de Gráfico ---
    const ComposicaoPrecoChart = ({ dados, precoAtual, pontoIdeal, pontoAlvo, isFullscreen, onToggleFullscreen }: {
        dados: CenarioPreco[],
        precoAtual: number,
        pontoIdeal: CenarioPreco,
        pontoAlvo?: CenarioPreco,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        const pontoVoce = dados.reduce((prev, curr) =>
            Math.abs(curr.precoVenda - precoAtual) < Math.abs(prev.precoVenda - precoAtual) ? curr : prev
        );

        const pontosBase = dados.filter((_, idx) => idx % 6 === 0);

        const pontosGrafico = [...pontosBase, pontoVoce, pontoIdeal, ...(pontoAlvo ? [pontoAlvo] : [])]
            .sort((a, b) => a.precoVenda - b.precoVenda)
            .filter((v, i, a) => {
                if (v === pontoVoce || v === pontoIdeal || v === pontoAlvo) return true;
                const especialPerto = a.some(esp =>
                    (esp === pontoVoce || esp === pontoIdeal || esp === pontoAlvo) &&
                    esp !== v &&
                    Math.abs(v.precoVenda - esp.precoVenda) < 25
                );
                if (especialPerto) return false;
                return i === 0 || Math.abs(v.precoVenda - a[i - 1].precoVenda) > 30;
            })
            .map(c => {
                const isVoce = c === pontoVoce;
                const isIdeal = c === pontoIdeal;
                const isAlvo = c === pontoAlvo && c !== pontoIdeal;

                let label = `R$ ${c.precoVenda.toFixed(0)}`;
                if (isVoce) label = 'VOCÊ';
                if (isIdeal) label = 'IDEAL';
                if (isAlvo) label = 'ALVO';

                return {
                    name: label,
                    fullPreco: `R$ ${c.precoVenda.toFixed(2)}`,
                    Custo: c.custoProdutoValor || 0,
                    Taxas: c.comissaoValor + c.tarifaFixa,
                    Operacao: c.impostoValor + c.despesaFixaValor + c.despesaAdicionalValor,
                    Ads: c.custoAds,
                    Lucro: Math.max(0, c.lucroLiquido),
                    type: isVoce ? 'voce' : (isIdeal ? 'ideal' : (isAlvo ? 'alvo' : 'normal'))
                };
            });

        return (
            <div className={`chart-container ${isFullscreen ? 'fullscreen' : ''}`}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Distribuição do Preço de Venda</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "80%" : 300}>
                    <BarChart data={pontosGrafico} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={({ x, y, payload }: any) => {
                                const item = pontosGrafico.find(p => p.name === payload.value);
                                const color = item?.type === 'voce' ? '#3b82f6' : (item?.type === 'ideal' ? '#10B981' : (item?.type === 'alvo' ? '#f59e0b' : '#6b7280'));
                                const isSpecial = item?.type !== 'normal';

                                return (
                                    <text
                                        x={x} y={y + 12}
                                        textAnchor="middle"
                                        fill={color}
                                        fontWeight={isSpecial ? 800 : 400}
                                        fontSize={isSpecial ? 12 : 10}
                                    >
                                        {payload.value}
                                    </text>
                                );
                            }}
                        />
                        <YAxis hide />
                        <Tooltip
                            cursor={{ fill: '#f9f9f9' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: string | undefined) => [
                                `R$ ${Number(value).toFixed(2)}`,
                                name ?? ''
                            ]}
                            labelFormatter={(label, payload) => {
                                const item = payload?.[0]?.payload;
                                return item ? `Preço de venda: ${item.fullPreco}` : label;
                            }}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                        <Bar dataKey="Lucro" stackId="a" fill="#10B981" name="Lucro" />
                        <Bar dataKey="Custo" stackId="a" fill="#EF4444" name="Custo" />
                        <Bar dataKey="Ads" stackId="a" fill="#3b82f6" name="Ads" />
                        <Bar dataKey="Operacao" stackId="a" fill="#fbbf24" name="Operação" />
                        <Bar dataKey="Taxas" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} name="Taxas Shopee" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const EstrategiaPrecoChart = ({ dados, precoAtual, pontoIdeal, pontoAlvo, onPriceSelect, isFullscreen, onToggleFullscreen }: {
        dados: CenarioPreco[],
        precoAtual: number,
        pontoIdeal: CenarioPreco,
        pontoAlvo: CenarioPreco,
        onPriceSelect: (price: number) => void,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        const isAlvoDifferentFromIdeal = Math.abs(pontoAlvo.precoVenda - pontoIdeal.precoVenda) > 0.01;
        const isSamePriceYouAlvo = Math.abs(precoAtual - pontoAlvo.precoVenda) < 0.01;

        // Encontrar picos de lucro ANTES para garantir visibilidade no domínio
        const picos = [];
        for (let i = 1; i < dados.length - 1; i++) {
            if (dados[i].lucroLiquido > dados[i - 1].lucroLiquido && dados[i].lucroLiquido >= dados[i + 1].lucroLiquido) {
                picos.push(dados[i]);
            }
        }
        if (picos.length === 0 && dados.length > 0) {
            const top = [...dados].sort((a, b) => b.lucroLiquido - a.lucroLiquido)[0];
            if (top) picos.push(top);
        }
        const picoMaisProximo = picos.length > 0 ? picos.reduce((prev, curr) => 
            Math.abs(curr.precoVenda - precoAtual) < Math.abs(prev.precoVenda - precoAtual) ? curr : prev
        ) : null;

        const precosRelevantes = [precoAtual, pontoIdeal.precoVenda, pontoAlvo.precoVenda];
        if (picoMaisProximo) precosRelevantes.push(picoMaisProximo.precoVenda);

        const minP = Math.min(...precosRelevantes);
        const maxP = Math.max(...precosRelevantes);
        const diff = maxP - minP;
        
        // Domínio com 15% de margem para respiro
        const marginX = Math.max(diff * 0.15, 20);
        const domainX = [Math.max(0, minP - marginX), maxP + marginX];

        return (
            <div className={`chart-container ${isFullscreen ? 'fullscreen' : ''}`} style={{ cursor: 'crosshair', background: '#fff' }}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Análise de Lucratividade vs Preço</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"} style={{ appearance: 'none' }}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "80%" : 300}>
                    <ComposedChart
                        data={dados}
                        margin={{ top: 60, right: 30, left: 0, bottom: 0 }}
                        onClick={(state: any) => {
                            if (state && state.activePayload && state.activePayload.length > 0) {
                                // Pega o PA para preencher de volta no campo da calculadora
                                const clickedPrice = state.activePayload[0].payload.precoComCupom;
                                onPriceSelect(clickedPrice);
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
                            tickFormatter={(val) => `${val}%`}
                            domain={[0, 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#f97316' }}
                        />

                        <Tooltip
                            shared={true}
                            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: string | undefined) => [
                                String(name).includes('%') ? `${Number(value).toFixed(1)}%` : `R$ ${Number(value).toFixed(2)}`,
                                name ?? ''
                            ]}
                            labelFormatter={(label) => `Preço: R$ ${Number(label).toFixed(2)}`}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />

                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="lucroLiquido"
                            name="Lucro Líquido (R$)"
                            stroke="#10B981"
                            fill="#10B981"
                            fillOpacity={0.1}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="pesoTaxas"
                            name="Peso das Taxas (%)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                        />

                        <ReferenceLine
                            yAxisId="left"
                            y={0}
                            stroke="#64748b"
                            strokeWidth={1}
                        />

                        <ReferenceLine
                            x={pontoIdeal.precoVenda}
                            stroke="#10B981"
                            strokeDasharray="3 3"
                            label={{ position: 'top', value: 'IDEAL (15%)', fontSize: 10, fill: '#065f46', fontWeight: 'bold', dy: -35 }}
                        />

                        {isAlvoDifferentFromIdeal && (
                            <ReferenceLine
                                x={pontoAlvo.precoVenda}
                                stroke="#f59e0b"
                                strokeDasharray="5 5"
                                label={{ position: 'top', value: 'ALVO', fontSize: 10, fill: '#b45309', fontWeight: 'bold', dy: -18 }}
                            />
                        )}

                        <ReferenceLine
                            key="ref-line-preco-atual"
                            x={precoAtual}
                            stroke="#3b82f6"
                            strokeWidth={4}
                            label={{ 
                                position: 'top', 
                                value: isSamePriceYouAlvo ? 'VOCÊ (ALVO)' : 'VOCÊ', 
                                fontSize: 13, 
                                fill: '#1e40af', 
                                fontWeight: 900, 
                                dy: -15
                            }}
                        />

                        {picoMaisProximo && (
                            <ReferenceLine
                                key="ref-line-pico-lucro"
                                x={picoMaisProximo.precoVenda}
                                stroke="#10B981"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                label={{ 
                                    position: 'top', 
                                    value: 'PICO DE LUCRO 🚀', 
                                    fontSize: 11, 
                                    fill: '#064e3b', 
                                    fontWeight: 900, 
                                    dy: -40 
                                }}
                            />
                        )}

                        {/* Indicadores de Mudança de Política (Degraus) */}
                        {[80, 100, 200, 500].map(threshold => (
                            <ReferenceLine
                                key={`threshold-${threshold}`}
                                x={threshold}
                                stroke="#fca5a5"
                                strokeWidth={1}
                                strokeDasharray="4 4"
                                label={{ 
                                    position: 'insideBottomRight', 
                                    value: `R$ ${threshold}`, 
                                    fill: '#7f1d1d', 
                                    fontSize: 9, 
                                    fontWeight: 700,
                                    dy: -10
                                }}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
                <div className="chart-footer">
                    💡 Dica: <strong>Clique em qualquer ponto</strong> do gráfico para aplicar esse preço na calculadora.
                </div>
            </div>
        );
    };

    const TaxasPrecoChart = ({ inputs, precoAtual, isFullscreen, onToggleFullscreen }: {
        inputs: ShopeeInput,
        precoAtual: number,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        const getPaFromPdv = (pdv: number) => {
            let pa = pdv;
            if ((inputs.cupomDesconto || 0) > 0) {
                if (inputs.cupomTipo === 'porcentagem') {
                    pa = pdv / (1 - (inputs.cupomDesconto! / 100));
                } else {
                    pa = pdv + inputs.cupomDesconto!;
                }
            }
            return Math.max(0.01, pa);
        };

        const degrausPdv = [79.99, 99.99, 199.99, 499.99];
        const degrausPa = degrausPdv.flatMap(pdv => [
            getPaFromPdv(pdv), 
            getPaFromPdv(pdv + 0.01)
        ]);

        const minX = Math.max(20, (inputs.custoProduto || 0) * 0.4);
        const maxX = Math.max(precoAtual * 1.5, (inputs.custoProduto || 0) * 2.5, 250);
        const step = (maxX - minX) / 80;
        const simData: any[] = [];
        const pontosX = [];
        for (let x = minX; x <= maxX; x += step) {
            pontosX.push(x);
        }
        
        // Injetar pontos críticos (Degraus calculados + Preco Atual)
        pontosX.push(precoAtual, ...degrausPa);
        pontosX.sort((a, b) => a - b);
        const pontosUnicos = pontosX.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 0.01);

        // Garantir que o domínio do eixo X englobe o preço atual e os degraus visíveis
        const precosVisiveis = [precoAtual, ...degrausPa.filter(t => t < maxX)];
        const finalMinX = Math.min(minX, ...precosVisiveis) * 0.9;
        const finalMaxX = Math.max(maxX, ...precosVisiveis) * 1.1;

        pontosUnicos.forEach(paSim => {
            const res = calcularTaxasShopee({ ...inputs, precoVenda: paSim });
            const taxaShopeeRS = res.comissaoValor + res.tarifaFixa;
            const taxaShopeeTotalPct = res.precoVenda > 0 ? (taxaShopeeRS / res.precoVenda) * 100 : 0;
            const custoPDL_RS = (res as any).custoProdutoValor + res.impostoValor + res.despesaFixaValor + res.despesaAdicionalValor + res.custoAds;
            const lucroLiquidoRS = res.lucroLiquido;
            const llv = res.margemSobreVenda;

            simData.push({
                ...res,
                paEixoX: paSim,
                taxaTotalPct: taxaShopeeTotalPct,
                llv: llv,
                llvVisual: Math.max(llv, -150), // Cap visual para não quebrar a escala
                lucroRS: lucroLiquidoRS, // Usaremos o lucro nominal para a linha verde ser mais intuitiva
                custoLcg: custoPDL_RS,
                taxaShopeeRS: taxaShopeeRS,
                isLoss: llv < 0
            });
        });

        return (
            <div className={`chart-container large-chart ${isFullscreen ? 'fullscreen' : ''}`}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Visualização do Escopo Shopee 2026</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "85%" : 320}>
                    <ComposedChart data={simData} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                        <defs>
                            <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="paEixoX"
                            type="number"
                            domain={[finalMinX, finalMaxX]}
                            tickFormatter={(val) => `R$${val.toFixed(0)}`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            label={{ value: 'Preço Anunciado Simulado (PA) (R$)', position: 'bottom', offset: 0, fontSize: 10 }}
                        />
                        <YAxis
                            yAxisId="left"
                            tickFormatter={(val) => `R$ ${val}`}
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '12px' }}
                            formatter={(value: any, name: any) => [
                                String(name).includes('%') ? `${Number(value).toFixed(2)}%` : `R$ ${Number(value).toFixed(2)}`,
                                name ?? ''
                            ]}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="custom-tooltip shadow-lg" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', minWidth: '200px' }}>
                                            <p className="font-extrabold text-gray-800 border-bottom mb-3 pb-2 text-sm" style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                PA Simulado: <span style={{ color: '#2563eb' }}>R$ {Number(label).toFixed(2)}</span>
                                            </p>
                                            <div className="space-y-2 text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Preço Anunciado [PA]:</span>
                                                    <span className="font-bold text-gray-900">R$ {d.precoComCupom.toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Preço de Venda [PDV]:</span>
                                                    <span className="font-bold text-gray-900">R$ {d.precoVenda.toFixed(2)}</span>
                                                </div>
                                                <div className="pt-1 mt-1" style={{ borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Política da Shopee [PDS]:</span>
                                                    <span className="font-bold" style={{ color: '#f97316' }}>- R$ {(d.taxaShopeeRS).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Política da LCG [PDL]:</span>
                                                    <span className="font-bold" style={{ color: '#ef4444' }}>- R$ {(d.custoLcg).toFixed(2)}</span>
                                                </div>
                                                <div className="pt-2 mt-1" style={{ borderTop: '2px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="font-bold text-gray-700">Lucro Líquido Final [LLV]:</span>
                                                    <span className="font-black" style={{ color: d.llv < 0 ? '#dc2626' : '#16a34a', fontSize: '1.2em' }}>
                                                        R$ {d.lucroRS.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px' }} />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="lucroRS"
                            name="Lucro Líquido Real (R$)"
                            stroke="#10B981"
                            strokeWidth={3}
                            fill={inputs.custoProduto ? "url(#lossGradient)" : "transparent"}
                            baseValue={0}
                            connectNulls
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="taxaShopeeRS"
                            name="Taxas Shopee (R$)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="3 3"
                        />
                        <ReferenceLine
                            key="tax-ref-preco-atual"
                            x={precoAtual}
                            stroke="#3b82f6"
                            strokeWidth={4}
                            label={{ 
                                position: 'top', 
                                value: 'SEU PREÇO', 
                                fill: '#1d4ed8', 
                                fontSize: 12, 
                                fontWeight: 900, 
                                dy: -15 
                            }}
                        />
                        
                        {/* Indicadores de Mudança de Política (Degraus) */}
                        {degrausPdv.map(pdv => {
                            const paThreshold = getPaFromPdv(pdv + 0.01); // Renderiza a linha na fronteira de aumento da taxa (ex: > 79.99)
                            return (
                                <ReferenceLine
                                    key={`tax-threshold-${pdv}`}
                                    x={paThreshold}
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    strokeDasharray="3 3"
                                    label={{ 
                                        position: 'insideBottomLeft', 
                                        value: `Regra \n(PDV > ${pdv})`, 
                                        fill: '#b91c1c', 
                                        fontSize: 10, 
                                        fontWeight: 800,
                                        angle: 0
                                    }}
                                />
                            );
                        })}

                        <ReferenceLine yAxisId="left" y={0} stroke="#64748b" strokeWidth={1} label={{ value: 'Ponto de Equilíbrio (R$ 0,00)', position: 'right', fill: '#64748b', fontSize: 10, dy: -10 }} />
                    </ComposedChart>
                </ResponsiveContainer>
                <div className="chart-footer" style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                    💡 Este gráfico compara diretamente em <strong>Reais (R$)</strong> o seu lucro real (verde) com as taxas totais da Shopee (laranja).
                </div>
            </div>
        );
    };

    // --- Novas Ferramentas de Otimização ---





    const handleLimpar = () => {
        setIsResetModalOpen(true);
    };

    const confirmReset = () => {
        setInputs(defaultInputs);
        setMargemDesejada(undefined);
        setIsAutoCalcMode(true); // Mantem auto ao resetar
        setIsResetModalOpen(false);
    };

    const moeda = (val: number | undefined) =>
        arredondar(val || 0, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const porc = (v: number) => {
        // Formata com no máximo 2 casas decimais usando o arredondamento financeiro
        const num = arredondar(v, 2);
        return num.toString().replace(".", ",");
    };

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
                            <Calculator size={18} /> Calcular Margem
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

                            <div className="input-group">
                                <label><ShoppingCart size={16} /> Custo do Produto (R$) {s('CDP')}</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    name="custoProduto"
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
                                />
                            </div>

                            <div className="input-group">
                                {aba === 'margem' ? (
                                    <>
                                        <div className="input-group" style={{ marginTop: '0.8rem' }}>
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
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="input-group" style={{ marginTop: '1rem' }}>
                                            <label style={{ margin: 0, marginBottom: '0.4rem', display: 'flex' }}>
                                                <TrendingUp size={16} />
                                                Lucro desejado {tipoMargemIdeal !== 'reais' ? '(%)' : '(R$)'}:
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
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Seção de Configurações Avançadas Colapsável */}
                            <div
                                className={`advanced-settings-header ${isAdvancedOpen ? 'open' : ''} ${!user && !isPasswordAuthorized ? 'locked' : ''}`}
                                onClick={() => {
                                    if (user || isPasswordAuthorized) {
                                        setIsAdvancedOpen(!isAdvancedOpen);
                                    } else {
                                        setShowPasswordPrompt(!showPasswordPrompt);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="header-title">
                                    {(user || isPasswordAuthorized) ? (
                                        <ChevronDown size={20} className="chevron-icon" />
                                    ) : (
                                        <Lock size={18} className="lock-icon" />
                                    )}
                                    <span>Configurações Avançadas</span>
                                    {(!user && !isPasswordAuthorized) && <span className="locked-tag">Restrito</span>}
                                    {isPasswordAuthorized && !user && <span className="unlocked-tag">Desbloqueado</span>}
                                </div>
                                <div className="header-line"></div>
                            </div>

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
                                            }}
                                            onChange={handleChange}
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
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
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
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
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
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
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
                                            }}
                                            onChange={handleChange}
                                            onWheel={handleWheel}
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

                            {/* Parâmetros de elasticidade removidos conforme nova lógica baseada em volume relativo */}
                        </div>
                        <div className="actions">
                            <button className="btn-outline" style={{ width: '100%' }} onClick={handleLimpar}>
                                <RotateCcw size={18} /> Reiniciar Calculadora
                            </button>
                        </div>
                    </div>
                </div>

                <div className="calculator-right">
                    {!results ? (
                        <div className="empty-results-card">
                            <Sparkles size={48} className="empty-icon" />
                            <h3>Aguardando Parâmetros</h3>
                            <p>Preencha os dados à esquerda para ver os cálculos em tempo real.</p>
                        </div>
                    ) : (
                        <div id="quick-results">
                            {/* Cálculos Antecipados */}
                            {(() => {
                                // No modo Ideal, os resultados já vêm calculados do handleCalcular
                                const activeResults = results || calcularTaxasShopee(inputs);

                                // Gerar status baseado no activeResults
                                let statusClass = 'status-orange';
                                let statusIcon = <AlertCircle size={20} />;
                                let statusText = 'Margem apertada';

                                if (activeResults.margemSobreVenda <= 0) {
                                    statusClass = 'status-red';
                                    statusIcon = <AlertCircle size={20} />;
                                    statusText = 'Prejuízo!';
                                } else if (activeResults.margemSobreVenda >= 15) {
                                    statusClass = 'status-green';
                                    statusIcon = <CheckCircle2 size={20} />;
                                    statusText = 'Boa margem de lucro';
                                }

                                return (
                                    <>
                                        {/* Desativado temporariamente conforme solicitado
                                        {aba === 'margem' && sweetSpot && sweetSpot.cenarioOtimizado.precoAnunciado !== sweetSpot.cenarioAtual.precoAnunciado && (
                                            <div className="sweet-spot-card" ...>
                                                ...
                                            </div>
                                        )}
                                        */}





                                        {(() => {
                                            const lucroAtual = activeResults.lucroLiquido;
                                            const precoAtualSim = activeResults.precoVenda;
                                            
                                            const melhorAnterior = simulacao?.cenarios
                                                ?.filter((c: any) => {
                                                    // Só recomenda se o PDV for menor E o lucro unitário for realmente superior (Sweet Spot de Taxas)
                                                    return c.precoVenda < (precoAtualSim - 0.001) && c.lucroLiquido > (lucroAtual + 0.05);
                                                })
                                                ?.sort((a: any, b: any) => b.lucroLiquido - a.lucroLiquido)
                                                ?.[0];

                                            // Camada 2: Estratégia de Giro (Sensor de Alavancagem)
                                            // Focado em: Sacrificar pouca margem para dar muito desconto
                                            const MAX_LUCRO_PERDIDO_PCT = 0.15;
                                            const MIN_ALAVANCAGEM = inputs.fatorAlavancagem ?? 5.0;

                                            const melhorLeverage = !melhorAnterior ? simulacao?.cenarios
                                                ?.filter((c: any) => {
                                                    if (c.precoVenda >= (precoAtualSim - 0.01)) return false;
                                                    const qPreco = precoAtualSim - c.precoVenda;
                                                    const qLucro = lucroAtual - c.lucroLiquido;

                                                    if (qLucro > 0.001) {
                                                        const fator = qPreco / qLucro;
                                                        const pctPerda = qLucro / (lucroAtual || 1);
                                                        // Regras: Perder no máximo 15% do lucro e ganhar no mínimo 5x em desconto
                                                        return pctPerda <= MAX_LUCRO_PERDIDO_PCT && fator >= MIN_ALAVANCAGEM;
                                                    }
                                                    return false;
                                                })
                                                ?.sort((a: any, b: any) => {
                                                    const fA = (precoAtualSim - a.precoVenda) / (lucroAtual - a.lucroLiquido);
                                                    const fB = (precoAtualSim - b.precoVenda) / (lucroAtual - b.lucroLiquido);
                                                    return fB - fA;
                                                })?.[0] : null;

                                            const content = (
                                                <div className="premium-results-grid">
                                                    <div className="result-card primary" style={{
                                                        backgroundColor: activeResults.margemSobreVenda <= 0 ? '#fef2f2' : (activeResults.margemSobreVenda < 15 ? '#fff7ed' : '#f0fdf4'),
                                                        borderColor: activeResults.margemSobreVenda <= 0 ? '#fecaca' : (activeResults.margemSobreVenda < 15 ? '#fed7aa' : '#bbf7d0'),
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                    }}>
                                                        <div className="result-label" style={{
                                                            color: activeResults.margemSobreVenda <= 0 ? '#991b1b' : (activeResults.margemSobreVenda < 15 ? '#9a3412' : '#166534')
                                                        }}>
                                                            {aba === 'ideal' ? (
                                                                <>PREÇO DE VENDA IDEAL {s('PDVI')}</>
                                                            ) : (
                                                                <>PREÇO DE VENDA {s('PDV')}</>
                                                            )}
                                                        </div>
                                                        <div className="result-value" style={{
                                                            color: activeResults.margemSobreVenda <= 0 ? '#dc2626' : (activeResults.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                                                        }}>
                                                            R$ {moeda(activeResults.precoVenda)}
                                                        </div>
                                                        <div className="result-sub" style={{
                                                            color: activeResults.margemSobreVenda <= 0 ? '#b91c1c' : (activeResults.margemSobreVenda < 15 ? '#c2410c' : '#15803d'),
                                                            opacity: 1,
                                                            fontWeight: 600
                                                        }}>
                                                            {aba !== 'ideal' && (
                                                                `Margem atual de ${porc(activeResults.margemSobreVenda ?? 0)}%`
                                                            )}
                                                        </div>
                                                        <ShoppingCart size={24} className="card-icon" style={{
                                                            opacity: 0.1,
                                                            color: activeResults.margemSobreVenda <= 0 ? '#dc2626' : (activeResults.margemSobreVenda < 15 ? '#d97706' : '#10B981')
                                                        }} />
                                                    </div>

                                                    <div className="result-card secondary" style={{
                                                        backgroundColor: '#eff6ff',
                                                        borderColor: '#bfdbfe'
                                                    }}>
                                                        <div className="result-label" style={{ color: '#1e3a8a' }}>
                                                            {aba === 'ideal' ? (
                                                                <>PREÇO IDEAL ANUNCIADO {s('PIA')}</>
                                                            ) : (
                                                                <>PREÇO ANUNCIADO {s('PA')}</>
                                                            )}
                                                        </div>
                                                        <div className="result-value" style={{ color: '#1e40af' }}>
                                                            R$ {moeda(activeResults.precoComCupom)}
                                                        </div>
                                                        <div className="result-sub" style={{
                                                            color: '#1e40af',
                                                            opacity: 1
                                                        }}>
                                                            {aba === 'ideal' ? 'Preço de vitrine para cobrir cupom' : 'Valor exibido na vitrine'}
                                                        </div>
                                                        <TrendingUp size={24} className="card-icon" style={{
                                                            opacity: 0.1,
                                                            color: '#3b82f6'
                                                        }} />
                                                    </div>
                                                </div>
                                            );

                                            if (aba === 'ideal' && otimizacaoIdeal?.isOtimizado) {
                                                const paOri = otimizacaoIdeal.precoOriginal;
                                                const paOpt = otimizacaoIdeal.precoOtimizado;

                                                if (otimizacaoIdeal.isAlavancagem) {
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                            <div className={`alert-box-result ${statusClass}`}>
                                                                {statusIcon} <span>{statusText}</span>
                                                            </div>
                                                            <div className="alert-sensor-animated purple">
                                                                <div className="alert-sensor-animated-content">
                                                                    <div className="sensor-inner-alert">
                                                                        <RefreshCcw size={20} /> 
                                                                        <span>
                                                                            <strong>Estratégia de Giro Identificada:</strong> O preço anunciado ideal seria <strong>R$ {moeda(paOri)}</strong>. 
                                                                            Porém, ao reduzir para <strong>R$ {moeda(paOpt)}</strong>, você dá um super desconto de <strong>R$ {moeda(otimizacaoIdeal.quedaPreco)}</strong> para o cliente, 
                                                                            sacrificando apenas <strong>R$ {moeda(otimizacaoIdeal.quedaLucro)}</strong> de margem (Alavancagem de <strong>{otimizacaoIdeal.fatorAlavancagem.toFixed(1)}x</strong>).
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#5b21b6', borderTop: '1px solid rgba(139, 92, 246, 0.2)', paddingTop: '0.5rem' }}>
                                                                        <strong>Risco Baixíssimo:</strong> Você precisa aumentar suas vendas em apenas <strong>{porc(otimizacaoIdeal.esforcoPercentual)}%</strong> para empatar seu lucro atual. Rompendo essa marca, todo volume extra vira lucro puro!
                                                                    </div>
                                                                    {content}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="alert-sensor-animated">
                                                            <div className="alert-sensor-animated-content">
                                                                <div className="sensor-inner-alert">
                                                                    <TrendingUp size={20} /> 
                                                                    <span>
                                                                        <strong>Sensor de Otimização Automática Ativado:</strong> Para atingir o lucro desejado você teria que anunciar por no mínimo <strong>R$ {moeda(paOri)}</strong> (lucro de R$ {moeda(otimizacaoIdeal.lucroOriginal)}),
                                                                        entretanto, ao vasculhar as regras da Shopee eu identifiquei que reduzindo seu preço para <strong>R$ {moeda(paOpt)}</strong> você muda a faixa de impostos e seu lucro líquido final <strong>{otimizacaoIdeal.lucroOtimizado > otimizacaoIdeal.lucroOriginal ? 'subirá' : 'se manterá'} em R$ {moeda(otimizacaoIdeal.lucroOtimizado)}!</strong>
                                                                    </span>
                                                                </div>
                                                                {content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (melhorAnterior && aba !== 'ideal') {
                                                // Descobre o PA sugerido e o PDV resultante
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="alert-sensor-animated">
                                                            <div className="alert-sensor-animated-content">
                                                                <div className="sensor-inner-alert">
                                                                    <TrendingUp size={20} /> 
                                                                    <span>
                                                                        <strong>Sugestão do Sensor:</strong> Se você anunciar a <strong>R$ {moeda(melhorAnterior.precoVenda)}</strong>, seu lucro sobe para <strong>R$ {moeda(melhorAnterior.lucroLiquido)}</strong> devido à redução automática de taxas!
                                                                    </span>
                                                                </div>
                                                                {content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (melhorLeverage && aba !== 'ideal') {
                                                const qPreco = precoAtualSim - melhorLeverage.precoVenda;
                                                const qLucro = lucroAtual - melhorLeverage.lucroLiquido;
                                                const fator = qPreco / (qLucro || 0.01);
                                                const volNecessario = 100 * (lucroAtual / (melhorLeverage.lucroLiquido || 0.01));
                                                const esforco = volNecessario - 100;

                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        <div className={`alert-box-result ${statusClass}`}>
                                                            {statusIcon} <span>{statusText}</span>
                                                        </div>
                                                        <div className="alert-sensor-animated purple">
                                                            <div className="alert-sensor-animated-content">
                                                                <div className="sensor-inner-alert">
                                                                    <RefreshCcw size={20} /> 
                                                                    <span>
                                                                        <strong>Estratégia de Giro Identificada:</strong> O preço anunciado ideal seria <strong>R$ {moeda(precoAtualSim)}</strong>. Porém, ao reduzir para <strong>R$ {moeda(melhorLeverage.precoComCupom)}</strong>, você dá um super desconto de <strong>R$ {moeda(qPreco)}</strong> para o cliente, sacrificando apenas <strong>R$ {moeda(qLucro)}</strong> de lucro (Alavancagem de <strong>{fator.toFixed(1)}x</strong>).
                                                                    </span>
                                                                </div>
                                                                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#5b21b6', borderTop: '1px solid rgba(139, 92, 246, 0.2)', paddingTop: '0.5rem' }}>
                                                                    <strong>Risco Baixíssimo:</strong> Você precisa aumentar suas vendas em apenas <strong>{porc(esforco)}%</strong> para empatar seu lucro atual. Rompendo essa marca, todo volume extra vira lucro puro!
                                                                </div>
                                                                {content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div className={`alert-box-result ${statusClass}`}>
                                                        {statusIcon} <span>{statusText}</span>
                                                    </div>
                                                    {content}
                                                </div>
                                            );
                                        })()}


                                        <div className="details">
                                            <div style={{
                                                marginBottom: '1.5rem',
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
                                                        <span style={{ fontSize: '1.15rem', color: '#1e40af', fontWeight: 800 }}>Lucro liquido venda:</span>
                                                        <span style={{ fontSize: '1.15rem', color: '#1e40af', fontWeight: 800 }}>({porc(activeResults.margemSobreVenda)}%)</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontSize: '1.15rem', color: '#c2410c', fontWeight: 800 }}>Lucro liquido custo:</span>
                                                        <span style={{ fontSize: '1.15rem', color: '#c2410c', fontWeight: 800 }}>({porc(activeResults.margemLiquidaSobreCusto)}%)</span>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lucro Líquido Final</div>
                                                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1, whiteSpace: 'nowrap' }}>R$ {moeda(activeResults.lucroLiquido)}</div>
                                                </div>
                                            </div>

                                            {(inputs.cupomDesconto ?? 0) > 0 && activeResults && (
                                                <>
                                                    <div className="detail-row">
                                                        <span style={{ fontWeight: 700 }}>Preço Anunciado {s('PA')}:</span>
                                                        <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(activeResults.precoComCupom)}</span>
                                                    </div>
                                                    <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                                        <span>Desconto aplicado {s('CD')}:</span>
                                                        <div className="detail-values">
                                                            <span className="perc">({porc((activeResults.cupomValor || 0) / (activeResults.precoComCupom || 1) * 100)}%)</span>
                                                            <span className="val text-red">- R$ {moeda(activeResults.cupomValor)}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            <div className="detail-row">
                                                <span style={{ fontWeight: 700 }}>Preço de Venda {s('PDV')}:</span>
                                                <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(activeResults.precoVenda)}</span>
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
                                                    <span className="perc">({porc((inputs.custoProduto || 0) / (activeResults.precoVenda || 1) * 100)}%)</span>
                                                    <span className="val text-red">- R$ {moeda(inputs.custoProduto)}</span>
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

                                            {/* Ajustes Finais (Rebate) */}
                                            {(activeResults.rebateValor ?? 0) > 0 && (
                                                <div className="detail-row">
                                                    <span>Crédito de Rebate {s('CR')}:</span>
                                                    <div className="detail-values">
                                                        <span className="perc">({porc((activeResults.rebateValor || 0) / (activeResults.precoComCupom || 1) * 100)}%)</span>
                                                        <span className="val text-green">(+ R$ {moeda(activeResults.rebateValor)})</span>
                                                    </div>
                                                </div>
                                            )}


                                        </div>

                                        <div className="result-card mini large" style={{ marginTop: '2.5rem' }}>
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
                                                    {arredondar(activeResults.margemSobreVenda, 2).toFixed(2).replace('.', ',')}%
                                                </span>
                                                <span className="nominal">R$ {arredondar(activeResults.lucroLiquido || 0, 2).toFixed(2).replace('.', ',')}</span>
                                            </div>
                                        </div>

                                        {/* GRÁFICOS ANALÍTICOS RESTAURADOS - NOVA ORDEM SOLICITADA */}
                                        {simulacao && (
                                            <div className="analytical-charts-section" style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                <TaxasPrecoChart
                                                    inputs={inputs}
                                                    precoAtual={activeResults?.precoVenda || results?.precoVenda || 0}
                                                    isFullscreen={fullscreenChart === 'taxas'}
                                                    onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'taxas' ? null : 'taxas')}
                                                />
                                                <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                                                    <EstrategiaPrecoChart
                                                        dados={simulacao.cenarios}
                                                        precoAtual={activeResults?.precoVenda || results?.precoVenda || 0}
                                                        pontoIdeal={simulacao.pIdeal15}
                                                        pontoAlvo={(simulacao as any).pAlvo}
                                                        onPriceSelect={(p) => {
                                                            setInputs(prev => ({ ...prev, precoVenda: p }));
                                                            setTimeout(handleCalcular, 0);
                                                        }}
                                                        isFullscreen={fullscreenChart === 'estrategia'}
                                                        onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'estrategia' ? null : 'estrategia')}
                                                    />
                                                    <ComposicaoPrecoChart
                                                        dados={simulacao.cenarios}
                                                        precoAtual={activeResults?.precoVenda || results?.precoVenda || 0}
                                                        pontoIdeal={simulacao.pIdeal15}
                                                        pontoAlvo={(simulacao as any).pAlvo}
                                                        isFullscreen={fullscreenChart === 'composicao'}
                                                        onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'composicao' ? null : 'composicao')}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                        </div>
                    )
                    }
                </div >
            </div >

            <div className="table-section">
                <h2 className="table-title">📊 Escopo de Taxas Shopee 2026 {s('PDS')}</h2>
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
        </div >
    );
};

export default ShopeePage;
