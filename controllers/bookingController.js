const { Booking, Offer, Service, Store, User, Payment, Staff } = require('../models');
const QRCode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');
const ejs = require('ejs');
const path = require('path');
const { Op } = require('sequelize');
const moment = require('moment');

const fs = require('fs');

const BookingController = {

    generateTimeSlots: (openingTime, closingTime) => {
        const timeSlots = [];
        let currentTime = moment(openingTime, 'HH:mm');
        const endTime = moment(closingTime, 'HH:mm');

        while (currentTime.isBefore(endTime)) {
            timeSlots.push(currentTime.format('HH:mm'));
            currentTime.add(30, 'minutes');
        }

        return timeSlots;
    },

    async create(req, res) {
        const { offerId, userId, paymentUniqueCode, startTime } = req.body;

        function formatDateTime(date) {
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            };

            const formattedDate = new Date(date).toLocaleString('en-GB', options);
            const day = new Date(date).getDate();
            let suffix = 'th';
            if (day % 10 === 1 && day !== 11) {
                suffix = 'st';
            } else if (day % 10 === 2 && day !== 12) {
                suffix = 'nd';
            } else if (day % 10 === 3 && day !== 13) {
                suffix = 'rd';
            }

            // Replace the day number with the day + suffix (e.g., "5th")
            const dayWithSuffix = formattedDate.replace(day, day + suffix);

            return dayWithSuffix;
        }

        try {
            const payment = await Payment.findOne({
                where: { unique_code: paymentUniqueCode },
            });

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            const paymentId = payment.id;

            const offer = await Offer.findByPk(offerId, {
                include: {
                    model: Service,
                    attributes: ['id', 'name', 'duration'],
                    include: {
                        model: Store,
                        attributes: ['id', 'name'],
                    },
                },
            });

            if (!offer) {
                return res.status(404).json({ error: 'Offer not found' });
            }

            const service = offer.Service;
            if (!service) {
                return res.status(404).json({ error: 'Service not found for this offer' });
            }

            if (!service.duration) {
                return res.status(400).json({ error: 'Service duration is not defined' });
            }

            const endTime = new Date(new Date(startTime).getTime() + service.duration * 60000);

            const booking = await Booking.create({
                offerId,
                userId,
                paymentId,
                paymentUniqueCode,
                status: 'pending',
                startTime,
                endTime,
            });

            const qrData = JSON.stringify({ paymentUniqueCode: booking.paymentUniqueCode });
            const qrCode = await QRCode.toDataURL(qrData);

            booking.qrCode = qrCode;
            await booking.save();

            const assignedStaff = await Staff.findAll({
                include: {
                    model: Service,
                    where: { id: service.id },
                    through: { attributes: [] },
                }
            });

            const formattedStartTime = formatDateTime(startTime);
            const formattedEndTime = formatDateTime(endTime);

            const bookingLink = `https://yourdomain.com/booking/${booking.id}`;

            if (assignedStaff && assignedStaff.length > 0) {
                for (const staff of assignedStaff) {
                    const templatePath = path.join(__dirname, '..', 'templates', 'bookingNotification.ejs'); // Going one level up from the controllers folder
                    const template = fs.readFileSync(templatePath, 'utf8');

                    const emailContent = ejs.render(template, {
                        staffName: staff.name,
                        serviceName: service.name,
                        bookingStartTime: formattedStartTime,
                        bookingEndTime: formattedEndTime,
                        customerId: userId,
                        bookingLink: bookingLink,
                    });

                    // Send the email to the staff
                    await sendEmail(
                        staff.email,
                        'New Booking Notification',
                        '', // No attachment
                        emailContent
                    );
                }
            }

            res.status(201).json({ booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create booking' });
        }
    },

    async getAll(req, res) {
        try {
            const bookings = await Booking.findAll();
            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings' });
        }
    },

    async getAvailableSlots (req, res) {
        const { date, serviceId, offerId } = req.query;

        if (!date || (!serviceId && !offerId)) {
            return res.status(400).json({ message: 'Date and serviceId or offerId are required.' });
        }

        try {
            // Get the service or offer
            let service;
            if (serviceId) {
                service = await Service.findByPk(serviceId);
            } else if (offerId) {
                const offer = await Offer.findByPk(offerId);
                service = await offer.getService();  // Get the service associated with the offer
            }

            if (!service) {
                return res.status(404).json({ message: 'Service or offer not found.' });
            }

            // Get the store associated with the service
            const store = await service.getStore();  // Assuming service has a store relationship

            if (!store) {
                return res.status(404).json({ message: 'Store for the service not found.' });
            }

            // Get the store's working days and working hours
            const workingDays = store.working_days;
            const openingTime = store.opening_time;
            const closingTime = store.closing_time;

            // Check if the store is open on the provided date
            const dayOfWeek = moment(date).day(); // Get the day of the week (0 - Sunday, 1 - Monday, etc.)

            if (!workingDays.includes(dayOfWeek)) {
                return res.status(400).json({ message: 'The store is closed on this day.' });
            }

            // Get all bookings for the service/offer on the provided date
            const bookings = await Booking.findAll({
                where: {
                    date: {
                        [Op.eq]: date,  // Match the provided date
                    },
                    service_id: serviceId,  // or offer_id
                },
            });

            // Generate all possible time slots between opening and closing time
            const availableSlots = generateTimeSlots(openingTime, closingTime);

            // Get the booked time slots
            const bookedSlots = bookings.map(booking => booking.timeSlot);

            // Filter out the booked slots
            const freeSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

            return res.status(200).json({ availableSlots: freeSlots });
        } catch (error) {
            console.error('Error getting available slots:', error);
            return res.status(500).json({ message: 'Error fetching available slots' });
        }
    },

    async getById(req, res) {
        const { id } = req.params;

        try {
            const booking = await Booking.findOne({
                where: { id },
                include: [
                    {
                        model: Offer,
                        attributes: ['discount', 'expiration_date', 'description', 'status'],
                        include: [
                            {
                                model: Service,
                                attributes: ['name', 'price', 'duration', 'category', 'description'],
                                include: [
                                    {
                                        model: Store,
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: User,
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
                    },
                ],
            });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            res.status(200).json(booking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch booking details' });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { status, startTime, endTime } = req.body;

        try {
            const booking = await Booking.findByPk(id);

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            booking.status = status || booking.status;
            booking.startTime = startTime || booking.startTime;
            booking.endTime = endTime || booking.endTime;
            await booking.save();

            res.status(200).json({ message: 'Booking updated successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update booking' });
        }
    },

    async delete(req, res) {
        const { id } = req.params;

        try {
            const booking = await Booking.findByPk(id);

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            await booking.destroy();
            res.status(200).json({ message: 'Booking deleted successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to delete booking' });
        }
    },

    async validateAndFulfill(req, res) {
        const { qrData } = req.body;

        try {
            const { paymentUniqueCode } = JSON.parse(qrData);

            const booking = await Booking.findOne({ where: { paymentUniqueCode, status: 'pending' } });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found or already fulfilled/cancelled' });
            }

            booking.status = 'fulfilled';
            await booking.save();

            res.status(200).json({ message: 'Booking marked as fulfilled successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to validate and fulfill booking' });
        }
    },

    async getByOffer(req, res) {
        const { offerId } = req.params;

        try {
            const bookings = await Booking.findAll({
                where: { offerId },
                include: [
                    {
                        model: Offer,
                        attributes: ['name', 'description'],
                        include: [
                            {
                                model: Service,
                                attributes: ['name'],
                                include: [
                                    {
                                        model: Store,
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            if (!bookings.length) {
                return res.status(404).json({ error: 'No bookings found for this offer' });
            }

            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings by offer' });
        }
    },

    async getByStore(req, res) {
        const { storeId } = req.params;

        try {
            const bookings = await Booking.findAll({
                include: [
                    {
                        model: Offer,
                        attributes: ['discount', 'expiration_date', 'description', 'status'],
                        include: [
                            {
                                model: Service,
                                attributes: ['name', 'price', 'duration', 'category', 'description'],
                                include: [
                                    {
                                        model: Store,
                                        where: { id: storeId },
                                        attributes: ['name', 'location'],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        model: User,
                        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
                    },
                ],
            });

            if (!bookings.length) {
                return res.status(404).json({ error: 'No bookings found for this store' });
            }

            res.status(200).json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch bookings by store' });
        }
    },

    async markAsFulfilled(req, res) {
        const { paymentUniqueCode } = req.body;

        try {
            const booking = await Booking.findOne({ where: { paymentUniqueCode, status: 'pending' } });

            if (!booking) {
                return res.status(404).json({ error: 'Booking not found or already fulfilled/cancelled' });
            }

            booking.status = 'fulfilled';
            await booking.save();

            res.status(200).json({ message: 'Booking marked as fulfilled successfully', booking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to mark booking as fulfilled' });
        }
    },
};

module.exports = BookingController;

