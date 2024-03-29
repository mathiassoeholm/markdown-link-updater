# Markdown Link Updater

[![version](https://img.shields.io/vscode-marketplace/v/mathiassoeholm.markdown-link-updater.svg?style=flat-square&label=vscode%20marketplace)](https://marketplace.visualstudio.com/items?itemName=mathiassoeholm.markdown-link-updater)

## Features

Updates Markdown links automatically, when files in the workspace are moved or renamed.

![demo](https://github.com/mathiassoeholm/markdown-link-updater/raw/main/images/demo.gif)

## Extension Settings

This extension contributes the following settings:

- `markdownLinkUpdater.exclude`: Array of glob patterns used to exclude specific folders and files. Default value is `['**/node_modules/**']`.
- `markdownLinkUpdater.include`: Array of glob patterns use to include specific folders and files. If the array is empty, everything will be included, unless specified by exclude. Default value is `[]`.

## Release Notes

See [CHANGELOG](CHANGELOG.md) for more information.
