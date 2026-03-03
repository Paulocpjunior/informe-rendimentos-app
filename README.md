# Informe de Rendimentos - Gerador PDF

Aplicação web para geração automática de Informes de Rendimentos (Natureza 13002 - Aluguéis PF) conforme IN RFB nº 2.060/2021.

## Funcionalidades

- ✅ Login com Firebase Auth (email/senha)
- ✅ Validação CNPJ offline (algoritmo RFB)
- ✅ Validação CPF offline
- ✅ Import de planilha Excel (.xlsx/.xls)
- ✅ Geração de PDF individual e consolidado
- ✅ Download direto pelo navegador
- ✅ Drag & drop de arquivos
- ✅ Log de geração no Firestore

## Estrutura do Projeto

```
src/
├── App.js                    # Root com AuthProvider
├── index.js                  # Entry point
├── config/
│   ├── firebase.js           # Configuração Firebase
│   └── AuthContext.js         # Contexto de autenticação
├── components/
│   ├── Login.js              # Tela de login/cadastro
│   └── InformeApp.js         # App principal (3 etapas)
└── utils/
    └── informeUtils.js       # CNPJ/CPF, parser Excel, gerador PDF
```

## Setup

### 1. Firebase Console

1. Acesse https://console.firebase.google.com/
2. Crie um projeto (ou use existente)
3. **Authentication** → Sign-in method → Email/Senha → Ativar
4. **Firestore** → Criar banco de dados → Modo teste
5. **Configurações** → Seus aplicativos → Web → Copie o `firebaseConfig`

### 2. Configurar Credenciais

Edite `src/config/firebase.js` e substitua os placeholders:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### 3. GitHub → Google AI Studio

1. Crie repositório no GitHub
2. Push do código
3. No Google AI Studio, importe do GitHub
4. Deploy automático pelo Google

## Formato da Planilha Excel

| Coluna | Campo |
|--------|-------|
| 0 | Localidade |
| 1 | CNPJ (fonte pagadora) |
| 2 | Código (CDG) |
| 3 | Nome (Proprietário) |
| 4 | CPF (Proprietário) |
| 5 | Apuração (data) |
| 6 | Bruto |
| 7 | IRRF |
| 8 | Líquido |

## Regras Firestore (opcional)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /informes_log/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

---
SP Assessoria Contábil · 2025
