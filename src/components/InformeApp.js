import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../config/AuthContext';
import { ensureUserProfile, getCurrentUserProfile } from '../services/firestore';
import AdminPanel from './AdminPanel';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  validarCNPJ, validarCPF, fmtMoeda, fmtCPF, fmtCNPJ, calcularIRRF,
  MESES, TIPOS_RENDIMENTO, CNPJ_DB, parseExcel, gerarPDF, downloadPDF, fetchCNPJ, gerarDARF, baixarModeloExcel, exportToCSV,
  parseIgrejaFolha, exportFolhaValores, exportFolhaPonto, loadCodigosSalvos, saveCodigosSalvos, importarCodigosDeXlsx, downloadLayoutExcel
} from '../utils/informeUtils';

export default function InformeApp() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [tipoRendimento, setTipoRendimento] = useState(''); // Começar vazio para forçar seleção
  const [filtroCnpj, setFiltroCnpj] = useState('all'); // Filtro para resultados e DARF
  const [cnpj, setCnpj] = useState('');
  const [cData, setCData] = useState(null);
  const [cVal, setCVal] = useState(null);
  const [cErr, setCErr] = useState('');
  const [fp, setFp] = useState({ cnpj: '', nome: '', exercicio: '2026', anoCalendario: '2025', responsavel: '' });
  const [bens, setBens] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState('');
  const fR = useRef(null);

  // ── PERFIL DO USUÁRIO ────────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (user) {
      ensureUserProfile(user).then(profile => setUserProfile(profile)).catch(console.error);
    }
  }, [user]);

  // ── ESTADO FOLHA IOB ────────────────────────────────────────────────────────
  const [folhaEmps, setFolhaEmps]       = useState([]);   // funcionários do xlsx
  const [folhaCods, setFolhaCods]       = useState(() => loadCodigosSalvos());
  const [folhaEvento, setFolhaEvento]   = useState('1105');
  const [folhaComp, setFolhaComp]       = useState('');   // ex: "03/2026"
  const [folhaBusy, setFolhaBusy]       = useState(false);
  const [folhaMsg, setFolhaMsg]         = useState('');
  const [folhaDrag, setFolhaDrag]       = useState(false);
  const fRFolha    = useRef(null);
  const fRCodigos  = useRef(null);

  // RESET DE SEGURANÇA NO MOUNT
  React.useEffect(() => {
    setStep(1);
    setTipoRendimento('');
    setFp({ cnpj: '', nome: '', exercicio: '2026', anoCalendario: '2025', responsavel: '' });
  }, []);

  const mask = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.slice(0, 2) + '.' + v.slice(2, 5) + '.' + v.slice(5, 8) + '/' + v.slice(8, 12) + '-' + v.slice(12);
    else if (v.length > 8) v = v.slice(0, 2) + '.' + v.slice(2, 5) + '.' + v.slice(5, 8) + '/' + v.slice(8);
    else if (v.length > 5) v = v.slice(0, 2) + '.' + v.slice(2, 5) + '.' + v.slice(5);
    else if (v.length > 2) v = v.slice(0, 2) + '.' + v.slice(2);
    setCnpj(v); setCErr(''); setCData(null); setCVal(null);
    const dig = v.replace(/\D/g, '');
    if (dig.length === 14) {
      const r = validarCNPJ(dig); setCVal(r);
      if (r.valid) {
        const dbEntry = CNPJ_DB[dig];
        if (dbEntry) {
          setCData(dbEntry);
          setFp(p => ({ ...p, cnpj: dig, nome: dbEntry.razao_social }));
        } else {
          setCErr('Buscando dados na Receita Federal...');
          fetchCNPJ(dig).then(apiData => {
            if (apiData) {
              setCErr('');
              setCData(apiData);
              setCVal(prev => prev ? { ...prev, tipo: apiData.tipo } : null);
              setFp(p => ({ ...p, cnpj: dig, nome: apiData.razao_social }));
            } else {
              setCErr('CNPJ não encontrado na base de dados pública.');
              setCData(null);
              setFp(p => ({ ...p, cnpj: dig }));
            }
          });
        }
      } else {
        setCErr(r.error);
      }
    }
  };

  const processFile = async (f) => {
    if (!f) return;
    setFile(f); setBusy(true); setMsg('Lendo arquivo e processando abas...');
    try {
      const r = await parseExcel(f);
      const newBens = [...r.beneficiarios];

      if (r.cnpjFonte && !fp.cnpj) {
        setFp(p => ({ ...p, cnpj: r.cnpjFonte }));
        setCnpj(fmtCNPJ(r.cnpjFonte));
        const v = validarCNPJ(r.cnpjFonte); setCVal(v);
        if (v.valid) {
          const dbEntry = CNPJ_DB[r.cnpjFonte]; setCData(dbEntry || null);
          if (dbEntry) setFp(p => ({ ...p, cnpj: r.cnpjFonte, nome: dbEntry.razao_social }));
        }
      }

      setMsg('Buscando dados das fontes pagadoras...');
      const cacheNomes = {};
      if (fp.cnpj && fp.nome) cacheNomes[fp.cnpj] = fp.nome;

      for (let c of r.cnpjsUnicos) {
        if (!cacheNomes[c]) {
          if (CNPJ_DB[c]) {
            cacheNomes[c] = CNPJ_DB[c].razao_social;
          } else {
            const v = validarCNPJ(c);
            if (v.valid) {
              const apiData = await fetchCNPJ(c);
              if (apiData) cacheNomes[c] = apiData.razao_social;
              else cacheNomes[c] = 'Razão Social Não Encontrada';
            } else {
              cacheNomes[c] = 'CNPJ Inválido';
            }
          }
        }
      }

      newBens.forEach(b => {
        b.nomeFonte = cacheNomes[b.cnpjFonte] || 'Fonte Pagadora Desconhecida';
      });

      setBens(newBens);

      const multiStr = r.cnpjsUnicos.length > 1 ? ` de ${r.cnpjsUnicos.length} fontes (abas)` : '';
      const successMsg = `✓ ${r.beneficiarios.length} beneficiário(s) extraídos${multiStr} com sucesso.`;

      // SEGURANÇA MÁXIMA: Se não tem tipo, VOLTA pro 2. Se tem, vai pro 4.
      if (tipoRendimento) {
        setMsg(successMsg);
        setStep(4);
      } else {
        setMsg(`${successMsg} Agora selecione o Tipo de Rendimento abaixo.`);
        setStep(2);
      }
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setBusy(false); }
  };

  const gen = async (idx) => {
    setBusy(true); setMsg('');
    try {
      const doc = await gerarPDF(fp, bens, idx, tipoRendimento);
      const nm = idx != null
        ? `INFORME_${bens[idx].cpf}_${bens[idx].nome.replace(/\s/g, '_').slice(0, 25)}_${fp.anoCalendario}.pdf`
        : `INFORMES_CONSOLIDADO_${fp.anoCalendario}.pdf`;
      downloadPDF(doc, nm);
      setMsg(`✓ PDF gerado: ${nm}`);

      try {
        await addDoc(collection(db, 'informes_log'), {
          userId: user.uid,
          tipo: idx != null ? 'individual' : 'consolidado',
          cnpjFonte: fp.cnpj,
          nomeFonte: fp.nome,
          beneficiario: idx != null ? bens[idx].nome : 'CONSOLIDADO',
          anoCalendario: fp.anoCalendario,
          totalBeneficiarios: bens.length,
          createdAt: serverTimestamp()
        });
      } catch (e) { /* silencioso */ }
    } catch (err) { alert('Erro PDF: ' + err.message); }
    finally { setBusy(false); }
  };

  // ESTILOS PREMIUM - SP CONTÁBIL
  const darkNav = '#0b121f';
  const mainBg = '#0d1b2a';
  const cardBg = '#1b2a4a';
  const inputBg = '#141e33';
  const textWhite = '#ffffff';
  const textMuted = '#8995a8';
  const primaryBlue = '#2a7fff';
  const borderCol = 'rgba(255,255,255,0.08)';

  const S = {
    card: { background: cardBg, borderRadius: 20, padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: `1px solid ${borderCol}`, position: 'relative' },
    inp: { width: '100%', padding: '14px 18px', fontSize: 13, background: inputBg, border: `1px solid ${borderCol}`, borderRadius: 8, color: textWhite, outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s' },
    bp: { padding: '14px 40px', fontSize: 13, fontWeight: 600, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
    bs: { padding: '8px 20px', fontSize: 12, background: 'transparent', color: textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
    lb: { display: 'block', fontSize: 12, color: textMuted, marginBottom: 8, fontWeight: 500 }
  };

  // Validação de navegação: impede pular passos para frente sem preenchimento
  const canNavigate = (target) => {
    if (target === 7) return true; // Folha IOB sempre acessível
    if (target === 8) return userProfile?.role === 'admin'; // Admin apenas
    if (target < step) return true;
    if (target === 1) return true;
    if (target === 2) return fp.nome && fp.cnpj;
    if (target === 3) return fp.nome && fp.cnpj && tipoRendimento;
    if (target === 4) return bens.length > 0 && tipoRendimento;
    if (target === 5) return bens.length > 0 && tipoRendimento;
    return false;
  };

  const StepIndicator = ({ current, total, onStepClick, canNavigate }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 60 }}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        const reachable = canNavigate(n);
        return (
          <React.Fragment key={n}>
            <div
              onClick={() => reachable && onStepClick(n)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: active ? '#1d4ed8' : (done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'),
                border: `1px solid ${active ? '#1d4ed8' : (done ? '#4ade80' : borderCol)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: reachable ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s',
                position: 'relative'
              }}>
              {done ? <span style={{ color: '#4ade80', fontSize: 16 }}>✓</span> :
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : textMuted }}>{n}</span>}

              {/* Tooltip opcional ou Label */}
              <span style={{ position: 'absolute', top: 40, fontSize: 10, whiteSpace: 'nowrap', color: active ? textWhite : textMuted, fontWeight: active ? 600 : 400, opacity: active || done ? 1 : 0.5 }}>
                {n === 1 ? 'Fonte' : n === 2 ? 'Tipo' : n === 3 ? 'Import' : n === 4 ? 'PDFs' : 'DARF'}
              </span>
            </div>
            {n < total && <div style={{ width: 60, height: 1, background: done ? '#4ade80' : borderCol, opacity: 0.3 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:"'DM Sans',-apple-system,sans-serif", background:'#080f1c', color:'#e8edf5' }}>
      <aside style={{ width:220, minHeight:'100vh', background:'#0b1220', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, bottom:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'22px 18px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#0a1525', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}><img src='/logo.png' alt='SP' style={{width:36,height:36,objectFit:'contain'}}/></div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#e8edf5', letterSpacing:'-0.3px' }}>SP Contábil</div>
            <div style={{ fontSize:10, fontWeight:600, color:'#4a5a70', letterSpacing:'0.06em', textTransform:'uppercase' }}>Gestão Fiscal</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 10px', padding:'12px 14px', background:'#111e33', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#2a7fff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{user.email?.slice(0,2).toUpperCase()}</div>
          <div style={{ overflow:'hidden' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#e8edf5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120 }}>{user.email?.split('@')[0]}</div>
            <div style={{ fontSize:10.5, color: userProfile?.role==='admin' ? '#fbbf24' : '#4a5a70' }}>{userProfile?.role==='admin' ? 'Administrador' : 'Operador'}</div>
          </div>
        </div>
        <nav style={{ flex:1, padding:'6px 10px', display:'flex', flexDirection:'column', gap:2 }}>
          {[{num:1,icon:'\ud83c\udfe2',label:'Fonte Pagadora'},{num:2,icon:'\ud83d\udccb',label:'Tipo'},{num:3,icon:'\ud83d\udcca',label:'Import'},{num:4,icon:'\ud83d\udc65',label:'PDFs'},{num:5,icon:'\ud83e\uddfe',label:'DARF'},{num:6,icon:'\ud83d\udee1',label:'REINF'}].map(s => (
            <button key={s.num} onClick={() => canNavigate(s.num) && setStep(s.num)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:'1px solid transparent', fontSize:12.5, fontWeight:500, cursor: canNavigate(s.num) ? 'pointer' : 'default', transition:'all 0.15s', textAlign:'left', width:'100%', background: step===s.num ? 'rgba(42,127,255,0.15)' : step>s.num ? 'rgba(42,200,100,0.08)' : 'transparent', color: step===s.num ? '#fff' : step>s.num ? '#2ac864' : '#4a5a70', borderColor: step===s.num ? 'rgba(42,127,255,0.4)' : step>s.num ? 'rgba(42,200,100,0.15)' : 'transparent' }}>
              <span style={{ fontSize:14, flexShrink:0 }}>{step > s.num ? '\u2713' : s.icon}</span>
              <span>{s.label}</span>
              {step===s.num && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#2a7fff', flexShrink:0 }}/>}
            </button>
          ))}
          <div style={{ margin:'8px 4px', borderTop:'1px solid rgba(255,255,255,0.06)' }}/>
          <button onClick={() => setStep(7)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:`1px solid ${step===7 ? 'rgba(251,191,36,0.4)' : 'transparent'}`, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.15s', textAlign:'left', width:'100%', background: step===7 ? 'rgba(251,191,36,0.12)' : 'transparent', color: step===7 ? '#fbbf24' : '#6b7a90' }}>
            <span style={{ fontSize:14, flexShrink:0 }}>📤</span>
            <span>Folha IOB</span>
            {step===7 && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#fbbf24', flexShrink:0 }}/>}
          </button>
          {userProfile?.role === 'admin' && <>
            <div style={{ margin:'8px 4px', borderTop:'1px solid rgba(255,255,255,0.06)'}}/>
            <button onClick={() => setStep(8)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, border:`1px solid ${step===8 ? 'rgba(251,191,36,0.4)' : 'transparent'}`, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.15s', textAlign:'left', width:'100%', background: step===8 ? 'rgba(251,191,36,0.12)' : 'transparent', color: step===8 ? '#fbbf24' : '#6b7a90' }}>
              <span style={{ fontSize:14, flexShrink:0 }}>⚙️</span>
              <span>Admin</span>
              {step===8 && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#fbbf24', flexShrink:0 }}/>}
            </button>
          </>}
        </nav>
        <div style={{ padding:'12px 10px 20px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', fontSize:11.5, color:'#2ac864', marginBottom:6 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#2ac864', display:'inline-block', flexShrink:0 }}/>Conectado
          </div>
          <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 12px', borderRadius:10, fontSize:12.5, background:'transparent', color:'#7a8fa6', border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer' }}>🚪 Sair</button>
        </div>
      </aside>
      <div style={{ marginLeft:220, flex:1, minHeight:'100vh' }}>
      <div style={{ maxWidth:1000, margin:'40px auto', padding:'0 32px' }}>

        <StepIndicator
          current={step}
          total={5}
          onStepClick={setStep}
          canNavigate={canNavigate}
        />

        {msg && <div style={{ padding: '12px 16px', background: msg.startsWith('✓') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 6, marginBottom: 24, fontSize: 12, color: msg.startsWith('✓') ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>{msg}</div>}

        {step === 1 && <div style={S.card}>
          <div style={{ marginBottom: 20 }}>
            <label style={S.lb}>CNPJ da Fonte Pagadora</label>
            <input placeholder="00.000.000/0000-00" value={cnpj} onChange={mask} style={{ ...S.inp, borderColor: cVal ? (cVal.valid ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)') : 'transparent', borderWidth: 1, borderStyle: 'solid' }} />
            {cVal && cVal.valid && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 6 }}>✓ CNPJ Válido</div>}
            {cVal && !cVal.valid && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>✗ CNPJ Inválido</div>}
            {cErr && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{cErr}</div>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.lb}>Razão Social</label>
            <input style={S.inp} placeholder="Preenchimento automático" value={fp.nome} onChange={e => setFp({ ...fp, nome: e.target.value })} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.lb}>Responsável pelas Informações</label>
            <input style={S.inp} placeholder="Nome do responsável" value={fp.responsavel} onChange={e => setFp({ ...fp, responsavel: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 30 }}>
            <div><label style={S.lb}>Ano-Calendário</label><input style={S.inp} value={fp.anoCalendario} onChange={e => setFp({ ...fp, anoCalendario: e.target.value })} /></div>
            <div><label style={S.lb}>Exercício</label><input style={S.inp} value={fp.exercicio} onChange={e => setFp({ ...fp, exercicio: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setStep(2)} style={S.bp} disabled={!fp.nome}>Continuar {'>'}</button></div>
        </div>}

        {step === 2 && <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: textWhite, margin: 0 }}>Tipo de Rendimento</h2>
              <p style={{ fontSize: 13, color: textMuted, margin: '8px 0 0' }}>Selecione a Natureza do Rendimento</p>
            </div>
            <button onClick={() => setStep(1)} style={S.bs}>{'<'} Voltar</button>
          </div>

          <div style={{ marginBottom: 40 }}>
            <select
              value={tipoRendimento}
              onChange={e => setTipoRendimento(e.target.value)}
              style={{ ...S.inp, padding: '18px', fontSize: 15, cursor: 'pointer', appearance: 'none', background: `${inputBg} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%238995a8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 16px center` }}
            >
              <option value="">Selecione uma opção...</option>
              {Object.keys(TIPOS_RENDIMENTO).map(k => (
                <option key={k} value={k}>{TIPOS_RENDIMENTO[k].titulo} (Cód. {TIPOS_RENDIMENTO[k].codigo})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setStep(3)} style={S.bp} disabled={!tipoRendimento}>Continuar {' >'}</button>
          </div>
        </div>}

        {step === 3 && <div style={S.card}>
          <div onClick={() => fR.current && fR.current.click()}
            onDragEnter={e => { e.preventDefault(); setDrag(true); }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={e => { e.preventDefault(); setDrag(false); }}
            onDrop={e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); }}
            style={{ border: drag ? `1px dashed ${primaryBlue}` : `1px dashed ${borderCol}`, borderRadius: 10, padding: '50px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(40,98,246,0.05)' : inputBg, marginBottom: 24, transition: 'all 0.2s' }}>
            <input ref={fR} type="file" accept=".xlsx,.xls" onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
            {busy ? <div style={{ color: primaryBlue }}><div style={{ fontSize: 24 }}>⏳</div><div style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>Lendo arquivo...</div></div>
              : !tipoRendimento ? <div style={{ color: '#f87171' }}><div style={{ fontSize: 24 }}>⚠️</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>BLOQUEADO: Volte ao Passo 2</div><div style={{ fontSize: 11, marginTop: 4 }}>Você precisa selecionar o código antes de importar.</div></div>
                : file ? <div><div style={{ fontSize: 24 }}>📊</div><div style={{ fontSize: 13, fontWeight: 500, color: '#4ade80', marginTop: 10 }}>{file.name}</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{bens.length} cadastros listados</div></div>
                  : <div><div style={{ fontSize: 32, color: '#3a445c' }}>📁</div><div style={{ fontSize: 13, color: textWhite, fontWeight: 500, marginTop: 12 }}>Arraste o Excel (.xlsx)</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>Para DARF {tipoRendimento}</div></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -12, marginBottom: 24 }}>
            <button onClick={() => tipoRendimento ? baixarModeloExcel(tipoRendimento) : alert('Selecione o código no Passo 2 primeiro')} style={{ ...S.bs, fontSize: 11, padding: '6px 16px', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)' }}>⭳ Baixar Planilha Modelo (Excel)</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(2)} style={S.bs}>Voltar</button>
            <button onClick={() => setStep(4)} style={S.bp} disabled={bens.length === 0}>Processar {'>'}</button>
          </div>
        </div>}

        {step === 4 && <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: textWhite, margin: '0 0 8px' }}>Resultados Analíticos</h2>

          <div style={{ marginBottom: 20 }}>
            <label style={S.lb}>Filtrar por Fonte Pagadora</label>
            <select
              value={filtroCnpj}
              onChange={e => setFiltroCnpj(e.target.value)}
              style={{ ...S.inp, cursor: 'pointer' }}
            >
              <option value="all">Todas as Fontes ({new Set(bens.map(b => b.cnpjFonte)).size})</option>
              {Array.from(new Set(bens.map(b => b.cnpjFonte))).filter(Boolean).map(c => (
                <option key={c} value={c}>{fmtCNPJ(c)} - {bens.find(b => b.cnpjFonte === c)?.nomeFonte || 'N/A'}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 4 }}>Fonte em Foco</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: textWhite, textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {filtroCnpj === 'all' ? 'Resumo Consolidado' : (bens.find(b => b.cnpjFonte === filtroCnpj)?.nomeFonte || 'N/A')}
              </div>
              <div style={{ fontSize: 10, color: textMuted }}>
                {filtroCnpj === 'all' ? 'Todos os CNPJs do arquivo' : `CNPJ: ${fmtCNPJ(filtroCnpj)}`}
              </div>
            </div>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>Base Tributável</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: primaryBlue }}>
                R$ {fmtMoeda(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalRend, 0))}
              </div>
            </div>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>Total IRRF (Exportado)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fb923c' }}>
                R$ {fmtMoeda(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIRRF, 0))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
              <div style={{ fontSize: 10, color: '#4ade80', marginBottom: 6, fontWeight: 700 }}>✓ CÁLCULO AUTOMÁTICO (Simulação 2024/2025)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>
                R$ {fmtMoeda(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIrrfCalculado, 0))}
              </div>
              <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>Este valor utiliza a tabela progressiva oficial com desconto simplificado de R$ 564,80.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            <button onClick={() => gen(null)} disabled={busy}
              style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13 }}>
              <span style={{ marginRight: 6 }}>📄</span> {busy ? 'Processando...' : `Baixar Todos PDFs`}
            </button>
            <button onClick={() => exportToCSV(fp, bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj), tipoRendimento)} disabled={busy}
              title="Gera arquivo .TXT no layout IOB SAGE Digitação Diária (66 bytes/reg) para importação na Folha de Pagamento"
              style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13, background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
              <span style={{ marginRight: 6 }}>📥</span> Exportar IOB SAGE (.TXT)
            </button>
          </div>

          <h3 style={{ fontSize: 11, fontWeight: 500, color: textMuted, margin: '0 0 12px' }}>Downloads Individuais por Beneficiário</h3>
          <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
            {bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: inputBg }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textWhite, textTransform: 'uppercase' }}>{b.nome}</div>
                  <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>
                    CPF: {fmtCPF(b.cpf)} <span style={{ margin: '0 6px', color: borderCol }}>|</span> IRRF: R$ {fmtMoeda(b.totalIRRF)} <span style={{ color: '#4ade80', marginLeft: 6 }}>(Calc: R$ {fmtMoeda(b.totalIrrfCalculado)})</span>
                  </div>
                  {filtroCnpj === 'all' && <div style={{ fontSize: 9, color: primaryBlue, marginTop: 2 }}>Fonte: {fmtCNPJ(b.cnpjFonte)}</div>}
                </div>
                <button onClick={() => gen(i)} disabled={busy} style={{ ...S.bs, padding: '6px 12px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>📄</span> Exportar
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(3)} style={S.bs}>Voltar</button>
            <button onClick={() => setStep(5)} style={S.bp}>Avançar para DARF {'>'}</button>
          </div>
        </div>}

        {step === 5 && <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: textWhite, margin: '0 0 16px' }}>Gerar Guia de Arrecadação (DARF)</h2>
          <div style={{ padding: '24px', borderRadius: 10, background: inputBg, border: `1px solid ${borderCol}`, marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Código da Receita</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: textWhite }}>{tipoRendimento} - {TIPOS_RENDIMENTO[tipoRendimento]?.titulo || 'Aluguéis'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Período de Apuração</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: textWhite }}>31/12/{fp.anoCalendario}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Vencimento Base</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: textWhite }}>20/01/{parseInt(fp.anoCalendario) + 1}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>Valor do DARF</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fb923c' }}>R$ {fmtMoeda(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIRRF, 0))}</div>
              </div>
            </div>
            {filtroCnpj !== 'all' && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${borderCol}`, fontSize: 11, color: '#4ade80' }}>
                ✓ Gerando guia específica para: <strong>{bens.find(b => b.cnpjFonte === filtroCnpj)?.nomeFonte}</strong>
              </div>
            )}
          </div>

          <button onClick={async () => {
            setBusy(true);
            try {
              const filteredBens = b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj;
              const doc = await gerarDARF(fp, bens.filter(filteredBens), `20/01/${parseInt(fp.anoCalendario) + 1}`, tipoRendimento);
              downloadPDF(doc, `DARF_${tipoRendimento}_${filtroCnpj}_${fp.anoCalendario}.pdf`);
              setMsg('✓ Guia de auxílio gerada com sucesso!');
            } catch (e) { alert(e.message); }
            finally { setBusy(false); }
          }} disabled={busy}
            style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13, marginBottom: 24 }}>
            <span style={{ marginRight: 6 }}>📄</span> {busy ? 'Gerando...' : `Baixar Guia de Auxílio (PDF)`}
          </button>

          <div style={{ padding: '20px', borderRadius: 10, background: 'rgba(42,127,255,0.05)', border: '1px dashed rgba(42,127,255,0.3)', marginBottom: 32 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤖</span> EMISSÃO OFICIAL (SICALC BOT)
            </h3>
            <p style={{ fontSize: 11, color: textMuted, marginBottom: 15 }}> Use o comando abaixo no terminal para emitir o DARF oficial com QR Code direto da Receita Federal:</p>
            <div style={{ background: '#000', padding: '12px', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
              <code style={{ fontSize: 10, color: '#4ade80', wordBreak: 'break-all' }}>
                cd ~/Desktop/INFORMES_2026/informe-rendimentos-app && node sicalc_bot.js --cpf={bens.find(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj)?.cnpjFonte || fp.cnpj} --birthdate={bens.find(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj)?.nascimento || 'DDMMYYYY'} --code={tipoRendimento} --period=12/{fp.anoCalendario} --value={(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIRRF, 0)).toFixed(2)}
              </code>
              <button
                onClick={() => {
                  const txt = `cd ~/Desktop/INFORMES_2026/informe-rendimentos-app && node sicalc_bot.js --cpf=${bens.find(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj)?.cnpjFonte || fp.cnpj} --birthdate=${bens.find(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj)?.nascimento || 'DDMMYYYY'} --code=${tipoRendimento} --period=12/${fp.anoCalendario} --value=${(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIRRF, 0)).toFixed(2)}`;
                  navigator.clipboard.writeText(txt);
                  setMsg('✓ Comando copiado para a área de transferência!');
                }}
                style={{ position: 'absolute', right: 8, top: 8, background: primaryBlue, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 9, cursor: 'pointer' }}
              >
                Copiar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button onClick={() => setStep(4)} style={S.bs}>Voltar</button>
          </div>
        </div>}

        {/* ══════════════ STEP 7 — FOLHA IOB ══════════════ */}
        {step === 7 && <div style={S.card}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>📤 Folha IOB — Importação Sage Folhamatic</div>
            <div style={{ fontSize: 12, color: '#6b7a90' }}>Suba a planilha da igreja, confira os códigos salvos e baixe os dois arquivos .txt prontos para importação.</div>
          </div>

          {/* Upload xlsx */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#6b7a90' }}>Aceita: planilha da igreja <strong style={{color:'#fbbf24'}}>OU</strong> o arquivo CODIGOS_FUNCIONARIOS.xlsx — ambos funcionam</div>
            <button onClick={() => downloadLayoutExcel()} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, color:'#818cf8', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              📋 Baixar Layout Excel
            </button>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.lb}>1 · Planilha (.xlsx) — Igreja ou Códigos</label>
            <input ref={fRFolha} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
              onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                setFolhaBusy(true); setFolhaMsg('');
                try {
                  const { employees, codigosMap } = await parseIgrejaFolha(f);
                  // Merge: prioridade códigos no próprio arquivo > localStorage
                  const saved = { ...loadCodigosSalvos(), ...codigosMap };
                  if (Object.keys(codigosMap).length > 0) saveCodigosSalvos(saved);
                  const merged = employees.map(emp => ({ ...emp, codigo: saved[emp.cpf] || '' }));
                  setFolhaEmps(merged);
                  const m = f.name.match(/(\d{2})[_\-\/](\d{4})/);
                  if (m) setFolhaComp(`${m[1]}/${m[2]}`);
                  const comCod = merged.filter(e=>e.codigo).length;
                  setFolhaMsg(`✓ ${merged.length} funcionários carregados. ${comCod} com código${comCod < merged.length ? ` — ${merged.length-comCod} sem código` : ' ✓'}.`);
                } catch(err) { setFolhaMsg('Erro ao ler planilha: ' + err.message); }
                setFolhaBusy(false);
              }}
            />
            <div
              onClick={() => fRFolha.current?.click()}
              onDragOver={e => { e.preventDefault(); setFolhaDrag(true); }}
              onDragLeave={() => setFolhaDrag(false)}
              onDrop={async e => {
                e.preventDefault(); setFolhaDrag(false);
                const f = e.dataTransfer.files[0]; if (!f) return;
                setFolhaBusy(true); setFolhaMsg('');
                try {
                  const { employees, codigosMap } = await parseIgrejaFolha(f);
                  const saved = { ...loadCodigosSalvos(), ...codigosMap };
                  if (Object.keys(codigosMap).length > 0) saveCodigosSalvos(saved);
                  const merged = employees.map(emp => ({ ...emp, codigo: saved[emp.cpf] || '' }));
                  setFolhaEmps(merged);
                  const comCod = merged.filter(e=>e.codigo).length;
                  setFolhaMsg(`✓ ${merged.length} funcionários carregados. ${comCod} com código.`);
                } catch(err) { setFolhaMsg('Erro: ' + err.message); }
                setFolhaBusy(false);
              }}
              style={{ border:`2px dashed ${folhaDrag ? '#fbbf24' : 'rgba(251,191,36,0.25)'}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', background: folhaDrag ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.02)', transition:'all 0.2s' }}>
              {folhaBusy ? <span style={{color:'#fbbf24',fontSize:13}}>⏳ Processando...</span>
                : <><div style={{fontSize:28}}>📊</div><div style={{fontSize:13,color:'#e8edf5',fontWeight:500,marginTop:8}}>Arraste o Excel (.xlsx)</div><div style={{fontSize:11,color:'#6b7a90',marginTop:4}}>ou clique para selecionar</div></>}
            </div>
          </div>

          {/* Config */}
          <div style={{ display:'flex', gap:16, marginBottom:20 }}>
            <div style={{ flex:1 }}>
              <label style={S.lb}>2 · Competência (ex: 03/2026)</label>
              <input value={folhaComp} onChange={e => setFolhaComp(e.target.value)} placeholder="MM/AAAA" style={{ ...S.inp, borderColor:'rgba(251,191,36,0.3)' }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={S.lb}>3 · Código do Evento Ponto</label>
              <input value={folhaEvento} onChange={e => setFolhaEvento(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1105" style={{ ...S.inp, borderColor:'rgba(251,191,36,0.3)' }}/>
            </div>
          </div>

          {/* Botão importar códigos */}
          <div style={{ marginBottom:16 }}>
            <label style={S.lb}>4 · Importar Códigos Salvos <span style={{color:'#fbbf24',fontSize:10}}>(opcional — carrega de outra máquina)</span></label>
            <input ref={fRCodigos} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
              onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                try {
                  const map = await importarCodigosDeXlsx(f);
                  const total = Object.keys(map).length;
                  if (total === 0) { setFolhaMsg('Nenhum código encontrado no arquivo.'); return; }
                  saveCodigosSalvos(map); setFolhaCods(map);
                  // Apply to current employees
                  if (folhaEmps.length > 0) {
                    setFolhaEmps(folhaEmps.map(emp => ({ ...emp, codigo: map[emp.cpf] || emp.codigo })));
                  }
                  setFolhaMsg('✓ ' + total + ' códigos importados e salvos neste navegador!');
                } catch(err) { setFolhaMsg('Erro: ' + err.message); }
                e.target.value = '';
              }}
            />
            <button onClick={() => fRCodigos.current?.click()} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:8, color:'#fbbf24', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
              📥 Importar CODIGOS_FUNCIONARIOS.xlsx
            </button>
          </div>

          {folhaMsg && <div style={{ padding:'10px 14px', background: folhaMsg.startsWith('✓') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${folhaMsg.startsWith('✓') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius:6, marginBottom:16, fontSize:12, color: folhaMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{folhaMsg}</div>}

          {/* Tabela de funcionários */}
          {folhaEmps.length > 0 && <>
            <label style={{ ...S.lb, marginBottom:10 }}>5 · Códigos dos Funcionários — <span style={{color:'#fbbf24'}}>{folhaEmps.filter(e=>e.codigo).length}/{folhaEmps.length} cadastrados</span></label>
            <div style={{ maxHeight:320, overflowY:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, marginBottom:16 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.04)', position:'sticky', top:0 }}>
                    {['#','Nome','CPF','Bruto (R$)','Código (6 dígitos)'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#6b7a90', fontWeight:600, fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {folhaEmps.map((emp, idx) => (
                    <tr key={emp.cpf} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', background: idx%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding:'7px 12px', color:'#4a5a70' }}>{idx+1}</td>
                      <td style={{ padding:'7px 12px', color:'#e8edf5', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.nome}</td>
                      <td style={{ padding:'7px 12px', color:'#6b7a90', fontFamily:'monospace', fontSize:11 }}>{emp.cpf}</td>
                      <td style={{ padding:'7px 12px', color:'#4ade80', textAlign:'right' }}>R$ {emp.bruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                      <td style={{ padding:'6px 12px' }}>
                        <input
                          value={emp.codigo}
                          maxLength={6}
                          placeholder="000000"
                          onChange={e => {
                            const val = e.target.value.toUpperCase().slice(0,6);
                            const updated = folhaEmps.map((x,i) => i===idx ? {...x, codigo:val} : x);
                            setFolhaEmps(updated);
                          }}
                          onBlur={() => {
                            // Auto-save on blur
                            const map = loadCodigosSalvos();
                            folhaEmps.forEach(e => { if(e.codigo) map[e.cpf] = e.codigo; });
                            saveCodigosSalvos(map); setFolhaCods(map);
                          }}
                          style={{ width:80, padding:'4px 8px', background:'rgba(251,191,36,0.08)', border:`1px solid ${emp.codigo ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius:6, color: emp.codigo ? '#fbbf24' : '#6b7a90', fontFamily:'monospace', fontSize:12, outline:'none', textAlign:'center' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totais */}
            <div style={{ display:'flex', gap:16, marginBottom:20 }}>
              {[
                { label:'Funcionários', val: folhaEmps.length, color:'#e8edf5' },
                { label:'Com código', val: folhaEmps.filter(e=>e.codigo).length, color:'#4ade80' },
                { label:'Sem código', val: folhaEmps.filter(e=>!e.codigo).length, color: folhaEmps.filter(e=>!e.codigo).length > 0 ? '#f87171' : '#4ade80' },
                { label:'Total Bruto', val: 'R$ ' + folhaEmps.reduce((s,e)=>s+e.bruto,0).toLocaleString('pt-BR',{minimumFractionDigits:2}), color:'#4ade80' },
              ].map(t => (
                <div key={t.label} style={{ flex:1, padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, color:'#6b7a90', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>{t.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:t.color }}>{t.val}</div>
                </div>
              ))}
            </div>

            {/* Botões de geração */}
            <div style={{ display:'flex', gap:12 }}>
              <button
                disabled={folhaEmps.filter(e=>e.codigo).length === 0 || !folhaComp}
                onClick={() => {
                  const validos = folhaEmps.filter(e => e.codigo);
                  const n = exportFolhaValores(validos, folhaComp);
                  setFolhaMsg(`✓ IMPORTACAO_VALORES_${folhaComp.replace('/','_')}.txt gerado com ${n} registros.`);
                }}
                style={{ flex:1, padding:'13px 20px', fontSize:13, fontWeight:700, background: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', color: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp ? '#fbbf24' : '#4a5a70', border:`1px solid ${folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius:10, cursor: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp ? 'pointer' : 'not-allowed', transition:'all 0.2s' }}
                title="Gera IMPORTACAO_VALORES.txt — Layout 26 bytes (Convênio Sage Folhamatic)"
              >⭳ IMPORTACAO_VALORES.txt<div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:0.7}}>26 bytes/reg · Convênio</div></button>

              <button
                disabled={folhaEmps.filter(e=>e.codigo).length === 0 || !folhaComp || !folhaEvento}
                onClick={() => {
                  const validos = folhaEmps.filter(e => e.codigo);
                  const n = exportFolhaPonto(validos, folhaEvento, folhaComp);
                  setFolhaMsg(`✓ IMPORTACAO_PONTO_${folhaComp.replace('/','_')}.txt gerado com ${n} registros. Evento: ${folhaEvento}`);
                }}
                style={{ flex:1, padding:'13px 20px', fontSize:13, fontWeight:700, background: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp && folhaEvento ? 'rgba(42,127,255,0.15)' : 'rgba(255,255,255,0.04)', color: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp && folhaEvento ? '#60a5fa' : '#4a5a70', border:`1px solid ${folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp && folhaEvento ? 'rgba(42,127,255,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius:10, cursor: folhaEmps.filter(e=>e.codigo).length > 0 && folhaComp && folhaEvento ? 'pointer' : 'not-allowed', transition:'all 0.2s' }}
                title="Gera IMPORTACAO_PONTO.txt — Layout 40 bytes (Ponto Padrão Windows 3)"
              >⭳ IMPORTACAO_PONTO.txt<div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:0.7}}>40 bytes/reg · Evento {folhaEvento||'----'}</div></button>
            </div>
          </>}
        </div>}

        {step === 8 && userProfile?.role === 'admin' && (
          <div style={S.card}>
            <AdminPanel currentUser={userProfile} />
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
