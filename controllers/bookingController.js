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
                hour12: true,
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

            const dayWithSuffix = formattedDate.replace(day, day + suffix);
            return dayWithSuffix;
        }

        try {
            // Validate the payment code
            let paymentId = null;
            if (paymentUniqueCode) {
                const payment = await Payment.findOne({
                    where: { unique_code: paymentUniqueCode },
                });

                if (!payment) {
                    return res.status(404).json({ error: 'Payment not found' });
                }

                paymentId = payment.id;
            }

            // Retrieve the offer details
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

            // Retrieve user details
            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Calculate the end time based on the start time and service duration
            const endTime = new Date(new Date(startTime).getTime() + service.duration * 60000);

            // Check if there is any existing booking that conflicts with the new booking
            const existingBooking = await Booking.findOne({
                where: {
                    offerId,
                    status: { [Op.not]: 'cancelled' }, // Ignore cancelled bookings
                    [Op.or]: [
                        { startTime: { [Op.between]: [startTime, endTime] } }, // Overlapping with the start time
                        { endTime: { [Op.between]: [startTime, endTime] } }, // Overlapping with the end time
                        {
                            [Op.and]: [
                                { startTime: { [Op.lte]: startTime } },
                                { endTime: { [Op.gte]: endTime } }
                            ]
                        } // New booking falls within an existing booking's timeframe
                    ]
                }
            });

            if (existingBooking) {
                return res.status(400).json({ error: 'This time slot is already booked. Please choose a different time.' });
            }

            // Proceed with creating the booking
            const booking = await Booking.create({
                offerId,
                userId,
                paymentId,
                paymentUniqueCode,
                status: paymentId ? 'pending' : 'pending',
                startTime,
                endTime,
            });

            // Generate the QR code for the booking
            const qrData = JSON.stringify({ paymentUniqueCode: booking.paymentUniqueCode || 'N/A' });
            const qrCodePath = path.join(__dirname, '..', 'public', 'qrcodes', `${booking.id}.png`);
            await QRCode.toFile(qrCodePath, qrData);

            const qrCodeUrl = `${req.protocol}://${req.get('host')}/qrcodes/${booking.id}.png`;
            booking.qrCode = qrCodeUrl;
            await booking.save();

            const formattedStartTime = formatDateTime(startTime);
            const formattedEndTime = formatDateTime(endTime);

            // Send email to the customer
            const customerTemplatePath = path.join(__dirname, '..', 'templates', 'customerBookingConfirmation.ejs');
            const customerTemplate = fs.readFileSync(customerTemplatePath, 'utf8');

            const customerEmailContent = ejs.render(customerTemplate, {
                userName: user.firstName,
                serviceName: service.name,
                bookingStartTime: formattedStartTime,
                bookingEndTime: formattedEndTime,
                status: booking.status,
                qrCode: booking.qrCode,
                bookingLink: booking.link,
                code: booking.paymentUniqueCode,
            });

            await sendEmail(
                user.email,
                'Booking Confirmation',
                '',
                customerEmailContent
            );

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

    async getAvailableSlots(req, res) {
        const { date, offerId } = req.query;  // Removed serviceId, now using offerId

        if (!date || !offerId) {  // Ensure offerId is provided
            return res.status(400).json({ message: 'Date and offerId are required.' });
        }

        try {
            // Fetch the offer using offerId
            const offer = await Offer.findByPk(offerId);
            if (!offer) {
                return res.status(404).json({ message: 'Offer not found.' });
            }

            // Get the related service for the offer
            const service = await offer.getService();
            if (!service) {
                return res.status(404).json({ message: 'Service for the offer not found.' });
            }

            // Get the store related to the service
            const store = await service.getStore();
            if (!store) {
                return res.status(404).json({ message: 'Store for the service not found.' });
            }

            // Handle working_days as a string or array
            let workingDays = store.working_days;
            if (typeof workingDays === 'string') {
                workingDays = workingDays.split(',').map(day => day.trim());
            }

            const openingTime = moment(store.opening_time, 'HH:mm:ss').format('HH:mm');
            const closingTime = moment(store.closing_time, 'HH:mm:ss').format('HH:mm');

            const dayOfWeek = moment(date).format('dddd');

            if (!workingDays.includes(dayOfWeek)) {
                return res.status(400).json({ message: 'The store is closed on this day.' });
            }

            // Find bookings for this offer on the given date
            const bookings = await Booking.findAll({
                where: {
                    startTime: {
                        [Op.gte]: moment(date).startOf('day').toDate(),
                        [Op.lte]: moment(date).endOf('day').toDate(),
                    },
                    offerId: offerId,  // Check by offerId
                },
            });


            const availableSlots = BookingController.generateTimeSlots(openingTime, closingTime);  // Correct call to generateTimeSlots

            const bookedSlots = bookings.map(booking => {
                const bookingStart = moment(booking.startTime).format('HH:mm');
                const bookingEnd = moment(booking.endTime).format('HH:mm');
                return { start: bookingStart, end: bookingEnd };
            });

            if (bookings.length === 0) {
                return res.status(200).json({ availableSlots: availableSlots });
            }

            // Filter out booked slots
            const freeSlots = availableSlots.filter(slot => {
                return !bookedSlots.some(bookingSlot => {
                    return slot.start >= bookingSlot.start && slot.end <= bookingSlot.end;
                });
            });

            return res.status(200).json({ availableSlots: freeSlots });

        } catch (error) {
            console.error('Error getting available slots:', error);
            return res.status(500).json({ message: 'Error fetching available slots' });
        }
    },

    async getBookingTimes(req, res) {
        const { serviceId } = req.body; 

        const formatDatetime = (isoString) => {
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            };
            return new Date(isoString).toLocaleString('en-US', options);
        };

        const isBookingFromToday = (startTime) => {
            const today = new Date();
            const bookingDate = new Date(startTime);

            today.setHours(0, 0, 0, 0);

            return bookingDate >= today;
        };

        try {
            if (!serviceId) {
                return res.status(400).json({ error: 'Service ID is required.' });
            }

            const service = await Service.findByPk(serviceId, {
                include: [
                    {
                        model: Offer, 
                        as: 'Offers', 
                        include: {
                            model: Booking,
                            as: 'Bookings', 
                        },
                    },
                ],
            });

            if (!service) {
                return res.status(404).json({ error: 'Service not found.' });
            }

            const bookings = [];

            service.Offers.forEach(offer => {
                if (offer.Bookings && offer.Bookings.length > 0) {
                    offer.Bookings.forEach(booking => {
                        if (isBookingFromToday(booking.startTime)) {
                            bookings.push({
                                startTime: booking.startTime,
                                endTime: booking.endTime,
                            });
                        }
                    });
                }
            });

            res.status(200).json({ bookings });
        } catch (error) {
            console.error('Error fetching booking times:', error);
            res.status(500).json({ error: 'An error occurred while fetching booking times.' });
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

