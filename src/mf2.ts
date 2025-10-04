import * as _ from 'lodash';
import { mf2 } from 'microformats-parser';

import fetch from 'node-fetch';
import { URL } from 'url';

import {
  ParsedDocumentFetchFn,
  PostProperties,
  SimplifiedCite,
  SimplifiedEntry,
  SimplifiedEvent,
  SimplifiedFeed,
  SimplifiedPost,
} from './mf2-models';

import urljoin = require('url-join');
import { MicroformatProperty, MicroformatRoot, Html, ParsedDocument, MicroformatProperties } from './types/microformat-parser';
import { find_author } from './author';
import { find_first_entry, get_plain_text, is_microformat_root, is_name_a_title, matches_mf2_type } from './utils';

function is_html(p: MicroformatProperty): p is Html {
  return p !== undefined && (p as Html).html !== undefined;
}

/**
 * Fetch document from URL and parse it for MF2, and return the result
 *
 * @param url the URL to fetch and parse
 * @returns a parsed MF2 document
 */
export async function parse_mf2(url: string): Promise<ParsedDocument> {
  function get_base_url(url: string): string {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  }
  const response = await fetch(url);
  const page: string = await response.text();
  const baseUrl = get_base_url(url);
  return mf2(page, { baseUrl });
}

export function normalize_dt(s: string): string | null {
  if (!s) {
    return null;
  }
  s = s.replace('\\s+', s);
  const date_re = '(?<year>\\d{4,})-(?<month>\\d{1,2})-(?<day>\\d{1,2})';
  const time_re =
    '(?<hour>\\d{1,2}):(?<minute>\\d{2})(:(?<second>\\d{2})(.(?<microsecond>\\d+))?)?';
  const tz_re = '(?<tzz>Z)|(?<tzsign>[+-])(?<tzhour>\\d{1,2}):?(?<tzminute>\\d{2})';
  const dt_re = `${date_re}((T| )${time_re} ?(${tz_re})?)?( .{3})?$`;
  const m = s.match(dt_re);
  if (!m || m.length === 0) {
    throw new Error(`unrecognized date format ${s}`);
  }
  if (!m.groups) {
    throw new Error(`match should return groups`);
  }
  const year = m.groups.year.padStart(2, '0');
  const month = m.groups.month.padStart(2, '0');
  const day = m.groups.day.padStart(2, '0');
  let hour = m.groups.hour;
  if (hour === undefined) {
    return `${year}-${month}-${day}`;
  }
  hour = hour.padStart(2, '0');
  const minute = m.groups.minute !== undefined ? m.groups.minute.padStart(2, '0') : '00';
  const second = m.groups.second !== undefined ? m.groups.second.padStart(2, '0') : '00';

  const date_str = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  if (m.groups.tzz) {
    return `${date_str}Z`;
  } else {
    const tzsign = m.groups.tzsign;
    let tzhour = m.groups.tzhour;
    if (tzsign !== undefined && tzhour !== undefined) {
      tzhour = tzhour.padStart(2, '0');
      const tzminute = m.groups.tzminute !== undefined ? m.groups.tzminute.padStart(2, '0') : '00';
      return `${date_str}${tzsign}${tzhour}:${tzminute}`;
    }
  }
  return date_str;
}

export function convert_relative_paths_to_absolute(
  source_url: string,
  base_href: string | null,
  html: string
): string {
  function convert(match: string, p1: string, p2: string, p3: string): string {
    const base_url = base_href ? urljoin(source_url, base_href) : source_url;
    const absurl = urljoin(base_url, p2);
    const converted = `${p1}${absurl}${p3}`;
    return converted;
  }

  const URL_ATTRIBUTES = {
    a: ['href'],
    link: ['href'],
    img: ['src'],
    audio: ['src'],
    video: ['src', 'poster'],
    source: ['src'],
  };

  if (source_url && html) {
    for (const [tagname, attributes] of Object.entries(URL_ATTRIBUTES)) {
      for (const attribute of attributes) {
        const re = new RegExp(`(<${tagname}[^>]*?${attribute}\\s*=\\s*['"])(.*?)(['"])`, 'imsg');
        html = html.replace(re, convert);
      }
    }
  }
  return html;
}

/**
 * Interpret a permalink of unknown type. Finds the first interesting
 * h-* element, and delegates to :func:`interpret_entry` if it is an
 * h-entry or :func:`interpret_event` for an h-event
 *
 * @param parsed the result of parsing a mf2 document
 * @param source_url the URL of the source document (used for authorship discovery)
 * @param base_href (optional) the href value of the base tag
 * @param item (optional) the item to be parsed. If provided,
 * this will be used instead of the first element on the page.
 * @param use_rel_syndication (optional, default True) Whether
 * to include rel=syndication in the list of syndication sources. Sometimes
 * useful to set this to False when parsing h-feeds that erroneously include
 * rel=syndication on each entry.
 * @param fetch_mf2_func: (optional) function to fetch mf2 parsed
 * output for a given URL.
 * @return an object as described by interpret_entry or interpret_event, or None
 **/
export async function interpret(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hentry: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedPost | null> {
  hentry = hentry || find_first_entry(parsed, ['h-entry', 'h-event', 'h-cite']);
  if (hentry) {
    if (matches_mf2_type(hentry, ['h-event'])) {
      return interpret_event(
        parsed,
        source_url,
        base_href,
        hentry,
        use_rel_syndication,
        fetch_mf2_func
      );
    } else if (matches_mf2_type(hentry, ['h-entry'])) {
      return interpret_entry(
        parsed,
        source_url,
        base_href,
        hentry,
        use_rel_syndication,
        fetch_mf2_func
      );
    } else if (matches_mf2_type(hentry, ['h-cite'])) {
      return interpret_cite(
        parsed,
        source_url,
        base_href,
        hentry,
        use_rel_syndication,
        fetch_mf2_func
      );
    }
  }
  return null;
}

export async function interpret_properties(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null,
  hentry: MicroformatRoot,
  use_rel_syndication: boolean,
  fetch_mf2_func: ParsedDocumentFetchFn | null
): Promise<PostProperties> {
  const dict: {[key: string]: string|null} = {};
  const props = hentry.properties;

  for (const prop of ['url', 'uid', 'photo', 'featured']) {
    const value = get_plain_text(props[prop]);
    if (value) {
      dict[prop] = value;
    }
  }
  for (const prop of ['start', 'end', 'published', 'updated', 'deleted']) {
    const date_str = get_plain_text(props[prop]);
    if (date_str) {
      try {
        dict[prop] = normalize_dt(date_str);
      } catch (e) {
        dict[prop] = date_str;
      }
    }
  }

  const result = dict as PostProperties;

  const author = await find_author(parsed, hentry, fetch_mf2_func);
  if (author) {
    result.author = author;
  }

  const content_props = props.content;
  if (content_props) {
    const content_prop = content_props[0];
    let content_html: string | MicroformatProperty;
    let content_value: string | MicroformatProperty;
    if (is_html(content_prop)) {
      content_html = (content_prop.html || '').trim();
      content_value = (content_prop.value || '').trim();
    } else {
      content_value = content_html = content_prop;
    }
    result.content = convert_relative_paths_to_absolute(
      source_url,
      base_href,
      content_html as string
    );
    result['content-plain'] = content_value as string;
  }
 
  const name = get_plain_text(hentry.properties.name);
  if (name) {
    if (matches_mf2_type(hentry, ['h-entry', 'h-cite'])) {
      if (is_name_a_title(name, dict['content-plain'])) {
        dict.name = name;
      }
    } else {
      dict.name = name;
    }
  }

  const summary_prop = props.summary;
  if (summary_prop) {
    result.summary = is_html(summary_prop[0]) ? summary_prop[0].value : (summary_prop[0] as string);
  }

  // TODO: set up location info

  let syndication: string[] = [];
  if (use_rel_syndication) {
    const rel_syndications = (parsed.rels || {}).syndication || [];
    const hentry_syndications = hentry.properties.syndication || [];
    syndication = [...new Set([...rel_syndications, ...hentry_syndications])] as string[];
  } else {
    syndication = (hentry.properties.syndication || []) as string[];
  }
  if (_.size(syndication) > 0) {
    result.syndication = syndication;
  }
  for (const prop of ['in-reply-to', 'like-of', 'repost-of', 'bookmark-of']) {
    for (const url_val of hentry.properties[prop] || []) {
      (result as any)[prop] = (result as any)[prop] || [];
      if (is_microformat_root(url_val)) {
        (result as any)[prop].push(
          await interpret(
            parsed,
            source_url,
            base_href,
            url_val,
            use_rel_syndication,
            fetch_mf2_func
          )
        );
      } else {
        (result as any)[prop].push({ url: url_val });
      }
    }
  }
  return result;
}

export async function interpret_event(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hentry: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedEvent | null> {
  hentry = hentry || find_first_entry(parsed, ['h-event']);
  if (!hentry) {
    return null;
  }
  const result = await interpret_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  );

  return {
    type: 'event',
    ...result
  }
}

export async function interpret_cite(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hentry: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedCite | null> {
  hentry = hentry || find_first_entry(parsed, ['h-cite']);
  if (!hentry) {
    return null;
  }
  const result = await interpret_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  );

  return {
    type: 'cite',
    ...result
  }
}

/**
 * Given a document containing an h-entry, return an object
 * {
 * 'type': 'entry',
 * 'url': the permalink url of the document (may be different than source_url),
 * 'published': datetime or date,
 * 'updated': datetime or date,
 * 'name': title of the entry,
 * 'content': body of entry (contains HTML),
 * 'author': {
 *   'name': author name,
 *   'url': author url,
 *   'photo': author photo
 * },
 * 'syndication': [
 * 'syndication url'.
 *  ...
 * ],
 * "in-reply-to': [...],
 * 'like-of': [...],
 * 'repost-of': [...],
 * }
 * @param parsed the result of parsing a document containing mf2 markup
 * @param source_url the URL of the parsed document, used by the authorship algorithm
 * @param base_href (optional) the href value of the base tag
 * @param hentry (optional) the item in the above document representing the h-entry. if
 * provided, we can avoid a redundant call to find_first_entry
 * @param use_rel_syndication: (optional, default True) Whether to
 * include rel=syndication in the list of syndication sources. Sometimes
 * useful to set this to False when parsing h-feeds that erroneously include
 * rel=syndication on each entry.
 * @param fetch_mf2_func: (optional) function to fetch mf2 parsed output for a given URL.
 * @return an object with some or all of the described properties
 **/
export async function interpret_entry(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hentry: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedEntry | null> {
  hentry = hentry || find_first_entry(parsed, ['h-entry']);
  if (!hentry) {
    return null;
  }
  const result = await interpret_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  );
  return {
    type: 'entry',
    ...result
  }
}

/**
 * Interpret a source page as an h-feed or as a top-level collection
 * of h-entries
 * @param parsed the result of parsing a mf2 document
 * @param source_url the URL of the source document (used for authorship discovery)
 * @param base_href (optional) the href value of the base tag
 * @param hfeed (optional) the h-feed to be parsed. If provided,
 * this will be used instead of the first h-feed on the page.
 * @param fetch_mf2_func (optional) function to fetch mf2 parsed output for a given URL.
 * @return an object containing 'entries', a list of entries, and possibly other
 * feed properties (like 'name').
 *
 */
export async function interpret_feed(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hfeed: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedFeed> {
  hfeed = hfeed || find_first_entry(parsed, ['h-feed']);

  const result: SimplifiedFeed = {};

  let children: MicroformatRoot[];
  if (hfeed) {
    const names = hfeed.properties.name;
    if (names) {
      result.name = names[0] as string;
    }
    children = hfeed.children || [];
  } else {
    children = parsed.items || [];
  }
  const entries: SimplifiedPost[] = [];
  for (const child of children) {
    const entry = await interpret(
      parsed,
      source_url,
      base_href,
      child,
      use_rel_syndication,
      fetch_mf2_func
    );
    if (entry) {
      entries.push(entry);
    }
  }
  result.entries = entries;
  return result;
}
