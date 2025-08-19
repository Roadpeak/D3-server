// test/testFavoritesRoutes.js - Test that your routes are working
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// You'll need to replace this with a real token from your app
const AUTH_TOKEN = 'd51d4094-86d6-4522-8c4b-f66a6d7e3df7';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

async function testFavoritesRoutes() {
    console.log('🧪 Testing Favorites Routes...\n');

    const tests = [
        {
            name: '1. GET /users/favorites',
            test: () => api.get('/users/favorites')
        },
        {
            name: '2. GET /users/favorites/count', 
            test: () => api.get('/users/favorites/count')
        },
        {
            name: '3. GET /offers (to get an offer ID)',
            test: () => api.get('/offers?limit=1')
        }
    ];

    let testOfferId = null;

    for (const test of tests) {
        try {
            console.log(`🔄 Testing: ${test.name}`);
            const response = await test.test();
            console.log(`✅ ${test.name}: SUCCESS`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Data:`, response.data);
            
            // Save an offer ID for the next tests
            if (test.name.includes('GET /offers') && response.data.offers && response.data.offers.length > 0) {
                testOfferId = response.data.offers[0].id;
                console.log(`   📝 Saved offer ID for testing: ${testOfferId}`);
            }
            
        } catch (error) {
            console.log(`❌ ${test.name}: FAILED`);
            console.log(`   Status: ${error.response?.status || 'No response'}`);
            console.log(`   Error: ${error.response?.data?.message || error.message}`);
        }
        console.log('');
    }

    // Test offer-specific favorites routes if we have an offer ID
    if (testOfferId) {
        const offerTests = [
            {
                name: `4. GET /offers/${testOfferId}/favorite/status`,
                test: () => api.get(`/offers/${testOfferId}/favorite/status`)
            },
            {
                name: `5. POST /offers/${testOfferId}/favorite/toggle`,
                test: () => api.post(`/offers/${testOfferId}/favorite/toggle`)
            },
            {
                name: `6. GET /users/favorites (after toggle)`,
                test: () => api.get('/users/favorites')
            }
        ];

        for (const test of offerTests) {
            try {
                console.log(`🔄 Testing: ${test.name}`);
                const response = await test.test();
                console.log(`✅ ${test.name}: SUCCESS`);
                console.log(`   Status: ${response.status}`);
                console.log(`   Data:`, response.data);
            } catch (error) {
                console.log(`❌ ${test.name}: FAILED`);
                console.log(`   Status: ${error.response?.status || 'No response'}`);
                console.log(`   Error: ${error.response?.data?.message || error.message}`);
            }
            console.log('');
        }
    }

    console.log('🎉 Route testing completed!');
}
