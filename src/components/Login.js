import React, { useState } from 'react';
import { useAuth } from '../config/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState('login');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      if (modo === 'login') {
        await login(email, senha);
      } else {
        await register(email, senha);
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/email-already-in-use': 'E-mail já cadastrado',
        'auth/weak-password': 'Senha deve ter no mínimo 6 caracteres',
        'auth/invalid-email': 'E-mail inválido',
        'auth/invalid-credential': 'Credenciais inválidas'
      };
      setErro(msgs[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #0d1b2a, #1b2a4a, #1a3a5c)', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: 380, padding: 32, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, backdropFilter: 'blur(20px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #2a7fff, #1a5cbf)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>IR</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>Informe de Rendimentos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7a8fa6' }}>SP Assessoria Contábil</p>
        </div>

        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {['login', 'cadastro'].map((m) => (
            <button key={m} onClick={() => { setModo(m); setErro(''); }}
              style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: modo === m ? 'rgba(42,127,255,0.15)' : 'transparent', color: modo === m ? '#fff' : '#7a8fa6' }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11.5, color: '#7a8fa6', marginBottom: 4 }}>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11.5, color: '#7a8fa6', marginBottom: 4 }}>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {erro && <div style={{ padding: '10px 14px', background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#ff6b6b' }}>{erro}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg, #2a7fff, #1a5cbf)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            {loading ? '⏳ Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
