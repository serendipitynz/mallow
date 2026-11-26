# Privacy policy

> 日本語: [PRIVACY.ja.md](PRIVACY.ja.md)

Effective 2026-11-26. This policy covers mallow, the desktop viewer for
Markdown and configuration files, in every build: the Microsoft Store package
and the bundles on GitHub Releases.

## What mallow collects

Nothing. mallow has no account, no analytics, no telemetry and no crash
reporting, and it sends nothing about you, your files or how you use it to its
developer or to anyone else.

## What mallow keeps on your device

To restore where you left off, mallow stores the following on your device only:

- your preferences (colour, language, text width and the like);
- the windows that were open at quit, with the folder and file each showed;
- the recently opened folders;
- each window's size and position.

The files you open are read where they are and are never copied elsewhere.
Deleting mallow's settings folder removes what it stored.

## When mallow uses the network

mallow makes a network request only in these cases:

- **Images and stylesheets a document refers to.** When a Markdown or HTML
  document you open refers to an image, or to a stylesheet background, at an
  `http` or `https` address, mallow loads it from that address to display it,
  as a web browser would. The server at that address receives the request.
- **Links you choose to open.** Choosing an `http` or `https` link in a
  document hands it to your default web browser.
- **Update checks — the GitHub Releases build only.** That build asks
  github.com whether a newer version exists when it starts (Settings can turn
  this off) and when you ask it to check. The Microsoft Store build has no
  update check of its own; the Store updates it.

GitHub's and Microsoft's own privacy statements cover what their services
record about those requests.

## Changes

Changes to this policy are made in this file, and its history is the record of
them.

## Contact

Questions about this policy: open an issue at
<https://github.com/serendipitynz/mallow/issues>.
