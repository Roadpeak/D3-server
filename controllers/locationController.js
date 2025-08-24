// controllers/locationController.js
const { Store, Offer, Service, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get all unique locations from stores and offers
exports.getAvailableLocations = async (req, res) => {
  try {
    console.log('📍 Fetching available locations...');
    
    // Get unique locations from stores with better formatting
    const storeLocations = await Store.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('location')), 'location'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'storeCount']
      ],
      where: {
        location: { [Op.not]: null },
        location: { [Op.ne]: '' }, // Exclude empty strings
        is_active: true
      },
      group: ['location'],
      raw: true
    });

    // Get unique locations from offers (via services and stores)
    let offerLocations = [];
    try {
      offerLocations = await Offer.findAll({
        attributes: [
          [sequelize.col('service.store.location'), 'location'],
          [sequelize.fn('COUNT', sequelize.col('Offer.id')), 'offerCount']
        ],
        include: [
          {
            model: Service,
            as: 'service',
            attributes: [],
            required: true,
            include: [
              {
                model: Store,
                as: 'store',
                attributes: [],
                required: true,
                where: {
                  location: { [Op.not]: null },
                  location: { [Op.ne]: '' },
                  is_active: true
                }
              }
            ]
          }
        ],
        where: {
          status: 'active'
        },
        group: [sequelize.col('service.store.location')],
        raw: true
      });
    } catch (offerError) {
      console.log('Could not fetch offer locations:', offerError.message);
      offerLocations = [];
    }

    // Merge and format locations with better parsing
    const locationMap = new Map();
    
    // Add store locations
    storeLocations.forEach(loc => {
      if (loc.location && loc.location.trim()) {
        const cleanLocation = loc.location.trim();
        const area = cleanLocation.split(',')[0]?.trim() || 'Area';
        const city = cleanLocation.split(',')[1]?.trim() || 'Nairobi';
        
        locationMap.set(cleanLocation, {
          name: cleanLocation,
          area: area,
          city: city,
          storeCount: parseInt(loc.storeCount) || 0,
          offerCount: 0
        });
      }
    });

    // Add offer counts
    offerLocations.forEach(loc => {
      if (loc.location && loc.location.trim()) {
        const cleanLocation = loc.location.trim();
        if (locationMap.has(cleanLocation)) {
          locationMap.get(cleanLocation).offerCount = parseInt(loc.offerCount) || 0;
        } else {
          const area = cleanLocation.split(',')[0]?.trim() || 'Area';
          const city = cleanLocation.split(',')[1]?.trim() || 'Nairobi';
          
          locationMap.set(cleanLocation, {
            name: cleanLocation,
            area: area,
            city: city,
            storeCount: 0,
            offerCount: parseInt(loc.offerCount) || 0
          });
        }
      }
    });

    // Convert to array and sort by total activity
    const locations = Array.from(locationMap.values())
      .map((loc, index) => ({
        id: index + 1,
        ...loc,
        offers: `${loc.storeCount + loc.offerCount} deals`,
        totalDeals: loc.storeCount + loc.offerCount
      }))
      .filter(loc => loc.totalDeals > 0) // Only include locations with actual deals
      .sort((a, b) => b.totalDeals - a.totalDeals);

    console.log(`✅ Found ${locations.length} unique locations with deals`);
    
    // Log location names for debugging
    console.log('Available locations:', locations.map(l => l.name));

    return res.status(200).json({
      success: true,
      locations,
      message: `Found ${locations.length} locations with active deals`
    });
  } catch (error) {
    console.error('Error fetching available locations:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching locations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Enhanced reverse geocoding with better matching
exports.reverseGeocode = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    console.log(`🌍 Reverse geocoding: ${latitude}, ${longitude}`);

    // Get available locations from database first
    const availableLocations = await Store.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('location')), 'location']
      ],
      where: {
        location: { [Op.not]: null },
        location: { [Op.ne]: '' },
        is_active: true
      },
      raw: true
    });

    const locationNames = availableLocations.map(loc => loc.location.trim());
    console.log('📍 Available database locations:', locationNames);

    // Use external geocoding service
    let detectedLocation = null;
    let nearestAvailableLocation = null;
    
    try {
      const fetch = require('node-fetch');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`,
        {
          headers: {
            'User-Agent': 'Discoun3ree/1.0'
          }
        }
      );

      if (response.ok) {
        const locationData = await response.json();
        
        if (locationData && locationData.address) {
          const area = locationData.address.suburb || 
                       locationData.address.neighbourhood || 
                       locationData.address.residential || 
                       locationData.address.commercial ||
                       locationData.address.city_district ||
                       'Nairobi';
                       
          const city = locationData.address.city || 
                       locationData.address.town || 
                       locationData.address.municipality ||
                       'Nairobi';

          detectedLocation = `${area}, ${city}`;
          
          // Enhanced matching logic
          const areaLower = area.toLowerCase();
          const cityLower = city.toLowerCase();
          
          // Try exact match first
          nearestAvailableLocation = locationNames.find(loc => 
            loc.toLowerCase() === detectedLocation.toLowerCase()
          );
          
          // Try partial match on area name
          if (!nearestAvailableLocation) {
            nearestAvailableLocation = locationNames.find(loc => {
              const locLower = loc.toLowerCase();
              return locLower.includes(areaLower) || areaLower.includes(locLower.split(',')[0]?.trim());
            });
          }
          
          // Try match on city
          if (!nearestAvailableLocation) {
            nearestAvailableLocation = locationNames.find(loc => 
              loc.toLowerCase().includes(cityLower)
            );
          }
          
          console.log(`🎯 Detected: ${detectedLocation}, Nearest available: ${nearestAvailableLocation || 'None found'}`);
        }
      }
    } catch (fetchError) {
      console.error('External geocoding failed:', fetchError.message);
    }
    
    // Fallback for Kenya coordinates
    if (!detectedLocation && latitude >= -4.7 && latitude <= 4.6 && longitude >= 33.9 && longitude <= 41.9) {
      detectedLocation = 'Nairobi, Kenya';
      
      // Try to find a Nairobi location in database
      nearestAvailableLocation = locationNames.find(loc => 
        loc.toLowerCase().includes('nairobi')
      );
    }

    // Final fallback
    if (!nearestAvailableLocation && locationNames.length > 0) {
      // Return the location with most deals as fallback
      const locationStats = await Store.findAll({
        attributes: [
          'location',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          location: { [Op.not]: null },
          location: { [Op.ne]: '' },
          is_active: true
        },
        group: ['location'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 1,
        raw: true
      });
      
      if (locationStats.length > 0) {
        nearestAvailableLocation = locationStats[0].location;
        console.log(`🎯 Using location with most stores as fallback: ${nearestAvailableLocation}`);
      }
    }

    return res.status(200).json({
      success: true,
      location: detectedLocation || 'Unknown Location',
      nearestAvailableLocation: nearestAvailableLocation || 'All Locations',
      coordinates: { latitude, longitude },
      availableLocations: locationNames // Include for debugging
    });

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error determining location',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get location statistics
exports.getLocationStats = async (req, res) => {
  try {
    console.log('📊 Fetching location statistics...');
    
    // Get store counts by location
    const storeStats = await Store.findAll({
      attributes: [
        'location',
        [sequelize.fn('COUNT', sequelize.col('id')), 'storeCount']
      ],
      where: {
        location: { [Op.not]: null },
        location: { [Op.ne]: '' },
        is_active: true
      },
      group: ['location'],
      raw: true
    });

    // Get offer counts by location  
    let offerStats = [];
    try {
      offerStats = await Offer.findAll({
        attributes: [
          [sequelize.col('service.store.location'), 'location'],
          [sequelize.fn('COUNT', sequelize.col('Offer.id')), 'offerCount']
        ],
        include: [
          {
            model: Service,
            as: 'service',
            attributes: [],
            required: true,
            include: [
              {
                model: Store,
                as: 'store',
                attributes: [],
                required: true,
                where: {
                  location: { [Op.not]: null },
                  location: { [Op.ne]: '' },
                  is_active: true
                }
              }
            ]
          }
        ],
        where: {
          status: 'active'
        },
        group: [sequelize.col('service.store.location')],
        raw: true
      });
    } catch (offerError) {
      console.log('Could not fetch offer stats:', offerError.message);
    }

    // Combine statistics
    const locationStatsMap = new Map();
    
    // Add store counts
    storeStats.forEach(stat => {
      const location = stat.location.trim();
      locationStatsMap.set(location, {
        location,
        storeCount: parseInt(stat.storeCount) || 0,
        offerCount: 0
      });
    });
    
    // Add offer counts
    offerStats.forEach(stat => {
      const location = stat.location?.trim();
      if (location) {
        if (locationStatsMap.has(location)) {
          locationStatsMap.get(location).offerCount = parseInt(stat.offerCount) || 0;
        } else {
          locationStatsMap.set(location, {
            location,
            storeCount: 0,
            offerCount: parseInt(stat.offerCount) || 0
          });
        }
      }
    });

    const formattedStats = {};
    locationStatsMap.forEach((stats, location) => {
      formattedStats[location] = {
        stores: stats.storeCount,
        offers: stats.offerCount,
        total: stats.storeCount + stats.offerCount
      };
    });

    console.log(`✅ Found statistics for ${Object.keys(formattedStats).length} locations`);

    return res.status(200).json({
      success: true,
      stats: formattedStats,
      message: `Statistics for ${Object.keys(formattedStats).length} locations`
    });
  } catch (error) {
    console.error('Error fetching location stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching location statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};