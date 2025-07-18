// services/branchService.js
import merchantAuthService from './merchantAuthService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

class BranchService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/branches`;
  }

  // Get headers for API requests
  getHeaders() {
    return merchantAuthService.getHeaders(true); // Include both API key and auth
  }

  // Create a new branch (additional branch only)
  async createBranch(storeId, branchData) {
    try {
      console.log('🏢 Creating new additional branch for store:', storeId);
      console.log('📝 Branch data:', branchData);

      // Remove isMainBranch if set - additional branches can't be main
      const { isMainBranch, ...cleanBranchData } = branchData;

      if (isMainBranch) {
        console.warn('⚠️ Removing isMainBranch flag - store information serves as main branch');
      }

      const response = await fetch(`${this.baseURL}/store/${storeId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cleanBranchData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to create branch: ${response.status}`);
      }

      console.log('✅ Additional branch created successfully:', data.branch);
      return data;

    } catch (error) {
      console.error('💥 Error creating branch:', error);
      throw error;
    }
  }

  // Get all branches for a store
  async getBranchesByStore(storeId, options = {}) {
    try {
      console.log('📋 Fetching branches for store:', storeId);

      const queryParams = new URLSearchParams();
      if (options.status) queryParams.append('status', options.status);
      if (options.includeInactive) queryParams.append('includeInactive', 'true');

      const url = `${this.baseURL}/store/${storeId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch branches: ${response.status}`);
      }

      console.log('✅ Branches fetched successfully:', data.branches?.length || 0, 'branches');
      return data;

    } catch (error) {
      console.error('💥 Error fetching branches:', error);
      throw error;
    }
  }

  // Get all branches for the current merchant
  async getMerchantBranches(options = {}) {
    try {
      console.log('📋 Fetching all merchant branches');

      const queryParams = new URLSearchParams();
      if (options.status) queryParams.append('status', options.status);
      if (options.storeId) queryParams.append('storeId', options.storeId);

      const url = `${this.baseURL}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch merchant branches: ${response.status}`);
      }

      console.log('✅ Merchant branches fetched successfully:', data.totalCount || 0, 'branches');
      return data;

    } catch (error) {
      console.error('💥 Error fetching merchant branches:', error);
      throw error;
    }
  }

  // Get a specific branch
  async getBranch(branchId) {
    try {
      console.log('📋 Fetching branch:', branchId);

      const response = await fetch(`${this.baseURL}/${branchId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch branch: ${response.status}`);
      }

      console.log('✅ Branch fetched successfully:', data.branch);
      return data;

    } catch (error) {
      console.error('💥 Error fetching branch:', error);
      throw error;
    }
  }

  // Update a branch
  async updateBranch(branchId, updateData) {
    try {
      console.log('🔄 Updating branch:', branchId);
      console.log('📝 Update data:', updateData);

      // Check if trying to update store-based main branch
      if (branchId.startsWith('store-')) {
        throw new Error('Cannot update main branch directly. Please update store information instead.');
      }

      // Remove isMainBranch if set - additional branches can't be main
      const { isMainBranch, ...cleanUpdateData } = updateData;

      if (isMainBranch) {
        console.warn('⚠️ Removing isMainBranch flag - store information serves as main branch');
      }

      const response = await fetch(`${this.baseURL}/${branchId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(cleanUpdateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to update branch: ${response.status}`);
      }

      console.log('✅ Branch updated successfully:', data.branch);
      return data;

    } catch (error) {
      console.error('💥 Error updating branch:', error);
      throw error;
    }
  }

  // Delete a branch
  async deleteBranch(branchId) {
    try {
      console.log('🗑️ Deleting branch:', branchId);

      // Check if trying to delete store-based main branch
      if (branchId.startsWith('store-')) {
        throw new Error('Cannot delete main branch. Main branch is based on store information.');
      }

      const response = await fetch(`${this.baseURL}/${branchId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to delete branch: ${response.status}`);
      }

      console.log('✅ Branch deleted successfully');
      return data;

    } catch (error) {
      console.error('💥 Error deleting branch:', error);
      throw error;
    }
  }

  // Remove setMainBranch method since store is always main
  // setMainBranch method is no longer needed

  // Validate branch data before sending
  validateBranchData(branchData) {
    const errors = {};

    if (!branchData.name || branchData.name.trim().length < 2) {
      errors.name = 'Branch name must be at least 2 characters long';
    }

    if (!branchData.address || branchData.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters long';
    }

    if (branchData.phone && !/^[\+]?[\d\s\-\(\)]{10,}$/.test(branchData.phone)) {
      errors.phone = 'Invalid phone number format';
    }

    if (branchData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branchData.email)) {
      errors.email = 'Invalid email format';
    }

    if (branchData.manager && branchData.manager.length > 100) {
      errors.manager = 'Manager name must be less than 100 characters';
    }

    if (branchData.openingTime && branchData.closingTime) {
      if (branchData.openingTime >= branchData.closingTime) {
        errors.time = 'Opening time must be before closing time';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Format branch data for display
  formatBranchForDisplay(branch) {
    return {
      ...branch,
      displayAddress: this.truncateText(branch.address, 50),
      displayPhone: this.formatPhoneNumber(branch.phone),
      displayHours: this.formatBusinessHours(branch.openingTime, branch.closingTime),
      isOpenNow: this.isCurrentlyOpen(branch),
      statusBadge: this.getStatusBadgeColor(branch.status)
    };
  }

  // Helper methods
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  formatPhoneNumber(phone) {
    if (!phone) return '';
    // Simple phone formatting - you can enhance this
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  formatBusinessHours(openingTime, closingTime) {
    if (!openingTime || !closingTime) return '24/7';
    
    // Convert 24hr to 12hr format
    const formatTime = (time) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    return `${formatTime(openingTime)} - ${formatTime(closingTime)}`;
  }

  isCurrentlyOpen(branch) {
    if (!branch.workingDays || !branch.openingTime || !branch.closingTime) {
      return true; // Assume open if no restrictions
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (!branch.workingDays.includes(currentDay)) {
      return false;
    }

    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= branch.openingTime && currentTime <= branch.closingTime;
  }

  getStatusBadgeColor(status) {
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Suspended': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  // Test connection
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/test/connection`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Connection test failed');
      }

      return data;
    } catch (error) {
      console.error('💥 Branch service connection test failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const branchService = new BranchService();
export default branchService;