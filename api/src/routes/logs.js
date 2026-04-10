const router = require('express').Router();
const { db }  = require('../firebase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/logs — histórico de processamentos (admin vê tudo, operador vê só os seus)
router.get('/', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.uid).get();
    const isAdmin = snap.exists && snap.data().role === 'admin';

    let query = db.collection('processLogs').orderBy('timestamp', 'desc').limit(200);
    if (!isAdmin) query = query.where('userId', '==', req.uid);

    const logs = (await query.get()).docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/logs — registra processamento (chamado pelo frontend)
router.post('/', requireAuth, async (req, res) => {
  const { company, companyCNPJ, competencia, codEvento, totalFuncionarios, totalBruto, filesGenerated } = req.body;
  try {
    const snap = await db.collection('users').doc(req.uid).get();
    const userData = snap.data() || {};
    const ref = await db.collection('processLogs').add({
      userId: req.uid,
      userEmail: req.email,
      userName: userData.nome || req.email,
      company: company || '',
      companyCNPJ: companyCNPJ || '',
      competencia: competencia || '',
      codEvento: codEvento || '',
      totalFuncionarios: totalFuncionarios || 0,
      totalBruto: totalBruto || 0,
      filesGenerated: filesGenerated || [],
      timestamp: new Date().toISOString(),
    });
    // Atualiza lastLogin do usuário
    await db.collection('users').doc(req.uid).update({ lastLogin: new Date().toISOString() });
    res.status(201).json({ id: ref.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
