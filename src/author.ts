import _ = require("lodash");
import { AuthorInfo, ParsedDocumentFetchFn } from "./mf2-models";
import { MicroformatRoot, ParsedDocument } from "./types/microformat-parser";
import { find_all_entries, find_all_entries_gen, find_first_entry, get_plain_text, is_microformat_root } from "./utils";

/**
 * Parse the value of a u-author property, can either be a compound
 * h-card or a single name or url.
 * 
 * @param obj the mf2 property value, either an object or a string
   @return an object containing the author's name, photo, and url
 */
function parse_author(obj: string | MicroformatRoot): AuthorInfo {
  const result: AuthorInfo = {};
  if (is_microformat_root(obj)) {
    const names = obj.properties.name as string[];
    if (_.size(names) > 0) {
      result.name = names[0];
    }

    const photos = obj.properties.photo;
    if (_.size(photos) > 0) {
      const photo = get_plain_text(photos);
      if (photo) {
        result.photo = photo;
      }
    }

    const urls = obj.properties.url as string[];
    if (_.size(urls) > 0) {
      result.url = urls[0];
    }
  } else if (obj) {
    if (obj.startsWith('http://') || obj.startsWith('https://')) {
      result.url = obj;
    } else {
      result.name = obj;
    }
  }
  return result;
}

function urlEqual(url1: string, url2: string): boolean {
  const _url1 = url1.endsWith('/') ? url1.slice(0, -1) : url1;
  const _url2 = url2.endsWith('/') ? url2.slice(0, -1) : url2;
  return _url1 === _url2;
}

function find_hentry_author(hentry: MicroformatRoot) {
  const vals = hentry.properties.author || [];
  if (_.size(vals) === 0) {
    return null;
  }
  return parse_author(vals[0] as MicroformatRoot);
}

/**
 * Use the authorship discovery algorithm
 * https://indiewebcamp.com/authorship to determine an h-entry's
 * author.
 *
 * @param parsed an mf2 parsed object
 * @param hentry optional, the h-netry we're examining, if omitted we'll just use the first one
 * @param fetch_author if true we will follow author page URLs
 * @return a promise for an object containing author's name, photo, url
 */
export async function find_author(
  parsed: ParsedDocument,
  hentry: MicroformatRoot | null,
  fetch_mf2_func: ParsedDocumentFetchFn | null
): Promise<AuthorInfo | null> {

  function find_parent_hfeed_author(hentry: MicroformatRoot) {
    const hfeeds = find_all_entries_gen(parsed, ['h-feed'], false);
    for (const hfeed of hfeeds) {
      const feed_children = hfeed.children || [];
      if (feed_children.includes(hentry)) {
        // not the hentry, but this works
        return find_hentry_author(hfeed);
      }
    }
  }

  hentry = hentry || find_first_entry(parsed, ['h-entry']);
  if (!hentry) {
    return null;
  }

  // 3. if the h-entry has an author property, use that
  // 4. otherwise if the h-entry has a parent h-feed with author property,
  //    use that
  const author = find_hentry_author(hentry) || find_parent_hfeed_author(hentry);
  let author_page;
  if (author) {
    // 5.2 otherwise if author property is an http(s) URL, let the
    //     author-page have that URL
    if (_.isEqual(Object.keys(author), ['url'])) {
      author_page = author['url'];
    }
    // 5.1 if it has an h-card, use it, exit.
    // 5.3 otherwise use the author property as the author name,
    //     exit.
    else {
      return author;
    }
  }

  // 6. if there is no author-page and the h-entry's page is a permalink page
  if (!author_page) {
    // 6.1 if the page has a rel-author link, let the author-page's
    //     URL be the href of the rel-author link
    const rel_authors = (parsed.rels || {}).author || [];
    if (_.size(rel_authors) > 0) {
      author_page = rel_authors[0];
    }
  }
  if (author_page) {
    if (!fetch_mf2_func) {
      return {
        url: author_page,
      };
    }

    // 7.1 get the author-page from that URL and parse it for microformats2
    parsed = await fetch_mf2_func(author_page);
    const hcards = find_all_entries(parsed, ['h-card'], true);

    // 7.2 if author-page has 1+ h-card with url == uid ==
    //     author-page's URL, then use first such h-card, exit.
    for (const hcard of hcards) {
      const hcard_url = get_plain_text(hcard.properties.url);
      const hcard_uid = get_plain_text(hcard.properties.uid);
      if (hcard_url && hcard_uid && hcard_url === hcard_uid && urlEqual(hcard_url, author_page)) {
        return parse_author(hcard);
      }
    }

    // 7.3 else if author-page has 1+ h-card with url property
    //     which matches the href of a rel-me link on the author-page
    //     (perhaps the same hyperlink element as the u-url, though not
    //     required to be), use first such h-card, exit.
    const rel_mes = (parsed.rels || {}).me || [];
    for (const hcard of hcards) {
      const hcard_url = get_plain_text(hcard.properties.url);
      if (hcard_url && rel_mes.includes(hcard_url)) {
        return parse_author(hcard);
      }
    }

    // 7.4 if the h-entry's page has 1+ h-card with url ==
    //     author-page URL, use first such h-card, exit.
    for (const hcard of hcards) {
      const hcard_url = get_plain_text(hcard.properties.url);
      if (hcard_url && urlEqual(hcard_url, author_page)) {
        return parse_author(hcard);
      }
    }

    // 8. otherwise no deterministic author can be found.
    return null;
  }

  return null;
}

/**
 * Find the representative h-card for a URL
 * http://microformats.org/wiki/representative-h-card-parsing

 * @param parsed
 * @param source_url
 * @return the representative h-card if one is found
 */
export function representative_hcard(
  parsed: ParsedDocument,
  source_url: string
): MicroformatRoot | null {
  const hcards = find_all_entries(parsed, ['h-card'], true);

  // uid and url both match source_url
  for (const hcard of hcards) {
    if (
      _.includes(hcard.properties.uid, source_url) &&
      _.includes(hcard.properties.url, source_url)
    ) {
      return hcard;
    }
  }

  // url that is also a rel=me
  const rel_mes = (parsed.rels || {}).me || [];
  for (const hcard of hcards) {
    if (_.some(hcard.properties.url, (url) => _.includes(rel_mes, url))) {
      return hcard;
    }
  }

  // single hcard with matching url
  let found = null;
  let count = 0;
  for (const hcard of hcards) {
    if (_.includes(hcard.properties.url, source_url)) {
      found = hcard;
      count += 1;
    }
  }

  return count === 1 ? found : null;
}