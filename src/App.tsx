import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import ShopeePage from './pages/ShopeePage';
import ShopeeLotePage from './pages/ShopeeLotePage';
import CatalogPage from './pages/CatalogPage';
import MeliPage from './pages/MeliPage';
import { Calculator, ShoppingBag, Database } from 'lucide-react';
import LoginAvatar from './components/LoginAvatar';
import LoginPage from './pages/LoginPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #ee4d2d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const Navigation: React.FC = () => {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link
          to="/shopee"
          className={`nav-item ${location.pathname.startsWith('/shopee') ? 'active' : ''}`}
        >
          <Calculator size={18} />
          <span>Shopee</span>
        </Link>
        <Link
          to="/meli"
          className={`nav-item ${location.pathname.startsWith('/meli') ? 'active' : ''}`}
        >
          <ShoppingBag size={18} />
          <span>Mercado Livre</span>
        </Link>
        {user && (
          <Link
            to="/shopee/catalogo"
            className={`nav-item ${location.pathname === '/shopee/catalogo' ? 'active' : ''}`}
          >
            <Database size={18} />
            <span>Catálogo</span>
          </Link>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <LoginAvatar />
        </div>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-shell">
        <Navigation />
        <main className="content-area">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/shopee" element={<ProtectedRoute><ShopeePage /></ProtectedRoute>} />
            <Route path="/shopee/lote" element={<ProtectedRoute><ShopeeLotePage /></ProtectedRoute>} />
            <Route path="/shopee/catalogo" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />
            <Route path="/meli" element={<ProtectedRoute><MeliPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/shopee" replace />} />
          </Routes>
        </main>
        <footer className="main-footer">
          <div className="container">
            <div className="footer-content">
              <div className="footer-brand">
                <img src="/lcg-logo.svg" alt="LCG Logo" className="footer-logo" />
              </div>

              <div className="footer-nav">
                <Link to="/shopee" className="footer-link">Calculadora Shopee</Link>
                <span className="footer-divider">|</span>
                <Link to="/meli" className="footer-link">Calculadora Mercado Livre</Link>
              </div>

              <p className="footer-copyright">
                © {new Date().getFullYear()} Calculadora LCG. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
