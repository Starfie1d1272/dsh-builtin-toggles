import { LoadHookContext } from "node:module";
import { Context, Fiber, Inject, Service } from "@deepseek-ai/cordis";
//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.2/node_modules/@deepseek-ai/cosmokit/lib/types/misc.d.ts
/** String/symbol keyed dictionary type. */
type Dict<T = any, K extends string | symbol = string> = { [key in K]: T; };
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/internal.d.ts
/** Node internal module format names handled by loader hooks. */
type ModuleFormat = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm';
/** Source payload accepted by Node internal module load hooks. */
type ModuleSource = string | ArrayBuffer;
/** Result returned by a Node internal resolve hook. */
interface ResolveResult {
  format: ModuleFormat;
  url: string;
}
/** Result returned by a Node internal load hook. */
interface LoadResult {
  format: ModuleFormat;
  source?: ModuleSource;
}
type LoadCacheData = ModuleJob;
/** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_map.js */
interface LoadCache extends Omit<Map<string, Dict<LoadCacheData>>, 'get' | 'set' | 'has'> {
  get(url: string, type?: string): LoadCacheData | undefined;
  set(url: string, type?: string, job?: LoadCacheData): this;
  has(url: string, type?: string): boolean;
}
/** Minimal Node internal ModuleWrap surface used by HMR helpers. */
interface ModuleWrap {
  url: string;
  getNamespace(): any;
}
/** @see https://github.com/nodejs/node/blob/main/lib/internal/modules/esm/module_job.js */
interface ModuleJob {
  url: string;
  loader: ModuleLoader;
  module?: ModuleWrap;
  importAttributes: ImportAttributes;
  linked: Promise<ModuleJob[]>;
  instantiate(): Promise<void>;
  run(): Promise<{
    module: ModuleWrap;
  }>;
}
/**
 * Node 22/23 ModuleLoader interface.
 *
 * Key methods:
 * - getModuleJobForImport(specifier, parentURL, importAttributes)
 * - resolve(specifier, parentURL, importAttributes) → Promise<ResolveResult>
 * - resolveSync(specifier, parentURL, importAttributes) → ResolveResult
 */
interface ModuleLoaderV1 {
  version: 'v1';
  loadCache: LoadCache;
  import(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<any>;
  register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[]): void;
  getModuleJobForImport(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ModuleJob>;
  resolve(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<ResolveResult>;
  resolveSync(specifier: string, parentURL: string, importAttributes: ImportAttributes): ResolveResult;
  load(specifier: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>;
}
/** Node 24+ module request object. */
interface ModuleRequest {
  specifier: string;
  attributes?: ImportAttributes;
  phase?: ModulePhase;
}
/** @see https://github.com/nodejs/node/blob/main/src/module_wrap.h */
declare const enum ModulePhase {
  Source = 1,
  Evaluation = 2
}
/** Opaque Node internal module request type marker. */
type ModuleRequestType = unknown;
/**
 * Node 24+ ModuleLoader interface.
 *
 * Breaking changes from v1:
 * - getModuleJobForImport removed → getOrCreateModuleJob(parentURL, request, requestType)
 * - resolve removed (became private #resolve) → resolveSync(parentURL, request)
 * - Parameter order reversed for resolveSync, request object { specifier, attributes }
 * - LoadCache became typed Map<url, { [type]: ModuleJob }> with delete only setting undefined
 */
interface ModuleLoaderV2 {
  version: 'v2';
  loadCache: LoadCache;
  import(specifier: string, parentURL: string, importAttributes: ImportAttributes, phase?: ModulePhase, isEntryPoint?: boolean): Promise<any>;
  register(specifier: string | URL, parentURL?: string | URL, data?: any, transferList?: any[], isInternal?: boolean): void;
  getOrCreateModuleJob(parentURL: string, request: ModuleRequest, requestType?: ModuleRequestType): Promise<ModuleJob>;
  resolveSync(parentURL: string, request: ModuleRequest): ResolveResult;
  load(url: string, context: Pick<LoadHookContext, 'format' | 'importAttributes'>): Promise<LoadResult>;
}
/** Supported Node internal ESM loader shapes. */
type ModuleLoader = ModuleLoaderV1 | ModuleLoaderV2;
/** Helpers for locating the current Node internal module loader. */
declare namespace ModuleLoader {
  function fromInternal(): ModuleLoader | undefined;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/config/tree.d.ts
/** Mutable tree of loader entries. Persistence is supplied by subclasses. */
declare abstract class EntryTree {
  static readonly sep = ":";
  ctx: Context;
  enableLogs?: boolean;
  root: EntryGroup;
  store: Dict<Entry>;
  constructor(ctx: Context);
  get context(): Context;
  /** Iterate entries in this tree and any nested subtrees. */
  entries(): Generator<Entry, void, void>;
  /** Return pending import and lifecycle tasks owned by this tree. */
  getTasks(): Promise<void>[];
  /**
   * Wait until this tree has no active import or lifecycle tasks.
   * @throws a settled fiber failure, or an aggregate when several fibers failed.
   */
  await(): Promise<void>;
  ensureId(options: Partial<EntryOptions>): string;
  /** Resolve an entry by id, including nested ids separated by `EntryTree.sep`. */
  resolve(id: string): Entry;
  resolveGroup(id: string | null): EntryGroup;
  /** Create an entry in the root group or a nested group. */
  create(options: Omit<EntryOptions, 'id'>, parent?: string | null, position?: number): Promise<string>;
  /** Stop and remove an entry from its parent group. */
  remove(id: string): Promise<void>;
  /** Update an entry and optionally move it to another group. */
  update(id: string, options: Omit<EntryOptions, 'id' | 'name'>, parent?: string | null, position?: number): Promise<void>;
  /** Import a plugin module from a specifier or `cordis:` builtin. */
  import(name: string, getOuterStack?: () => string[]): any;
  /** Persist current tree state. In-memory trees may implement this as a no-op. */
  abstract write(): void;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/config/group.d.ts
/** Runtime owner for a list of child loader entries. */
declare class EntryGroup {
  ctx: Context;
  tree: EntryTree;
  static readonly key: unique symbol;
  data: EntryOptions[];
  constructor(ctx: Context, tree: EntryTree);
  get context(): Context;
  create(options: Omit<EntryOptions, 'id'>): Promise<string>;
  unlink(options: EntryOptions): void;
  remove(id: string, isDispose?: boolean): Promise<void>;
  update(config: EntryOptions[]): Promise<void>;
  stop(): Promise<void>;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/config/entry.d.ts
/** Serialized plugin entry options stored in loader config files. */
interface EntryOptions {
  /** Stable id inside the containing entry tree. */
  id: string;
  /** Module specifier imported by the entry tree. */
  name: string;
  /** Config passed to the plugin. */
  config?: any;
  /** Marks this entry as a nested group. */
  group?: boolean | null;
  /** Prevents this entry and descendants from running. */
  disabled?: boolean | null;
  /** Required services or service intercept config for this entry. */
  inject?: Inject | null;
}
/** One configured plugin node inside an `EntryTree`. */
declare class Entry {
  loader: Loader;
  static readonly key: unique symbol;
  ctx: Context;
  fiber?: Fiber;
  parent: EntryGroup;
  options: EntryOptions;
  subgroup?: EntryGroup;
  subtree?: EntryTree;
  _initTask?: Promise<void>;
  _disposing: number;
  constructor(loader: Loader);
  get context(): Context;
  get id(): string;
  /** True when this entry or any owning parent entry is disabled. */
  get disabled(): boolean;
  private _disabled;
  /**
   * Effective disabled state: a `!!js` expression evaluates against the loader
   * context. The raw node stays in the options, so write-back keeps the form.
   */
  private disabledOf;
  evaluate(expr: string): any;
  private _patchContext;
  refresh(): Promise<void>;
  _dispose(fiber?: Fiber | undefined): Promise<void>;
  /** Merge new options, restart as needed, and persist through the parent tree. */
  update(options: Partial<EntryOptions>, create?: boolean, force?: boolean): Promise<void>;
  getOuterStack: () => string[];
  /** Import and start the configured plugin if it is not already running. */
  init(): Promise<void>;
  _await(): Promise<void>;
  private _init;
  private _start;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/config/isolate.d.ts
declare module './entry.ts' {
  interface EntryOptions {
    intercept?: Dict | null;
    isolate?: Dict<true | string> | null;
  }
  interface Entry {
    realm: LocalRealm;
  }
}
/** Symbol realm used to isolate service implementations by entry or label. */
declare abstract class Realm {
  protected store: Dict<symbol>;
  abstract get suffix(): string;
  access(key: string, create?: boolean): symbol;
  delete(key: string): void;
  get size(): number;
}
/** Entry-local isolation realm. */
declare class LocalRealm extends Realm {
  private entry;
  constructor(entry: Entry);
  get suffix(): string;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+cordis-plugin-loader@1.0.2_@deepseek-ai+cordis@4.0.1/node_modules/@deepseek-ai/cordis-plugin-loader/lib/types/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'exit'(signal: NodeJS.Signals): Promise<void>;
    'loader/config-update'(): void;
    'loader/entry-init'(entry: Entry): void;
    'loader/partial-dispose'(entry: Entry, legacy: Partial<EntryOptions>, active: boolean): void;
    'loader/patch-context'(entry: Entry, next: () => void | Promise<void>): void | Promise<void>;
  }
  interface Context {
    loader: Loader;
  }
  interface EnvData {
    startTime?: number;
  }
  interface Fiber {
    entry?: Entry;
  }
}
/** Loader config and dependency intercept namespace. */
declare namespace Loader {
  /** Root loader configuration. */
  interface Config {
    /** Base URL used to resolve relative plugin specifiers and config paths. */
    baseUrl?: string;
  }
  /** Intercept config used when other plugins depend on `loader`. */
  interface Intercept {
    /** Keep dependent plugins pending while loader entries are still loading. */
    await?: boolean;
  }
}
/**
 * Service that owns a loader entry tree and imports configured plugins.
 *
 * Subclasses provide persistence by implementing `write()` on `EntryTree`.
 */
declare class Loader extends EntryTree {
  config: Loader.Config;
  [Service.config]: Loader.Intercept;
  envData: any;
  name: string;
  internal: ModuleLoader | undefined;
  builtins: Dict<any>;
  constructor(ctx: Context, config?: Loader.Config);
  write(): void;
  [Service.check](): boolean;
  showLog(entry: Entry, type: string): void;
  /** Return the loader entry id that owns `fiber`, if any. */
  locate(fiber?: Fiber): string | undefined;
  /** Hook for hosts that can restart the process on full-reload requests. */
  exit(): void;
  /** Normalize ESM/CJS/default export shapes before applying a plugin. */
  unwrapExports(exports: any): any;
}
//#endregion
//#region src/policy.d.ts
/** Why an entry is not manageable; undefined means it is manageable. */
type LockReason = 'core' | 'unlisted' | 'external' | 'self' | 'agent-preset';
/** A snapshot row, as served by GET /api/builtin-toggles. */
interface SnapshotPlugin {
  id: string;
  name: string;
  disabled: boolean;
  phase: string | null;
  manageable: boolean;
  reason?: LockReason;
}
//#endregion
//#region src/index.d.ts
/** Cordis plugin identity. */
declare const name = "builtin-toggles";
/** Services required from the web composition. */
declare const inject: string[];
/** The same-origin API prefix. */
declare const API_PREFIX = "/api/builtin-toggles";
/** Versioned, read-only inspection endpoint. */
declare const INSPECTION_API_PATH = "/api/builtin-toggles/v1/inspection";
/**
 * Decode a URL-encoded plugin id from the request path. Malformed percent
 * encoding (`%ZZ`, dangling `%`) must never throw into the HTTP layer:
 * return null and let the route answer a clean 400 without touching the
 * runtime or the profile patch.
 */
declare function decodeEntryId(raw: string): string | null;
declare function serializeMutation<T>(run: () => Promise<T>): Promise<T>;
/** Snapshot rows: manageable + official + self (external packages stay invisible). */
declare function buildSnapshot(entries: Entry[]): SnapshotPlugin[];
/** Register the same-origin API; runs for the lifetime of the fiber. */
declare function apply(ctx: Context): void;
//#endregion
export { API_PREFIX, INSPECTION_API_PATH, apply, buildSnapshot, decodeEntryId, inject, name, serializeMutation };