/**
 * TRMNL Melbourne PT - Configuration
 * 
 * Edit these values to customize your display
 */

module.exports = {
  // Display settings
  display: {
    width: 800,
    height: 480,
  },

  // Stop configuration
  stops: {
    train: {
      name: 'South Yarra',
      stopId: 1120,
      platform: 3,
    },
    
    tram: {
      name: 'Tivoli Road',
      stopId: 2189,
      route: 58,
      direction: 'West Coburg'
    },
    
    destination: {
      name: '80 Collins St',
      walkTime: 10
    }
  },

  // Refresh intervals
  behavior: {
    refreshInterval: 60000, // 60 seconds
  }
};
