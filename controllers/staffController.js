// controllers/StaffController.js - Complete Updated Version with Fixed Associations
const { Staff, Service, StaffService, Store, Booking, Offer, User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ejs = require('ejs');
const { sendEmail } = require('../utils/emailUtil');
const { validationResult } = require('express-validator');

const StaffController = {
  async create(req, res) {
    try {
      console.log('📝 Creating staff for merchant:', req.user?.id);
      console.log('📋 Request data:', req.body);
      
      let { storeId, email, name, phoneNumber, branchId, role = 'staff' } = req.body;
      
      // If no storeId provided, get it from the current merchant
      if (!storeId) {
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
        console.log('🏪 Using store ID:', storeId);
      }

      // Check if store exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({
          error: 'Store not found',
        });
      }

      // Validate role
      const validRoles = ['staff', 'manager', 'supervisor', 'cashier', 'sales'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
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

      // Create staff member with new fields
      const staffData = {
        storeId,
        email,
        name,
        phoneNumber,
        password: hashedPassword,
        status: 'active',
        role: role || 'staff'
      };

      // Add branchId if provided
      if (branchId) {
        staffData.branchId = branchId;
      }

      console.log('💾 Creating staff with data:', staffData);
      const staff = await Staff.create(staffData);

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
          branchId: staff.branchId,
          role: staff.role,
          status: staff.status,
          createdAt: staff.createdAt,
          updatedAt: staff.updatedAt,
        },
      });
    } catch (error) {
      console.error('❌ Create staff error:', error);
      res.status(500).json({
        error: 'Failed to create staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getAll(req, res) {
    try {
      const { page = 1, limit = 50, status, storeId, branchId, role } = req.query;
      
      console.log('🔍 Staff getAll called with params:', { page, limit, status, storeId, branchId, role });
      console.log('👤 Current merchant:', req.user?.id);
      
      const merchantId = req.user?.id || req.user?.merchantId;
      if (!merchantId) {
        return res.status(401).json({ error: 'Merchant not found in request' });
      }

      // ✅ FIXED: Build whereClause with merchant store filtering
      const whereClause = {};
      if (status) whereClause.status = status;
      if (branchId) whereClause.branchId = branchId;
      if (role) whereClause.role = role;

      // If specific storeId provided, verify it belongs to the merchant
      if (storeId) {
        const store = await Store.findOne({
          where: { 
            id: storeId, 
            merchant_id: merchantId 
          }
        });
        
        if (!store) {
          return res.status(403).json({ 
            error: 'Store not found or does not belong to your account' 
          });
        }
        
        whereClause.storeId = storeId;
      }

      console.log('📋 Staff query filters:', whereClause);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // ✅ FIXED: Include store filter to only show staff from merchant's stores
      const includeOptions = [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location'],
          where: {
            merchant_id: merchantId // ← Only include stores belonging to this merchant
          },
          required: true // ← Inner join to ensure staff must belong to merchant's stores
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

      console.log('✅ Found staff members for merchant:', count, 'staff returned');

      res.status(200).json({
        staff,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
      
    } catch (error) {
      console.error('❌ Get all staff error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffById(req, res) {
    try {
      const { id } = req.params;
      const merchantId = req.user?.id || req.user?.merchantId;
      
      if (!merchantId) {
        return res.status(401).json({ error: 'Merchant not found in request' });
      }

      // ✅ FIXED: Include merchant store filter to ensure staff belongs to merchant
      const staff = await Staff.findByPk(id, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'location'],
            where: {
              merchant_id: merchantId // ← Only allow access to staff from merchant's stores
            },
            required: true // ← Inner join to ensure staff must belong to merchant's stores
          }
        ],
        attributes: { exclude: ['password'] }
      });

      if (!staff) {
        return res.status(404).json({ 
          error: 'Staff member not found or does not belong to your stores' 
        });
      }

      res.status(200).json({ staff });
    } catch (error) {
      console.error('❌ Get staff by ID error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffByStore(req, res) {
    try {
      const { storeId } = req.params;
      const { branchId, role, status } = req.query;
      const merchantId = req.user?.id || req.user?.merchantId;
      
      if (!merchantId) {
        return res.status(401).json({ error: 'Merchant not found in request' });
      }

      // ✅ FIXED: Verify store exists AND belongs to the merchant
      const store = await Store.findOne({
        where: { 
          id: storeId,
          merchant_id: merchantId // ← Ensure store belongs to merchant
        }
      });
      
      if (!store) {
        return res.status(404).json({ 
          error: 'Store not found or does not belong to your account' 
        });
      }

      // Build where clause for filtering
      const whereClause = { storeId };
      if (branchId) whereClause.branchId = branchId;
      if (role) whereClause.role = role;
      if (status) whereClause.status = status;

      // ✅ FIXED: Use proper include with alias and merchant verification
      const staff = await Staff.findAll({
        where: whereClause,
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'location'],
            where: {
              merchant_id: merchantId // ← Double-check store ownership
            },
            required: true
          }
        ],
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json(staff);
    } catch (error) {
      console.error('❌ Get staff by store error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members for store',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, name, phoneNumber, status, storeId, branchId, role } = req.body;
      const merchantId = req.user?.id || req.user?.merchantId;

      console.log('🔄 Updating staff ID:', id);
      console.log('📋 Update data:', req.body);
      console.log('👤 Merchant ID:', merchantId);

      if (!merchantId) {
        return res.status(401).json({ error: 'Merchant not found in request' });
      }

      // ✅ FIXED: Ensure staff belongs to merchant's stores
      const staff = await Staff.findOne({
        where: { id },
        include: [
          {
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId // ← Ensure staff belongs to merchant's stores
            },
            required: true
          }
        ]
      });

      if (!staff) {
        return res.status(404).json({ 
          error: 'Staff member not found or does not belong to your stores' 
        });
      }

      // If email is being changed, check for conflicts within merchant's stores
      if (email && email !== staff.email) {
        const targetStoreId = storeId || staff.storeId;
        
        // ✅ FIXED: Only check for conflicts within merchant's stores
        const emailExists = await Staff.findOne({
          where: { 
            email, 
            storeId: targetStoreId,
            id: { [require('sequelize').Op.ne]: id }
          },
          include: [
            {
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId // ← Only check within merchant's stores
              },
              required: true
            }
          ]
        });
        
        if (emailExists) {
          return res.status(400).json({ 
            error: 'A staff member with this email already exists in this store' 
          });
        }
      }

      // If store is being changed, verify it exists and belongs to merchant
      if (storeId && storeId !== staff.storeId) {
        const newStore = await Store.findOne({
          where: { 
            id: storeId,
            merchant_id: merchantId // ← Ensure target store belongs to merchant
          }
        });
        
        if (!newStore) {
          return res.status(404).json({ 
            error: 'Target store not found or does not belong to your account' 
          });
        }
      }

      // Validate role if provided
      if (role) {
        const validRoles = ['staff', 'manager', 'supervisor', 'cashier', 'sales'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
          });
        }
      }

      // Update staff member with all possible fields
      const updatedData = {};
      if (email) updatedData.email = email;
      if (name) updatedData.name = name;
      if (phoneNumber !== undefined) updatedData.phoneNumber = phoneNumber;
      if (status) updatedData.status = status;
      if (storeId) updatedData.storeId = storeId;
      if (branchId !== undefined) updatedData.branchId = branchId; // Allow null values
      if (role) updatedData.role = role;

      console.log('💾 Updating staff with data:', updatedData);

      await staff.update(updatedData);

      // ✅ FIXED: Fetch updated staff with proper include and merchant filter
      const updatedStaff = await Staff.findByPk(id, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'location'],
            where: {
              merchant_id: merchantId
            },
            required: true
          }
        ],
        attributes: { exclude: ['password'] }
      });

      res.status(200).json({ 
        message: 'Staff member updated successfully', 
        staff: updatedStaff 
      });
    } catch (error) {
      console.error('❌ Update staff error:', error);
      res.status(500).json({ 
        error: 'Failed to update staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const merchantId = req.user?.id || req.user?.merchantId;

      if (!merchantId) {
        return res.status(401).json({ error: 'Merchant not found in request' });
      }

      // ✅ FIXED: Ensure staff belongs to merchant's stores before deletion
      const staff = await Staff.findOne({
        where: { id },
        include: [
          {
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId // ← Ensure staff belongs to merchant's stores
            },
            required: true
          }
        ]
      });

      if (!staff) {
        return res.status(404).json({ 
          error: 'Staff member not found or does not belong to your stores' 
        });
      }

      // Check if staff has any active bookings or service assignments
      try {
        // Check for service assignments
        const serviceAssignments = await StaffService.findAll({
          where: { staffId: id }
        });

        if (serviceAssignments.length > 0) {
          return res.status(400).json({ 
            error: `Cannot delete staff member. They are assigned to ${serviceAssignments.length} service(s). Please unassign them first.`
          });
        }

        // Note: Add booking check here if you have a Booking model
        // const activeBookings = await Booking.findAll({
        //   where: { staffId: id, status: 'confirmed' }
        // });
        // if (activeBookings.length > 0) {
        //   return res.status(400).json({ 
        //     error: 'Cannot delete staff member with active bookings. Please reassign or complete all bookings first.' 
        //   });
        // }
      } catch (checkError) {
        console.log('Could not check for staff dependencies:', checkError.message);
        // Continue with deletion anyway
      }

      await staff.destroy();
      res.status(200).json({ message: 'Staff member deleted successfully' });
    } catch (error) {
      console.error('❌ Delete staff error:', error);
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
      console.error('❌ Assign service error:', error);
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
      console.error('❌ Unassign service error:', error);
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
      console.error('❌ Get staff bookings error:', error);
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

      console.log('🔍 Getting services for staff:', staffId);

      // ✅ IMPROVED: Use association with proper error handling
      let services = [];
      
      try {
        // Method 1: Try using the Staff association
        console.log('📋 Trying Method 1: staff.getServices()');
        services = await staff.getServices({
          attributes: ['id', 'name', 'description', 'duration', 'price', 'store_id'],
          through: { attributes: [] }
        });
        console.log('✅ Method 1 successful:', services.length, 'services found');
        
      } catch (associationError) {
        console.log('⚠️ Method 1 failed:', associationError.message);
        
        try {
          // Method 2: Query through StaffService table
          console.log('📋 Trying Method 2: StaffService query');
          const staffServices = await StaffService.findAll({
            where: { staffId },
            include: [
              {
                model: Service,
                attributes: ['id', 'name', 'description', 'duration', 'price', 'store_id']
              }
            ]
          });
          
          services = staffServices.map(ss => ss.Service).filter(s => s !== null);
          console.log('✅ Method 2 successful:', services.length, 'services found');
          
        } catch (tableError) {
          console.log('⚠️ Method 2 failed:', tableError.message);
          
          try {
            // Method 3: Raw query
            console.log('📋 Trying Method 3: Raw query');
            const results = await sequelize.query(`
              SELECT s.* FROM services s
              INNER JOIN staff_services ss ON s.id = ss.serviceId
              WHERE ss.staffId = :staffId
            `, {
              replacements: { staffId },
              type: sequelize.QueryTypes.SELECT
            });
            
            services = results;
            console.log('✅ Method 3 successful:', services.length, 'services found');
            
          } catch (rawError) {
            console.log('❌ All methods failed:', rawError.message);
            services = [];
          }
        }
      }

      res.status(200).json(services);
      
    } catch (error) {
      console.error('❌ Get staff services error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch services for staff member',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getStaffByService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('🔍 Getting staff for service:', serviceId);

      // First verify the service exists
      const service = await Service.findByPk(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      console.log('✅ Service found:', service.name);

      // ✅ IMPROVED: Use better query approach
      let staff = [];
      
      try {
        // Method 1: Try using the Service association
        console.log('📋 Trying Method 1: service.getStaff()');
        
        if (typeof service.getStaff === 'function') {
          staff = await service.getStaff({
            attributes: { exclude: ['password'] },
            through: { attributes: [] } // Exclude junction table data
          });
          console.log('✅ Method 1 successful:', staff.length, 'staff found');
        } else {
          throw new Error('getStaff method not available on service');
        }
        
      } catch (associationError) {
        console.log('⚠️ Method 1 failed:', associationError.message);
        
        try {
          // Method 2: Query through StaffService table directly
          console.log('📋 Trying Method 2: StaffService query');
          const staffServices = await StaffService.findAll({
            where: { serviceId },
            include: [
              {
                model: Staff,
                attributes: { exclude: ['password'] }
              }
            ]
          });
          
          staff = staffServices.map(ss => ss.Staff).filter(s => s !== null);
          console.log('✅ Method 2 successful:', staff.length, 'staff found');
          
        } catch (tableError) {
          console.log('⚠️ Method 2 failed:', tableError.message);
          
          try {
            // Method 3: Raw query as last resort
            console.log('📋 Trying Method 3: Raw query');
            const results = await sequelize.query(`
              SELECT s.id, s.name, s.email, s.role, s.status, s.phoneNumber, s.storeId, s.branchId
              FROM staff s
              INNER JOIN staff_services ss ON s.id = ss.staffId
              WHERE ss.serviceId = :serviceId
            `, {
              replacements: { serviceId },
              type: sequelize.QueryTypes.SELECT
            });
            
            staff = results;
            console.log('✅ Method 3 successful:', staff.length, 'staff found');
            
          } catch (rawError) {
            console.log('❌ All methods failed:', rawError.message);
            throw new Error('Unable to fetch staff for this service');
          }
        }
      }

      // Format the response
      const formattedStaff = staff.map(staffMember => {
        // Handle both Sequelize model instances and plain objects
        const staffData = staffMember.toJSON ? staffMember.toJSON() : staffMember;
        
        return {
          id: staffData.id,
          name: staffData.name,
          email: staffData.email,
          role: staffData.role || 'staff',
          status: staffData.status,
          phoneNumber: staffData.phoneNumber,
          storeId: staffData.storeId,
          branchId: staffData.branchId
        };
      });

      res.status(200).json({
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price
        },
        staff: formattedStaff,
        message: staff.length === 0 ? 'No staff assigned to this service' : undefined
      });

    } catch (error) {
      console.error('❌ Get staff by service error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch staff members for service',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Bulk operations
  async bulkAssignStaff(req, res) {
    try {
      const { staffIds, serviceId } = req.body;

      if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
        return res.status(400).json({ error: 'staffIds array is required' });
      }

      if (!serviceId) {
        return res.status(400).json({ error: 'serviceId is required' });
      }

      // Verify service exists
      const service = await Service.findByPk(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Verify all staff exist and belong to the same store as the service
      const staff = await Staff.findAll({
        where: { id: staffIds }
      });

      if (staff.length !== staffIds.length) {
        return res.status(400).json({ error: 'Some staff members were not found' });
      }

      // Check store consistency
      const invalidStaff = staff.filter(s => s.storeId !== service.store_id);
      if (invalidStaff.length > 0) {
        return res.status(400).json({ 
          error: 'All staff must belong to the same store as the service' 
        });
      }

      // Create assignments (ignore duplicates)
      const assignments = staffIds.map(staffId => ({
        staffId,
        serviceId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await StaffService.bulkCreate(assignments, { 
        ignoreDuplicates: true 
      });

      res.status(200).json({ 
        message: `Successfully assigned ${staffIds.length} staff members to service` 
      });

    } catch (error) {
      console.error('❌ Bulk assign staff error:', error);
      res.status(500).json({ 
        error: 'Failed to bulk assign staff to service',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updateStaffStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'suspended', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }

      const staff = await Staff.findByPk(id);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      await staff.update({ status });

      res.status(200).json({
        message: `Staff status updated to ${status}`,
        staff: {
          id: staff.id,
          name: staff.name,
          status: staff.status
        }
      });

    } catch (error) {
      console.error('❌ Update staff status error:', error);
      res.status(500).json({
        error: 'Failed to update staff status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = StaffController;