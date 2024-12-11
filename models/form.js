'use strict';
module.exports = (sequelize, DataTypes) => {
    const Form = sequelize.define('Form', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'Forms',
        timestamps: true,
    });

    Form.associate = (models) => {
        Form.hasMany(models.FormField, {
            foreignKey: 'form_id',
            as: 'fields',
        });
        Form.hasMany(models.FormResponse, {
            foreignKey: 'form_id',
            as: 'responses',
        });
    };

    return Form;
};
