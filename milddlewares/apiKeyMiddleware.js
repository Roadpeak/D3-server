const validApiKey = process.env.API_KEY;

const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.header('api-key');

    if (!apiKey) {
        return res.status(400).json({ message: 'API key is missing' });
    }

    if (apiKey !== validApiKey) {
        return res.status(403).json({ message: 'Forbidden: Invalid API key' });
    }

    next();
};

module.exports = apiKeyMiddleware;
