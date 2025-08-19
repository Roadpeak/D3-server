// services/favoritesService.js
import api from '../config/api';

export const favoritesAPI = {
  // Get user's favorite offers
  getFavorites: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.category) queryParams.append('category', params.category);
      
      const response = await api.get(`/users/favorites?${queryParams.toString()}`);
      return {
        success: true,
        favorites: response.data.favorites || [],
        pagination: response.data.pagination || {}
      };
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch favorites',
        favorites: [],
        pagination: {}
      };
    }
  },

  // Add offer to favorites
  addToFavorites: async (offerId) => {
    try {
      const response = await api.post(`/offers/${offerId}/favorite`);
      return {
        success: true,
        message: response.data.message || 'Added to favorites',
        data: response.data
      };
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to add to favorites'
      };
    }
  },

  // Remove offer from favorites
  removeFromFavorites: async (offerId) => {
    try {
      const response = await api.delete(`/offers/${offerId}/favorite`);
      return {
        success: true,
        message: response.data.message || 'Removed from favorites',
        data: response.data
      };
    } catch (error) {
      console.error('Error removing from favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to remove from favorites'
      };
    }
  },

  // Toggle favorite status
  toggleFavorite: async (offerId) => {
    try {
      const response = await api.post(`/offers/${offerId}/favorite/toggle`);
      return {
        success: true,
        action: response.data.action,
        message: response.data.message || 'Favorite status updated',
        data: response.data
      };
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update favorite'
      };
    }
  },

  // Check if offer is in favorites
  isFavorite: async (offerId) => {
    try {
      const response = await api.get(`/offers/${offerId}/favorite/status`);
      return {
        success: true,
        isFavorite: response.data.isFavorite || false
      };
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return {
        success: false,
        isFavorite: false
      };
    }
  },

  // Get favorites count
  getFavoritesCount: async () => {
    try {
      const response = await api.get('/users/favorites/count');
      return {
        success: true,
        count: response.data.count || 0
      };
    } catch (error) {
      console.error('Error fetching favorites count:', error);
      return {
        success: false,
        count: 0
      };
    }
  }
};

export default favoritesAPI;