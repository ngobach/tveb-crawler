import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { fetchAndLoad } from './utils';

const TargetBase = 'https://nhasachmienphi.com';

const DataDir = path.join(process.cwd(), 'data');

class Crawler {
  /**
   * @type {puppeteer.Browser}
   */
  #browser = null;

  async startCrawling () {
    if (!await this.#fileExists('categories.json')) {
      this.#fileWriteJSON('categories.json', await this.#crawlCates());
      console.log('Done crawling categories');
    }
    // const categories = this.#fileReadJSON('categories.json');

    if (!await this.#fileExists('indexes.json')) {
      this.#fileWriteJSON('indexes.json', await this.#crawlIndexes());
      console.log('Done crawling indexes');
    }
    const indexes = await this.#fileReadJSON('indexes.json');

    if (!await this.#fileExists('books_raw.json')) {
      this.#fileWriteJSON('books_raw.json', await this.#crawlBooks(indexes));
      console.log('Done crawling books');
    }
    const rawBooks = await this.#fileReadJSON('books_raw.json');

    this.#browser = await puppeteer.launch();

    // if (!await this.#fileExists('books.json')) {
    // this.#fileWriteJSON('books.json', await this.#ripBooks(rawBooks.slice(0, 2)));
    // console.log('Done ripping books');
    // }

    await this.#ripUrl('https://nhasachmienphi.com/doc-online/truyen-tranh-loc-dinh-ky-326474', 'foo-bar', 'foo-bar');
    await this.#browser.close();
  }

  async #crawlCates () {
    const $ = await fetchAndLoad(TargetBase);
    const cateElements = $('.main_home > .row .item_folder');
    const cates = cateElements.toArray().map(el => {
      const anchorElement = $(el).find('a');

      return {
        title: anchorElement.text(),
        slug: anchorElement.attr('href').replace(/^.*\/(.*)$/i, '$1'),
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
          resources: {},
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

  async #ripBooks (rawBooks) {
    const workerCount = 2;
    const jobs = Object.entries(rawBooks);
    const books = { length: 0 };

    await Promise.all(Array.from({ length: workerCount }).map(async () => {
      const [idx, rawBook] = jobs.splice(0, 1)[0] ?? [];
      if (idx === undefined) {
        console.log('Worker exiting...');
      }

      console.log(rawBook);
    }));

    return Array.from(books);
  }

  async #ripUrl (url, outputPath, basename) {
    if (url.includes('/readfile-online')) {
      // Skip theses
      return null;
    } else if (url.includes('/doc-online')) {
      // Convert to PDF
      // const response = await fetch(url);
      // // const html = await response.text();
      const page = await this.#browser.newPage();
      await page.goto(url, { waitUntil: 'load' });
      await page.setContent((await page.$eval('.content_p', e => e.innerHTML)));
      await this.#fileWriteBin(path.join(outputPath, `${basename}_online.pdf`), await page.createPDFStream());
      await page.close();
    } else {
      const ext = url.match(/^.*\.(.{1,4})$/)?.[1] ?? `_${Math.random().toString(36).substring(2)}.bin`;
      const response = await fetch(url);
      await this.#fileWriteBin(path.join(outputPath, `${basename}.${ext}`), response.body);
    }
  }

  async #fileWriteBin (filePath, data) {
    const actualPath = path.join(DataDir, filePath);
    await fs.mkdir(path.dirname(actualPath), { recursive: true });
    await fs.writeFile(actualPath, data);
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

  async #fileExists (filePath) {
    const actualPath = path.join(DataDir, filePath);

    try {
      return (await fs.stat(actualPath)).isFile();
    } catch (error) {
      return false;
    }
  }

  #normalizeUrl (rawUrl) {
    return new URL(rawUrl, TargetBase).toString();
  }
};

export default Crawler;
