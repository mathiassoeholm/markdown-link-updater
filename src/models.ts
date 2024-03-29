export type Path = string;

export type ChangeEventType = "save" | "rename";

export type ChangeEventPayload = {
  ["save"]: {
    path: Path;
    contentBefore: string;
    contentAfter: string;
  };
  ["rename"]: {
    pathBefore: Path;
    pathAfter: Path;
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
  path: Path;
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
  requiresPathToExist?: string;
};
