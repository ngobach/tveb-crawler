import path from 'path';
import fs from 'fs/promises';
import { fetchAndLoad } from './utils';

const TargetBase = 'https://nhasachmienphi.com';

const DataDir = path.join(process.cwd(), 'data');

class Crawler {
  async startCrawling () {
    // const cates = await this.#crawlCates();
    // this.#fileWriteJSON('categories.json', cates);
    console.log('Done crawling categories');

    // const indexes = await this.#fileReadJSON('indexes.json');
    const indexes = await this.#crawlIndexes();
    this.#fileWriteJSON('indexes.json', indexes);
    console.log('Done crawling indexes');

    // const books = await this.#crawlBooks(indexes);
    // this.#fileWriteJSON('books.json', books);
    const books = await this.#fileReadJSON('books.json');
    console.log('Done crawling books');
    console.log(books);
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
    const workerCount = 32;
    const maxPage = Number.MAX_VALUE; // set to a lower value for debugging

    let pageCounter = 0;
    await Promise.all(Array(workerCount).fill().map(async () => {
      while (true) {
        const page = ++pageCounter;
        console.log(`Crawling indexes of page ${page}`);
        const $ = await fetchAndLoad(`${TargetBase}/tat-ca-sach/page/${page}`);
        const elems = $('.item_sach').toArray();

        if (!elems.length || page > maxPage) {
          console.log('Worker exiting...');

          return;
        }

        indexes.push(...elems.map(el => ({
          slug: $(el).find('a').attr('href').replace(/^.*\/(.*)\.html$/i, '$1'),
          title: $(el).find('h4').text(),
          // thumbnailUrl: this.#normalizeUrl($(el).find('img.medium_thum').attr('src'))
        })));
      }
    }));

    return indexes;
  }

  async #crawlBooks (indexes) {
    const workerCount = 32;
    const jobs = [...indexes];
    const books = [];

    await Promise.all(Array(workerCount).fill().map(async () => {
      while (true) {
        const job = jobs.splice(0, 1)[0];
        if (!job) {
          console.log('Worker exiting...');
          return;
        }

        console.log(`Crawling book: ${job.title} (${jobs.length} left)`);
        const $ = await fetchAndLoad(`${TargetBase}/${job.slug}.html`);

        const book = {
          title: $('h1.tblue').text(),
          category: $('a.tblue').attr('href').replace(/^.*\/(.*)$/, '$1'),
          thumbnailUrl: this.#normalizeUrl($('.content_page img').attr('src')),
          resources: {}
        };

        const $btns = $('.button');
        $btns.toArray().forEach($btn => {
          const type = $btn.attribs.class.split(/\s+/).filter(it => it && it !== 'button')[0];

          if (!type) {
            throw new Error('Unknown type', $btn.attribs.class);
          }

          book.resources[type] = this.#normalizeUrl($btn.attribs.href);
        });

        books.push(book);

        // if (Math.PI) {
        //   return;
        // }
      }
    }));

    return books;
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

  #normalizeUrl (rawUrl) {
    return new URL(rawUrl, TargetBase).toString();
  }
};

export default Crawler;
