// models/Staff.js - Updated to match your current database structure
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Staff = sequelize.define('Staff', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id',
      },
    },
    branchId: {
      type: DataTypes.STRING, // Changed from UUID to STRING to accommodate longer IDs
      allowNull: true,
      // Temporarily removed foreign key reference to avoid sync issues
      // references: {
      //   model: 'branches',
      //   key: 'id',
      // },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('staff', 'manager', 'supervisor', 'cashier', 'sales'),
      defaultValue: 'staff',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'inactive'),
      defaultValue: 'active',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'staff',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['email', 'storeId'],
        name: 'staff_email_store_unique'
      },
      {
        fields: ['storeId'],
        name: 'staff_store_id_index'
      },
      {
        fields: ['branchId'],
        name: 'idx_staff_branch_id'
      },
      {
        fields: ['status'],
        name: 'staff_status_index'
      },
      {
        fields: ['role'],
        name: 'idx_staff_role'
      }
    ],
  });

  // Define associations
  Staff.associate = (models) => {
    // Many-to-Many relationship with Service through StaffService
    Staff.belongsToMany(models.Service, {
      through: models.StaffService,
      foreignKey: 'staffId',
      otherKey: 'serviceId',
      as: 'services',
    });

    // Staff belongs to a Store (many-to-one)
    Staff.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE',
    });

    // Temporarily removed Branch association to avoid sync issues
    // Staff belongs to a Branch (many-to-one)
    // Staff.belongsTo(models.Branch, {
    //   foreignKey: 'branchId',
    //   as: 'branch',
    //   onDelete: 'SET NULL',
    // });
  };

  // Instance methods
  Staff.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    // Remove sensitive data
    delete values.password;
    return values;
  };

  return Staff;
};