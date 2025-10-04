import { ParsedDocument } from "./types/microformat-parser";

export type Mf2Type = 'h-entry' | 'h-event' | 'h-cite' | 'h-feed' | 'h-card';

export interface ObjectWithStringValue {
  value: string;
}

export interface AuthorInfo {
  name?: string;
  photo?: string;
  url?: string;
}

export type ParsedDocumentFetchFn = (url: string) => Promise<ParsedDocument>;

export interface EventProperties {
  name?: string;
  summary?: string;
  start?: string;
  end?: string;
  url?: string;
  content?: string;
}

export interface CiteProperties {
  name?: string;
  author?: AuthorInfo;
  published?: string;
  url?: string;
  uid?: string;
  content?: string;
  'content-plain'?: string;
}

export interface EntryProperties {
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

export type PostProperties = EventProperties & CiteProperties & EntryProperties;

export interface SimplifiedEvent extends EventProperties {
  type: 'event';
}

export interface SimplifiedCite extends CiteProperties {
  type: 'cite';
}

export interface SimplifiedEntry extends EntryProperties {
  type: 'entry';
}

export type SimplifiedPost = SimplifiedEvent | SimplifiedEntry | SimplifiedCite;

export interface SimplifiedFeed {
  name?: string;
  entries?: SimplifiedPost[];
}
