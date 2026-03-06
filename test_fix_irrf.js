const fs = require('fs');
const XLSX = require('xlsx');

async function parseExcel(filePath) {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('Total rows:', rows.length);

  const benefMap = {};
  let idxNome = 3, idxApuracao = 5, idxIrrf = 7, idxIrAcumulado = 8, idxTotalIr = 9;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const nome = String(row[idxNome] || '');
    if (!nome.toUpperCase().includes('ANA PAULA')) continue;
    if (JSON.stringify(row).toUpperCase().includes('TOTAL:')) continue;

    let mesIdx = null;
    const ap = row[idxApuracao];
    if (ap instanceof Date) {
        mesIdx = ap.getMonth();
    } else {
        const s = String(ap).toUpperCase();
        const mesesPt = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
        const mesesEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OUT', 'NOV', 'DEC'];
        const abrev = s.slice(0, 3).toUpperCase();
        const fPt = mesesPt.indexOf(abrev);
        const fEn = mesesEn.indexOf(abrev);
        if (fPt >= 0) mesIdx = fPt;
        else if (fEn >= 0) mesIdx = fEn;
    }

    if (mesIdx !== null) {
        const key = nome.trim().toUpperCase();
        if (!benefMap[key]) benefMap[key] = Array(12).fill(0);
        
        const irrfSimples = Number(row[idxIrrf]) || 0;
        const irAcum = Number(row[idxIrAcumulado]) || 0;
        const totalIr = Number(row[idxTotalIr]) || 0;
        
        const bestVal = Math.max(irrfSimples + irAcum, totalIr);
        benefMap[key][mesIdx] += bestVal;
        console.log(`Row ${i} Month ${mesIdx} Val ${bestVal}`);
    }
  }
  return benefMap;
}

(async () => {
  const result = await parseExcel("/Users/paulocesarpereirajunior/Downloads/CAIXA 2- Janeiro de 2026 0588 (2) 1 (1) (1).xlsx");
  console.log('Result:', JSON.stringify(result, null, 2));
})();
