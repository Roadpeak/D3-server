// models/branch.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Branch extends Model {
    static associate(models) {
      // Branch belongs to Store
      Branch.belongsTo(models.Store, { 
        foreignKey: 'storeId',
        as: 'Store',
        onDelete: 'CASCADE'
      });
      
      // Branch belongs to Merchant
      Branch.belongsTo(models.Merchant, { 
        foreignKey: 'merchantId',
        as: 'Merchant',
        onDelete: 'CASCADE'
      });

      // Branch has a creator (Merchant)
      Branch.belongsTo(models.Merchant, { 
        foreignKey: 'createdBy',
        as: 'Creator',
        onDelete: 'SET NULL'
      });

      // Branch has an updater (Merchant)
      Branch.belongsTo(models.Merchant, { 
        foreignKey: 'updatedBy',
        as: 'Updater',
        onDelete: 'SET NULL'
      });
    }
  }

  Branch.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [5, 500]
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^[\+]?[\d\s\-\(\)]{10,}$/i
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    manager: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    status: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Suspended'),
      defaultValue: 'Active',
      allowNull: false
    },
    openingTime: {
      type: DataTypes.TIME,
      allowNull: true,
      field: 'opening_time'
    },
    closingTime: {
      type: DataTypes.TIME,
      allowNull: true,
      field: 'closing_time'
    },
    workingDays: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      field: 'working_days',
      validate: {
        isArray(value) {
          if (value && !Array.isArray(value)) {
            throw new Error('Working days must be an array');
          }
        }
      }
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    isMainBranch: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_main_branch'
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'store_id',
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    merchantId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'merchant_id',
      references: {
        model: 'merchants',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'merchants',
        key: 'id'
      }
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by',
      references: {
        model: 'merchants',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Branch',
    tableName: 'branches',
    timestamps: true,
    paranoid: true, // Enables soft deletes
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
    underscored: true, // Use snake_case for database fields
    hooks: {
      beforeCreate(branch, options) {
        // Ensure additional branches are never set as main
        if (branch.isMainBranch) {
          branch.isMainBranch = false;
        }
      },
      beforeUpdate(branch, options) {
        // Ensure additional branches are never set as main
        if (branch.isMainBranch) {
          branch.isMainBranch = false;
        }
      }
    },
    validate: {
      businessHoursValid() {
        if (this.openingTime && this.closingTime) {
          if (this.openingTime >= this.closingTime) {
            throw new Error('Opening time must be before closing time');
          }
        }
      }
    }
  });

  return Branch;
};