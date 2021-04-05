import { diffLines } from "diff";
import * as path from "path";
import { headingToAnchor } from "./heading-to-anchor";
import minimatch from "minimatch";
import {
  ChangeEvent,
  ChangeEventPayload,
  ChangeEventType,
  Edit,
  FileList,
  isEventOfType,
} from "./models";

const mdLinkRegex = /\[([^\]]*)\]\(([^\)]+)\)/;
const targetWithSectionRegex = /(.+\.md)(#[^\s\/]+)/;
const imgRegex = /<img\s[^>]*?src\s*=\s*['\"]([^'\"]*?)['\"][^>]*?>/gm;

interface Options {
  /**
   * Array of glob patterns used to exclude specific folders and files.
   */
  exclude?: string[];
  /**
   * Array of glob patterns used to include specific folders and files.
   * If the array is empty, everything will be included, unless specified by exclude.
   */
  include?: string[];
  /**
   * The absolute path of the VS Code workspace.
   */
  workspacePath?: string;
}

function pureGetEdits<T extends ChangeEventType>(
  event: ChangeEvent<T>,
  markdownFiles: FileList,
  options: Options
) {
  const result = (() => {
    if (isEventOfType(event, "save")) {
      return [...handleSaveEvent(event.payload, options)];
    } else if (isEventOfType(event, "rename")) {
      return [...handleRenameEvent(event.payload, markdownFiles, options)];
    } else {
      return [];
    }
  })();

  return result;
}
function* handleRenameEvent(
  payload: ChangeEventPayload["rename"],
  markdownFiles: FileList,
  { exclude = [], include = [], workspacePath }: Options
): Generator<Edit> {
  const pathBefore = path.posix.normalize(windowsToPosix(payload.pathBefore));
  const pathAfter = path.posix.normalize(windowsToPosix(payload.pathAfter));

  const shouldIncludePath = (filePath: string) => {
    const relativePath = path.posix.relative(workspacePath ?? "", filePath);

    const matchesIncludeList = include.some((pattern) => {
      return minimatch(relativePath, pattern);
    });

    if (matchesIncludeList) {
      return true;
    }

    if (include.length > 0) {
      return false;
    }

    const matchesExcludeList = exclude.some((pattern) => {
      return minimatch(relativePath, pattern);
    });

    return !matchesExcludeList;
  };

  markdownFiles = markdownFiles
    .map((file) => ({ ...file, path: windowsToPosix(file.path) }))
    .filter(({ path }) => shouldIncludePath(path));

  if (!shouldIncludePath(pathBefore)) {
    return;
  }

  const fileContent = markdownFiles.find(
    (file) => path.posix.normalize(file.path) === pathAfter
  )?.content;

  if (fileContent) {
    let lineNumber = -1;
    for (const line of fileContent.split("\n")) {
      lineNumber++;

      const match = mdLinkRegex.exec(line);
      if (!match) {
        continue;
      }

      let [fullMdLink, name, target] = match;

      const targetWithSectionMatch = target.match(/(.+\.md)(#[^\s\/]+)/);
      let section = "";

      if (targetWithSectionMatch) {
        target = targetWithSectionMatch[1];
        section = targetWithSectionMatch[2];
      }

      const absoluteTarget = path.posix.join(
        path.posix.dirname(pathBefore),
        target
      );

      const newLink = path.posix.normalize(
        path.posix.relative(path.posix.dirname(pathAfter), absoluteTarget)
      );

      const targetIsUnmodified = path.posix.normalize(target) === newLink;

      if (targetIsUnmodified) {
        continue;
      }

      yield {
        path: pathAfter,
        range: {
          start: {
            line: lineNumber,
            character: match.index,
          },
          end: {
            line: lineNumber,
            character: match.index + fullMdLink.length,
          },
        },
        newText: `[${name}](${newLink}${section})`,
        requiresPathToExist: absoluteTarget,
      };
    }
  }

  for (const markdownFile of markdownFiles) {
    imgRegex.lastIndex = 0;
    const imgMatches = imgRegex.exec(markdownFile.content);
    console.log((imgMatches as any)?.indices);
    debugger;

    let lineNumber = -1;
    for (const line of markdownFile.content.split("\n")) {
      lineNumber++;

      const match = mdLinkRegex.exec(line);
      if (!match) {
        continue;
      }

      let [fullMdLink, name, target] = match;
      const targetWithSectionMatch = target.match(targetWithSectionRegex);
      let section = "";

      if (targetWithSectionMatch) {
        target = targetWithSectionMatch[1];
        section = targetWithSectionMatch[2];
      }

      const absoluteTarget = path.posix.normalize(
        path.posix.join(path.posix.dirname(markdownFile.path), target)
      );

      const isLinkToFileInRenamedFolder = absoluteTarget.startsWith(
        pathBefore + path.posix.sep
      );

      const isLinkToMovedFile = absoluteTarget === pathBefore;

      if (isLinkToMovedFile) {
        const newLink = path.posix.normalize(
          path.posix.relative(path.posix.dirname(markdownFile.path), pathAfter)
        );

        const newFullMdLink = `[${name}](${newLink}${section})`;

        yield {
          path: markdownFile.path,
          range: {
            start: {
              line: lineNumber,
              character: match.index,
            },
            end: {
              line: lineNumber,
              character: match.index + fullMdLink.length,
            },
          },
          newText: newFullMdLink,
        };
      } else if (isLinkToFileInRenamedFolder) {
        const newAbsoluteTarget = `${pathAfter}/${absoluteTarget.substring(
          pathBefore.length + 1
        )}`;

        const newLink = path.posix.relative(
          path.posix.dirname(markdownFile.path),
          newAbsoluteTarget
        );

        const newFullMdLink = `[${name}](${newLink}${section})`;

        yield {
          path: markdownFile.path,
          range: {
            start: {
              line: lineNumber,
              character: match.index,
            },
            end: {
              line: lineNumber,
              character: match.index + fullMdLink.length,
            },
          },
          newText: newFullMdLink,
          requiresPathToExist: newAbsoluteTarget,
        };
      }
    }
  }
}

function* handleSaveEvent(
  payload: ChangeEventPayload["save"],
  { exclude }: Options
): Generator<Edit> {
  const { contentBefore, contentAfter } = payload;

  const diff = diffLines(contentBefore, contentAfter, {});
  const renamedHeadings = diff
    .map((change, index) => {
      const nextChange = diff[index + 1];

      if (!nextChange) {
        return null;
      }

      const removedAndAddedLine =
        change.removed === true && nextChange.added === true;

      if (removedAndAddedLine) {
        const oldLine = change.value;
        const newLine = nextChange.value;

        const headingRegex = /^(#+ )(.+)/;
        const oldLineMatch = oldLine.match(headingRegex);
        const newLineMatch = newLine.match(headingRegex);

        if (
          oldLineMatch &&
          newLineMatch &&
          // Check if same header type
          oldLineMatch[1] === newLineMatch[1]
        ) {
          return {
            oldHeader: oldLineMatch[2],
            newHeader: newLineMatch[2],
          };
        }
      }

      return null;
    })
    .filter(Boolean) as Array<{ oldHeader: string; newHeader: string }>;

  let lineNumber = 0;
  for (const line of contentAfter.split("\n")) {
    const [match, name, link] = line.match(mdLinkRegex) ?? [];

    if (match) {
      for (const { oldHeader, newHeader } of renamedHeadings) {
        const oldHeaderAnchor = headingToAnchor(oldHeader);
        const newHeaderAnchor = headingToAnchor(newHeader);

        if (link === `#${oldHeaderAnchor}`) {
          yield {
            path: payload.path,
            range: {
              start: {
                line: lineNumber,
                character: 0,
              },
              end: {
                line: lineNumber,
                character: line.length,
              },
            },
            newText: `[${name}](#${newHeaderAnchor})`,
          };
        }
      }
    }

    lineNumber++;
  }
}

const windowsToPosix = (path: string) => {
  return path.replace(/\\/g, "/");
};

export { pureGetEdits, Options };
