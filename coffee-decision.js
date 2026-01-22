/**
 * COFFEE DECISION ENGINE
 * Calculates whether there's time to get coffee before work
 * 
 * Commute: South Yarra → Norman Cafe (optional) → Route 58 Tram → South Yarra Station → Parliament → 80 Collins St
 * Target arrival: 9:00 AM
 */

class CoffeeDecision {
  constructor() {
    // Timing constants (in minutes)
    this.commute = {
      walkToWork: 6,      // Parliament Station → 80 Collins St
      homeToNorman: 4,    // Home → Norman Cafe
      makeCoffee: 6,      // Time at cafe (order + make)
      normanToTram: 1,    // Norman Cafe → Tivoli Road tram stop
      tramRide: 5,        // Tram ride to South Yarra
      platformChange: 3,  // Walk to Platform 3
      trainRide: 9        // Train to Parliament
    };
  }

  /**
   * Get current Melbourne time (UTC+11)
   */
  getMelbourneTime() {
    const now = new Date();
    // UTC+11 (AEDT - Melbourne)
    return new Date(now.getTime() + (11 * 60 * 60 * 1000));
  }

  /**
   * Check if there are major service disruptions
   */
  isDisrupted(newsText) {
    if (!newsText) return false;
    const badWords = ['Major Delays', 'Suspended', 'Buses replace', 'Cancellation'];
    return badWords.some(word => newsText.includes(word));
  }

  /**
   * Main calculation - determines if there's time for coffee
   * 
   * @param {number} nextTrainMin - Minutes until next train
   * @param {array} tramData - Array of upcoming tram departures
   * @param {string} newsText - Service alert text
   * @returns {object} - { decision, subtext, canGet, urgent }
   */
  calculate(nextTrainMin, tramData, newsText) {
    const now = this.getMelbourneTime();
    const day = now.getUTCDay(); // 0=Sun, 6=Sat
    const currentHour = now.getUTCHours();
    const currentMin = now.getUTCMinutes();
    const currentTimeInMins = currentHour * 60 + currentMin;

    // 1. SERVICE INTERRUPTION - Skip coffee if network is disrupted
    if (this.isDisrupted(newsText)) {
        return { 
          decision: "SKIP COFFEE", 
          subtext: "Network Alert! Go direct.", 
          canGet: false, 
          urgent: true 
        };
    }

    // 2. WEEKEND MODE - More relaxed timing
    if (day === 0 || day === 6) {
        if (nextTrainMin > 15) {
          return { 
            decision: "WEEKEND VIBES", 
            subtext: `Next train in ${nextTrainMin}m`, 
            canGet: true, 
            urgent: false 
          };
        }
        return { 
          decision: "CATCH TRAIN", 
          subtext: `Train departing in ${nextTrainMin}m`, 
          canGet: true, 
          urgent: false 
        };
    }

    // 3. AFTER 9 AM - Standard mode (not rushing for 9am arrival)
    if (currentHour >= 9) {
        if (nextTrainMin > 15) {
          return { 
            decision: "GET COFFEE", 
            subtext: `Next train in ${nextTrainMin}m`, 
            canGet: true, 
            urgent: false 
          };
        }
        return { 
          decision: "RUSH IT", 
          subtext: "Train is approaching", 
          canGet: false, 
          urgent: true 
        };
    }

    // 4. BEFORE 9 AM - Calculate timing for 80 Collins arrival
    const target9am = 9 * 60; // 540 minutes (9:00 AM)
    
    // Total trip time calculations
    const tripDirect = 4 + 5 + 3 + 9 + this.commute.walkToWork; // ~27 mins
    const tripWithCoffee = tripDirect + this.commute.makeCoffee + 1; // ~34 mins

    const minsUntil9am = target9am - currentTimeInMins;

    // Not enough time for direct route
    if (minsUntil9am < tripDirect) {
        return { 
            decision: "LATE FOR WORK", 
            subtext: `Only ${minsUntil9am}m to 9am! (Need ${tripDirect}m)`, 
            canGet: false, 
            urgent: true 
        };
    }

    // Not enough time for coffee route
    if (minsUntil9am < tripWithCoffee) {
        return { 
            decision: "SKIP COFFEE", 
            subtext: `Need ${tripWithCoffee}m. Have ${minsUntil9am}m.`, 
            canGet: false, 
            urgent: true
        };
    }

    // Find best tram that works with coffee timing
    const coffeeReadyTime = this.commute.homeToNorman + this.commute.makeCoffee;
    const bestTram = tramData ? tramData.find(t => t.minutes >= coffeeReadyTime) : null;

    if (bestTram) {
         return { 
            decision: "GET COFFEE", 
            subtext: `Tram in ${bestTram.minutes}m → 80 Collins by 9am`, 
            canGet: true, 
            urgent: false
        };
    } else {
        return { 
            decision: "GET COFFEE", 
            subtext: `${minsUntil9am}m buffer before 9am`, 
            canGet: true, 
            urgent: false
        };
    }
  }
}

export default CoffeeDecision;
