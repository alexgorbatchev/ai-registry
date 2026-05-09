type ITomlScalar = boolean | number | string;

interface ITomlArray extends Array<ITomlValue> {}

interface ITomlTable {
  [key: string]: ITomlValue;
}

type ITomlValue = ITomlArray | ITomlScalar | ITomlTable;

type IBuildMutableCodexConfigParams = {
  currentConfigText: null | string;
  previousManagedConfigText: null | string;
  sourceConfigText: string;
};

type IBuildMutableCodexConfigResult = {
  configText: string;
  managedConfigSnapshotText: string;
};

function isTomlScalar(value: unknown): value is ITomlScalar {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}

function isTomlArray(value: unknown): value is ITomlArray {
  return Array.isArray(value) && value.every((item) => isTomlValue(item));
}

function isTomlTable(value: unknown): value is ITomlTable {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => isTomlValue(item));
}

function isTomlValue(value: unknown): value is ITomlValue {
  return isTomlScalar(value) || isTomlArray(value) || isTomlTable(value);
}

function parseTomlTable(text: string, description: string): ITomlTable {
  const parsedValue: unknown = Bun.TOML.parse(text);
  if (!isTomlTable(parsedValue)) {
    throw new Error(`${description} must parse to a TOML table.`);
  }

  return parsedValue;
}

function parseManagedConfigSnapshot(text: string): ITomlTable {
  const parsedValue: unknown = JSON.parse(text);
  if (!isTomlTable(parsedValue)) {
    throw new Error("Codex managed config snapshot must be a JSON object.");
  }

  return parsedValue;
}

function cloneTomlValue(value: ITomlValue): ITomlValue {
  if (isTomlScalar(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneTomlValue(item));
  }

  const clonedTable: ITomlTable = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    clonedTable[key] = cloneTomlValue(nestedValue);
  }

  return clonedTable;
}

function removeManagedValues(currentConfig: ITomlTable, managedConfig: ITomlTable): ITomlTable {
  const unmanagedConfig: ITomlTable = {};

  for (const [key, currentValue] of Object.entries(currentConfig)) {
    const managedValue = managedConfig[key];
    if (managedValue === undefined) {
      unmanagedConfig[key] = cloneTomlValue(currentValue);
      continue;
    }

    if (isTomlTable(currentValue) && isTomlTable(managedValue)) {
      const nestedUnmanagedConfig = removeManagedValues(currentValue, managedValue);
      if (Object.keys(nestedUnmanagedConfig).length > 0) {
        unmanagedConfig[key] = nestedUnmanagedConfig;
      }
    }
  }

  return unmanagedConfig;
}

function mergeTomlTables(baseConfig: ITomlTable, overrideConfig: ITomlTable): ITomlTable {
  const mergedConfig: ITomlTable = {};

  for (const [key, value] of Object.entries(baseConfig)) {
    mergedConfig[key] = cloneTomlValue(value);
  }

  for (const [key, overrideValue] of Object.entries(overrideConfig)) {
    const baseValue = mergedConfig[key];
    if (isTomlTable(baseValue) && isTomlTable(overrideValue)) {
      mergedConfig[key] = mergeTomlTables(baseValue, overrideValue);
      continue;
    }

    mergedConfig[key] = cloneTomlValue(overrideValue);
  }

  return mergedConfig;
}

function isArrayOfTables(value: ITomlValue): value is ITomlTable[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isTomlTable(item));
}

function formatTomlKeySegment(key: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(key)) {
    return key;
  }

  return JSON.stringify(key);
}

function formatTomlPath(pathSegments: string[]): string {
  return pathSegments.map((segment) => formatTomlKeySegment(segment)).join(".");
}

function stringifyTomlNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "nan";
  }

  if (value === Number.POSITIVE_INFINITY) {
    return "+inf";
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return "-inf";
  }

  return String(value);
}

function stringifyInlineTomlValue(value: ITomlValue): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return stringifyTomlNumber(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stringifyInlineTomlValue(item)).join(", ");
    return `[${items}]`;
  }

  const entries = Object.entries(value)
    .map(([key, nestedValue]) => `${formatTomlKeySegment(key)} = ${stringifyInlineTomlValue(nestedValue)}`)
    .join(", ");

  return `{ ${entries} }`;
}

function appendTomlTableSections(pathSegments: string[], table: ITomlTable, sections: string[]): void {
  const scalarLines: string[] = [];
  const nestedTables: Array<[string, ITomlTable]> = [];
  const arrayTables: Array<[string, ITomlTable[]]> = [];

  for (const [key, value] of Object.entries(table)) {
    if (isTomlTable(value)) {
      nestedTables.push([key, value]);
      continue;
    }

    if (isArrayOfTables(value)) {
      arrayTables.push([key, value]);
      continue;
    }

    scalarLines.push(`${formatTomlKeySegment(key)} = ${stringifyInlineTomlValue(value)}`);
  }

  if (scalarLines.length > 0) {
    const lines = pathSegments.length > 0
      ? [`[${formatTomlPath(pathSegments)}]`, ...scalarLines]
      : scalarLines;
    sections.push(lines.join("\n"));
  }

  for (const [key, nestedTable] of nestedTables) {
    appendTomlTableSections([...pathSegments, key], nestedTable, sections);
  }

  for (const [key, tableArray] of arrayTables) {
    appendTomlArrayTableSections([...pathSegments, key], tableArray, sections);
  }
}

function appendTomlArrayTableSections(pathSegments: string[], tableArray: ITomlTable[], sections: string[]): void {
  for (const table of tableArray) {
    const scalarLines: string[] = [];
    const nestedTables: Array<[string, ITomlTable]> = [];
    const nestedArrayTables: Array<[string, ITomlTable[]]> = [];

    for (const [key, value] of Object.entries(table)) {
      if (isTomlTable(value)) {
        nestedTables.push([key, value]);
        continue;
      }

      if (isArrayOfTables(value)) {
        nestedArrayTables.push([key, value]);
        continue;
      }

      scalarLines.push(`${formatTomlKeySegment(key)} = ${stringifyInlineTomlValue(value)}`);
    }

    sections.push([`[[${formatTomlPath(pathSegments)}]]`, ...scalarLines].join("\n"));

    for (const [key, nestedTable] of nestedTables) {
      appendTomlTableSections([...pathSegments, key], nestedTable, sections);
    }

    for (const [key, nestedTableArray] of nestedArrayTables) {
      appendTomlArrayTableSections([...pathSegments, key], nestedTableArray, sections);
    }
  }
}

function stringifyTomlTable(table: ITomlTable): string {
  const sections: string[] = [];
  appendTomlTableSections([], table, sections);
  return sections.join("\n\n");
}

export function buildMutableCodexConfig(
  params: IBuildMutableCodexConfigParams,
): IBuildMutableCodexConfigResult {
  const sourceConfig = parseTomlTable(params.sourceConfigText, "Codex harness config");
  const currentConfig = params.currentConfigText === null
    ? null
    : parseTomlTable(params.currentConfigText, "Mutable Codex config");
  const previousManagedConfig = params.previousManagedConfigText === null
    ? null
    : parseManagedConfigSnapshot(params.previousManagedConfigText);

  const unmanagedConfig = currentConfig === null
    ? {}
    : previousManagedConfig === null
      ? currentConfig
      : removeManagedValues(currentConfig, previousManagedConfig);
  const mergedConfig = mergeTomlTables(unmanagedConfig, sourceConfig);

  return {
    configText: `${stringifyTomlTable(mergedConfig)}\n`,
    managedConfigSnapshotText: `${JSON.stringify(sourceConfig, null, 2)}\n`,
  };
}
