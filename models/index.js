const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

const User = require('./user')(sequelize, DataTypes);
const Merchant = require('./merchant')(sequelize, DataTypes);
const Store = require('./store')(sequelize, DataTypes);
const Service = require('./service')(sequelize, DataTypes);
const Staff = require('./staff')(sequelize, DataTypes);
const StaffService = require('./StaffService')(sequelize, DataTypes);

const ServiceForm = require('./serviceform')(sequelize, DataTypes);
const FormResponse = require('./formresponse')(sequelize, DataTypes);
const Quote = require('./quote')(sequelize, DataTypes);

Staff.belongsToMany(Service, {
  through: StaffService,
  foreignKey: 'staffId',
  otherKey: 'serviceId',
});

Service.belongsToMany(Staff, {
  through: StaffService,
  foreignKey: 'serviceId',
  otherKey: 'staffId',
});

Service.belongsTo(Store, {
  foreignKey: 'store_id',
  onDelete: 'CASCADE',
});

ServiceForm.belongsTo(Service, {
  foreignKey: 'service_id',
  onDelete: 'CASCADE',
});

Service.hasMany(ServiceForm, {
  foreignKey: 'service_id',
});

FormResponse.belongsTo(ServiceForm, {
  foreignKey: 'service_form_id',
  onDelete: 'CASCADE',
});

ServiceForm.hasMany(FormResponse, {
  foreignKey: 'service_form_id',
});

FormResponse.belongsTo(User, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
});

Quote.belongsTo(FormResponse, {
  foreignKey: 'form_response_id',
  onDelete: 'CASCADE',
});

FormResponse.hasOne(Quote, {
  foreignKey: 'form_response_id',
});

module.exports = {
  User,
  Merchant,
  Store,
  Service,
  Staff,
  StaffService,
  ServiceForm,
  FormResponse,
  Quote,
  sequelize,
};
