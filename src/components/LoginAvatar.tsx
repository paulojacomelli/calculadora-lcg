import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, ChevronDown } from 'lucide-react';

/**
 * Componente de Avatar e Autenticação Google
 * Gerencia o login/logout e exibe o perfil do usuário na barra de navegação.
 */
const LoginAvatar: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Erro ao fazer login:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setIsMenuOpen(false);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };

    if (!user) {
        return (
            <button className="login-btn" onClick={handleLogin}>
                <LogIn size={18} />
                <span>Entrar</span>
            </button>
        );
    }

    return (
        <div className="user-profile-container">
            <div className="user-avatar-trigger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {user.photoURL ? (
                    <img 
                        src={user.photoURL} 
                        alt={user.displayName || "Avatar"} 
                        className="user-photo" 
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="user-photo-placeholder"><UserIcon size={18} /></div>
                )}
                <div className="user-info-brief">
                    <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                    <ChevronDown size={14} className={`chevron ${isMenuOpen ? 'open' : ''}`} />
                </div>
            </div>

            {isMenuOpen && (
                <>
                    <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="user-dropdown">
                        <div className="dropdown-header">
                            <span className="full-name">{user.displayName}</span>
                            <span className="user-email">{user.email}</span>
                        </div>
                        <button className="logout-btn" onClick={handleLogout}>
                            <LogOut size={16} />
                            <span>Sair da conta</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default LoginAvatar;
