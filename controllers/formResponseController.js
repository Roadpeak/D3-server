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

exports.updateFormResponse = async (req, res) => {
  try {
    const { id } = req.params; // Get response ID from URL params
    const { response_data } = req.body; // Get updated data from request body

    const response = await FormResponse.findByPk(id); // Find the form response by ID

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    // Update the response_data field
    await response.update({ response_data });

    return res.status(200).json({ message: 'Form response updated successfully', response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating form response' });
  }
};

exports.deleteFormResponse = async (req, res) => {
  try {
    const { id } = req.params; // Get response ID from URL params

    const response = await FormResponse.findByPk(id); // Find the form response by ID

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }

    // Delete the response
    await response.destroy();

    return res.status(200).json({ message: 'Form response deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting form response' });
  }
};
