const jwt = require('jsonwebtoken');
const { Merchant } = require('../models'); // Import the Merchant model

// Middleware to authenticate the user
const authenticate = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const merchant = await Merchant.findByPk(decoded.id);
        if (!merchant) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = merchant; // Set the user to req.user
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized', error });
    }
};

module.exports = authenticate;
