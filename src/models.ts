type Path = string;

export type ChangeEventType = "save" | "rename";

export type ChangeEventPayload = {
  ["save"]: {
    path: Path;
    contentBefore: string;
    contentAfter: string;
  };
  ["rename"]: {
    some: number;
  };
};

export type ChangeEvent<T extends ChangeEventType> = {
  type: T;
  payload: ChangeEventPayload[T];
};

export type FileList = Array<{ path: Path; content: string }>;

export function isEventOfType<T extends ChangeEventType>(
  event: ChangeEvent<ChangeEventType>,
  type: T
): event is ChangeEvent<T> {
  return event.type === type;
}

export type Edit = {
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
  newText: string;
};
