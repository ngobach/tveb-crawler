import path from 'path';
import fs from 'fs/promises';
import { fetchAndLoad } from './utils';

const TargetBase = 'https://nhasachmienphi.com';
const DataDir = path.join(process.cwd(), 'data');

class Crawler {
  async startCrawling () {
    const cates = await this.#crawlCates();
    this.#fileWriteJSON('categories.json', cates);
  }

  async #crawlCates () {
    const $ = await fetchAndLoad(TargetBase);
    const cateElements = $('.main_home > .row .item_folder');
    const cates = cateElements.toArray().map(el => {
      const anchorElement = $(el).find('a');

      return {
        title: anchorElement.text(),
        slug: anchorElement.attr('href').replace(/^.*\/(.*)$/i, '$1')
      };
    });

    return cates;
  }

  async #fileWriteBin (filePath, data) {

  }

  async #fileWriteJSON (filePath, data) {
    const actualPath = path.join(DataDir, filePath);
    await fs.mkdir(path.dirname(actualPath), { recursive: true });
    await fs.writeFile(actualPath, JSON.stringify(data));
  }

  async #fileReadJSON (filePath) {
    const actualPath = path.join(DataDir, filePath);
    return JSON.parse(await fs.readFile(actualPath));
  }
};

export default Crawler;
