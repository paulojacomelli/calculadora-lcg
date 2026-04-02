import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * Níveis de Usuário:
 * 1 - Admin (ex: celio, paulo, mkt.lcg): Acesso total.
 * 2 - Usuário (ex: lcgeletro): Uso e visualização, sem edição do catálogo.
 * 3 - Restrito (ex: marketplacelcg): Uso e visualização, sem edição e sem configurações avançadas.
 */
export type UserLevel = 1 | 2 | 3;

// Mapeamento inicial fornecido pelo usuário
const INITIAL_LEVEL_MAPPING: Record<string, UserLevel> = {
  'celioroberto41@gmail.com': 1,
  'paulo.jacomelli2001@gmail.com': 1,
  'mkt.lcgeletro@gmail.com': 1,
  'lcgeletro@gmail.com': 2,
  'marketplacelcg@gmail.com': 3
};

interface AuthContextType {
  user: User | null;
  userLevel: UserLevel;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDoc = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDoc);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserLevel(data.level as UserLevel || 3);
          } else {
            // Verifica se o e-mail está no mapeamento inicial
            const email = currentUser.email?.toLowerCase() || '';
            const assignedLevel: UserLevel = INITIAL_LEVEL_MAPPING[email] || 3;

            await setDoc(userDoc, {
              email: email,
              level: assignedLevel,
              updatedAt: new Date().toISOString()
            });
            setUserLevel(assignedLevel);
          }
        } catch (error) {
          console.error("Erro ao carregar nível do usuário:", error);
          setUserLevel(3);
        }
      } else {
        setUserLevel(3);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userLevel, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
