'use strict';

module.exports = (sequelize, DataTypes) => {
  const StoreGallery = sequelize.define(
    'StoreGallery',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id',
        },
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'StoreGallery',
    }
  );

  StoreGallery.associate = (models) => {
    StoreGallery.belongsTo(models.Store, {
      foreignKey: 'store_id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return StoreGallery;
};
