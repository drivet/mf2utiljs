import { post_type_discovery } from './post-type';
import { MicroformatRoot } from './types/microformat-parser';

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
