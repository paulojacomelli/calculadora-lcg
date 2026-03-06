/**
 * Lógica de Cálculo Shopee 2026
 * Contém as regras de comissão, tarifas fixas e cálculos de lucratividade.
 */

export type UnidadeValor = 'fixo' | 'porcentagem';

export interface ShopeeInput {
  custoProduto: number;
  precoVenda: number;

  despesaFixa?: number;
  despesaFixaTipo: UnidadeValor;

  despesaAdicional?: number;
  despesaAdicionalTipo: UnidadeValor;

  impostoPorcentagem?: number;
  impostoTipo: UnidadeValor;

  adsValor?: number;
  adsTipo: 'fixo' | 'roas' | 'porcentagem';

  rebatePorcentagem?: number;
  rebateTipo: UnidadeValor;

  cupomDesconto?: number;
  cupomTipo: UnidadeValor;
}

export interface ShopeeOutput {
  comissaoPorcentagem: number;
  comissaoValor: number;
  tarifaFixa: number;
  impostoValor: number;
  custoAds: number;
  custoTotal: number;
  rebateValor: number;
  lucroLiquido: number;
  margemSobreVenda: number;
  margemSobreCusto: number;
  despesaFixaValor: number;
  despesaAdicionalValor: number;
  margem: number;             // Subtotal conforme fórmula do usuário
  cupomValor: number;
  precoComCupom: number;
  precoVenda: number;
}

/**
 * Calcula as taxas da Shopee baseadas na faixa de preço de 2026
 */
export const calcularTaxasShopee = (input: ShopeeInput): ShopeeOutput => {
  const {
    custoProduto,
    precoVenda,

    despesaFixa = 0,
    despesaFixaTipo,

    despesaAdicional = 0,
    despesaAdicionalTipo,

    impostoPorcentagem = 0,
    impostoTipo,

    adsValor = 0,
    adsTipo,

    rebatePorcentagem = 0,
    rebateTipo,

    cupomDesconto = 0,
    cupomTipo
  } = input;

  let comissaoPorcentagem = 0.14;
  let tarifaFixa = 0;

  // Regras de Faixas 2026
  if (precoVenda <= 79.99) {
    comissaoPorcentagem = 0.20;
    tarifaFixa = 4.00;
  } else if (precoVenda <= 99.99) {
    tarifaFixa = 16.00;
  } else if (precoVenda <= 199.99) {
    tarifaFixa = 20.00;
  } else if (precoVenda <= 499.99) {
    tarifaFixa = 26.00;
  } else {
    tarifaFixa = 26.00;
  }

  const comissaoValor = precoVenda * comissaoPorcentagem;

  // Helpers para cálculo flexível
  // Importante: Todo cálculo de porcentagem é sobre o valor de venda (conforme solicitado pelo usuário)
  const calcFlex = (val: number | undefined, tipo: UnidadeValor) => {
    const num = val || 0;
    return tipo === 'porcentagem' ? precoVenda * (num / 100) : num;
  };

  const impostoValor = calcFlex(impostoPorcentagem, impostoTipo);
  const despesaAdicionalValor = calcFlex(despesaAdicional, despesaAdicionalTipo);
  const despesaFixaValor = calcFlex(despesaFixa, despesaFixaTipo);
  const rebateValor = calcFlex(rebatePorcentagem, rebateTipo);
  const cupomValor = calcFlex(cupomDesconto, cupomTipo);

  // Cálculo de Ads (especial pois tem ROAS)
  let custoAds = 0;
  if (adsValor > 0) {
    if (adsTipo === 'fixo') {
      custoAds = adsValor;
    } else if (adsTipo === 'roas') {
      custoAds = precoVenda / adsValor;
    } else if (adsTipo === 'porcentagem') {
      custoAds = precoVenda * (adsValor / 100);
    }
  }

  // Fórmula solicitada pelo usuário:
  // 1. Margem = Preço de Venda - Custo do Produto - Impostos - Ads - Despesas Fixas - Outras Despesas - Comissão Shopee - Tarifa Fixa Shopee
  const margem =
    precoVenda -
    custoProduto -
    impostoValor -
    custoAds -
    despesaFixaValor -
    despesaAdicionalValor -
    comissaoValor -
    tarifaFixa;

  // 2. Lucro = Margem - Cupom de Desconto + Crédito de Rebate
  const lucroLiquido = margem - cupomValor + rebateValor;

  const margemSobreVenda = precoVenda > 0 ? (lucroLiquido / precoVenda) * 100 : 0;
  const margemSobreCusto = custoProduto > 0 ? (lucroLiquido / custoProduto) * 100 : 0;

  return {
    comissaoPorcentagem: comissaoPorcentagem * 100,
    comissaoValor,
    tarifaFixa,
    impostoValor,
    custoAds,
    custoTotal: precoVenda - lucroLiquido, // Custo total implícito
    rebateValor,
    lucroLiquido,
    margemSobreVenda,
    margemSobreCusto,
    despesaFixaValor,
    despesaAdicionalValor,
    margem,
    cupomValor,
    precoComCupom: Math.max(0, precoVenda - cupomValor),
    precoVenda
  };
};

/**
 * Calcula o preço de venda ideal para atingir uma margem específica
 * Nota: Como as taxas da Shopee variam por faixa, este é um cálculo iterativo ou aproximado.
 */
export interface CenarioPreco extends ShopeeOutput {
  pesoTaxas: number; // Porcentagem das taxas sobre o preço de venda
  eficiencia: number; // Score de 0 a 100
}

export interface ResultadoSimulacao {
  cenarios: CenarioPreco[];
  pontoIdeal: CenarioPreco;
}

/**
 * Calcula o preço de venda ideal para atingir uma margem específica
 * Usamos busca binária para encontrar o preço exato.
 */
export const calcularPrecoIdeal = (input: ShopeeInput, margemDesejada: number): number => {
  let min = input.custoProduto;
  let max = input.custoProduto * 20; // Aumentado para cobrir casos extremos
  let chute = (min + max) / 2;

  for (let i = 0; i < 50; i++) {
    const resultado = calcularTaxasShopee({ ...input, precoVenda: chute });
    const margemAtual = resultado.margemSobreCusto;

    if (Math.abs(margemAtual - margemDesejada) < 0.001) break;

    if (margemAtual < margemDesejada) {
      min = chute;
    } else {
      max = chute;
    }
    chute = (min + max) / 2;
  }

  return chute;
};

/**
 * Gera múltiplos cenários de preço e identifica o ponto estratégico ideal.
 */
export const simularCenariosPreco = (input: ShopeeInput, margemAlvo: number): ResultadoSimulacao => {
  const breakeven = calcularPrecoIdeal(input, 0);

  // Definir faixa de simulação: -10% do breakeven até +100% do custo ou margem alvo agressiva
  const precoMin = breakeven * 0.9;
  const precoMax = calcularPrecoIdeal(input, Math.max(margemAlvo * 2, 50));

  const cenarios: CenarioPreco[] = [];
  const passos = 15; // Número de pontos no gráfico
  const step = (precoMax - precoMin) / passos;

  for (let i = 0; i <= passos; i++) {
    const pv = precoMin + (step * i);
    const res = calcularTaxasShopee({ ...input, precoVenda: pv });

    // Taxas Totais = Comissão + Tarifa Fixa + Ads + Imposto
    const totalTaxas = res.comissaoValor + res.tarifaFixa + res.impostoValor + res.custoAds;
    const pesoTaxas = pv > 0 ? (totalTaxas / pv) * 100 : 0;

    // Algoritmo de Eficiência: 
    // Recompensa lucro positivo e pune peso excessivo de taxas
    // Score baseado em (Margem sobre Custo / Peso das Taxas)
    const eficiencia = res.lucroLiquido > 0
      ? Math.min(100, (res.margemSobreCusto / (pesoTaxas || 1)) * 10)
      : 0;

    cenarios.push({
      ...res,
      precoVenda: pv,
      pesoTaxas,
      eficiencia
    });
  }

  // Identificar PONTO IDEAL: 
  // O cenário mais próximo da margemAlvo solicitada, desde que seja lucrativo
  let pontoIdeal = cenarios[0];
  let menorDif = Infinity;

  cenarios.forEach(c => {
    const dif = Math.abs(c.margemSobreCusto - margemAlvo);
    if (dif < menorDif && c.lucroLiquido > 0) {
      menorDif = dif;
      pontoIdeal = c;
    }
  });

  // Se nenhum ponto for lucrativo, o ideal "técnico" é o último (maior preço) ou o próprio breakeven
  if (pontoIdeal.lucroLiquido <= 0) {
    pontoIdeal = cenarios[cenarios.length - 1];
  }

  return { cenarios, pontoIdeal };
};
