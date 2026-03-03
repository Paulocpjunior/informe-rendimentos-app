import { jsPDF } from "jspdf";

// ═══ VALIDAÇÃO CNPJ ═══
export function validarCNPJ(cnpj) {
  const d = String(cnpj).replace(/\D/g, '');
  if (d.length !== 14) return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
  if (/^(\d)\1{13}$/.test(d)) return { valid: false, error: 'CNPJ inválido' };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[12]) !== d1) return { valid: false, error: 'CNPJ inválido (dígito verificador)' };
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  if (parseInt(d[13]) !== d2) return { valid: false, error: 'CNPJ inválido (dígito verificador)' };
  return { valid: true, digits: d, tipo: d.slice(8, 12) === '0001' ? 'Matriz' : 'Filial' };
}

// ═══ VALIDAÇÃO CPF ═══
export function validarCPF(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (parseInt(d[9]) !== r) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return parseInt(d[10]) === r;
}

// ═══ FORMATADORES ═══
export const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtCPF = (c) => { const d = String(c).replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c; };
export const fmtCNPJ = (c) => { const d = String(c).replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : c; };

// ═══ MESES ═══
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const NATUREZA = '13002 - Aluguéis e royalties pagos a pessoa física';

// ═══ BANCO INTERNO CNPJ ═══
export const CNPJ_DB = {
  '00621930000162': {
    razao_social: 'FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA',
    nome_fantasia: 'SARA NOSSA TERRA',
    situacao: 'ATIVA',
    municipio: 'BRASILIA',
    uf: 'DF'
  }
};

export async function fetchCNPJ(cnpjStr) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjStr}`);
    if (!res.ok) return null;
    const json = await res.json();
    return {
      razao_social: json.razao_social,
      nome_fantasia: json.nome_fantasia || '',
      situacao: json.descricao_situacao_cadastral,
      municipio: json.municipio,
      uf: json.uf,
      tipo: json.identificador_matriz_filial === 1 ? 'Matriz' : 'Filial'
    };
  } catch (e) { return null; }
}

// ═══ CARREGAR SCRIPT CDN ═══
export function loadScript(url, check) {
  if (check()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar: ' + url));
    document.head.appendChild(s);
  });
}

// ═══ PARSE EXCEL ═══
export async function parseExcel(file) {
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    () => !!window.XLSX
  );
  const XLSX = window.XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let cnpjFonte = '';
  const benefMap = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 8) continue;
    const nome = row[3];
    if (!nome || String(nome).trim() === '') continue;
    const ns = String(nome);
    if (ns.indexOf('Nome') >= 0 && ns.indexOf('Propriet') >= 0) continue;
    const br = Number(row[6]);
    if (isNaN(br)) continue;

    // CNPJ fonte da primeira linha válida
    if (!cnpjFonte && row[1]) {
      const c = String(row[1]).replace(/\D/g, '');
      if (c.length >= 14) cnpjFonte = c.slice(0, 14);
    }

    // Mês da apuração
    let mesIdx = null;
    const ap = row[5];
    if (ap instanceof Date) mesIdx = ap.getMonth();
    else if (typeof ap === 'number') mesIdx = new Date((ap - 25569) * 86400000).getMonth();
    else if (ap) {
      const s = String(ap);
      let m = s.match(/(\d{4})-(\d{2})/);
      if (m) mesIdx = parseInt(m[2], 10) - 1;
      if (mesIdx === null) { m = s.match(/(\d{2})\/(\d{4})/); if (m) mesIdx = parseInt(m[1], 10) - 1; }
    }
    if (mesIdx === null || mesIdx < 0 || mesIdx > 11) continue;

    // Agrupar por nome, CPF da primeira ocorrência
    const key = ns.trim().toUpperCase();
    if (!benefMap[key]) {
      benefMap[key] = {
        nome: key,
        cpf: String(row[4]).replace(/\D/g, '').slice(0, 11),
        rend: Array(12).fill(0),
        irrf: Array(12).fill(0)
      };
    }
    benefMap[key].rend[mesIdx] += br;
    benefMap[key].irrf[mesIdx] += Number(row[7]) || 0;
  }

  const beneficiarios = Object.values(benefMap).map(b => ({
    ...b,
    cpfValido: validarCPF(b.cpf),
    totalRend: b.rend.reduce((a, c) => a + c, 0),
    totalIRRF: b.irrf.reduce((a, c) => a + c, 0)
  }));

  return { cnpjFonte, beneficiarios };
}

// ═══ GERAR PDF ═══
export async function gerarPDF(fp, beneficiarios, idx) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = 210, ml = 15, cw = 180;
  const list = idx != null ? [beneficiarios[idx]] : beneficiarios;

  list.forEach((b, i) => {
    if (i > 0) doc.addPage();
    let y = 10;

    // Header
    doc.setFillColor(26, 39, 68); doc.rect(ml, y, cw, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE DE RENDIMENTOS PAGOS E DE', pw / 2, y + 6.5, { align: 'center' });
    doc.text('IMPOSTO SOBRE A RENDA RETIDO NA FONTE', pw / 2, y + 11.5, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('IN RFB nº 2.060/2021 · Natureza: ' + NATUREZA, pw / 2, y + 17, { align: 'center' });
    y += 22;

    // Exercício
    const hw = cw / 2 - 0.5;
    doc.setFillColor(220, 230, 240);
    doc.rect(ml, y, hw, 10, 'F'); doc.rect(ml + hw + 1, y, hw, 10, 'F');
    doc.setTextColor(43, 76, 126); doc.setFontSize(6.5);
    doc.text('EXERCÍCIO', ml + 3, y + 4); doc.text('ANO-CALENDÁRIO', ml + hw + 4, y + 4);
    doc.setTextColor(0); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(fp.exercicio, ml + 28, y + 8); doc.text(fp.anoCalendario, ml + hw + 38, y + 8);
    y += 12.5;

    // Seção 1 - Fonte Pagadora
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('1   FONTE PAGADORA PESSOA JURÍDICA OU PESSOA FÍSICA', ml + 3, y + 5.2); y += 7;
    doc.setDrawColor(176); doc.setLineWidth(0.2);
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('CNPJ / CPF', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(fmtCNPJ(fp.cnpj), ml + 2.5, y + 8); y += 10;
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('RAZÃO SOCIAL / NOME', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(fp.nome, ml + 2.5, y + 8); y += 12.5;

    // Seção 2 - Beneficiário
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5);
    doc.text('2   PESSOA FÍSICA BENEFICIÁRIA DOS RENDIMENTOS', ml + 3, y + 5.2); y += 7;
    const cW = 72;
    doc.rect(ml, y, cW, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('CPF', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.text(fmtCPF(b.cpf), ml + 2.5, y + 8);
    doc.rect(ml + cW, y, cw - cW, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('NATUREZA DO RENDIMENTO', ml + cW + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(NATUREZA, ml + cW + 2.5, y + 8); y += 10;
    doc.rect(ml, y, cw, 10, 'S');
    doc.setTextColor(100); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('NOME COMPLETO', ml + 2.5, y + 3.5);
    doc.setTextColor(0); doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.text(b.nome, ml + 2.5, y + 8); y += 12.5;

    // Seção 3 - Rendimentos
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5);
    doc.text('3   RENDIMENTOS TRIBUTÁVEIS, DEDUÇÕES E IMPOSTO SOBRE A RENDA RETIDO NA FONTE', ml + 3, y + 5.2); y += 7;
    const nW = 8, vW = 30, dW = cw - nW - vW;
    const q3 = [['1', 'Total dos rendimentos (inclusive férias)', b.totalRend], ['2', 'Contribuição previdenciária oficial', 0], ['3', 'Previdência complementar, FAPI', 0], ['4', 'Pensão alimentícia', 0], ['5', 'Imposto sobre a renda retido na fonte', b.totalIRRF]];
    q3.forEach(([n, desc, val]) => {
      doc.setFillColor(245); doc.rect(ml, y, nW, 8.5, 'FD');
      doc.setTextColor(0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text(n, ml + nW / 2, y + 5.8, { align: 'center' });
      doc.rect(ml + nW, y, dW, 8.5, 'S'); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(desc, ml + nW + 2, y + 5.8);
      doc.rect(ml + nW + dW, y, vW, 8.5, 'S');
      doc.setFontSize(8); doc.setFont('helvetica', (n === '1' || n === '5') ? 'bold' : 'normal');
      doc.text(fmtMoeda(val), ml + cw - 2.5, y + 5.8, { align: 'right' }); y += 8.5;
    }); y += 2.5;

    // Seção 4
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('4   RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS', ml + 3, y + 5.2); y += 7;
    for (let n = 1; n <= 7; n++) {
      doc.setFillColor(245); doc.rect(ml, y, nW, 6, 'FD');
      doc.setTextColor(0); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(String(n), ml + 4, y + 4);
      doc.rect(ml + nW, y, dW, 6, 'S'); doc.rect(ml + nW + dW, y, vW, 6, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('0,00', ml + cw - 2.5, y + 4, { align: 'right' }); y += 6;
    } y += 2.5;

    // Seção 5
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('5   RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA', ml + 3, y + 5.2); y += 7;
    for (let n = 1; n <= 2; n++) {
      doc.setFillColor(245); doc.rect(ml, y, nW, 6, 'FD');
      doc.setTextColor(0); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(String(n), ml + 4, y + 4);
      doc.rect(ml + nW, y, dW, 6, 'S'); doc.rect(ml + nW + dW, y, vW, 6, 'S');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.text('0,00', ml + cw - 2.5, y + 4, { align: 'right' }); y += 6;
    } y += 2.5;

    // Seção 7 - Informações Complementares
    doc.setFillColor(43, 76, 126); doc.rect(ml, y, cw, 7, 'F');
    doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('7   INFORMAÇÕES COMPLEMENTARES', ml + 3, y + 5.2); y += 7;
    const iH = 50; doc.rect(ml, y, cw, iH, 'S');
    doc.setTextColor(0); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO MENSAL DOS RENDIMENTOS E RETENÇÕES', ml + 3, y + 4);
    let yt = y + 8;
    const c1 = ml + 3, c2 = ml + 50, c3 = ml + 73, c4 = ml + cw / 2 + 3, c5 = ml + cw / 2 + 50, c6 = ml + cw / 2 + 73;
    doc.setFontSize(6.5); doc.setTextColor(43, 76, 126); doc.setFont('helvetica', 'bold');
    doc.text('Competência', c1, yt); doc.text('Rendimento', c2, yt, { align: 'right' }); doc.text('IRRF', c3, yt, { align: 'right' });
    doc.text('Competência', c4, yt); doc.text('Rendimento', c5, yt, { align: 'right' }); doc.text('IRRF', c6, yt, { align: 'right' });
    yt += 1.5; doc.setDrawColor(43, 76, 126); doc.setLineWidth(0.3);
    doc.line(c1, yt, c3 + 1, yt); doc.line(c4, yt, c6 + 1, yt);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
    for (let j = 0; j < 6; j++) {
      const yl = yt + 3.5 + j * 3.5;
      doc.text(MESES[j], c1, yl); doc.text(fmtMoeda(b.rend[j]), c2, yl, { align: 'right' }); doc.text(fmtMoeda(b.irrf[j]), c3, yl, { align: 'right' });
      doc.text(MESES[j + 6], c4, yl); doc.text(fmtMoeda(b.rend[j + 6]), c5, yl, { align: 'right' }); doc.text(fmtMoeda(b.irrf[j + 6]), c6, yl, { align: 'right' });
    }
    const yT = yt + 25;
    doc.setDrawColor(43, 76, 126); doc.line(c1, yT - 1, c3 + 1, yT - 1);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(43, 76, 126);
    doc.text('TOTAL ANUAL', c1, yT); doc.setTextColor(0);
    doc.text(fmtMoeda(b.totalRend), c2, yT, { align: 'right' });
    doc.text(fmtMoeda(b.totalIRRF), c3, yT, { align: 'right' });
    y += iH + 2.5;

    // Responsável
    doc.setFillColor(245); doc.rect(ml, y, cw, 10, 'FD');
    doc.setTextColor(43, 76, 126); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('RESPONSÁVEL PELAS INFORMAÇÕES', ml + 3, y + 4);
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    doc.text('Data: ' + new Date().toLocaleDateString('pt-BR') + (fp.responsavel ? ' · ' + fp.responsavel : ''), ml + 3, y + 8);
    y += 13;
    doc.setTextColor(170); doc.setFontSize(5.5);
    doc.text('Documento gerado conforme IN RFB nº 2.060/2021 — Dispensada assinatura', pw / 2, y, { align: 'center' });
  });

  return doc;
}

// ═══ DOWNLOAD PDF ═══
export function downloadPDF(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
