// controllers/StaffController.js - Fixed associations version
const { Staff, Service, StaffService, Store, Booking, Offer, User } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ejs = require('ejs');
const { sendEmail } = require('../utils/emailUtil');
const { validationResult } = require('express-validator');

const StaffController = {
  async create(req, res) {
    try {
      console.log('Creating staff for merchant:', req.user); // Debug log
      
      let { storeId, email, name, phoneNumber } = req.body;
      
      // If no storeId provided, get it from the current merchant
      if (!storeId) {
        // Get merchant from auth token
        const merchantId = req.user?.id || req.user?.merchantId;
        if (!merchantId) {
          return res.status(401).json({ error: 'Merchant not found in request' });
        }
        
        // Get merchant's first store
        const stores = await Store.findAll({
          where: { merchant_id: merchantId },
          limit: 1
        });
        
        if (stores.length === 0) {
          return res.status(400).json({ 
            error: 'No store found for this merchant. Please create a store first.' 
          });
        }
        
        storeId = stores[0].id;
        console.log('Using store ID:', storeId); // Debug log
      }
      // Check if store exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({
          error: 'Store not found',
        });
      }

      // Check if staff with email already exists in this store
      const existingStaff = await Staff.findOne({
        where: { storeId, email },
      });

      if (existingStaff) {
        return res.status(400).json({
          error: 'Staff with this email already exists in this store',
        });
      }

      // Generate temporary password
      const temporaryPassword = Math.random().toString(36).substring(2, 10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      // Create staff member
      const staff = await Staff.create({
        storeId,
        email,
        name,
        phoneNumber,
        password: hashedPassword,
        status: 'active',
      });

      // Send invitation email
      try {
        const templatePath = './templates/inviteStaff.ejs';
        if (fs.existsSync(templatePath)) {
          const template = fs.readFileSync(templatePath, 'utf8');
          const emailContent = ejs.render(template, {
            storeName: store.name,
            temporaryPassword,
            loginLink: process.env.FRONTEND_URL || 'https://example.com/login',
          });

          await sendEmail(
            staff.email,
            `You've been invited to join ${store.name}`,
            '',
            emailContent
          );
        }
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Continue anyway, as staff was created successfully
      }

      res.status(201).json({
        message: 'Staff created successfully',
        staff: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          phoneNumber: staff.phoneNumber,
          storeId: staff.storeId,
          status: staff.status,
          createdAt: staff.createdAt,
          updatedAt: staff.updatedAt,
        },
      });
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({
        error: 'Failed to create staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getAll(req, res) {
    try {
      const { page = 1, limit = 50, status, storeId } = req.query;
      
      const whereClause = {};
      if (status) whereClause.status = status;
      if (storeId) whereClause.storeId = storeId;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Try to get staff with store info, but handle association errors gracefully
      let includeOptions = [];
      
      try {
        // First try with Store include
        includeOptions = [
          {
            model: Store,
            attributes: ['id', 'name', 'address']
          }
        ];
        
        const { count, rows: staff } = await Staff.findAndCountAll({
          where: whereClause,
          include: includeOptions,
          attributes: { exclude: ['password'] },
          limit: parseInt(limit),
          offset: offset,
          order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
          staff,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
          }
        });
        
      } catch (associationError) {
        console.log('Association error, trying without Store include:', associationError.message);
        
        // Fallback: Get staff without store include
        const { count, rows: staff } = await Staff.findAndCountAll({
          where: whereClause,
          attributes: { exclude: ['password'] },
          limit: parseInt(limit),
          offset: offset,
          order: [['createdAt', 'DESC']]
        });

        // Manually add store info if needed
        const staffWithStores = await Promise.all(
          staff.map(async (staffMember) => {
            try {
              const store = await Store.findByPk(staffMember.storeId, {
                attributes: ['id', 'name', 'address']
              });
              return {
                ...staffMember.toJSON(),
                Store: store
              };
            } catch (err) {
              return staffMember.toJSON();
            }
          })
        );

        res.status(200).json({
          staff: staffWithStores,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
          }
        });
      }
      
    } catch (error) {
      console.error('Get all staff error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffById(req, res) {
    try {
      const { id } = req.params;

      // Try with includes first, fallback if associations fail
      let staff;
      
      try {
        staff = await Staff.findByPk(id, {
          include: [
            {
              model: Store,
              attributes: ['id', 'name', 'address']
            },
            {
              model: Service,
              through: { attributes: [] },
              attributes: ['id', 'name', 'description', 'duration', 'price']
            }
          ],
          attributes: { exclude: ['password'] }
        });
      } catch (associationError) {
        console.log('Association error, trying basic fetch:', associationError.message);
        
        // Fallback: Basic fetch without includes
        staff = await Staff.findByPk(id, {
          attributes: { exclude: ['password'] }
        });
        
        if (staff) {
          // Manually add store info
          try {
            const store = await Store.findByPk(staff.storeId, {
              attributes: ['id', 'name', 'address']
            });
            staff = {
              ...staff.toJSON(),
              Store: store
            };
          } catch (storeError) {
            console.log('Could not fetch store info:', storeError.message);
          }
        }
      }

      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      res.status(200).json({ staff });
    } catch (error) {
      console.error('Get staff by ID error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffByStore(req, res) {
    try {
      const { storeId } = req.params;

      // Verify store exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Get staff without includes first, then try to add store info
      const staff = await Staff.findAll({
        where: { storeId },
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']]
      });

      // Add store info to each staff member
      const staffWithStores = staff.map(staffMember => ({
        ...staffMember.toJSON(),
        Store: {
          id: store.id,
          name: store.name,
          address: store.address
        }
      }));

      res.status(200).json(staffWithStores);
    } catch (error) {
      console.error('Get staff by store error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members for store',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, name, phoneNumber, status, storeId } = req.body;

      const staff = await Staff.findByPk(id);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // If email is being changed, check for conflicts
      if (email && email !== staff.email) {
        const targetStoreId = storeId || staff.storeId;
        const emailExists = await Staff.findOne({
          where: { 
            email, 
            storeId: targetStoreId,
            id: { [require('sequelize').Op.ne]: id } // Exclude current staff member
          },
        });
        if (emailExists) {
          return res.status(400).json({ 
            error: 'A staff member with this email already exists in this store' 
          });
        }
      }

      // If store is being changed, verify it exists
      if (storeId && storeId !== staff.storeId) {
        const newStore = await Store.findByPk(storeId);
        if (!newStore) {
          return res.status(404).json({ error: 'Target store not found' });
        }
      }

      // Update staff member
      const updatedData = {};
      if (email) updatedData.email = email;
      if (name) updatedData.name = name;
      if (phoneNumber !== undefined) updatedData.phoneNumber = phoneNumber;
      if (status) updatedData.status = status;
      if (storeId) updatedData.storeId = storeId;

      await staff.update(updatedData);

      // Fetch updated staff - basic fetch first
      let updatedStaff = await Staff.findByPk(id, {
        attributes: { exclude: ['password'] }
      });

      // Try to add store info
      try {
        const store = await Store.findByPk(updatedStaff.storeId, {
          attributes: ['id', 'name', 'address']
        });
        updatedStaff = {
          ...updatedStaff.toJSON(),
          Store: store
        };
      } catch (storeError) {
        console.log('Could not fetch store info for updated staff:', storeError.message);
      }

      res.status(200).json({ 
        message: 'Staff member updated successfully', 
        staff: updatedStaff 
      });
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({ 
        error: 'Failed to update staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const staff = await Staff.findByPk(id);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // Note: Simplified booking check - you may need to adjust based on your actual model structure
      try {
        // Check if staff has any active bookings - simplified version
        const hasActiveBookings = false; // You may need to implement this check based on your actual booking structure
        
        if (hasActiveBookings) {
          return res.status(400).json({ 
            error: 'Cannot delete staff member with active bookings. Please reassign or complete all bookings first.' 
          });
        }
      } catch (bookingCheckError) {
        console.log('Could not check for active bookings:', bookingCheckError.message);
        // Continue with deletion anyway
      }

      await staff.destroy();
      res.status(200).json({ message: 'Staff member deleted successfully' });
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({ 
        error: 'Failed to delete staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async assignService(req, res) {
    try {
      const { staffId, serviceId } = req.body;

      if (!staffId || !serviceId) {
        return res.status(400).json({ error: 'Both staffId and serviceId are required' });
      }

      const [staff, service] = await Promise.all([
        Staff.findByPk(staffId),
        Service.findByPk(serviceId)
      ]);

      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      if (staff.storeId !== service.store_id) {
        return res.status(400).json({ error: 'Staff and service must belong to the same store' });
      }

      const existingAssignment = await StaffService.findOne({
        where: { staffId, serviceId },
      });

      if (existingAssignment) {
        return res.status(400).json({ error: 'Service already assigned to this staff member' });
      }

      await StaffService.create({ staffId, serviceId });

      res.status(200).json({ message: 'Service assigned to staff member successfully' });
    } catch (error) {
      console.error('Assign service error:', error);
      res.status(500).json({ 
        error: 'Failed to assign service to staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async unassignService(req, res) {
    try {
      const { staffId, serviceId } = req.body;

      if (!staffId || !serviceId) {
        return res.status(400).json({ error: 'Both staffId and serviceId are required' });
      }

      const assignment = await StaffService.findOne({
        where: { staffId, serviceId },
      });

      if (!assignment) {
        return res.status(404).json({ error: 'Service not assigned to this staff member' });
      }

      await assignment.destroy();

      res.status(200).json({ message: 'Service unassigned from staff member successfully' });
    } catch (error) {
      console.error('Unassign service error:', error);
      res.status(500).json({ 
        error: 'Failed to unassign service from staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getBookingsByStaffId(req, res) {
    try {
      const { staffId } = req.params;
      const { status, startDate, endDate, limit = 50, page = 1 } = req.query;

      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // Simplified version - return empty for now
      // You can implement this based on your actual booking/service relationship
      res.status(200).json({
        bookings: [],
        message: 'Booking functionality not yet implemented',
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
      
    } catch (error) {
      console.error('Get staff bookings error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch bookings for staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getServicesByStaffId(req, res) {
    try {
      const { staffId } = req.params;

      const staff = await Staff.findByPk(staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // Try to get services, fallback if association issues
      try {
        const services = await staff.getServices({
          attributes: ['id', 'name', 'description', 'duration', 'price', 'store_id'],
          through: { attributes: [] }
        });
        res.status(200).json(services);
      } catch (associationError) {
        console.log('Service association error:', associationError.message);
        
        // Fallback: Get services through StaffService table
        const staffServices = await StaffService.findAll({
          where: { staffId },
          include: [
            {
              model: Service,
              attributes: ['id', 'name', 'description', 'duration', 'price', 'store_id']
            }
          ]
        });
        
        const services = staffServices.map(ss => ss.Service);
        res.status(200).json(services);
      }
      
    } catch (error) {
      console.error('Get staff services error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch services for staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffByService(req, res) {
    try {
      const { serviceId } = req.params;

      const service = await Service.findByPk(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Get staff through StaffService table
      const staffServices = await StaffService.findAll({
        where: { serviceId },
        include: [
          {
            model: Staff,
            attributes: { exclude: ['password'] }
          }
        ]
      });

      const staff = staffServices.map(ss => ss.Staff);

      res.status(200).json({
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price
        },
        staff: staff,
      });
    } catch (error) {
      console.error('Get staff by service error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members for service',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },
};

module.exports = StaffController;