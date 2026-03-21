import React, { useState, useRef } from 'react';
import { useAuth } from '../config/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  validarCNPJ, validarCPF, fmtMoeda, fmtCPF, fmtCNPJ, calcularIRRF,
  MESES, TIPOS_RENDIMENTO, CNPJ_DB, parseExcel, gerarPDF, downloadPDF, fetchCNPJ, gerarDARF, baixarModeloExcel, exportToCSV
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
    if (target < step) return true; // Sempre pode voltar
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
          <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#2a7fff,#1a5cbf)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff', boxShadow:'0 4px 14px rgba(42,127,255,0.35)', flexShrink:0 }}>S</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#e8edf5', letterSpacing:'-0.3px' }}>SP Contábil</div>
            <div style={{ fontSize:10, fontWeight:600, color:'#4a5a70', letterSpacing:'0.06em', textTransform:'uppercase' }}>Gestão Fiscal</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 10px', padding:'12px 14px', background:'#111e33', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#2a7fff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{user.email?.slice(0,2).toUpperCase()}</div>
          <div style={{ overflow:'hidden' }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#e8edf5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120 }}>{user.email?.split('@')[0]}</div>
            <div style={{ fontSize:10.5, color:'#4a5a70' }}>Operador</div>
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
      </div>
    </div>
    </div>
  );
}
