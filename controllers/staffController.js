const { Staff, Service, StaffService } = require('../models');  // Assuming StaffService model exists
const bcrypt = require('bcrypt');
const { sendResetPasswordEmail } = require('../utils/email'); // Assuming an email utility exists

const StaffController = {
  async create(req, res) {
    const { storeId, name, email, phoneNumber, status } = req.body;

    try {
      // Check for duplicate email
      const existingStaff = await Staff.findOne({ where: { email } });
      if (existingStaff) {
        return res.status(400).json({ error: 'Staff with this email already exists' });
      }

      // Generate a temporary password and hash it
      const temporaryPassword = Math.random().toString(36).substring(2, 10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      const staff = await Staff.create({
        storeId,
        name,
        email,
        phoneNumber,
        status,
        password: hashedPassword,
      });

      // Send reset password email
      await sendResetPasswordEmail(email, temporaryPassword);

      res.status(201).json({ message: 'Staff created successfully', staff });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create staff' });
    }
  },

  async getAll(req, res) {
    try {
      const staff = await Staff.findAll();
      res.status(200).json(staff);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  },

  async update(req, res) {
    const { id } = req.params;
    const { name, phoneNumber, status } = req.body;

    try {
      const staff = await Staff.findByPk(id);

      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      staff.name = name || staff.name;
      staff.phoneNumber = phoneNumber || staff.phoneNumber;
      staff.status = status || staff.status;
      await staff.save();

      res.status(200).json({ message: 'Staff updated successfully', staff });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update staff' });
    }
  },

  async delete(req, res) {
    const { id } = req.params;

    try {
      const staff = await Staff.findByPk(id);

      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      await staff.destroy();
      res.status(200).json({ message: 'Staff deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  },

  // Assign service to staff
  async assignService(req, res) {
    const { staffId, serviceId } = req.body;

    try {
      // Find staff and check storeId
      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      // Find service and check storeId
      const service = await Service.findByPk(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      if (staff.storeId !== service.storeId) {
        return res.status(400).json({ error: 'Store ID mismatch' });
      }

      const existingAssignment = await StaffService.findOne({
        where: { staffId, serviceId },
      });
      if (existingAssignment) {
        return res.status(400).json({ error: 'Service already assigned to staff' });
      }

      await StaffService.create({ staffId, serviceId });

      res.status(200).json({ message: 'Service assigned to staff successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to assign service to staff' });
    }
  },

  async unassignService(req, res) {
    const { staffId, serviceId } = req.body;

    try {
      const assignment = await StaffService.findOne({
        where: { staffId, serviceId },
      });
      if (!assignment) {
        return res.status(404).json({ error: 'Service not assigned to this staff' });
      }

      // Delete the assignment
      await assignment.destroy();

      res.status(200).json({ message: 'Service unassigned from staff successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to unassign service from staff' });
    }
  },

  // Get services by staff id
  async getServicesByStaffId(req, res) {
    const { staffId } = req.params;

    try {
      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      // Get services assigned to the staff
      const services = await staff.getServices();
      res.status(200).json(services);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch services for staff' });
    }
  },
};

module.exports = StaffController;
