const queueRedis = require('./config/queueRedis');
console.log('Redis config loaded');
queueRedis.quit();
