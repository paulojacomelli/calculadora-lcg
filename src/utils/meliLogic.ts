/**
 * Lógica de Cálculo Mercado Livre 2025/2026
 * Contém as regras de comissão (Clássico/Premium), taxa fixa e frete grátis.
 */

import Decimal from 'decimal.js';

export type UnidadeValor = 'fixo' | 'porcentagem';
export type TipoAnuncio = 'classico' | 'premium';
export type TipoAds = 'fixo' | 'porcentagem' | 'roas';

export const TABELA_FRETE_MELI: Record<string, number> = {
    '0.3': 22.90,
    '0.5': 24.90,
    '1': 29.90,
    '2': 34.90,
    '5': 49.90,
    '9': 64.90,
    '14': 84.90,
    '19': 104.90,
    '24': 124.90,
    '29': 144.90
};

/**
 * Retorna a chave da faixa de peso baseada no peso real em kg.
 * Regra: Encontra a primeira chave na tabela que seja maior ou igual ao peso informado.
 */
export const getFaixaPesoAutomatico = (peso: number): string => {
    if (!peso || peso <= 0) return '0.3';
    const chaves = Object.keys(TABELA_FRETE_MELI).map(Number).sort((a, b) => a - b);
    for (const threshold of chaves) {
        if (peso <= threshold) return threshold.toString();
    }
    return chaves[chaves.length - 1].toString(); // Retorna o máximo se exceder
};

export interface MeliInput {
    custoProduto?: number;
    precoVenda?: number;

    tipoAnuncio: TipoAnuncio;
    comissaoPorcentagem?: number; // % da categoria

    freteGratis?: number; // Valor manual
    pesoKg?: string; // Chave da faixa de peso (legado/manual)
    pesoRealKg?: number; // Peso físico para detecção automática

    despesaFixa?: number;
    despesaFixaTipo: UnidadeValor;

    despesaAdicional?: number;
    despesaAdicionalTipo: UnidadeValor;

    impostoPorcentagem?: number;
    impostoTipo: UnidadeValor;

    adsValor?: number;
    adsTipo: TipoAds;

    rebatePorcentagem?: number;
    rebateTipo: UnidadeValor;

    cupomDesconto?: number;
    cupomTipo: UnidadeValor;

    fatorAlavancagem?: number;
    fatorAlavancagemAtivo?: boolean;
}

export interface MeliOutput {
    comissaoValor: number;
    taxaFixa: number;
    freteGratisValor: number;
    impostoValor: number;
    custoAds: number;
    rebateValor: number;
    cupomValor: number;
    custoTotal: number;
    lucroLiquido: number;
    margemSobreVenda: number;
    margemSobreCusto: number;
    nominalSobreCusto?: number;
    despesaFixaValor: number;
    despesaAdicionalValor: number;
    margem: number;
    precoVenda: number;
    precoAnunciado: number; // Preço visto pelo consumidor na vitrine (PDV + cupom)
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

export const arredondar = (num: number, casas: number = 2): number => {
    return new Decimal(num).toDecimalPlaces(casas, Decimal.ROUND_HALF_UP).toNumber();
};

// Normaliza a margem desejada para evitar NaN/infinito quebrando o cálculo.
const normalizarMargemDesejada = (margem: number | undefined): number => {
    if (margem === undefined || Number.isNaN(margem) || !Number.isFinite(margem)) {
        return 0;
    }
    return margem;
};

/**
 * Calcula as taxas do Mercado Livre 2026
 */
export const calcularTaxasMeli = (input: MeliInput): MeliOutput => {
    const PDV = input.precoVenda || 0;

    const mapUnidade = (tipo: UnidadeValor): TaxaType => tipo === 'porcentagem' ? 'percent' : 'fixed';

    // 1. Definição das Variáveis
    const CDP: TaxaInput = { value: input.custoProduto || 0, type: 'fixed' };
    const IMP: TaxaInput = { value: input.impostoPorcentagem || 0, type: mapUnidade(input.impostoTipo || 'porcentagem') };
    const DF: TaxaInput = { value: input.despesaFixa || 0, type: mapUnidade(input.despesaFixaTipo || 'fixo') };
    const OD: TaxaInput = { value: input.despesaAdicional || 0, type: mapUnidade(input.despesaAdicionalTipo || 'fixo') };
    const ADS: TaxaInput = { value: input.adsValor || 0, type: input.adsTipo === 'roas' ? 'fixed' : mapUnidade(input.adsTipo as UnidadeValor) };

    // 2. Comissão Mercado Livre
    const comissaoPct = input.comissaoPorcentagem || (input.tipoAnuncio === 'premium' ? 17 : 12);
    const comissaoValor = arredondar(VAL({ value: comissaoPct, type: 'percent' }, PDV), 2);

    // 3. Taxa Fixa (Vendas abaixo de R$ 79,00)
    const taxaFixa = (PDV < 79 && PDV > 0) ? 6.00 : 0;

    // 4. Frete Grátis (Vendas a partir de R$ 79,00)
    let freteGratisValor = input.freteGratis || 0;
    const faixaPeso = input.pesoRealKg !== undefined 
        ? getFaixaPesoAutomatico(input.pesoRealKg) 
        : input.pesoKg;

    if (PDV >= 79 && faixaPeso && TABELA_FRETE_MELI[faixaPeso]) {
        freteGratisValor = TABELA_FRETE_MELI[faixaPeso];
    }

    // 5. Demais Custos
    const custoProdutoValor = arredondar(VAL(CDP, PDV), 2);
    const impostoValor = arredondar(VAL(IMP, PDV), 2);
    const despesaFixaValor = arredondar(VAL(DF, PDV), 2);
    const despesaAdicionalValor = arredondar(VAL(OD, PDV), 2);

    // Rebate e Cupom
    const rebateValor = arredondar(VAL({ value: input.rebatePorcentagem || 0, type: mapUnidade(input.rebateTipo || 'porcentagem') }, PDV), 2);
    const cupomValor = arredondar(VAL({ value: input.cupomDesconto || 0, type: mapUnidade(input.cupomTipo || 'fixo') }, PDV), 2);

    let custoAds = 0;
    if (input.adsTipo === 'roas' && input.adsValor && input.adsValor > 0) {
        custoAds = arredondar(PDV / input.adsValor, 2);
    } else {
        custoAds = arredondar(VAL(ADS, PDV), 2);
    }

    const dCustosTotal = new Decimal(comissaoValor)
        .plus(taxaFixa)
        .plus(freteGratisValor)
        .plus(custoProdutoValor)
        .plus(impostoValor)
        .plus(despesaFixaValor)
        .plus(despesaAdicionalValor)
        .plus(custoAds)
        .plus(cupomValor)
        .minus(rebateValor);

    const LLV = new Decimal(PDV).minus(dCustosTotal).toNumber();
    const msv = PDV > 0 ? (LLV / PDV) * 100 : 0;
    const msc = custoProdutoValor > 0 ? (LLV / custoProdutoValor) * 100 : 0;

    return {
        comissaoValor,
        taxaFixa,
        freteGratisValor,
        impostoValor,
        custoAds,
        rebateValor,
        cupomValor,
        custoTotal: arredondar(dCustosTotal.toNumber(), 2),
        lucroLiquido: arredondar(LLV, 2),
        margemSobreVenda: arredondar(msv, 2),
        margemSobreCusto: arredondar(msc, 2),
        despesaFixaValor,
        despesaAdicionalValor,
        margem: arredondar(LLV, 2), // Mantendo retrocompatibilidade se 'margem' for usado como lucro
        precoVenda: arredondar(PDV, 2),
        precoAnunciado: arredondar(PDV + cupomValor, 2),
        nominalSobreCusto: arredondar(PDV - custoProdutoValor, 2),
        custoProdutoValor
    };
};

/**
 * Cálculo Algébrico Direto para Preço Ideal Meli (PIA)
 * Substitui a busca binária para garantir precisão e performance absoluta.
 */
export const calcularPrecoIdealMeli = (
    input: MeliInput,
    margemDesejada: number | undefined,
    tipoBase: 'custo' | 'venda' = 'venda'
): number => {
    const m = normalizarMargemDesejada(margemDesejada) / 100;
    const custo = input.custoProduto || 0;

    const resolverCenario = (taxasFixas: number, taxasVariaveis: number): number => {
        if (tipoBase === 'venda') {
            const divisor = 1 - taxasVariaveis - m;
            if (divisor <= 0) return custo * 10; 
            return (taxasFixas + custo) / divisor;
        } else {
            const divisor = 1 - taxasVariaveis;
            if (divisor <= 0) return custo * 10;
            return (taxasFixas + custo * (1 + m)) / divisor;
        }
    };

    // Taxas Variáveis (%)
    const comissaoP = (input.comissaoPorcentagem || (input.tipoAnuncio === 'premium' ? 17 : 12)) / 100;
    const impostoP = (input.impostoPorcentagem || 0) / 100;
    const adsP = (input.adsTipo === 'porcentagem' ? (input.adsValor || 0) / 100 : 0);
    const cupomP = (input.cupomTipo === 'porcentagem' ? (input.cupomDesconto || 0) / 100 : 0);
    const rebateP = (input.rebateTipo === 'porcentagem' ? (input.rebatePorcentagem || 0) / 100 : 0);
    const despFixaP = (input.despesaFixaTipo === 'porcentagem' ? (input.despesaFixa || 0) / 100 : 0);
    const despAdicP = (input.despesaAdicionalTipo === 'porcentagem' ? (input.despesaAdicional || 0) / 100 : 0);

    const taxasVariaveis = comissaoP + impostoP + adsP + cupomP + despFixaP + despAdicP - rebateP;

    // Taxas Fixas ($)
    const despFixaV = (input.despesaFixaTipo === 'fixo' ? (input.despesaFixa || 0) : 0);
    const despAdicV = (input.despesaAdicionalTipo === 'fixo' ? (input.despesaAdicional || 0) : 0);
    const cupomV = (input.cupomTipo === 'fixo' ? (input.cupomDesconto || 0) : 0);
    const rebateV = (input.rebateTipo === 'fixo' ? (input.rebatePorcentagem || 0) : 0);
    const adsV = (input.adsTipo === 'fixo' ? (input.adsValor || 0) : 0);

    const baseTaxasFixas = despFixaV + despAdicV + cupomV + adsV - rebateV;

    // Cenário A: Abaixo de 79 (Com Taxa Fixa ML R$ 6.00)
    const pdvA = resolverCenario(baseTaxasFixas + 6.00, taxasVariaveis);
    if (pdvA < 79) return arredondar(pdvA, 2);

    // Cenário B: Acima de 79 (Com Frete Grátis)
    let freteMeli = input.freteGratis || 0;
    const faixaPeso = input.pesoRealKg !== undefined ? getFaixaPesoAutomatico(input.pesoRealKg) : input.pesoKg;
    if (faixaPeso && TABELA_FRETE_MELI[faixaPeso]) {
        freteMeli = TABELA_FRETE_MELI[faixaPeso];
    }

    const pdvB = resolverCenario(baseTaxasFixas + freteMeli, taxasVariaveis);
    return arredondar(pdvB, 2);
};

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
    isAlavancagem: boolean;
    fatorAlavancagem: number;
    quedaPreco: number;
    quedaLucro: number;
    esforcoPercentual: number;
}

/**
 * Calcula o preço de venda ideal com otimização Sweet Spot.
 */
export const calcularPrecoIdealMeliDetalhado = (
    input: MeliInput,
    margemDesejada: number | undefined,
    tipoBase: 'custo' | 'venda' = 'venda'
): OtimizacaoPrecoResult => {
    const paMatematico = calcularPrecoIdealMeli(input, margemDesejada, tipoBase);
    const resultadoReferencia = calcularTaxasMeli({ ...input, precoVenda: paMatematico });

    let melhorPa = paMatematico;
    let melhorLucro = resultadoReferencia.lucroLiquido;

    let isAlavancagem = false;
    let fatorAlavancagem = 0;
    let quedaPreco = 0;
    let quedaLucro = 0;
    let esforcoPercentual = 0;

    if (input.fatorAlavancagemAtivo !== false) {
        // Otimização "Sweet Spot" (perto de R$ 79)
        for (let i = 1; i <= 5000; i++) {
            const paTeste = arredondar(paMatematico - (i / 100), 2);
            if (paTeste <= (input.custoProduto || 0.01)) break;

            const resTeste = calcularTaxasMeli({ ...input, precoVenda: paTeste });
            const isLucroMaior = resTeste.lucroLiquido > melhorLucro + 0.001;
            const isFaixaMelhor = (resTeste.taxaFixa + resTeste.freteGratisValor) < (resultadoReferencia.taxaFixa + resultadoReferencia.freteGratisValor);

            if (isLucroMaior || (resTeste.lucroLiquido >= melhorLucro && isFaixaMelhor)) {
                melhorPa = paTeste;
                melhorLucro = resTeste.lucroLiquido;
            } else if (paTeste < paMatematico - 50) break;
        }

        // Alavancagem de Giro
        const fatorAlvo = input.fatorAlavancagem || 5.0;
        for (let i = 1; i <= 1000; i++) {
            const paAlavanca = arredondar(melhorPa - (i / 100), 2);
            if (paAlavanca <= (input.custoProduto || 0.01)) break;

            const resAlavanca = calcularTaxasMeli({ ...input, precoVenda: paAlavanca });
            const deltaPreco = melhorPa - paAlavanca;
            const deltaMargem = melhorLucro - resAlavanca.lucroLiquido;

            if (deltaMargem <= 0) continue;

            const alavancagemAtual = deltaPreco / deltaMargem;
            if (alavancagemAtual >= fatorAlvo) {
                isAlavancagem = true;
                fatorAlavancagem = alavancagemAtual;
                quedaPreco = deltaPreco;
                quedaLucro = deltaMargem;
                esforcoPercentual = (quedaLucro / melhorLucro) * 100;
                melhorPa = paAlavanca;
            } else if (i > 200 && deltaPreco > 20) break;
        }
    }

    const resFinal = calcularTaxasMeli({ ...input, precoVenda: melhorPa });

    return {
        precoOriginal: paMatematico,
        precoOtimizado: melhorPa,
        lucroOriginal: resultadoReferencia.lucroLiquido,
        lucroOtimizado: resFinal.lucroLiquido,
        isOtimizado: melhorPa < paMatematico,
        margemCustoOriginal: resultadoReferencia.margemSobreCusto,
        margemVendaOriginal: resultadoReferencia.margemSobreVenda,
        margemCustoOtimizado: resFinal.margemSobreCusto,
        margemVendaOtimizado: resFinal.margemSobreVenda,
        isAlavancagem,
        fatorAlavancagem: arredondar(fatorAlavancagem, 1),
        quedaPreco: arredondar(quedaPreco, 2),
        quedaLucro: arredondar(quedaLucro, 2),
        esforcoPercentual: arredondar(esforcoPercentual, 1)
    };
};

export interface CenarioPrecoMeli extends MeliOutput {
    pesoTaxas: number;
    eficiencia: number;
}

export interface ResultadoSimulacaoMeli {
    cenarios: CenarioPrecoMeli[];
    pontoIdeal: CenarioPrecoMeli;
    pAlvo?: CenarioPrecoMeli;
}

/**
 * Simulação de cenários de preço para gráficos Meli
 */
export const simularCenariosPrecoMeli = (
    input: MeliInput,
    margemAlvo: number | undefined,
    tipoBase: 'custo' | 'venda' = 'venda'
): ResultadoSimulacaoMeli => {
    const margem = margemAlvo ?? 0;
    const breakeven = calcularPrecoIdealMeli(input, 0, tipoBase);

    const precoMin = breakeven * 0.9;
    const precoMax = calcularPrecoIdealMeli(input, Math.max(margem * 2, 50), tipoBase);

    const cenarios: CenarioPrecoMeli[] = [];
    const passos = 15;
    const step = (precoMax - precoMin) / passos;

    for (let i = 0; i <= passos; i++) {
        const pLoop = precoMin + (step * i);
        const res = calcularTaxasMeli({ ...input, precoVenda: pLoop });

        const totalTaxas = res.comissaoValor + res.taxaFixa + res.freteGratisValor + res.impostoValor + res.custoAds;
        const pesoTaxas = res.precoVenda > 0 ? (totalTaxas / res.precoVenda) * 100 : 0;
        const metricValue = tipoBase === 'custo' ? res.margemSobreCusto : res.margemSobreVenda;
        const eficiencia = res.lucroLiquido > 0 ? Math.min(100, (metricValue / (pesoTaxas || 1)) * 10) : 0;

        cenarios.push({ ...res, pesoTaxas, eficiencia });
    }

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

    const pAlvoRes = calcularPrecoIdealMeli(input, margem, tipoBase);
    const pAlvo = { ...calcularTaxasMeli({ ...input, precoVenda: pAlvoRes }), pesoTaxas: 0, eficiencia: 0 };

    return { cenarios, pontoIdeal, pAlvo };
};
