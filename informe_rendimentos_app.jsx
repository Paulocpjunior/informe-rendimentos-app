import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

const TIPOS_RENDIMENTO = {
  '3208': { codigo: '3208', titulo: 'Aluguéis e Royalties', natureza: '13002 - Aluguéis e royalties pagos a pessoa física', descInfo: 'Natureza 13002 · Aluguel PF' },
  '0588': { codigo: '0588', titulo: 'Trabalho sem Vínculo', natureza: '10004 - Rendimento do trabalho sem vínculo empregatício', descInfo: 'Natureza 10004 · Trabalho s/ Vínculo' },
  '0561': { codigo: '0561', titulo: 'Trabalho Assalariado', natureza: '10001 - Rendimento do trabalho assalariado', descInfo: 'Natureza 10001 · Assalariado' },
  '1708': { codigo: '1708', titulo: 'Serviços Jurídicas', natureza: '13005 - Remuneração de serviços profissionais', descInfo: 'Natureza 13005 · Serviços Profissionais' },
  '8045': { codigo: '8045', titulo: 'Comissões', natureza: '13008 - Comissões e corretagens', descInfo: 'Natureza 13008 · Comissões' },
  '10003': { codigo: '0561', titulo: 'Prebenda / Ministro Religioso', natureza: '10003 - Ministro de Confissão Religiosa', descInfo: 'Natureza 10003 · Prebenda' },
  '12002': { codigo: '---', titulo: 'Ajuda de Custo / Diárias', natureza: '12002 - Diárias e Ajuda de Custo', descInfo: 'Natureza 12002 · Isento' }
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fm = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fc = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : c; };
const fnn = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 14 ? d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12) : c; };

function calcularIRRF(v) {
  const ds = 564.8, bs = Math.max(0, v - ds);
  const ct = (b) => {
    if (b <= 2259.2) return 0; if (b <= 2826.65) return (b * 0.075) - 169.44;
    if (b <= 3751.05) return (b * 0.15) - 381.44; if (b <= 4664.68) return (b * 0.225) - 662.77;
    return (b * 0.275) - 896;
  };
  return Math.max(0, Math.min(ct(v), ct(bs)));
}

function vCPF(x) { const d = String(x).replace(/\D/g, ""); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false; let s = 0; for (let i = 0; i < 9; i++)s += parseInt(d[i]) * (10 - i); let r = (s * 10) % 11; if (r === 10) r = 0; if (parseInt(d[9]) !== r) return false; s = 0; for (let i = 0; i < 10; i++)s += parseInt(d[i]) * (11 - i); r = (s * 10) % 11; if (r === 10) r = 0; return parseInt(d[10]) === r; }

function loadS(url, ck) { if (ck()) return Promise.resolve(); return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = url; s.onload = function () { res(); }; s.onerror = function () { rej(new Error("CDN fail")); }; document.head.appendChild(s); }); }

function parseXLS(file) {
  return loadS("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => !!window.XLSX).then(() => file.arrayBuffer()).then((buf) => {
    var X = window.XLSX, wb = X.read(buf, { type: "array", cellDates: true });
    var bm = {}; var cnpjs = new Set();
    wb.SheetNames.forEach(name => {
      var ws = wb.Sheets[name], rows = X.utils.sheet_to_json(ws, { header: 1, defval: "" });
      var curCnpj = "";
      rows.forEach(row => {
        if (!row || row.length < 5) return;
        var n = String(row[2]); if (!n || n.trim() === "" || n.includes("Nome")) return;
        if (row[1]) { var c = String(row[1]).replace(/\D/g, ""); if (c.length === 14) curCnpj = c; }
        if (curCnpj) cnpjs.add(curCnpj);
        var ap = row[4]; var mi = null;
        if (ap instanceof Date) mi = ap.getMonth(); else if (typeof ap === "number") mi = new Date((ap - 25569) * 86400000).getMonth();
        if (mi === null || mi < 0 || mi > 11) return;
        var cpf = String(row[3]).replace(/\D/g, "").slice(0, 11);
        var k = `${n.trim().toUpperCase()}|${cpf}`;
        if (!bm[k]) bm[k] = { nome: n.trim().toUpperCase(), cnpj: curCnpj, cpf: cpf, rend: Array(12).fill(0), irrf: Array(12).fill(0) };
        bm[k].rend[mi] += Number(row[5]) || 0; bm[k].irrf[mi] += Number(row[6]) || 0;
      });
    });
    var arr = Object.values(bm).map(b => {
      b.tR = b.rend.reduce((a, c) => a + c, 0);
      b.tI = b.irrf.reduce((a, c) => a + c, 0);
      // Cálculo Automático Mensal
      b.tICalc = b.rend.reduce((acc, val) => acc + calcularIRRF(val), 0);
      return b;
    });
    return { bens: arr, cnpjs: Array.from(cnpjs) };
  });
}

function makePDF(fp, bens, idx, tipo) {
  const cfg = TIPOS_RENDIMENTO[tipo] || TIPOS_RENDIMENTO['3208'];
  return new Promise((res, rej) => {
    try {
      var doc = new jsPDF(); var list = idx != null ? [bens[idx]] : bens;
      list.forEach((b, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(10).setFont("helvetica", "bold").text("COMPROVANTE DE RENDIMENTOS PAGOS", 105, 15, { align: "center" });
        doc.setFontSize(7).setFont("helvetica", "normal").text(cfg.natureza, 105, 20, { align: "center" });
        doc.rect(15, 25, 180, 12).setFontSize(8).text("FONTE PAGADORA: " + (b.cnpj || fp.cnpj), 20, 32);
        doc.rect(15, 37, 180, 12).text("BENEFICIÁRIO: " + b.nome + " (CPF: " + b.cpf + ")", 20, 44);
        doc.rect(15, 49, 180, 40).text("RENDIMENTOS TRIBUTÁVEIS: R$ " + fm(b.tR), 20, 60).text("IRRF RETIDO (EXCEL): R$ " + fm(b.tI), 20, 75).text("IRRF CALCULADO (2025): R$ " + fm(b.tICalc), 20, 85);
      });
      res(doc);
    } catch (e) { rej(e); }
  });
}

export default function App() {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('');
  const [fCnpj, setFCnpj] = useState('all');
  const [fp, setFp] = useState({ cnpj: "", nome: "", ex: "2026", ac: "2025" });
  const [bens, setBens] = useState([]); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(""); const fR = useRef(null);

  // RESET DE SEGURANÇA
  useState(() => {
    setStep(1);
    setTipo('');
  }, []);

  function processFile(f) {
    setBusy(true); parseXLS(f).then(r => {
      setBens(r.bens);
      if (tipo) setStep(4); else setStep(2);
    }).finally(() => setBusy(false));
  }

  const list = bens.filter(b => fCnpj === 'all' || b.cnpj === fCnpj);
  const totalCalc = list.reduce((a, b) => a + b.tICalc, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0d1b2a", color: "#e0e6ed", padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 800, margin: "auto" }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Gerador IR <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 6px', borderRadius: 4 }}>v1.2.0 (Auto-IRRF)</span></h1>
          <span style={{ fontSize: 10, color: '#8995a8' }}>{TIPOS_RENDIMENTO[tipo]?.titulo || 'Selecione o código no Passo 2'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: 4, background: step >= n ? "#2a7fff" : "#222" }} />)}
        </div>

        {msg && <div style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: 10, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>{msg}</div>}

        {step === 1 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <h2 style={{ fontSize: 16 }}>Dados da Fonte Pagadora</h2>
          <input placeholder="Razão Social" style={{ width: '100%', padding: 12, marginBottom: 15, background: '#141e33', color: '#fff', border: '1px solid #333' }} value={fp.nome} onChange={e => setFp({ ...fp, nome: e.target.value })} />
          <button onClick={() => setStep(2)} disabled={!fp.nome} style={{ background: "#2a7fff", color: '#fff', border: 0, padding: 12, borderRadius: 8, width: '100%', fontWeight: 600 }}>Continuar {'>'}</button>
        </div>}

        {step === 2 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <h2 style={{ fontSize: 16 }}>Selecione o Código de Rendimento</h2>
          {Object.keys(TIPOS_RENDIMENTO).map(k => (
            <div key={k} onClick={() => { setTipo(k); setStep(3); }} style={{ padding: 15, border: "1px solid #333", marginBottom: 10, borderRadius: 8, cursor: 'pointer', background: tipo === k ? "#2a7fff" : "rgba(255,255,255,0.03)" }}>
              {TIPOS_RENDIMENTO[k].titulo} ({k})
            </div>
          ))}
          <button onClick={() => setStep(1)} style={{ color: '#8995a8', background: 'none', border: 0, marginTop: 10 }}>{'<'} Voltar</button>
        </div>}

        {step === 3 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12, textAlign: 'center' }}>
          <h2 style={{ fontSize: 16 }}>Importar Planilha Excel</h2>
          <input type="file" ref={fR} onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
          <div onClick={() => fR.current.click()} style={{ border: '2px dashed #2a7fff', padding: 60, cursor: 'pointer', borderRadius: 12, background: 'rgba(42,127,255,0.05)' }}>
            {busy ? "Processando..." : "Arraste ou Clique para Importar"}
          </div>
          <button onClick={() => setStep(2)} style={{ color: '#8995a8', background: 'none', border: 0, marginTop: 20 }}>{'<'} Mudar Código</button>
        </div>}

        {step === 4 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Resultados Analíticos</h2>
            <button onClick={() => setStep(3)} style={{ fontSize: 11, background: 'none', color: '#8995a8', border: '1px solid #333', padding: '5px 10px', borderRadius: 4 }}>Nova Importação</button>
          </div>

          <div style={{ background: 'rgba(74,222,128,0.05)', padding: 15, borderRadius: 10, border: '1px solid rgba(74,222,128,0.1)', marginBottom: 25 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#4ade80', fontWeight: 700 }}>✓ IRRF CALCULADO AUTOMATICAMENTE</p>
            <p style={{ margin: '5px 0 0', fontSize: 24, fontWeight: 800, color: '#4ade80' }}>R$ {fm(totalCalc)}</p>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#8995a8' }}>Baseado na tabela 2025 (Simplificado). Use o botão abaixo para emitir o DARF Oficial.</p>
          </div>

          <select value={fCnpj} onChange={e => setFCnpj(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 20, background: '#141e33', color: '#fff', border: '1px solid #333', borderRadius: 8 }}>
            <option value="all">Todas as Fontes</option>
            {Array.from(new Set(bens.map(b => b.cnpj))).map(c => <option key={c} value={c}>{c || 'CNPJ não identificado'}</option>)}
          </select>

          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 15, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #222' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{b.nome}</div>
                  <div style={{ fontSize: 11, color: '#8995a8', marginTop: 4 }}>IRRF Excel: R$ {fm(b.tI)} | <span style={{ color: '#4ade80' }}>Calc: R$ {fm(b.tICalc)}</span></div>
                </div>
                <button onClick={() => makePDF(fp, bens, bens.indexOf(b), tipo).then(d => d.save(`INFORME_${b.cpf}.pdf`))} style={{ background: '#2a7fff', color: '#fff', border: 0, padding: '8px 15px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>PDF</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 30, padding: 20, background: 'rgba(42,127,255,0.05)', border: '1px dashed #2a7fff', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#2a7fff' }}>🤖 COMANDO PARA ROBÔ (DARF OFICIAL)</p>
            <div style={{ marginTop: 10, background: '#000', padding: 12, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code style={{ fontSize: 10, color: '#4ade80' }}>cd ~/Desktop/INFORMES_2026/informe-rendimentos-app && node sicalc_bot.js --cpf={fp.cnpj || '000'} --birthdate={list[0]?.nascimento || 'DDMMYYYY'} --value={totalCalc.toFixed(2)} --code={tipo}</code>
              <button onClick={() => { navigator.clipboard.writeText(`cd ~/Desktop/INFORMES_2026/informe-rendimentos-app && node sicalc_bot.js --cpf=${fp.cnpj || '000'} --birthdate=${list[0]?.nascimento || 'DDMMYYYY'} --value=${totalCalc.toFixed(2)} --code=${tipo}`); setMsg("Comando copiado!"); }} style={{ background: '#2a7fff', border: 0, color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 9 }}>Copiar</button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}
