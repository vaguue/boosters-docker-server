const csv = require('csv')
const { parse } = require('csv-parse/sync')
const { stringify } = require('csv-stringify/sync');
const fs = require('fs')

const dataset = '/home/user/champdata/pub/test.csv';
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
  //console.log(pubIdxData);
  //console.log(privIdxData);
  //console.log(datasetData);
  const filterPub = datasetData.filter(e => !pubIdxData.find(v => v == e.review_id));
  //console.log(datasetData.length, filterPub.length);
  const res = stringify(filterPub, { header: true });
  fs.writeFileSync('out.csv', res);
  console.log('done');
}

main().catch(console.error);
