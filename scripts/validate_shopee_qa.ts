
import { calcularPrecoIdealDetalhado, ShopeeInput } from '../src/utils/shopeeLogic';

/**
 * Script de QA para validação da hierarquia de notificações da Shopee.
 * Cenários solicitados pelo usuário para garantir a correta separação entre Green e Purple.
 */

async function runQA() {
  console.log('🚀 Iniciando Teste de QA - Shopee Notification Hierarchy\n');

  const scenarios = [
    {
      name: 'Cenário 1: CDP 50, Lucro Alvo 9,99 -> Deve ser VERDE',
      input: {
        custoProduto: 50,
        impostoPorcentagem: 0,
        despesaFixa: 0,
        despesaFixaTipo: 'fixo' as const,
        despesaAdicional: 0,
        despesaAdicionalTipo: 'fixo' as const,
        adsValor: 0,
        adsTipo: 'porcentagem' as const,
        rebatePorcentagem: 0,
        rebateTipo: 'porcentagem' as const,
        cupomDesconto: 0,
        cupomTipo: 'fixo' as const,
      } as ShopeeInput,
      targetProfit: 9.99,
      expectedType: 'Green',
      expectedPrice: 79.99,
      expectedProfit: 9.99
    },
    {
      name: 'Cenário 2: CDP 50, Lucro Alvo 10,00 -> Deve ser ROXA',
      input: {
        custoProduto: 50,
        impostoPorcentagem: 0,
        despesaFixa: 0,
        despesaFixaTipo: 'fixo' as const,
        despesaAdicional: 0,
        despesaAdicionalTipo: 'fixo' as const,
        adsValor: 0,
        adsTipo: 'porcentagem' as const,
        rebatePorcentagem: 0,
        rebateTipo: 'porcentagem' as const,
        cupomDesconto: 0,
        cupomTipo: 'fixo' as const,
      } as ShopeeInput,
      targetProfit: 10.00,
      expectedType: 'Purple',
      expectedPrice: 79.99,
      expectedProfit: 9.99
    }
  ];

  let allPassed = true;

  for (const scene of scenarios) {
    console.log(`Testing: ${scene.name}`);
    
    // Simula a busca de otimização
    const result = calcularPrecoIdealDetalhado(scene.input, scene.targetProfit, 'reais');
    
    const precoOtimizado = result.precoOtimizado;
    const lucroOtimizado = result.lucroOtimizado;
    
    // Identifica o tipo conforme a lógica de hierarchy (Green > Purple)
    let type = 'None';
    if (result.isOtimizado && !result.isAlavancagem) {
      type = 'Green';
    } else if (result.isAlavancagem) {
      type = 'Purple';
    }

    const priceMatch = Math.abs(precoOtimizado - scene.expectedPrice) < 0.1;
    const profitMatch = Math.abs(lucroOtimizado - scene.expectedProfit) < 0.05;
    const typeMatch = type === scene.expectedType;

    if (priceMatch && profitMatch && typeMatch) {
      console.log(`  ✅ PASSED: Price=${precoOtimizado}, Profit=${lucroOtimizado}, Type=${type}`);
    } else {
      allPassed = false;
      console.log(`  ❌ FAILED:`);
      if (!priceMatch) console.log(`     Expected Price ${scene.expectedPrice}, got ${precoOtimizado}`);
      if (!profitMatch) console.log(`     Expected Profit ${scene.expectedProfit}, got ${lucroOtimizado}`);
      if (!typeMatch) console.log(`     Expected Type ${scene.expectedType}, got ${type}`);
    }
    console.log('');
  }

  if (allPassed) {
    console.log('✨ TODOS OS TESTES DE QA PASSARAM COM SUCESSO! ✨');
    process.exit(0);
  } else {
    console.log('⚠️ ALGUNS TESTES DE QA FALHARAM. VERIFIQUE A LÓGICA.');
    process.exit(1);
  }
}

runQA().catch(err => {
  console.error('Erro ao executar QA:', err);
  process.exit(1);
});
