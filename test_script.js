const fs = require('fs');
const XLSX = require('xlsx');

// 1. Criar o Excel mock
const data = [
    ["Localidade", "CNPJ", "CDG", "Nome / Proprietário", "CPF", "Apuração", "Bruto", "IRRF", "Líquido"],
    ["SP", "00.000.000/0001-00", "001", "PAULO CESAR PEREIRA", "111.111.111-11", "2025-01", 5000.50, 150.00, 4850.50],
    ["RJ", "22.222.222/0001-22", "002", "MARIA DA SILVA", "222.222.222-22", "2025-02", 8000.00, 300.00, 7700.00]
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
fs.writeFileSync("test.xlsx", XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

// 2. Testar o parser
function parseExcel(filePath) {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let cnpjFonte = '';
    const benefMap = {};

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 8) continue;

        // NOME na Coluna D (índice 3)
        const nome = row[3];
        if (!nome || String(nome).trim() === '') continue;
        const ns = String(nome);
        // Ignora linha de cabeçalho
        if (ns.indexOf('Nome') >= 0 && ns.indexOf('Propriet') >= 0) continue;

        // Valor Bruto na Coluna G (índice 6)
        const br = Number(row[6]);
        if (isNaN(br)) continue;

        // CNPJ na Coluna B (índice 1)
        if (!cnpjFonte && row[1]) {
            const c = String(row[1]).replace(/\D/g, '');
            if (c.length >= 14) cnpjFonte = c.slice(0, 14);
        }

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

        const key = ns.trim().toUpperCase();
        if (!benefMap[key]) {
            benefMap[key] = {
                nome: ns.trim(), // Use string directly to preserve case
                cpf: String(row[4]).replace(/\D/g, '').slice(0, 11), // CPF na Coluna E (índice 4)
                rend: Array(12).fill(0),
                irrf: Array(12).fill(0)
            };
        }
        benefMap[key].rend[mesIdx] += br;
        benefMap[key].irrf[mesIdx] += Number(row[7]) || 0;
    }

    const beneficiarios = Object.values(benefMap).map(b => ({
        ...b,
        totalRend: b.rend.reduce((a, c) => a + c, 0),
        totalIRRF: b.irrf.reduce((a, c) => a + c, 0)
    }));

    return { cnpjFonte, beneficiarios };
}

const res = parseExcel("test.xlsx");
console.log(JSON.stringify(res, null, 2));

// Limpeza
fs.unlinkSync("test.xlsx");
