import { load } from 'cheerio';

export async function fetchAndLoad (url, option = {}) {
  const resp = await fetch(url, option);
  return load(await resp.text());
}
