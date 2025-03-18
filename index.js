const axios = require('axios');
const fs = require('fs').promises;
const HttpsProxyAgent = require('https-proxy-agent');
const path = require('path');

const BASE_URL = 'https://prod-api.pinai.tech';

// Read multiple lines from a file
async function readLines(filename) {
    try {
        const data = await fs.readFile(filename, 'utf8');
        return data.split('\n').map(line => line.trim()).filter(line => line);
    } catch (e) {
        console.error(`❌ Error reading ${filename}:`, e.message);
        return [];
    }
}

// Create log file per account
async function logToFile(accountIndex, message) {
    const logDir = 'logs';
    await fs.mkdir(logDir, { recursive: true }); // Ensure log directory exists

    const logFile = path.join(logDir, `account_${accountIndex + 1}.log`);
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Write to file
    await fs.appendFile(logFile, logMessage);

    // Also print to console
    console.log(logMessage.trim());
}

// Generate random delay between min and max seconds
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min) * 1000;

// Create axios instance for an account
async function createAxiosInstance(token, proxy, accountIndex) {
    let axiosConfig = {
        headers: {
            'accept': 'application/json',
            'accept-language': 'en-US,en;q=0.9',
            'lang': 'en-US',
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        }
    };

    if (proxy) {
        await logToFile(accountIndex, `🆔 Account ${accountIndex + 1} → Proxy: ${proxy}`);
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
    } else {
        await logToFile(accountIndex, `⚠️ No proxy assigned for Account ${accountIndex + 1}, skipping...`);
        return null; // Don't run this account
    }

    return axios.create(axiosConfig);
}

async function checkHome(axiosInstance, accountIndex) {
    try {
        const res = await axiosInstance.get(`${BASE_URL}/home`);
        const data = res.data;

        const logMessage = `
===== Account ${accountIndex + 1} Profile Info =====
👤 Name: ${data.user_info?.name || 'N/A'}
✅ Today Check-in: ${data.is_today_checkin ? 'Yes' : 'No'}
📊 Current Level: ${data.current_model?.current_level || 'N/A'}
💎 Pin Points: ${data.pin_points || 'N/A'}
        `;
        await logToFile(accountIndex, logMessage);
    } catch (e) {
        await logToFile(accountIndex, `❌ Account ${accountIndex + 1}: Failed to fetch profile info`);
    }
}

async function runAccount(accountIndex, token, proxy) {
    await logToFile(accountIndex, `🚀 Starting bot for Account ${accountIndex + 1}`);

    const axiosInstance = await createAxiosInstance(token, proxy, accountIndex);
    if (!axiosInstance) return; // Skip if no proxy assigned

    while (true) {
        await checkHome(axiosInstance, accountIndex);

        // Generate a random delay between 10 and 30 seconds
        const waitTime = randomDelay(10, 30);
        await logToFile(accountIndex, `✅ Account ${accountIndex + 1}: Cycle complete, waiting ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}

async function start() {
    const tokens = await readLines('token.txt');
    const proxies = await readLines('proxy.txt');

    if (tokens.length === 0) {
        console.error('❌ No tokens found in token.txt. Exiting...');
        process.exit(1);
    }

    if (proxies.length < tokens.length) {
        console.error(`⚠️ Not enough proxies! Only ${proxies.length} proxies for ${tokens.length} tokens. Extra tokens will NOT be used.`);
    }

    console.log(`🔑 Loaded ${tokens.length} tokens`);
    console.log(`🌐 Loaded ${proxies.length} proxies`);

    // Run only as many accounts as there are proxies
    tokens.slice(0, proxies.length).forEach((token, index) => {
        runAccount(index, token, proxies[index]); // Assign matching proxy
    });
}

process.on('unhandledRejection', async (e) => {
    await logToFile(-1, `⚠️ Unhandled Rejection: ${e.message}`);
});
process.on('uncaughtException', async (e) => {
    await logToFile(-1, `⚠️ Uncaught Exception: ${e.message}`);
});

start();
