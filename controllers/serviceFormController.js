const { ServiceForm } = require('../models');

exports.createServiceForm = async (req, res) => {
  try {
    const form = await ServiceForm.create(req.body);
    return res.status(201).json({ form });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating service form' });
  }
};

exports.getServiceForms = async (req, res) => {
  try {
    const forms = await ServiceForm.findAll();
    return res.status(200).json({ forms });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching service forms' });
  }
};

exports.getServiceFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await ServiceForm.findByPk(id);

    if (!form) {
      return res.status(404).json({ message: 'Service form not found' });
    }

    return res.status(200).json({ form });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching service form' });
  }
};

exports.updateServiceForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await ServiceForm.findByPk(id);

    if (!form) {
      return res.status(404).json({ message: 'Service form not found' });
    }

    const updatedForm = await form.update(req.body);
    return res.status(200).json({ form: updatedForm });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating service form' });
  }
};

exports.deleteServiceForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await ServiceForm.findByPk(id);

    if (!form) {
      return res.status(404).json({ message: 'Service form not found' });
    }

    await form.destroy();
    return res.status(200).json({ message: 'Service form deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting service form' });
  }
};
