const fs = require('fs');
const path = require('path');

packageInfo = fs.existsSync(path.join(__dirname, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')).toString()) : {};

const name = packageInfo.name || path.basename(__dirname);
module.exports = {
  apps: [
    {
      name, 
      script: `${__dirname}/start.sh`,
      watch_delay: 1000,
    },
    /*{
      name: 'rabbitmq-wrapper', 
      script: `${__dirname}/rabbitmq.sh`,
      watch: ['rabbitmq.sh'],
      watch_delay: 1000,
      autorestart: false,
    },*/
  ],
};
