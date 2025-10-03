// models/Staff.js - Optimized with reduced indexes
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
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'branches',
        key: 'id',
      },
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
      // Unique constraint for email per store
      {
        unique: true,
        fields: ['email', 'storeId'],
        name: 'idx_staff_email_store_unique'
      },
      // Foreign key indexes
      {
        fields: ['storeId'],
        name: 'idx_staff_store_id'
      },
      {
        fields: ['branchId'],
        name: 'idx_staff_branch_id'
      },
      // Composite index for filtering active staff by role
      {
        fields: ['storeId', 'status', 'role'],
        name: 'idx_staff_store_status_role'
      }
    ],
  });

  Staff.associate = (models) => {
    Staff.belongsToMany(models.Service, {
      through: models.StaffService,
      foreignKey: 'staffId',
      otherKey: 'serviceId',
      as: 'services',
    });

    Staff.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE',
    });

    Staff.belongsTo(models.Branch, {
      foreignKey: 'branchId',
      as: 'branch',
      onDelete: 'SET NULL',
    });
  };

  Staff.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
  };

  return Staff;
};