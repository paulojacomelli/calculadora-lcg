import React, { useState } from 'react';
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
    HelpCircle,
    Maximize2,
    Minimize2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Line, Area, ReferenceLine
} from 'recharts';
import type { ShopeeInput, ShopeeOutput, ResultadoSimulacao, CenarioPreco } from '../utils/shopeeLogic';
import { calcularTaxasShopee, calcularPrecoIdeal, simularCenariosPreco, arredondar } from '../utils/shopeeLogic';
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
    cupomTipo: 'porcentagem'
};

const ShopeePage: React.FC = () => {
    const [aba, setAba] = useState<'margem' | 'ideal'>(() => {
        return (localStorage.getItem('@shopperPCC:aba') as 'margem' | 'ideal') || 'ideal';
    });
    const [tipoMargemIdeal, setTipoMargemIdeal] = useState<'venda' | 'custo'>(() => {
        return (localStorage.getItem('@shopperPCC:tipoMargemIdeal') as 'venda' | 'custo') || 'venda';
    });
    const [inputs, setInputs] = useState<ShopeeInput>(() => {
        const saved = localStorage.getItem('@shopperPCC:inputs');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Sanitiza├º├úo: converte strings numericas antigas para number real
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
    const [isAutoCalcMode, setIsAutoCalcMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('@shopperPCC:isAutoCalcMode');
        return saved === 'true';
    });
    const [results, setResults] = useState<ShopeeOutput | null>(null);
    const [simulacao, setSimulacao] = useState<ResultadoSimulacao | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

    const [statusClass, setStatusClass] = useState('');
    const [statusText, setStatusText] = useState('');
    const [statusIcon, setStatusIcon] = useState<React.ReactNode>(null);

    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [focusedValue, setFocusedValue] = useState<string>('');

    // Sair do fullscreen com a tecla ESC
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setFullscreenChart(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const getInputValue = (name: string, value: any) => {
        if (focusedInput === name) {
            return focusedValue;
        }
        if (value === undefined || value === null || value === '') return '';

        // For├ºa convers├úo para n├║mero caso venha como string do localStorage
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

        return (typeof num === 'number' && !isNaN(num)) ? arredondar(num, 2).toFixed(2).replace('.', ',') : '';
    };

    const s = (key: string) => <span className="tech-abbr">[{key}]</span>;

    // C├ílculo autom├ítico quando houver mudan├ºa nos inputs ou no modo e persist├¬ncia
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('@shopperPCC:aba', aba);
            localStorage.setItem('@shopperPCC:tipoMargemIdeal', tipoMargemIdeal);
            localStorage.setItem('@shopperPCC:inputs', JSON.stringify(inputs));
            localStorage.setItem('@shopperPCC:isAutoCalcMode', String(isAutoCalcMode));
            if (margemDesejada !== undefined) {
                localStorage.setItem('@shopperPCC:margemDesejada', String(margemDesejada));
            } else {
                localStorage.removeItem('@shopperPCC:margemDesejada');
            }
        }
        handleCalcular();
    }, [inputs, aba, margemDesejada, tipoMargemIdeal, isAutoCalcMode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (focusedInput === name) {
            setFocusedValue(value);
        }

        let val: any = value;

        // Todos os campos exceto os que terminam em 'Tipo' ou a aba s├úo num├®ricos
        const constitutesNumber = !name.endsWith('Tipo') && name !== 'aba' && name !== 'tipoMargemIdeal';

        if (constitutesNumber) {
            if (value === '' || value === '-' || value === ',' || value === '.') {
                val = undefined;
            } else {
                // Aceita ponto ou v├¡rgula como separador decimal para o parse
                val = parseFloat(value.replace(',', '.'));
                if (isNaN(val)) val = undefined;
            }
        }

        if (name === 'margemDesejada' || name === 'margemDesejada2') {
            setMargemDesejada(val);
        } else {
            setInputs((prev) => ({
                ...prev,
                [name]: val,
            }));
        }
    };

    // Prevenir scroll nos inputs
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        (e.target as HTMLInputElement).blur();
    };

    const handleCalcular = () => {
        let resultado: ShopeeOutput;
        let precoFinalStr = "";

        // 1. Determina o resultado principal (DRE)
        if (aba === 'margem') {
            if (inputs.precoVenda === undefined) {
                setResults(null);
                setSimulacao(null);
                setStatusClass('');
                setStatusText('');
                setStatusIcon(null);
                return;
            }
            resultado = calcularTaxasShopee(inputs);
            precoFinalStr = inputs.precoVenda?.toString() || "0";
        } else {
            if (inputs.custoProduto === undefined) {
                setResults(null);
                setSimulacao(null);
                setStatusClass('');
                setStatusText('');
                setStatusIcon(null);
                return;
            }
            // No modo Ideal, primeiro pegamos o pre├ºo alvo
            const pIdeal = calcularPrecoIdeal(inputs, margemDesejada, tipoMargemIdeal);
            resultado = calcularTaxasShopee({ ...inputs, precoVenda: pIdeal });
            precoFinalStr = pIdeal.toFixed(2);
        }

        // 2. Com o resultado em m├úos, gera a simula├º├úo anal├¡tica para os gr├íficos
        // IDEAL: Agora fixo em 15% conforme solicitado pelo usu├írio
        const pIdeal15 = calcularPrecoIdeal(inputs, 15, tipoMargemIdeal);
        const resIdeal15 = calcularTaxasShopee({ ...inputs, precoVenda: pIdeal15 });

        const margemReferencia = isAutoCalcMode ? (resultado?.margemSobreVenda ?? 0) : (margemDesejada ?? 0);
        const sim = simularCenariosPreco(inputs, margemReferencia, tipoMargemIdeal);

        // 3. Inje├º├úo de Pontos Cr├¡ticos para Interatividade no Gr├ífico
        // Precisamos garantir que o array de cen├írios tenha os pre├ºos exatos das linhas de refer├¬ncia
        // para que o tooltip do Recharts funcione perfeitamente neles.
        const pAtualVal = inputs.precoVenda || 0;
        const resAtual = calcularTaxasShopee({ ...inputs, precoVenda: pAtualVal });

        const pontosExtras: CenarioPreco[] = [
            { ...resAtual, pesoTaxas: (resAtual.comissaoValor + resAtual.tarifaFixa + resAtual.impostoValor + resAtual.custoAds) / (resAtual.precoVenda || 1) * 100, eficiencia: 100 },
            { ...resIdeal15, pesoTaxas: (resIdeal15.comissaoValor + resIdeal15.tarifaFixa + resIdeal15.impostoValor + resIdeal15.custoAds) / (resIdeal15.precoVenda || 1) * 100, eficiencia: 100 },
            sim.pontoIdeal // Ponto Alvo
        ];

        // Mescla, remove duplicados e ordena por pre├ºo
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

        // Se estivermos na aba ideal, garantimos que o resultado usado seja o do ponto ideal da simula├º├úo para precis├úo total
        if (aba === 'ideal') {
            resultado = sim.pontoIdeal;
        }

        setResults(resultado);

        // Determina status basado na margem sobre o custo (Markup real)
        const msv = resultado.margemSobreVenda;

        if (msv <= 0) {
            setStatusClass('status-red');
            setStatusText('Preju├¡zo!');
            setStatusIcon(<AlertCircle size={24} />);
        } else if (msv < 15) {
            setStatusClass('status-orange');
            setStatusText('Margem apertada');
            setStatusIcon(<AlertTriangle size={24} />);
        } else if (msv < 25) {
            setStatusClass('status-green');
            setStatusText('Boa margem de lucro');
            setStatusIcon(<CheckCircle2 size={24} />);
        } else {
            setStatusClass('status-green');
            setStatusText('Excelente margem de lucro!');
            setStatusIcon(<Sparkles size={24} />);
        }

        logCalculo(parseFloat(precoFinalStr), resultado.margemSobreVenda, "CNPJ");
    };

    // --- Sub-componentes de Gr├ífico ---
    const Composi├º├úoPrecoChart = ({ dados, precoAtual, pontoIdeal, pontoAlvo, isFullscreen, onToggleFullscreen }: {
        dados: CenarioPreco[],
        precoAtual: number,
        pontoIdeal: CenarioPreco,
        pontoAlvo?: CenarioPreco,
        isFullscreen: boolean,
        onToggleFullscreen: () => void
    }) => {
        // 1. Identifica os pontos cr├¡ticos
        const pontoVoce = dados.reduce((prev, curr) =>
            Math.abs(curr.precoVenda - precoAtual) < Math.abs(prev.precoVenda - precoAtual) ? curr : prev
        );

        // 2. Filtra pontos representativos (menos pontos para n├úo poluir)
        const pontosBase = dados.filter((_, idx) => idx % 6 === 0);

        // 3. Mescla tudo, PRIORIZANDO os r├│tulos especiais
        const pontosGrafico = [...pontosBase, pontoVoce, pontoIdeal, ...(pontoAlvo ? [pontoAlvo] : [])]
            .sort((a, b) => a.precoVenda - b.precoVenda)
            .filter((v, i, a) => {
                // Se ├® um ponto especial, ele FICA.
                if (v === pontoVoce || v === pontoIdeal || v === pontoAlvo) return true;

                // Se o pr├│ximo ou anterior for especial e estiver muito perto, este ponto sai.
                const especialPerto = a.some(esp =>
                    (esp === pontoVoce || esp === pontoIdeal || esp === pontoAlvo) &&
                    esp !== v &&
                    Math.abs(v.precoVenda - esp.precoVenda) < 25
                );

                if (especialPerto) return false;

                // Filtro normal de densidade
                return i === 0 || Math.abs(v.precoVenda - a[i - 1].precoVenda) > 30;
            })
            .map(c => {
                const isVoce = c === pontoVoce;
                const isIdeal = c === pontoIdeal;
                const isAlvo = c === pontoAlvo && c !== pontoIdeal;

                let label = `R$ ${c.precoVenda.toFixed(0)}`;
                if (isVoce) label = 'VOC├è';
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
                    <h4 className="chart-title">Distribui├º├úo do Pre├ºo de Venda</h4>
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
                                return item ? `Pre├ºo de venda: ${item.fullPreco}` : label;
                            }}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                        <Bar dataKey="Lucro" stackId="a" fill="#10B981" name="Lucro" />
                        <Bar dataKey="Custo" stackId="a" fill="#EF4444" name="Custo" />
                        <Bar dataKey="Ads" stackId="a" fill="#3b82f6" name="Ads" />
                        <Bar dataKey="Operacao" stackId="a" fill="#fbbf24" name="Opera├º├úo" />
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
        // Encontra o ponto Ideal e Alvo no array para refer├¬ncias externas se necess├írio
        const isAlvoDifferentFromIdeal = Math.abs(pontoAlvo.precoVenda - pontoIdeal.precoVenda) > 0.01;
        const isSamePriceYouAlvo = Math.abs(precoAtual - pontoAlvo.precoVenda) < 0.01;

        // Calcula o dom├¡nio X dinamicamente para manter o "VOC├è" e o "IDEAL" centralizados/vis├¡veis
        const minP = Math.min(precoAtual, pontoIdeal.precoVenda, pontoAlvo.precoVenda);
        const maxP = Math.max(precoAtual, pontoIdeal.precoVenda, pontoAlvo.precoVenda);
        const center = (minP + maxP) / 2;
        const diff = maxP - minP;
        const margin = Math.max(diff * 1.5, center * 0.2, 50);
        const domainX = [Math.max(0, center - margin), center + margin];

        return (
            <div className={`chart-container ${isFullscreen ? 'fullscreen' : ''}`} style={{ cursor: 'crosshair' }}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">An├ílise de Lucratividade vs Pre├ºo</h4>
                    <button className="fullscreen-toggle" onClick={onToggleFullscreen} title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={isFullscreen ? "80%" : 300}>
                    <ComposedChart
                        data={dados}
                        margin={{ top: 40, right: 30, left: 0, bottom: 0 }}
                        onClick={(state: any) => {
                            if (state && state.activePayload && state.activePayload.length > 0) {
                                const clickedPrice = state.activePayload[0].payload.precoVenda;
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
                        <YAxis hide />
                        <Tooltip
                            shared={true}
                            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: string | undefined) => [
                                name === '% Taxas' ? `${Number(value).toFixed(1)}%` : `R$ ${Number(value).toFixed(2)}`,
                                name ?? ''
                            ]}
                            labelFormatter={(label) => `Pre├ºo: R$ ${Number(label).toFixed(2)}`}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="lucroLiquido" name="Lucro L├¡quido" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                        <Line type="monotone" dataKey="pesoTaxas" name="% Taxas" stroke="#f97316" strokeWidth={2} dot={false} yAxisId={1} />
                        <YAxis yAxisId={1} hide domain={[0, 100]} />

                        {/* Linha IDEAL (Fixo 15%) (Verde) - Mais alta */}
                        <ReferenceLine
                            x={pontoIdeal.precoVenda}
                            stroke="#10B981"
                            strokeDasharray="3 3"
                            label={{ position: 'top', value: 'IDEAL (15%)', fontSize: 10, fill: '#065f46', fontWeight: 'bold', dy: -35 }}
                        />

                        {/* Linha SEU ALVO (Laranja) - M├®dia */}
                        {isAlvoDifferentFromIdeal && (
                            <ReferenceLine
                                x={pontoAlvo.precoVenda}
                                stroke="#f59e0b"
                                strokeDasharray="5 5"
                                label={{ position: 'top', value: 'ALVO', fontSize: 10, fill: '#b45309', fontWeight: 'bold', dy: -18 }}
                            />
                        )}

                        {/* Linha VOC├è Atual (Azul) - Base */}
                        <ReferenceLine
                            x={precoAtual}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            label={{ position: 'top', value: isSamePriceYouAlvo ? 'VOC├è (ALVO)' : 'VOC├è', fontSize: 10, fill: '#1d4ed8', fontWeight: 'bold', dy: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
                <div className="chart-footer">
                    ­ƒÆí Dica: <strong>Clique em qualquer ponto</strong> do gr├ífico para aplicar esse pre├ºo na calculadora.
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
        // 1. Gera├º├úo Din├ómica do Eixo X (Simula├º├úo de Escopo)
        const minX = 40;
        const maxX = Math.max(250, precoAtual * 1.5);
        const step = 5;

        const simData: any[] = [];

        // Gerador de pontos (Itera├º├úo + Pontos Cr├¡ticos de Degrau)
        const pontosX = [];
        for (let x = minX; x <= maxX; x += step) {
            pontosX.push(x);
        }
        // Inje├º├úo obrigat├│ria dos pontos de degrau Shopee
        pontosX.push(79.99, 80.00);
        pontosX.sort((a, b) => a - b);

        // Remove duplicatas pr├│ximas geradas pela inje├º├úo
        const pontosUnicos = pontosX.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 0.01);

        pontosUnicos.forEach(pdvSim => {
            const res = calcularTaxasShopee({ ...inputs, precoVenda: pdvSim });

            const taxaShopeeRS = res.comissaoValor + res.tarifaFixa;
            const taxaShopeeTotalPct = pdvSim > 0 ? (taxaShopeeRS / pdvSim) * 100 : 0;

            const custoPDL_RS = (res as any).custoProdutoValor + res.impostoValor + res.despesaFixaValor + res.despesaAdicionalValor + res.custoAds;
            const lucroLiquidoRS = res.lucroLiquido;
            const llv = res.margemSobreVenda;

            simData.push({
                precoVenda: pdvSim,
                taxaTotalPct: taxaShopeeTotalPct,
                llv: llv,
                custoLcg: custoPDL_RS,
                taxaShopeeRS: taxaShopeeRS,
                lucroRS: lucroLiquidoRS,
                isLoss: llv < 0
            });
        });

        return (
            <div className={`chart-container large-chart ${isFullscreen ? 'fullscreen' : ''}`}>
                <div className="chart-header-actions">
                    <h4 className="chart-title">Visualiza├º├úo do Escopo Shopee 2026</h4>
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
                            dataKey="precoVenda"
                            type="number"
                            domain={[minX, 'dataMax']}
                            tickFormatter={(val) => `R$${val.toFixed(0)}`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            label={{ value: 'Pre├ºo de Venda Simulado (R$)', position: 'bottom', offset: 0, fontSize: 10 }}
                        />
                        <YAxis
                            tickFormatter={(val) => `${val}%`}
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
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
                                                PDV Simulado: <span style={{ color: '#2563eb' }}>R$ {Number(label).toFixed(2)}</span>
                                            </p>
                                            <div className="space-y-2 text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Custo Fixo LCG:</span>
                                                    <span className="font-bold text-gray-900">R$ {d.custoLcg.toFixed(2)}</span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="text-gray-500">Taxa Shopee PDS:</span>
                                                    <span className="font-bold" style={{ color: '#f97316' }}>R$ {d.taxaShopeeRS.toFixed(2)}</span>
                                                </div>

                                                <div className="pt-1 mt-1" style={{ borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="font-semibold text-gray-600">Taxa Total (%):</span>
                                                    <span className="font-extrabold" style={{ color: '#f97316', fontSize: '1.1em' }}>{d.taxaTotalPct.toFixed(2)}%</span>
                                                </div>

                                                <div className="pt-2 mt-1" style={{ borderTop: '2px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="font-bold text-gray-700">LLV Projetado:</span>
                                                    <span className="font-black" style={{ color: d.llv < 0 ? '#dc2626' : '#16a34a', fontSize: '1.2em' }}>
                                                        {d.llv.toFixed(2)}%
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

                        {/* ├üreas de Gr├ífico */}
                        <Area
                            type="monotone"
                            dataKey="llv"
                            name="Margem de Lucro (LLV) (%)"
                            stroke="#10B981"
                            strokeWidth={3}
                            fill={inputs.custoProduto ? "url(#lossGradient)" : "transparent"}
                            baseValue={0}
                            connectNulls
                        />

                        <Line
                            type="monotone"
                            dataKey="taxaTotalPct"
                            name="Taxa Total Shopee (%)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="3 3"
                        />

                        {/* Elementos Estrat├®gicos */}
                        <ReferenceLine
                            x={precoAtual}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{ position: 'top', value: 'SEU PRE├çO', fill: '#1d4ed8', fontSize: 10, fontWeight: 800, dy: -10 }}
                        />

                        <ReferenceLine
                            x={80}
                            stroke="#ef4444"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            label={{ position: 'insideBottomLeft', value: 'Degrau R$80', fill: '#ef4444', fontSize: 9, fontWeight: 600 }}
                        />

                        <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                    </ComposedChart>
                </ResponsiveContainer>
                <div className="chart-footer" style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                    ­ƒÆí Este gr├ífico simula como a sua <strong>margem real (verde)</strong> reage ├ás taxas da Shopee e seus custos em diferentes pre├ºos.
                </div>
            </div>
        );
    };

    const handleLimpar = () => {
        setIsResetModalOpen(true);
    };

    const confirmReset = () => {
        setInputs(defaultInputs);
        setMargemDesejada(undefined);
        setIsAutoCalcMode(false);
        setResults(null);
        setSimulacao(null);
        setStatusClass('');
        setStatusText('');
        setStatusIcon(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('@shopperPCC:inputs');
            localStorage.removeItem('@shopperPCC:margemDesejada');
            localStorage.removeItem('@shopperPCC:isAutoCalcMode');
        }
        setIsResetModalOpen(false);
    };

    const moeda = (val: number | undefined) =>
        arredondar(val || 0, 2).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const porc = (v: number) => {
        // Formata com no m├íximo 2 casas decimais usando o arredondamento financeiro
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
                    Descubra sua margem de contribui├º├úo com as novas regras de comiss├úo 2026. Resultado em segundos!
                </p>
                <div className="tags-container">
                    <span className="tag tag-yellow"><Sparkles size={14} /> Ferramenta Gratuita</span>
                    <span className="tag tag-orange">Novo C├ílculo 2026</span>
                </div>
                <div className="alert-box alert-orange" style={{ marginTop: '1.5rem' }}>
                    <RefreshCcw className="alert-icon" size={20} />
                    <p>
                        <strong>Atualizado!</strong> Novas regras de comiss├úo da Shopee vigentes a partir de <strong>01/03/2026</strong>.
                        A comiss├úo agora varia por faixa de pre├ºo (de 14% a 20%) com tarifas fixas de R$4 a R$26. Vendedores CPF com 450+ pedidos em 90 dias pagam R$3 adicionais por item.
                    </p>
                </div>
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
                            <CircleDollarSign size={18} /> Pre├ºo Ideal
                        </button>
                    </div>

                    <div className="card">
                        <div className="card-title">
                            <span className="number-badge">1</span> Par├ómetros de C├ílculo {s('PDL')}
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
                                        setFocusedValue(inputs.custoProduto !== undefined ? inputs.custoProduto.toString().replace('.', ',') : '');
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
                                            <label><TrendingUp size={16} /> Pre├ºo de Venda (R$) {s('PDV')}</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                name="precoVenda"
                                                placeholder="0,00"
                                                value={getInputValue('precoVenda', inputs.precoVenda)}
                                                onFocus={() => {
                                                    setFocusedInput('precoVenda');
                                                    setFocusedValue(inputs.precoVenda !== undefined ? inputs.precoVenda.toString().replace('.', ',') : '');
                                                }}
                                                onBlur={() => {
                                                    setFocusedInput(null);
                                                    setFocusedValue('');
                                                }}
                                                onChange={handleChange}
                                                onWheel={handleWheel}
                                            />
                                        </div>

                                        <div className="input-group" style={{ marginTop: '1rem' }}>
                                            <label style={{ margin: 0, marginBottom: '0.4rem', display: 'flex' }}>
                                                <CircleDollarSign size={16} /> Lucro L├¡quido Final {isAutoCalcMode ? '(%)' : 'Desejado (%)'} {isAutoCalcMode ? s('LLV') : s('LLVD')}
                                            </label>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    name="margemDesejada"
                                                    placeholder="0,00"
                                                    value={isAutoCalcMode ? (results?.margemSobreVenda !== undefined ? arredondar(results.margemSobreVenda, 2).toFixed(2).replace('.', ',') : '') : getInputValue('margemDesejada', margemDesejada)}
                                                    disabled={isAutoCalcMode}
                                                    className={isAutoCalcMode ? 'optional-input auto-calculated-input' : ''}
                                                    onFocus={() => {
                                                        if (!isAutoCalcMode) {
                                                            setFocusedInput('margemDesejada');
                                                            setFocusedValue(margemDesejada !== undefined ? margemDesejada.toString().replace('.', ',') : '');
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        setFocusedInput(null);
                                                        setFocusedValue('');
                                                    }}
                                                    onChange={handleChange}
                                                    onWheel={handleWheel}
                                                    style={{ paddingRight: '120px' }}
                                                />
                                                <div
                                                    style={{
                                                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                                        background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0'
                                                    }}
                                                    data-version="1.0.38-beta"
                                                    onClick={() => setIsAutoCalcMode(!isAutoCalcMode)}
                                                >
                                                    <Sparkles size={14} color={isAutoCalcMode ? "#10B981" : "#94a3b8"} />
                                                    <span style={{ fontSize: '0.75rem', color: isAutoCalcMode ? '#10B981' : '#94a3b8', fontWeight: 600 }}>Auto-PDV</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isAutoCalcMode}
                                                        onChange={(e) => setIsAutoCalcMode(e.target.checked)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#10B981', margin: 0 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="input-group">
                                            <label>
                                                <TrendingUp size={16} />{' '}
                                                {tipoMargemIdeal === 'custo'
                                                    ? <>Margem Desejada sobre Custo (%) {s('MDC')}</>
                                                    : <>Lucro Desejado sobre a Venda (%) {s('LLV')}</>}
                                                <HelpCircle size={14} className="label-help" />
                                            </label>

                                            <div className="margin-type-tabs">
                                                <button
                                                    className={`margin-tab ${tipoMargemIdeal === 'custo' ? 'active' : ''}`}
                                                    onClick={() => setTipoMargemIdeal('custo')}
                                                >
                                                    Sobre Custo
                                                </button>
                                                <button
                                                    className={`margin-tab ${tipoMargemIdeal === 'venda' ? 'active' : ''}`}
                                                    onClick={() => setTipoMargemIdeal('venda')}
                                                >
                                                    Sobre a Venda
                                                </button>
                                            </div>

                                            <div className="input-with-icon">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    name="margemDesejada2"
                                                    placeholder="0,00"
                                                    value={getInputValue('margemDesejada2', margemDesejada)}
                                                    onFocus={() => {
                                                        setFocusedInput('margemDesejada2');
                                                        setFocusedValue(margemDesejada !== undefined ? margemDesejada.toString().replace('.', ',') : '');
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

                            <div className="input-section-title">Impostos e Custos Fixos</div>

                            <div className="input-group">
                                <label><Sparkles size={16} /> Imposto {s('IMP')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="impostoPorcentagem"
                                        className="input-main"
                                        value={getInputValue('impostoPorcentagem', inputs.impostoPorcentagem)}
                                        onFocus={() => {
                                            setFocusedInput('impostoPorcentagem');
                                            setFocusedValue(inputs.impostoPorcentagem !== undefined ? inputs.impostoPorcentagem.toString().replace('.', ',') : '');
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
                                            setFocusedValue(inputs.despesaFixa !== undefined ? inputs.despesaFixa.toString().replace('.', ',') : '');
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
                                            setFocusedValue(inputs.despesaAdicional !== undefined ? inputs.despesaAdicional.toString().replace('.', ',') : '');
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
                                            setFocusedValue(inputs.adsValor !== undefined ? inputs.adsValor.toString().replace('.', ',') : '');
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

                            <div className="input-group">
                                <label><Sparkles size={16} /> Cr├®dito de Rebate {s('CR')}</label>
                                <div className="input-composite">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="rebatePorcentagem"
                                        className="input-main"
                                        value={getInputValue('rebatePorcentagem', inputs.rebatePorcentagem)}
                                        onFocus={() => {
                                            setFocusedInput('rebatePorcentagem');
                                            setFocusedValue(inputs.rebatePorcentagem !== undefined ? inputs.rebatePorcentagem.toString().replace('.', ',') : '');
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
                                            setFocusedValue(inputs.cupomDesconto !== undefined ? inputs.cupomDesconto.toString().replace('.', ',') : '');
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
                            <h3>Aguardando Par├ómetros</h3>
                            <p>Preencha os dados ├á esquerda para ver os c├ílculos em tempo real.</p>
                        </div>
                    ) : (
                        <div id="quick-results">
                            <div className={`alert-box-result ${statusClass}`}>
                                {statusIcon} <span>{statusText}</span>
                            </div>

                            <div className="premium-results-grid">
                                {(() => {
                                    let pdvIdeal: number;
                                    let pccIdeal: number;

                                    if (isAutoCalcMode && results) {
                                        // No modo Autom├ítico, o Ideal ├® o Real. Espelhamos a DRE para evitar d├¡zimas de centavos.
                                        pdvIdeal = results.precoVenda;
                                        pccIdeal = results.precoComCupom;
                                    } else {
                                        const margemAtiva = margemDesejada ?? 0;
                                        pdvIdeal = calcularPrecoIdeal({ ...inputs, cupomDesconto: 0 }, margemAtiva, tipoMargemIdeal);

                                        // C├ílculo do PCC seguindo EXATAMENTE a l├│gica do shopeeLogic.ts
                                        if (inputs.cupomDesconto && inputs.cupomDesconto > 0) {
                                            if (inputs.cupomTipo === 'porcentagem') {
                                                const fator = (1 - (inputs.cupomDesconto / 100));
                                                const rawPCC = fator > 0 ? pdvIdeal / fator : pdvIdeal;
                                                pccIdeal = arredondar(rawPCC, 2);
                                            } else {
                                                pccIdeal = pdvIdeal + inputs.cupomDesconto;
                                            }
                                        } else {
                                            pccIdeal = pdvIdeal;
                                        }
                                    }

                                    return (
                                        <>
                                            <div className="result-card primary" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                                                <div className="result-label" style={{ color: '#166534' }}>PRE├çO DE VENDA IDEAL {s('PDVI')}</div>
                                                <div className="result-value" style={{ color: '#10B981' }}>
                                                    R$ {arredondar(pdvIdeal, 2).toFixed(2).replace('.', ',')}
                                                </div>
                                                <div className="result-sub">Para atingir {porc(isAutoCalcMode ? (results?.margemSobreVenda ?? 0) : (margemDesejada ?? 0))}% de lucro</div>
                                                <ShoppingCart size={24} className="card-icon" style={{ opacity: 0.1, color: '#10B981' }} />
                                            </div>

                                            <div className="result-card secondary" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                                                <div className="result-label" style={{ color: '#1e3a8a' }}>PRE├çO IDEAL C/ CUPOM {s('PICP')}</div>
                                                <div className="result-value" style={{ color: '#3b82f6' }}>
                                                    R$ {arredondar(pccIdeal, 2).toFixed(2).replace('.', ',')}
                                                </div>
                                                <div className="result-sub">Pre├ºo de vitrine para cobrir cupom</div>
                                                <TrendingUp size={24} className="card-icon" style={{ opacity: 0.1, color: '#3b82f6' }} />
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className="result-card mini large">
                                    <div className="result-header">
                                        {results.margemSobreCusto > 0 ? (
                                            <ArrowUpRight size={18} className="text-green" />
                                        ) : (
                                            <ArrowDownRight size={18} className="text-red" />
                                        )} Margem sobre Custo {s('MSC')}
                                    </div>
                                    <div className="result-body">
                                        <span className={`percentage ${results.margemSobreCusto <= 0 ? 'text-red' :
                                            results.margemSobreVenda < 15 ? 'text-orange' : 'text-green'
                                            }`}>
                                            {arredondar(results.margemSobreCusto, 2).toFixed(2).replace('.', ',')}%
                                        </span>
                                        <span className="nominal">R$ {arredondar(results.nominalSobreCusto || 0, 2).toFixed(2).replace('.', ',')}</span>
                                    </div>
                                </div>
                            </div>

                            {simulacao && (
                                <div className="simulation-dashboard">
                                    <div className="dashboard-grid">
                                        <Composi├º├úoPrecoChart
                                            dados={simulacao.cenarios}
                                            precoAtual={results?.precoVenda || inputs.precoVenda || 0}
                                            pontoIdeal={(simulacao as any).pIdeal15}
                                            pontoAlvo={(simulacao as any).pAlvo}
                                            isFullscreen={fullscreenChart === 'distribuicao'}
                                            onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'distribuicao' ? null : 'distribuicao')}
                                        />
                                        <EstrategiaPrecoChart
                                            dados={simulacao.cenarios}
                                            precoAtual={results?.precoVenda || inputs.precoVenda || 0}
                                            pontoIdeal={(simulacao as any).pIdeal15}
                                            pontoAlvo={(simulacao as any).pAlvo}
                                            onPriceSelect={(p) => {
                                                setInputs(prev => ({ ...prev, precoVenda: p }));
                                                setTimeout(handleCalcular, 0);
                                            }}
                                            isFullscreen={fullscreenChart === 'estrategia'}
                                            onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'estrategia' ? null : 'estrategia')}
                                        />
                                        <TaxasPrecoChart
                                            inputs={inputs}
                                            precoAtual={results?.precoVenda || inputs.precoVenda || 0}
                                            isFullscreen={fullscreenChart === 'taxas'}
                                            onToggleFullscreen={() => setFullscreenChart(fullscreenChart === 'taxas' ? null : 'taxas')}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="details">
                                {(inputs.cupomDesconto ?? 0) > 0 && results && (
                                    <>
                                        <div className="detail-row">
                                            <span style={{ fontWeight: 700 }}>Pre├ºo com cupom {s('PCC')}:</span>
                                            <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results.precoComCupom)}</span>
                                        </div>
                                        <div className="detail-row" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                            <span>Desconto aplicado {s('CD')}:</span>
                                            <div className="detail-values">
                                                <span className="perc">({porc((results.cupomValor || 0) / (results.precoComCupom || 1) * 100)}%)</span>
                                                <span className="val text-red">- R$ {moeda(results.cupomValor)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div className="detail-row">
                                    <span style={{ fontWeight: 700 }}>Pre├ºo de Venda {s('PDV')}:</span>
                                    <span className="val" style={{ fontWeight: 700 }}>R$ {moeda(results ? results.precoVenda : inputs.precoVenda)}</span>
                                </div>

                                <div className="details-group-header">Pol├¡tica da Shopee {s('PDS')}</div>
                                <div className="detail-row">
                                    <span>Comiss├úo Shopee ({arredondar(results.comissaoPorcentagem, 0)}%) {s('CS')}:</span>
                                    <div className="detail-values">
                                        <span className="perc">({porc(results.comissaoPorcentagem)}%)</span>
                                        <span className="val text-red">- R$ {moeda(results.comissaoValor)}</span>
                                    </div>
                                </div>
                                <div className="detail-row">
                                    <span>Tarifa Fixa Shopee {s('TFS')}:</span>
                                    <div className="detail-values">
                                        <span className="perc">({porc((results.tarifaFixa || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                        <span className="val text-red">- R$ {moeda(results.tarifaFixa)}</span>
                                    </div>
                                </div>

                                <div className="details-group-header">Pol├¡tica da LCG {s('PDL')}</div>
                                <div className="detail-row">
                                    <span>Custo do Produto {s('CDP')}:</span>
                                    <div className="detail-values">
                                        <span className="perc">({porc((inputs.custoProduto || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                        <span className="val text-red">- R$ {moeda(inputs.custoProduto)}</span>
                                    </div>
                                </div>
                                {(results.impostoValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Imposto {s('IMP')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.impostoValor || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.impostoValor)}</span>
                                        </div>
                                    </div>
                                )}
                                {(results.custoAds ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Ads Shopee {s('ADS')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.custoAds || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.custoAds)}</span>
                                        </div>
                                    </div>
                                )}
                                {(inputs.despesaFixa ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Despesa fixa {s('DF')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.despesaFixaValor || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.despesaFixaValor || 0)}</span>
                                        </div>
                                    </div>
                                )}
                                {(inputs.despesaAdicional ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Outras Despesas {s('OD')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.despesaAdicionalValor || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                            <span className="val text-red">- R$ {moeda(results.despesaAdicionalValor || 0)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Ajustes Finais (Rebate) */}
                                {(results.rebateValor ?? 0) > 0 && (
                                    <div className="detail-row">
                                        <span>Cr├®dito de Rebate {s('CR')}:</span>
                                        <div className="detail-values">
                                            <span className="perc">({porc((results.rebateValor || 0) / (results.precoVenda || 1) * 100)}%)</span>
                                            <span className="val text-green">(+ R$ {moeda(results.rebateValor)})</span>
                                        </div>
                                    </div>
                                )}

                                <div className={`detail-row total ${statusClass}`}>
                                    <span>Lucro L├¡quido Final {s('LLV')}:</span>
                                    <div className="detail-values">
                                        <span className="perc" style={{ fontWeight: 800 }}>({porc(results.margemSobreVenda)}%)</span>
                                        <span className="val" style={{ fontWeight: 800 }}>R$ {moeda(results.lucroLiquido)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="table-section">
                <h2 className="table-title">­ƒôè Escopo de Taxas Shopee 2026 {s('PDS')}</h2>
                <div className="table-responsive">
                    <table className="shopee-table">
                        <thead>
                            <tr>
                                <th>Faixa de Pre├ºo</th>
                                <th>Comiss├úo % {s('CS')}</th>
                                <th>Tarifa Fixa {s('TFS')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>At├® R$ 79,99</td><td>20%</td><td>R$ 4,00</td></tr>
                            <tr><td>R$ 80,00 a R$ 99,99</td><td>14%</td><td>R$ 16,00</td></tr>
                            <tr><td>R$ 100,00 a R$ 199,99</td><td>14%</td><td>R$ 20,00</td></tr>
                            <tr><td>R$ 200,00 a R$ 499,99</td><td>14%</td><td>R$ 26,00</td></tr>
                            <tr><td>Acima de R$ 500,00</td><td>14%</td><td>R$ 26,00</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirma├º├úo de Reset */}
            {isResetModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-icon-container">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="modal-title">Reiniciar Calculadora?</h3>
                        <p className="modal-description">
                            Isso ir├í limpar todos os dados preenchidos nos par├ómetros. Esta a├º├úo n├úo pode ser desfeita.
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
            )}
        </div>
    );
};

export default ShopeePage;
