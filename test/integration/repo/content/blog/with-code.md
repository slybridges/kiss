---
title: Post with Code Examples
description: Demonstrating code block handling
author: john
created: 2024-01-25
tags: ["code", "test", "markdown"]
---

# Working with Code in kiss

This post shows how kiss handles code blocks and syntax highlighting.

## JavaScript Example

```javascript
const build = async (options = {}) => {
  const config = loadConfig(options)
  const context = await loadContent(config)
  await writeOutput(context, config)
  return { context, config }
}
```

## CSS Example

```css
.hero {
  background-image: url("/images/hero.webp");
  background-size: cover;
  height: 400px;
}
```

## Inline Code

You can also use `inline code` in your markdown content.
