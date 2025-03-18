const axios = require('axios');
const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent'); // Ensure correct import
const UserAgent = require('user-agents');

const BASE_URL = 'https://prod-api.pinai.tech';

async function readLinesFromFile(filename) {
    try {
        const data = await fs.readFile(filename, 'utf8');
        return data.split('\n').map(line => line.trim()).filter(line => line);
    } catch (e) {
        console.error(`❌ Error reading ${filename}:`, e.message);
        process.exit(1);
    }
}

async function loadAccounts() {
    const tokens = await readLinesFromFile('token.txt');
    const proxies = await readLinesFromFile('proxy.txt');

    if (tokens.length !== proxies.length) {
        console.error('❌ Mismatch: Number of tokens and proxies must be the same!');
        process.exit(1);
    }

    return tokens.map((token, index) => {
        let proxy = proxies[index];

        // Ensure proxy format is correct
        if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
            proxy = `http://${proxy}`;
        }

        return {
            token,
            proxy,
            userAgent: new UserAgent().toString(),
            agent: new HttpsProxyAgent(proxy) // Fixed constructor usage
        };
    });
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000);

const banner = `\n=====================================\n  Hi Pin Auto Bot - LeviRekt \n=====================================\n`;

async function checkHome(account) {
    try {
        const res = await axios.get(`${BASE_URL}/home`, {
            headers: {
                'accept': 'application/json',
                'authorization': `Bearer ${account.token}`,
                'User-Agent': account.userAgent
            },
            httpsAgent: account.agent,
            proxy: false
        });
        console.log(`👤 Account (Proxy: ${account.proxy}): ${res.data.user_info?.name || 'N/A'}`);
    } catch (e) {
        console.error(`🏠 Home: Failed for ${account.proxy} - ${e.message}`);
    }
}

async function getRandomTasks(account) {
    try {
        const res = await axios.get(`${BASE_URL}/task/random_task_list`, {
            headers: {
                'accept': 'application/json',
                'authorization': `Bearer ${account.token}`,
                'User-Agent': account.userAgent
            },
            httpsAgent: account.agent,
            proxy: false
        });
        console.log(`📋 Tasks fetched for ${account.proxy}`);
        return res.data;
    } catch (e) {
        console.error(`📋 Tasks: Failed for ${account.proxy}`);
        return null;
    }
}

async function claimTask(account, taskId) {
    try {
        await axios.post(`${BASE_URL}/task/${taskId}/claim`, {}, {
            headers: {
                'accept': 'application/json',
                'authorization': `Bearer ${account.token}`,
                'User-Agent': account.userAgent
            },
            httpsAgent: account.agent,
            proxy: false
        });
        console.log(`✅ Task ${taskId} claimed for ${account.proxy}`);
    } catch (e) {
        console.error(`❌ Task ${taskId} failed for ${account.proxy}`);
    }
}

async function runBot(account) {
    console.log(banner);
    while (true) {
        console.log(`\n🚀 Starting new cycle for ${account.proxy}...`);
        await checkHome(account);
        console.log('');
        
        const tasks = await getRandomTasks(account);
        if (tasks?.data?.length) {
            for (const task of tasks.data) {
                if (task.id) {
                    await claimTask(account, task.id);
                    await randomDelay();
                }
            }
        } else {
            console.log(`📋 No tasks available for ${account.proxy}`);
        }
        
        console.log(`✅ Cycle complete for ${account.proxy}! Waiting before next cycle...`);
        await randomDelay();
    }
}

async function start() {
    const accounts = await loadAccounts();
    accounts.forEach(account => {
        runBot(account).catch(e => {
            console.error(`💥 Bot crashed for ${account.proxy}:`, e.message);
        });
    });
}

process.on('unhandledRejection', (e) => console.error('⚠️ Unhandled Rejection:', e.message));
process.on('uncaughtException', (e) => console.error('⚠️ Uncaught Exception:', e.message));

start();
