import React, { useState, useRef } from 'react';
import { useAuth } from '../config/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  validarCNPJ, validarCPF, fmtMoeda, fmtCPF, fmtCNPJ,
  MESES, TIPOS_RENDIMENTO, CNPJ_DB, parseExcel, gerarPDF, downloadPDF, fetchCNPJ, gerarDARF, baixarModeloExcel
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
      setMsg(`✓ ${r.beneficiarios.length} beneficiário(s) extraídos${multiStr} com sucesso.`);

      // Avançar para Resultados (Passo 4) após importação
      setStep(4);
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        const reachable = canNavigate(n);
        return (
          <div key={n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              onClick={() => reachable && onStepClick(n)}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: active ? primaryBlue : (done ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)'),
                border: `1px solid ${active ? primaryBlue : (done ? '#4ade80' : borderCol)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: reachable ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s'
              }}>
              {done ? <span style={{ color: '#4ade80', fontSize: 14 }}>✓</span> :
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? textWhite : textMuted }}>{n}</span>}
            </div>
            {n < total && <div style={{ flex: 1, height: 2, background: done ? '#4ade80' : borderCol, opacity: 0.3 }} />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: textWhite, padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={{ padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: primaryBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>IR</div>
            <div><h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textWhite }}>Gerador de Informe de Rendimentos</h1><p style={{ margin: 0, fontSize: 11, color: textMuted, marginTop: 2 }}>{TIPOS_RENDIMENTO[tipoRendimento]?.descInfo || ''}</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: textMuted }}>{user.email}</span>
            <button onClick={logout} style={{ ...S.bs, padding: '6px 14px', fontSize: 11 }}>Sair</button>
          </div>
        </header>

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
          <h2 style={{ fontSize: 14, fontWeight: 600, color: textWhite, margin: '0 0 16px' }}>Selecione o Tipo de Rendimento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 32, maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
            {Object.keys(TIPOS_RENDIMENTO).map(k => {
              const r = TIPOS_RENDIMENTO[k];
              const isSel = tipoRendimento === k;
              return (
                <div key={k} onClick={() => setTipoRendimento(k)}
                  className="revenue-card"
                  style={{
                    padding: '18px', borderRadius: 12, cursor: 'pointer',
                    background: isSel ? 'rgba(40,98,246,0.15)' : inputBg,
                    border: `1px solid ${isSel ? primaryBlue : borderCol}`,
                    display: 'flex', alignItems: 'center', gap: 16,
                    transform: isSel ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSel ? `0 0 20px rgba(40,98,246,0.2)` : 'none'
                  }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: `2px solid ${isSel ? primaryBlue : borderCol}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSel ? primaryBlue : 'transparent'
                  }}>
                    {isSel && <div style={{ width: 10, height: 10, borderRadius: '50%', background: textWhite }} />}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textWhite }}>{r.titulo} (Cód. {r.codigo})</div>
                    <div style={{ fontSize: 10, color: textMuted }}>{r.natureza}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(bens.length > 0 ? 3 : 1)} style={S.bs}>Voltar</button>
            <button onClick={() => setStep(3)} style={S.bp} disabled={!tipoRendimento}>Continuar {'>'}</button>
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
              : file ? <div><div style={{ fontSize: 24 }}>📊</div><div style={{ fontSize: 13, fontWeight: 500, color: '#4ade80', marginTop: 10 }}>{file.name}</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{bens.length} cadastros listados</div></div>
                : <div><div style={{ fontSize: 32, color: '#3a445c' }}>📁</div><div style={{ fontSize: 13, color: textWhite, fontWeight: 500, marginTop: 12 }}>Arraste o Excel (.xlsx)</div><div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>Para DARF {tipoRendimento}</div></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -12, marginBottom: 24 }}>
            <button onClick={() => baixarModeloExcel(tipoRendimento)} style={{ ...S.bs, fontSize: 11, padding: '6px 16px', color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)' }}>⭳ Baixar Planilha Modelo (Excel)</button>
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
              <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>Total IRRF</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fb923c' }}>
                R$ {fmtMoeda(bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).reduce((a, x) => a + x.totalIRRF, 0))}
              </div>
            </div>
          </div>

          <button onClick={() => gen(null)} disabled={busy}
            style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13, marginBottom: 32 }}>
            <span style={{ marginRight: 6 }}>📄</span> {busy ? 'Processando...' : `Baixar Relatório Consolidado Master (${bens.length} registros)`}
          </button>

          <h3 style={{ fontSize: 11, fontWeight: 500, color: textMuted, margin: '0 0 12px' }}>Downloads Individuais por Beneficiário</h3>
          <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
            {bens.filter(b => filtroCnpj === 'all' || b.cnpjFonte === filtroCnpj).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: inputBg }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textWhite, textTransform: 'uppercase' }}>{b.nome}</div>
                  <div style={{ fontSize: 10, color: textMuted, marginTop: 4 }}>
                    CPF: {fmtCPF(b.cpf)} <span style={{ margin: '0 6px', color: borderCol }}>|</span> IRRF: R$ {fmtMoeda(b.totalIRRF)}
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
              setMsg('✓ DARF gerado com sucesso!');
            } catch (e) { alert(e.message); }
            finally { setBusy(false); }
          }} disabled={busy}
            style={{ ...S.bp, width: '100%', padding: 14, fontSize: 13, marginBottom: 32 }}>
            <span style={{ marginRight: 6 }}>📄</span> {busy ? 'Gerando DARF...' : `Baixar Guia DARF (PDF)`}
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button onClick={() => setStep(4)} style={S.bs}>Voltar</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
