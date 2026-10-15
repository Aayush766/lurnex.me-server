// check-env.js
require('dotenv').config();

console.log("--- Standalone .env File Test ---");
console.log("ZOOM_ACCOUNT_ID:", process.env.ZOOM_ACCOUNT_ID);
console.log("ZOOM_CLIENT_ID:", process.env.ZOOM_CLIENT_ID);
console.log("ZOOM_CLIENT_SECRET:", process.env.ZOOM_CLIENT_SECRET ? 'Exists' : '!!! DOES NOT EXIST OR IS EMPTY !!!');
console.log("---------------------------------");