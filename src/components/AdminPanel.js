import React, { useState, useEffect } from 'react';
import {
  getUsers, createUser, updateUser, deleteUser,
  sendInvite, getLogs, loadCodigosFirestore
} from '../services/firestore';

const S = {
  card:  { background:'#0d1726', borderRadius:14, padding:'28px 32px', border:'1px solid rgba(255,255,255,0.07)', marginBottom:24 },
  inp:   { width:'100%', padding:'11px 14px', fontSize:12, background:'#111e33', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8edf5', outline:'none', boxSizing:'border-box' },
  btn:   { padding:'10px 22px', fontSize:12, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer' },
  th:    { padding:'10px 12px', fontSize:11, color:'#4a5a70', fontWeight:600, textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.06)', textTransform:'uppercase', letterSpacing:'0.06em' },
  td:    { padding:'10px 12px', fontSize:12, color:'#e8edf5', borderBottom:'1px solid rgba(255,255,255,0.04)' },
};

const badge = (role) => ({
  display:'inline-block', padding:'2px 10px', borderRadius:20, fontSize:10, fontWeight:700,
  background: role==='admin' ? 'rgba(251,191,36,0.15)' : 'rgba(42,127,255,0.12)',
  color:       role==='admin' ? '#fbbf24'               : '#60a5fa',
  border:      `1px solid ${role==='admin' ? 'rgba(251,191,36,0.3)' : 'rgba(42,127,255,0.25)'}`,
});

const fmtDate = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';
const fmtBRL  = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function AdminPanel({ currentUser }) {
  const [tab,      setTab]      = useState('users');
  const [users,    setUsers]    = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ nome:'', email:'', password:'', role:'operator' });
  const [logFilter,setLogFilter]= useState('');

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if(tab==='logs') fetchLogs(); }, [tab]);

  async function fetchUsers() {
    setBusy(true);
    try { setUsers(await getUsers()); }
    catch(e) { setMsg('Erro ao carregar usuários: ' + e.message); }
    setBusy(false);
  }

  async function fetchLogs() {
    setBusy(true);
    try { setLogs(await getLogs()); }
    catch(e) { setMsg('Erro ao carregar logs'); }
    setBusy(false);
  }

  async function handleCreateUser(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      await createUser(form);
      setMsg('✓ Colaborador criado com sucesso!');
      setShowForm(false);
      setForm({ nome:'', email:'', password:'', role:'operator' });
      await fetchUsers();
    } catch(err) { setMsg('Erro: ' + err.message); }
    setBusy(false);
  }

  async function handleToggleRole(user) {
    const newRole = user.role === 'admin' ? 'operator' : 'admin';
    if (!window.confirm(`Alterar ${user.nome} para ${newRole}?`)) return;
    try {
      await updateUser(user.uid, { role: newRole });
      setMsg(`✓ Role de ${user.nome} atualizado`);
      await fetchUsers();
    } catch(e) { setMsg('Erro: ' + e.message); }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Remover ${user.nome} (${user.email})? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUser(user.uid);
      setMsg(`✓ ${user.nome} removido`);
      await fetchUsers();
    } catch(e) { setMsg('Erro: ' + e.message); }
  }

  const filteredLogs = logs.filter(l =>
    !logFilter ||
    l.userName?.toLowerCase().includes(logFilter.toLowerCase()) ||
    l.company?.toLowerCase().includes(logFilter.toLowerCase()) ||
    l.competencia?.includes(logFilter)
  );

  const tabs = [
    { id:'users',   label:'👥 Colaboradores' },
    { id:'logs',    label:'📋 Logs de Processamento' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'#fbbf24' }}>⚙️ Painel Administrativo</div>
        <div style={{ fontSize:12, color:'#6b7a90', marginTop:4 }}>Visível apenas para administradores · {currentUser?.email}</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...S.btn, background: tab===t.id ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', color: tab===t.id ? '#fbbf24' : '#6b7a90', border: `1px solid ${tab===t.id ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:12, background: msg.startsWith('✓') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: msg.startsWith('✓') ? '#4ade80' : '#f87171', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg}
        </div>
      )}

      {/* ── TAB: USUÁRIOS ── */}
      {tab === 'users' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:'#e8edf5' }}>Colaboradores cadastrados</div>
              <div style={{ fontSize:11, color:'#6b7a90', marginTop:2 }}>{users.length} usuário(s) no sistema</div>
            </div>
            <button onClick={() => setShowForm(!showForm)} style={{ ...S.btn, background:'rgba(42,127,255,0.15)', color:'#60a5fa', border:'1px solid rgba(42,127,255,0.3)' }}>
              {showForm ? '✕ Cancelar' : '+ Novo Colaborador'}
            </button>
          </div>

          {/* Formulário de criação */}
          {showForm && (
            <form onSubmit={handleCreateUser} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'20px', marginBottom:20, border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#e8edf5', marginBottom:16 }}>Novo Colaborador</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'#6b7a90', display:'block', marginBottom:6 }}>Nome completo</label>
                  <input style={S.inp} value={form.nome} onChange={e => setForm({...form, nome:e.target.value})} required placeholder="Maria Silva"/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#6b7a90', display:'block', marginBottom:6 }}>E-mail</label>
                  <input style={S.inp} type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required placeholder="maria@empresa.com"/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#6b7a90', display:'block', marginBottom:6 }}>Senha inicial</label>
                  <input style={S.inp} type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} required placeholder="Mínimo 6 caracteres" minLength={6}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#6b7a90', display:'block', marginBottom:6 }}>Perfil</label>
                  <select style={{ ...S.inp }} value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={busy} style={{ ...S.btn, background:'#1d4ed8', color:'#fff' }}>
                {busy ? 'Criando...' : 'Criar Colaborador'}
              </button>
            </form>
          )}

          {/* Tabela de usuários */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Nome','E-mail','Perfil','Criado em','Último acesso','Ações'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid} style={{ opacity: u.active===false ? 0.5 : 1 }}>
                    <td style={S.td}><span style={{ fontWeight:600 }}>{u.nome}</span></td>
                    <td style={{ ...S.td, color:'#6b7a90', fontSize:11 }}>{u.email}</td>
                    <td style={S.td}><span style={badge(u.role)}>{u.role}</span></td>
                    <td style={{ ...S.td, color:'#6b7a90', fontSize:11 }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ ...S.td, color:'#6b7a90', fontSize:11 }}>{fmtDate(u.lastLogin)}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:6 }}>
                        {u.uid !== currentUser?.uid && (
                          <>
                            <button onClick={() => handleToggleRole(u)} style={{ ...S.btn, padding:'5px 12px', fontSize:10, background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)' }}>
                              {u.role==='admin' ? '→ Operador' : '→ Admin'}
                            </button>
                            <button onClick={() => handleDelete(u)} style={{ ...S.btn, padding:'5px 12px', fontSize:10, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' }}>
                              Remover
                            </button>
                          </>
                        )}
                        {u.uid === currentUser?.uid && (
                          <span style={{ fontSize:10, color:'#4a5a70' }}>você</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !busy && (
                  <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#4a5a70', padding:32 }}>Nenhum colaborador cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: LOGS ── */}
      {tab === 'logs' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:'#e8edf5' }}>Histórico de Processamentos</div>
              <div style={{ fontSize:11, color:'#6b7a90', marginTop:2 }}>{logs.length} registro(s)</div>
            </div>
            <input placeholder="Filtrar por operador, empresa ou competência..." value={logFilter} onChange={e => setLogFilter(e.target.value)} style={{ ...S.inp, width:320, fontSize:11 }}/>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Operador','Empresa','Competência','Funcionários','Total Bruto','Arquivos','Data'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td style={S.td}><div style={{ fontWeight:600 }}>{l.userName}</div><div style={{ fontSize:10, color:'#4a5a70' }}>{l.userEmail}</div></td>
                    <td style={{ ...S.td, fontSize:11 }}>{l.company || '—'}</td>
                    <td style={{ ...S.td, fontSize:11, color:'#fbbf24' }}>{l.competencia || '—'}</td>
                    <td style={{ ...S.td, textAlign:'center' }}>{l.totalFuncionarios}</td>
                    <td style={{ ...S.td, color:'#4ade80', textAlign:'right' }}>{fmtBRL(l.totalBruto)}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {(l.filesGenerated||[]).map(f => (
                          <span key={f} style={{ fontSize:9, padding:'2px 6px', background:'rgba(42,127,255,0.12)', color:'#60a5fa', borderRadius:4 }}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...S.td, fontSize:10, color:'#6b7a90' }}>{fmtDate(l.timestamp)}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && !busy && (
                  <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#4a5a70', padding:32 }}>Nenhum log encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
