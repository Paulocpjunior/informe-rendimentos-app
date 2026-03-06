const XLSX = require('xlsx');
const wb = XLSX.readFile("/Users/paulocesarpereirajunior/Downloads/CAIXA 2- Janeiro de 2026 0588 (2) 1 (1) (1).xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log('Row 8 Header:', JSON.stringify(rows[0]));
console.log('Row 8 Data:', JSON.stringify(rows[8]));
