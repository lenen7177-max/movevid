import { isArray, isPlainObject, mergeWith } from "lodash-es";

export type Platform = "web" | "native";

export type PlatformScoped<T> = {
  web: T;
  native?: Partial<T>;
};

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * Deep merges object fields and treats arrays as replace-on-write values.
 */
export function deepMerge<T>(base: T, patch?: DeepPartial<T>): T {
  if (!patch) {
    return base;
  }

  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T;
  }

  return mergeWith({}, base, patch, (_objValue, srcValue) => {
    if (isArray(srcValue)) {
      return srcValue;
    }
    return undefined;
  }) as T;
}

/**
 * Resolves a platform-scoped config where native overrides web defaults.
 */
export function resolvePlatformScoped<T>(scoped: PlatformScoped<T>, platform: Platform): T {
  if (platform === "web") {
    return scoped.web;
  }

  return deepMerge(scoped.web, scoped.native as DeepPartial<T> | undefined);
}
