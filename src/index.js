import 'isomorphic-unfetch';
import Crawler from './crawler';
import debug from 'debug';

const log = debug('crawler:main');

async function main () {
  try {
    await (new Crawler()).startCrawling();
  } catch (error) {
    console.error(error.message);
    log(error);
    process.exit(1);
  }
}

main();
