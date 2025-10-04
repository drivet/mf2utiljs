import { normalize_dt } from '.';
import {
  convert_relative_paths_to_absolute,
  interpret_cite,
  interpret_properties,
  interpret_entry,
  interpret_event,
  interpret_feed,
} from './mf2';
import { ParsedDocument } from './types/microformat-parser';
import { find_first_entry, find_all_entries } from './utils';

describe('find entry tests', () => {
  it('should return nothing when entry cannot be found', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {},
        },
      ],
    };
    const entry = find_first_entry(doc, ['h-card']);
    expect(entry).toBeFalsy();
  });

  it('should find entry in a list of one', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };
    const entry = find_first_entry(doc, ['h-entry']);
    expect(entry.type).toEqual(['h-entry']);
  });

  it('should find entry in a list of several', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {},
        },
        {
          type: ['h-entry'],
          properties: {},
        },
        {
          type: ['h-feed'],
          properties: {},
        },
      ],
    };
    const entry = find_first_entry(doc, ['h-entry']);
    expect(entry.type).toEqual(['h-entry']);
  });

  it('should find entry when passing several', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {},
        },
        {
          type: ['h-entry'],
          properties: {},
        },
        {
          type: ['h-feed'],
          properties: {},
        },
      ],
    };
    const entry1 = find_first_entry(doc, ['h-entry', 'h-feed']);
    expect(entry1.type).toEqual(['h-entry']);

    const entry2 = find_first_entry(doc, ['h-entry', 'h-event']);
    expect(entry2.type).toEqual(['h-event']);
  });

  it('should find entry among children', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {},
          children: [
            {
              type: ['h-event'],
              properties: {},
            },
          ],
        },
        {
          type: ['h-entry'],
          properties: {},
          children: [
            {
              type: ['h-card'],
              properties: {},
            },
          ],
        },
      ],
    };
    const entry1 = find_first_entry(doc, ['h-card']);
    expect(entry1.type).toEqual(['h-card']);
  });

  it('should find all entries', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {},
          children: [
            {
              type: ['h-event'],
              properties: {},
            },
          ],
        },
        {
          type: ['h-entry'],
          properties: {},
          children: [
            {
              type: ['h-card'],
              properties: {},
            },
          ],
        },
      ],
    };
    const entries = find_all_entries(doc, ['h-feed', 'h-card']);
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.type)).toEqual([['h-feed'], ['h-card']]);
  });

  it('should not include properties when not specified', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-event'],
                properties: {},
              },
            ],
          },
        },
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };
    const entries = find_all_entries(doc, ['h-event', 'h-entry']);
    expect(entries.length).toBe(1);
    expect(entries.map((e) => e.type)).toEqual([['h-entry']]);
  });

  it('should include properties when specified', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-event'],
                properties: {},
              },
            ],
          },
        },
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };
    const entries = find_all_entries(doc, ['h-event', 'h-entry'], true);
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.type)).toEqual([['h-entry'], ['h-event']]);
  });
});

describe('URL conversion tests', () => {
  it('should convert an anchor', async () => {
    const html = `this is a title
hello there.

<a href="greetings.html">stuff</a>

another hello

<a href="blah.html">stuff</a>`;

    const converted = convert_relative_paths_to_absolute('https://site.com', null, html);
    expect(converted).toBe(`this is a title
hello there.

<a href="https://site.com/greetings.html">stuff</a>

another hello

<a href="https://site.com/blah.html">stuff</a>`);
  });
});

describe('interpret common properties', () => {
  it('should extract some common fields', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        start: ['2022-01-15T13:00:00Z'],
        end: ['2022-01-15T14:00:00Z'],
        published: ['2022-01-14T13:00:00Z'],
        updated: ['2022-01-14T14:00:00Z'],
        deleted: ['2022-01-17T14:00:00Z'],
        url: ['https:/event.org/url'],
        uid: ['https:/event.org/uid'],
        photo: ['https:/event.org/photo'],
        featured: ['https:/event.org/featured'],
        summary: ['this is a summary'],
        syndication: ['twitter', 'facebook'],
        author: [
          {
            type: ['h-card'],
            properties: {
              name: ['Desmond Rivet'],
            },
          },
        ],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
        syndication: ['instagram'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      false,
      null
    );
    expect(partial?.url).toBe('https:/event.org/url');
    expect(partial?.uid).toBe('https:/event.org/uid');
    expect(partial?.photo).toBe('https:/event.org/photo');
    expect(partial?.featured).toBe('https:/event.org/featured');
    expect(partial?.summary).toBe('this is a summary');
    expect(partial?.start).toBe('2022-01-15T13:00:00Z');
    expect(partial?.end).toBe('2022-01-15T14:00:00Z');
    expect(partial?.published).toBe('2022-01-14T13:00:00Z');
    expect(partial?.updated).toBe('2022-01-14T14:00:00Z');
    expect(partial?.deleted).toBe('2022-01-17T14:00:00Z');
    expect(partial?.syndication).toEqual(['twitter', 'facebook']);
    expect(partial?.author).toEqual({
      name: 'Desmond Rivet',
    });
  });

  it('should use summary value if HTML', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        summary: [{ html: '<p>this is a summary</p>', value: 'this is a summary (text)' }],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      false,
      null
    );

    expect(partial?.summary).toBe('this is a summary (text)');
  });

  it('should produce no content', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        content: [],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      false,
      null
    );

    if (!partial) {
      throw new Error('partial should be defined');
    }
    expect(partial.content).toBeUndefined;
    expect(partial['content-plain']).toBeUndefined;
  });

  it('should produce HTML content', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        content: [
          {
            html: '<p>hello</p> ',
            value: ' hello in text',
          },
        ],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      false,
      null
    );

    if (!partial) {
      throw new Error('partial should be defined');
    }
    expect(partial.content).toBe('<p>hello</p>');
    expect(partial['content-plain']).toBe('hello in text');
  });

  it('should produce text content', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        content: [' hello in text'],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      false,
      null
    );

    if (!partial) {
      throw new Error('partial should be defined');
    }
    // no trimming for some reason
    expect(partial.content).toBe(' hello in text');
    expect(partial['content-plain']).toBe(' hello in text');
  });

  it('should use rel sundication', async () => {
    const hevent = {
      type: ['h-event'],
      properties: {
        content: [' hello in text'],
        syndication: ['twitter'],
      },
    };

    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
        syndication: ['instagram', 'twitter'],
      },
      'rel-urls': {},
      items: [hevent],
    };

    const partial = await interpret_properties(
      doc,
      'https://source.url',
      null,
      hevent,
      true,
      null
    );

    expect(partial.syndication).toEqual(['instagram', 'twitter']);
  });
});

describe('interpret events tests', () => {
  it('should produce a simplified event', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {
            name: ['Event of a Lifetime'],
            start: ['2022-01-15T13:00:00Z'],
            end: ['2022-01-15T14:00:00Z'],
            url: ['https:/event.org/stuff'],
            summary: ['this is a summary'],
          },
        },
      ],
    };
    const event = await interpret_event(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('event');
    expect(event?.name).toBe('Event of a Lifetime');
    expect(event?.url).toBe('https:/event.org/stuff');
    expect(event?.summary).toBe('this is a summary');
    expect(event?.start).toBe('2022-01-15T13:00:00Z');
    expect(event?.end).toBe('2022-01-15T14:00:00Z');
  });

  it('should produce a simplified event without a name', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {
            start: ['2022-01-15T13:00:00Z'],
            end: ['2022-01-15T14:00:00Z'],
            url: ['https:/event.org/stuff'],
            summary: ['this is a summary'],
          },
        },
      ],
    };
    const event = await interpret_event(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('event');
    expect(event?.name).toBeUndefined();
    expect(event?.url).toBe('https:/event.org/stuff');
    expect(event?.summary).toBe('this is a summary');
    expect(event?.start).toBe('2022-01-15T13:00:00Z');
    expect(event?.end).toBe('2022-01-15T14:00:00Z');
  });
});

describe('interpret cite tests', () => {
  it('should produce a simplified cite', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-cite'],
          properties: {
            name: ['Event of a Lifetime'],
            start: ['2022-01-15T13:00:00Z'],
            end: ['2022-01-15T14:00:00Z'],
            url: ['https:/event.org/stuff'],
            summary: ['this is a summary'],
          },
        },
      ],
    };
    const event = await interpret_cite(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('cite');
    expect(event?.name).toBe('Event of a Lifetime');
    expect(event?.url).toBe('https:/event.org/stuff');
  });

  it('should be missing a title', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-cite'],
          properties: {
            name: ['Event of a Lifetime'],
            content: ['Event of a Lifetime'],
          },
        },
      ],
    };
    const event = await interpret_cite(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('cite');
    expect(event?.name).toBeUndefined();
  });
});

describe('interpret entry tests', () => {
  it('should produce a simplified entry', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['Event of a Lifetime'],
            content: ['the content'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.name).toBe('Event of a Lifetime');
    expect(event?.content).toBe('the content');
  });

  it('should be missing a title', async () => {
    console.log('missing title test');
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['Event of a Lifetime'],
            content: ['Event of a Lifetime'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.name).toBeUndefined();
  });

  it('should handle in-reply-to URL', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'in-reply-to': ['https://example1.org', 'https://example2.org'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['in-reply-to']).toEqual([
      { url: 'https://example1.org' },
      { url: 'https://example2.org' },
    ]);
  });

  it('should handle like-of URL', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'like-of': ['https://example1.org', 'https://example2.org'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['like-of']).toEqual([
      { url: 'https://example1.org' },
      { url: 'https://example2.org' },
    ]);
  });

  it('should handle repost-of URL', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'repost-of': ['https://example1.org', 'https://example2.org'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['repost-of']).toEqual([
      { url: 'https://example1.org' },
      { url: 'https://example2.org' },
    ]);
  });

  it('should handle bookmark-of URL', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'bookmark-of': ['https://example1.org', 'https://example2.org'],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['bookmark-of']).toEqual([
      { url: 'https://example1.org' },
      { url: 'https://example2.org' },
    ]);
  });

  it('should handle in-reply-to entry', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'in-reply-to': [
              {
                type: ['h-entry'],
                properties: {
                  url: ['https://example1.org'],
                },
              },
            ],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['in-reply-to']).toEqual([
      { type: 'entry', author: { url: 'https://author_page' }, url: 'https://example1.org' },
    ]);
  });

  it('should handle like-of entry', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'like-of': [
              {
                type: ['h-entry'],
                properties: {
                  url: ['https://example1.org'],
                },
              },
            ],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['like-of']).toEqual([
      { type: 'entry', author: { url: 'https://author_page' }, url: 'https://example1.org' },
    ]);
  });

  it('should handle repost-of entry', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'repost-of': [
              {
                type: ['h-entry'],
                properties: {
                  url: ['https://example1.org'],
                },
              },
            ],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['repost-of']).toEqual([
      { type: 'entry', author: { url: 'https://author_page' }, url: 'https://example1.org' },
    ]);
  });

  it('should handle bookmark-of entry', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            name: ['A title'],
            content: ['Event of a Lifetime'],
            'bookmark-of': [
              {
                type: ['h-entry'],
                properties: {
                  url: ['https://example1.org'],
                },
              },
            ],
          },
        },
      ],
    };
    const event = await interpret_entry(doc, 'https://source.url', null, null, false, null);
    expect(event?.type).toBe('entry');
    expect(event?.['bookmark-of']).toEqual([
      { type: 'entry', author: { url: 'https://author_page' }, url: 'https://example1.org' },
    ]);
  });
});

describe('interpret feed tests', () => {
  it('should produce a simplified feed from children', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            name: ['this is a feed'],
          },
          children: [
            {
              type: ['h-event'],
              properties: {
                name: ['the event'],
              },
            },
            {
              type: ['h-entry'],
              properties: {
                name: ['the entry'],
              },
            },
          ],
        },
      ],
    };
    const feed = await interpret_feed(doc, 'https://source.url', null, null, false, null);
    expect(feed?.name).toBe('this is a feed');
    expect(feed?.entries?.length).toBe(2);
    expect(feed?.entries?.[0].type).toBe('event');
    expect(feed?.entries?.[0].name).toBe('the event');
    expect(feed?.entries?.[1].type).toBe('entry');
    expect(feed?.entries?.[1].name).toBe('the entry');
  });

  it('should produce a top level collection', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-event'],
          properties: {
            name: ['the event'],
          },
        },
        {
          type: ['h-entry'],
          properties: {
            name: ['the entry'],
          },
        },
      ],
    };
    const feed = await interpret_feed(doc, 'https://source.url', null, null, false, null);
    expect(feed?.entries?.length).toBe(2);
    expect(feed?.entries?.[0].type).toBe('event');
    expect(feed?.entries?.[0].name).toBe('the event');
    expect(feed?.entries?.[1].type).toBe('entry');
    expect(feed?.entries?.[1].name).toBe('the entry');
  });
});

describe('datetime tests', () => {
  it('should normalize standard dates', () => {
    expect(normalize_dt('2021-03-02T13:45:00+04:00')).toBe('2021-03-02T13:45:00+04:00');
    expect(normalize_dt('2021-3-2T13:45:00+04:00')).toBe('2021-03-02T13:45:00+04:00');
  });

  it('should normalize friendlier dates', () => {
    expect(normalize_dt('2021-03-02 13:45:00 +04:00')).toBe('2021-03-02T13:45:00+04:00');
    expect(normalize_dt('2021-08-01 13:42:17 +0100')).toBe('2021-08-01T13:42:17+01:00');
    expect(normalize_dt('2021-08-01 13:42:17 +0100 BST')).toBe('2021-08-01T13:42:17+01:00');
  });

  it('should normalize dates', () => {
    expect(normalize_dt('2021-03-02')).toBe('2021-03-02');
    expect(normalize_dt('2021-3-2')).toBe('2021-03-02');
  });
});
