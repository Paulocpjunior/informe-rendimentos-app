import React, { useState } from 'react';
import { useAuth } from '../config/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [load, setLoad] = useState(false);
  const [isRegistro, setIsRegistro] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro(''); setLoad(true);
    try {
      if (isRegistro) {
        await register(email, senha);
      } else {
        await login(email, senha);
      }
    } catch (err) {
      const msg = isRegistro ? 'Falha no cadastro: ' : 'Falha no login: ';
      setErro(msg + err.message);
      setLoad(false);
    }
  };

  const toggleMode = () => {
    setIsRegistro(!isRegistro);
    setErro('');
  };

  const darkBg = '#0d1117';
  const cardBg = '#161b22';
  const inputBg = '#0d1117';
  const textWhite = '#e6edf3';
  const primaryBlue = '#2f81f7';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkBg, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: cardBg, padding: 40, borderRadius: 12, width: '100%', maxWidth: 400, border: '1px solid #30363d', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: primaryBlue, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff' }}>IR</div>
          <h1 style={{ color: textWhite, fontSize: 24, margin: '0 0 8px' }}>Auditor de Informes</h1>
          <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>EFD-REINF · R-4010 · IN RFB 2.060</p>
        </div>
        
        {erro && <div style={{ background: 'rgba(248,81,73,0.1)', color: '#ff7b72', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 24, border: '1px solid rgba(248,81,73,0.4)' }}>{erro}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: textWhite, marginBottom: 8, fontWeight: 500 }}>Email Profissional</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: inputBg, border: '1px solid #30363d', borderRadius: 6, color: textWhite, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: textWhite, marginBottom: 8, fontWeight: 500 }}>Senha de Acesso</label>
            <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: inputBg, border: '1px solid #30363d', borderRadius: 6, color: textWhite, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={load} style={{ marginTop: 8, background: primaryBlue, color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: load ? 'not-allowed' : 'pointer' }}>
            {load ? (isRegistro ? 'Criando conta...' : 'Acessando sistema...') : (isRegistro ? 'Criar Conta' : 'Entrar no Sistema')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 24, borderTop: '1px solid #30363d' }}>
          <p style={{ color: '#8b949e', fontSize: 13, margin: 0 }}>
            {isRegistro ? 'Já possui uma conta?' : 'Ainda não tem conta?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              style={{ background: 'none', border: 'none', color: primaryBlue, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, textDecoration: 'none' }}
            >
              {isRegistro ? 'Fazer login' : 'Criar conta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
