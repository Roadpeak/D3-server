// Fixed branchController.js - Add these utility functions and updated methods

const { Branch, Store, Merchant } = require('../models');
const { Op } = require('sequelize');

// ==================== UTILITY FUNCTIONS ====================

// Convert working days to frontend format (capitalized)
const convertWorkingDaysToFrontendFormat = (workingDays) => {
  if (!workingDays) return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let days = workingDays;
  
  // If it's a JSON string, parse it
  if (typeof workingDays === 'string') {
    try {
      days = JSON.parse(workingDays);
    } catch (e) {
      console.warn('Failed to parse working_days JSON:', workingDays);
      return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    }
  }
  
  if (!Array.isArray(days)) return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return days.map(day => {
    if (!day) return '';
    const dayStr = day.toString().toLowerCase().trim();
    return dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
  }).filter(Boolean);
};

// Convert working days to database format (lowercase)
const convertWorkingDaysToDbFormat = (workingDays) => {
  if (!workingDays || !Array.isArray(workingDays)) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  }
  return workingDays.map(day => day.toString().toLowerCase().trim()).filter(Boolean);
};

// ==================== UPDATED CONTROLLER METHODS ====================

// FIXED: Get all branches for a store (including store as main branch)
exports.getBranchesByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const merchantId = req.user.id;
    const { status, includeInactive } = req.query;

    console.log('🔍 Getting branches for store:', storeId, 'Merchant:', merchantId);

    // Verify store belongs to merchant
    const store = await Store.findOne({
      where: {
        id: storeId,
        merchant_id: merchantId
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    // Build where clause for additional branches
    const whereClause = { storeId: storeId };
    
    if (status) {
      whereClause.status = status;
    } else if (!includeInactive) {
      whereClause.status = { [Op.ne]: 'Inactive' };
    }

    // Get additional branches (not including the main branch from store)
    const additionalBranches = await Branch.findAll({
      where: whereClause,
      include: [
        {
          model: Store,
          as: 'Store',
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['isMainBranch', 'DESC'],
        ['createdAt', 'ASC']
      ]
    });

    // FIXED: Create main branch object from store information with proper working days
    const storeWorkingDays = convertWorkingDaysToFrontendFormat(store.working_days);
    
    const mainBranch = {
      id: `store-${store.id}`,
      name: `${store.name} - Main Branch`,
      address: store.location,
      phone: store.phone_number,
      email: store.primary_email,
      manager: '',
      status: store.status || 'Active',
      openingTime: store.opening_time,
      closingTime: store.closing_time,
      workingDays: storeWorkingDays, // FIXED: Properly formatted working days
      latitude: null,
      longitude: null,
      description: store.description,
      isMainBranch: true,
      storeId: store.id,
      merchantId: merchantId,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      Store: {
        id: store.id,
        name: store.name
      },
      isStoreMainBranch: true
    };

    // FIXED: Format additional branches with proper working days
    const formattedAdditionalBranches = additionalBranches.map(branch => {
      const branchData = branch.toJSON();
      branchData.workingDays = convertWorkingDaysToFrontendFormat(branchData.workingDays);
      return branchData;
    });

    // Combine main branch (from store) with additional branches
    const allBranches = [mainBranch, ...formattedAdditionalBranches];

    console.log('✅ Found', allBranches.length, 'branches total');
    console.log('🏪 Main branch working days:', mainBranch.workingDays);

    return res.status(200).json({
      success: true,
      branches: allBranches,
      count: allBranches.length,
      mainBranch: mainBranch,
      additionalBranches: formattedAdditionalBranches
    });

  } catch (error) {
    console.error('💥 Get branches error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching branches',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// FIXED: Get all branches for a merchant (across all stores)
exports.getMerchantBranches = async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { status, storeId } = req.query;

    console.log('🔍 Getting all merchant branches for:', merchantId);

    // Build where clause for stores
    const storeWhere = { merchant_id: merchantId };
    if (storeId) {
      storeWhere.id = storeId;
    }

    // Get all merchant's stores
    const stores = await Store.findAll({
      where: storeWhere,
      include: [
        {
          model: Branch,
          as: 'Branches',
          where: status ? { status } : {},
          required: false
        }
      ]
    });

    const allBranches = [];
    const branchesByStore = {};

    // Process each store
    stores.forEach(store => {
      // FIXED: Create main branch from store with proper working days
      const storeWorkingDays = convertWorkingDaysToFrontendFormat(store.working_days);
      
      const mainBranch = {
        id: `store-${store.id}`,
        name: `${store.name} - Main Branch`,
        address: store.location,
        phone: store.phone_number,
        email: store.primary_email,
        manager: '',
        status: store.status || 'Active',
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        workingDays: storeWorkingDays, // FIXED: Properly formatted working days
        isMainBranch: true,
        storeId: store.id,
        merchantId: merchantId,
        Store: {
          id: store.id,
          name: store.name,
          location: store.location
        },
        isStoreMainBranch: true
      };

      allBranches.push(mainBranch);

      // Initialize store in branchesByStore
      if (!branchesByStore[store.name]) {
        branchesByStore[store.name] = [];
      }
      branchesByStore[store.name].push(mainBranch);

      // FIXED: Add additional branches with proper working days formatting
      if (store.Branches) {
        store.Branches.forEach(branch => {
          const branchData = branch.toJSON();
          branchData.workingDays = convertWorkingDaysToFrontendFormat(branchData.workingDays);
          allBranches.push(branchData);
          branchesByStore[store.name].push(branchData);
        });
      }
    });

    console.log('✅ Found', allBranches.length, 'branches across all stores');

    return res.status(200).json({
      success: true,
      branches: allBranches,
      branchesByStore,
      totalCount: allBranches.length
    });

  } catch (error) {
    console.error('💥 Get merchant branches error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching merchant branches',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// FIXED: Create a new branch (additional branches only)
exports.createBranch = async (req, res) => {
  try {
    console.log('🏢 CREATE BRANCH - Start');
    console.log('📍 Store ID:', req.params.storeId);
    console.log('👤 Merchant ID:', req.user.id);
    console.log('📝 Request Body:', req.body);

    const {
      name,
      address,
      phone,
      email,
      manager,
      openingTime,
      closingTime,
      workingDays,
      latitude,
      longitude,
      description,
      isMainBranch
    } = req.body;

    const { storeId } = req.params;
    const merchantId = req.user.id;

    // Validate required fields
    if (!name || !address) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Branch name and address are required'
      });
    }

    // Verify store belongs to merchant
    console.log('🔍 Checking store ownership...');
    const store = await Store.findOne({
      where: {
        id: storeId,
        merchant_id: merchantId
      }
    });

    if (!store) {
      console.log('❌ Store not found or access denied');
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    console.log('✅ Store found:', store.name);

    // Prevent setting isMainBranch to true (store is always main)
    if (isMainBranch) {
      console.log('❌ Attempted to set additional branch as main');
      return res.status(400).json({
        success: false,
        message: 'Cannot set additional branch as main branch. The store information serves as the main branch.'
      });
    }

    // Check if branch name already exists for this store
    console.log('🔍 Checking for duplicate branch name...');
    const existingBranch = await Branch.findOne({
      where: {
        storeId: storeId,
        name: name,
        status: { [Op.ne]: 'Inactive' }
      }
    });

    if (existingBranch) {
      console.log('❌ Branch name already exists');
      return res.status(400).json({
        success: false,
        message: 'A branch with this name already exists for this store'
      });
    }

    // FIXED: Convert working days to database format
    const convertedWorkingDays = convertWorkingDaysToDbFormat(workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    console.log('✅ Working days converted for DB:', convertedWorkingDays);

    // Create the additional branch
    console.log('✨ Creating new branch...');
    const branchData = {
      name,
      address,
      phone,
      email,
      manager,
      openingTime,
      closingTime,
      workingDays: convertedWorkingDays, // Store as lowercase array (JSON field)
      latitude,
      longitude,
      description,
      isMainBranch: false, // Additional branches are never main
      storeId,
      merchantId,
      createdBy: merchantId
    };

    console.log('📝 Branch data to create:', branchData);

    const branch = await Branch.create(branchData);

    console.log('✅ Branch created with ID:', branch.id);

    // Fetch the created branch with store info
    const createdBranch = await Branch.findByPk(branch.id, {
      include: [
        {
          model: Store,
          as: 'Store',
          attributes: ['id', 'name']
        }
      ]
    });

    // FIXED: Format the response with proper working days
    const responseData = createdBranch.toJSON();
    responseData.workingDays = convertWorkingDaysToFrontendFormat(responseData.workingDays);

    console.log('✅ Branch creation successful');

    return res.status(201).json({
      success: true,
      message: 'Additional branch created successfully',
      branch: responseData
    });

  } catch (error) {
    console.error('💥 Create branch error:', error);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Error creating branch',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// FIXED: Get a specific branch
exports.getBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const merchantId = req.user.id;

    console.log('🔍 Getting branch:', branchId, 'for merchant:', merchantId);

    // Check if this is a store-based main branch
    if (branchId.startsWith('store-')) {
      const storeId = branchId.replace('store-', '');
      
      const store = await Store.findOne({
        where: {
          id: storeId,
          merchant_id: merchantId
        }
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found or access denied'
        });
      }

      // FIXED: Return store information as branch with proper working days
      const storeWorkingDays = convertWorkingDaysToFrontendFormat(store.working_days);
      
      const branch = {
        id: branchId,
        name: `${store.name} - Main Branch`,
        address: store.location,
        phone: store.phone_number,
        email: store.primary_email,
        manager: '',
        status: store.status || 'Active',
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        workingDays: storeWorkingDays, // FIXED: Properly formatted working days
        isMainBranch: true,
        storeId: store.id,
        Store: {
          id: store.id,
          name: store.name,
          location: store.location
        },
        isStoreMainBranch: true
      };

      return res.status(200).json({
        success: true,
        branch
      });
    }

    // Regular branch lookup
    const branch = await Branch.findOne({
      where: {
        id: branchId,
        merchantId: merchantId
      },
      include: [
        {
          model: Store,
          as: 'Store',
          attributes: ['id', 'name', 'location']
        }
      ]
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found or access denied'
      });
    }

    // FIXED: Format the response with proper working days
    const responseData = branch.toJSON();
    responseData.workingDays = convertWorkingDaysToFrontendFormat(responseData.workingDays);

    return res.status(200).json({
      success: true,
      branch: responseData
    });

  } catch (error) {
    console.error('💥 Get branch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching branch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// FIXED: Update a branch
exports.updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const merchantId = req.user.id;
    const updateData = req.body;

    console.log('🔄 Updating branch:', branchId, 'for merchant:', merchantId);
    console.log('📝 Update data:', updateData);

    // Check if trying to update store-based main branch
    if (branchId.startsWith('store-')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update main branch directly. Please update store information instead.'
      });
    }

    // Find the branch
    const branch = await Branch.findOne({
      where: {
        id: branchId,
        merchantId: merchantId
      }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found or access denied'
      });
    }

    // Prevent setting as main branch
    if (updateData.isMainBranch) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set additional branch as main branch. The store serves as the main branch.'
      });
    }

    // Check if name is being changed and already exists
    if (updateData.name && updateData.name !== branch.name) {
      const existingBranch = await Branch.findOne({
        where: {
          storeId: branch.storeId,
          name: updateData.name,
          id: { [Op.ne]: branchId },
          status: { [Op.ne]: 'Inactive' }
        }
      });

      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'A branch with this name already exists for this store'
        });
      }
    }

    // FIXED: Handle working days conversion
    const finalUpdateData = { ...updateData };
    if (finalUpdateData.workingDays && Array.isArray(finalUpdateData.workingDays)) {
      finalUpdateData.workingDays = convertWorkingDaysToDbFormat(finalUpdateData.workingDays);
      console.log('✅ Working days converted for update:', finalUpdateData.workingDays);
    }

    // Update the branch
    await branch.update({
      ...finalUpdateData,
      isMainBranch: false, // Ensure it stays as additional branch
      updatedBy: merchantId
    });

    // Fetch updated branch
    const updatedBranch = await Branch.findByPk(branchId, {
      include: [
        {
          model: Store,
          as: 'Store',
          attributes: ['id', 'name']
        }
      ]
    });

    // FIXED: Format the response with proper working days
    const responseData = updatedBranch.toJSON();
    responseData.workingDays = convertWorkingDaysToFrontendFormat(responseData.workingDays);

    console.log('✅ Branch updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Branch updated successfully',
      branch: responseData
    });

  } catch (error) {
    console.error('💥 Update branch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating branch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a branch (unchanged)
exports.deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const merchantId = req.user.id;

    console.log('🗑️ Deleting branch:', branchId, 'for merchant:', merchantId);

    // Prevent deleting store-based main branch
    if (branchId.startsWith('store-')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete main branch. Main branch is based on store information.'
      });
    }

    const branch = await Branch.findOne({
      where: {
        id: branchId,
        merchantId: merchantId
      }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found or access denied'
      });
    }

    // Soft delete the branch
    await branch.destroy();

    console.log('✅ Branch deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Branch deleted successfully'
    });

  } catch (error) {
    console.error('💥 Delete branch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting branch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};