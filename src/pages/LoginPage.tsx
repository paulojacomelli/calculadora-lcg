import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Mail, 
    Lock, 
    LogIn, 
    UserPlus, 
    AlertCircle, 
    CheckCircle2
} from 'lucide-react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const LoginPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as any)?.from?.pathname || "/shopee";

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            navigate(from, { replace: true });
        } catch (err: any) {
            console.error("Erro na autenticação:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('E-mail ou senha incorretos.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
            } else if (err.code === 'auth/weak-password') {
                setError('A senha deve ter pelo menos 6 caracteres.');
            } else {
                setError('Ocorreu um erro ao processar sua solicitação.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
            navigate(from, { replace: true });
        } catch (err: any) {
            console.error("Erro no login Google:", err);
            setError('Falha ao entrar com Google.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Digite seu e-mail para recuperar a senha.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
            setError(null);
        } catch (err: any) {
            setError('Erro ao enviar e-mail de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div className="login-card" style={{
                width: '100%',
                maxWidth: '420px',
                backgroundColor: 'white',
                borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <div className="login-header" style={{
                    padding: '40px 40px 20px',
                    textAlign: 'center'
                }}>
                    <div className="login-logo" style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: '#ee4d2d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 4px 6px -1px rgba(238, 77, 45, 0.4)'
                        }}>
                            <Lock size={20} />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                        Acesso Restrito
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Calculadora Exclusiva para Parceiros LCG
                    </p>
                </div>

                <div className="login-content" style={{ padding: '0 40px 40px' }}>
                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fee2e2',
                            borderRadius: '12px',
                            color: '#b91c1c',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '20px'
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {resetSent && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #dcfce7',
                            borderRadius: '12px',
                            color: '#15803d',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '20px'
                        }}>
                            <CheckCircle2 size={16} />
                            <span>E-mail de recuperação enviado!</span>
                        </div>
                    )}

                    <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="input-group">
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>E-mail</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px 12px 42px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                                <span>Senha</span>
                                {isLogin && (
                                    <button 
                                        type="button" 
                                        onClick={handleForgotPassword}
                                        style={{ background: 'none', border: 'none', color: '#ee4d2d', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                                    >
                                        Esqueci a senha
                                    </button>
                                )}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px 12px 42px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem',
                                        transition: 'all 0.2s',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '10px',
                                padding: '14px',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: '#ee4d2d',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px -1px rgba(238, 77, 45, 0.4)',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? (
                                <div style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                            ) : (
                                <>
                                    {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                                    {isLogin ? 'Entrar Agora' : 'Criar Minha Conta'}
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '24px 0'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>OU</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#1e293b',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            <path fill="none" d="M0 0h48v48H0z"/>
                        </svg>
                        Entrar com Google
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                            {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                style={{
                                    marginLeft: '6px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#ee4d2d',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                {isLogin ? 'Cadastre-se' : 'Faça Login'}
                            </button>
                        </p>
                    </div>
                </div>

            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .login-card input:focus {
                    border-color: #ee4d2d !important;
                    box-shadow: 0 0 0 4px rgba(238, 77, 45, 0.1) !important;
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
