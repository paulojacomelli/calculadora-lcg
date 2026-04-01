/**
 * Serviço de Raspagem Dinâmica de Tabelas de Frete do Mercado Livre
 * 
 * Este serviço consulta periodicamente as URLs de ajuda do Mercado Livre
 * e extrai as tabelas de custos de envio para diferentes reputações,
 * mantendo a calculadora sempre atualizada com os valores mais recentes.
 * 
 * URLs monitoradas:
 * - 40538: MercadoLíder, reputação verde ou sem reputação
 * - 40545: Reputação amarela
 * - 40547: Reputação laranja ou vermelha
 */

import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';

// URLs das páginas de ajuda do Mercado Livre com tabelas de frete
const URLS_MELI_FRETE = {
  verde_sem_reputacao: 'https://www.mercadolivre.com.br/ajuda/40538',
  amarela: 'https://www.mercadolivre.com.br/ajuda/40545',
  laranja_vermelha: 'https://www.mercadolivre.com.br/ajuda/40547'
} as const;

// Tipo de reputação suportada
export type TipoReputacao = 'verde_sem_reputacao' | 'amarela' | 'laranja_vermelha';

// Interface para os dados de frete extraídos
export interface FaixaPesoFrete {
  pesoMaximoKg: number;        // Peso máximo da faixa (ex: 0.3, 0.5, 1, 2...)
  custoEnvioPadrao: number;   // Custo do envio com frete grátis padrão
  custoEnvioRapido: number;    // Custo do envio com frete grátis e rápido
  descricao?: string;         // Descrição da faixa (opcional)
}

// Interface para a tabela completa de uma reputação
export interface TabelaFreteReputacao {
  tipoReputacao: TipoReputacao;
  nomeReputacao: string;
  faixas: FaixaPesoFrete[];
  dataAtualizacao: string;
  fonteUrl: string;
  versaoScraper: string;
}

// Interface para o documento armazenado no Firestore
export interface ScrapingLog {
  id: string;
  dataExecucao: Timestamp;
  status: 'sucesso' | 'erro' | 'parcial';
  reputacoesAtualizadas: TipoReputacao[];
  erros: string[];
  duracaoMs: number;
}

// Versão do scraper para controle de compatibilidade
const VERSAO_SCRAPER = '1.0.0';

/**
 * Realiza a raspagem das tabelas de frete do Mercado Livre
 * Esta função deve ser executada em um ambiente Node.js (Cloud Function ou script)
 * pois utiliza Puppeteer para renderizar o conteúdo dinâmico
 */
export const rasparTabelasFreteMeli = async (): Promise<ScrapingLog> => {
  const inicio = Date.now();
  const log: ScrapingLog = {
    id: `scraping_${Date.now()}`,
    dataExecucao: Timestamp.now(),
    status: 'sucesso',
    reputacoesAtualizadas: [],
    erros: [],
    duracaoMs: 0
  };

  try {
    // Importação dinâmica do Puppeteer (só funciona em Node.js, não no browser)
    const puppeteer = await import('puppeteer');
    
    // Inicia o browser em modo headless
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      // Raspa cada URL de reputação
      for (const [tipoReputacao, url] of Object.entries(URLS_MELI_FRETE)) {
        try {
          const tabela = await extrairTabelaFrete(browser, url, tipoReputacao as TipoReputacao);
          
          if (tabela && tabela.faixas.length > 0) {
            await salvarTabelaFrete(tabela);
            log.reputacoesAtualizadas.push(tipoReputacao as TipoReputacao);
          } else {
            log.erros.push(`Nenhuma faixa de peso encontrada para ${tipoReputacao}`);
          }
        } catch (error) {
          const mensagemErro = error instanceof Error ? error.message : 'Erro desconhecido';
          log.erros.push(`Erro ao raspar ${tipoReputacao}: ${mensagemErro}`);
        }
      }
    } finally {
      await browser.close();
    }

    // Define o status baseado nos erros
    if (log.erros.length > 0) {
      log.status = log.reputacoesAtualizadas.length === 0 ? 'erro' : 'parcial';
    }

  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : 'Erro ao inicializar Puppeteer';
    log.erros.push(mensagemErro);
    log.status = 'erro';
  }

  log.duracaoMs = Date.now() - inicio;
  
  // Salva o log da execução
  await salvarLogScraping(log);
  
  return log;
};

/**
 * Extrai a tabela de frete de uma página específica
 */
const extrairTabelaFrete = async (
  browser: any, 
  url: string, 
  tipoReputacao: TipoReputacao
): Promise<TabelaFreteReputacao | null> => {
  const page = await browser.newPage();
  
  try {
    // Navega para a URL com timeout de 30 segundos
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Aguarda o carregamento do conteúdo dinâmico
    await page.waitForTimeout(2000);

    // Extrai os dados da tabela usando evaluate
    const faixas = await page.evaluate(() => {
      const dados: Array<{pesoMaximoKg: number; custoEnvioPadrao: number; custoEnvioRapido: number}> = [];
      
      // Procura por tabelas no conteúdo
      const tabelas = document.querySelectorAll('table');
      
      tabelas.forEach(tabela => {
        const linhas = tabela.querySelectorAll('tr');
        
        linhas.forEach((linha, index) => {
          // Pula o cabeçalho
          if (index === 0) return;
          
          const celulas = linha.querySelectorAll('td');
          if (celulas.length >= 2) {
            // Extrai o peso da primeira célula
            const textoPeso = celulas[0].textContent?.trim() || '';
            const matchPeso = textoPeso.match(/([0-9]+[,.]?[0-9]*)/);
            const pesoMaximoKg = matchPeso ? parseFloat(matchPeso[1].replace(',', '.')) : 0;
            
            // Extrai os custos das células subsequentes
            const custos: number[] = [];
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

      // Se não encontrou tabela, tenta extrair do texto
      if (dados.length === 0) {
        const corpoPagina = document.body.innerText;
        
        // Padrões comuns de peso e preço no texto
        const padroes = [
          /([0-9.]+)\s*kg?[\s\S]*?R\$\s*([0-9.,]+)/gi,
          /at[ée]\s+([0-9.]+)\s*kg?[\s\S]*?R\$\s*([0-9.,]+)/gi
        ];
        
        padroes.forEach(padrao => {
          let match;
          while ((match = padrao.exec(corpoPagina)) !== null) {
            const peso = parseFloat(match[1].replace(',', '.'));
            const preco = parseFloat(match[2].replace(',', '.'));
            
            if (peso > 0 && preco > 0 && !dados.find(d => d.pesoMaximoKg === peso)) {
              dados.push({
                pesoMaximoKg: peso,
                custoEnvioPadrao: preco,
                custoEnvioRapido: preco
              });
            }
          }
        });
      }

      return dados;
    });

    // Mapeia os nomes das reputações
    const nomesReputacao: Record<TipoReputacao, string> = {
      verde_sem_reputacao: 'MercadoLíder, reputação verde ou sem reputação',
      amarela: 'Reputação amarela',
      laranja_vermelha: 'Reputação laranja ou vermelha'
    };

    return {
      tipoReputacao,
      nomeReputacao: nomesReputacao[tipoReputacao],
      faixas,
      dataAtualizacao: new Date().toISOString(),
      fonteUrl: url,
      versaoScraper: VERSAO_SCRAPER
    };

  } finally {
    await page.close();
  }
};

/**
 * Salva a tabela de frete no Firestore
 */
const salvarTabelaFrete = async (tabela: TabelaFreteReputacao): Promise<void> => {
  const docRef = doc(db, 'tabelas_frete_meli', tabela.tipoReputacao);
  
  await setDoc(docRef, {
    ...tabela,
    ultimaAtualizacao: Timestamp.now()
  });
};

/**
 * Salva o log da execução do scraping
 */
const salvarLogScraping = async (log: ScrapingLog): Promise<void> => {
  const docRef = doc(db, 'scraping_logs', log.id);
  await setDoc(docRef, log);
};

/**
 * Obtém a tabela de frete mais recente para uma reputação específica
 */
export const obterTabelaFrete = async (tipoReputacao: TipoReputacao): Promise<TabelaFreteReputacao | null> => {
  const docRef = doc(db, 'tabelas_frete_meli', tipoReputacao);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return snapshot.data() as TabelaFreteReputacao;
  }
  
  return null;
};

/**
 * Obtém todas as tabelas de frete disponíveis
 */
export const obterTodasTabelasFrete = async (): Promise<Record<TipoReputacao, TabelaFreteReputacao | null>> => {
  const resultado: Record<TipoReputacao, TabelaFreteReputacao | null> = {
    verde_sem_reputacao: null,
    amarela: null,
    laranja_vermelha: null
  };

  for (const tipo of Object.keys(URLS_MELI_FRETE) as TipoReputacao[]) {
    resultado[tipo] = await obterTabelaFrete(tipo);
  }

  return resultado;
};

/**
 * Obtém o último log de scraping executado
 */
export const obterUltimoScraping = async (): Promise<ScrapingLog | null> => {
  const logsRef = collection(db, 'scraping_logs');
  const q = query(logsRef, orderBy('dataExecucao', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].data() as ScrapingLog;
  }
  
  return null;
};

/**
 * Verifica se os dados do scraping estão desatualizados
 * (mais de 7 dias sem atualização)
 */
export const dadosEstaoDesatualizados = async (): Promise<boolean> => {
  const ultimoScraping = await obterUltimoScraping();
  
  if (!ultimoScraping) {
    return true;
  }
  
  const dataExecucao = ultimoScraping.dataExecucao.toMillis();
  const diasDesdeUltimaExecucao = (Date.now() - dataExecucao) / (1000 * 60 * 60 * 24);
  
  return diasDesdeUltimaExecucao > 7;
};

/**
 * Converte a tabela de frete do Firestore para o formato usado pela calculadora
 */
export const converterParaTabelaCalculadora = (
  tabela: TabelaFreteReputacao | null
): Record<string, number> => {
  if (!tabela || tabela.faixas.length === 0) {
    // Retorna a tabela padrão hardcoded se não houver dados
    return {
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
  }

  const resultado: Record<string, number> = {};
  
  tabela.faixas.forEach(faixa => {
    const chave = faixa.pesoMaximoKg.toString();
    // Usa o custo de envio rápido (frete grátis acima de R$ 79)
    resultado[chave] = faixa.custoEnvioRapido;
  });

  return resultado;
};
