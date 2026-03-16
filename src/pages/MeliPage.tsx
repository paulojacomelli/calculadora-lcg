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
    Package
} from 'lucide-react';

import type { MeliInput, MeliOutput, ResultadoSimulacaoMeli, TipoAnuncio } from '../utils/meliLogic';
import { calcularTaxasMeli, calcularPrecoIdealMeli, simularCenariosPrecoMeli, arredondar } from '../utils/meliLogic';
import { logCalculo } from '../firebase';

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
    const [, setSimulacao] = useState<ResultadoSimulacaoMeli | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    const [statusClass, setStatusClass] = useState('');
    const [statusText, setStatusText] = useState('');
    const [statusIcon, setStatusIcon] = useState<React.ReactNode>(null);

    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [focusedValue, setFocusedValue] = useState<string>('');

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

                            <div className="dre-container" style={{ marginTop: '1rem' }}>
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
                            <button className="btn-calculate-full" onClick={handleCalcular} style={{ width: '100%', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderRadius: '8px', border: 'none', background: '#00a650', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
                                <Calculator size={20} /> Calcular Minha Margem Agora
                            </button>
                            <button className="btn-clear-outline" onClick={handleLimpar} style={{ width: '100%', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: '500', cursor: 'pointer' }}>
                                <RotateCcw size={18} /> Limpar
                            </button>
                        </div>
                    )}
                </div>
            </div>

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
