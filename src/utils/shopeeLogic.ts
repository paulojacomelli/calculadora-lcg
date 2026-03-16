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

  // Parâmetros de Simulação Sweet Spot
  fatorElasticidade?: number;
  fatorAlavancagem?: number;
  fatorAlavancagemAtivo?: boolean;
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
  margemLiquidaSobreCusto: number; // LLC: Lucro Líquido Final / Custo Produto
  nominalSobreCusto?: number; // Spread puro para o MC Card
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
export const calcularTaxasShopee = (input: ShopeeInput, roundResult: boolean = true): ShopeeOutput => {
  // 1. Definição das Variáveis de Entrada
  const PA = input.precoVenda || 0;

  const mapUnidade = (tipo: UnidadeValor): TaxaType => tipo === 'porcentagem' ? 'percent' : 'fixed';

  const CD: TaxaInput = { value: input.cupomDesconto || 0, type: mapUnidade(input.cupomTipo || 'fixo') };
  const CR: TaxaInput = { value: input.rebatePorcentagem || 0, type: mapUnidade(input.rebateTipo || 'fixo') };

  const CDP: TaxaInput = { value: input.custoProduto || 0, type: 'fixed' };
  const IMP: TaxaInput = { value: input.impostoPorcentagem || 0, type: mapUnidade(input.impostoTipo || 'porcentagem') };
  const DF: TaxaInput = { value: input.despesaFixa || 0, type: mapUnidade(input.despesaFixaTipo || 'fixo') };
  const OD: TaxaInput = { value: input.despesaAdicional || 0, type: mapUnidade(input.despesaAdicionalTipo || 'fixo') };

  let adsMappedType: TaxaType = 'fixed';
  let adsMappedValue = input.adsValor || 0;
  if (input.adsTipo === 'porcentagem') {
    adsMappedType = 'percent';
  } else if (input.adsTipo === 'roas' && input.adsValor && input.adsValor > 0) {
    adsMappedType = 'percent';
    adsMappedValue = (1 / input.adsValor) * 100;
  }
  const ADS: TaxaInput = { value: adsMappedValue, type: adsMappedType };

  const dPA = new Decimal(PA || 0);
  const dCDValue = new Decimal(CD.value);
  let dPDV = dPA;
  let dCupomValor = new Decimal(0);

  if (CD.value > 0) {
    if (CD.type === 'percent') {
      dCupomValor = dPA.times(dCDValue).dividedBy(100);
      dPDV = dPA.minus(dCupomValor);
    } else {
      dCupomValor = dCDValue;
      dPDV = dPA.minus(dCDValue);
    }
  }

  // Preço que a Shopee usa para as faixas (PCC/PA)
  const PCC = roundResult ? arredondar(dPA.toNumber(), 2) : dPA.toNumber();
  const PDV = roundResult ? arredondar(dPDV.toNumber(), 2) : dPDV.toNumber();
  const cupomValorCalculado = roundResult ? arredondar(dCupomValor.toNumber(), 2) : dCupomValor.toNumber();

  let csPorcentagem = 14;
  let tfsValor = 0;
  // As taxas são determinadas pelo Preço de Venda (PDV)
  if (PDV <= 79.99) {
    csPorcentagem = 20;
    tfsValor = 4.00;
  } else if (PDV <= 99.99) {
    tfsValor = 16.00;
  } else if (PDV <= 199.99) {
    tfsValor = 20.00;
  } else if (PDV <= 499.99) {
    tfsValor = 26.00;
  } else {
    tfsValor = 26.00;
  }

  const CS: TaxaInput = { value: csPorcentagem, type: 'percent' };
  const TFS: TaxaInput = { value: tfsValor, type: 'fixed' };

  // As taxas da Shopee incidem sobre o Preço de Venda (PDV)
  const comissaoValor = roundResult ? arredondar(VAL(CS, PDV), 2) : VAL(CS, PDV);
  const tarifaFixaValor = roundResult ? arredondar(VAL(TFS, PDV), 2) : VAL(TFS, PDV);
  const custoProdutoValor = roundResult ? arredondar(VAL(CDP, PDV), 2) : VAL(CDP, PDV);
  const impostoValor = roundResult ? arredondar(VAL(IMP, PDV), 2) : VAL(IMP, PDV);
  const despesaFixaValor = roundResult ? arredondar(VAL(DF, PDV), 2) : VAL(DF, PDV);
  const despesaAdicionalValor = roundResult ? arredondar(VAL(OD, PDV), 2) : VAL(OD, PDV);
  const custoAds = roundResult ? arredondar(VAL(ADS, PDV), 2) : VAL(ADS, PDV);

  const dCustos = new Decimal(comissaoValor)
    .plus(tarifaFixaValor)
    .plus(custoProdutoValor)
    .plus(impostoValor)
    .plus(despesaFixaValor)
    .plus(despesaAdicionalValor)
    .plus(custoAds);

  const custos = dCustos.toNumber();
  const rebateValor = roundResult ? arredondar(VAL(CR, PCC), 2) : VAL(CR, PCC);

  const LLV = dPDV.minus(dCustos).plus(rebateValor).toNumber();

  const msv = PDV > 0 ? new Decimal(LLV).dividedBy(PDV).times(100).toNumber() : 0;
  const nominalSobreCusto = dPDV.minus(custoProdutoValor).toNumber();
  const msc = custoProdutoValor > 0 ? (nominalSobreCusto / custoProdutoValor) * 100 : 0;
  const llc = custoProdutoValor > 0 ? (LLV / custoProdutoValor) * 100 : 0;

  const margem = dPDV
    .minus(custoProdutoValor)
    .minus(impostoValor)
    .minus(custoAds)
    .minus(despesaFixaValor)
    .minus(despesaAdicionalValor)
    .minus(comissaoValor)
    .minus(tarifaFixaValor)
    .toNumber();

  return {
    comissaoPorcentagem: csPorcentagem,
    comissaoValor: roundResult ? arredondar(comissaoValor, 2) : comissaoValor,
    tarifaFixa: roundResult ? arredondar(tarifaFixaValor, 2) : tarifaFixaValor,
    impostoValor: roundResult ? arredondar(impostoValor, 2) : impostoValor,
    custoAds: roundResult ? arredondar(custoAds, 2) : custoAds,
    custoTotal: roundResult ? arredondar(custos, 2) : custos,
    rebateValor: roundResult ? arredondar(rebateValor, 2) : rebateValor,
    lucroLiquido: roundResult ? arredondar(LLV, 2) : LLV,
    margemSobreVenda: roundResult ? arredondar(msv, 2) : msv,
    margemSobreCusto: roundResult ? arredondar(msc, 2) : msc,
    margemLiquidaSobreCusto: roundResult ? arredondar(llc, 2) : llc,
    despesaFixaValor: roundResult ? arredondar(despesaFixaValor, 2) : despesaFixaValor,
    despesaAdicionalValor: roundResult ? arredondar(despesaAdicionalValor, 2) : despesaAdicionalValor,
    margem: roundResult ? arredondar(margem, 2) : margem,
    cupomValor: roundResult ? arredondar(cupomValorCalculado, 2) : cupomValorCalculado,
    precoComCupom: roundResult ? arredondar(PCC, 2) : PCC,
    precoVenda: roundResult ? arredondar(PDV, 2) : PDV,
    nominalSobreCusto: roundResult ? arredondar(nominalSobreCusto, 2) : nominalSobreCusto,
    custoProdutoValor: roundResult ? arredondar(custoProdutoValor, 2) : custoProdutoValor
  };
};

export interface CenarioPreco extends ShopeeOutput {
  pesoTaxas: number; // Porcentagem das taxas sobre o preço de venda
  eficiencia: number; // Score de 0 a 100
}

export interface ResultadoSimulacao {
  cenarios: CenarioPreco[];
  pontoIdeal: CenarioPreco;
}

export interface OtimizacaoPrecoResult {
  precoOriginal: number;
  precoOtimizado: number;
  lucroOriginal: number;
  lucroOtimizado: number;
  isOtimizado: boolean;
  margemCustoOriginal: number;
  margemVendaOriginal: number;
  margemCustoOtimizado: number;
  margemVendaOtimizado: number;
  // Novos campos para Alavancagem
  isAlavancagem: boolean;
  fatorAlavancagem: number;
  quedaPreco: number;
  quedaLucro: number;
  esforcoPercentual: number;
}

/**
 * Calcula o preço de venda ideal para atingir uma margem específica detalhadamente,
 * incluindo logs de varredura se um preço menor foi encontrado de forma otimizada.
 * Usamos busca binária para encontrar o preço exato.
 */
export const calcularPrecoIdealDetalhado = (
  input: ShopeeInput,
  margemDesejada: number | undefined,
  tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
): OtimizacaoPrecoResult => {
  const margem = margemDesejada ?? 0;
  let min = input.custoProduto ?? 0;
  let max = (input.custoProduto ?? 10) * 50;
  let chute = (min + max) / 2;

  for (let i = 0; i < 50; i++) {
    // IMPORTANTE: Aqui usamos roundResult = false para alta precisão na busca
    const resultado = calcularTaxasShopee({ ...input, precoVenda: chute }, false);

    let margemAtual = 0;
    if (tipoBase === 'reais') margemAtual = resultado.lucroLiquido;
    else if (tipoBase === 'custo') margemAtual = resultado.margemLiquidaSobreCusto;
    else margemAtual = resultado.margemSobreVenda;

    if (Math.abs(margemAtual - margem) < 0.0001) break;

    if (margemAtual < margem) {
      min = chute;
    } else {
      max = chute;
    }
    chute = (min + max) / 2;
  }

  const paMatematico = arredondar(chute, 2);
  const resultadoReferencia = calcularTaxasShopee({ ...input, precoVenda: paMatematico }, false);

  let melhorPa = paMatematico;
  let melhorLucro = resultadoReferencia.lucroLiquido;

  let isAlavancagem = false;
  let fatorAlavancagem = 0;
  let quedaPreco = 0;
  let quedaLucro = 0;
  let esforcoPercentual = 0;

  // Otimização "Sweet Spot" e Alavancagem de Giro
  // Só executamos as varreduras se o sensor estiver ativo (padrão é true)
  if (input.fatorAlavancagemAtivo !== false) {
    // Camada 1: Otimização "Sweet Spot" - varredura descendente para aproveitar as janelas de taxa reduzida (ex: 79.99)
    // Varremos descendo R$ 50.00 (5000 centavos)
    for (let i = 1; i <= 5000; i++) {
    const paTeste = arredondar(paMatematico - (i / 100), 2);
    if (paTeste <= (input.custoProduto || 0.01)) break; // Nunca cai abaixo do custo bruto

    const resTeste = calcularTaxasShopee({ ...input, precoVenda: paTeste }, false);

    // Se no cenário mais barato o lucro salta (ou mesmo empata com o lucro ótimo anterior), adotamos o preço menor
    if (resTeste.lucroLiquido >= melhorLucro - 0.001) {
      melhorPa = paTeste;
      melhorLucro = resTeste.lucroLiquido;
    }
  }

  const MAX_LUCRO_PERDIDO_PCT = 0.15;
  const MIN_ALAVANCAGEM = input.fatorAlavancagem ?? 5.0;

  if (melhorPa === paMatematico) {
    for (let i = 1; i <= 5000; i++) {
        const paTeste = arredondar(paMatematico - (i / 100), 2);
        if (paTeste <= (input.custoProduto || 0.01)) break;

        const resTeste = calcularTaxasShopee({ ...input, precoVenda: paTeste }, false);
        
        const qPreco = paMatematico - paTeste;
        const qLucro = resultadoReferencia.lucroLiquido - resTeste.lucroLiquido;

        if (qLucro > 0) {
            const fator = qPreco / qLucro;
            const pctPerdaLucro = qLucro / (resultadoReferencia.lucroLiquido || 1);

            if (pctPerdaLucro <= MAX_LUCRO_PERDIDO_PCT && fator >= MIN_ALAVANCAGEM) {
                // Selecionamos o de maior fator de alavancagem
                if (fator > fatorAlavancagem) {
                    fatorAlavancagem = fator;
                    melhorPa = paTeste;
                    isAlavancagem = true;
                    quedaPreco = qPreco;
                    quedaLucro = qLucro;
                    const volNecessario = 100 * (resultadoReferencia.lucroLiquido / resTeste.lucroLiquido);
                    esforcoPercentual = volNecessario - 100;
                }
            }
        }
    }
    }
  }

  const resultadoOtimizado = calcularTaxasShopee({ ...input, precoVenda: melhorPa }, false);

  return {
    precoOriginal: paMatematico,
    precoOtimizado: melhorPa,
    lucroOriginal: resultadoReferencia.lucroLiquido,
    lucroOtimizado: resultadoOtimizado.lucroLiquido,
    isOtimizado: melhorPa < paMatematico,
    margemCustoOriginal: resultadoReferencia.margemLiquidaSobreCusto,
    margemVendaOriginal: resultadoReferencia.margemSobreVenda,
    margemCustoOtimizado: resultadoOtimizado.margemLiquidaSobreCusto,
    margemVendaOtimizado: resultadoOtimizado.margemSobreVenda,
    isAlavancagem,
    fatorAlavancagem,
    quedaPreco,
    quedaLucro,
    esforcoPercentual
  };
};

/**
 * Wrapper de retro-compatibilidade: entrega apenas o número otimizado
 */
export const calcularPrecoIdeal = (
  input: ShopeeInput,
  margemDesejada: number | undefined,
  tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
): number => {
  return calcularPrecoIdealDetalhado(input, margemDesejada, tipoBase).precoOtimizado;
};

/**
 * Gera múltiplos cenários de preço e identifica o ponto estratégico ideal.
 */
export const simularCenariosPreco = (
  input: ShopeeInput,
  margemAlvo: number | undefined,
  tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
): ResultadoSimulacao => {
  const margem = margemAlvo ?? 0;
  const breakeven = calcularPrecoIdeal(input, 0, tipoBase);

  // Definir faixa de simulação centrada no preço atual para capturar degraus próximos
  const PA = input.precoVenda || 0;
  const precoBase = PA || breakeven;
  
  // Criamos uma lista de preços para testar
  const precosX: number[] = [];

  // 1. Testamos o preço atual e os 500 centavos abaixo dele (5 reais de margem centavo por centavo)
  // Isso garante capturar mudanças por apenas 1 centavo de diferença.
  if (PA > 0) {
    for (let i = 0; i <= 500; i++) {
        const p = PA - (i / 100);
        if (p > 0) precosX.push(arredondar(p, 2));
    }
  }

  // 2. Mantemos a faixa de breakeven e preços baixos para o gráfico
  const precoMin = Math.max(breakeven * 0.8, 5);
  const precoMax = Math.max(precoBase * 1.5, 600);
  const passos = 50; 
  const step = (precoMax - precoMin) / passos;
  for (let i = 0; i <= passos; i++) {
    precosX.push(arredondar(precoMin + (step * i), 2));
  }

  // Injetar pontos críticos de mudança de política para garantir degraus nítidos no gráfico
  // IMPORTANTE: Os pontos críticos (degraus) são baseados no PDV (Preço Final), 
  // então precisamos converter para o PA (Preço Anunciado) correspondente para injetar na simulação.
  const degrausPDV = [79.99, 80.00, 99.99, 100.00, 199.99, 200.00, 499.99, 500.00];
  
  degrausPDV.forEach(pPDV => {
    let paNecessario = pPDV;
    if (input.cupomDesconto && input.cupomDesconto > 0) {
      if (input.cupomTipo === 'porcentagem') {
        // PA = PDV / (1 - %)
        paNecessario = pPDV / (1 - (input.cupomDesconto / 100));
      } else {
        // PA = PDV + Fixo
        paNecessario = pPDV + input.cupomDesconto;
      }
    }
    
    // Injetamos o Preço Anunciado (PA) que levaria a esse degrau no PDV
    const pPA = arredondar(paNecessario, 2);
    if (pPA >= precoMin && pPA <= precoMax) precosX.push(pPA);
  });

  // Remover duplicados e ordenar
  const precosUnicos = [...new Set(precosX)].sort((a, b) => a - b);

  const cenarios: CenarioPreco[] = [];
  for (const paLoop of precosUnicos) {
    // A função calcularTaxasShopee recebe o PA (Preço Anunciado) e internamente calcula o PDV
    const res = calcularTaxasShopee({ ...input, precoVenda: paLoop });

    const totalTaxas = res.comissaoValor + res.tarifaFixa + res.impostoValor + res.custoAds;
    const pesoTaxas = res.precoVenda > 0 ? (totalTaxas / res.precoVenda) * 100 : 0;
    
    // Na ShopeePage, o 'precoVenda' do objeto de simulação é usado como o gráficoX, 
    // mas o usuário quer o PA. Vamos garantir que as propriedades estejam claras.
    cenarios.push({
      ...res,
      precoVenda: res.precoVenda, // Isso é o PDV (valor final)
      precoComCupom: paLoop,      // Isso é o PA (valor de vitrine)
      pesoTaxas,
      eficiencia: res.lucroLiquido > 0 ? Math.min(100, ((tipoBase === 'custo' ? res.margemSobreCusto : res.margemSobreVenda) / (pesoTaxas || 1)) * 10) : 0
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

/**
 * Interface para os pontos da curva de otimização
 */
export interface PontoCurva {
  precoAnunciado: number;
  lucroLiquido: number;
  margemSobreVenda: number;
  isOtimizado?: boolean;
}

/**
 * Gera os dados para o gráfico de Curva de Otimização (-15% a +15%)
 */
export const gerarCurvaOtimizacao = (input: ShopeeInput): PontoCurva[] => {
  const precoBase = input.precoVenda || 100;
  const pontos: PontoCurva[] = [];
  const totalPontos = 100; // Alta densidade para ver os degraus

  const minPreco = precoBase * 0.85;
  const maxPreco = precoBase * 1.15;
  const step = (maxPreco - minPreco) / totalPontos;

  for (let i = 0; i <= totalPontos; i++) {
    const precoLoop = minPreco + (step * i);
    const res = calcularTaxasShopee({ ...input, precoVenda: precoLoop });

    pontos.push({
      precoAnunciado: arredondar(precoLoop, 2),
      lucroLiquido: res.lucroLiquido,
      margemSobreVenda: res.margemSobreVenda
    });
  }

  // Identificar ponto de pico local (Ponto Otimizado)
  // Um ponto é otimizado se ele é o maior lucro de uma "sequência" antes de um degrau
  // Ou simplesmente o ponto de maior lucro global na faixa.
  let maxLucro = -Infinity;
  let indiceOtimizado = -1;

  for (let i = 0; i < pontos.length; i++) {
    if (pontos[i].lucroLiquido > maxLucro) {
      maxLucro = pontos[i].lucroLiquido;
      indiceOtimizado = i;
    }
  }

  if (indiceOtimizado !== -1) {
    pontos[indiceOtimizado].isOtimizado = true;
  }

  return pontos;
};

/**
 * Lógica de Sweet Spot: Maximiza o Lucro Total Projetado
 */
export interface CenarioSweetSpot {
  precoAnunciado: number;
  lucroUnitario: number;
  volumeRelativo: number;      // Multiplicador de volume baseado na elasticidade (base 1)
  lucroTotalProjetado: number; // Lucro Unitário * Volume Relativo
  isAtual?: boolean;
}

export interface ResultadoSweetSpot {
  cenarioAtual: CenarioSweetSpot;
  cenarioOtimizado: CenarioSweetSpot;
  listaCompleta: CenarioSweetSpot[];
}

export const calcularCenariosDePreco = (input: ShopeeInput): ResultadoSweetSpot => {
  const PA = input.precoVenda || 0;
  
  // O fator de elasticidade padrão agora é 3.5 (Alta Concorrência/Guerra de Preços)
  const elasticidade = input.fatorElasticidade || 3.5;

  const cenarios: CenarioSweetSpot[] = [];
  
  // Analisamos uma faixa de -15% a +15% do preço atual
  const minPreco = Math.floor(PA * 0.85);
  const maxPreco = Math.ceil(PA * 1.15);

  for (let pSim = minPreco; pSim <= maxPreco; pSim += 1) {
    const res = calcularTaxasShopee({ ...input, precoVenda: pSim });

    /**
     * NOVA LÓGICA DE ELASTICIDADE: Curva de Demanda Exponencial (Fórmula de Potência)
     * O volumeBase inicial é sempre 1 (100% no preço atual).
     * Se baixar o preço, o volume escala exponencialmente. Se aumentar, o volume é esmagado.
     */
    const volumeRelativo = pSim > 0 
      ? Math.pow((PA / pSim), elasticidade) 
      : 0;

    const cenario: CenarioSweetSpot = {
      precoAnunciado: pSim,
      lucroUnitario: res.lucroLiquido,
      volumeRelativo: volumeRelativo,
      lucroTotalProjetado: res.lucroLiquido * volumeRelativo,
      isAtual: Math.abs(pSim - PA) < 0.5
    };

    cenarios.push(cenario);
  }

  const cenarioAtual = cenarios.find(c => c.isAtual) || {
    precoAnunciado: PA,
    lucroUnitario: 0,
    volumeRelativo: 1,
    lucroTotalProjetado: 0,
    isAtual: true
  };

  // O cenário otimizado é aquele que maximiza o Lucro Total Projetado (Giro x Margem)
  const cenarioOtimizado = [...cenarios].sort((a, b) => b.lucroTotalProjetado - a.lucroTotalProjetado)[0];

  return {
    cenarioAtual,
    cenarioOtimizado,
    listaCompleta: cenarios
  };
};
