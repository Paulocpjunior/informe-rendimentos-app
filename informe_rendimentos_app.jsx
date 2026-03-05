import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

const TIPOS_RENDIMENTO = {
  '3208': { codigo: '3208', titulo: 'Aluguéis e Royalties', natureza: '13002 - Aluguéis e royalties pagos a pessoa física', descInfo: 'Natureza 13002 · Aluguel PF' },
  '0588': { codigo: '0588', titulo: 'Trabalho sem Vínculo', natureza: '10004 - Rendimento do trabalho sem vínculo empregatício', descInfo: 'Natureza 10004 · Trabalho s/ Vínculo' },
  '0561': { codigo: '0561', titulo: 'Trabalho Assalariado', natureza: '10001 - Rendimento do trabalho assalariado', descInfo: 'Natureza 10001 · Assalariado' },
  '1708': { codigo: '1708', titulo: 'Serviços Jurídicas', natureza: '13005 - Remuneração de serviços profissionais', descInfo: 'Natureza 13005 · Serviços Profissionais' },
  '8045': { codigo: '8045', titulo: 'Comissões', natureza: '13008 - Comissões e corretagens', descInfo: 'Natureza 13008 · Comissões' }
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fm = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fc = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : c; };
const fnn = (c) => { const d = String(c).replace(/\D/g, ""); return d.length === 14 ? d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12) : c; };

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
        var k = `${n.trim().toUpperCase()}|${curCnpj}`;
        if (!bm[k]) bm[k] = { nome: n.trim().toUpperCase(), cnpj: curCnpj, cpf: String(row[3]).replace(/\D/g, "").slice(0, 11), rend: Array(12).fill(0), irrf: Array(12).fill(0) };
        bm[k].rend[mi] += Number(row[5]) || 0; bm[k].irrf[mi] += Number(row[6]) || 0;
      });
    });
    var arr = Object.values(bm).map(b => { b.tR = b.rend.reduce((a, c) => a + c, 0); b.tI = b.irrf.reduce((a, c) => a + c, 0); return b; });
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
        doc.rect(15, 25, 180, 12).setFontSize(8).text("FONTE PAGADORA: " + fnn(b.cnpj || fp.cnpj), 20, 32);
        doc.rect(15, 37, 180, 12).text("BENEFICIÁRIO: " + b.nome + " (CPF: " + fc(b.cpf) + ")", 20, 44);
        doc.rect(15, 49, 180, 40).text("RENDIMENTOS TRIBUTÁVEIS: R$ " + fm(b.tR), 20, 60).text("IRRF RETIDO: R$ " + fm(b.tI), 20, 75);
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
  const [links, setLinks] = useState([]); const fR = useRef(null);

  // RESET DE SEGURANÇA
  useState(() => {
    setStep(1);
    setTipo('');
  }, []);

  function processFile(f) {
    setBusy(true); parseXLS(f).then(r => {
      setBens(r.bens);
      setStep(4);
    }).finally(() => setBusy(false));
  }

  const list = bens.filter(b => fCnpj === 'all' || b.cnpj === fCnpj);

  return (
    <div style={{ minHeight: "100vh", background: "#0d1b2a", color: "#e0e6ed", padding: 20 }}>
      <div style={{ maxWidth: 800, margin: "auto" }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Gerador IR <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 6px', borderRadius: 4 }}>v1.1.2</span></h1>
          <span style={{ fontSize: 10, color: '#8995a8' }}>{TIPOS_RENDIMENTO[tipo]?.titulo || 'Selecione o código no Passo 2'}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: 4, background: step >= n ? "#2a7fff" : "#222" }} />)}
        </div>

        {step === 1 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <h2>Dados Gerais</h2>
          <input placeholder="Responsável" style={{ width: '100%', padding: 12, marginBottom: 10 }} value={fp.resp} onChange={e => setFp({ ...fp, resp: e.target.value })} />
          <button onClick={() => setStep(2)} style={{ background: "#2a7fff", color: '#fff', border: 0, padding: 12 }}>Continuar {'>'}</button>
        </div>}

        {step === 2 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <h2>Selecione o Código</h2>
          {Object.keys(TIPOS_RENDIMENTO).map(k => (
            <div key={k} onClick={() => { setTipo(k); setStep(3); }} style={{ padding: 15, border: "1px solid #333", marginBottom: 10, cursor: 'pointer', background: tipo === k ? "#2a7fff" : "transparent" }}>
              {TIPOS_RENDIMENTO[k].titulo} ({k})
            </div>
          ))}
          <button onClick={() => setStep(1)}>Voltar</button>
        </div>}

        {step === 3 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12, textAlign: 'center' }}>
          <h2>Importar Excel</h2>
          <input type="file" ref={fR} onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
          <div onClick={() => fR.current.click()} style={{ border: '2px dashed #2a7fff', padding: 40, cursor: 'pointer' }}>
            {busy ? "Processando..." : "Clique para selecionar o Arquivo"}
          </div>
        </div>}

        {step === 4 && <div style={{ background: "#1b2a4a", padding: 30, borderRadius: 12 }}>
          <h2>Resultados</h2>
          <select value={fCnpj} onChange={e => setFCnpj(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 20 }}>
            <option value="all">Todas as Fontes</option>
            {Array.from(new Set(bens.map(b => b.cnpj))).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {list.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #222' }}>
              <span>{b.nome}</span>
              <button onClick={() => makePDF(fp, bens, bens.indexOf(b), tipo).then(d => d.save('doc.pdf'))}>PDF</button>
            </div>
          ))}
          <button style={{ marginTop: 20 }} onClick={() => setStep(2)}>Mudar Código</button>
        </div>}
      </div>
    </div>
  );
}
