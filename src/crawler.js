import path from 'path';
import fs from 'fs/promises';
import { fetchAndLoad } from './utils';

const TargetBase = 'https://nhasachmienphi.com';

const DataDir = path.join(process.cwd(), 'data');

class Crawler {
  async startCrawling () {
    // const cates = await this.#crawlCates();
    // this.#fileWriteJSON('categories.json', cates);
    // console.log('Done crawling categories');

    const indexes = await this.#crawlIndexes();
    this.#fileWriteJSON('indexes.json', indexes);
    console.log('Done crawling indexes');

    console.log(indexes);
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

  async #crawlIndexes () {
    const indexes = [];
    const maxPage = 1; // for debugging

    for (let page = 1; ; page++) {
      const $ = await fetchAndLoad(`${TargetBase}/tat-ca-sach/page/${page}`);
      const elems = $('.item_sach').toArray();

      if (!elems.length || page > maxPage) {
        break;
      }

      indexes.push(...elems.map(el => {
        const slug = $(el).find('a').attr('href').replace(/^.*\/(.*)\.html$/i, '$1');
        const title = $(el).find('h4').text();
        const thumbnailUrl = new URL($(el).find('img.medium_thum').attr('src'), TargetBase).toString();

        return {
          slug,
          title,
          thumbnailUrl
        };
      }));
    }

    return indexes;
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
