# Markdown Link Updater

## Features

Updates Markdown links automatically, when files in the workspace are moved or renamed.

![demo](https://github.com/mathiassoeholm/markdown-link-updater/raw/main/images/demo.gif)

## Extension Settings

This extension contributes the following settings:

- `markdownLinkUpdater.exclude`: Array of glob patterns used to exclude specific folders and files. Default value is `['**/node_modules/**']`.
- `markdownLinkUpdater.include`: Skip files that are ignored by git. This can be SLOW on large projects, so it is encouraged to activate it on a per project basis. Default value is `false`.
- `markdownLinkUpdater.slowUseGitIgnore`: Array of glob patterns use to include specific folders and files. If the array is empty, everything will be included, unless specified by exclude. Default value is `[]`.

## Release Notes

See [CHANGELOG](CHANGELOG.md) for more information.
