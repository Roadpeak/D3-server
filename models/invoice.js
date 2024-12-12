'use strict';

module.exports = (sequelize, DataTypes) => {
    const Invoice = sequelize.define(
        'Invoice',
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
                    model: 'Stores',
                    key: 'id',
                },
            },
            invoice_number: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            billing_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            due_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            payment_status: {
                type: DataTypes.ENUM('unpaid', 'paid'),
                defaultValue: 'unpaid',
            },
            mpesa_transaction_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            timestamps: true,
            tableName: 'Invoices',
        }
    );

    Invoice.associate = (models) => {
        Invoice.belongsTo(models.Store, {
            foreignKey: 'store_id',
            onDelete: 'CASCADE',
        });
    };

    return Invoice;
};
