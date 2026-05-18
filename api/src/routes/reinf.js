// ============================================================================
// src/routes/reinf.js — Endpoints de geração de eventos EFD-REINF (série R-4000).
// Gera o XML dos eventos conforme leiaute oficial 2.1.2. A assinatura A1
// (XMLDSig) e a transmissão ao SPED são etapas posteriores, fora desta rota.
// ============================================================================
const express = require('express');
const router = express.Router();
const {
  LEIAUTE_REINF,
  REVISAO_XSD_R4010,
  gerarR4010,
  gerarEventosR4010DaPlanilha,
  gerarR1000,
  gerarR4099,
} = require('../utils/reinfUtils');

// GET /api/reinf/versao — leiaute e revisão de XSD em uso.
router.get('/versao', (req, res) => {
  res.json({ leiaute: LEIAUTE_REINF, xsdR4010: REVISAO_XSD_R4010 });
});

// POST /api/reinf/r1000 — Informações do contribuinte (evtInfoContribuinte).
router.post('/r1000', (req, res) => {
  try {
    const evento = gerarR1000(req.body || {});
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...evento });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

// POST /api/reinf/r4010 — gera o LOTE de eventos R-4010 a partir da planilha.
router.post('/r4010', (req, res) => {
  try {
    const {
      contribuinte, estabelecimento, perApur, tpAmb,
      dtPagamento, natRend, locadores,
    } = req.body || {};
    const eventos = gerarEventosR4010DaPlanilha({
      contribuinte, estabelecimento, perApur, tpAmb,
      dtPagamento, natRend, locadores,
    });
    res.json({
      ok: true,
      leiaute: LEIAUTE_REINF,
      qtdEventos: eventos.length,
      eventos: eventos.map((e) => ({
        id: e.id, cpf: e.cpf, nome: e.nome, xml: e.xml,
      })),
    });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

// POST /api/reinf/r4010/unitario — gera UM evento R-4010 (controle fino).
router.post('/r4010/unitario', (req, res) => {
  try {
    const evento = gerarR4010(req.body || {});
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...evento });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

// POST /api/reinf/r4099 — Fechamento do movimento da série R-4000.
router.post('/r4099', (req, res) => {
  try {
    const evento = gerarR4099(req.body || {});
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...evento });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
