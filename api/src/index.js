
const express = require('express');
const cors    = require('cors');

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/users', require('./routes/users'));
app.use('/api/logs',  require('./routes/logs'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`SP Contábil API rodando na porta ${PORT}`));
