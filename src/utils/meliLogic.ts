/**
 * Lógica de Cálculo Mercado Livre 2025/2026
 * Contém as regras de comissão (Clássico/Premium), taxa fixa e frete grátis.
 * 
 * ATUALIZAÇÃO: Tabela de frete agora é dinâmica, buscando do Firestore
 * com fallback para valores hardcoded quando offline.
 */

import Decimal from 'decimal.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type UnidadeValor = 'fixo' | 'porcentagem';
export type TipoAnuncio = 'classico' | 'premium';
export type TipoAds = 'fixo' | 'porcentagem' | 'roas';
export type TipoReputacao = 'cinza' | 'verde_sem_reputacao' | 'amarela' | 'laranja' | 'vermelha';

// Tabela de frete padrão hardcoded (fallback quando Firestore indisponível)
export const TABELA_FRETE_MELI_PADRAO: Record<string, number> = {
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

// Cache da tabela dinâmica para evitar requisições repetidas
let tabelaFreteCache: Record<string, number> | null = null;
let ultimaAtualizacaoCache: number = 0;
const TEMPO_CACHE_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Interface para faixa de peso do frete
 */
export interface FaixaPesoFrete {
    pesoMaximoKg: number;
    custoEnvioPadrao: number;
    custoEnvioRapido: number;
}

/**
 * Busca a tabela de frete mais recente do Firestore
 * Retorna null se não encontrar ou houver erro
 */
export const buscarTabelaFreteFirestore = async (
    tipoReputacao: TipoReputacao = 'verde_sem_reputacao'
): Promise<Record<string, number> | null> => {
    try {
        const docRef = doc(db, 'tabelas_frete_meli', tipoReputacao);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const dados = snapshot.data();
            if (dados.faixas && Array.isArray(dados.faixas)) {
                const tabela: Record<string, number> = {};
                dados.faixas.forEach((faixa: FaixaPesoFrete) => {
                    const chave = faixa.pesoMaximoKg.toString();
                    // Usa o custo de envio rápido (frete grátis acima de R$ 79)
                    tabela[chave] = faixa.custoEnvioRapido;
                });
                return tabela;
            }
        }
        return null;
    } catch (error) {
        console.warn('[MeliLogic] Erro ao buscar tabela de frete do Firestore:', error);
        return null;
    }
};

/**
 * Obtém a tabela de frete atual, usando cache ou buscando do Firestore
 * Fallback para tabela hardcoded se necessário
 */
export const getTabelaFreteMeli = async (
    tipoReputacao: TipoReputacao = 'verde_sem_reputacao'
): Promise<Record<string, number>> => {
    const agora = Date.now();

    // Verifica se o cache ainda é válido
    if (tabelaFreteCache && (agora - ultimaAtualizacaoCache) < TEMPO_CACHE_MS) {
        return tabelaFreteCache;
    }

    // Tenta buscar do Firestore
    const tabelaFirestore = await buscarTabelaFreteFirestore(tipoReputacao);

    if (tabelaFirestore && Object.keys(tabelaFirestore).length > 0) {
        tabelaFreteCache = tabelaFirestore;
        ultimaAtualizacaoCache = agora;
        console.log('[MeliLogic] Tabela de frete carregada do Firestore');
        return tabelaFirestore;
    }

    // Fallback para tabela hardcoded
    console.log('[MeliLogic] Usando tabela de frete hardcoded (fallback)');
    return TABELA_FRETE_MELI_PADRAO;
};

/**
 * Versão síncrona da tabela (usa cache ou fallback)
 * Para uso em cálculos que não podem esperar async
 */
export const getTabelaFreteMeliSync = (): Record<string, number> => {
    return tabelaFreteCache || TABELA_FRETE_MELI_PADRAO;
};

// Tabela de frete atual (será atualizada dinamicamente)
export let TABELA_FRETE_MELI: Record<string, number> = { ...TABELA_FRETE_MELI_PADRAO };

/**
 * Atualiza a tabela de frete na memória
 * Chamado quando novos dados são carregados do Firestore
 */
export const atualizarTabelaFrete = (novaTabela: Record<string, number>): void => {
    TABELA_FRETE_MELI = { ...novaTabela };
    tabelaFreteCache = { ...novaTabela };
    ultimaAtualizacaoCache = Date.now();
};

/**
 * Inicializa a tabela de frete buscando do Firestore
 * Deve ser chamado no carregamento da aplicação
 */
export const inicializarTabelaFrete = async (): Promise<void> => {
    const tabela = await getTabelaFreteMeli();
    atualizarTabelaFrete(tabela);
};

/**
 * Retorna a chave da faixa de peso baseada no peso real em kg.
 * Regra: Encontra a primeira chave na tabela que seja maior ou igual ao peso informado.
 * Usa a tabela em cache ou fallback hardcoded.
 */
export const getFaixaPesoAutomatico = (peso: number): string => {
    if (!peso || peso <= 0) return '0.3';
    const tabelaAtual = getTabelaFreteMeliSync();
    const chaves = Object.keys(tabelaAtual).map(Number).sort((a, b) => a - b);
    for (const threshold of chaves) {
        if (peso <= threshold) return threshold.toString();
    }
    return chaves[chaves.length - 1].toString(); // Retorna o máximo se exceder
};

export interface MeliInput {
    custoProduto?: number;
    precoVenda?: number; // Legado - mantido para compatibilidade
    precoAnunciadoClassico?: number; // PAC - Novo campo
    precoAnunciadoPremium?: number;  // PAP - Novo campo

    tipoAnuncio: TipoAnuncio;
    comissaoPorcentagem?: number; // Legado: % global da categoria
    comissaoClassico?: number;    // Manual: % Clássico
    comissaoPremium?: number;     // Manual: % Premium

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

    descontoCadastro?: number;
    descontoCadastroTipo: UnidadeValor;
    descontoCadastroValorDe?: number; // Valor original calculado (De: R$ X)
    descontoCadastroValorPor?: number; // Valor final informado (Por: R$ Y)

    reputacao?: TipoReputacao; // Reputação do vendedor para cálculo de frete
    tipoEnvio?: string; // Tipo de envio (Full, Coleta, etc)

    desconto?: number; // Desconto Geral Cliente (PDV)
    
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
    descontoCadastroValor: number;
    descontoCadastroValorDe: number; // Valor original calculado (De: R$ X)
    descontoCadastroValorPor: number; // Valor final informado (Por: R$ Y)
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
 * NOVA LÓGICA: PA é o preço base, cupom desconta do PA para chegar ao PDV
 */
export const calcularTaxasMeli = (input: MeliInput): MeliOutput => {
    // NOVA LÓGICA: O input.precoVenda agora representa o PA (Preço Anunciado)
    const PA = input.precoVenda || 0;

    const mapUnidade = (tipo: UnidadeValor): TaxaType => tipo === 'porcentagem' ? 'percent' : 'fixed';

    // 1. Calcular o cupom sobre o PA (Preço Anunciado)
    const cupomValor = arredondar(VAL({ value: input.cupomDesconto || 0, type: mapUnidade(input.cupomTipo || 'fixo') }, PA), 2);
    
    // 1.0.1 Calcular o desconto adicional (Desconto Cliente no grid principal)
    const descontoGeralValor = arredondar(VAL({ value: input.desconto || 0, type: 'percent' }, PA), 2);

    // 1.1 Calcular o desconto no cadastro - cálculo reverso
    // Se PA é o valor final "Por", então valor "De" = PA / (1 - desconto%)
    const dcPercent = input.descontoCadastro || 0;
    const dcTipo = input.descontoCadastroTipo || 'porcentagem';

    let descontoCadastroValorDe: number; // Valor original (De: R$ X)
    let descontoCadastroValorPor: number; // Valor final informado (Por: R$ Y) = PA
    let descontoCadastroValor: number; // Valor do desconto em si

    if (dcTipo === 'porcentagem' && dcPercent > 0) {
        // Cálculo reverso: PA é o valor após desconto
        // PA = ValorDe * (1 - desconto%) => ValorDe = PA / (1 - desconto%)
        descontoCadastroValorDe = arredondar(PA / (1 - dcPercent / 100), 2);
        descontoCadastroValorPor = PA;
        descontoCadastroValor = arredondar(descontoCadastroValorDe - descontoCadastroValorPor, 2);
    } else if (dcTipo === 'fixo' && dcPercent > 0) {
        // Se é valor fixo, o "De" é PA + desconto fixo
        descontoCadastroValorDe = arredondar(PA + dcPercent, 2);
        descontoCadastroValorPor = PA;
        descontoCadastroValor = dcPercent;
    } else {
        descontoCadastroValorDe = PA;
        descontoCadastroValorPor = PA;
        descontoCadastroValor = 0;
    }

    // 2. Calcular o PDV (Preço de Venda) = PA - cupom - desconto (o DC já está "embutido" no PA)
    const PDV = arredondar(PA - cupomValor - descontoGeralValor, 2);

    // 3. Definição das Variáveis - Política ML sobre PA, demais custos sobre PDV
    const CDP: TaxaInput = { value: input.custoProduto || 0, type: 'fixed' };
    const IMP: TaxaInput = { value: input.impostoPorcentagem || 0, type: mapUnidade(input.impostoTipo || 'porcentagem') };
    const DF: TaxaInput = { value: input.despesaFixa || 0, type: mapUnidade(input.despesaFixaTipo || 'fixo') };
    const OD: TaxaInput = { value: input.despesaAdicional || 0, type: mapUnidade(input.despesaAdicionalTipo || 'fixo') };
    const ADS: TaxaInput = { value: input.adsValor || 0, type: input.adsTipo === 'roas' ? 'fixed' : mapUnidade(input.adsTipo as UnidadeValor) };

    // 4. Comissão Mercado Livre (sobre PA - política do ML)
    let comissaoPct = input.comissaoPorcentagem;
    if (comissaoPct === undefined) {
        if (input.tipoAnuncio === 'premium') {
            comissaoPct = input.comissaoPremium !== undefined ? input.comissaoPremium : 17;
        } else {
            comissaoPct = input.comissaoClassico !== undefined ? input.comissaoClassico : 12;
        }
    }
    const comissaoValor = arredondar(VAL({ value: comissaoPct, type: 'percent' }, PA), 2);

    // 5. Taxa Fixa (sobre PA - política do ML)
    const taxaFixa = (PA < 79 && PA > 0) ? 6.00 : 0;

    // 6. Frete Grátis (sobre PA - política do ML)
    let freteGratisValor = input.freteGratis || 0;
    const faixaPeso = input.pesoRealKg !== undefined
        ? getFaixaPesoAutomatico(input.pesoRealKg)
        : input.pesoKg;

    const tabelaFreteAtual = getTabelaFreteMeliSync();
    if (PA >= 79 && faixaPeso && tabelaFreteAtual[faixaPeso]) {
        freteGratisValor = tabelaFreteAtual[faixaPeso];
    }

    // 7. Demais Custos (sobre PDV)
    const custoProdutoValor = arredondar(VAL(CDP, PDV), 2);
    const impostoValor = arredondar(VAL(IMP, PDV), 2);
    const despesaFixaValor = arredondar(VAL(DF, PDV), 2);
    const despesaAdicionalValor = arredondar(VAL(OD, PDV), 2);

    // 8. Rebate (sobre PDV)
    const rebateValor = arredondar(VAL({ value: input.rebatePorcentagem || 0, type: mapUnidade(input.rebateTipo || 'porcentagem') }, PDV), 2);

    // 9. Ads (sobre PDV)
    let custoAds = 0;
    if (input.adsTipo === 'roas' && input.adsValor && input.adsValor > 0) {
        custoAds = arredondar(PDV / input.adsValor, 2);
    } else {
        custoAds = arredondar(VAL(ADS, PDV), 2);
    }

    // 10. Soma dos custos (cupom não entra nos custos totais, é um desconto dado ao cliente)
    const dCustosTotal = new Decimal(comissaoValor)
        .plus(taxaFixa)
        .plus(freteGratisValor)
        .plus(custoProdutoValor)
        .plus(impostoValor)
        .plus(despesaFixaValor)
        .plus(despesaAdicionalValor)
        .plus(custoAds)
        .minus(rebateValor);

    // 11. Lucro e margens calculados sobre o PDV (valor efetivo de venda)
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
        descontoCadastroValor,
        descontoCadastroValorDe,
        descontoCadastroValorPor,
        custoTotal: arredondar(dCustosTotal.toNumber(), 2),
        lucroLiquido: arredondar(LLV, 2),
        margemSobreVenda: arredondar(msv, 2),
        margemSobreCusto: arredondar(msc, 2),
        despesaFixaValor,
        despesaAdicionalValor,
        margem: arredondar(LLV, 2),
        precoVenda: arredondar(PDV, 2),        // PDV = PA - cupom
        precoAnunciado: arredondar(PA, 2),     // PA = valor informado
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
    tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
): number => {
    const isReais = tipoBase === 'reais';
    const m = isReais ? 0 : (normalizarMargemDesejada(margemDesejada) / 100);
    const lucroFixo = isReais ? normalizarMargemDesejada(margemDesejada) : 0;
    const custoProd = input.custoProduto || 0;

    // --- Taxas Variáveis (%) ---
    // Respeita a comissão informada manualmente, por tipo ou global; fallback: 17% Premium / 12% Clássico
    const comissaoPct = input.comissaoPorcentagem !== undefined
        ? input.comissaoPorcentagem
        : (input.tipoAnuncio === 'premium'
            ? (input.comissaoPremium !== undefined ? input.comissaoPremium : 17)
            : (input.comissaoClassico !== undefined ? input.comissaoClassico : 12));
    const comissaoP = comissaoPct / 100;

    const impostoP = (input.impostoPorcentagem || 0) / 100;
    const adsP = (input.adsTipo === 'porcentagem' ? (input.adsValor || 0) / 100 : (input.adsTipo === 'roas' && input.adsValor ? (1 / input.adsValor) : 0));
    const cupomP = (input.cupomTipo === 'porcentagem' ? (input.cupomDesconto || 0) / 100 : 0);
    const rebateP = (input.rebateTipo === 'porcentagem' ? (input.rebatePorcentagem || 0) / 100 : 0);
    const despFixaP = (input.despesaFixaTipo === 'porcentagem' ? (input.despesaFixa || 0) / 100 : 0);
    const despAdicP = (input.despesaAdicionalTipo === 'porcentagem' ? (input.despesaAdicional || 0) / 100 : 0);

    // Soma das taxas que incidem sobre o PDV
    const somaTaxasVariaveisPDV = impostoP + adsP + despFixaP + despAdicP - rebateP;

    // --- Taxas Fixas ($) ---
    const despFixaV = (input.despesaFixaTipo === 'fixo' ? (input.despesaFixa || 0) : 0);
    const despAdicV = (input.despesaAdicionalTipo === 'fixo' ? (input.despesaAdicional || 0) : 0);
    const cupomV = (input.cupomTipo === 'fixo' ? (input.cupomDesconto || 0) : 0);
    const rebateV = (input.rebateTipo === 'fixo' ? (input.rebatePorcentagem || 0) : 0);
    const adsV = (input.adsTipo === 'fixo' ? (input.adsValor || 0) : 0);

    // Soma das taxas fixas incidentes sobre o PDV
    const taxasFixasPDV = despFixaV + despAdicV + adsV - rebateV;

    /**
     * Função que resolve a equação para um cenário de taxa fixa ML e frete.
     * Isola PA na equação: PDV * (1 - CP) - Com% * PA = L + Custo + TF + FT + CF
     */
    const resolverCenarioAlgebraico = (taxaMeliML: number, freteML: number): number => {
        // fatorRetencaoPDV: Quanto sobra do PDV após as taxas variáveis que incidem sobre ele.
        // Se modo venda, m (margem sobre PDV) entra como um custo variável extra.
        const margemPDV = (tipoBase === 'venda') ? m : 0;
        const fatorRetencaoPDV = 1 - somaTaxasVariaveisPDV - margemPDV;

        // Numerador: Lucro alvo + Custos fixos fora da base PA
        const L = (tipoBase === 'custo') ? (custoProd * m) : (tipoBase === 'reais' ? lucroFixo : 0);
        const numerador = L + custoProd + taxaMeliML + freteML + taxasFixasPDV + (cupomV * fatorRetencaoPDV);

        // Denominador: Coeficiente de PA
        const denominador = (1 - cupomP) * fatorRetencaoPDV - comissaoP;

        if (denominador <= 0.001) return (numerador || 1) * 10; // Evita divisão por zero ou negativa

        return numerador / denominador;
    };

    // Cenário A: Abaixo de 79 (Taxa Fixa R$ 6.00, Sem Frete Grátis)
    const paA = resolverCenarioAlgebraico(6.00, 0);
    if (paA < 79) return arredondar(paA, 2);

    // Cenário B: Acima de 79 (Sem Taxa Fixa, Com Frete Grátis)
    let freteMeli = input.freteGratis || 0;
    const faixaPeso = input.pesoRealKg !== undefined ? getFaixaPesoAutomatico(input.pesoRealKg) : input.pesoKg;
    const tabelaFreteCalc = getTabelaFreteMeliSync();
    if (faixaPeso && tabelaFreteCalc[faixaPeso]) {
        freteMeli = tabelaFreteCalc[faixaPeso];
    }

    const paB = resolverCenarioAlgebraico(0, freteMeli);
    // Se o preço ideal cair no vale entre as faixas, retorna a barreira dos 79 se for mais vantajoso,
    // mas o arredondar 2 já ajuda.
    return arredondar(paB, 2);
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
    tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
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

    let lucroAlvoParaAjuste = 0;
    if (tipoBase === 'reais') {
        lucroAlvoParaAjuste = margemDesejada || 0;
    } else if (tipoBase === 'custo') {
        lucroAlvoParaAjuste = (input.custoProduto || 0) * (margemDesejada || 0) / 100;
    } else {
        // Modo VENDA: O lucro é % do PDV.
        // Usamos o PDV de referência do cálculo matemático para definir o alvo em centavos.
        lucroAlvoParaAjuste = (resultadoReferencia.precoVenda || 0) * (margemDesejada || 0) / 100;
    }

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
    } else {
        // Ajuste Fino de Precisão (+/- 5 centavos)
        // Busca o preço real que resulte no lucro mais próximo do esperado matemático.
        for (let i = -5; i <= 5; i++) {
            const paTeste = arredondar(paMatematico + (i / 100), 2);
            if (paTeste === melhorPa && i !== 0) continue;

            const resTeste = calcularTaxasMeli({ ...input, precoVenda: paTeste });
            const difAtual = Math.abs(melhorLucro - lucroAlvoParaAjuste);
            const difTeste = Math.abs(resTeste.lucroLiquido - lucroAlvoParaAjuste);

            if (difTeste < difAtual || (difTeste === difAtual && paTeste < melhorPa)) {
                melhorPa = paTeste;
                melhorLucro = resTeste.lucroLiquido;
            }
        }
    }

    if (input.fatorAlavancagemAtivo !== false) {
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
    tipoBase: 'custo' | 'venda' | 'reais' = 'venda'
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
