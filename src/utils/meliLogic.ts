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

export interface MeliInput {
    custoProduto?: number;
    precoVenda?: number;

    tipoAnuncio: TipoAnuncio;
    comissaoPorcentagem?: number; // % da categoria

    freteGratis?: number; // Valor manual
    pesoKg?: string; // Chave da tabela

    custoEmbalagem?: number;

    despesaFixa?: number;
    despesaFixaTipo: UnidadeValor;

    despesaAdicional?: number;
    despesaAdicionalTipo: UnidadeValor;

    impostoPorcentagem?: number;
    impostoTipo: UnidadeValor;

    adsValor?: number;
    adsTipo: TipoAds;
}

export interface MeliOutput {
    comissaoValor: number;
    taxaFixa: number;
    freteGratisValor: number;
    impostoValor: number;
    custoAds: number;
    custoEmbalagem: number;
    custoTotal: number;
    lucroLiquido: number;
    margemSobreVenda: number;
    margemSobreCusto: number;
    nominalSobreCusto?: number;
    despesaFixaValor: number;
    despesaAdicionalValor: number;
    margem: number;
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

export const arredondar = (num: number, casas: number = 2): number => {
    return new Decimal(num).toDecimalPlaces(casas, Decimal.ROUND_HALF_UP).toNumber();
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
    // Clássico costuma ser ~12-14% e Premium ~17-19% (depende da categoria)
    const comissaoPct = input.comissaoPorcentagem || (input.tipoAnuncio === 'premium' ? 17 : 12);
    const comissaoValor = arredondar(VAL({ value: comissaoPct, type: 'percent' }, PDV), 2);

    // 3. Taxa Fixa (Vendas abaixo de R$ 79,00)
    // Valor padrão R$ 6,00 (ajustável para 6.50 se desejar ser mais conservador)
    const taxaFixa = (PDV < 79 && PDV > 0) ? 6.00 : 0;

    // 4. Frete Grátis (Vendas a partir de R$ 79,00 costumam ser obrigatórias)
    let freteGratisValor = input.freteGratis || 0;
    if (PDV >= 79 && input.pesoKg && TABELA_FRETE_MELI[input.pesoKg]) {
        freteGratisValor = TABELA_FRETE_MELI[input.pesoKg];
    }

    // 5. Demais Custos
    const custoProdutoValor = arredondar(VAL(CDP, PDV), 2);
    const impostoValor = arredondar(VAL(IMP, PDV), 2);
    const despesaFixaValor = arredondar(VAL(DF, PDV), 2);
    const despesaAdicionalValor = arredondar(VAL(OD, PDV), 2);
    const custoEmbalagem = input.custoEmbalagem || 0;

    let custoAds = 0;
    if (input.adsTipo === 'roas' && input.adsValor && input.adsValor > 0) {
        custoAds = arredondar(PDV / input.adsValor, 2);
    } else {
        custoAds = arredondar(VAL(ADS, PDV), 2);
    }

    const dCustos = new Decimal(comissaoValor)
        .plus(taxaFixa)
        .plus(freteGratisValor)
        .plus(custoProdutoValor)
        .plus(impostoValor)
        .plus(despesaFixaValor)
        .plus(despesaAdicionalValor)
        .plus(custoAds)
        .plus(custoEmbalagem);

    const custos = dCustos.toNumber();

    // 6. Lucro Líquido
    const LLV = new Decimal(PDV).minus(dCustos).toNumber();

    const msv = PDV > 0 ? new Decimal(LLV).dividedBy(PDV).times(100).toNumber() : 0;
    const nominalSobreCusto = new Decimal(PDV).minus(custoProdutoValor).toNumber();
    const msc = custoProdutoValor > 0 ? (nominalSobreCusto / custoProdutoValor) * 100 : 0;

    const margem = new Decimal(PDV)
        .minus(custoProdutoValor)
        .minus(impostoValor)
        .minus(custoAds)
        .minus(despesaFixaValor)
        .minus(despesaAdicionalValor)
        .minus(comissaoValor)
        .minus(taxaFixa)
        .minus(freteGratisValor)
        .minus(custoEmbalagem)
        .toNumber();

    return {
        comissaoValor,
        taxaFixa,
        freteGratisValor,
        impostoValor,
        custoAds,
        custoEmbalagem,
        custoTotal: arredondar(custos, 2),
        lucroLiquido: arredondar(LLV, 2),
        margemSobreVenda: arredondar(msv, 2),
        margemSobreCusto: arredondar(msc, 2),
        despesaFixaValor,
        despesaAdicionalValor,
        margem: arredondar(margem, 2),
        precoVenda: arredondar(PDV, 2),
        nominalSobreCusto: arredondar(nominalSobreCusto, 2),
        custoProdutoValor
    };
};

/**
 * Solver (Busca Binária) para Preço Ideal Meli
 */
export const calcularPrecoIdealMeli = (
    input: MeliInput,
    margemDesejada: number | undefined,
    tipoBase: 'custo' | 'venda' = 'venda'
): number => {
    const margem = margemDesejada ?? 0;
    let min = input.custoProduto ?? 0;
    let max = (input.custoProduto ?? 10) * 20;
    let chute = (min + max) / 2;

    for (let i = 0; i < 50; i++) {
        const resultado = calcularTaxasMeli({ ...input, precoVenda: chute });
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

export interface CenarioPrecoMeli extends MeliOutput {
    pesoTaxas: number;
    eficiencia: number;
}

export interface ResultadoSimulacaoMeli {
    cenarios: CenarioPrecoMeli[];
    pontoIdeal: CenarioPrecoMeli;
    pAlvo?: CenarioPrecoMeli;
    pIdeal15?: CenarioPrecoMeli;
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
        const eficiencia = res.lucroLiquido > 0
            ? Math.min(100, (metricValue / (pesoTaxas || 1)) * 10)
            : 0;

        cenarios.push({
            ...res,
            pesoTaxas,
            eficiencia
        });
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

    return { cenarios, pontoIdeal };
};
