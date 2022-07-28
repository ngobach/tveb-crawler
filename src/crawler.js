import path from 'path';
import fs from 'fs/promises';
import asyncPool from 'tiny-async-pool';
import { fetchAndLoad } from './utils';

const TargetBase = 'https://nhasachmienphi.com';

const DataDir = path.join(process.cwd(), 'data');

class Crawler {
  async startCrawling () {
    if (!await this.#fileExists('categories.json')) {
      await this.#fileWriteJSON('categories.json', await this.#crawlCates());
      console.log('Done crawling categories');
    }
    // const categories = this.#fileReadJSON('categories.json');

    if (!await this.#fileExists('indexes.json')) {
      await this.#fileWriteJSON('indexes.json', await this.#crawlIndexes());
      console.log('Done crawling indexes');
    }
    const indexes = await this.#fileReadJSON('indexes.json');

    if (!await this.#fileExists('books_raw.json')) {
      await this.#fileWriteJSON('books_raw.json', await this.#crawlBooks(indexes));
      console.log('Done crawling books');
    }
    const rawBooks = await this.#fileReadJSON('books_raw.json');

    if (!await this.#fileExists('books.json')) {
      await this.#fileWriteJSON('books.json', await this.#ripBooks(rawBooks));
      console.log('Done ripping books');
    }

    // @WARN: testing
    // await this.#ripUrl('https://nhasachmienphi.com/doc-online/truyen-tranh-loc-dinh-ky-326474', 'foo-bar', 'foo-bar');
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
    const books = [];

    const crawlBook = async job => {
      const $ = await fetchAndLoad(`${TargetBase}/${job.slug}.html`);

      const book = {
        title: $('h1.tblue').text(),
        slug: job.slug,
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

      return book;
    };

    let counter = 0;
    for await (const book of asyncPool(32, indexes, crawlBook)) {
      books.push(book);
      counter++;
      console.log(`Crawled book: ${book.title} (${indexes.length - counter} left)`);
    }

    return books;
  }

  async #ripBooks (rawBooks) {
    const books = [];

    const ripBook = async rawBook => {
      const book = JSON.parse(JSON.stringify(rawBook));

      if (book.thumbnailUrl) {
        book.thumbnailUrl = await this.#ripUrl(book.thumbnailUrl, book.slug, `${book.slug}_thumbnail`);
      }

      for (const type of Object.keys(book.resources)) {
        book.resources[type] = await this.#ripUrl(book.resources[type], book.slug, book.slug);
        if (!book.resources[type]) {
          delete book.resources[type];
        }
      }

      return book;
    };

    let counter = 0;
    for await (const book of asyncPool(32, rawBooks, ripBook)) {
      books.push(book);
      counter++;
      console.log(`Crawled book: ${book.title} (${rawBooks.length - counter} left)`);
    }

    return books;
  }

  async #ripUrl (url, outputPath, basename) {
    if (url.includes('/readfile-online')) {
      // Skip theses
      return null;
    } else if (url.includes('/doc-online')) {
      // Convert to PDF
      // const response = await fetch(url);
      // // const html = await response.text();
      // const page = await this.#browser.newPage();
      // await page.goto(url, { waitUntil: 'load' });
      // await page.setContent((await page.$eval('.content_p', e => e.innerHTML)));
      // await this.#fileWriteBin(path.join(outputPath, `${basename}_online.pdf`), await page.createPDFStream());
      // await page.close();
      // @TODO
      return null;
    } else {
      const ext = url.match(/^.*\.(.{1,4})$/)?.[1] ?? `_${Math.random().toString(36).substring(2)}.bin`;
      const response = await fetch(url);
      const outputFile = path.join(outputPath, `${basename}.${ext}`);
      await this.#fileWriteBin(outputFile, response.body);

      return outputFile;
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
