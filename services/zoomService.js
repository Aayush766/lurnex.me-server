// services/zoomService.js
const axios = require('axios');
const { URLSearchParams } = require('url');

// We can cache the token to avoid requesting a new one for every API call
let cachedToken = null;
let tokenExpiry = null;

/**
 * @description Get a Server-to-Server OAuth token from Zoom
 */
const getZoomAccessToken = async () => {
    // If we have a valid, non-expired token, use it
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const accountId = process.env.ZOOM_ACCOUNT_ID;
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;

        const response = await axios({
            method: 'POST',
            url: `https://zoom.us/oauth/token`,
            params: {
                grant_type: 'account_credentials',
                account_id: accountId,
            },
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        // Cache the token and set its expiry time (token is valid for 1 hour)
        cachedToken = response.data.access_token;
        tokenExpiry = new Date(new Date().getTime() + (response.data.expires_in - 60) * 1000); // Set expiry 1 minute before it actually expires

        return cachedToken;
    } catch (error) {
        console.error("Error getting Zoom access token:", error.response ? error.response.data : error.message);
        throw new Error('Could not authenticate with Zoom API.');
    }
};

/**
 * @description Create a new Zoom meeting
 * @param {string} topic - The title of the class/meeting
 * @param {string} startTimeISO - The start time in ISO format (e.g., "2025-10-26T10:00:00Z")
 * @param {number} duration - The duration in minutes
 */
exports.createZoomMeeting = async (topic, startTimeISO, duration) => {
    try {
        const accessToken = await getZoomAccessToken();
        
        const response = await axios.post(
            'https://api.zoom.us/v2/users/me/meetings',
            {
                topic,
                type: 2, // Scheduled meeting
                start_time: startTimeISO,
                duration,
                settings: {
                    join_before_host: true,
                    mute_upon_entry: true,
                    participant_video: true,
                    host_video: true,
                    auto_recording: 'cloud', // or 'local'
                },
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        
        // Return the join URL, which is what students will use
        return response.data.join_url;

    } catch (error) {
        console.error("Error creating Zoom meeting:", error.response ? error.response.data : error.message);
        throw new Error('Failed to create Zoom meeting.');
    }
};