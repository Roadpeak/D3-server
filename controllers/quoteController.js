const { Quote } = require('../models');

exports.createQuote = async (req, res) => {
  try {
    const quote = await Quote.create(req.body);
    return res.status(201).json({ quote });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating quote' });
  }
};

exports.getQuotes = async (req, res) => {
  try {
    const quotes = await Quote.findAll();
    return res.status(200).json({ quotes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching quotes' });
  }
};

exports.getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    return res.status(200).json({ quote });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching quote' });
  }
};

exports.updateQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    const updatedQuote = await quote.update(req.body);
    return res.status(200).json({ quote: updatedQuote });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating quote' });
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    await quote.destroy();
    return res.status(200).json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting quote' });
  }
};
