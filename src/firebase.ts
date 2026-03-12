/**
 * Configuração e inicialização do Firebase
 * Projeto: calculadora-lcg
 * 
 * Serviços habilitados:
 * - Firebase Analytics: Rastreia eventos de uso da calculadora
 */

import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do projeto Firebase usando variáveis de ambiente
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Analytics (só funciona no browser/produção)
export const analytics = getAnalytics(app);

// Inicializa o Auth e o Provedor do Google
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Inicializa o Firestore com o ID específico 'default'
export const db = getFirestore(app, 'default');



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
