module.exports = {
  email: "test@eample.com",
  attributeA: "IndexAttributeA",
  attributeB: "IndexAttributeB",
  attributeC: () => {
    return "FnAttributeC"
  },
  authors: [
    {
      id: "john",
      name: "John Doe",
      email: "john@example.com",
      bio: "Technical writer and developer",
    },
    {
      id: "jane",
      name: "Jane Smith",
      email: "jane@example.com",
      bio: "Content strategist",
    },
  ],
  contactEmail: "info@example.com",
  socialMedia: {
    twitter: "@example",
    github: "example",
  },
}
