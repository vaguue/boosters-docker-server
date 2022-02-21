//import amqp from 'amqplib';
//import metrics from '@/lib/metrics';
//import startWorker from './worker';

const amqp = require('amqplib');
const metrics = require('./metrics');
const startWorker = require('./worker');

require('dotenv').config();

async function main() {
  startWorker({
    id: 0,
    //taskNumber: 2,
    taskNumber: 1,
    mainServer: process.env.MAIN_SERVER_IP, 
    testDatasetDir: '/home/user/champdata/test', 
    finalDatasetDir: '/home/user/champdata/pub', 
    //champname: 'HeadHunter', 
    champname: 'da', 
    dockerAccess: process.env.MAIN_SERVER_DOCKER_ACCESS, 
    secretKey: process.env.MAIN_SERVER_SECRET_KEY,
    metric: metrics['f1_hh'],
    dockerConfig: {
      imageName: 'kaggle/python-gpu-build',
      noGpu: false,
    },
  });
}

//async function fromConfig(config) {
//  return await Promise.all(config.workers.map(async e => {
//    const metric = metrics[e.metric];
//    return await startWorker({
//      ...e,
//      metric,
//    });
//  }));
//}

if (require.main === module) {
  main().catch(console.error);
}

//export { fromConfig };
