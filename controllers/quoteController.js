const { Quote, FormResponse } = require('../models');

exports.createQuote = async (req, res) => {
  try {
    const { form_response_id, quote_details, status } = req.body;

    const formResponse = await FormResponse.findByPk(form_response_id);

    if (!formResponse) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    const quote = await Quote.create({
      form_response_id,
      quote_details,
      status,
    });

    return res.status(201).json({ quote });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating quote' });
  }
};

exports.getQuotesForFormResponse = async (req, res) => {
  try {
    const { form_response_id } = req.params;

    const quotes = await Quote.findAll({
      where: { form_response_id },
    });

    if (!quotes || quotes.length === 0) {
      return res.status(404).json({ message: 'No quotes found for this form response' });
    }

    return res.status(200).json({ quotes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching quotes' });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    quote.status = status;
    await quote.save();

    return res.status(200).json({ quote });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating quote' });
  }
};
