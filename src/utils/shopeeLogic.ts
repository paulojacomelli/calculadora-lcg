/**
 * Lógica de Cálculo Shopee 2026
 * Contém as regras de comissão, tarifas fixas e cálculos de lucratividade.
 */

import Decimal from 'decimal.js';

export type UnidadeValor = 'fixo' | 'porcentagem';

export interface ShopeeInput {
  custoProduto?: number;
  precoVenda?: number;

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
  nominalSobreCusto?: number; // Spread puro para o MSC Card
  despesaFixaValor: number;
  despesaAdicionalValor: number;
  margem: number;             // Subtotal conforme fórmula do usuário
  cupomValor: number;
  precoComCupom: number;
  precoVenda: number;
  custoProdutoValor: number;
}

export type TaxaType = 'percent' | 'fixed';

export interface TaxaInput {
  value: number;
  type: TaxaType;
}

export const VAL = (item: TaxaInput, base: number): number => {
  const dBase = new Decimal(base);
  const dValue = new Decimal(item.value);

  if (item.type === 'percent') {
    return dBase.times(dValue).dividedBy(100).toNumber();
  }
  return dValue.toNumber();
};

/**
 * Arredondamento Round Half Up (Padrão ABNT/Financeiro solicitado)
 * Se a 3ª casa >= 5, arredonda a 2ª para cima.
 */
export const arredondar = (num: number, casas: number = 2): number => {
  return new Decimal(num).toDecimalPlaces(casas, Decimal.ROUND_HALF_UP).toNumber();
};

/**
 * Calcula as taxas da Shopee baseadas na faixa de preço de 2026
 */
export const calcularTaxasShopee = (input: ShopeeInput): ShopeeOutput => {
  // 1. Definição das Variáveis de Entrada
  // O precoVenda informado na UI representa diretamente o Preço Efetivo Base (PDV)
  const PDV = input.precoVenda || 0;

  // Helpers para mapear os inputs antigos para a nova interface TaxaInput
  const mapUnidade = (tipo: UnidadeValor): TaxaType => tipo === 'porcentagem' ? 'percent' : 'fixed';

  // 2. Estrutura de cada variável
  const CD: TaxaInput = { value: input.cupomDesconto || 0, type: mapUnidade(input.cupomTipo || 'fixo') };
  const CR: TaxaInput = { value: input.rebatePorcentagem || 0, type: mapUnidade(input.rebateTipo || 'fixo') };

  const CDP: TaxaInput = { value: input.custoProduto || 0, type: 'fixed' };
  const IMP: TaxaInput = { value: input.impostoPorcentagem || 0, type: mapUnidade(input.impostoTipo || 'porcentagem') };
  const DF: TaxaInput = { value: input.despesaFixa || 0, type: mapUnidade(input.despesaFixaTipo || 'fixo') };
  const OD: TaxaInput = { value: input.despesaAdicional || 0, type: mapUnidade(input.despesaAdicionalTipo || 'fixo') };

  // Tratamento especial para ADS (pode ser ROAS)
  let adsMappedType: TaxaType = 'fixed';
  let adsMappedValue = input.adsValor || 0;
  if (input.adsTipo === 'porcentagem') {
    adsMappedType = 'percent';
  } else if (input.adsTipo === 'roas' && input.adsValor && input.adsValor > 0) {
    adsMappedType = 'percent';
    adsMappedValue = (1 / input.adsValor) * 100;
  }
  const ADS: TaxaInput = { value: adsMappedValue, type: adsMappedType };

  // 3. Cálculo do Preço Anunciado (PCC) por inversão
  const dPDV = new Decimal(PDV || 0);
  const dCDValue = new Decimal(CD.value);
  let dPCC = dPDV;
  let dCupomValor = new Decimal(0);

  if (CD.value > 0) {
    if (CD.type === 'percent') {
      const fator = new Decimal(1).minus(dCDValue.dividedBy(100));
      dPCC = fator.greaterThan(0) ? dPDV.dividedBy(fator) : dPDV;
      // Arredonda o PCC para CIMA (ROUND_UP) para proteger a margem e bater com a expectativa do lojista
      const pccArred = new Decimal(dPCC.toNumber()).toDecimalPlaces(2, Decimal.ROUND_UP).toNumber();
      dPCC = new Decimal(pccArred);
      // O cupom é a diferença exata para bater com o PDV
      dCupomValor = dPCC.minus(dPDV);
    } else {
      dCupomValor = dCDValue;
      dPCC = dPDV.plus(dCDValue);
    }
  }

  const PCC = arredondar(dPCC.toNumber(), 2);
  const cupomValorCalculado = arredondar(dCupomValor.toNumber(), 2);

  // Regras de Faixas 2026 da Shopee baseadas no valor de venda do anúncio (PCC)
  let csPorcentagem = 14;
  let tfsValor = 0;
  if (PCC <= 79.99) {
    csPorcentagem = 20;
    tfsValor = 4.00;
  } else if (PCC <= 99.99) {
    tfsValor = 16.00;
  } else if (PCC <= 199.99) {
    tfsValor = 20.00;
  } else if (PCC <= 499.99) {
    tfsValor = 26.00;
  } else {
    tfsValor = 26.00;
  }

  const CS: TaxaInput = { value: csPorcentagem, type: 'percent' };
  const TFS: TaxaInput = { value: tfsValor, type: 'fixed' };

  // 4. Conversão de todos os custos com ARREDONDAMENTO EM CADA PARCELA
  // Isso garante que a soma visual das linhas bata com o lucro líquido final.
  const comissaoValor = arredondar(VAL(CS, PDV), 2);
  const tarifaFixaValor = arredondar(VAL(TFS, PDV), 2);
  const custoProdutoValor = arredondar(VAL(CDP, PDV), 2);
  const impostoValor = arredondar(VAL(IMP, PDV), 2);
  const despesaFixaValor = arredondar(VAL(DF, PDV), 2);
  const despesaAdicionalValor = arredondar(VAL(OD, PDV), 2);
  const custoAds = arredondar(VAL(ADS, PDV), 2);

  // Somatória precisa das parcelas já arredondadas
  const dCustos = new Decimal(comissaoValor)
    .plus(tarifaFixaValor)
    .plus(custoProdutoValor)
    .plus(impostoValor)
    .plus(despesaFixaValor)
    .plus(despesaAdicionalValor)
    .plus(custoAds);

  const custos = dCustos.toNumber();
  const rebateValor = arredondar(VAL(CR, PDV), 2);

  // 5. Cálculo do lucro líquido da venda (Diferença direta das parcelas)
  const LLV = dPDV.minus(dCustos).plus(rebateValor).toNumber();

  const msv = PDV > 0 ? new Decimal(LLV).dividedBy(PDV).times(100).toNumber() : 0;
  const nominalSobreCusto = dPDV.minus(custoProdutoValor).toNumber();
  const msc = custoProdutoValor > 0 ? (nominalSobreCusto / custoProdutoValor) * 100 : 0;

  // Margem Bruta (Subtotal)
  const margem = dPDV
    .minus(custoProdutoValor)
    .minus(impostoValor)
    .minus(custoAds)
    .minus(despesaFixaValor)
    .minus(despesaAdicionalValor)
    .minus(comissaoValor)
    .minus(tarifaFixaValor)
    .toNumber();

  // 6. Resultados (Tudo arredondado)
  return {
    comissaoPorcentagem: csPorcentagem,
    comissaoValor: comissaoValor,
    tarifaFixa: tarifaFixaValor,
    impostoValor,
    custoAds,
    custoTotal: arredondar(custos, 2),
    rebateValor,
    lucroLiquido: arredondar(LLV, 2),
    margemSobreVenda: arredondar(msv, 2),
    margemSobreCusto: arredondar(msc, 2),
    despesaFixaValor,
    despesaAdicionalValor,
    margem: arredondar(margem, 2),
    cupomValor: cupomValorCalculado,
    precoComCupom: PCC,
    precoVenda: arredondar(PDV, 2),
    nominalSobreCusto: arredondar(nominalSobreCusto, 2),
    custoProdutoValor: custoProdutoValor
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
export const calcularPrecoIdeal = (
  input: ShopeeInput,
  margemDesejada: number | undefined,
  tipoBase: 'custo' | 'venda' = 'venda'
): number => {
  const margem = margemDesejada ?? 0;
  let min = input.custoProduto ?? 0;
  let max = (input.custoProduto ?? 10) * 20;
  let chute = (min + max) / 2;

  for (let i = 0; i < 50; i++) {
    const resultado = calcularTaxasShopee({ ...input, precoVenda: chute });
    const margemAtual = tipoBase === 'custo' ? resultado.margemSobreCusto : resultado.margemSobreVenda;

    if (Math.abs(margemAtual - margem) < 0.001) break;

    if (margemAtual < margem) {
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
export const simularCenariosPreco = (
  input: ShopeeInput,
  margemAlvo: number | undefined,
  tipoBase: 'custo' | 'venda' = 'venda'
): ResultadoSimulacao => {
  const margem = margemAlvo ?? 0;
  const breakeven = calcularPrecoIdeal(input, 0, tipoBase);

  // Definir faixa de simulação
  const precoMin = breakeven * 0.9;
  const precoMax = calcularPrecoIdeal(input, Math.max(margem * 2, 50), tipoBase);

  const cenarios: CenarioPreco[] = [];
  const passos = 15;
  const step = (precoMax - precoMin) / passos;

  for (let i = 0; i <= passos; i++) {
    const pccLoop = precoMin + (step * i);
    const res = calcularTaxasShopee({ ...input, precoVenda: pccLoop });

    const totalTaxas = res.comissaoValor + res.tarifaFixa + res.impostoValor + res.custoAds;
    const pesoTaxas = res.precoVenda > 0 ? (totalTaxas / res.precoVenda) * 100 : 0;

    // Algoritmo de Eficiência
    const metricValue = tipoBase === 'custo' ? res.margemSobreCusto : res.margemSobreVenda;
    const eficiencia = res.lucroLiquido > 0
      ? Math.min(100, (metricValue / (pesoTaxas || 1)) * 10)
      : 0;

    cenarios.push({
      ...res,
      precoVenda: res.precoVenda, // PDV
      precoComCupom: pccLoop, // PCC
      pesoTaxas,
      eficiencia
    });
  }

  // Identificar PONTO IDEAL
  let pontoIdeal = cenarios[0];
  let menorDif = Infinity;

  cenarios.forEach(c => {
    const currentMetric = tipoBase === 'custo' ? c.margemSobreCusto : c.margemSobreVenda;
    const dif = Math.abs(currentMetric - margem);
    if (dif < menorDif && c.lucroLiquido > 0) {
      menorDif = dif;
      pontoIdeal = c;
    }
  });

  if (pontoIdeal.lucroLiquido <= 0) {
    pontoIdeal = cenarios[cenarios.length - 1];
  }

  return { cenarios, pontoIdeal };
};
