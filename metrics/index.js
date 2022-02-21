const exec = require('util').promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs');
const log4js = require('log4js');

const logger = log4js.getLogger('metric');
logger.level = 'debug';

require('dotenv').config();

const okRex = /ok: ([0-9.]+)/;

const metrics = {
  test: (solutionDir, tasknumber) => {
    return {
      pubScore: 0.9,
      privScore: 0.8,
    };
  },
  f1_hh: async (solutionDir, tasknumber) => {
    const errObj = {
        pubScore: -1,
        privScore: -1,
        statusMesasge: 'Metric error',
    };
    const getCmdRes = async (index) => {
      const cmd = 
        `${path.join(__dirname, 'f1_hh.py')} `+
        `${path.join(solutionDir, 'answers.csv')} `+
        `${process.env['ANSWERS_'+tasknumber]} ${index}`;
        //`${process.env['ANSERS_'+tasknumber]} ${process.env['INDEX_'+tasknumber]}`;
      logger.debug(`metric cmd: ${cmd}`);
      const { stdout, stderr } = await exec(cmd);
      console.log(stdout);
      if (okRex.test(stdout)) {
        const score = parseFloat(okRex.exec(stdout)[1]);
        return score;
      }
      else {
        throw Error('metric cmd error');
      }
    }
    try {
      if (!fs.existsSync(path.join(solutionDir, 'answers.csv'))) {
        return errObj;
      }
      return {
        pubScore: await getCmdRes(process.env['PUB_INDEX_'+tasknumber]),
        privScore: await getCmdRes(process.env['PRIV_INDEX_'+tasknumber]),
      }
    } catch(e) {
      console.log(e);
      return errObj;
    }
  },
};

async function main() {
  console.log(await metrics['f1_hh']('/home/user/champdata/priv', 1));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = metrics;
