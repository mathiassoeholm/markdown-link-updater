import { diffLines } from "diff";
import { headingToAnchor } from "./heading-to-anchor";
import {
  ChangeEvent,
  ChangeEventPayload,
  ChangeEventType,
  Edit,
  FileList,
  isEventOfType,
} from "./models";

const mdLinkRegex = /\[([^\]]*)\]\(([^\)]+)\)/;

function pureGetEdits<T extends ChangeEventType>(
  event: ChangeEvent<T>,
  fileList: FileList
) {
  const result = (() => {
    if (isEventOfType(event, "save")) {
      return [...handleSaveEvent(event.payload)];
    } else {
      return [];
    }
  })();

  return result;
}

function* handleSaveEvent(
  payload: ChangeEventPayload["save"]
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

export { pureGetEdits };
