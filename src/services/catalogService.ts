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
 * Salva o catálogo completo de um estoque para um usuário específico
 */
export const saveUserCatalog = async (userId: string, warehouse: 'SP' | 'SC', products: Product[]) => {
  try {
    const catalogRef = doc(db, 'users', userId, 'catalog', warehouse);
    await setDoc(catalogRef, { 
      products,
      updatedAt: new Date().toISOString(),
      warehouse 
    });
    return { success: true };
  } catch (error) {
    console.error(`Erro ao salvar catálogo ${warehouse}:`, error);
    throw error;
  }
};

/**
 * Carrega o catálogo de um estoque para um usuário específico
 */
export const getUserCatalog = async (userId: string, warehouse: 'SP' | 'SC'): Promise<Product[]> => {
  try {
    const catalogRef = doc(db, 'users', userId, 'catalog', warehouse);
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
