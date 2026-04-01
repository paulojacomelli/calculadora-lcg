import { 
  doc, 
  getDoc, 
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Product {
  id: string;
  sku: string;
  descricao: string;
  custoCDP: number;
  impostosIMP: number;
  despesaFixaDF: number;
  outrasDespesasOD: number;
  adsADS: number;
  rebateCR: number;
}

/**
 * Salva o catálogo completo de um estoque de forma global
 */
export const saveUserCatalog = async (_userId: string, warehouse: 'SP' | 'SC', products: Product[]) => {
  try {
    // Caminho global na raiz do banco: catalog/{warehouse}
    const catalogRef = doc(db, 'catalog', warehouse);
    await setDoc(catalogRef, { 
      products,
      updatedAt: new Date().toISOString(),
      warehouse 
    });
    console.log(`Sucesso: Catálogo ${warehouse} salvo em /catalog/${warehouse}`);
    return { success: true };
  } catch (error) {
    console.error(`Erro ao salvar catálogo ${warehouse}:`, error);
    throw error;
  }
};

/**
 * Carrega o catálogo de um estoque de forma global
 */
export const getUserCatalog = async (_userId: string, warehouse: 'SP' | 'SC'): Promise<Product[]> => {
  try {
    // Caminho global na raiz do banco: catalog/{warehouse}
    const catalogRef = doc(db, 'catalog', warehouse);
    const docSnap = await getDoc(catalogRef);
    
    if (docSnap.exists()) {
      return docSnap.data().products as Product[];
    }
    
    return [];
  } catch (error) {
    console.error(`Erro ao carregar catálogo ${warehouse}:`, error);
    throw error;
  }
};
