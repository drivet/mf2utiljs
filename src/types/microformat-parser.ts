// Copied this from the microformat-parser package and exported everything

export interface ParsedDocument {
    rels: Rels;
    "rel-urls": RelUrls;
    items: MicroformatRoot[];
}
export type MicroformatProperties = Record<string, MicroformatProperty[]>;
export interface MicroformatRoot {
    id?: string;
    lang?: string;
    type?: string[];
    properties: MicroformatProperties;
    children?: MicroformatRoot[];
    value?: MicroformatProperty;
}
export interface Image {
    alt: string;
    value?: string;
}
export interface Html {
    html: string;
    value: string;
    lang?: string;
}
export type MicroformatProperty = MicroformatRoot | Image | Html | string;
export type Rels = Record<string, string[]>;
export type RelUrls = Record<string, {
    rels: string[];
    text: string;
    title?: string;
    media?: string;
    hreflang?: string;
    type?: string;
}>;
