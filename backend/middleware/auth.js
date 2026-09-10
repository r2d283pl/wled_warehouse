const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Bez słabego, przewidywalnego domyślnego sekretu. Jeśli brak/za krótki — generujemy
// losowy na czas działania procesu (tokeny wygasną po restarcie) i głośno ostrzegamy.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16 || JWT_SECRET === 'default_secret' || JWT_SECRET === 'your_secret_here') {
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  JWT_SECRET nieustawiony / zbyt słaby — użyto losowego sekretu (sesje wygasną po restarcie). USTAW silny JWT_SECRET w .env!');
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }  // długa sesja — panele/tablety operatorów nie wylogowują się codziennie
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Brak tokena autoryzacyjnego' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // 401 (nie 403) — to brak ważnej autoryzacji; frontend na 401 czysto wylogowuje do ekranu logowania
      return res.status(401).json({ error: 'Token wygasł lub jest nieprawidłowy' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Tylko dla administratora' });
  }
  next();
}

module.exports = { generateToken, authenticateToken, requireAdmin };