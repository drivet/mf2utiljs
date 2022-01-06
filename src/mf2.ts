import * as _ from 'lodash';
import { mf2 } from 'microformats-parser';
import {
  Html,
  MicroformatProperties,
  MicroformatProperty,
  MicroformatRoot,
  ParsedDocument,
} from 'microformats-parser/dist/types';
import fetch from 'node-fetch';
import { URL } from 'url';
import { isUri } from 'valid-url';

import {
  AuthorInfo,
  ObjectWithStringValue,
  ParsedDocumentFetchFn,
  PartialPost,
  PostType,
  SimplifiedCite,
  SimplifiedEntry,
  SimplifiedEvent,
  SimplifiedFeed,
  SimplifiedPost,
} from './mf2-models';

import urljoin = require('url-join');

function is_microformat_root(p: MicroformatProperty | string): p is MicroformatRoot {
  return (p as MicroformatRoot).properties !== undefined;
}

function is_obj_with_string_value(p: unknown): p is ObjectWithStringValue {
  return (
    (p as ObjectWithStringValue).value !== undefined &&
    typeof (p as ObjectWithStringValue).value === 'string'
  );
}

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

/**
 * Find the first interesting h-* object in BFS-order
 *
 * @param parsed an mf2 parsed object
 * @param types array of types to look for
 * @return first h-* types that matches one of the array types
 *
 */
export function find_first_entry(parsed: ParsedDocument, types: PostType[]): MicroformatRoot {
  return find_all_entries_gen(parsed, types, false).next().value;
}

/**
 * Find all h-* objects of a given type in BFS-order. Traverses the
 * top-level items and their children and descendents. Includes property
 * values (e.g. finding all h-cards would not find values of
 * "p-author h-card") only if `include_properties` is True.

 * @param parsed an mf2 parsed object
 * @param types array of types to look for
 * @param include_properties if true we look at properties as well
 * @returns all matching objects
 */
export function find_all_entries(
  parsed: ParsedDocument,
  types: PostType[],
  include_properties = false
): MicroformatRoot[] {
  return [...find_all_entries_gen(parsed, types, include_properties)];
}

function* find_all_entries_gen(
  parsed: ParsedDocument,
  types: PostType[],
  include_properties: boolean
): Generator<MicroformatRoot> {
  const queue: MicroformatRoot[] = [...parsed.items];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      throw new Error('item is undefined');
    }
    const item_types = item.type || [];
    if (types.some((h_class) => _.includes(item_types, h_class))) {
      yield item;
    }
    queue.push(...(item.children || []));
    if (include_properties) {
      const rootList = _.flatten(Object.values(item.properties || {})).filter(is_microformat_root);
      queue.push(...rootList);
    }
  }
}

/**
 * Get the first value in a list of values that we expect to be plain-text.
 * If it is an object, then return the value of "value".
 *
 * @param values a list of values
 * @param strip true if we should strip the plaintext value
 * @return the text value or null
 */
function get_plain_text(values: MicroformatProperty[], strip = false): string | null {
  if (_.size(values) === 0) {
    return null;
  }

  const value = values[0];
  let v: string | null;
  if (is_obj_with_string_value(value)) {
    v = value.value;
  } else if (typeof value === 'string') {
    v = value;
  } else {
    v = null;
  }
  return v && strip ? v.trim() : v;
}

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
  function find_hentry_author(hentry: MicroformatRoot) {
    const vals = hentry.properties.author || [];
    if (_.size(vals) === 0) {
      return null;
    }
    return parse_author(vals[0] as MicroformatRoot);
  }

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

/**
 * Determine whether the name property represents an explicit title.
 * Typically when parsing an h-entry, we check whether p-name ==
 *  e-content (value). If they are non-equal, then p-name likely
 * represents a title.
 *
 * However, occasionally we come across an h-entry that does not
 * provide an explicit p-name. In this case, the name is
 * automatically generated by converting the entire h-entry content
 * to plain text. This definitely does not represent a title, and
 * looks very bad when displayed as such.
 *
 * To handle this case, we broaden the equality check to see if
 * content is a subset of name. We also strip out non-alphanumeric
 * characters just to make the check a little more forgiving.
 *
 * @param name the p-name property that may represent a title
 * @param content the plain-text version of an e-content property
 * @return true if the name likely represents a separate, explicit title
 *
 */
function is_name_a_title(
  name: string | null | undefined,
  content: string | null | undefined
): boolean {
  function normalize(s: string) {
    s = s.normalize('NFKD');
    s = s.toLowerCase();
    s = s.replace(
      /(~|`|!|@|#|$|%|^|&|\*|\(|\)|{|}|\[|\]|;|:|"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/g,
      ''
    );
    s = s.replace(/\s+/g, '');
    return s;
  }
  if (!content) {
    return true;
  }
  if (!name) {
    return false;
  }
  return !normalize(name).includes(normalize(content));
}

function is_prop_uri(props: MicroformatProperties, name: string): string | undefined {
  const value = get_plain_text(props[name]);
  return value ? isUri(value) : undefined;
}

function is_rsvp(item: MicroformatRoot): boolean {
  const rsvp = item.properties.rsvp;
  return (
    rsvp &&
    (_.includes(rsvp, 'yes') ||
      _.includes(rsvp, 'no') ||
      _.includes(rsvp, 'maybe') ||
      _.includes(rsvp, 'interested'))
  );
}

/**
 * Implementation of the post-type discovery algorithm
 * defined here https://indiewebcamp.com/post-type-discovery#Algorithm
 *
 * @param hentry mf2 item representing the entry to test
 * @return one of: 'event', 'rsvp',
 * 'reply', 'repost', 'like', 'photo','article', 'note', 'follow'
 *
 * TODO add invite, follow-of
 */
export function post_type_discovery(item: MicroformatRoot): string {
  if (_.includes(item.type, 'h-event')) {
    return 'event';
  }

  if (is_rsvp(item)) {
    return 'rsvp';
  }

  const props = item.properties;
  const propNames = Object.keys(props);

  const impliedTypes = [
    ['repost-of', 'repost'],
    ['like-of', 'like'],
    ['bookmark-of', 'bookmark'],
    ['in-reply-to', 'reply'],
    ['video', 'video'],
    ['photo', 'photo'],
  ];

  for (const it of impliedTypes) {
    if (_.includes(propNames, it[0]) && is_prop_uri(props, it[0])) {
      return it[1];
    }
  }

  const name = get_plain_text(props.name);
  const content = get_plain_text(props.content) || get_plain_text(props.summary);

  if (content && name && is_name_a_title(name, content)) {
    return 'article';
  }

  return 'note';
}

/**
 * Implementation of the response-type discovery algorithm
 * defined here https://www.w3.org/TR/post-type-discovery/
 *
 * @param mf2 item representing the entry to test
 * @return one of: 'rsvp','reply', 'repost', 'like', 'mention'
 */
export function response_type_discovery(item: MicroformatRoot): string {
  if (is_rsvp(item)) {
    return 'rsvp';
  }

  const props = item.properties;
  const propNames = Object.keys(props);

  const impliedTypes = [
    ['repost-of', 'repost'],
    ['like-of', 'like'],
    ['bookmark-of', 'bookmark'],
    ['in-reply-to', 'reply'],
  ];

  for (const it of impliedTypes) {
    if (_.includes(propNames, it[0]) && is_prop_uri(props, it[0])) {
      return it[1];
    }
  }

  return 'mention';
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
async function interpret(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null = null,
  hentry: MicroformatRoot | null = null,
  use_rel_syndication = true,
  fetch_mf2_func: ParsedDocumentFetchFn | null = parse_mf2
): Promise<SimplifiedEvent | SimplifiedEntry | SimplifiedCite | null> {
  hentry = hentry || find_first_entry(parsed, ['h-entry', 'h-event', 'h-cite']);
  if (hentry) {
    const types = hentry.type || [];
    if (_.includes(types, 'h-event')) {
      return interpret_event(
        parsed,
        source_url,
        base_href,
        hentry,
        use_rel_syndication,
        fetch_mf2_func
      );
    } else if (_.includes(types, 'h-entry')) {
      return interpret_entry(
        parsed,
        source_url,
        base_href,
        hentry,
        use_rel_syndication,
        fetch_mf2_func
      );
    } else if (_.includes(types, 'h-cite')) {
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

export async function interpret_common_properties(
  parsed: ParsedDocument,
  source_url: string,
  base_href: string | null,
  hentry: MicroformatRoot,
  use_rel_syndication: boolean,
  fetch_mf2_func: ParsedDocumentFetchFn | null
): Promise<PartialPost> {
  const result: PartialPost = {};
  const props = hentry.properties;

  for (const prop of ['url', 'uid', 'photo', 'featured']) {
    const value = get_plain_text(props[prop]);
    if (value) {
      result[prop] = value;
    }
  }
  for (const prop of ['start', 'end', 'published', 'updated', 'deleted']) {
    const date_str = get_plain_text(props[prop]);
    if (date_str) {
      result[prop + '-str'] = date_str;
      try {
        result[prop] = normalize_dt(date_str);
      } catch (e) {
        result[prop] = null;
      }
    }
  }
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
  const result: SimplifiedEvent = (await interpret_common_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  )) as SimplifiedEvent;
  result.type = 'event';
  const name_val = get_plain_text(hentry.properties.name);
  if (name_val) {
    result.name = name_val;
  }
  return result;
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
  const result: SimplifiedEntry = (await interpret_common_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  )) as SimplifiedEntry;
  result.type = 'entry';
  const title = get_plain_text(hentry.properties.name);
  if (title && is_name_a_title(title, result['content-plain'])) {
    result.name = title;
  }
  for (const prop of ['in-reply-to', 'like-of', 'repost-of', 'bookmark-of']) {
    for (const url_val of hentry.properties[prop] || []) {
      result[prop] = result[prop] || [];
      if (is_microformat_root(url_val)) {
        result[prop].push(
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
        result[prop].push({ url: url_val });
      }
    }
  }
  return result;
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
  const result: SimplifiedCite = (await interpret_common_properties(
    parsed,
    source_url,
    base_href,
    hentry,
    use_rel_syndication,
    fetch_mf2_func
  )) as SimplifiedCite;
  result.type = 'cite';
  const title = get_plain_text(hentry.properties.name);
  if (title && is_name_a_title(title, result['content-plain'])) {
    result.name = title;
  }
  return result;
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

  let children;
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
