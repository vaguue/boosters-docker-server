const amqp = require('amqplib');

/*const obj = {
  champname: 'HeadHunter',
  commandname: 'Booroondook 2000',
  tasknumber: '2',
  solnumber: 43,
  metric: 'F1_HH',
  file: {
    folder: 'HeadHunter',
    url: '67a2583e8b7c37ef866967360fdbc28393004c57b1a7fd22b0fc3949a059fee8'
  }
};*/

const obj = {
  champname: 'HeadHunter',
  commandname: 'opaopa',
  tasknumber: '2',
  solnumber: 80,
  metric: 'F1_HH',
  file: {
    folder: 'HeadHunter',
    url: '8566410d0bf0dbd857b97b6675f15e593cc1a7880028d6ca9b43c861af13b308'
  }
};

async function main() {
  const con = await amqp.connect(`amqp://localhost`);
  const channel = await con.createChannel();
  const queue = `HeadHunter-task2`
  console.log(`sending to queue ${queue}`);
  channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(obj)), { persistent: true });
  console.log('done');
}

main().catch(console.error);
