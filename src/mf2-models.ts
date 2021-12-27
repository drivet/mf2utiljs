import { ParsedDocument } from 'microformats-parser/dist/types';

export type PostType = 'h-entry' | 'h-event' | 'h-feed' | 'h-card';

export interface ObjectWithStringValue {
  value: string;
}

export type PlainText = string | ObjectWithStringValue;

export interface AuthorInfo {
  name?: string;
  photo?: string;
  url?: string;
}

export type ParsedDocumentFetchFn = (url: string) => Promise<ParsedDocument>;

export interface SimplifiedCommon {
  url?: string;
  uid?: string;
  photo?: string;
  featured?: string;
  logo?: string;
  start?: string;
  end?: string;
  published?: string;
  updated?: string;
  deleted?: string;
  author?: AuthorInfo;
  content?: string;
  'content-plain'?: string;
  summary?: string;
  syndication?: string[];
}

export interface SimplifiedEvent extends SimplifiedCommon {
  type: 'event';
  name?: string;
}

export type SimplifiedBoth = SimplifiedEvent | SimplifiedEntry;
export interface SimplifiedEntry extends SimplifiedCommon {
  type: 'entry' | 'cite';
  name?: string;
  'in-reply-to'?: SimplifiedBoth[];
  'like-of'?: SimplifiedBoth[];
  'repost-of'?: SimplifiedBoth[];
  'bookmark-of'?: SimplifiedBoth[];
  comment?: SimplifiedBoth[];
  like?: SimplifiedBoth[];
  repost?: SimplifiedBoth[];
}

export interface SimplifiedFeed {
  name?: string;
  entries?: SimplifiedBoth[];
}
