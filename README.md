# 😚 kiss: keep it simple and static site generator

**Minimal, low-tech-yet-powerful static site generator**

<p>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="kiss is released under the MIT license." />
  <a href="https://www.npmjs.com/package/@slybridges/kiss">
    <img src="https://img.shields.io/npm/v/@slybridges/kiss" alt="kiss current version on npm" />
  </a>
</p>

## kiss features

- write your content in markdown, html, json, or javascript
- organize your articles in folders the way you want your urls to look like (like in the good ole days!)
- use top-down data cascade to enrich your content metadata as it is crawled
- write small functions to compute dynamic data during data cascade (e.g. generate default title based on permalink or default cover image based on content)
- easily create custom pages derived from the main data (e.g list of articles by tags or articles by author's)
- write your site templates in [Nunjucks](https://mozilla.github.io/nunjucks/) and get access to the full site data while doing so
- pre-compute derived data based for easy templating (e.g. compute the list of categories and subcategories for generating the navigation bar)
- write your full site data as a JSON file (e.g. to make it simple if you want to add your own dynamic search using workers)
- little-to-no assumptions to how your content metadata should look like or what pages should be generated. Easily override any default during data cascade.

## What kiss is

- **Low-tech**: VanillaJS, small codebase, little abstractions, you should be able to read through it in an hour or so.
- **Minimal**: No framework, no code transpiler, little dependencies.
- **Developer friendly**: `kiss start` will watch your changes and reload the browser after every build so that you can iterate quickly.
- **Powerful**: Dynamic data computations, page data cascade and derived content generation
- **Extensible**: Easily add support for more content types, dynamic computations, writers, post build commands, etc.

## DISCLAIMER

kiss concepts are still being fine tuned. Things will break. Use at your own risk.

## Requirements

Node 12 or above. May work on node 10 too, but untested.

## Install

```
npm install --save @slybridges/kiss
```

## Get Started: folder structure

Here is how your project directory would look like:

```
content/                          # this where your source content reside
├── blog/                         # create subfolders as you see fit to match your site URL structure.
│   │                             # kiss automatically generates folder index pages listing all children
│   ├── my-first-blog-post/       # content piece that is a directory with post.md/.html file inside
│   │   ├── post.md               # generated permalink will be /blog/my-first-blog-post/ (you can override it if you want)
│   │   └── blog-post-cover.jpg   # pictures in content directory are copied as is
│   └── another-blog-post.md      # content piece that is a single file
└── index.js                      # index file data (.js/.md/.html) are merged with parent data and cascade to their children
public/                           # this is where generated static files will be written
theme/                            # this is where you create your site design
└── templates/                    # this is where your nunjucks template live
    ├── base.njk                  # default nunjucks template
    ├── collection.njk            # template for collection (index) pages
    └── base.njk                  # template for post (article) pages
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

kiss codebase is tiny and easy to navigate:

- start with `config/defaultConfig.js` to get an understanding of how you can configure your project.
- then, head over `build.js` `build()` method to understand the lifecycle of a build.
- finally, head over to `data/initialPageData.js` and scroll down to the bottom to read about the default page metadata and dynamic computations
