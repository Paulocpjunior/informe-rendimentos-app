import React, { useState, useRef } from 'react';
import { useAuth } from '../config/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  validarCNPJ, validarCPF, fmtMoeda, fmtCPF, fmtCNPJ,
  MESES, NATUREZA, CNPJ_DB, parseExcel, gerarPDF, downloadPDF
} from '../utils/informeUtils';

export default function InformeApp() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState(1);
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

  const mask = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12);
    else if (v.length > 8) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8);
    else if (v.length > 5) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5);
    else if (v.length > 2) v = v.slice(0,2)+'.'+v.slice(2);
    setCnpj(v); setCErr(''); setCData(null); setCVal(null);
    const dig = v.replace(/\D/g, '');
    if (dig.length === 14) {
      const r = validarCNPJ(dig); setCVal(r);
      if (r.valid) {
        const dbEntry = CNPJ_DB[dig]; setCData(dbEntry || null);
        setFp(p => ({ ...p, cnpj: dig, nome: dbEntry ? dbEntry.razao_social : p.nome }));
      } else setCErr(r.error);
    }
  };

  const processFile = async (f) => {
    if (!f) return;
    setFile(f); setBusy(true); setMsg('');
    try {
      const r = await parseExcel(f);
      setBens(r.beneficiarios);
      if (r.cnpjFonte && !fp.cnpj) {
        setFp(p => ({ ...p, cnpj: r.cnpjFonte }));
        setCnpj(fmtCNPJ(r.cnpjFonte));
        const v = validarCNPJ(r.cnpjFonte); setCVal(v);
        if (v.valid) {
          const dbEntry = CNPJ_DB[r.cnpjFonte]; setCData(dbEntry || null);
          if (dbEntry) setFp(p => ({ ...p, cnpj: r.cnpjFonte, nome: dbEntry.razao_social }));
        }
      }
      setMsg(`✓ ${r.beneficiarios.length} beneficiário(s) extraídos com sucesso`);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setBusy(false); }
  };

  const gen = async (idx) => {
    setBusy(true); setMsg('');
    try {
      const doc = await gerarPDF(fp, bens, idx);
      const nm = idx != null
        ? `INFORME_${bens[idx].cpf}_${bens[idx].nome.replace(/\s/g,'_').slice(0,25)}_${fp.anoCalendario}.pdf`
        : `INFORMES_CONSOLIDADO_${fp.anoCalendario}.pdf`;
      downloadPDF(doc, nm);
      setMsg(`✓ PDF gerado: ${nm}`);

      // Salvar log no Firestore
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
      } catch (e) { /* silencioso se Firestore não configurado */ }
    } catch (err) { alert('Erro PDF: ' + err.message); }
    finally { setBusy(false); }
  };

  const S = {
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 },
    inp: { width: '100%', padding: '10px 14px', fontSize: 13, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box' },
    bp: { padding: '10px 22px', fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#2a7fff,#1a5cbf)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
    bs: { padding: '10px 18px', fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#aab', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer' },
    lb: { display: 'block', fontSize: 11.5, color: '#7a8fa6', marginBottom: 4 }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#0d1b2a,#1b2a4a,#1a3a5c)', fontFamily: "'Segoe UI',system-ui", color: '#e0e6ed' }}>
      <header style={{ padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2a7fff,#1a5cbf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>IR</div>
          <div><h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Gerador de Informe de Rendimentos</h1><p style={{ margin: 0, fontSize: 11.5, color: '#7a8fa6' }}>Natureza 13002 · Aluguel PF · IN RFB 2.060/2021</p></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: '#7a8fa6' }}>{user.email}</span>
          <button onClick={logout} style={{ ...S.bs, padding: '6px 14px', fontSize: 11.5 }}>Sair</button>
        </div>
      </header>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px' }}>
        {/* STEPS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[{n:1,l:'Fonte Pagadora'},{n:2,l:'Importar Dados'},{n:3,l:'Gerar PDFs'}].map(it => (
            <button key={it.n} onClick={() => { if (it.n <= 2 || bens.length > 0) setStep(it.n); }}
              style={{ flex: 1, padding: '11px 14px', background: step === it.n ? 'rgba(42,127,255,0.15)' : 'rgba(255,255,255,0.03)', border: step === it.n ? '1px solid rgba(42,127,255,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: step >= it.n ? 'linear-gradient(135deg,#2a7fff,#1a5cbf)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: step >= it.n ? '#fff' : '#556' }}>{it.n}</span>
              <span style={{ fontSize: 12.5, fontWeight: step === it.n ? 600 : 400, color: step === it.n ? '#fff' : '#7a8fa6' }}>{it.l}</span>
            </button>
          ))}
        </div>

        {msg && <div style={{ padding: '10px 14px', background: msg.startsWith('✓') ? 'rgba(42,200,100,0.08)' : 'rgba(255,60,60,0.08)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(42,200,100,0.2)' : 'rgba(255,60,60,0.2)'}`, borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: msg.startsWith('✓') ? '#2ac864' : '#ff6b6b' }}>{msg}</div>}

        {/* STEP 1 */}
        {step === 1 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Dados da Fonte Pagadora</h2>
          <p style={{ color: '#7a8fa6', fontSize: 12.5, margin: '0 0 18px' }}>CNPJ com validação automática</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input placeholder="00.000.000/0000-00" value={cnpj} onChange={mask} style={{ ...S.inp, flex: 1, fontSize: 15, borderColor: cVal ? (cVal.valid ? 'rgba(42,200,100,0.5)' : 'rgba(255,60,60,0.5)') : 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 80 }}>
              {cVal && cVal.valid && <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(42,200,100,0.12)', color: '#2ac864', fontSize: 11, fontWeight: 600 }}>✓ Válido</span>}
              {cVal && !cVal.valid && <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,60,60,0.1)', color: '#ff6b6b', fontSize: 11, fontWeight: 600 }}>✗ Inválido</span>}
            </div>
          </div>
          {cErr && <div style={{ padding: '10px 14px', background: 'rgba(255,60,60,0.1)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#ff6b6b' }}>{cErr}</div>}
          {cData && <div style={{ padding: 16, borderRadius: 10, marginBottom: 18, background: 'rgba(42,200,100,0.06)', border: '1px solid rgba(42,200,100,0.2)' }}>
            <div style={{ color: '#2ac864', fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>✓ Cadastro interno — {cVal && cVal.tipo}</div>
            <div style={{ fontSize: 12.5 }}><span style={{ color: '#7a8fa6' }}>Razão:</span> <strong style={{ color: '#fff' }}>{cData.razao_social}</strong> · <span style={{ color: '#7a8fa6' }}>Situação:</span> <strong style={{ color: '#2ac864' }}>{cData.situacao}</strong></div>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div><label style={S.lb}>Razão Social</label><input style={S.inp} value={fp.nome} onChange={e => setFp({ ...fp, nome: e.target.value })} /></div>
            <div><label style={S.lb}>Responsável</label><input style={S.inp} value={fp.responsavel} onChange={e => setFp({ ...fp, responsavel: e.target.value })} /></div>
            <div><label style={S.lb}>Exercício</label><input style={S.inp} value={fp.exercicio} onChange={e => setFp({ ...fp, exercicio: e.target.value })} /></div>
            <div><label style={S.lb}>Ano-Calendário</label><input style={S.inp} value={fp.anoCalendario} onChange={e => setFp({ ...fp, anoCalendario: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setStep(2)} style={S.bp} disabled={!fp.nome}>Próximo →</button></div>
        </div>}

        {/* STEP 2 */}
        {step === 2 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Importar Dados do Excel</h2>
          <p style={{ color: '#7a8fa6', fontSize: 12.5, margin: '0 0 18px' }}>Colunas: Localidade, CNPJ, CDG, Nome, CPF, Apuração, Bruto, IRRF, Líquido</p>
          <div onClick={() => fR.current && fR.current.click()}
            onDragEnter={e => { e.preventDefault(); setDrag(true); }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={e => { e.preventDefault(); setDrag(false); }}
            onDrop={e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); }}
            style={{ border: drag ? '2px dashed #2a7fff' : '2px dashed rgba(42,127,255,0.3)', borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(42,127,255,0.1)' : file ? 'rgba(42,200,100,0.04)' : 'rgba(42,127,255,0.03)', marginBottom: 18, transition: 'all 0.2s' }}>
            <input ref={fR} type="file" accept=".xlsx,.xls" onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
            {busy ? <div style={{ color: '#2a7fff' }}><div style={{ fontSize: 28 }}>⏳</div><div style={{ fontSize: 13, fontWeight: 600 }}>Processando...</div></div>
            : file ? <div><div style={{ fontSize: 28 }}>📊</div><div style={{ fontSize: 14, fontWeight: 600, color: '#2ac864' }}>{file.name}</div><div style={{ fontSize: 12, color: '#7a8fa6', marginTop: 4 }}>{bens.length} beneficiário(s)</div></div>
            : <div><div style={{ fontSize: 36, opacity: 0.6 }}>📁</div><div style={{ fontSize: 14, color: '#ccd', fontWeight: 500, marginTop: 8 }}>Arraste o arquivo Excel aqui</div><div style={{ fontSize: 12, color: '#667', marginTop: 6 }}>ou clique para selecionar · .xlsx, .xls</div></div>}
          </div>
          {bens.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', color: '#7a8fa6', fontSize: 11 }}>Nome</th>
              <th style={{ padding: '7px 10px', textAlign: 'left', color: '#7a8fa6', fontSize: 11 }}>CPF</th>
              <th style={{ padding: 4, color: '#7a8fa6' }}></th>
              <th style={{ padding: '7px 10px', textAlign: 'right', color: '#7a8fa6', fontSize: 11 }}>Rendimentos</th>
              <th style={{ padding: '7px 10px', textAlign: 'right', color: '#7a8fa6', fontSize: 11 }}>IRRF</th>
            </tr></thead>
            <tbody>{bens.map((b, i) => <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '9px 10px', color: '#dde' }}>{b.nome}</td>
              <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, color: '#dde' }}>{fmtCPF(b.cpf)}</td>
              <td>{b.cpfValido ? <span style={{ color: '#2ac864' }}>✓</span> : <span style={{ color: '#ff6b6b' }}>✗</span>}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#dde' }}>R$ {fmtMoeda(b.totalRend)}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#ff8c42' }}>R$ {fmtMoeda(b.totalIRRF)}</td>
            </tr>)}</tbody>
            <tfoot><tr style={{ borderTop: '2px solid rgba(42,127,255,0.3)' }}>
              <td colSpan={3} style={{ padding: '9px 10px', fontWeight: 700, color: '#fff' }}>TOTAL</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalRend, 0))}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#ff8c42' }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalIRRF, 0))}</td>
            </tr></tfoot>
          </table>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={S.bs}>← Voltar</button>
            <button onClick={() => setStep(3)} style={S.bp} disabled={bens.length === 0}>Próximo →</button>
          </div>
        </div>}

        {/* STEP 3 */}
        {step === 3 && <div style={S.card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>Gerar Informes de Rendimentos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ padding: 13, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#7a8fa6' }}>Fonte</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{fp.nome}</div>
              <div style={{ fontSize: 11, color: '#7a8fa6' }}>CNPJ: {fmtCNPJ(fp.cnpj)}</div>
            </div>
            <div style={{ padding: 13, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#7a8fa6' }}>Rendimentos</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2a7fff' }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalRend, 0))}</div>
            </div>
            <div style={{ padding: 13, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#7a8fa6' }}>IRRF</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ff8c42' }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalIRRF, 0))}</div>
            </div>
          </div>
          <button onClick={() => gen(null)} disabled={busy}
            style={{ ...S.bp, width: '100%', padding: 13, fontSize: 13.5, marginBottom: 10, textAlign: 'center' }}>
            {busy ? '⏳ Gerando...' : `📄 Baixar PDF Consolidado (${bens.length} informes)`}
          </button>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', margin: '16px 0 10px' }}>Baixar individual</h3>
          {bens.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 7 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{b.nome}</div>
                <div style={{ fontSize: 11, color: '#7a8fa6' }}>CPF: {fmtCPF(b.cpf)} · R$ {fmtMoeda(b.totalRend)}</div>
              </div>
              <button onClick={() => gen(i)} disabled={busy} style={{ ...S.bs, padding: '6px 14px', fontSize: 11.5 }}>📄 Baixar PDF</button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 18 }}>
            <button onClick={() => setStep(2)} style={S.bs}>← Voltar</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
