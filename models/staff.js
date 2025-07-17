// models/Staff.js - Fixed version
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Staff = sequelize.define('Staff', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Fixed: use DataTypes.UUIDV4 instead of uuidv4
      primaryKey: true,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores', // Changed to lowercase to match your Store model
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
      unique: false, // Remove unique constraint since we check per store
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'inactive'), // Added 'suspended' status
      defaultValue: 'active',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'staff', // Explicit table name
    timestamps: true,
    paranoid: false, // Set to true if you want soft deletes
    indexes: [
      {
        unique: true,
        fields: ['email', 'storeId'], // Unique email per store
        name: 'staff_email_store_unique'
      },
      {
        fields: ['storeId'],
        name: 'staff_store_id_index'
      },
      {
        fields: ['status'],
        name: 'staff_status_index'
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
      as: 'services', // Use lowercase for consistency
    });

    // Staff belongs to a Store (many-to-one)
    Staff.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store', // Use lowercase for consistency
      onDelete: 'CASCADE',
    });

    // Remove the hasMany Service association - it's incorrect for this relationship
    // Staff connects to Services through the many-to-many StaffService table
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