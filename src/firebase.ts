/**
 * Configuração e inicialização do Firebase
 * Projeto: calculadora-lcg
 * 
 * Serviços habilitados:
 * - Firebase Analytics: Rastreia eventos de uso da calculadora
 */

import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";

// Configuração do projeto Firebase fornecida pelo console
const firebaseConfig = {
    apiKey: "AIzaSyDLqOnSglbMBqhvLxc5fbj_xKxnsh0EbDE",
    authDomain: "calculadora-lcg.firebaseapp.com",
    projectId: "calculadora-lcg",
    storageBucket: "calculadora-lcg.firebasestorage.app",
    messagingSenderId: "14715450297",
    appId: "1:14715450297:web:12c77272440021b90fbc68",
    measurementId: "G-MLETHRDW56"
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Analytics (só funciona no browser/produção)
export const analytics = getAnalytics(app);

/**
 * Registra um evento de cálculo no Analytics
 * @param precoVenda - Preço de venda informado pelo usuário
 * @param margemContribuicao - Margem calculada (%)
 * @param tipoVendedor - CPF ou CNPJ
 */
export const logCalculo = (
    precoVenda: number,
    margemContribuicao: number,
    tipoVendedor: string
) => {
    logEvent(analytics, "calcular_margem", {
        preco_venda: precoVenda,
        margem_porcentagem: Math.round(margemContribuicao * 10) / 10,
        tipo_vendedor: tipoVendedor,
    });
};

export default app;
