// Initialize variables
let heartRateData = [];       // Stores heart rate readings
let cumulativeKJ = 0;         // Cumulative kilojoules burned
let monitoring = false;       // Monitoring state
let updateInterval = 20000;   // Update interval (20 seconds)
let brightnessInterval;       // Interval to maintain brightness
let maxBTU = 5000;            // Max BTU threshold
let warningDisplayed = false; // Tracks if a warning is displayed

// Configuration for metabolic rate calculation
let config = {
  weight: 70,                 // Default weight (kg)
  age: 25,                    // Default age
  gender: 0                   // Gender (0 = female, 1 = male)
};

// Function to calculate metabolic rate (kJ/hr)
function calculateMetabolicRate(hr) {
  return config.gender === 1
    ? -55.0969 + (0.6309 * hr) + (0.1988 * config.weight) + (0.2017 * config.age)
    : -20.4022 + (0.4472 * hr) - (0.1263 * config.weight) + (0.074 * config.age);
}

// Function to update and display cumulative kilojoules burned
function updateCumulativeKJ() {
  if (!monitoring || warningDisplayed) return;

  // Calculate the average heart rate over the last 20 seconds
  const recentData = heartRateData.slice(-20);
  const averageHR = recentData.length > 0
    ? recentData.reduce((sum, entry) => sum + entry.bpm, 0) / recentData.length
    : 0; // Default to 0 if no data

  // Calculate metabolic rate
  const metabolicRateKJPerSecond = averageHR > 0 
    ? calculateMetabolicRate(averageHR) / 3600 
    : 0; // Default to 0 if averageHR is invalid

  // Update cumulative kilojoules burned
  cumulativeKJ += metabolicRateKJPerSecond * 20; // 20 seconds of energy burned

  // Check for warning threshold
  const maxKJ = maxBTU * 1.055; // Convert BTU to kJ
  if (cumulativeKJ >= maxKJ - maxKJ * 0.9) {
    warningDisplayed = true;
    Bangle.buzz();

    // Display warning message
    g.clear();
    g.setFont("6x8", 3.0);
    g.drawString("WARNING !!", 10, 30);
    g.drawString("APPROACHING \nMAX BTU!!!", 10, 60);
    g.setFont("6x8", 2.0);
    g.drawString("Tap to dismiss", 10, 100);
    g.flip();

    // Wait for tap to dismiss
    setWatch(() => {
      warningDisplayed = false;
      redisplayData(); // Redisplay the live data
    }, BTN, { edge: "rising", debounce: 50, repeat: false });

    return; // Stop further updates until dismissed
  }

  // Display the data
  redisplayData();

  // Schedule the next update
  setTimeout(updateCumulativeKJ, updateInterval);
}



// Function to redisplay live data
function redisplayData() {
  g.clear();
  g.setFont("6x8", 2.9); // Font size for labels
  g.drawString(`Cumulat. KJ:`, 10, 30);
  g.setFont("6x8", 4.0); // Larger font for the value
  g.drawString(`${cumulativeKJ.toFixed(2)}`, 10, 60);
  g.setFont("6x8", 2.9);
  
  g.drawString(`\n\n\nMax kJ: \n`, 10, 50);

  g.setFont("6x8", 4.0);
  g.drawString(`\n\n${maxBTU.toFixed(2)}\n`, 10, 50);

  g.flip();
}

// Heart rate handler
function onHeartRateReading(h) {
  if (h.confidence > 50 && monitoring) {
    heartRateData.push({ time: Date.now(), bpm: h.bpm });

    // Keep only the last 20 seconds of data
    const twentySecondsAgo = Date.now() - 20000;
    heartRateData = heartRateData.filter(entry => entry.time >= twentySecondsAgo);
  }
}

// Toggle monitoring with brightness control
setWatch(() => {
  monitoring = !monitoring;

  if (monitoring) {
    console.log("Monitoring started...");
    Bangle.on('HRM', onHeartRateReading);
    Bangle.setHRMPower(true);
    Bangle.setLCDBrightness(1); // Set screen brightness to maximum

    // Start the cumulative kJ update loop
    updateCumulativeKJ();

    // Maintain brightness during monitoring
    if (!brightnessInterval) {
      brightnessInterval = setInterval(() => Bangle.setLCDBrightness(1), 5000); // Reset brightness every 5 seconds
    }
  } else {
    console.log("Monitoring reset...");
    Bangle.removeListener('HRM', onHeartRateReading);
    Bangle.setHRMPower(false);
    Bangle.setLCDBrightness(0.1); // Dim the screen
    // Reset cumulative kJ burned
    cumulativeKJ = 0;

    // Stop maintaining brightness
    if (brightnessInterval) {
      clearInterval(brightnessInterval);
      brightnessInterval = null;
    }

    // Display stopped message
    g.clear();
    g.setFont("6x8", 3.0);
    g.drawString("Press \nButton \nto Start", 10, 50);
    g.flip();
  }
}, BTN, { edge: "rising", debounce: 50, repeat: true });

// Initial display
g.clear();
g.setFont("6x8", 3.0);
g.drawString("Press \nButton \nto Start", 10, 50);
g.flip();
