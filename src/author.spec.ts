import { find_author, representative_hcard } from './author';
import { ParsedDocument } from './types/microformat-parser';

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
    const author = await find_author(doc, null, null);
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
    const author = await find_author(doc, null, null);
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
    const author = await find_author(doc, null, null);
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
    const author = await find_author(doc, null, null);
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
    const author = await find_author(doc, null, null);
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
    const author = await find_author(doc, null, null);
    if (!author) {
      throw new Error('unexpected null author');
    }
    expect(author.url).toBe('https://author_page');
  });

  it('should not find author', async () => {
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
    const author = await find_author(doc, null, null);
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
