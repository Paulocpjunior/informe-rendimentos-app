import React, { useState, useRef } from 'react';
import { useAuth } from '../config/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  validarCNPJ, validarCPF, fmtMoeda, fmtCPF, fmtCNPJ,
  MESES, NATUREZA, CNPJ_DB, parseExcel, gerarPDF, downloadPDF, fetchCNPJ
} from '../utils/informeUtils';

export default function InformeApp() {
  const { user, logout } = useAuth();
  const [step, setStep] = useState(3);
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
      setStep(3);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setBusy(false); }
  };

  const gen = async (idx) => {
    setBusy(true); setMsg('');
    try {
      const doc = await gerarPDF(fp, bens, idx);
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

  // ESTILOS EXATAMENTE IGUAIS AO PRINT
  const darkBg = '#181d2a';
  const cardBg = '#222839';
  const inputBg = '#151928';
  const textWhite = '#f8fafc';
  const textMuted = '#8995a8';
  const primaryBlue = '#2862f6';
  const borderCol = '#2a3348';

  const S = {
    card: { background: cardBg, borderRadius: 16, padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    inp: { width: '100%', padding: '12px 16px', fontSize: 13, background: inputBg, border: 'none', borderRadius: 6, color: textWhite, outline: 'none', boxSizing: 'border-box' },
    bp: { padding: '12px 28px', fontSize: 13, fontWeight: 500, background: primaryBlue, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bs: { padding: '8px 16px', fontSize: 12, background: 'transparent', color: textMuted, border: `1px solid ${borderCol}`, borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s' },
    lb: { display: 'block', fontSize: 11, color: textMuted, marginBottom: 6, fontWeight: 500 }
  };

  return (
    <div style={{ minHeight: '100vh', background: darkBg, fontFamily: "'Inter', system-ui, sans-serif", color: textWhite }}>
      <header style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: primaryBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>IR</div>
          <div><h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textWhite }}>Gerador de Informe de Rendimentos</h1><p style={{ margin: 0, fontSize: 11, color: textMuted, marginTop: 2 }}>Natureza 13002 · Aluguel PF · IN RFB 2.060/2021</p></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: textMuted }}>{user.email}</span>
          <button onClick={logout} style={{ ...S.bs, padding: '6px 14px', fontSize: 11 }}>Sair</button>
        </div>
      </header>

      <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px' }}>

        {/* STEPPER PIXEL PERFECT DA IMAGEM */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
          {[
            { n: 1, l: 'Fonte Pagadora' },
            { n: 2, l: 'Tipo de Rendimento' },
            { n: 3, l: 'Importar Excel' },
            { n: 4, l: 'Gerar PDFs' },
            { n: 5, l: 'Gerar DARF' }
          ].map((it, idx) => {
            let isCurrent = false;
            let canClick = false;
            let clickStep = 1;

            if (it.n === 1) { isCurrent = step === 1; canClick = true; clickStep = 1; }
            if (it.n === 2) { isCurrent = false; canClick = step >= 1; clickStep = 1; }
            if (it.n === 3) { isCurrent = step === 2; canClick = fp.nome !== ''; clickStep = 2; }
            if (it.n === 4) { isCurrent = step === 3; canClick = bens.length > 0; clickStep = 3; }
            if (it.n === 5) { isCurrent = false; canClick = false; }

            const isActive = isCurrent;
            const isDone = (step === 2 && it.n < 3) || (step === 3 && it.n < 4);
            const isOpacity = (it.n === 5 || it.n === 2) ? 0.4 : 1;

            return (
              <React.Fragment key={it.n}>
                <div
                  onClick={() => { if (canClick && it.n !== 5 && it.n !== 2) setStep(clickStep); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isActive ? 'rgba(40,98,246,0.15)' : 'transparent',
                    border: isActive ? `1px solid ${primaryBlue}` : `1px solid ${borderCol}`,
                    borderRadius: 30,
                    padding: '6px 16px 6px 6px',
                    cursor: (canClick && it.n !== 5 && it.n !== 2) ? 'pointer' : 'default',
                    opacity: isOpacity
                  }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isActive ? primaryBlue : (isDone ? '#3a445c' : '#222839'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                    color: isActive ? '#fff' : (isDone ? textWhite : textMuted)
                  }}>
                    {it.n}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: isActive ? 500 : 400, color: isActive ? '#fff' : textMuted }}>
                    {it.l}
                  </span>
                </div>
                {idx < 4 && <div style={{ height: 1, width: 24, background: borderCol, margin: '0 8px', opacity: 0.5 }} />}
              </React.Fragment>
            );
          })}
        </div>

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
          <div onClick={() => fR.current && fR.current.click()}
            onDragEnter={e => { e.preventDefault(); setDrag(true); }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={e => { e.preventDefault(); setDrag(false); }}
            onDrop={e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); }}
            style={{ border: drag ? `1px dashed ${primaryBlue}` : `1px dashed ${borderCol}`, borderRadius: 10, padding: '50px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(40,98,246,0.05)' : inputBg, marginBottom: 24, transition: 'all 0.2s' }}>
            <input ref={fR} type="file" accept=".xlsx,.xls" onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
            {busy ? <div style={{ color: primaryBlue }}><div style={{ fontSize: 24 }}>⏳</div><div style={{ fontSize: 13, fontWeight: 500, marginTop: 10 }}>Lendo arquivo...</div></div>
              : file ? <div><div style={{ fontSize: 24 }}>📊</div><div style={{ fontSize: 13, fontWeight: 500, color: '#4ade80', marginTop: 10 }}>{file.name}</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{bens.length} cadastros listados</div></div>
                : <div><div style={{ fontSize: 32, color: '#3a445c' }}>📁</div><div style={{ fontSize: 13, color: textWhite, fontWeight: 500, marginTop: 12 }}>Arraste o Excel (.xlsx)</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>Modelo Padronizado IN RFB</div></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={S.bs}>Voltar</button>
            <button onClick={() => setStep(3)} style={S.bp} disabled={bens.length === 0}>Processar {'>'}</button>
          </div>
        </div>}

        {step === 3 && <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: textWhite, margin: '0 0 16px' }}>Resultados Analíticos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 4 }}>Fonte Cadastrada</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: textWhite, textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fp.nome}</div>
              <div style={{ fontSize: 10, color: textMuted }}>CNPJ: {fmtCNPJ(fp.cnpj)}</div>
            </div>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>Base de Cálculo Tributável</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: primaryBlue }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalRend, 0))}</div>
            </div>
            <div style={{ padding: '16px', borderRadius: 10, background: inputBg }}>
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>Imposto Retido (IRRF)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fb923c' }}>R$ {fmtMoeda(bens.reduce((a, x) => a + x.totalIRRF, 0))}</div>
            </div>
          </div>

          <button onClick={() => gen(null)} disabled={busy}
            style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13, marginBottom: 32 }}>
            <span style={{ marginRight: 6 }}>📄</span> {busy ? 'Processando...' : `Baixar Relatório Consolidado Master (${bens.length} registros)`}
          </button>

          <h3 style={{ fontSize: 11, fontWeight: 500, color: textMuted, margin: '0 0 12px' }}>Downloads Individuais por Beneficiário</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {bens.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: inputBg }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textWhite, textTransform: 'uppercase' }}>{b.nome}</div>
                  <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>CPF: {fmtCPF(b.cpf)} <span style={{ margin: '0 6px', color: borderCol }}>|</span> IRRF: R$ {fmtMoeda(b.totalIRRF)}</div>
                </div>
                <button onClick={() => gen(i)} disabled={busy} style={{ ...S.bs, padding: '6px 12px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>📄</span> Exportar
                </button>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
