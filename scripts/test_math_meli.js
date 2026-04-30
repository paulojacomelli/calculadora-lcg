/**
 * test_math_meli.js
 * Validação matemática isolada — Planejar-Validar-Executar (skill calculando-matematica)
 * 
 * Fonte da verdade: calculos-meli.md (linhas 524–553)
 * Dados de entrada do spec:
 *   CDP=128,38 | PA=397,52 | CD=5% | DC=10% | CML=12%
 *   PES=7kg (faixa 9kg) | FG=64,90 | CR=3%
 *   IMP=6,5% | DF=8% | OD=1% | ADS=1%
 * 
 * Resultados esperados:
 *   PDC = 441,69 | PA = 397,52 | PDV = 377,64
 *   Comissão = -47,70 | FG = -64,90
 *   Lucro = 85,67 | Margem/Venda = 22,7% | Margem/Custo = 66,7%
 */

// ─────────────────────────────────────────────────────────────
// CONSTANTES (sem magic numbers por determinação da skill)
// ─────────────────────────────────────────────────────────────
const TAXA_FIXA_ABAIXO_79 = 6.00;  // Taxa fixa ML para PDV < R$79
const LIMIAR_FRETE_GRATIS = 79.00; // Frete grátis obrigatório acima deste valor (PA)

// ─────────────────────────────────────────────────────────────
// FUNÇÃO DE ARREDONDAMENTO FINANCEIRO (ROUND_HALF_UP)
// ─────────────────────────────────────────────────────────────
const arredondar = (num, casas = 2) => {
    const fator = Math.pow(10, casas);
    return Math.round((num + Number.EPSILON) * fator) / fator;
};

// ─────────────────────────────────────────────────────────────
// SIMULAÇÃO MODULAR — cada etapa tem nome e valor explícito
// ─────────────────────────────────────────────────────────────
const testarCalcularMargem = () => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('TESTE 1 — Calcular Margem (dados do spec calculos-meli.md)');
    console.log('═══════════════════════════════════════════════════════\n');

    // ── ENTRADAS ──
    const CDP = 128.38;  // Custo do Produto
    const PA  = 397.52;  // Preço Anunciado (input do usuário)

    const CML_PCT   = 12;   // Comissão ML Clássico (%)
    const CD_PCT    = 5;    // Cupom de Desconto (%)
    const DC_PCT    = 10;   // Desconto no Cadastro (%)
    const FG_VALOR  = 64.90;// Frete Grátis (7kg → faixa 9kg)
    const IMP_PCT   = 6.5;  // Imposto (%)
    const ADS_PCT   = 1;    // Ads (%)
    const DF_PCT    = 8;    // Despesa Fixa (%)
    const OD_PCT    = 1;    // Outras Despesas (%)
    const CR_PCT    = 3;    // Crédito de Rebate (%)

    // ── HIERARQUIA DE PREÇOS ──

    // PDC = PA / (1 - DC%)  → cálculo reverso do desconto no cadastro
    const PDC = arredondar(PA / (1 - DC_PCT / 100), 2);
    const descontoCadastroValor = arredondar(PDC - PA, 2);

    // PDV = PA - cupom
    const cupomValor = arredondar(PA * (CD_PCT / 100), 2);
    const PDV = arredondar(PA - cupomValor, 2);

    // ── POLÍTICA DO MERCADO LIVRE (base = PA) ──
    const comissaoValor = arredondar(PA * (CML_PCT / 100), 2);
    const taxaFixa      = (PA < LIMIAR_FRETE_GRATIS && PA > 0) ? TAXA_FIXA_ABAIXO_79 : 0;
    const freteGratis   = PA >= LIMIAR_FRETE_GRATIS ? FG_VALOR : 0;

    // ── POLÍTICA DA LCG (base = PDV) ──
    const custoProdutoValor   = CDP;                                // fixed
    const impostoValor        = arredondar(PDV * (IMP_PCT / 100), 2);
    const adsValor            = arredondar(PDV * (ADS_PCT / 100),  2);
    const despesaFixaValor    = arredondar(PDV * (DF_PCT / 100),   2);
    const despesaAdicionalValor = arredondar(PDV * (OD_PCT / 100), 2);
    const rebateValor         = arredondar(PDV * (CR_PCT / 100),   2);

    // ── SOMA DOS CUSTOS ──
    const custoTotal = arredondar(
        comissaoValor
        + taxaFixa
        + freteGratis
        + custoProdutoValor
        + impostoValor
        + adsValor
        + despesaFixaValor
        + despesaAdicionalValor
        - rebateValor,
        2
    );

    // ── LUCRO LÍQUIDO ──
    const lucroLiquido     = arredondar(PDV - custoTotal, 2);
    const margemSobreVenda = arredondar((lucroLiquido / PDV) * 100, 1);
    const margemSobreCusto = arredondar((lucroLiquido / CDP) * 100, 1);

    // ── RESULTADOS ──
    const resultados = {
        PDC           : { calculado: PDC,                esperado: 441.69 },
        PA            : { calculado: PA,                 esperado: 397.52 },
        cupomValor    : { calculado: cupomValor,         esperado: 19.88  },
        PDV           : { calculado: PDV,                esperado: 377.64 },
        comissaoValor : { calculado: comissaoValor,      esperado: 47.70  },
        taxaFixa      : { calculado: taxaFixa,           esperado: 0      }, // PA >= 79
        freteGratis   : { calculado: freteGratis,        esperado: 64.90  },
        impostoValor  : { calculado: impostoValor,       esperado: 24.55  },
        adsValor      : { calculado: adsValor,           esperado: 3.78   },
        despesaFixaValor: { calculado: despesaFixaValor, esperado: 30.21  },
        despesaAdicionalValor: { calculado: despesaAdicionalValor, esperado: 3.78 },
        rebateValor   : { calculado: rebateValor,        esperado: 11.33  },
        lucroLiquido  : { calculado: lucroLiquido,       esperado: 85.67  },
        margemSobreVenda: { calculado: margemSobreVenda, esperado: 22.7   },
        margemSobreCusto: { calculado: margemSobreCusto, esperado: 66.7   },
    };

    let passados = 0;
    let falhos = 0;

    for (const [nome, { calculado, esperado }] of Object.entries(resultados)) {
        const ok = Math.abs(calculado - esperado) < 0.015; // tolerância 1,5 centavo
        const simbolo = ok ? '✅' : '❌';
        if (ok) passados++; else falhos++;
        console.log(`  ${simbolo} ${nome.padEnd(24)} calculado=${String(calculado).padStart(7)}  esperado=${String(esperado).padStart(7)}`);
    }

    console.log(`\n  Resultado: ${passados}/${passados + falhos} passaram\n`);
    return falhos === 0;
};

// ─────────────────────────────────────────────────────────────
// TESTE 2 — Preço Ideal "Sobre a Venda" (equação inversa)
// ─────────────────────────────────────────────────────────────
const testarPrecoIdealSobreVenda = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('TESTE 2 — Preço Ideal (margem 20% sobre a venda)');
    console.log('═══════════════════════════════════════════════════════\n');

    // Entradas
    const CDP      = 128.38;
    const CML_PCT  = 12;
    const FG_VALOR = 64.90;  // faixa 9kg
    const IMP_PCT  = 6.5;
    const ADS_PCT  = 1;
    const DF_PCT   = 8;
    const OD_PCT   = 1;
    const CR_PCT   = 3;
    const CD_PCT   = 5;    // Cupom %
    const DC_PCT   = 10;   // Desconto Cadastro %
    const MARGEM   = 20;   // % desejada sobre a venda

    /**
     * Derivação algébrica (spec calculos-meli.md, linhas 292-301):
     *
     * Sabemos que:
     *   PDV = PA × (1 - CD%)          [cupom sobre PA]
     *   comissão = PA × CML%          [sobre PA — política ML]
     *
     * Lucro = PDV - comissão - FG - CDP - IMP×PDV - ADS×PDV - DF×PDV - OD×PDV + CR×PDV
     *       = PDV × (1 - IMP% - ADS% - DF% - OD% + CR%) - comissão - FG - CDP
     *
     * Para Margem sobre venda: Lucro = PDV × m
     *   PDV × m = PDV × (1 - taxasPDV) - PA × CML% - FG - CDP
     *   PDV × m = PDV × fatorR - PA × CML% - FG - CDP
     *
     * Como PDV = PA × (1 - CD%):
     *   PA(1-CD%)m = PA(1-CD%)fatorR - PA×CML% - (FG + CDP)
     *   PA × [(1-CD%)m - (1-CD%)fatorR + CML%] = -(FG + CDP)
     *   PA × [(1-CD%)(m - fatorR) + CML%] = -(FG + CDP)
     *
     * Seja fatorR = 1 - IMP% - ADS% - DF% - OD% + CR%
     * e denominador = (1 - CD%) × (fatorR - m) - CML%
     * então: PA = (FG + CDP) / denominador
     */
    const m      = MARGEM / 100;
    const cml    = CML_PCT / 100;
    const cd     = CD_PCT / 100;

    const fatorRetencaoPDV = 1 - IMP_PCT/100 - ADS_PCT/100 - DF_PCT/100 - OD_PCT/100 + CR_PCT/100;
    const denominador      = (1 - cd) * (fatorRetencaoPDV - m) - cml;

    const PA  = arredondar((FG_VALOR + CDP) / denominador, 2);
    const PDV = arredondar(PA * (1 - cd), 2);
    const PDC = arredondar(PA / (1 - DC_PCT / 100), 2);

    // Verificação retroativa
    const comissaoCalc    = arredondar(PA * cml, 2);
    const custoTotal      = arredondar(
        comissaoCalc + FG_VALOR + CDP
        + PDV * IMP_PCT/100
        + PDV * ADS_PCT/100
        + PDV * DF_PCT/100
        + PDV * OD_PCT/100
        - PDV * CR_PCT/100,
        2
    );
    const lucroCalc       = arredondar(PDV - custoTotal, 2);
    const margemCalc      = arredondar((lucroCalc / PDV) * 100, 1);

    console.log(`  PA  (Preço Anunciado Ideal)  = R$ ${PA}`);
    console.log(`  PDV (Preço de Venda)         = R$ ${PDV}`);
    console.log(`  PDC (Preço de Cadastro)      = R$ ${PDC}`);
    console.log(`  Comissão ML (${CML_PCT}% × PA)      = -R$ ${comissaoCalc}`);
    console.log(`  Lucro calculado              = R$ ${lucroCalc}`);
    console.log(`  Margem calculada             = ${margemCalc}%`);
    console.log(`  Margem desejada              = ${MARGEM}%`);

    const margemOk = Math.abs(margemCalc - MARGEM) < 0.5;
    console.log(`\n  ${margemOk ? '✅' : '❌'} Margem de ${MARGEM}% atingida: ${margemOk ? 'SIM' : 'NÃO'}`);
    return margemOk;
};

// ─────────────────────────────────────────────────────────────
// TESTE 3 — Casos Limite (Edge Cases, conforme checklist skill)
// ─────────────────────────────────────────────────────────────
const testarEdgeCases = () => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('TESTE 3 — Edge Cases (divisão por zero, NaN, Infinity)');
    console.log('═══════════════════════════════════════════════════════\n');

    const casos = [
        {
            nome: 'PA = 0 → margem deve ser 0, sem divisão/0',
            fn: () => {
                const PA = 0, PDV = 0;
                return (PDV > 0 ? (0 / PDV) * 100 : 0);
            },
            esperado: 0
        },
        {
            nome: 'CDP = 0 → margem custo deve ser 0',
            fn: () => {
                const lucro = 50, CDP = 0;
                return CDP > 0 ? (lucro / CDP) * 100 : 0;
            },
            esperado: 0
        },
        {
            nome: 'PA < 79 → taxa fixa R$6,00 aplicada',
            fn: () => {
                const PA = 78.99;
                return PA < LIMIAR_FRETE_GRATIS && PA > 0 ? TAXA_FIXA_ABAIXO_79 : 0;
            },
            esperado: 6.00
        },
        {
            nome: 'PA = 79 → taxa fixa = 0 (frete grátis ativo)',
            fn: () => {
                const PA = 79.00;
                return PA < LIMIAR_FRETE_GRATIS && PA > 0 ? TAXA_FIXA_ABAIXO_79 : 0;
            },
            esperado: 0
        },
        {
            nome: 'Margem = 100% → denominador não-zero (sem crash)',
            fn: () => {
                const m = 1.0, cml = 0.12, cd = 0.05;
                const fatorR = 1 - 0.065 - 0.01 - 0.08 - 0.01 + 0.03;
                const denominador = (1 - cd) * (fatorR - m) - cml;
                return isFinite(denominador) && denominador !== 0 ? 'OK' : 'CRASH';
            },
            esperado: 'OK'
        },
        {
            nome: 'Floating point: 0.1 + 0.2 com arredondar()',
            fn: () => arredondar(0.1 + 0.2, 2),
            esperado: 0.30
        },
    ];

    let passados = 0;
    for (const { nome, fn, esperado } of casos) {
        const resultado = fn();
        const ok = resultado === esperado || (typeof resultado === 'number' && Math.abs(resultado - esperado) < 0.001);
        if (ok) passados++;
        console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
        if (!ok) console.log(`     → calculado: ${resultado}, esperado: ${esperado}`);
    }

    console.log(`\n  Resultado: ${passados}/${casos.length} passaram\n`);
    return passados === casos.length;
};

// ─────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────
const ok1 = testarCalcularMargem();
const ok2 = testarPrecoIdealSobreVenda();
const ok3 = testarEdgeCases();

console.log('═══════════════════════════════════════════════════════');
console.log(`RESULTADO FINAL: ${ok1 && ok2 && ok3 ? '✅ TODOS OS TESTES PASSARAM' : '❌ FALHAS DETECTADAS'}`);
console.log('═══════════════════════════════════════════════════════\n');

process.exit(ok1 && ok2 && ok3 ? 0 : 1);
