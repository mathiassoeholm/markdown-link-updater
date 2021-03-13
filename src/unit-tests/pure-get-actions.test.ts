import { ChangeEvent, ChangeEventType, FileList } from "../models";
import { pureGetActions } from "../put-get-actions";

const trim = (s: string) => s.trim();
const trimLines = (s: string) => s.trim().split("\n").map(trim).join("\n");

describe("pureGetActions", () => {
  it("renames link when header changes", () => {
    const event: ChangeEvent<"save"> = {
      type: "save",
      payload: {
        path: "/files/foo.md",
        contentBefore: trimLines(`
          [link](#typescript-is-nice)

          ## typescript is nice
        `),
        contentAfter: trimLines(`
          [link](#typescript-is-nice)

          ## typescript is cool
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
          character: 27,
        },
      },
      newText: "[link](#typescript-is-cool)",
    });
  });
});
