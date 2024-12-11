const { FormField } = require('../models');

exports.createFormField = async (req, res) => {
    try {
        const { form_id, field_name, field_type, required } = req.body;
        const field = await FormField.create({ form_id, field_name, field_type, required });
        return res.status(201).json({ field });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error creating form field' });
    }
};

exports.getFormFields = async (req, res) => {
    try {
        const { form_id } = req.params;
        const fields = await FormField.findAll({ where: { form_id } });
        return res.status(200).json({ fields });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching form fields' });
    }
};

exports.updateFormField = async (req, res) => {
    try {
        const { id } = req.params;
        const field = await FormField.findByPk(id);

        if (!field) {
            return res.status(404).json({ message: 'Form field not found' });
        }

        const updatedField = await field.update(req.body);
        return res.status(200).json({ field: updatedField });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error updating form field' });
    }
};

exports.deleteFormField = async (req, res) => {
    try {
        const { id } = req.params;
        const field = await FormField.findByPk(id);

        if (!field) {
            return res.status(404).json({ message: 'Form field not found' });
        }

        await field.destroy();
        return res.status(200).json({ message: 'Form field deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error deleting form field' });
    }
};
