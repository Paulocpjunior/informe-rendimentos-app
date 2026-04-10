const { auth, db } = require('../firebase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token não informado' });
  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid   = decoded.uid;
    req.email = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const snap = await db.collection('users').doc(req.uid).get();
    if (!snap.exists || snap.data().role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Erro ao verificar permissão' });
  }
}

module.exports = { requireAuth, requireAdmin };
