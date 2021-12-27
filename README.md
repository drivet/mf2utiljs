# mf2utilsjs

This is a rough, incomplete Typescript port of [Kyle Mahan's][1] [mf2util][2] library, mostly so that I'd have something to use in my new [eleventy][3] powered blog.

Given that I've switched over to using [webmention.io][4] for my webmention support, I've skipped porting the webmention part of the library.

Although it may seem so superficially, this library isn't meant to to convert an mf2 parsed result into a jf2 result.  The latter is meant to be an alternative, but simplified representation of an mf2 parsed result, but that's not what this library provides.

This library imposes a kind of domain level interpretation on mf2 results so that you can use the results more easily in, for example, a reply context or so that you can better render a webmention.

For example, one function, interpret, will try and interpret a URL as a permalink with a single post in it that is either a h-emtry or a h-event.  There is, of course, no requirement that URLs contain single posts or that, if they do, that they must be 



[1]: https://github.com/kylewm
[2]: https://github.com/kylewm/mf2util
[3]: https://github.com/11ty/eleventy
[4]: https://webmention.io/