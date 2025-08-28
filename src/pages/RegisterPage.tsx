import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      await register(email, password, displayName);
      nav('/pos');
    } catch (e: any) {
      setErr(e?.message || 'Error al registrar');
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <form onSubmit={onSubmit} style={{ background: 'white', padding: 24, borderRadius: 8, width: 360, display: 'grid', gap: 12 }}>
        <h2>Registro</h2>
        {err && <div style={{ color: 'white', background: '#e74c3c', padding: 8, borderRadius: 6 }}>{err}</div>}
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Nombre para mostrar" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn" type="submit">Crear cuenta</button>
        <div style={{ fontSize: 14 }}>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></div>
      </form>
    </div>
  );
};

export default RegisterPage;


