import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import ShopeePage from './pages/ShopeePage';
import MeliPage from './pages/MeliPage';
import { Calculator, ShoppingBag } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();

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
            <Route path="/shopee" element={<ShopeePage />} />
            <Route path="/meli" element={<MeliPage />} />
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
