const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Decode token and set user in req
    req.user = decodeToken(token); // Implement this function
    next();
};

module.exports = { authenticateUser };
