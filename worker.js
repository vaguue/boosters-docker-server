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
    await exec(`docker kill worker${id}`);
  } catch(e) {
    //console.log(e);
  }
  try {
    await exec(`docker rm worker${id}`);
  } catch(e) {
    //console.log(e);
  }
}

async function processSubmit(config, submit) {//TODO add time limit
  const { 
    id, 
    mainServer, 
    testDatasetDir, finalDatasetDir, 
    champname, dockerAccess, secretKey,
    timeLimit = 2700000,
    metric,
    zipDir = '/home/user/zips', metaInfoDir = '/home/user/meta',
    solutionsDir = path.join('/home/user/workers', `worker${id}`),
    dockerConfig = {} 
  } = config;
  const { 
    tasknumber,
    file, // {folder, url}
    commandname,
  } = submit;

  const logger = log4js.getLogger(`worker${id}'s process`);
  logger.level = 'debug';

  logger.debug(`time limit is ${timeLimit}ms`);
  await exec(`mkdir -p ${zipDir}`);
  await exec(`mkdir -p ${metaInfoDir}`);
  await exec(`mkdir -p ${solutionsDir}`);

  //const localName = `${commandname}-${new Date(Date.now()).toISOString()}-${uuidv4().slice(0, 4)}`;
  const localName = `${commandname.replace(/ /g, '_')}-${tasknumber}-${Date.now()}-${uuidv4().slice(0, 4)}`;
  const solutionDir = path.join(solutionsDir, localName);
  //await exec(`mkdir -p ${solutionDir}`);
  const zip = await axios.get(
    `http://${mainServer}/us/sol/${file.folder || '/'}/${file.url}?`+
    `champname=${champname}&commandname=${encodeURI(commandname)}&dockerAccess=${dockerAccess}&secretKey=${secretKey}`,
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

  let stoped = false;
  let timerId = null;
  try {
    logger.debug(`test docker cmd: ${dockerCmd(testDatasetDir)}`);
    timerId = setTimeout(async () => {
      stoped = true;
      await tryRm(id);
      logger.debug('time limit reached');
    }, timeLimit);
    const { stdout, stderr } = await exec(dockerCmd(testDatasetDir));
    clearTimeout(timerId);
    if (stoped) {
      throw Error('Time limit');
    }
    if (stderr) {
      throw stderr;
    }
  } catch(e) {
    clearTimeout(timerId);
    logger.debug(`test execution error: ${e}`)
    if (stoped) {
      return { status: 'error', statusMessage: 'Time limit'};
    }
    return { status: 'error', statusMessage: 'Test error', logs: fs.readFileSync(path.join(solutionDir, 'output2.txt')).toString() };
  }

  await tryRm(id);

  let executionTime = -1;
  try {
    logger.debug(`docker cmd: ${dockerCmd(finalDatasetDir)}`);
    timerId = setTimeout(async () => {
      stoped = true;
      await tryRm(id);
      logger.debug('time limit reached');
    }, timeLimit);
    const { stdout, stderr } = await exec(dockerCmd(finalDatasetDir));
    clearTimeout(timerId);
    const { stdout: metaRaw } = await exec(`docker inspect worker${id}`);
    fs.writeFileSync(path.join(metaInfoDir, localName), metaRaw);
    const meta = JSON.parse(metaRaw);
    executionTime = new Date(meta[0].State.FinishedAt) - new Date(meta[0].State.StartedAt);
    if (stoped) {
      throw Error('Time limit');
    }
    if (stderr) {
      throw stderr;
    }
  } catch(e) {
    clearTimeout(timerId);
    logger.debug(`execution error: ${e}`)
    if (stoped) {
      return { status: 'error', statusMessage: 'Time limit'};
    }
    return { status: 'error', statusMessage: 'Execution error' };
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
  const con = await amqp.connect(process.env.RABBITMQ_SERVER);
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
      const data = JSON.parse(msg.content);
      const { commandname, champname, solnumber } = data;
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
