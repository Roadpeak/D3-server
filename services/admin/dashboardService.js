const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { sequelize } = require("../../models/index");

const calculateStats = async () => {
  const userCount = await User.count();
  const bookingCount = await Booking.count();
  const merchantCount = await Merchant.count();
  return { users: userCount, bookings: bookingCount, merchants: merchantCount };
};

const getTopStats = async () => {
  const topMerchants = await Merchant.findAll({
    order: [['createdAt', 'DESC']],  // Use createdAt instead of revenue
    limit: 5,
    attributes: ['id', 'firstName', 'lastName', 'businessName', 'createdAt']
  });
  return topMerchants.map(m => ({ 
    id: m.id, 
    name: m.businessName || `${m.firstName} ${m.lastName}`, 
    createdAt: m.createdAt 
  }));
};

const getAllStats = async () => {
  const stats = await calculateStats();
  const topStats = await getTopStats();
  return { ...stats, topMerchants: topStats };
};

const getRecentActivities = async () => {
  const activities = await Booking.findAll({
    order: [['createdAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'createdAt', 'status']
  });
  return activities;
};

const generateAnalytics = async () => {
  const bookingsByStatus = await Booking.findAll({
    attributes: [
      'status', 
      [sequelize.fn('COUNT', sequelize.col('status')), 'count']
    ],
    group: ['status']
  });
  return bookingsByStatus.map(b => ({ 
    status: b.status, 
    count: parseInt(b.dataValues.count) 
  }));
};

module.exports = {
  calculateStats,
  getTopStats,
  getAllStats,
  getRecentActivities,
  generateAnalytics,
};
