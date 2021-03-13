import { ChangeEvent, ChangeEventType, FileList } from "../models";
import { pureGetActions } from "../put-get-actions";

const trim = (s: string) => s.trim();
const trimLines = (s: string) => s.trim().split("\n").map(trim).join("\n");

describe("pureGetActions", () => {
  it.each`
    oldHeader        | oldLink       | newHeader         | newLink
    ${"old text"}    | ${"old-text"} | ${"the new txt"}  | ${"the-new-txt"}
    ${"halløjs's"}   | ${"halløjss"} | ${"dåv    dav"}   | ${"dåv-dav"}
    ${"emoji 👍 np"} | ${"emoji-np"} | ${"emoji 😃-yay"} | ${"emoji--yay"}
  `(
    "renames link when header changes from '$oldHeader' to '$newHeader'",
    ({ oldHeader, oldLink, newHeader, newLink }) => {
      const event: ChangeEvent<"save"> = {
        type: "save",
        payload: {
          path: "/files/foo.md",
          contentBefore: trimLines(`
          [link](#${oldLink})

          ## ${oldHeader}
        `),
          contentAfter: trimLines(`
          [link](#${oldLink})

          ## ${newHeader}
        `),
        },
      };

      const markdownFiles: FileList = [
        {
          path: event.payload.path,
          content: event.payload.contentAfter,
        },
      ];

      expect(pureGetActions(event, markdownFiles)[0]).toEqual({
        range: {
          start: {
            line: 0,
            character: 0,
          },
          end: {
            line: 0,
            character: `[link](#${oldLink})`.length,
          },
        },
        newText: `[link](#${newLink})`,
      });
    }
  );
});
