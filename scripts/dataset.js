const csv = require('csv')
const { parse } = require('csv-parse/sync')
const { stringify } = require('csv-stringify/sync');
const fs = require('fs')

const answers = '/home/user/champdata/priv/HeadHunter_ans.csv';
const dataset = '/home/user/champdata/pub/HeadHunter_test.csv';
const testDataset = '/home/user/champdata/test/test.csv';
const pubIdx = '/home/user/champdata/priv/HeadHunter_pub.csv';
const privIdx = '/home/user/champdata/priv/HeadHunter_priv.csv';
async function main() {
  const pubIdxData = parse(fs.readFileSync(pubIdx).toString(), {
    columns: true,
    skip_empty_lines: true
  }).map(e => Object.values(e)[0]);
  const privIdxData = parse(fs.readFileSync(privIdx).toString(), {
    columns: true,
    skip_empty_lines: true
  }).map(e => Object.values(e)[0]);
  const datasetData = parse(fs.readFileSync(dataset).toString(), {
    columns: true,
    skip_empty_lines: true
  });
  const answersData = parse(fs.readFileSync(answers).toString(), {
    columns: true,
    skip_empty_lines: true
  });
  /*const filterPub = datasetData.filter(e => !pubIdxData.find(v => v == e.review_id));
  const res = stringify(filterPub, { header: true });
  fs.writeFileSync('out.csv', res);*/

  const filterPriv = datasetData.filter(e => !privIdxData.find(v => v == e.review_id))
    .map(e => ({...e, target: answersData.find(v => v.review_id == e.review_id).target}));
  console.log(filterPriv);
  const res = stringify(filterPriv, { header: true });
  fs.writeFileSync('out.csv', res);

  console.log('done');
}

main().catch(console.error);
