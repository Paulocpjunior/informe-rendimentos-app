export const CNPJ_DB: Record<string, any> = {
  "00621930000162": {
    razao_social: "FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA",
    nome_fantasia: "SARA NOSSA TERRA",
    situacao: "ATIVA",
    municipio: "BRASILIA",
    uf: "DF"
  }
};

export const NATUREZAS = [
  { cod: "10001", desc: "Rendimento do trabalho com vínculo empregatício", codReceita: "0561", grupo: "Trabalho" },
  { cod: "10002", desc: "Rendimento do trabalho sem vínculo empregatício", codReceita: "0588", grupo: "Trabalho" },
  { cod: "10003", desc: "Trabalho pago a trabalhador avulso", codReceita: "0588", grupo: "Trabalho" },
  { cod: "10004", desc: "Participação nos lucros ou resultados (PLR)", codReceita: "3562", grupo: "Trabalho" },
  { cod: "12001", desc: "Lucros e dividendos", codReceita: null, grupo: "Capital", isento: true },
  { cod: "12016", desc: "Juros sobre o Capital Próprio", codReceita: "5706", grupo: "Capital" },
  { cod: "13001", desc: "Rendimentos de Aforamento", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13002", desc: "Rendimentos de Aluguéis, Locação ou Sublocação", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13003", desc: "Rendimentos de Arrendamento ou Subarrendamento", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13004", desc: "Importâncias pagas por terceiros por conta do locador", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13010", desc: "Rendimentos de Direito Autoral", codReceita: "0588", grupo: "Aluguéis/Royalties" },
  { cod: "13012", desc: "Rendimentos de Direito de Imagem", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13098", desc: "Demais rendimentos de Royalties", codReceita: "3208", grupo: "Aluguéis/Royalties" },
  { cod: "13099", desc: "Demais rendimentos de Direito", codReceita: "3208", grupo: "Aluguéis/Royalties" }
];

export function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
