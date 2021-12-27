import { MicroformatRoot, ParsedDocument } from 'microformats-parser/dist/types';

import {
  convert_relative_paths_to_absolute,
  find_all_entries,
  find_author,
  find_first_entry,
  post_type_discovery,
  representative_hcard,
} from './mf2';

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

describe('representive h-card tests', () => {
  it('should not find a representive h-card (no url in properties)', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-card'],
                properties: {
                  // uid is not enough, need url too
                  uid: ['some_url'],
                },
              },
            ],
          },
        },
        {
          type: ['h-card'],
          properties: {},
        },
      ],
    };
    const card = representative_hcard(doc, 'some_url');
    expect(card).toBeNull();
  });

  it('should not find a representive h-card (ambiguous h-card)', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-card'],
                properties: {
                  // not good enough, because there another h-card in the doc making this ambiguous.
                  url: ['some_url'],
                },
              },
            ],
          },
        },
        {
          type: ['h-card'],
          properties: {
            url: ['some_url'],
          },
        },
      ],
    };
    const card = representative_hcard(doc, 'some_url');
    expect(card).toBeNull();
  });

  it('should find a representive h-card (uid, url match)', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-card'],
                properties: {
                  uid: ['some_url'],
                  url: ['some_url'],
                },
              },
            ],
          },
        },
        {
          type: ['h-card'],
          properties: {},
        },
      ],
    };
    const card = representative_hcard(doc, 'some_url');
    if (!card) {
      throw new Error('missing card');
    }
    expect(card.type).toEqual(['h-card']);
    expect(card.properties.uid).toEqual(['some_url']);
    expect(card.properties.url).toEqual(['some_url']);
  });

  it('should find a representive h-card (rel=me)', () => {
    const doc: ParsedDocument = {
      rels: {
        me: ['another_url', 'some_url'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-card'],
                properties: {
                  url: ['stupid_url', 'some_url'],
                },
              },
            ],
          },
        },
        {
          type: ['h-card'],
          properties: {},
        },
      ],
    };
    const card = representative_hcard(doc, 'some_url');
    if (!card) {
      throw new Error('missing card');
    }
    expect(card.type).toEqual(['h-card']);
    expect(card.properties.url).toEqual(['stupid_url', 'some_url']);
  });

  it('should find a representive h-card (one matching url)', () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            prop1: [
              {
                type: ['h-card'],
                properties: {
                  url: ['some_url'],
                },
              },
            ],
          },
        },
        {
          type: ['h-card'],
          properties: {
            url: ['another_url'],
          },
        },
      ],
    };
    const card = representative_hcard(doc, 'some_url');
    if (!card) {
      throw new Error('missing card');
    }
    expect(card.type).toEqual(['h-card']);
    expect(card.properties.url).toEqual(['some_url']);
  });
});

describe('post type discovery tests', () => {
  it('should discover an event', () => {
    const item: MicroformatRoot = {
      type: ['h-event'],
      properties: {},
    };
    expect(post_type_discovery(item)).toBe('event');
  });

  it('should discover an rvsp (yes)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        rsvp: ['yes'],
      },
    };
    expect(post_type_discovery(item)).toBe('rsvp');
  });

  it('should discover an rvsp (no)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        rsvp: ['no'],
      },
    };
    expect(post_type_discovery(item)).toBe('rsvp');
  });

  it('should discover an rvsp (maybe)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        rsvp: ['maybe'],
      },
    };
    expect(post_type_discovery(item)).toBe('rsvp');
  });

  it('should discover an rvsp (interested)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        rsvp: ['interested'],
      },
    };
    expect(post_type_discovery(item)).toBe('rsvp');
  });

  it('should not discover an rvsp (bad rsvp status)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        rsvp: ['on-the-fence'],
      },
    };
    expect(post_type_discovery(item)).not.toBe('rsvp');
  });

  it('should discover a repost', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        'repost-of': ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('repost');
  });

  it('should discover a like', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        'like-of': ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('like');
  });

  it('should discover a bookmark', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        'bookmark-of': ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('bookmark');
  });

  it('should discover a reply', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        'in-reply-to': ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('reply');
  });

  it('should discover a video', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        video: ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('video');
  });

  it('should discover a photo', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        photo: ['http://hello.org'],
      },
    };
    expect(post_type_discovery(item)).toBe('photo');
  });

  it('should discover an article', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        name: ['this is the title'],
        content: ['this is an awesome artile'],
      },
    };
    expect(post_type_discovery(item)).toBe('article');
  });

  it('should discover a note (no title)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        content: ['this is an awesome note'],
      },
    };
    expect(post_type_discovery(item)).toBe('note');
  });

  it('should discover a note (title = content)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        name: ['this is an awesome note'],
        content: ['this is an awesome note'],
      },
    };
    expect(post_type_discovery(item)).toBe('note');
  });

  it('should discover a note (title ~= content)', () => {
    const item: MicroformatRoot = {
      type: ['h-entry'],
      properties: {
        name: ['this is an awesome, note'],
        content: ['this, is  an awesome note!'],
      },
    };
    expect(post_type_discovery(item)).toBe('note');
  });
});

describe('authorship tests (no fetching)', () => {
  it('should find an author card property', async () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            author: [
              {
                type: ['h-card'],
                properties: {
                  name: ['Desmond'],
                  photo: ['https://photo_url'],
                  url: ['https://some_url'],
                },
              },
            ],
          },
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.name).toBe('Desmond');
    expect(author.photo).toBe('https://photo_url');
    expect(author.url).toBe('https://some_url');
  });

  it('should find an author url property', async () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            author: [
              {
                type: ['h-card'],
                properties: {
                  url: ['https://some_url'],
                },
              },
            ],
          },
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.url).toBe('https://some_url');
  });

  it('should handle scalar author urls', async () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            author: ['https://some_url'],
          },
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.url).toBe('https://some_url');
  });

  it('should handle scalar author names', async () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {
            author: ['Desmond'],
          },
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.name).toBe('Desmond');
  });

  it('should find the feed author', async () => {
    const doc: ParsedDocument = {
      rels: {},
      'rel-urls': {},
      items: [
        {
          type: ['h-feed'],
          properties: {
            author: [
              {
                type: ['h-card'],
                properties: {
                  name: ['Desmond'],
                  photo: ['https://photo_url'],
                  url: ['https://some_url'],
                },
              },
            ],
          },
          children: [
            {
              type: ['h-entry'],
              properties: {},
            },
          ],
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.name).toBe('Desmond');
    expect(author.photo).toBe('https://photo_url');
    expect(author.url).toBe('https://some_url');
  });

  it('should find author page in the rels', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };
    const author = await find_author(doc);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.url).toBe('https://author_page');
  });

  it('should not fund author', async () => {
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
    const author = await find_author(doc);
    expect(author).toBeFalsy();
  });
});

describe('authorship tests (fetching author page)', () => {
  it('should use the first representive card on an author page', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };

    async function fetchmf2(url: string): Promise<ParsedDocument> {
      if (url !== 'https://author_page') {
        throw new Error('should be using https://author_page');
      }
      return {
        rels: {},
        'rel-urls': {},
        items: [
          {
            type: ['h-card'],
            properties: {
              url: ['https://author_page'],
              uid: ['https://author_page'],
              name: ['Desmond'],
              photo: ['https://photo_url'],
            },
          },
        ],
      } as ParsedDocument;
    }

    const author = await find_author(doc, null, fetchmf2);
    if (!author) {
      throw new Error('should have author');
    }
    expect(author.url).toBe('https://author_page');
    expect(author.name).toBe('Desmond');
    expect(author.photo).toBe('https://photo_url');
  });

  it('should use the first card with url matching rel me', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };

    async function fetchmf2(url: string): Promise<ParsedDocument> {
      if (url !== 'https://author_page') {
        throw new Error('should be using https://author_page');
      }
      return {
        rels: {
          me: ['https://some_url'],
        },
        'rel-urls': {},
        items: [
          {
            type: ['h-card'],
            properties: {
              url: ['https://some_url'],
              name: ['Desmond'],
              photo: ['https://photo_url'],
            },
          },
        ],
      } as ParsedDocument;
    }

    const author = await find_author(doc, null, fetchmf2);
    if (!author) {
      throw new Error('should have author');
    }
    expect(author.url).toBe('https://some_url');
    expect(author.name).toBe('Desmond');
    expect(author.photo).toBe('https://photo_url');
  });

  it('should use the first card with url matching author page', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };

    async function fetchmf2(url: string): Promise<ParsedDocument> {
      if (url !== 'https://author_page') {
        throw new Error('should be using https://author_page');
      }
      return {
        rels: {},
        'rel-urls': {},
        items: [
          {
            type: ['h-card'],
            properties: {
              url: ['https://author_page'],
              name: ['Desmond'],
              photo: ['https://photo_url'],
            },
          },
        ],
      } as ParsedDocument;
    }

    const author = await find_author(doc, null, fetchmf2);
    if (!author) {
      throw new Error('should have author');
    }
    expect(author.url).toBe('https://author_page');
    expect(author.name).toBe('Desmond');
    expect(author.photo).toBe('https://photo_url');
  });

  it('should not find an author', async () => {
    const doc: ParsedDocument = {
      rels: {
        author: ['https://author_page'],
      },
      'rel-urls': {},
      items: [
        {
          type: ['h-entry'],
          properties: {},
        },
      ],
    };

    async function fetchmf2(url: string): Promise<ParsedDocument> {
      if (url !== 'https://author_page') {
        throw new Error('should be using https://author_page');
      }
      return {
        rels: {},
        'rel-urls': {},
        items: [
          {
            type: ['h-card'],
            properties: {
              name: ['Desmond'],
              photo: ['https://photo_url'],
            },
          },
        ],
      } as ParsedDocument;
    }

    const author = await find_author(doc, null, fetchmf2);
    expect(author).toBeFalsy();
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
