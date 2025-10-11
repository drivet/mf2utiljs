import { includes } from 'lodash';
import { isUri } from 'valid-url';

import { MicroformatProperties, MicroformatRoot } from './types/microformat-parser';
import { get_plain_text, is_name_a_title } from './utils';

function is_prop_uri(props: MicroformatProperties, name: string): string | undefined {
  const value = get_plain_text(props[name]);
  return value ? isUri(value) : undefined;
}

function is_rsvp(item: MicroformatRoot): boolean {
  const rsvp = item.properties.rsvp;
  return (
    rsvp &&
    (includes(rsvp, 'yes') ||
      includes(rsvp, 'no') ||
      includes(rsvp, 'maybe') ||
      includes(rsvp, 'interested'))
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
  if (includes(item.type, 'h-event')) {
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
    if (includes(propNames, it[0]) && is_prop_uri(props, it[0])) {
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
    if (includes(propNames, it[0]) && is_prop_uri(props, it[0])) {
      return it[1];
    }
  }

  return 'mention';
}
