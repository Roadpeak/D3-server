'use strict';
module.exports = (sequelize, DataTypes) => {
    const FormField = sequelize.define('FormField', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        form_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Forms',
                key: 'id',
            },
        },
        field_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        field_type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        required: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'FormFields',
        timestamps: true,
    });

    FormField.associate = (models) => {
        FormField.belongsTo(models.Form, {
            foreignKey: 'form_id',
            as: 'form',
        });
    };

    return FormField;
};
