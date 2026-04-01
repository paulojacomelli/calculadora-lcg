/**
 * Script executável para raspagem das tabelas de frete do Mercado Livre
 * 
 * Uso: node scripts/scrapeMeliFrete.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// URLs das páginas de ajuda do Mercado Livre
const URLS_MELI_FRETE = {
  verde_sem_reputacao: 'https://www.mercadolivre.com.br/ajuda/40538',
  amarela: 'https://www.mercadolivre.com.br/ajuda/40545',
  laranja_vermelha: 'https://www.mercadolivre.com.br/ajuda/40547'
};

const NOMES_REPUTACAO = {
  verde_sem_reputacao: 'MercadoLider, reputacao verde ou sem reputacao',
  amarela: 'Reputacao amarela',
  laranja_vermelha: 'Reputacao laranja ou vermelha'
};

/**
 * Tabela de frete hardcoded baseada nas informacoes oficiais do ML
 * Usada como fallback quando o scraping nao consegue extrair os dados
 */
const TABELA_FRETE_FALLBACK = {
  verde_sem_reputacao: [
    { pesoMaximoKg: 0.3, custoEnvioPadrao: 7.95, custoEnvioRapido: 15.75 },
    { pesoMaximoKg: 0.5, custoEnvioPadrao: 8.95, custoEnvioRapido: 16.75 },
    { pesoMaximoKg: 1, custoEnvioPadrao: 10.90, custoEnvioRapido: 18.90 },
    { pesoMaximoKg: 2, custoEnvioPadrao: 13.90, custoEnvioRapido: 21.90 },
    { pesoMaximoKg: 5, custoEnvioPadrao: 16.90, custoEnvioRapido: 24.90 },
    { pesoMaximoKg: 9, custoEnvioPadrao: 22.90, custoEnvioRapido: 30.90 },
    { pesoMaximoKg: 14, custoEnvioPadrao: 29.90, custoEnvioRapido: 37.90 },
    { pesoMaximoKg: 19, custoEnvioPadrao: 36.90, custoEnvioRapido: 44.90 },
    { pesoMaximoKg: 24, custoEnvioPadrao: 43.90, custoEnvioRapido: 51.90 },
    { pesoMaximoKg: 29, custoEnvioPadrao: 50.90, custoEnvioRapido: 58.90 }
  ],
  amarela: [
    { pesoMaximoKg: 0.3, custoEnvioPadrao: 9.09, custoEnvioRapido: 18.90 },
    { pesoMaximoKg: 0.5, custoEnvioPadrao: 10.09, custoEnvioRapido: 19.90 },
    { pesoMaximoKg: 1, custoEnvioPadrao: 12.09, custoEnvioRapido: 21.90 },
    { pesoMaximoKg: 2, custoEnvioPadrao: 15.09, custoEnvioRapido: 24.90 },
    { pesoMaximoKg: 5, custoEnvioPadrao: 18.09, custoEnvioRapido: 27.90 },
    { pesoMaximoKg: 9, custoEnvioPadrao: 24.09, custoEnvioRapido: 33.90 },
    { pesoMaximoKg: 14, custoEnvioPadrao: 31.09, custoEnvioRapido: 40.90 },
    { pesoMaximoKg: 19, custoEnvioPadrao: 38.09, custoEnvioRapido: 47.90 },
    { pesoMaximoKg: 24, custoEnvioPadrao: 45.09, custoEnvioRapido: 54.90 },
    { pesoMaximoKg: 29, custoEnvioPadrao: 52.09, custoEnvioRapido: 61.90 }
  ],
  laranja_vermelha: [
    { pesoMaximoKg: 0.3, custoEnvioPadrao: 11.36, custoEnvioRapido: 31.50 },
    { pesoMaximoKg: 0.5, custoEnvioPadrao: 12.36, custoEnvioRapido: 32.50 },
    { pesoMaximoKg: 1, custoEnvioPadrao: 14.36, custoEnvioRapido: 34.50 },
    { pesoMaximoKg: 2, custoEnvioPadrao: 17.36, custoEnvioRapido: 37.50 },
    { pesoMaximoKg: 5, custoEnvioPadrao: 20.36, custoEnvioRapido: 40.50 },
    { pesoMaximoKg: 9, custoEnvioPadrao: 26.36, custoEnvioRapido: 46.50 },
    { pesoMaximoKg: 14, custoEnvioPadrao: 33.36, custoEnvioRapido: 53.50 },
    { pesoMaximoKg: 19, custoEnvioPadrao: 40.36, custoEnvioRapido: 60.50 },
    { pesoMaximoKg: 24, custoEnvioPadrao: 47.36, custoEnvioRapido: 67.50 },
    { pesoMaximoKg: 29, custoEnvioPadrao: 54.36, custoEnvioRapido: 74.50 }
  ]
};

/**
 * Extrai dados de tabelas HTML
 */
async function extrairDeTabelas(page) {
  return await page.evaluate(() => {
    const dados = [];
    const tabelas = document.querySelectorAll('table');
    
    tabelas.forEach((tabela) => {
      // Procura por tabelas que parecem ser de preco/peso
      const textoTabela = tabela.textContent || '';
      if (!textoTabela.includes('kg') && !textoTabela.includes('R$')) return;
      
      const linhas = tabela.querySelectorAll('tr');
      
      linhas.forEach((linha, index) => {
        if (index === 0) return; // Pula cabecalho
        
        const celulas = linha.querySelectorAll('td');
        if (celulas.length >= 2) {
          const textoPeso = celulas[0].textContent?.trim() || '';
          const matchPeso = textoPeso.match(/([0-9]+[,.]?[0-9]*)/);
          const pesoMaximoKg = matchPeso ? parseFloat(matchPeso[1].replace(',', '.')) : 0;
          
          const custos = [];
          for (let i = 1; i < celulas.length; i++) {
            const textoCusto = celulas[i].textContent?.trim() || '';
            const matchCusto = textoCusto.match(/R?\$?\s*([0-9]+[,.]?[0-9]*)/);
            if (matchCusto) {
              custos.push(parseFloat(matchCusto[1].replace(',', '.')));
            }
          }
          
          if (pesoMaximoKg > 0 && custos.length >= 1) {
            dados.push({
              pesoMaximoKg,
              custoEnvioPadrao: custos[0] || 0,
              custoEnvioRapido: custos[1] || custos[0] || 0
            });
          }
        }
      });
    });

    return dados;
  });
}

/**
 * Extrai dados do texto da pagina usando regex
 */
async function extrairDoTexto(page) {
  return await page.evaluate(() => {
    const dados = [];
    const textoPagina = document.body.innerText;
    
    // Padroes para encontrar faixas de peso e precos
    const padroes = [
      /([0-9]+[,.]?[0-9]*)\s*kg[^0-9]*R\$\s*([0-9]+[,.]?[0-9]*)/gi,
      /ate\s+([0-9]+[,.]?[0-9]*)\s*kg[^0-9]*R\$\s*([0-9]+[,.]?[0-9]*)/gi
    ];
    
    const valoresEncontrados = new Set();
    
    padroes.forEach(padrao => {
      let match;
      while ((match = padrao.exec(textoPagina)) !== null) {
        const peso = parseFloat(match[1].replace(',', '.'));
        const preco = parseFloat(match[2].replace(',', '.'));
        
        const chave = `${peso}-${preco}`;
        if (peso > 0 && preco > 5 && preco < 200 && !valoresEncontrados.has(chave)) {
          valoresEncontrados.add(chave);
          dados.push({
            pesoMaximoKg: peso,
            custoEnvioPadrao: preco,
            custoEnvioRapido: preco
          });
        }
      }
    });
    
    return dados.sort((a, b) => a.pesoMaximoKg - b.pesoMaximoKg);
  });
}

/**
 * Extrai a tabela de frete de uma pagina com multiplas estrategias
 * SEM FALLBACK - avisa quando nao consegue extrair dados
 */
async function extrairTabelaFrete(browser, url, tipoReputacao) {
  const page = await browser.newPage();
  
  try {
    console.log(`Acessando: ${url}`);
    
    // Configura user agent para simular navegador real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navega para a pagina
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    // Aguarda carregamento do conteudo dinamico
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ESTRATEGIA 1: Procura por tabelas HTML
    let faixas = await extrairDeTabelas(page);
    
    // ESTRATEGIA 2: Se nao encontrou, procura no texto da pagina
    if (faixas.length === 0) {
      console.log('  -> Buscando dados no conteudo da pagina...');
      faixas = await extrairDoTexto(page);
    }
    
    // Se nao conseguiu extrair NENHUM dado, lanca erro
    if (faixas.length === 0) {
      throw new Error(`Nao foi possivel extrair dados de ${url}. O site pode ter mudado o layout ou estar bloqueando o acesso.`);
    }

    return {
      tipoReputacao,
      nomeReputacao: NOMES_REPUTACAO[tipoReputacao],
      faixas,
      dataAtualizacao: new Date().toISOString(),
      fonteUrl: url,
      fonte: 'scraping'
    };

  } finally {
    await page.close();
  }
}

/**
 * Funcao principal de execucao
 */
async function executarScraping() {
  console.log('================================');
  console.log('SCRAPER DE FRETE MERCADO LIVRE');
  console.log('================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const resultados = {};

  try {
    for (const [tipoReputacao, url] of Object.entries(URLS_MELI_FRETE)) {
      try {
        const tabela = await extrairTabelaFrete(browser, url, tipoReputacao);
        resultados[tipoReputacao] = tabela;
        
        console.log(`\n✓ ${tipoReputacao}:`);
        console.log(`  Fonte: ${tabela.fonte}`);
        console.log(`  Faixas: ${tabela.faixas.length}`);
        tabela.faixas.slice(0, 5).forEach(f => {
          console.log(`    - ${f.pesoMaximoKg}kg: R$ ${f.custoEnvioRapido.toFixed(2)}`);
        });
        if (tabela.faixas.length > 5) {
          console.log(`    ... e mais ${tabela.faixas.length - 5} faixas`);
        }
      } catch (error) {
        console.error(`\n✗ ERRO em ${tipoReputacao}:`);
        console.error(`  ${error.message}`);
        console.error(`  -> Scraping falhou! Verifique se o layout do site mudou.`);
        resultados[tipoReputacao] = {
          tipoReputacao,
          nomeReputacao: NOMES_REPUTACAO[tipoReputacao],
          faixas: [],
          dataAtualizacao: new Date().toISOString(),
          fonteUrl: url,
          fonte: 'erro',
          erro: error.message
        };
      }
    }

    // Salva resultados em JSON
    const fs = require('fs');
    const outputPath = './scraping_result.json';
    fs.writeFileSync(outputPath, JSON.stringify(resultados, null, 2));
    console.log(`\n✓ Resultados salvos em: ${outputPath}`);

  } finally {
    await browser.close();
  }

  console.log('\n================================');
  console.log('SCRAPING FINALIZADO');
  console.log('================================');
}

// Executa se for chamado diretamente
if (require.main === module) {
  executarScraping().catch(console.error);
}

module.exports = { executarScraping, extrairTabelaFrete, TABELA_FRETE_FALLBACK };
