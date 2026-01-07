const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/envConfig");

exports.generateToken = (payload, expiresIn = "1h") => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};


exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

exports.authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      status: false,
      message: "Authorization token missing",
    });
  }

  try {
    const decoded = exports.verifyToken(token); 
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      status: false,
      message: "Token verification failed",
    });
  }
};

exports.authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        status: false,
        message: "You don't have permission to access this resource",
      });
    }

    next();
  };
};
