const amqp = require('amqplib');
const metrics = require('./metrics');
const startWorker = require('./worker');

require('dotenv').config();

async function main() {
  for (let i = 0; i < 2; ++i) {
    startWorker({
      id: i,
      taskNumber: 2,
      mainServer: process.env.MAIN_SERVER_IP,
      testDatasetDir: '/home/seva/champdata/test',
      finalDatasetDir: '/home/seva/champdata/pub',
      champname: 'hh_recsys',
      //champname: 'jaefji',
      timeLimit: 4800000,
      dockerAccess: process.env.MAIN_SERVER_DOCKER_ACCESS,
      secretKey: process.env.MAIN_SERVER_SECRET_KEY,
      metric: metrics['mrr'],
      dockerConfig: {
        imageName: 'serega/gpu',
        noGpu: false,
        memory: '80g',
      },
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}
