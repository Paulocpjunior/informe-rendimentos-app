// ============================================================================
// src/routes/reinf.js — Endpoints EFD-REINF (serie R-4000).
// Geracao dos eventos (R-1000/R-4010/R-4099), assinatura A1 e transmissao
// do lote ao Ambiente Nacional. Leiaute oficial 2.1.2 / lote v1_00_00.
// ============================================================================
const express = require('express');
const router = express.Router();
const {
  LEIAUTE_REINF, REVISAO_XSD_R4010,
  gerarR4010, gerarEventosR4010DaPlanilha,
  gerarR1000, gerarR4099, gerarTrioReinf,
} = require('../utils/reinfUtils');
const { assinarEventoReinf } = require('../utils/assinador');
const { loadCertificado } = require('../utils/cert-loader');
const { montarLote, enviarLote, consultarLote } = require('../utils/transmissor');

// GET /api/reinf/versao — leiaute e revisao de XSD em uso.
router.get('/versao', (req, res) => {
  res.json({ leiaute: LEIAUTE_REINF, xsdR4010: REVISAO_XSD_R4010, loteXsd: 'v1_00_00' });
});

// GET /api/reinf/certificado — diagnostico: confirma leitura do A1 (sem expor segredo).
router.get('/certificado', async (req, res) => {
  try {
    const c = await loadCertificado();
    res.json({ ok: true, titular: c.titular, validade: c.notAfter, version: c.version });
  } catch (err) {
    res.status(502).json({ ok: false, erro: err.message });
  }
});

// POST /api/reinf/r1000 — gera o evento R-1000 (sem assinar).
router.post('/r1000', (req, res) => {
  try {
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...gerarR1000(req.body || {}) });
  } catch (err) { res.status(400).json({ ok: false, erro: err.message }); }
});

// POST /api/reinf/r4010 — gera o LOTE de eventos R-4010 da planilha (sem assinar).
router.post('/r4010', (req, res) => {
  try {
    const eventos = gerarEventosR4010DaPlanilha(req.body || {});
    res.json({
      ok: true, leiaute: LEIAUTE_REINF, qtdEventos: eventos.length,
      eventos: eventos.map((e) => ({ id: e.id, cpf: e.cpf, nome: e.nome, xml: e.xml })),
    });
  } catch (err) { res.status(400).json({ ok: false, erro: err.message }); }
});

// POST /api/reinf/r4010/unitario — gera UM evento R-4010 (sem assinar).
router.post('/r4010/unitario', (req, res) => {
  try {
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...gerarR4010(req.body || {}) });
  } catch (err) { res.status(400).json({ ok: false, erro: err.message }); }
});

// POST /api/reinf/r4099 — gera o evento R-4099 de fechamento (sem assinar).
router.post('/r4099', (req, res) => {
  try {
    res.json({ ok: true, leiaute: LEIAUTE_REINF, ...gerarR4099(req.body || {}) });
  } catch (err) { res.status(400).json({ ok: false, erro: err.message }); }
});

// POST /api/reinf/transmitir — fluxo completo: gera o trio, assina cada evento,
// monta o lote e transmite ao Ambiente Nacional. Retorna o protocolo.
//
// Body: { contribuinte, estabelecimento, perApur, tpAmb, dtPagamento,
//         iniValid, classTrib, contato, locadores, respInfo?, incluirR1000? }
router.post('/transmitir', async (req, res) => {
  try {
    const p = req.body || {};
    const tpAmb = p.tpAmb || 2;

    // 1) gera o trio com sequencial continuo (ids unicos)
    const trio = gerarTrioReinf(p);

    // 2) carrega o A1 da SP e assina cada evento
    const cert = await loadCertificado();
    const assinados = trio.eventos.map((e) => assinarEventoReinf(e.xml, cert));

    // 3) monta o lote e transmite
    const loteContrib = p.loteContribuinte || p.contribuinte;
    const r = await enviarLote(assinados, loteContrib, tpAmb);

    res.json({
      ok: r.status === 201,
      httpStatus: r.status,
      protocolo: r.protocolo,
      qtdEventos: assinados.length,
      ids: trio.eventos.map((e) => e.id),
      xmlRetorno: r.xml,
    });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

// GET /api/reinf/lote/:protocolo — consulta o resultado do processamento do lote.
router.get('/lote/:protocolo', async (req, res) => {
  try {
    const tpAmb = Number(req.query.tpAmb) || 2;
    const r = await consultarLote(req.params.protocolo, tpAmb);
    res.json({ ok: true, httpStatus: r.status, cdResposta: r.cdResposta, xml: r.xml });
  } catch (err) {
    res.status(400).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
