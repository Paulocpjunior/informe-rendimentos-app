const router  = require('express').Router();
const { auth, db } = require('../firebase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/users — lista todos os colaboradores
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users — cria novo colaborador
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { email, nome, role = 'operator', password } = req.body;
  if (!email || !nome || !password)
    return res.status(400).json({ error: 'email, nome e password são obrigatórios' });
  try {
    const userRecord = await auth.createUser({ email, password, displayName: nome });
    await db.collection('users').doc(userRecord.uid).set({
      email, nome, role,
      createdAt: new Date().toISOString(),
      createdBy: req.email,
      lastLogin: null,
      active: true,
    });
    res.status(201).json({ uid: userRecord.uid, email, nome, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:uid — atualiza role ou nome
router.patch('/:uid', requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const { role, nome, active } = req.body;
  const update = {};
  if (role   !== undefined) update.role   = role;
  if (nome   !== undefined) update.nome   = nome;
  if (active !== undefined) update.active = active;
  try {
    await db.collection('users').doc(uid).update(update);
    if (nome) await auth.updateUser(uid, { displayName: nome });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:uid — remove colaborador
router.delete('/:uid', requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  if (uid === req.uid) return res.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
  try {
    await auth.deleteUser(uid);
    await db.collection('users').doc(uid).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users/invite — envia convite por e-mail
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  const { email, nome, role = 'operator' } = req.body;
  if (!email || !nome) return res.status(400).json({ error: 'email e nome são obrigatórios' });
  try {
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    await db.collection('invites').doc(token).set({
      email, nome, role, token,
      createdBy: req.email,
      createdAt: new Date().toISOString(),
      expiresAt, used: false,
    });
    // Link de convite (o front vai usar este token para criar a conta)
    const inviteLink = `${process.env.APP_URL}/cadastro?token=${token}`;
    res.json({ inviteLink, token, expiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
