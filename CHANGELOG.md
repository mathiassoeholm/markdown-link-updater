# Change Log

## [2.3.0]

- Add support for .mdx files [#22](https://github.com/mathiassoeholm/markdown-link-updater/issues/25).

## [2.2.0]

- Add support for links inside angle brackets [#25](https://github.com/mathiassoeholm/markdown-link-updater/issues/25).

## [2.1.3]

- Fix bug where it would mangle the links if multiple links were renamed on the same line. Thanks to Higurashi-kagome.

## [2.1.2]

- Make path comparison case insensitive, so casing for the links doesn't matter.

## [2.1.1]

- Fix bug where path was not updated if the path contained a backslash. Thanks to Higurashi-kagome.

## [2.1.0]

- Now auto updates src attributes in img tags, that link to local images.
- Fix edge case where only one link updated if two or more links were on the same line.

## [2.0.3]

- Convert Windows paths to POSIX and use `path.posix` everywhere, which might have fixed other Windows specific bugs.

## [2.0.2]

- Fixed [#6](https://github.com/mathiassoeholm/markdown-link-updater/issues/6), where it didn't change links after renaming a folder on Windows. Thanks to Higurashi-kagome.

## [2.0.1]

- Only show info messages for links that actually changes.
- Don't modify a file if the links are unchanged.

## [2.0.0]

- Apply edits with `workspace.applyEdit`, allowing undo to work and the file to be modified but not saved.
- Large code refactoring, enabling better tests.
- Information messages showing that links changed.
- Confirmation popup, when more than 5 links are updated.
- Removed the `experimentalRenameHeadings` setting, as that feature is now on by default.
- Removed the `slowUseGitIgnore` settings.

## [1.2.2]

- Internal links to headers now work correctly with punctuation and foreign characters.

## [1.2.1]

- Experimental support for automatically renaming internal links to headers. See https://github.com/mathiassoeholm/markdown-link-updater/issues/3.

## [1.1.4]

- Take section references into account. [Fixes #2](https://github.com/mathiassoeholm/markdown-link-updater/issues/2).

## [1.1.3]

- Replace backslash `\` with forward-slash `/` in the renamed files' own links.

## [1.1.2]

- Replace backslash `\` with forward-slash `/` in other markdown files linking to the renamed file.

## [1.1.1]

- Fix wrong description in README file.

## [1.1.0]

- Add `exclude` and `include` settings, to customize which files and folders gets included.

## [1.0.0]

- Initial release
