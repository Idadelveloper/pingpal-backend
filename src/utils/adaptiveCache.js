const TTL_SETTINGS = {
    FAST: 30,    // Wi-Fi/5G: 30 seconds
    MEDIUM: 60,  // 4G: 60 seconds
    SLOW: 300    // 3G/Poor: 5 minutes
};

const getAdaptiveTTL = (networkType) => {
    const type = networkType ? networkType.toLowerCase() : 'unknown';
    switch (type) {
        case 'wifi':
        case '5g':
            return TTL_SETTINGS.FAST;
        case '4g':
            return TTL_SETTINGS.MEDIUM;
        case '3g':
        case '2g':
        default:
            return TTL_SETTINGS.SLOW;
    }
};

module.exports = { getAdaptiveTTL };