import { calcularPrecoIdealMeli, calcularTaxasMeli } from './src/utils/meliLogic.js';

const input = {
    custoProduto: 969,
    tipoAnuncio: 'premium',
    comissaoPorcentagem: 17,
    impostoPorcentagem: 4,
    adsValor: 5.5,
    adsTipo: 'porcentagem',
    despesaFixa: 5,
    despesaFixaTipo: 'fixo',
    despesaAdicional: 0,
    despesaAdicionalTipo: 'fixo',
    cupomDesconto: 0,
    cupomTipo: 'fixo',
    rebatePorcentagem: 0,
    rebateTipo: 'porcentagem',
    pesoRealKg: 0.5
};

const margemAlvo = 5; // 5%
const pa = calcularPrecoIdealMeli(input, margemAlvo, 'venda');
const res = calcularTaxasMeli({ ...input, precoVenda: pa });

console.log('--- TESTE DE LÓGICA MELI ---');
console.log(`Custo Produto: R$ ${input.custoProduto}`);
console.log(`Margem Alvo: ${margemAlvo}% sobre Venda`);
console.log(`Preço Calculado (PIA): R$ ${pa}`);
console.log(`Margem Alcançada: ${res.margemSobreVenda}%`);
console.log(`Lucro Líquido: R$ ${res.lucroLiquido}`);
console.log('----------------------------');

if (Math.abs(res.margemSobreVenda - margemAlvo) < 0.1) {
    console.log('✅ SUCESSO: Margem precisa!');
} else {
    console.log('❌ FALHA: Margem imprecisa!');
}
