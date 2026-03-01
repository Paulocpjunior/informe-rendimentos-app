export const CNPJ_DB: Record<string, any> = {
  "00621930000162": {
    razao_social: "FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA",
    situacao_cadastral: "ATIVA",
    municipio: "BRASILIA",
    uf: "DF"
  }
};

export const NATUREZAS = [
  { cod:"10001", desc:"Trabalho com vínculo", codReceita:"0561", grupo:"Trabalho" },
  { cod:"10002", desc:"Trabalho sem vínculo (autônomos)", codReceita:"0588", grupo:"Trabalho" },
  { cod:"10004", desc:"PLR", codReceita:"3562", grupo:"Trabalho" },
  { cod:"12001", desc:"Lucros e dividendos", codReceita:null, grupo:"Capital", isento:true },
  { cod:"12016", desc:"Juros sobre Capital Próprio", codReceita:"5706", grupo:"Capital" },
  { cod:"13001", desc:"Aforamento", codReceita:"3208", grupo:"Aluguéis" },
  { cod:"13002", desc:"Aluguéis, Locação ou Sublocação", codReceita:"3208", grupo:"Aluguéis" },
  { cod:"13003", desc:"Arrendamento", codReceita:"3208", grupo:"Aluguéis" },
  { cod:"13010", desc:"Direito Autoral", codReceita:"0588", grupo:"Royalties" },
  { cod:"13098", desc:"Demais Royalties", codReceita:"3208", grupo:"Royalties" }
];

export function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (str: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += parseInt(str[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digit1 = calcDigit(cnpj.substring(0, 12), weights1);
  if (digit1 !== parseInt(cnpj[12])) return false;

  const digit2 = calcDigit(cnpj.substring(0, 13), weights2);
  if (digit2 !== parseInt(cnpj[13])) return false;

  return true;
}

export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  const calcDigit = (str: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += parseInt(str[i]) * weights[i];
    }
    const rest = (sum * 10) % 11;
    return rest === 10 || rest === 11 ? 0 : rest;
  };

  const weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

  const digit1 = calcDigit(cpf.substring(0, 9), weights1);
  if (digit1 !== parseInt(cpf[9])) return false;

  const digit2 = calcDigit(cpf.substring(0, 10), weights2);
  if (digit2 !== parseInt(cpf[10])) return false;

  return true;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function formatDocument(doc: string): string {
  const clean = doc.replace(/[^\d]+/g, '');
  if (clean.length === 14) return formatCNPJ(clean);
  if (clean.length === 11) return formatCPF(clean);
  return doc;
}

export function validateDocument(doc: string): boolean {
  const clean = doc.replace(/[^\d]+/g, '');
  if (clean.length === 14) return validateCNPJ(clean);
  if (clean.length === 11) return validateCPF(clean);
  return false;
}

export function applyCnpjMask(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
}
