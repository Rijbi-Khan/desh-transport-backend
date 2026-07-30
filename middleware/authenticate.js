const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const { hashSessionToken } = require('../utils/auth');

function authenticate(role) {
  const Model = role === 'admin' ? Admin : Driver;

  return async (req, res, next) => {
    try {
      const authorization = req.headers.authorization || '';
      const [scheme, token] = authorization.split(' ');
      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'লগইন ছাড়া এই কাজটি করা যাবে না।' });
      }

      const user = await Model.findOne({
        authTokenHash: hashSessionToken(token),
        authTokenExpiresAt: { $gt: new Date() },
      });

      if (!user) {
        return res.status(401).json({ message: 'আপনার সেশনটি শেষ হয়ে গেছে। আবার লগইন করুন।' });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { authenticate };
