# PROMPT PARA GOOGLE AI STUDIO - Deploy App Informe de Rendimentos

Cole este prompt no Google AI Studio para criar e fazer deploy do app.

---

## PROMPT:

Crie uma aplicação React completa para Geração de Informes de Rendimentos (Natureza 13002 - Aluguéis PF) conforme IN RFB nº 2.060/2021.

### CONFIGURAÇÃO FIREBASE (usar este projeto existente):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA9bPtg6W93nAEMe_13OqMZ1KHwZlPKWA0",
  authDomain: "gen-lang-client-0569062468.firebaseapp.com",
  projectId: "gen-lang-client-0569062468",
  storageBucket: "gen-lang-client-0569062468.firebasestorage.app",
  messagingSenderId: "292090471177",
  appId: "1:292090471177:web:b78c80c6452290851829d8",
  measurementId: "G-P3N0LYJHRV"
};
```

### FUNCIONALIDADES OBRIGATÓRIAS:

1. **Autenticação Firebase Auth** (email/senha) com tela de login/cadastro
2. **3 Etapas no app:**
   - Etapa 1: Dados da Fonte Pagadora (CNPJ com validação offline por dígito verificador, banco interno de CNPJs)
   - Etapa 2: Importar Excel (.xlsx) com drag-and-drop (usar SheetJS via CDN: https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js)
   - Etapa 3: Gerar PDFs individuais e consolidado com download (usar jsPDF via CDN: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js)
3. **Log no Firestore** - salvar registro de cada PDF gerado

### FORMATO DA PLANILHA EXCEL:

Colunas na ordem: Localidade, CNPJ fonte, Código, Nome Proprietário, CPF Proprietário, Apuração (data), Bruto, IRRF, Líquido

IMPORTANTE: O arquivo pode conter linhas de cabeçalho repetidas (filtrar onde Nome contém "Nome" + "Proprietário"). CPFs podem incrementar por bug do Excel, usar primeiro CPF de cada beneficiário. Agrupar por nome (uppercase), somar 12 meses de rendimentos e IRRF.

### VALIDAÇÃO CNPJ (offline, algoritmo RFB):

Pesos DV1: [5,4,3,2,9,8,7,6,5,4,3,2]
Pesos DV2: [6,5,4,3,2,9,8,7,6,5,4,3,2]
Fórmula: soma % 11, se < 2 dígito = 0, senão 11 - resto

### VALIDAÇÃO CPF (offline):

Pesos DV1: 10 a 2, Pesos DV2: 11 a 2
Fórmula: (soma * 10) % 11, se = 10 dígito = 0

### BANCO INTERNO DE CNPJ:

```javascript
const CNPJ_DB = {
  "00621930000162": {
    razao_social: "FED NACIONAL COMUNIDADE EVANGELICA SARA NOSSA TERRA",
    nome_fantasia: "SARA NOSSA TERRA",
    situacao: "ATIVA",
    municipio: "BRASILIA",
    uf: "DF"
  }
};
```

### LAYOUT DO PDF (jsPDF):

- Header azul escuro (26,39,68) com "COMPROVANTE DE RENDIMENTOS PAGOS E DE IMPOSTO SOBRE A RENDA RETIDO NA FONTE"
- Subtítulo: "IN RFB nº 2.060/2021"
- Seção 1: Fonte Pagadora (CNPJ, Razão Social)
- Seção 2: Beneficiário (CPF, Nome, Natureza)
- Seção 3: Rendimentos Tributáveis (5 linhas: total rendimentos, contrib previdenciária, previdência complementar, pensão, IRRF)
- Seção 4: Isentos (7 linhas zeradas)
- Seção 5: Tributação Exclusiva (2 linhas zeradas)
- Seção 7: Informações Complementares com tabela mensal (6 meses esquerda, 6 meses direita, total anual)
- Rodapé: Responsável + Data
- Cores das seções: azul (43,76,126), fundo claro (220,230,240), cinza (245,245,245)

### DESIGN DA INTERFACE:

- Background: gradiente escuro (#0d1b2a → #1b2a4a → #1a3a5c)
- Cards com glass morphism (rgba blur, bordas sutis)
- Botões com gradiente azul (#2a7fff → #1a5cbf)
- Badges de validação: verde ✓ Válido, vermelho ✗ Inválido
- Tabela de beneficiários com CPF monospace
- Valores em R$ formatados pt-BR
- IRRF destacado em laranja (#ff8c42)

### DOWNLOAD DO PDF:

Usar doc.output("blob") + URL.createObjectURL + createElement("a") com atributo download.

### SEM React.StrictMode (evitar erro IndexedDB do Firebase)

Faça deploy desta aplicação no Firebase Hosting do projeto gen-lang-client-0569062468.
