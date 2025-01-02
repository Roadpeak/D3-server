const { Staff, Service, StaffService, Store, Booking, Offer, User } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ejs = require('ejs');
const { sendEmail } = require('../utils/emailUtil');

const StaffController = {

  async create(req, res) {
    const { storeId, email, name } = req.body;

    try {
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({
          error: 'Store not found',
        });
      }

      const existingStaff = await Staff.findOne({
        where: { storeId, email },
      });

      if (existingStaff) {
        return res.status(400).json({
          error: 'Staff with this email already exists in this store',
        });
      }

      const temporaryPassword = Math.random().toString(36).substring(2, 10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      const staff = await Staff.create({
        storeId,
        email,
        name,
        password: hashedPassword,
        status: 'active',
      });

      const templatePath = './templates/inviteStaff.ejs';
      const template = fs.readFileSync(templatePath, 'utf8');
      const emailContent = ejs.render(template, {
        storeName: store.name,
        temporaryPassword,
        loginLink: 'https://example.com/login',
      });

      await sendEmail(
        staff.email,
        `You’ve been invited to join ${store.name}`,
        '',
        emailContent
      );

      res.status(201).json({
        message: 'Staff created successfully, and invitation email sent',
        staff: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          storeId: staff.storeId,
          status: staff.status,
          createdAt: staff.createdAt,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: 'Failed to create staff',
      });
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

  async getStaffById(req, res) {
    const { id } = req.params;

    try {
      const staff = await Staff.findByPk(id);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const services = await staff.getServices();

      res.status(200).json({
        staff,
        services,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  },

  async getStaffByStore(req, res) {
    const { storeId } = req.params;

    try {
      const store = await Store.findByPk(storeId);
      console.log(storeId)
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      const staff = await Staff.findAll({
        where: { storeId },
      });

      if (!staff.length) {
        return res.status(404).json({ error: 'No staff found for this store' });
      }

      res.status(200).json(staff);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  },

  async update(req, res) {
    const { id } = req.params;
    const { email, name, phoneNumber, status, storeId } = req.body;

    try {
      const staff = await Staff.findByPk(id);

      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      if (email && email !== staff.email) {
        const emailExists = await Staff.findOne({
          where: { email, storeId: staff.storeId },
        });
        if (emailExists) {
          return res
            .status(400)
            .json({ error: 'A staff member with this email already exists in this store' });
        }
        staff.email = email;
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

  async assignService(req, res) {
    const { staffId, serviceId } = req.body;

    try {
      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const service = await Service.findByPk(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      if (staff.storeId !== service.store_id) {
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

      await assignment.destroy();

      res.status(200).json({ message: 'Service unassigned from staff successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to unassign service from staff' });
    }
  },

  async getBookingsByStaffId(req, res) {
    const { staffId } = req.params;

    try {
      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const services = await staff.getServices();
      if (!services.length) {
        return res.status(404).json({ error: 'No services assigned to this staff' });
      }

      const bookings = await Booking.findAll({
        include: [
          {
            model: Offer,
            where: {
              service_id: services.map(service => service.id), 
            },
            include: [
              {
                model: Service,
                required: true,
              },
            ],
          },
          {
            model: User,
            attributes: ['firstname', 'lastName', 'email', 'phoneNumber'],
          },
        ],
      });

      if (!bookings.length) {
        return res.status(404).json({ error: 'No bookings found for this staff' });
      }

      res.status(200).json(bookings);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch bookings for staff' });
    }
  },

  async getServicesByStaffId(req, res) {
    const { staffId } = req.params;

    try {
      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      const services = await staff.getServices();
      res.status(200).json(services);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch services for staff' });
    }
  },
};

module.exports = StaffController;
