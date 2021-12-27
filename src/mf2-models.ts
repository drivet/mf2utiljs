import { ParsedDocument } from 'microformats-parser/dist/types';

export type PostType = 'h-entry' | 'h-event' | 'h-cite' | 'h-feed' | 'h-card';

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

export interface PartialPost {
  url?: string;
  uid?: string;
  author?: AuthorInfo;
  photo?: string;
  featured?: string;
  start?: string;
  end?: string;
  published?: string;
  updated?: string;
  deleted?: string;
  content?: string;
  'content-plain'?: string;
  summary?: string;
  syndication?: string[];
}

export interface SimplifiedEvent {
  type: 'event';
  name?: string;
  summary?: string;
  start?: string;
  end?: string;
  url?: string;
}

export interface SimplifiedEntry {
  type: 'entry' | 'cite';
  name?: string;
  url?: string;
  uid?: string;
  author?: AuthorInfo;
  content?: string;
  'content-plain'?: string;
  summary?: string;
  syndication?: string[];
  photo?: string;
  featured?: string;
  logo?: string;
  published?: string;
  updated?: string;
  deleted?: string;
  'in-reply-to'?: SimplifiedPost[];
  'like-of'?: SimplifiedPost[];
  'repost-of'?: SimplifiedPost[];
  'bookmark-of'?: SimplifiedPost[];
}

export interface SimplifiedCite {
  type: 'cite';
  name?: string;
  author?: AuthorInfo;
  url?: string;
  uid?: string;
  content?: string;
  'content-plain'?: string;
}

export type SimplifiedPost = SimplifiedEvent | SimplifiedEntry | SimplifiedCite;

export interface SimplifiedFeed {
  name?: string;
  entries?: SimplifiedPost[];
}
