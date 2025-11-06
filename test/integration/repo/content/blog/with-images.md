---
title: Post with Images
description: Demonstrating image handling in kiss
author: jane
created: 2024-01-20
tags: ["images", "test"]
---

# Post with Images

This post demonstrates how kiss handles images in markdown content.

## Hero Image

![Hero image](/images/hero.webp)

## Gallery

Here are some example images:

![Large photo relative path](@file:../images/photo-large.jpg)
![Graphic absolute path](/images/graphic.png)
![Small icon relative path](@file:../images/icon.png)

kiss will automatically optimize these images and generate responsive variants!

## Testing linking strategies

- [bare](/simple)
- [permalink](@permalink:/blog/json)
- [file relative](@file:../contact.html)
- [file absolute](@file:/blog/json-post.json)
- [id](@id:about-page-id)
