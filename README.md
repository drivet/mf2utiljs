# mf2utilsjs

This is a rough, incomplete Typescript port of [Kara Mahan's][1]
[mf2util][2] python library, mostly so that I'd have something to use in my
new [eleventy][3] powered blog.  It imposes a kind of domain level
interpretation on mf2 results so that you can use the results more easily
in, for example, a reply context or a link preview.

Given that I've switched over to using [webmention.io][4] for my webmention
support, I've skipped porting the webmention part of the library.  I also
have yet to port over the location processing.

Microformats are a flexible way to sprinkle meta information in a web page,
and there are several microformat parsers available, but the parsing results
are often not very convenient to use.  This library will, like mf2utils,
take the mf2 results and:

 * Extract the first string of every property when it's appropriate, which
   it is most of the time.
 * Implement the [authorship algorithm][5] to figure out who wrote the post.

[1]: https://github.com/karadaisy
[2]: https://github.com/karadaisy/mf2util
[3]: https://github.com/11ty/eleventy
[4]: https://webmention.io/
[5]: https://indieweb.org/authorship-spec
