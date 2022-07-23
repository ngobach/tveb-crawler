import 'isomorphic-unfetch';
import Crawler from './crawler';
import debug from 'debug';

const log = debug('crawler:main');

async function main () {
  try {
    await (new Crawler()).startCrawling();
  } catch (error) {
    log(error);
  }
}

main();
