const { FormResponse } = require('../models');

exports.createFormResponse = async (req, res) => {
  try {
    const { form_id, response_data } = req.body;
    const response = await FormResponse.create({ form_id, response_data });
    return res.status(201).json({ response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating form response' });
  }
};

exports.getFormResponses = async (req, res) => {
  try {
    const { form_id } = req.params;
    const responses = await FormResponse.findAll({ where: { form_id } });
    return res.status(200).json({ responses });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching form responses' });
  }
};
