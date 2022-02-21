const amqp = require('amqplib');
const exec = require('util').promisify(require('child_process').exec);
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AdmZip = require('adm-zip');
const path = require('path');
const log4js = require('log4js');
const fs = require('fs');

const tryRm = async (id) => {
  try {
    await exec(`docker rm worker${id}`);
  } catch(e) {

  }
}

async function processSubmit(config, submit) {//TODO add time limit
  const { 
    id, 
    mainServer, 
    testDatasetDir, finalDatasetDir, 
    champname, dockerAccess, secretKey,
    metric,
    zipDir = '/tmp', metaInfoDir = '/tmp/meta',
    solutionsDir = path.join('/tmp', `worker${id}`),
    dockerConfig = {} 
  } = config;
  const { 
    tasknumber,
    file, // {folder, url}
    commandname,
  } = submit;

  const logger = log4js.getLogger(`worker${id}'s process`);
  logger.level = 'debug';

  await exec(`mkdir -p ${zipDir}`);
  await exec(`mkdir -p ${metaInfoDir}`);
  await exec(`mkdir -p ${solutionsDir}`);

  //const localName = `${commandname}-${new Date(Date.now()).toISOString()}-${uuidv4().slice(0, 4)}`;
  const localName = `${commandname}-${tasknumber}-${Date.now()}-${uuidv4().slice(0, 4)}`;
  const solutionDir = path.join(solutionsDir, localName);
  //await exec(`mkdir -p ${solutionDir}`);
  const zip = await axios.get(
    `http://${mainServer}/us/sol/${file.folder || '/'}/${file.url}?`+
    `champname=${champname}&commandname=${commandname}&dockerAccess=${dockerAccess}&secretKey=${secretKey}`,
    {
      responseType: 'arraybuffer',
    }
  ).then(resp => new AdmZip(resp.data));
  zip.extractAllTo(solutionDir, true);
  zip.writeZip(path.join(zipDir, `${localName}.zip`));

  const dockerCmd = (datasetDir) => (
    `docker run ` +
    `--cpus="${dockerConfig.cpus || '8.0'}" ` +
    (dockerConfig.noGpu ? `` : `--gpus device=${id} `) +
    `-v ${solutionDir}/:/workspace/ ` +
    `-v ${datasetDir}:/workspace/data/:ro ` +
    `-w /workspace/ ` +
    `--memory ${dockerConfig.memory || '46g'} ` + //оперативная память ` --memory-swap 27g` + ` --oom-kill-disable` + 
    `--net none ` + 
    //` --rm `+ //удаляем файлы после того как контейнер отработал
    `--ipc=host `+ // shared memory fix https://github.com/ultralytics/yolov3/issues/283
    `-e TIME_LIMIT=300 ` +
    `--name worker${id} ` +
    //` -d `+
    `${dockerConfig.imageName || 'boostersgpu'} `+ //собранный образ, загруженный локально
    `${zip.getEntries().find(e => e.entryName == 'script.r') ? 'Rscript script.r' : 'python script.py'} 1>${solutionDir}/output1.txt 2>${solutionDir}/output2.txt`
  );
  
  await tryRm(id);

  try {
    logger.debug(`test docker cmd: ${dockerCmd(testDatasetDir)}`);
    const { stdout, stderr } = await exec(dockerCmd(testDatasetDir));
    if (stderr) {
      throw stderr;
    }
  } catch(e) {
    return { status: 'error', statusMessage: 'Test error', logs: fs.readFileSync(path.join(solutionDir, 'output2.txt')).toString() };
  }

  await tryRm(id);

  let executionTime = -1;
  try {
    logger.debug(`docker cmd: ${dockerCmd(finalDatasetDir)}`);
    const { stdout, stderr } = await exec(dockerCmd(finalDatasetDir));
    const { stdout: metaRaw } = await exec(`docker inspect worker${id}`);
    fs.writeFileSync(path.join(metaInfoDir, localName), metaRaw);
    const meta = JSON.parse(metaRaw);
    executionTime = new Date(meta[0].State.FinishedAt) - new Date(meta[0].State.StartedAt);
    if (stderr) {
      throw stderr;
    }
  } catch(e) {
    logger.debug(`execution error: ${e}`)
    return { status: 'errorr', statusMessage: 'Execution error' };
  }

  try {
    return { 
      status: 'ok', 
      ...await metric(solutionDir, tasknumber),
      executionTime,
    };
  } catch(e) {
    return {
      status: 'error',
      statusMessage: 'Metric error',
    }
  }
}

async function reply(con, config, data) {
  const { taskNumber = 0, champname, solnumber, commandname, id } = config;
  const channel = await con.createChannel();
  const queue = `${champname}-task${taskNumber}-results`;
  const resp = {
    champname, 
    commandname,
    result: {
      status: 'ok',
      statusMessage: 'ok',
      ...data,
    },
    task: {
      tasknumber: taskNumber,
      solnumber,
    },
  };
  const logger = log4js.getLogger(`worker${id}`);
  logger.level = 'debug';
  logger.debug(`sending ${JSON.stringify(resp, null, 2)} to ${queue}`);
  channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(resp)), { persistent: true  });
}

async function startWorker(config) {
  const { id, champname, taskNumber = 0 } = config;
  const logger = log4js.getLogger(`worker${id}`);
  logger.level = 'debug';
  const con = await amqp.connect(process.env.SERVER);
  const channel = await con.createChannel();
  const queue = `${champname}-task${taskNumber}`;
  logger.debug(`working on queue ${queue}`);
  channel.assertQueue(queue, { durable: true });
  channel.prefetch(1);
  let savedMsg = null;
  channel.consume(queue, async function(msg) {
    try {
      savedMsg = msg;
      const data = JSON.parse(msg.content);
      logger.debug(`input data`, data);
      const { commandname, champname, solnumber } = data;
      await reply(con, { ...config, commandname, solnumber }, { status: 'check', statusMessage: 'Launching' });
      await reply(con, { ...config, commandname, solnumber }, await processSubmit(config, data));
      channel.ack(msg);
      savedMsg = null;
    } catch(e) {
      logger.debug(`internal error: ${e}`);
      await reply(con, { ...config, commandname, solnumber }, { status: 'error', statusMessage: 'Internal error' });
      channel.ack(msg);
      //channel.nack(msg);
    }
  }, {
   noAck: false
  });
  logger.debug(`started worker${id}`);
  return {
    stop: async () => {
      if (savedMsg) {
        channel.nack(savedMsg);
      }
      await channel.close();
      await tryRm(id);
    },
  };
}

module.exports = startWorker;
