import { cloneDeep } from 'lodash';

import { classify_comment } from './mf2';

describe('interpret comment tests', () => {
  const doc: any = {
    items: [
      {
        properties: {
          name: ['Author'],
          photo: ['http://example.com/author_img.jpg'],
          url: ['http://example.com'],
        },
        type: ['h-card'],
        value: 'Author LastName',
      },
      {
        properties: {
          content: [
            {
              html: 'some content',
              value: 'some content',
            },
          ],
          name: ['some title'],
          published: ['2014-05-07T17:15:44+00:00'],
          url: ['http://example.com/reply/2014/05/07/1'],
        },
        type: ['h-entry'],
      },
    ],
    rels: {},
    'rel-urls': {},
  };

  it('no reference', async () => {
    const blob = cloneDeep(doc);
    expect(classify_comment(blob, ['http://example.com'])).toEqual([]);

    // add some irrelevant references
    blob.items[1]['in-reply-to'] = [
      'http://werd.io/2014/homebrew-website-club-4',
      'https://www.facebook.com/events/1430990723825351/',
    ];
    expect(classify_comment(blob, ['http://example.com'])).toEqual([]);

    // no target url
    expect(classify_comment(blob, [])).toEqual([]);
  });

  it('rsvps', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'in-reply-to': ['http://mydomain.com/my-post'],
      rsvp: ['yes'],
    };
    expect(
      classify_comment(blob, ['http://mydoma.in/short', 'http://mydomain.com/my-post']),
    ).toEqual(['reply', 'rsvp']);
  });

  it('invites', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'in-reply-to': ['http://mydomain.com/my-post'],
      invitee: [
        {
          name: 'Kyle Mahan',
          url: 'https://kylewm.com',
        },
      ],
    };
    expect(
      classify_comment(blob, ['http://mydoma.in/short', 'http://mydomain.com/my-post']),
    ).toEqual(['reply', 'invite']);
  });

  it('likes', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'in-reply-to': ['http://someoneelse.com/post'],
      'like-of': ['http://mydomain.com/my-post'],
    };
    expect(
      classify_comment(blob, ['http://mydoma.in/short', 'http://mydomain.com/my-post']),
    ).toEqual(['like']);
  });

  it('reposts', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'repost-of': ['http://mydomain.com/my-post'],
      'like-of': ['http://someoneelse.com/post'],
    };
    expect(
      classify_comment(blob, ['http://mydoma.in/short', 'http://mydomain.com/my-post']),
    ).toEqual(['repost']);
  });

  it('multi reply', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'in-reply-to': [
        'http://someoneelse.com/post',
        'http://mydomain.com/my-post',
        'http://athirddomain.org/permalink',
      ],
    };
    expect(classify_comment(blob, ['http://mydomain.com/my-post'])).toEqual(['reply']);
  });

  it('multi modal', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'reply-to': ['http://noone.im/'],
      'repost-of': ['http://someoneelse.com', 'http://mydomain.com/my-post'],
      like: ['http://mydoma.in/short', 'http://someoneelse.com/post'],
    };
    const ct = classify_comment(blob, ['http://mydoma.in/short', 'http://mydomain.com/my-post']);
    ct.sort((s1, s2) => s1.localeCompare(s2));
    expect(ct).toEqual(['like', 'repost']);
  });

  it('h cite', async () => {
    const blob = cloneDeep(doc);
    blob.items[1].properties = {
      ...blob.items[1].properties,
      'in-reply-to': [
        {
          type: 'h-cite',
          properties: {
            url: ['http://mydomain.com/my-post'],
          },
        },
      ],
    };
    expect(classify_comment(blob, ['http://mydomain.com/my-post'])).toEqual(['reply']);
  });
});
