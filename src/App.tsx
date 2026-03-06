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
  HelpCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, Area, ReferenceLine
} from 'recharts';
import type { ShopeeInput, ShopeeOutput, ResultadoSimulacao, CenarioPreco } from './utils/shopeeLogic';
import { calcularTaxasShopee, calcularPrecoIdeal, simularCenariosPreco } from './utils/shopeeLogic';
import { logCalculo } from './firebase';

const defaultInputs: ShopeeInput = {
  custoProduto: 0,
  precoVenda: 0,
  despesaFixa: 0,
  despesaFixaTipo: 'fixo',
  despesaAdicional: 0,
  despesaAdicionalTipo: 'porcentagem',
  impostoPorcentagem: 0,
  impostoTipo: 'porcentagem',
  adsValor: 0,
  adsTipo: 'fixo',
  rebatePorcentagem: 0,
  rebateTipo: 'porcentagem',
  cupomDesconto: 0,
  cupomTipo: 'fixo'
};

const App: React.FC = () => {
  const [aba, setAba] = useState<'margem' | 'ideal'>('margem');
  const [inputs, setInputs] = useState<ShopeeInput>(defaultInputs);
  const [margemDesejada, setMargemDesejada] = useState<number>(0);
  const [results, setResults] = useState<ShopeeOutput | null>(null);
  const [simulacao, setSimulacao] = useState<ResultadoSimulacao | null>(null);

  const [statusClass, setStatusClass] = useState('');
  const [statusText, setStatusText] = useState('');
  const [statusIcon, setStatusIcon] = useState<React.ReactNode>(null);

  // Cálculo automático quando houver mudança nos inputs
  React.useEffect(() => {
    handleCalcular();
  }, [inputs, aba, margemDesejada]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;

    if (type === 'number') {
      val = value === '' ? 0 : parseFloat(value);
    }

    setInputs((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleCalcular = () => {
    let resultado: ShopeeOutput;
    let precoFinalStr = "";

    if (aba === 'margem') {
      if (inputs.precoVenda <= 0) {
        setResults(null);
        setSimulacao(null);
        setStatusClass('');
        setStatusText('');
        setStatusIcon(null);
        return;
      }
      resultado = calcularTaxasShopee(inputs);
      precoFinalStr = inputs.precoVenda.toString();
      setSimulacao(null);
    } else {
      if (inputs.custoProduto <= 0) {
        setResults(null);
        setSimulacao(null);
        setStatusClass('');
        setStatusText('');
        setStatusIcon(null);
        return;
      }
      // Nova Lógica: Simulação de Cenários
      const sim = simularCenariosPreco(inputs, margemDesejada);
      console.log("Simulação Gerada:", sim);
      setSimulacao(sim);
      resultado = sim.pontoIdeal;
      precoFinalStr = sim.pontoIdeal.precoVenda.toFixed(2);

      // NÃO atualizar inputs.precoVenda aqui para evitar loop infinito no useEffect
      // O resultado.precoVenda já contém o valor ideal para exibição no detalhamento
    }

    setResults(resultado);

    // Determina status basado na margem sobre venda
    const margem = resultado.margemSobreVenda;
    if (margem <= 0) {
      setStatusClass('status-red');
      setStatusText('Prejuízo!');
      setStatusIcon(<AlertCircle size={24} />);
    } else if (margem < 15) {
      setStatusClass('status-orange');
      setStatusText('Margem apertada');
      setStatusIcon(<AlertTriangle size={24} />);
    } else {
      setStatusClass('status-green');
      setStatusText('Excelente margem de lucro!');
      setStatusIcon(<CheckCircle2 size={24} />);
    }

    logCalculo(parseFloat(precoFinalStr), resultado.margemSobreVenda, "CNPJ");
  };

  // --- Sub-componentes de Gráfico ---
  const ComposiçãoPrecoChart = ({ dados }: { dados: CenarioPreco[] }) => {
    // Pegamos 5 pontos representativos para o gráfico de barras
    const pontosGrafico = dados.filter((_, idx) => idx % 3 === 0).map(c => ({
      name: `R$ ${c.precoVenda.toFixed(0)}`,
      Custo: inputs.custoProduto,
      Taxas: c.comissaoValor + c.tarifaFixa,
      Operacao: c.impostoValor + c.custoAds + c.despesaFixaValor + c.despesaAdicionalValor,
      Lucro: Math.max(0, c.lucroLiquido),
    }));

    return (
      <div className="chart-container">
        <h4 className="chart-title">Distribuição do Preço de Venda</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pontosGrafico} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: '#f9f9f9' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} />
            <Bar dataKey="Custo" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Taxas" stackId="a" fill="#EE4D2D" />
            <Bar dataKey="Operacao" stackId="a" fill="#FDBA74" />
            <Bar dataKey="Lucro" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const EstrategiaPrecoChart = ({ dados, pontoIdeal }: { dados: CenarioPreco[], pontoIdeal: CenarioPreco }) => {
    return (
      <div className="chart-container">
        <h4 className="chart-title">Análise de Lucratividade vs Preço</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dados} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="precoVenda"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(val) => `R$${val.toFixed(0)}`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: any) => [`R$ ${parseFloat(value).toFixed(2)}`, '']}
              labelFormatter={(label) => `Preço: R$ ${parseFloat(label).toFixed(2)}`}
            />
            <Area type="monotone" dataKey="lucroLiquido" name="Lucro Líquido" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
            <Line type="monotone" dataKey="pesoTaxas" name="% Taxas" stroke="#EE4D2D" strokeWidth={2} dot={false} yAxisId={1} />
            <YAxis yAxisId={1} hide domain={[0, 100]} />
            <ReferenceLine x={pontoIdeal.precoVenda} stroke="#6b7280" strokeDasharray="3 3" label={{ position: 'top', value: 'IDEAL', fontSize: 10, fill: '#6b7280' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="chart-footer">
          💡 O <strong>ponto ideal</strong> sugerido é o equilíbrio entre lucratividade e competitividade.
        </div>
      </div>
    );
  };

  const handleLimpar = () => {
    setInputs(defaultInputs);
    setMargemDesejada(0);
    setResults(null);
    setStatusClass('');
    setStatusText('');
    setStatusIcon(null);
  };

  const moeda = (val: number) =>
    val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <div className="tags-container">
          <span className="tag tag-yellow"><Sparkles size={14} /> Ferramenta Gratuita</span>
          <span className="tag tag-orange">Novo Cálculo 2026</span>
        </div>
        <div className="alert-box alert-orange" style={{ marginTop: '1.5rem' }}>
          <RefreshCcw className="alert-icon" size={20} />
          <p>
            <strong>Atualizado!</strong> Novas regras de comissão da Shopee vigentes a partir de <strong>01/03/2026</strong>.
            A comissão agora varia por faixa de preço (de 14% a 20%) com tarifas fixas de R$4 a R$26. Vendedores CPF com 450+ pedidos em 90 dias pagam R$3 adicionais por item.
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
              <CircleDollarSign size={18} /> Preço Ideal
            </button>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="number-badge">1</span> Parâmetros de Cálculo
            </div>

            <div className="parameters-grid">
              <div className="input-group">
                <label>Custo do Produto (R$)</label>
                <input
                  type="number"
                  name="custoProduto"
                  placeholder="Ex: 100.00"
                  value={inputs.custoProduto ?? ''}
                  onChange={handleChange}
                />
              </div>

              <div className="input-group">
                {aba === 'margem' ? (
                  <>
                    <label>Preço de Venda (R$)</label>
                    <input
                      type="number"
                      name="precoVenda"
                      placeholder="Ex: 150.00"
                      value={inputs.precoVenda ?? ''}
                      onChange={handleChange}
                    />
                  </>
                ) : (
                  <>
                    <label className="label-with-icon">
                      Lucro Desejado sobre Custo (%)
                      <span className="help-icon" title="Margem de lucro desejada sobre o custo do produto. Ex: 20% significa que você quer ter R$20 de lucro para cada R$100 de custo.">
                        <HelpCircle size={16} />
                      </span>
                    </label>
                    <input
                      type="number"
                      name="margemDesejada"
                      placeholder="Ex: 20"
                      value={margemDesejada ?? ''}
                      onChange={(e) => setMargemDesejada(parseFloat(e.target.value) || 0)}
                    />
                  </>
                )}
              </div>
              <div className="input-group">
                <label>Imposto</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="impostoPorcentagem"
                    className="input-main"
                    value={inputs.impostoPorcentagem ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 6"
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
                <label>Ads (Marketing)</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="adsValor"
                    className="input-main"
                    value={inputs.adsValor ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 5.00"
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
                <label>Crédito de Rebate</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="rebatePorcentagem"
                    className="input-main"
                    value={inputs.rebatePorcentagem ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 2"
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
                <label>Despesas Fixas Embalagem</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="despesaFixa"
                    className="input-main"
                    value={inputs.despesaFixa ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 1.50"
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
                <label>Outras Despesas</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="despesaAdicional"
                    className="input-main"
                    value={inputs.despesaAdicional ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 0.50"
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

              <div className="input-group">
                <label>Cupom de Desconto</label>
                <div className="input-composite">
                  <input
                    type="number"
                    name="cupomDesconto"
                    className="input-main"
                    value={inputs.cupomDesconto ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: 10.00"
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
              <h3>Aguardando Parâmetros</h3>
              <p>Preencha os dados à esquerda para ver os cálculos em tempo real.</p>
            </div>
          ) : (
            <div id="quick-results">
              <div className={`alert-box-result ${statusClass}`}>
                {statusIcon} <span>{statusText}</span>
              </div>

              <div className="premium-results-grid">
                <div className="result-card primary">
                  <div className="result-label">MÍNIMO PARA VENDA</div>
                  <div className="result-value">
                    R$ {calcularPrecoIdeal({ ...inputs, cupomDesconto: 0 }, 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="result-sub">Breakeven sem cupom</div>
                  <ShoppingCart size={24} className="card-icon" />
                </div>

                <div className="result-card secondary">
                  <div className="result-label">MÍNIMO C/ CUPOM</div>
                  <div className="result-value">
                    R$ {calcularPrecoIdeal(inputs, 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="result-sub">Breakeven considerando cupom</div>
                  <TrendingUp size={24} className="card-icon" />
                </div>

                <div className="result-card mini large">
                  <div className="result-header">
                    {results.margemSobreVenda > 0 ? (
                      <ArrowUpRight size={18} className="text-green" />
                    ) : (
                      <ArrowDownRight size={18} className="text-red" />
                    )} MARGEM S/ VENDA
                  </div>
                  <div className="result-body">
                    <span className={`percentage ${results.margemSobreVenda <= 0 ? 'text-red' :
                      results.margemSobreVenda < 15 ? 'text-orange' : 'text-green'
                      }`}>
                      {results.margemSobreVenda.toFixed(1).replace('.', ',')}%
                    </span>
                    <span className="nominal">R$ {results.lucroLiquido.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {simulacao && aba === 'ideal' && (
                <div className="simulation-dashboard">
                  <div className="dashboard-grid">
                    <ComposiçãoPrecoChart dados={simulacao.cenarios} />
                    <EstrategiaPrecoChart dados={simulacao.cenarios} pontoIdeal={simulacao.pontoIdeal} />
                  </div>
                </div>
              )}

              <div className="details">
                <h3>Detalhamento:</h3>
                <div className="detail-row">
                  <span>Preço de Venda {aba === 'ideal' ? '(Sugerido)' : ''}:</span>
                  <span className="val">R$ {moeda(aba === 'ideal' && results ? results.precoVenda : inputs.precoVenda)}</span>
                </div>
                <div className="detail-row">
                  <span>Custo de Aquisição:</span>
                  <span className="val text-red">- R$ {moeda(inputs.custoProduto)}</span>
                </div>
                <div className="detail-row">
                  <span>Comissão Shopee ({results.comissaoPorcentagem.toFixed(0)}%):</span>
                  <span className="val">R$ {moeda(results.comissaoValor)}</span>
                </div>
                <div className="detail-row">
                  <span>Tarifa Fixa Shopee:</span>
                  <span className="val">R$ {moeda(results.tarifaFixa)}</span>
                </div>
                {(results.impostoValor ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Imposto ({inputs.impostoPorcentagem}{inputs.impostoTipo === 'porcentagem' ? '%' : ''}):</span>
                    <span className="val">R$ {moeda(results.impostoValor)}</span>
                  </div>
                )}
                {(results.custoAds ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Ads Shopee:</span>
                    <span className="val">R$ {moeda(results.custoAds)}</span>
                  </div>
                )}
                {(inputs.despesaFixa ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Embalagem/Fixo:</span>
                    <span className="val">R$ {moeda(results.despesaFixaValor || 0)}</span>
                  </div>
                )}
                {(inputs.despesaAdicional ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Outras Despesas:</span>
                    <span className="val">R$ {moeda(results.despesaAdicionalValor || 0)}</span>
                  </div>
                )}

                {/* Ajustes Finais (Cupom e Rebate) */}
                {(inputs.cupomDesconto ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Cupom da Loja:</span>
                    <span className="val text-red">(- R$ {moeda(results.cupomValor)})</span>
                  </div>
                )}
                {(results.rebateValor ?? 0) > 0 && (
                  <div className="detail-row">
                    <span>Crédito de Rebate:</span>
                    <span className="val text-green">(+ R$ {moeda(results.rebateValor)})</span>
                  </div>
                )}

                <div className={`detail-row total ${statusClass}`}>
                  <span>Lucro Líquido Final:</span>
                  <span className="val">R$ {moeda(results.lucroLiquido)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="table-section">
        <h2 className="table-title">📊 Escopo de Taxas Shopee 2026</h2>
        <div className="table-responsive">
          <table className="shopee-table">
            <thead>
              <tr>
                <th>Faixa de Preço</th>
                <th>Comissão %</th>
                <th>Tarifa Fixa</th>
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
    </div >
  );
};

export default App;
