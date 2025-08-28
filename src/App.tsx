import { POSPage } from './pages';
import CajaPage from './pages/CajaPage';
import VentasPage from './pages/VentasPage';
import CEPage from './pages/CEPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import './components/pos/pos.css';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import React from 'react';
import { useAuth } from './context/AuthContext';
import { useIsAdmin } from './hooks/useIsAdmin';

const Layout: React.FC = ({ children }: any) => {
  const { user, logout } = useAuth();
  const { isAdmin } = useIsAdmin();
  const displayName = user?.displayName || user?.email || 'Usuario';
  return (
    <div className="pos-page">
      <header className="pos-header">
        <div className="header-title">Sistema POS</div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          {user ? (
            <>
              <Link to="/pos" style={{ color: 'white' }}>POS</Link>
              <Link to="/caja" style={{ color: 'white' }}>Gestión de Caja</Link>
              <Link to="/ventas" style={{ color: 'white' }}>Historial de Ventas</Link>
              <Link to="/ce" style={{ color: 'white' }}>Comprobantes Electrónicos</Link>
              {isAdmin && <Link to="/admin" style={{ color: 'white', fontWeight: 700 }}>Admin</Link>}
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'white' }}>Login</Link>
              <Link to="/register" style={{ color: 'white' }}>Registro</Link>
            </>
          )}
        </nav>
        <div className="header-user">
          {user ? (
            <>
              <span>{displayName}</span>
              <button onClick={logout} className="signout-btn">Salir</button>
            </>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const StartRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? '/pos' : '/login'} replace />;
};


function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<StartRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
          <Route path="/caja" element={<ProtectedRoute><CajaPage /></ProtectedRoute>} />
          <Route path="/ventas" element={<ProtectedRoute><VentasPage /></ProtectedRoute>} />
          <Route path="/ce" element={<ProtectedRoute><CEPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
