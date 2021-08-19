# 😚 kiss: keep it simple and static site generator

**Low-tech static site generator**

<p>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="kiss is released under the MIT license." />
  <a href="https://www.npmjs.com/package/@slybridges/kiss">
    <img src="https://img.shields.io/npm/v/@slybridges/kiss" alt="kiss current version on npm" />
  </a>
</p>

## What kiss is

- **Low-tech**: VanillaJS, small codebase, little abstractions.
- **Minimal**: No framework, no code transpiler, little dependencies.
- **Batteries included**: Comes out of the box with everything you need to make an SEO friendly website
- **Developer friendly**: `kiss start` will watch your changes and reload the browser after every build so that you can iterate quickly.
- **Powerful**: Dynamic data computations, page data cascade and derived content generation.
- **Extensible**: Easily add support for more content types, dynamic computations, writers, post build commands via hooks, etc.

## How it works:

- Write your content in markdown, html, json, or javascript
- Organize your articles in folders the way you want your urls to look like (like in the good ole days!)
- Write your site design in [Nunjucks](https://mozilla.github.io/nunjucks/) and get access to the full site data while doing so
- Use top-down data cascade to enrich your content metadata as it is crawled
- Write small functions to compute dynamic data during data cascade (e.g. generate default title based on permalink or default cover image based on content)
- Create custom pages derived from the main data (e.g list of articles by tags or articles by author's)
- Pre-compute derived data views based (e.g. compute the list of categories and subcategories for generating the navigation bar)

kiss will automatically make your site SEO friendly by default:

- Optimize images and make them responsive
- Data cascade makes it trivial to generate meta and Open Graph tags
- Generate RSS feed
- Generate sitemap
- Generate a dump of your full site as JSON for debug or to implement actions via workers (like site search)

## DISCLAIMER

Concept is being tuned until reaching v1. Things might break. Use at your own risk.

## Requirements

Node 12 or above.

## Quick start

Use the `kiss-starter` boilerplate to get started in no time: https://github.com/slybridges/kiss-starter

## DYI install

```
npm install --save @slybridges/kiss
```

Then create a `kiss.config.js` to set your config.

## Default folder structure

Here is how your project directory would look like:

```
content/                          # this where your source content reside
├── blog/                         # create sub-folders as you see fit to match your site URL structure.
│   │                             # kiss automatically generates folder index pages listing all children
│   ├── my-first-blog-post/       # content piece that is a directory with post.md/.html file inside
│   │   ├── post.md               # generated permalink will be /blog/my-first-blog-post/ (you can override it if you want)
│   │   └── blog-post-cover.jpg   # pictures in content directory are copied as is
│   └── another-blog-post.md      # content piece that is a single file
└── index.js                      # index file data (.js/.md/.html) are merged with parent data and cascade to their children
public/                           # this is where generated static files will be written
theme/                            # this is where you create your site design
└── templates/                    # this is where your nunjucks template live
    ├── default.njk               # default nunjucks template
    ├── collection.njk            # template for collection (index) pages
    └── post.njk                  # template for post (article) pages
kiss.config.js                    # kiss config file
package.json
```

## Launch dev server

```
npx kiss start
```

Launches the build, watch for content or config changes and reload the browser after every build.

## Generate a production build

```
NODE_ENV=production npx kiss build
```

## Documentation

> Read the code, Luke.
>
> - Obi-Wan Kenobi, had he been the creator of kiss

kiss codebase is small and easy to navigate:

- start with `config/defaultConfig.js` to get an understanding of how you can configure your project.
- then, head over `build.js` `build()` method to understand the lifecycle of a build.
- finally, head over to `data/initialPageData.js` and scroll down to the bottom to read about the default page metadata and dynamic computations

Alternatively check out [kiss-starter](https://github.com/slybridges/kiss-starter) for a real life minimal example.
