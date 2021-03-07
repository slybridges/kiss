# kiss: simple static site generator

**K**eep **I**t **S**imple and **S**tatic

- **Good defaults**: write content in HTML, Markdown or JS. Theme your site with Nunjucks templates. Get your static site.
- **Like in the good old days**: use your content folder as the base of your website url structure
- **Simple**: VanillaJS, no framework, no code transpiler, minimal dependencies
- **Yet powerful**: dynamic data computations, page data cascade and derived content generation
- **Extensible**: easily add support for more content types, writers, build commands, etc.

## DISCLAIMER

kiss concepts are still being fine tuned. Things will break. Use at your own risk.

## Requirements

Node 14 or above. May work on node 12 too, but untested.

## Install

```
npm install --save @slybridges/kiss
```

## Folder structure

Here is how your project directory would look like:

```
content/                          # this where your source content reside
├── blog/                         # create subfolders are you see fit to match your site URL structure.
│   │                             # kiss will generate index pages listing all children
│   ├── my-first-blog-post/       # content piece that is a folder with post.md/.html file inside
│   │   ├── post.md
│   │   └── blog-post-cover.jpg
│   └another-blog-post.md         # content piece that is a single file
└── index.js                      # index files (.js/.md/.html) can override parent data and cascade to their children
public/                           # this is where generated static files will be copied
theme/                            # this is where you create your site design
└── templates/                    # this is where your nunjucks template live
    └── base.njk                  # default nunjucks template
kiss.config.js                    # kiss config file
package.json
```

## Launch dev server

```
npx kiss start
```

This will launch the build, watch for content or config change and reload the browser on changes.

## Generate production build

```
NODE_ENV=prod npx kiss build
```

## Documentation

TBA, watch this space. In the meantime, the source code is your oyster.

> Read the code, Luke.
>
> - Obi-Wan Kenobi, had he been the creator of kiss

kiss codebase is tiny and easy to navigate.

Start with `config.js` to get an understanding of how you can configure your project.
