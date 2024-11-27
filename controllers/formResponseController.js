const { FormResponse } = require('../models');

exports.createFormResponse = async (req, res) => {
  try {
    const response = await FormResponse.create(req.body);
    return res.status(201).json({ response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating form response' });
  }
};

exports.getFormResponses = async (req, res) => {
  try {
    const responses = await FormResponse.findAll();
    return res.status(200).json({ responses });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching form responses' });
  }
};

exports.getFormResponseById = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await FormResponse.findByPk(id);

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    return res.status(200).json({ response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching form response' });
  }
};

exports.updateFormResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await FormResponse.findByPk(id);

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    const updatedResponse = await response.update(req.body);
    return res.status(200).json({ response: updatedResponse });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating form response' });
  }
};

exports.deleteFormResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await FormResponse.findByPk(id);

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    await response.destroy();
    return res.status(200).json({ message: 'Form response deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting form response' });
  }
};
