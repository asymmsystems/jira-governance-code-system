"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/tslib/tslib.es6.mjs
  var tslib_es6_exports = {};
  __export(tslib_es6_exports, {
    __addDisposableResource: () => __addDisposableResource,
    __assign: () => __assign,
    __asyncDelegator: () => __asyncDelegator,
    __asyncGenerator: () => __asyncGenerator,
    __asyncValues: () => __asyncValues,
    __await: () => __await,
    __awaiter: () => __awaiter,
    __classPrivateFieldGet: () => __classPrivateFieldGet,
    __classPrivateFieldIn: () => __classPrivateFieldIn,
    __classPrivateFieldSet: () => __classPrivateFieldSet,
    __createBinding: () => __createBinding,
    __decorate: () => __decorate,
    __disposeResources: () => __disposeResources,
    __esDecorate: () => __esDecorate,
    __exportStar: () => __exportStar,
    __extends: () => __extends,
    __generator: () => __generator,
    __importDefault: () => __importDefault,
    __importStar: () => __importStar,
    __makeTemplateObject: () => __makeTemplateObject,
    __metadata: () => __metadata,
    __param: () => __param,
    __propKey: () => __propKey,
    __read: () => __read,
    __rest: () => __rest,
    __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
    __runInitializers: () => __runInitializers,
    __setFunctionName: () => __setFunctionName,
    __spread: () => __spread,
    __spreadArray: () => __spreadArray,
    __spreadArrays: () => __spreadArrays,
    __values: () => __values,
    default: () => tslib_es6_default
  });
  function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }
  function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
      t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
          t[p[i]] = s[p[i]];
      }
    return t;
  }
  function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  }
  function __param(paramIndex, decorator) {
    return function(target, key) {
      decorator(target, key, paramIndex);
    };
  }
  function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) {
      if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
      return f;
    }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
      var context = {};
      for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
      for (var p in contextIn.access) context.access[p] = contextIn.access[p];
      context.addInitializer = function(f) {
        if (done) throw new TypeError("Cannot add initializers after decoration has completed");
        extraInitializers.push(accept(f || null));
      };
      var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
      if (kind === "accessor") {
        if (result === void 0) continue;
        if (result === null || typeof result !== "object") throw new TypeError("Object expected");
        if (_ = accept(result.get)) descriptor.get = _;
        if (_ = accept(result.set)) descriptor.set = _;
        if (_ = accept(result.init)) initializers.unshift(_);
      } else if (_ = accept(result)) {
        if (kind === "field") initializers.unshift(_);
        else descriptor[key] = _;
      }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
  }
  function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
      value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
  }
  function __propKey(x) {
    return typeof x === "symbol" ? x : "".concat(x);
  }
  function __setFunctionName(f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
  }
  function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
  }
  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1) throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (g && (g = 0, op[0] && (_ = 0)), _) try {
        if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
        if (y = 0, t) op = [op[0] & 2, t.value];
        switch (op[0]) {
          case 0:
          case 1:
            t = op;
            break;
          case 4:
            _.label++;
            return { value: op[1], done: false };
          case 5:
            _.label++;
            y = op[1];
            op = [0];
            continue;
          case 7:
            op = _.ops.pop();
            _.trys.pop();
            continue;
          default:
            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _ = 0;
              continue;
            }
            if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
              _.label = op[1];
              break;
            }
            if (op[0] === 6 && _.label < t[1]) {
              _.label = t[1];
              t = op;
              break;
            }
            if (t && _.label < t[2]) {
              _.label = t[2];
              _.ops.push(op);
              break;
            }
            if (t[2]) _.ops.pop();
            _.trys.pop();
            continue;
        }
        op = body.call(thisArg, _);
      } catch (e) {
        op = [6, e];
        y = 0;
      } finally {
        f = t = 0;
      }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  }
  function __exportStar(m, o) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
  }
  function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
      next: function() {
        if (o && i >= o.length) o = void 0;
        return { value: o && o[i++], done: !o };
      }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
  }
  function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  }
  function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
      ar = ar.concat(__read(arguments[i]));
    return ar;
  }
  function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
      for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
        r[k] = a[j];
    return r;
  }
  function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  }
  function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
  }
  function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
      return this;
    }, i;
    function awaitReturn(f) {
      return function(v) {
        return Promise.resolve(v).then(f, reject);
      };
    }
    function verb(n, f) {
      if (g[n]) {
        i[n] = function(v) {
          return new Promise(function(a, b) {
            q.push([n, v, a, b]) > 1 || resume(n, v);
          });
        };
        if (f) i[n] = f(i[n]);
      }
    }
    function resume(n, v) {
      try {
        step(g[n](v));
      } catch (e) {
        settle(q[0][3], e);
      }
    }
    function step(r) {
      r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
    }
    function fulfill(value) {
      resume("next", value);
    }
    function reject(value) {
      resume("throw", value);
    }
    function settle(f, v) {
      if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
    }
  }
  function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function(e) {
      throw e;
    }), verb("return"), i[Symbol.iterator] = function() {
      return this;
    }, i;
    function verb(n, f) {
      i[n] = o[n] ? function(v) {
        return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
      } : f;
    }
  }
  function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
      return this;
    }, i);
    function verb(n) {
      i[n] = o[n] && function(v) {
        return new Promise(function(resolve, reject) {
          v = o[n](v), settle(resolve, reject, v.done, v.value);
        });
      };
    }
    function settle(resolve, reject, d, v) {
      Promise.resolve(v).then(function(v2) {
        resolve({ value: v2, done: d });
      }, reject);
    }
  }
  function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) {
      Object.defineProperty(cooked, "raw", { value: raw });
    } else {
      cooked.raw = raw;
    }
    return cooked;
  }
  function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
      for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
    }
    __setModuleDefault(result, mod);
    return result;
  }
  function __importDefault(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  }
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  function __classPrivateFieldIn(state, receiver) {
    if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
    return typeof state === "function" ? receiver === state : state.has(receiver);
  }
  function __addDisposableResource(env, value, async) {
    if (value !== null && value !== void 0) {
      if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
      var dispose, inner;
      if (async) {
        if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
        dispose = value[Symbol.asyncDispose];
      }
      if (dispose === void 0) {
        if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
        dispose = value[Symbol.dispose];
        if (async) inner = dispose;
      }
      if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
      if (inner) dispose = function() {
        try {
          inner.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
      env.stack.push({ value, dispose, async });
    } else if (async) {
      env.stack.push({ async: true });
    }
    return value;
  }
  function __disposeResources(env) {
    function fail(e) {
      env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
      env.hasError = true;
    }
    var r, s = 0;
    function next() {
      while (r = env.stack.pop()) {
        try {
          if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
          if (r.dispose) {
            var result = r.dispose.call(r.value);
            if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
              fail(e);
              return next();
            });
          } else s |= 1;
        } catch (e) {
          fail(e);
        }
      }
      if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
      if (env.hasError) throw env.error;
    }
    return next();
  }
  function __rewriteRelativeImportExtension(path, preserveJsx, extraExtensions, ignoreCase) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
      if (extraExtensions) {
        for (var extension in extraExtensions) {
          var suffix = path.slice(-extension.length);
          if (suffix === extension || ignoreCase && suffix.toLowerCase() === extension.toLowerCase()) {
            var output = extraExtensions[extension];
            return output === extension ? path : path.slice(0, -extension.length) + output;
          }
        }
      }
      return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
        return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
      });
    }
    return path;
  }
  var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
  var init_tslib_es6 = __esm({
    "node_modules/tslib/tslib.es6.mjs"() {
      extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      __assign = function() {
        __assign = Object.assign || function __assign2(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      });
      __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      };
      ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      tslib_es6_default = {
        __extends,
        __assign,
        __rest,
        __decorate,
        __param,
        __esDecorate,
        __runInitializers,
        __propKey,
        __setFunctionName,
        __metadata,
        __awaiter,
        __generator,
        __createBinding,
        __exportStar,
        __values,
        __read,
        __spread,
        __spreadArrays,
        __spreadArray,
        __await,
        __asyncGenerator,
        __asyncDelegator,
        __asyncValues,
        __makeTemplateObject,
        __importStar,
        __importDefault,
        __classPrivateFieldGet,
        __classPrivateFieldSet,
        __classPrivateFieldIn,
        __addDisposableResource,
        __disposeResources,
        __rewriteRelativeImportExtension
      };
    }
  });

  // node_modules/@forge/bridge/out/router/targets.js
  var require_targets = __commonJS({
    "node_modules/@forge/bridge/out/router/targets.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.NavigationTarget = void 0;
      exports.NavigationTarget = {
        /**
         * The view page for pages, blogs and custom content. Takes a contentId to identify the content.
         */
        ContentView: "contentView",
        /**
         * The edit page for pages, blogs and custom content. Takes a contentId to identify the content.
         */
        ContentEdit: "contentEdit",
        /**
         * The list/collector page for pages, blogs and custom content contained in a space. Takes a spaceKey and a contentType to identify the content type for pages and blogs. Takes a moduleKey for custom content.
         */
        ContentList: "contentList",
        /**
         * The space view page. Takes a spaceKey to identify the space.
         */
        SpaceView: "spaceView",
        /**
         * The page within a specific module. Takes a moduleKey to identify the correct module.
         */
        Module: "module",
        /**
         * The profile page for a specific user. Takes an accountId to identify the user.
         */
        UserProfile: "userProfile",
        /**
         * A dashboard in Jira. Takes a dashboardId to identify the dashboard.
         */
        Dashboard: "dashboard",
        /**
         * An issue in Jira. Takes an issueKey to identify the issue.
         */
        Issue: "issue",
        /**
         * The project settings details of a Jira project. Takes a projectKey to identify the project. Only accessible to administrators.
         */
        ProjectSettingsDetails: "projectSettingsDetails"
      };
    }
  });

  // node_modules/@forge/bridge/out/errors.js
  var require_errors = __commonJS({
    "node_modules/@forge/bridge/out/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.BridgeAPIError = void 0;
      var BridgeAPIError = class extends Error {
      };
      exports.BridgeAPIError = BridgeAPIError;
    }
  });

  // node_modules/@forge/bridge/out/bridge.js
  var require_bridge = __commonJS({
    "node_modules/@forge/bridge/out/bridge.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getCallBridge = void 0;
      var errors_1 = require_errors();
      function isBridgeAvailable(bridge) {
        return !!(bridge === null || bridge === void 0 ? void 0 : bridge.callBridge);
      }
      var getCallBridge = () => {
        if (!isBridgeAvailable(globalThis.__bridge)) {
          throw new errors_1.BridgeAPIError(`
      Unable to establish a connection with the Custom UI bridge.
      If you are trying to run your app locally, Forge apps only work in the context of Atlassian products. Refer to https://go.atlassian.com/forge-tunneling-with-custom-ui for how to tunnel when using a local development server.
    `);
        }
        return globalThis.__bridge.callBridge;
      };
      exports.getCallBridge = getCallBridge;
    }
  });

  // node_modules/@forge/bridge/out/utils/index.js
  var require_utils = __commonJS({
    "node_modules/@forge/bridge/out/utils/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.withRateLimiter = void 0;
      var errors_1 = require_errors();
      var withRateLimiter = (wrappedFn, maxOps, intervalInMs, exceededErrorMessage) => {
        let start = Date.now();
        let numOps = 0;
        return async (...args) => {
          const now = Date.now();
          const elapsed = now - start;
          if (elapsed > intervalInMs) {
            start = now;
            numOps = 0;
          }
          if (numOps >= maxOps) {
            throw new errors_1.BridgeAPIError(exceededErrorMessage || "Too many invocations.");
          }
          numOps = numOps + 1;
          return wrappedFn(...args);
        };
      };
      exports.withRateLimiter = withRateLimiter;
    }
  });

  // node_modules/@forge/bridge/out/invoke/invoke.js
  var require_invoke = __commonJS({
    "node_modules/@forge/bridge/out/invoke/invoke.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.invoke = invoke2;
      exports.makeInvoke = makeInvoke;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var utils_1 = require_utils();
      var callBridge = (0, bridge_1.getCallBridge)();
      var validatePayload = (payload) => {
        if (!payload)
          return;
        if (Object.values(payload).some((val) => typeof val === "function")) {
          throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
        }
      };
      var _invoke = async (functionKey, payload, metadata) => {
        if (typeof functionKey !== "string") {
          throw new errors_1.BridgeAPIError("functionKey must be a string!");
        }
        validatePayload(payload);
        return await callBridge("invoke", { functionKey, payload, metadata });
      };
      var limitedInvoke = (0, utils_1.withRateLimiter)(_invoke, 500, 1e3 * 25, "Resolver calls are rate limited at 500req/25s");
      function invoke2(functionKey, payload, metadata) {
        return limitedInvoke(functionKey, payload, metadata);
      }
      function makeInvoke() {
        return invoke2;
      }
    }
  });

  // node_modules/@forge/bridge/out/invoke/index.js
  var require_invoke2 = __commonJS({
    "node_modules/@forge/bridge/out/invoke/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_invoke(), exports);
    }
  });

  // node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js
  var require_invoke_endpoint = __commonJS({
    "node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.InvokeType = void 0;
      exports._invokeEndpointFn = _invokeEndpointFn;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var utils_1 = require_utils();
      var MAX_NUM_OPERATIONS = 500;
      var OPERATION_INTERVAL_SEC = 25;
      var OPERATION_INTERVAL_MS = 1e3 * OPERATION_INTERVAL_SEC;
      var InvokeType;
      (function(InvokeType2) {
        InvokeType2["REMOTE"] = "Remote";
        InvokeType2["SERVICE"] = "Container";
      })(InvokeType || (exports.InvokeType = InvokeType = {}));
      var callBridge = (0, bridge_1.getCallBridge)();
      var validatePayload = (payload) => {
        if (!payload)
          return;
        if (Object.values(payload).some((val) => typeof val === "function")) {
          throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
        }
      };
      var _setupInvokeEndpointFn = (invokeType) => async (input) => {
        validatePayload(input);
        const callBridgePayload = {
          ...input,
          invokeType: `ui-${invokeType.toLowerCase()}-fetch`
        };
        const bridgeResponse = await callBridge("invoke", callBridgePayload);
        const { success, payload, error } = bridgeResponse !== null && bridgeResponse !== void 0 ? bridgeResponse : {};
        const response = { ...success ? payload : error };
        if (response && response.headers) {
          for (const header in response.headers) {
            if (Array.isArray(response.headers[header])) {
              response.headers[header] = response.headers[header].join(",");
            }
          }
        }
        return response;
      };
      function _invokeEndpointFn(invokeType) {
        const invokeEndpointFn = _setupInvokeEndpointFn(invokeType);
        return (0, utils_1.withRateLimiter)(invokeEndpointFn, MAX_NUM_OPERATIONS, OPERATION_INTERVAL_MS, `${invokeType} invocation calls are rate limited at ${MAX_NUM_OPERATIONS}/${OPERATION_INTERVAL_SEC}s`);
      }
    }
  });

  // node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js
  var require_invoke_remote = __commonJS({
    "node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.invokeRemote = void 0;
      var invoke_endpoint_1 = require_invoke_endpoint();
      var invokeRemote = (input) => {
        const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.REMOTE);
        return invokeEndpoint(input);
      };
      exports.invokeRemote = invokeRemote;
    }
  });

  // node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js
  var require_invoke_service = __commonJS({
    "node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.invokeService = void 0;
      var invoke_endpoint_1 = require_invoke_endpoint();
      var invokeService = (input) => {
        const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.SERVICE);
        return invokeEndpoint(input);
      };
      exports.invokeService = invokeService;
    }
  });

  // node_modules/@forge/bridge/out/invoke-endpoint/index.js
  var require_invoke_endpoint2 = __commonJS({
    "node_modules/@forge/bridge/out/invoke-endpoint/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_invoke_remote(), exports);
      tslib_1.__exportStar(require_invoke_service(), exports);
    }
  });

  // node_modules/@forge/bridge/out/view/submit.js
  var require_submit = __commonJS({
    "node_modules/@forge/bridge/out/view/submit.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.submit = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var submit = async (payload) => {
        const success = await callBridge("submit", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not submittable.");
        }
      };
      exports.submit = submit;
    }
  });

  // node_modules/@forge/bridge/out/view/close.js
  var require_close = __commonJS({
    "node_modules/@forge/bridge/out/view/close.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.close = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var close = async (payload) => {
        try {
          const success = await callBridge("close", payload);
          if (success === false) {
            throw new errors_1.BridgeAPIError("this resource's view is not closable.");
          }
        } catch (e) {
          throw new errors_1.BridgeAPIError("this resource's view is not closable.");
        }
      };
      exports.close = close;
    }
  });

  // node_modules/@forge/bridge/out/view/open.js
  var require_open = __commonJS({
    "node_modules/@forge/bridge/out/view/open.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.open = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var open = async () => {
        try {
          const success = await callBridge("open");
          if (success === false) {
            throw new errors_1.BridgeAPIError("this resource's view is not openable.");
          }
        } catch (e) {
          throw new errors_1.BridgeAPIError("this resource's view is not openable.");
        }
      };
      exports.open = open;
    }
  });

  // node_modules/@forge/bridge/out/view/refresh.js
  var require_refresh = __commonJS({
    "node_modules/@forge/bridge/out/view/refresh.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.refresh = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var refresh = async (payload) => {
        const success = await callBridge("refresh", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not refreshable.");
        }
      };
      exports.refresh = refresh;
    }
  });

  // node_modules/@forge/bridge/out/view/createHistory.js
  var require_createHistory = __commonJS({
    "node_modules/@forge/bridge/out/view/createHistory.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createHistory = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var createHistory = async () => {
        const history = await callBridge("createHistory");
        history.listen((location) => {
          history.location = location;
        });
        return history;
      };
      exports.createHistory = createHistory;
    }
  });

  // node_modules/@forge/i18n/out/constants.js
  var require_constants = __commonJS({
    "node_modules/@forge/i18n/out/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FORGE_SUPPORTED_LOCALE_CODES = exports.I18N_BUNDLE_FOLDER_NAME = exports.I18N_INFO_FILE_NAME = void 0;
      exports.I18N_INFO_FILE_NAME = "i18n-info.json";
      exports.I18N_BUNDLE_FOLDER_NAME = "__LOCALES__";
      exports.FORGE_SUPPORTED_LOCALE_CODES = [
        "zh-CN",
        "zh-TW",
        "cs-CZ",
        "da-DK",
        "nl-NL",
        "en-US",
        "en-GB",
        "et-EE",
        "fi-FI",
        "fr-FR",
        "de-DE",
        "hu-HU",
        "is-IS",
        "it-IT",
        "ja-JP",
        "ko-KR",
        "no-NO",
        "pl-PL",
        "pt-BR",
        "pt-PT",
        "ro-RO",
        "ru-RU",
        "sk-SK",
        "tr-TR",
        "es-ES",
        "sv-SE"
      ];
    }
  });

  // node_modules/@forge/i18n/out/translationsGetter.js
  var require_translationsGetter = __commonJS({
    "node_modules/@forge/i18n/out/translationsGetter.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.TranslationsGetter = exports.TranslationGetterError = void 0;
      var pushIfNotExists = (array, item) => {
        if (!array.includes(item)) {
          array.push(item);
        }
      };
      var TranslationGetterError = class extends Error {
        constructor(message) {
          super(message);
          this.name = "TranslationGetterError";
        }
      };
      exports.TranslationGetterError = TranslationGetterError;
      var TranslationsGetter = class {
        constructor(resourcesAccessor) {
          __publicField(this, "resourcesAccessor");
          __publicField(this, "i18nInfoConfig", null);
          __publicField(this, "translationResources", /* @__PURE__ */ new Map());
          this.resourcesAccessor = resourcesAccessor;
        }
        async getTranslations(locale, options = { fallback: true }) {
          const i18nInfoConfig = await this.getI18nInfoConfig();
          const { fallback } = options;
          if (!fallback) {
            let translationResource;
            if (i18nInfoConfig.locales.includes(locale)) {
              translationResource = await this.getTranslationResource(locale);
            }
            return {
              translations: translationResource ?? null,
              locale
            };
          }
          for (const targetLocale of this.getLocaleLookupOrder(locale, i18nInfoConfig)) {
            const translationResource = await this.getTranslationResource(targetLocale);
            if (translationResource) {
              return {
                translations: translationResource,
                locale: targetLocale
              };
            }
          }
          return {
            translations: null,
            locale
          };
        }
        async getTranslationsByLocaleLookupOrder(locale) {
          const i18nInfoConfig = await this.getI18nInfoConfig();
          const lookupOrder = this.getLocaleLookupOrder(locale, i18nInfoConfig);
          return await Promise.all(lookupOrder.map(async (targetLocale) => {
            const translationResource = await this.getTranslationResource(targetLocale);
            return {
              locale: targetLocale,
              translations: translationResource
            };
          }));
        }
        reset() {
          this.i18nInfoConfig = null;
          this.translationResources.clear();
        }
        async getTranslationResource(locale) {
          let resource = this.translationResources.get(locale);
          if (!resource) {
            try {
              resource = await this.resourcesAccessor.getTranslationResource(locale);
              this.translationResources.set(locale, resource);
            } catch (error) {
              if (error instanceof TranslationGetterError) {
                throw error;
              }
              throw new TranslationGetterError(`Failed to get translation resource for locale: ${locale}`);
            }
          }
          return resource;
        }
        async getI18nInfoConfig() {
          if (!this.i18nInfoConfig) {
            try {
              this.i18nInfoConfig = await this.resourcesAccessor.getI18nInfoConfig();
            } catch (error) {
              if (error instanceof TranslationGetterError) {
                throw error;
              }
              throw new TranslationGetterError("Failed to get i18n info config");
            }
          }
          return this.i18nInfoConfig;
        }
        getLocaleLookupOrder(locale, config) {
          const { locales, fallback } = config;
          const lookupOrder = [locale];
          const fallbackLocales = fallback[locale];
          if (fallbackLocales && Array.isArray(fallbackLocales) && fallbackLocales.length > 0) {
            lookupOrder.push(...fallbackLocales);
          }
          pushIfNotExists(lookupOrder, config.fallback.default);
          return lookupOrder.filter((locale2) => locales.includes(locale2));
        }
      };
      exports.TranslationsGetter = TranslationsGetter;
    }
  });

  // node_modules/lodash/isArray.js
  var require_isArray = __commonJS({
    "node_modules/lodash/isArray.js"(exports, module) {
      var isArray = Array.isArray;
      module.exports = isArray;
    }
  });

  // node_modules/lodash/_freeGlobal.js
  var require_freeGlobal = __commonJS({
    "node_modules/lodash/_freeGlobal.js"(exports, module) {
      var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
      module.exports = freeGlobal;
    }
  });

  // node_modules/lodash/_root.js
  var require_root = __commonJS({
    "node_modules/lodash/_root.js"(exports, module) {
      var freeGlobal = require_freeGlobal();
      var freeSelf = typeof self == "object" && self && self.Object === Object && self;
      var root = freeGlobal || freeSelf || Function("return this")();
      module.exports = root;
    }
  });

  // node_modules/lodash/_Symbol.js
  var require_Symbol = __commonJS({
    "node_modules/lodash/_Symbol.js"(exports, module) {
      var root = require_root();
      var Symbol2 = root.Symbol;
      module.exports = Symbol2;
    }
  });

  // node_modules/lodash/_getRawTag.js
  var require_getRawTag = __commonJS({
    "node_modules/lodash/_getRawTag.js"(exports, module) {
      var Symbol2 = require_Symbol();
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var nativeObjectToString = objectProto.toString;
      var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
      function getRawTag(value) {
        var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
        try {
          value[symToStringTag] = void 0;
          var unmasked = true;
        } catch (e) {
        }
        var result = nativeObjectToString.call(value);
        if (unmasked) {
          if (isOwn) {
            value[symToStringTag] = tag;
          } else {
            delete value[symToStringTag];
          }
        }
        return result;
      }
      module.exports = getRawTag;
    }
  });

  // node_modules/lodash/_objectToString.js
  var require_objectToString = __commonJS({
    "node_modules/lodash/_objectToString.js"(exports, module) {
      var objectProto = Object.prototype;
      var nativeObjectToString = objectProto.toString;
      function objectToString(value) {
        return nativeObjectToString.call(value);
      }
      module.exports = objectToString;
    }
  });

  // node_modules/lodash/_baseGetTag.js
  var require_baseGetTag = __commonJS({
    "node_modules/lodash/_baseGetTag.js"(exports, module) {
      var Symbol2 = require_Symbol();
      var getRawTag = require_getRawTag();
      var objectToString = require_objectToString();
      var nullTag = "[object Null]";
      var undefinedTag = "[object Undefined]";
      var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
      function baseGetTag(value) {
        if (value == null) {
          return value === void 0 ? undefinedTag : nullTag;
        }
        return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
      }
      module.exports = baseGetTag;
    }
  });

  // node_modules/lodash/isObjectLike.js
  var require_isObjectLike = __commonJS({
    "node_modules/lodash/isObjectLike.js"(exports, module) {
      function isObjectLike(value) {
        return value != null && typeof value == "object";
      }
      module.exports = isObjectLike;
    }
  });

  // node_modules/lodash/isSymbol.js
  var require_isSymbol = __commonJS({
    "node_modules/lodash/isSymbol.js"(exports, module) {
      var baseGetTag = require_baseGetTag();
      var isObjectLike = require_isObjectLike();
      var symbolTag = "[object Symbol]";
      function isSymbol(value) {
        return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
      }
      module.exports = isSymbol;
    }
  });

  // node_modules/lodash/_isKey.js
  var require_isKey = __commonJS({
    "node_modules/lodash/_isKey.js"(exports, module) {
      var isArray = require_isArray();
      var isSymbol = require_isSymbol();
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
      var reIsPlainProp = /^\w*$/;
      function isKey(value, object) {
        if (isArray(value)) {
          return false;
        }
        var type = typeof value;
        if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
          return true;
        }
        return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
      }
      module.exports = isKey;
    }
  });

  // node_modules/lodash/isObject.js
  var require_isObject = __commonJS({
    "node_modules/lodash/isObject.js"(exports, module) {
      function isObject(value) {
        var type = typeof value;
        return value != null && (type == "object" || type == "function");
      }
      module.exports = isObject;
    }
  });

  // node_modules/lodash/isFunction.js
  var require_isFunction = __commonJS({
    "node_modules/lodash/isFunction.js"(exports, module) {
      var baseGetTag = require_baseGetTag();
      var isObject = require_isObject();
      var asyncTag = "[object AsyncFunction]";
      var funcTag = "[object Function]";
      var genTag = "[object GeneratorFunction]";
      var proxyTag = "[object Proxy]";
      function isFunction(value) {
        if (!isObject(value)) {
          return false;
        }
        var tag = baseGetTag(value);
        return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
      }
      module.exports = isFunction;
    }
  });

  // node_modules/lodash/_coreJsData.js
  var require_coreJsData = __commonJS({
    "node_modules/lodash/_coreJsData.js"(exports, module) {
      var root = require_root();
      var coreJsData = root["__core-js_shared__"];
      module.exports = coreJsData;
    }
  });

  // node_modules/lodash/_isMasked.js
  var require_isMasked = __commonJS({
    "node_modules/lodash/_isMasked.js"(exports, module) {
      var coreJsData = require_coreJsData();
      var maskSrcKey = (function() {
        var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
        return uid ? "Symbol(src)_1." + uid : "";
      })();
      function isMasked(func) {
        return !!maskSrcKey && maskSrcKey in func;
      }
      module.exports = isMasked;
    }
  });

  // node_modules/lodash/_toSource.js
  var require_toSource = __commonJS({
    "node_modules/lodash/_toSource.js"(exports, module) {
      var funcProto = Function.prototype;
      var funcToString = funcProto.toString;
      function toSource(func) {
        if (func != null) {
          try {
            return funcToString.call(func);
          } catch (e) {
          }
          try {
            return func + "";
          } catch (e) {
          }
        }
        return "";
      }
      module.exports = toSource;
    }
  });

  // node_modules/lodash/_baseIsNative.js
  var require_baseIsNative = __commonJS({
    "node_modules/lodash/_baseIsNative.js"(exports, module) {
      var isFunction = require_isFunction();
      var isMasked = require_isMasked();
      var isObject = require_isObject();
      var toSource = require_toSource();
      var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
      var reIsHostCtor = /^\[object .+?Constructor\]$/;
      var funcProto = Function.prototype;
      var objectProto = Object.prototype;
      var funcToString = funcProto.toString;
      var hasOwnProperty = objectProto.hasOwnProperty;
      var reIsNative = RegExp(
        "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
      );
      function baseIsNative(value) {
        if (!isObject(value) || isMasked(value)) {
          return false;
        }
        var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
        return pattern.test(toSource(value));
      }
      module.exports = baseIsNative;
    }
  });

  // node_modules/lodash/_getValue.js
  var require_getValue = __commonJS({
    "node_modules/lodash/_getValue.js"(exports, module) {
      function getValue(object, key) {
        return object == null ? void 0 : object[key];
      }
      module.exports = getValue;
    }
  });

  // node_modules/lodash/_getNative.js
  var require_getNative = __commonJS({
    "node_modules/lodash/_getNative.js"(exports, module) {
      var baseIsNative = require_baseIsNative();
      var getValue = require_getValue();
      function getNative(object, key) {
        var value = getValue(object, key);
        return baseIsNative(value) ? value : void 0;
      }
      module.exports = getNative;
    }
  });

  // node_modules/lodash/_nativeCreate.js
  var require_nativeCreate = __commonJS({
    "node_modules/lodash/_nativeCreate.js"(exports, module) {
      var getNative = require_getNative();
      var nativeCreate = getNative(Object, "create");
      module.exports = nativeCreate;
    }
  });

  // node_modules/lodash/_hashClear.js
  var require_hashClear = __commonJS({
    "node_modules/lodash/_hashClear.js"(exports, module) {
      var nativeCreate = require_nativeCreate();
      function hashClear() {
        this.__data__ = nativeCreate ? nativeCreate(null) : {};
        this.size = 0;
      }
      module.exports = hashClear;
    }
  });

  // node_modules/lodash/_hashDelete.js
  var require_hashDelete = __commonJS({
    "node_modules/lodash/_hashDelete.js"(exports, module) {
      function hashDelete(key) {
        var result = this.has(key) && delete this.__data__[key];
        this.size -= result ? 1 : 0;
        return result;
      }
      module.exports = hashDelete;
    }
  });

  // node_modules/lodash/_hashGet.js
  var require_hashGet = __commonJS({
    "node_modules/lodash/_hashGet.js"(exports, module) {
      var nativeCreate = require_nativeCreate();
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function hashGet(key) {
        var data = this.__data__;
        if (nativeCreate) {
          var result = data[key];
          return result === HASH_UNDEFINED ? void 0 : result;
        }
        return hasOwnProperty.call(data, key) ? data[key] : void 0;
      }
      module.exports = hashGet;
    }
  });

  // node_modules/lodash/_hashHas.js
  var require_hashHas = __commonJS({
    "node_modules/lodash/_hashHas.js"(exports, module) {
      var nativeCreate = require_nativeCreate();
      var objectProto = Object.prototype;
      var hasOwnProperty = objectProto.hasOwnProperty;
      function hashHas(key) {
        var data = this.__data__;
        return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
      }
      module.exports = hashHas;
    }
  });

  // node_modules/lodash/_hashSet.js
  var require_hashSet = __commonJS({
    "node_modules/lodash/_hashSet.js"(exports, module) {
      var nativeCreate = require_nativeCreate();
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      function hashSet(key, value) {
        var data = this.__data__;
        this.size += this.has(key) ? 0 : 1;
        data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
        return this;
      }
      module.exports = hashSet;
    }
  });

  // node_modules/lodash/_Hash.js
  var require_Hash = __commonJS({
    "node_modules/lodash/_Hash.js"(exports, module) {
      var hashClear = require_hashClear();
      var hashDelete = require_hashDelete();
      var hashGet = require_hashGet();
      var hashHas = require_hashHas();
      var hashSet = require_hashSet();
      function Hash(entries2) {
        var index = -1, length = entries2 == null ? 0 : entries2.length;
        this.clear();
        while (++index < length) {
          var entry = entries2[index];
          this.set(entry[0], entry[1]);
        }
      }
      Hash.prototype.clear = hashClear;
      Hash.prototype["delete"] = hashDelete;
      Hash.prototype.get = hashGet;
      Hash.prototype.has = hashHas;
      Hash.prototype.set = hashSet;
      module.exports = Hash;
    }
  });

  // node_modules/lodash/_listCacheClear.js
  var require_listCacheClear = __commonJS({
    "node_modules/lodash/_listCacheClear.js"(exports, module) {
      function listCacheClear() {
        this.__data__ = [];
        this.size = 0;
      }
      module.exports = listCacheClear;
    }
  });

  // node_modules/lodash/eq.js
  var require_eq = __commonJS({
    "node_modules/lodash/eq.js"(exports, module) {
      function eq(value, other) {
        return value === other || value !== value && other !== other;
      }
      module.exports = eq;
    }
  });

  // node_modules/lodash/_assocIndexOf.js
  var require_assocIndexOf = __commonJS({
    "node_modules/lodash/_assocIndexOf.js"(exports, module) {
      var eq = require_eq();
      function assocIndexOf(array, key) {
        var length = array.length;
        while (length--) {
          if (eq(array[length][0], key)) {
            return length;
          }
        }
        return -1;
      }
      module.exports = assocIndexOf;
    }
  });

  // node_modules/lodash/_listCacheDelete.js
  var require_listCacheDelete = __commonJS({
    "node_modules/lodash/_listCacheDelete.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      var arrayProto = Array.prototype;
      var splice = arrayProto.splice;
      function listCacheDelete(key) {
        var data = this.__data__, index = assocIndexOf(data, key);
        if (index < 0) {
          return false;
        }
        var lastIndex = data.length - 1;
        if (index == lastIndex) {
          data.pop();
        } else {
          splice.call(data, index, 1);
        }
        --this.size;
        return true;
      }
      module.exports = listCacheDelete;
    }
  });

  // node_modules/lodash/_listCacheGet.js
  var require_listCacheGet = __commonJS({
    "node_modules/lodash/_listCacheGet.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      function listCacheGet(key) {
        var data = this.__data__, index = assocIndexOf(data, key);
        return index < 0 ? void 0 : data[index][1];
      }
      module.exports = listCacheGet;
    }
  });

  // node_modules/lodash/_listCacheHas.js
  var require_listCacheHas = __commonJS({
    "node_modules/lodash/_listCacheHas.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      function listCacheHas(key) {
        return assocIndexOf(this.__data__, key) > -1;
      }
      module.exports = listCacheHas;
    }
  });

  // node_modules/lodash/_listCacheSet.js
  var require_listCacheSet = __commonJS({
    "node_modules/lodash/_listCacheSet.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      function listCacheSet(key, value) {
        var data = this.__data__, index = assocIndexOf(data, key);
        if (index < 0) {
          ++this.size;
          data.push([key, value]);
        } else {
          data[index][1] = value;
        }
        return this;
      }
      module.exports = listCacheSet;
    }
  });

  // node_modules/lodash/_ListCache.js
  var require_ListCache = __commonJS({
    "node_modules/lodash/_ListCache.js"(exports, module) {
      var listCacheClear = require_listCacheClear();
      var listCacheDelete = require_listCacheDelete();
      var listCacheGet = require_listCacheGet();
      var listCacheHas = require_listCacheHas();
      var listCacheSet = require_listCacheSet();
      function ListCache(entries2) {
        var index = -1, length = entries2 == null ? 0 : entries2.length;
        this.clear();
        while (++index < length) {
          var entry = entries2[index];
          this.set(entry[0], entry[1]);
        }
      }
      ListCache.prototype.clear = listCacheClear;
      ListCache.prototype["delete"] = listCacheDelete;
      ListCache.prototype.get = listCacheGet;
      ListCache.prototype.has = listCacheHas;
      ListCache.prototype.set = listCacheSet;
      module.exports = ListCache;
    }
  });

  // node_modules/lodash/_Map.js
  var require_Map = __commonJS({
    "node_modules/lodash/_Map.js"(exports, module) {
      var getNative = require_getNative();
      var root = require_root();
      var Map2 = getNative(root, "Map");
      module.exports = Map2;
    }
  });

  // node_modules/lodash/_mapCacheClear.js
  var require_mapCacheClear = __commonJS({
    "node_modules/lodash/_mapCacheClear.js"(exports, module) {
      var Hash = require_Hash();
      var ListCache = require_ListCache();
      var Map2 = require_Map();
      function mapCacheClear() {
        this.size = 0;
        this.__data__ = {
          "hash": new Hash(),
          "map": new (Map2 || ListCache)(),
          "string": new Hash()
        };
      }
      module.exports = mapCacheClear;
    }
  });

  // node_modules/lodash/_isKeyable.js
  var require_isKeyable = __commonJS({
    "node_modules/lodash/_isKeyable.js"(exports, module) {
      function isKeyable(value) {
        var type = typeof value;
        return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
      }
      module.exports = isKeyable;
    }
  });

  // node_modules/lodash/_getMapData.js
  var require_getMapData = __commonJS({
    "node_modules/lodash/_getMapData.js"(exports, module) {
      var isKeyable = require_isKeyable();
      function getMapData(map, key) {
        var data = map.__data__;
        return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
      }
      module.exports = getMapData;
    }
  });

  // node_modules/lodash/_mapCacheDelete.js
  var require_mapCacheDelete = __commonJS({
    "node_modules/lodash/_mapCacheDelete.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheDelete(key) {
        var result = getMapData(this, key)["delete"](key);
        this.size -= result ? 1 : 0;
        return result;
      }
      module.exports = mapCacheDelete;
    }
  });

  // node_modules/lodash/_mapCacheGet.js
  var require_mapCacheGet = __commonJS({
    "node_modules/lodash/_mapCacheGet.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheGet(key) {
        return getMapData(this, key).get(key);
      }
      module.exports = mapCacheGet;
    }
  });

  // node_modules/lodash/_mapCacheHas.js
  var require_mapCacheHas = __commonJS({
    "node_modules/lodash/_mapCacheHas.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheHas(key) {
        return getMapData(this, key).has(key);
      }
      module.exports = mapCacheHas;
    }
  });

  // node_modules/lodash/_mapCacheSet.js
  var require_mapCacheSet = __commonJS({
    "node_modules/lodash/_mapCacheSet.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheSet(key, value) {
        var data = getMapData(this, key), size = data.size;
        data.set(key, value);
        this.size += data.size == size ? 0 : 1;
        return this;
      }
      module.exports = mapCacheSet;
    }
  });

  // node_modules/lodash/_MapCache.js
  var require_MapCache = __commonJS({
    "node_modules/lodash/_MapCache.js"(exports, module) {
      var mapCacheClear = require_mapCacheClear();
      var mapCacheDelete = require_mapCacheDelete();
      var mapCacheGet = require_mapCacheGet();
      var mapCacheHas = require_mapCacheHas();
      var mapCacheSet = require_mapCacheSet();
      function MapCache(entries2) {
        var index = -1, length = entries2 == null ? 0 : entries2.length;
        this.clear();
        while (++index < length) {
          var entry = entries2[index];
          this.set(entry[0], entry[1]);
        }
      }
      MapCache.prototype.clear = mapCacheClear;
      MapCache.prototype["delete"] = mapCacheDelete;
      MapCache.prototype.get = mapCacheGet;
      MapCache.prototype.has = mapCacheHas;
      MapCache.prototype.set = mapCacheSet;
      module.exports = MapCache;
    }
  });

  // node_modules/lodash/memoize.js
  var require_memoize = __commonJS({
    "node_modules/lodash/memoize.js"(exports, module) {
      var MapCache = require_MapCache();
      var FUNC_ERROR_TEXT = "Expected a function";
      function memoize(func, resolver) {
        if (typeof func != "function" || resolver != null && typeof resolver != "function") {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        var memoized = function() {
          var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
          if (cache.has(key)) {
            return cache.get(key);
          }
          var result = func.apply(this, args);
          memoized.cache = cache.set(key, result) || cache;
          return result;
        };
        memoized.cache = new (memoize.Cache || MapCache)();
        return memoized;
      }
      memoize.Cache = MapCache;
      module.exports = memoize;
    }
  });

  // node_modules/lodash/_memoizeCapped.js
  var require_memoizeCapped = __commonJS({
    "node_modules/lodash/_memoizeCapped.js"(exports, module) {
      var memoize = require_memoize();
      var MAX_MEMOIZE_SIZE = 500;
      function memoizeCapped(func) {
        var result = memoize(func, function(key) {
          if (cache.size === MAX_MEMOIZE_SIZE) {
            cache.clear();
          }
          return key;
        });
        var cache = result.cache;
        return result;
      }
      module.exports = memoizeCapped;
    }
  });

  // node_modules/lodash/_stringToPath.js
  var require_stringToPath = __commonJS({
    "node_modules/lodash/_stringToPath.js"(exports, module) {
      var memoizeCapped = require_memoizeCapped();
      var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
      var reEscapeChar = /\\(\\)?/g;
      var stringToPath = memoizeCapped(function(string) {
        var result = [];
        if (string.charCodeAt(0) === 46) {
          result.push("");
        }
        string.replace(rePropName, function(match, number, quote, subString) {
          result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
        });
        return result;
      });
      module.exports = stringToPath;
    }
  });

  // node_modules/lodash/_arrayMap.js
  var require_arrayMap = __commonJS({
    "node_modules/lodash/_arrayMap.js"(exports, module) {
      function arrayMap(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length, result = Array(length);
        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }
      module.exports = arrayMap;
    }
  });

  // node_modules/lodash/_baseToString.js
  var require_baseToString = __commonJS({
    "node_modules/lodash/_baseToString.js"(exports, module) {
      var Symbol2 = require_Symbol();
      var arrayMap = require_arrayMap();
      var isArray = require_isArray();
      var isSymbol = require_isSymbol();
      var INFINITY = 1 / 0;
      var symbolProto = Symbol2 ? Symbol2.prototype : void 0;
      var symbolToString = symbolProto ? symbolProto.toString : void 0;
      function baseToString(value) {
        if (typeof value == "string") {
          return value;
        }
        if (isArray(value)) {
          return arrayMap(value, baseToString) + "";
        }
        if (isSymbol(value)) {
          return symbolToString ? symbolToString.call(value) : "";
        }
        var result = value + "";
        return result == "0" && 1 / value == -INFINITY ? "-0" : result;
      }
      module.exports = baseToString;
    }
  });

  // node_modules/lodash/toString.js
  var require_toString = __commonJS({
    "node_modules/lodash/toString.js"(exports, module) {
      var baseToString = require_baseToString();
      function toString(value) {
        return value == null ? "" : baseToString(value);
      }
      module.exports = toString;
    }
  });

  // node_modules/lodash/_castPath.js
  var require_castPath = __commonJS({
    "node_modules/lodash/_castPath.js"(exports, module) {
      var isArray = require_isArray();
      var isKey = require_isKey();
      var stringToPath = require_stringToPath();
      var toString = require_toString();
      function castPath(value, object) {
        if (isArray(value)) {
          return value;
        }
        return isKey(value, object) ? [value] : stringToPath(toString(value));
      }
      module.exports = castPath;
    }
  });

  // node_modules/lodash/_toKey.js
  var require_toKey = __commonJS({
    "node_modules/lodash/_toKey.js"(exports, module) {
      var isSymbol = require_isSymbol();
      var INFINITY = 1 / 0;
      function toKey(value) {
        if (typeof value == "string" || isSymbol(value)) {
          return value;
        }
        var result = value + "";
        return result == "0" && 1 / value == -INFINITY ? "-0" : result;
      }
      module.exports = toKey;
    }
  });

  // node_modules/lodash/_baseGet.js
  var require_baseGet = __commonJS({
    "node_modules/lodash/_baseGet.js"(exports, module) {
      var castPath = require_castPath();
      var toKey = require_toKey();
      function baseGet(object, path) {
        path = castPath(path, object);
        var index = 0, length = path.length;
        while (object != null && index < length) {
          object = object[toKey(path[index++])];
        }
        return index && index == length ? object : void 0;
      }
      module.exports = baseGet;
    }
  });

  // node_modules/lodash/get.js
  var require_get = __commonJS({
    "node_modules/lodash/get.js"(exports, module) {
      var baseGet = require_baseGet();
      function get(object, path, defaultValue) {
        var result = object == null ? void 0 : baseGet(object, path);
        return result === void 0 ? defaultValue : result;
      }
      module.exports = get;
    }
  });

  // node_modules/@forge/i18n/out/translationValueGetter.js
  var require_translationValueGetter = __commonJS({
    "node_modules/@forge/i18n/out/translationValueGetter.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getTranslationValueFromContent = exports.getTranslationValue = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var get_1 = tslib_1.__importDefault(require_get());
      var getTranslationValue = (translationLookup, i18nKey, locale) => {
        const translation = translationLookup[locale];
        if (!translation) {
          return null;
        }
        return (0, exports.getTranslationValueFromContent)(translation, i18nKey);
      };
      exports.getTranslationValue = getTranslationValue;
      var getTranslationValueFromContent = (translationContent, i18nKey) => {
        let translationValue = translationContent[i18nKey];
        if (!translationValue) {
          const keyTokens = i18nKey.split(".");
          if (keyTokens.length > 1) {
            translationValue = (0, get_1.default)(translationContent, keyTokens, null);
          }
        }
        return typeof translationValue === "string" ? translationValue : null;
      };
      exports.getTranslationValueFromContent = getTranslationValueFromContent;
    }
  });

  // node_modules/@forge/i18n/out/translator.js
  var require_translator = __commonJS({
    "node_modules/@forge/i18n/out/translator.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Translator = void 0;
      var translationValueGetter_1 = require_translationValueGetter();
      var Translator = class {
        constructor(locale, translationsGetter) {
          __publicField(this, "locale");
          __publicField(this, "translationsGetter");
          __publicField(this, "localeLookupOrderedTranslations", null);
          __publicField(this, "cache", /* @__PURE__ */ new Map());
          this.locale = locale;
          this.translationsGetter = translationsGetter;
        }
        async init() {
          this.localeLookupOrderedTranslations = await this.translationsGetter.getTranslationsByLocaleLookupOrder(this.locale);
        }
        translate(i18nKey) {
          if (!this.localeLookupOrderedTranslations) {
            throw new Error("TranslationLookup not initialized");
          }
          let result = this.cache.get(i18nKey);
          if (result === void 0) {
            for (const { translations } of this.localeLookupOrderedTranslations) {
              const translationValue = (0, translationValueGetter_1.getTranslationValueFromContent)(translations, i18nKey);
              if (translationValue !== null) {
                result = translationValue;
                break;
              }
            }
            result = result ?? null;
            this.cache.set(i18nKey, result);
          }
          return result;
        }
      };
      exports.Translator = Translator;
    }
  });

  // node_modules/@forge/i18n/out/ensureLocale.js
  var require_ensureLocale = __commonJS({
    "node_modules/@forge/i18n/out/ensureLocale.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ensureLocale = void 0;
      var constants_1 = require_constants();
      var forgeSupportedLocaleCodesSet = new Set(constants_1.FORGE_SUPPORTED_LOCALE_CODES);
      var localeFallbacks = {
        "en-UK": "en-GB",
        "nb-NO": "no-NO"
      };
      var languageToLocaleCodeMap = constants_1.FORGE_SUPPORTED_LOCALE_CODES.reduce((agg, code) => {
        const [lng] = code.split("-");
        if (!agg[lng]) {
          agg[lng] = code;
        }
        return agg;
      }, {
        nb: "no-NO",
        pt: "pt-PT"
      });
      var ensureLocale = (rawLocale) => {
        const locale = rawLocale.replace("_", "-");
        if (forgeSupportedLocaleCodesSet.has(locale)) {
          return locale;
        }
        return languageToLocaleCodeMap[locale] ?? localeFallbacks[locale] ?? null;
      };
      exports.ensureLocale = ensureLocale;
    }
  });

  // node_modules/@forge/i18n/out/moduleI18nHelper.js
  var require_moduleI18nHelper = __commonJS({
    "node_modules/@forge/i18n/out/moduleI18nHelper.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getI18nSupportedModuleEntries = void 0;
      var isObject = (value) => {
        return typeof value === "object" && value !== null && !Array.isArray(value);
      };
      var isI18nValue = (value) => {
        return typeof value?.i18n === "string";
      };
      var isConnectModuleKey = (moduleKey) => moduleKey.startsWith("connect-");
      var isCoreModuleKey = (moduleKey) => moduleKey.startsWith("core:");
      var getI18nKeysFromObject = (obj) => {
        const visited = /* @__PURE__ */ new Set();
        const visit = (value, i18nPath) => {
          if (!isObject(value) || visited.has(value)) {
            return [];
          }
          visited.add(value);
          return Object.entries(value).flatMap(([propKey, propValue]) => {
            const currentPath = [...i18nPath, propKey];
            if (isI18nValue(propValue)) {
              return [{ propertyPath: currentPath, key: propValue.i18n }];
            } else if (Array.isArray(propValue)) {
              return propValue.flatMap((item) => visit(item, currentPath));
            }
            return visit(propValue, currentPath);
          });
        };
        return visit(obj, []);
      };
      var getI18nSupportedModuleEntries = (modules) => {
        return Object.entries(modules).flatMap(([moduleKey, moduleEntries]) => {
          if (!isConnectModuleKey(moduleKey) && !isCoreModuleKey(moduleKey) && moduleEntries && Array.isArray(moduleEntries) && moduleEntries.length > 0) {
            return moduleEntries.map((moduleEntry) => [moduleEntry, moduleKey]);
          }
          return [];
        });
      };
      exports.getI18nSupportedModuleEntries = getI18nSupportedModuleEntries;
      var extractI18nKeysFromModules = (modules) => {
        const i18nKeys = /* @__PURE__ */ new Set();
        for (const moduleEntry of (0, exports.getI18nSupportedModuleEntries)(modules)) {
          const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
          for (const { key } of i18nKeysForEntryValue) {
            i18nKeys.add(key);
          }
        }
        return i18nKeys.size > 0 ? Array.from(i18nKeys) : [];
      };
      exports.extractI18nKeysFromModules = extractI18nKeysFromModules;
      var extractI18nPropertiesFromModules = (modules) => {
        const moduleI18nProperties = [];
        for (const moduleEntry of (0, exports.getI18nSupportedModuleEntries)(modules)) {
          const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
          for (const i18nObj of i18nKeysForEntryValue) {
            moduleI18nProperties.push({ moduleName: moduleEntry[1], ...i18nObj });
          }
        }
        return moduleI18nProperties;
      };
      exports.extractI18nPropertiesFromModules = extractI18nPropertiesFromModules;
    }
  });

  // node_modules/@forge/i18n/out/types.js
  var require_types = __commonJS({
    "node_modules/@forge/i18n/out/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@forge/i18n/out/index.js
  var require_out = __commonJS({
    "node_modules/@forge/i18n/out/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getI18nSupportedModuleEntries = exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getTranslationValue = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_constants(), exports);
      tslib_1.__exportStar(require_translationsGetter(), exports);
      tslib_1.__exportStar(require_translator(), exports);
      tslib_1.__exportStar(require_ensureLocale(), exports);
      var translationValueGetter_1 = require_translationValueGetter();
      Object.defineProperty(exports, "getTranslationValue", { enumerable: true, get: function() {
        return translationValueGetter_1.getTranslationValue;
      } });
      var moduleI18nHelper_1 = require_moduleI18nHelper();
      Object.defineProperty(exports, "extractI18nKeysFromModules", { enumerable: true, get: function() {
        return moduleI18nHelper_1.extractI18nKeysFromModules;
      } });
      Object.defineProperty(exports, "extractI18nPropertiesFromModules", { enumerable: true, get: function() {
        return moduleI18nHelper_1.extractI18nPropertiesFromModules;
      } });
      Object.defineProperty(exports, "getI18nSupportedModuleEntries", { enumerable: true, get: function() {
        return moduleI18nHelper_1.getI18nSupportedModuleEntries;
      } });
      tslib_1.__exportStar(require_types(), exports);
    }
  });

  // node_modules/@forge/bridge/out/view/getContext.js
  var require_getContext = __commonJS({
    "node_modules/@forge/bridge/out/view/getContext.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getContext = void 0;
      var bridge_1 = require_bridge();
      var i18n_1 = require_out();
      var callBridge = (0, bridge_1.getCallBridge)();
      var getContext = async () => {
        var _a;
        const context = await callBridge("getContext");
        const locale = context === null || context === void 0 ? void 0 : context.locale;
        if (locale) {
          context.locale = (_a = (0, i18n_1.ensureLocale)(locale)) !== null && _a !== void 0 ? _a : locale;
        }
        return context;
      };
      exports.getContext = getContext;
    }
  });

  // node_modules/@forge/bridge/out/view/changeWindowTitle.js
  var require_changeWindowTitle = __commonJS({
    "node_modules/@forge/bridge/out/view/changeWindowTitle.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.changeWindowTitle = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var changeWindowTitle = async (title) => {
        try {
          await callBridge("changeWindowTitle", title);
        } catch (e) {
          throw new errors_1.BridgeAPIError("the window title wasn't changed due to error.");
        }
      };
      exports.changeWindowTitle = changeWindowTitle;
    }
  });

  // node_modules/@forge/bridge/out/view/theme.js
  var require_theme = __commonJS({
    "node_modules/@forge/bridge/out/view/theme.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.theme = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      exports.theme = {
        enable: () => callBridge("enableTheming")
      };
    }
  });

  // node_modules/@forge/bridge/out/utils/blobParser.js
  var require_blobParser = __commonJS({
    "node_modules/@forge/bridge/out/utils/blobParser.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.blobToBase64 = exports.base64ToBlob = void 0;
      var base64ToBlob = (b64string, mimeType) => {
        if (!b64string) {
          return null;
        }
        const base64Data = b64string.includes(";base64") ? b64string.split(",")[1] : b64string;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      };
      exports.base64ToBlob = base64ToBlob;
      var blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      exports.blobToBase64 = blobToBase64;
    }
  });

  // node_modules/@forge/bridge/out/events/serialiseBlob.js
  var require_serialiseBlob = __commonJS({
    "node_modules/@forge/bridge/out/events/serialiseBlob.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.containsSerialisedBlobs = exports.containsBlobs = exports.deserialiseBlobsInPayload = exports.serialiseBlobsInPayload = void 0;
      var blobParser_1 = require_blobParser();
      var isPlainObject = (value) => {
        if (typeof value !== "object" || value === null)
          return false;
        if (Object.prototype.toString.call(value) !== "[object Object]")
          return false;
        const proto = Object.getPrototypeOf(value);
        if (proto === null)
          return true;
        const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
        return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
      };
      var blobToBase64WithMetadata = async (blob) => {
        const base64Data = await (0, blobParser_1.blobToBase64)(blob);
        return {
          data: base64Data,
          type: blob.type
        };
      };
      var base64WithMetadataToBlob = (metadata) => {
        return (0, blobParser_1.base64ToBlob)(metadata.data, metadata.type);
      };
      var serialiseBlobsInPayload = async (payload) => {
        if (payload instanceof Blob) {
          const blobData = await blobToBase64WithMetadata(payload);
          return {
            ...blobData,
            // Custom property used to identify serialized blob data for deserialization
            __isBlobData: true
          };
        }
        if (Array.isArray(payload)) {
          return Promise.all(payload.map((item) => (0, exports.serialiseBlobsInPayload)(item)));
        }
        if (payload && isPlainObject(payload)) {
          const entries2 = await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await (0, exports.serialiseBlobsInPayload)(value)]));
          return Object.fromEntries(entries2);
        }
        return payload;
      };
      exports.serialiseBlobsInPayload = serialiseBlobsInPayload;
      var deserialiseBlobsInPayload = (payload) => {
        if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
          const typedData = payload;
          return base64WithMetadataToBlob({
            data: typedData.data,
            type: typedData.type
          });
        }
        if (Array.isArray(payload)) {
          return payload.map((item) => (0, exports.deserialiseBlobsInPayload)(item));
        }
        if (payload && isPlainObject(payload)) {
          const result = {};
          for (const [key, value] of Object.entries(payload)) {
            result[key] = (0, exports.deserialiseBlobsInPayload)(value);
          }
          return result;
        }
        return payload;
      };
      exports.deserialiseBlobsInPayload = deserialiseBlobsInPayload;
      var containsBlobs = (payload) => {
        if (payload instanceof Blob) {
          return true;
        }
        if (Array.isArray(payload)) {
          return payload.some((item) => (0, exports.containsBlobs)(item));
        }
        if (payload && isPlainObject(payload)) {
          return Object.values(payload).some((value) => (0, exports.containsBlobs)(value));
        }
        return false;
      };
      exports.containsBlobs = containsBlobs;
      var containsSerialisedBlobs = (payload) => {
        if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
          return true;
        }
        if (Array.isArray(payload)) {
          return payload.some((item) => (0, exports.containsSerialisedBlobs)(item));
        }
        if (payload && isPlainObject(payload)) {
          return Object.values(payload).some((value) => (0, exports.containsSerialisedBlobs)(value));
        }
        return false;
      };
      exports.containsSerialisedBlobs = containsSerialisedBlobs;
    }
  });

  // node_modules/@forge/bridge/out/events/events.js
  var require_events = __commonJS({
    "node_modules/@forge/bridge/out/events/events.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.events = void 0;
      var bridge_1 = require_bridge();
      var serialiseBlob_1 = require_serialiseBlob();
      var callBridge = (0, bridge_1.getCallBridge)();
      var wrapCallback = (callback) => {
        return (payload) => {
          let newPayload = payload;
          if ((0, serialiseBlob_1.containsSerialisedBlobs)(payload)) {
            newPayload = (0, serialiseBlob_1.deserialiseBlobsInPayload)(payload);
          }
          return callback(newPayload);
        };
      };
      var emit = async (event, payload) => {
        let newPayload = payload;
        if ((0, serialiseBlob_1.containsBlobs)(payload)) {
          newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
        }
        return callBridge("emit", { event, payload: newPayload });
      };
      var on = (event, callback) => {
        return callBridge("on", { event, callback: wrapCallback(callback) });
      };
      var emitPublic = async (event, payload) => {
        let newPayload = payload;
        if ((0, serialiseBlob_1.containsBlobs)(payload)) {
          newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
        }
        return callBridge("emitPublic", { event, payload: newPayload });
      };
      var onPublic = (event, callback) => {
        return callBridge("onPublic", { event, callback: wrapCallback(callback) });
      };
      exports.events = {
        emit,
        on,
        emitPublic,
        onPublic
      };
    }
  });

  // node_modules/@forge/bridge/out/view/emitReadyEvent.js
  var require_emitReadyEvent = __commonJS({
    "node_modules/@forge/bridge/out/view/emitReadyEvent.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.emitReadyEvent = void 0;
      var events_1 = require_events();
      var view_1 = require_view();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var EXTENSION_READY = "EXTENSION_READY";
      var emitReadyEvent = async () => {
        const context = await view_1.view.getContext();
        await events_1.events.emit(EXTENSION_READY, {
          localId: context.localId
        });
        try {
          await callBridge("emitReadyEvent");
        } catch {
        }
      };
      exports.emitReadyEvent = emitReadyEvent;
    }
  });

  // node_modules/iframe-resizer/js/iframeResizer.js
  var require_iframeResizer = __commonJS({
    "node_modules/iframe-resizer/js/iframeResizer.js"(exports, module) {
      console.info(`
IFRAME-RESIZER

Iframe-Resizer 5 is now available via the following two packages:

 * @iframe-resizer/parent
 * @iframe-resizer/child

Additionally their are also new versions of iframe-resizer for React, Vue, and jQuery.

Version 5 of iframe-resizer has been extensively rewritten to use modern browser APIs, which has enabled significantly better performance and greater accuracy in the detection of content resizing events.

Please see https://iframe-resizer.com/upgrade for more details.
`);
      (function(undefined2) {
        if (typeof window === "undefined") return;
        var count = 0, destroyObserver, logEnabled = false, hiddenCheckEnabled = false, msgHeader = "message", msgHeaderLen = msgHeader.length, msgId = "[iFrameSizer]", msgIdLen = msgId.length, pagePosition = null, requestAnimationFrame2 = window.requestAnimationFrame, resetRequiredMethods = Object.freeze({
          max: 1,
          scroll: 1,
          bodyScroll: 1,
          documentElementScroll: 1
        }), settings = {}, timer = null, defaults = Object.freeze({
          autoResize: true,
          bodyBackground: null,
          bodyMargin: null,
          bodyMarginV1: 8,
          bodyPadding: null,
          checkOrigin: true,
          inPageLinks: false,
          enablePublicMethods: true,
          heightCalculationMethod: "bodyOffset",
          id: "iFrameResizer",
          interval: 32,
          license: "1jqr0si6pnt",
          log: false,
          maxHeight: Infinity,
          maxWidth: Infinity,
          minHeight: 0,
          minWidth: 0,
          mouseEvents: true,
          resizeFrom: "parent",
          scrolling: false,
          sizeHeight: true,
          sizeWidth: false,
          warningTimeout: 5e3,
          tolerance: 0,
          widthCalculationMethod: "scroll",
          onClose: function() {
            return true;
          },
          onClosed: function() {
          },
          onInit: function() {
          },
          onMessage: function() {
            warn("onMessage function not defined");
          },
          onMouseEnter: function() {
          },
          onMouseLeave: function() {
          },
          onResized: function() {
          },
          onScroll: function() {
            return true;
          }
        });
        function getMutationObserver() {
          return window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        }
        function addEventListener(el3, evt, func) {
          el3.addEventListener(evt, func, false);
        }
        function removeEventListener(el3, evt, func) {
          el3.removeEventListener(evt, func, false);
        }
        function setupRequestAnimationFrame() {
          var vendors = ["moz", "webkit", "o", "ms"];
          var x;
          for (x = 0; x < vendors.length && !requestAnimationFrame2; x += 1) {
            requestAnimationFrame2 = window[vendors[x] + "RequestAnimationFrame"];
          }
          if (requestAnimationFrame2) {
            requestAnimationFrame2 = requestAnimationFrame2.bind(window);
          } else {
            log("setup", "RequestAnimationFrame not supported");
          }
        }
        function getMyID(iframeId) {
          var retStr = "Host page: " + iframeId;
          if (window.top !== window.self) {
            retStr = window.parentIFrame && window.parentIFrame.getId ? window.parentIFrame.getId() + ": " + iframeId : "Nested host page: " + iframeId;
          }
          return retStr;
        }
        function formatLogHeader(iframeId) {
          return msgId + "[" + getMyID(iframeId) + "]";
        }
        function isLogEnabled(iframeId) {
          return settings[iframeId] ? settings[iframeId].log : logEnabled;
        }
        function log(iframeId, msg) {
          output("log", iframeId, msg, isLogEnabled(iframeId));
        }
        function info(iframeId, msg) {
          output("info", iframeId, msg, isLogEnabled(iframeId));
        }
        function warn(iframeId, msg) {
          output("warn", iframeId, msg, true);
        }
        function output(type, iframeId, msg, enabled) {
          if (true === enabled && "object" === typeof window.console) {
            console[type](formatLogHeader(iframeId), msg);
          }
        }
        function iFrameListener(event) {
          function resizeIFrame() {
            function resize() {
              setSize(messageData);
              setPagePosition(iframeId);
              on("onResized", messageData);
            }
            ensureInRange("Height");
            ensureInRange("Width");
            syncResize(resize, messageData, "init");
          }
          function processMsg() {
            var data = msg.slice(msgIdLen).split(":");
            var height = data[1] ? parseInt(data[1], 10) : 0;
            var iframe = settings[data[0]] && settings[data[0]].iframe;
            var compStyle = getComputedStyle(iframe);
            return {
              iframe,
              id: data[0],
              height: height + getPaddingEnds(compStyle) + getBorderEnds(compStyle),
              width: data[2],
              type: data[3]
            };
          }
          function getPaddingEnds(compStyle) {
            if (compStyle.boxSizing !== "border-box") {
              return 0;
            }
            var top = compStyle.paddingTop ? parseInt(compStyle.paddingTop, 10) : 0;
            var bot = compStyle.paddingBottom ? parseInt(compStyle.paddingBottom, 10) : 0;
            return top + bot;
          }
          function getBorderEnds(compStyle) {
            if (compStyle.boxSizing !== "border-box") {
              return 0;
            }
            var top = compStyle.borderTopWidth ? parseInt(compStyle.borderTopWidth, 10) : 0;
            var bot = compStyle.borderBottomWidth ? parseInt(compStyle.borderBottomWidth, 10) : 0;
            return top + bot;
          }
          function ensureInRange(Dimension) {
            var max = Number(settings[iframeId]["max" + Dimension]), min = Number(settings[iframeId]["min" + Dimension]), dimension = Dimension.toLowerCase(), size = Number(messageData[dimension]);
            log(iframeId, "Checking " + dimension + " is in range " + min + "-" + max);
            if (size < min) {
              size = min;
              log(iframeId, "Set " + dimension + " to min value");
            }
            if (size > max) {
              size = max;
              log(iframeId, "Set " + dimension + " to max value");
            }
            messageData[dimension] = "" + size;
          }
          function isMessageFromIFrame() {
            function checkAllowedOrigin() {
              function checkList() {
                var i = 0, retCode = false;
                log(
                  iframeId,
                  "Checking connection is from allowed list of origins: " + checkOrigin
                );
                for (; i < checkOrigin.length; i++) {
                  if (checkOrigin[i] === origin) {
                    retCode = true;
                    break;
                  }
                }
                return retCode;
              }
              function checkSingle() {
                var remoteHost = settings[iframeId] && settings[iframeId].remoteHost;
                log(iframeId, "Checking connection is from: " + remoteHost);
                return origin === remoteHost;
              }
              return checkOrigin.constructor === Array ? checkList() : checkSingle();
            }
            var origin = event.origin, checkOrigin = settings[iframeId] && settings[iframeId].checkOrigin;
            if (checkOrigin && "" + origin !== "null" && !checkAllowedOrigin()) {
              throw new Error(
                "Unexpected message received from: " + origin + " for " + messageData.iframe.id + ". Message was: " + event.data + ". This error can be disabled by setting the checkOrigin: false option or by providing of array of trusted domains."
              );
            }
            return true;
          }
          function isMessageForUs() {
            return msgId === ("" + msg).slice(0, msgIdLen) && msg.slice(msgIdLen).split(":")[0] in settings;
          }
          function isMessageFromMetaParent() {
            var retCode = messageData.type in { true: 1, false: 1, undefined: 1 };
            if (retCode) {
              log(iframeId, "Ignoring init message from meta parent page");
            }
            return retCode;
          }
          function getMsgBody(offset) {
            return msg.slice(msg.indexOf(":") + msgHeaderLen + offset);
          }
          function forwardMsgFromIFrame(msgBody) {
            log(
              iframeId,
              "onMessage passed: {iframe: " + messageData.iframe.id + ", message: " + msgBody + "}"
            );
            on("onMessage", {
              iframe: messageData.iframe,
              message: JSON.parse(msgBody)
            });
            log(iframeId, "--");
          }
          function getPageInfo() {
            var bodyPosition = document.body.getBoundingClientRect(), iFramePosition = messageData.iframe.getBoundingClientRect();
            return JSON.stringify({
              iframeHeight: iFramePosition.height,
              iframeWidth: iFramePosition.width,
              clientHeight: Math.max(
                document.documentElement.clientHeight,
                window.innerHeight || 0
              ),
              clientWidth: Math.max(
                document.documentElement.clientWidth,
                window.innerWidth || 0
              ),
              offsetTop: parseInt(iFramePosition.top - bodyPosition.top, 10),
              offsetLeft: parseInt(iFramePosition.left - bodyPosition.left, 10),
              scrollTop: window.pageYOffset,
              scrollLeft: window.pageXOffset,
              documentHeight: document.documentElement.clientHeight,
              documentWidth: document.documentElement.clientWidth,
              windowHeight: window.innerHeight,
              windowWidth: window.innerWidth
            });
          }
          function sendPageInfoToIframe(iframe, iframeId2) {
            function debouncedTrigger() {
              trigger("Send Page Info", "pageInfo:" + getPageInfo(), iframe, iframeId2);
            }
            debounceFrameEvents(debouncedTrigger, 32, iframeId2);
          }
          function startPageInfoMonitor() {
            function setListener(type, func) {
              function sendPageInfo() {
                if (settings[id]) {
                  sendPageInfoToIframe(settings[id].iframe, id);
                } else {
                  stop();
                }
              }
              ;
              ["scroll", "resize"].forEach(function(evt) {
                log(id, type + evt + " listener for sendPageInfo");
                func(window, evt, sendPageInfo);
              });
            }
            function stop() {
              setListener("Remove ", removeEventListener);
            }
            function start() {
              setListener("Add ", addEventListener);
            }
            var id = iframeId;
            start();
            if (settings[id]) {
              settings[id].stopPageInfo = stop;
            }
          }
          function stopPageInfoMonitor() {
            if (settings[iframeId] && settings[iframeId].stopPageInfo) {
              settings[iframeId].stopPageInfo();
              delete settings[iframeId].stopPageInfo;
            }
          }
          function checkIFrameExists() {
            var retBool = true;
            if (null === messageData.iframe) {
              warn(iframeId, "IFrame (" + messageData.id + ") not found");
              retBool = false;
            }
            return retBool;
          }
          function getElementPosition(target) {
            var iFramePosition = target.getBoundingClientRect();
            getPagePosition(iframeId);
            return {
              x: Math.floor(Number(iFramePosition.left) + Number(pagePosition.x)),
              y: Math.floor(Number(iFramePosition.top) + Number(pagePosition.y))
            };
          }
          function scrollRequestFromChild(addOffset) {
            function reposition() {
              pagePosition = newPosition;
              scrollTo();
              log(iframeId, "--");
            }
            function calcOffset() {
              return {
                x: Number(messageData.width) + offset.x,
                y: Number(messageData.height) + offset.y
              };
            }
            function scrollParent() {
              if (window.parentIFrame) {
                window.parentIFrame["scrollTo" + (addOffset ? "Offset" : "")](
                  newPosition.x,
                  newPosition.y
                );
              } else {
                warn(
                  iframeId,
                  "Unable to scroll to requested position, window.parentIFrame not found"
                );
              }
            }
            var offset = addOffset ? getElementPosition(messageData.iframe) : { x: 0, y: 0 }, newPosition = calcOffset();
            log(
              iframeId,
              "Reposition requested from iFrame (offset x:" + offset.x + " y:" + offset.y + ")"
            );
            if (window.top === window.self) {
              reposition();
            } else {
              scrollParent();
            }
          }
          function scrollTo() {
            if (false === on("onScroll", pagePosition)) {
              unsetPagePosition();
            } else {
              setPagePosition(iframeId);
            }
          }
          function findTarget(location) {
            function jumpToTarget() {
              var jumpPosition = getElementPosition(target);
              log(
                iframeId,
                "Moving to in page link (#" + hash + ") at x: " + jumpPosition.x + " y: " + jumpPosition.y
              );
              pagePosition = {
                x: jumpPosition.x,
                y: jumpPosition.y
              };
              scrollTo();
              log(iframeId, "--");
            }
            function jumpToParent() {
              if (window.parentIFrame) {
                window.parentIFrame.moveToAnchor(hash);
              } else {
                log(
                  iframeId,
                  "In page link #" + hash + " not found and window.parentIFrame not found"
                );
              }
            }
            var hash = location.split("#")[1] || "", hashData = decodeURIComponent(hash), target = document.getElementById(hashData) || document.getElementsByName(hashData)[0];
            if (target) {
              jumpToTarget();
            } else if (window.top === window.self) {
              log(iframeId, "In page link #" + hash + " not found");
            } else {
              jumpToParent();
            }
          }
          function onMouse(event2) {
            var mousePos = {};
            if (Number(messageData.width) === 0 && Number(messageData.height) === 0) {
              var data = getMsgBody(9).split(":");
              mousePos = {
                x: data[1],
                y: data[0]
              };
            } else {
              mousePos = {
                x: messageData.width,
                y: messageData.height
              };
            }
            on(event2, {
              iframe: messageData.iframe,
              screenX: Number(mousePos.x),
              screenY: Number(mousePos.y),
              type: messageData.type
            });
          }
          function on(funcName, val) {
            return chkEvent(iframeId, funcName, val);
          }
          function actionMsg() {
            if (settings[iframeId] && settings[iframeId].firstRun) firstRun();
            switch (messageData.type) {
              case "close": {
                closeIFrame(messageData.iframe);
                break;
              }
              case "message": {
                forwardMsgFromIFrame(getMsgBody(6));
                break;
              }
              case "mouseenter": {
                onMouse("onMouseEnter");
                break;
              }
              case "mouseleave": {
                onMouse("onMouseLeave");
                break;
              }
              case "autoResize": {
                settings[iframeId].autoResize = JSON.parse(getMsgBody(9));
                break;
              }
              case "scrollTo": {
                scrollRequestFromChild(false);
                break;
              }
              case "scrollToOffset": {
                scrollRequestFromChild(true);
                break;
              }
              case "pageInfo": {
                sendPageInfoToIframe(
                  settings[iframeId] && settings[iframeId].iframe,
                  iframeId
                );
                startPageInfoMonitor();
                break;
              }
              case "pageInfoStop": {
                stopPageInfoMonitor();
                break;
              }
              case "inPageLink": {
                findTarget(getMsgBody(9));
                break;
              }
              case "reset": {
                resetIFrame(messageData);
                break;
              }
              case "init": {
                resizeIFrame();
                on("onInit", messageData.iframe);
                break;
              }
              default: {
                if (Number(messageData.width) === 0 && Number(messageData.height) === 0) {
                  warn(
                    "Unsupported message received (" + messageData.type + "), this is likely due to the iframe containing a later version of iframe-resizer than the parent page"
                  );
                } else {
                  resizeIFrame();
                }
              }
            }
          }
          function hasSettings(iframeId2) {
            var retBool = true;
            if (!settings[iframeId2]) {
              retBool = false;
              warn(
                messageData.type + " No settings for " + iframeId2 + ". Message was: " + msg
              );
            }
            return retBool;
          }
          function iFrameReadyMsgReceived() {
            for (var iframeId2 in settings) {
              trigger(
                "iFrame requested init",
                createOutgoingMsg(iframeId2),
                settings[iframeId2].iframe,
                iframeId2
              );
            }
          }
          function firstRun() {
            if (settings[iframeId]) {
              settings[iframeId].firstRun = false;
            }
          }
          var msg = event.data, messageData = {}, iframeId = null;
          if ("[iFrameResizerChild]Ready" === msg) {
            iFrameReadyMsgReceived();
          } else if (isMessageForUs()) {
            messageData = processMsg();
            iframeId = messageData.id;
            if (settings[iframeId]) {
              settings[iframeId].loaded = true;
            }
            if (!isMessageFromMetaParent() && hasSettings(iframeId)) {
              log(iframeId, "Received: " + msg);
              if (checkIFrameExists() && isMessageFromIFrame()) {
                actionMsg();
              }
            }
          } else {
            info(iframeId, "Ignored: " + msg);
          }
        }
        function chkEvent(iframeId, funcName, val) {
          var func = null, retVal = null;
          if (settings[iframeId]) {
            func = settings[iframeId][funcName];
            if ("function" === typeof func) {
              retVal = func(val);
            } else {
              throw new TypeError(
                funcName + " on iFrame[" + iframeId + "] is not a function"
              );
            }
          }
          return retVal;
        }
        function removeIframeListeners(iframe) {
          var iframeId = iframe.id;
          delete settings[iframeId];
        }
        function closeIFrame(iframe) {
          var iframeId = iframe.id;
          if (chkEvent(iframeId, "onClose", iframeId) === false) {
            log(iframeId, "Close iframe cancelled by onClose event");
            return;
          }
          log(iframeId, "Removing iFrame: " + iframeId);
          try {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          } catch (error) {
            warn(error);
          }
          chkEvent(iframeId, "onClosed", iframeId);
          log(iframeId, "--");
          removeIframeListeners(iframe);
          if (destroyObserver) {
            destroyObserver.disconnect();
            destroyObserver = null;
          }
        }
        function getPagePosition(iframeId) {
          if (null === pagePosition) {
            pagePosition = {
              x: window.pageXOffset === undefined2 ? document.documentElement.scrollLeft : window.pageXOffset,
              y: window.pageYOffset === undefined2 ? document.documentElement.scrollTop : window.pageYOffset
            };
            log(
              iframeId,
              "Get page position: " + pagePosition.x + "," + pagePosition.y
            );
          }
        }
        function setPagePosition(iframeId) {
          if (null !== pagePosition) {
            window.scrollTo(pagePosition.x, pagePosition.y);
            log(
              iframeId,
              "Set page position: " + pagePosition.x + "," + pagePosition.y
            );
            unsetPagePosition();
          }
        }
        function unsetPagePosition() {
          pagePosition = null;
        }
        function resetIFrame(messageData) {
          function reset() {
            setSize(messageData);
            trigger("reset", "reset", messageData.iframe, messageData.id);
          }
          log(
            messageData.id,
            "Size reset requested by " + ("init" === messageData.type ? "host page" : "iFrame")
          );
          getPagePosition(messageData.id);
          syncResize(reset, messageData, "reset");
        }
        function setSize(messageData) {
          function setDimension(dimension) {
            if (!messageData.id) {
              log("undefined", "messageData id not set");
              return;
            }
            messageData.iframe.style[dimension] = messageData[dimension] + "px";
            log(
              messageData.id,
              "IFrame (" + iframeId + ") " + dimension + " set to " + messageData[dimension] + "px"
            );
          }
          function chkZero(dimension) {
            if (!hiddenCheckEnabled && "0" === messageData[dimension]) {
              hiddenCheckEnabled = true;
              log(iframeId, "Hidden iFrame detected, creating visibility listener");
              fixHiddenIFrames();
            }
          }
          function processDimension(dimension) {
            setDimension(dimension);
            chkZero(dimension);
          }
          var iframeId = messageData.iframe.id;
          if (settings[iframeId]) {
            if (settings[iframeId].sizeHeight) {
              processDimension("height");
            }
            if (settings[iframeId].sizeWidth) {
              processDimension("width");
            }
          }
        }
        function syncResize(func, messageData, doNotSync) {
          if (doNotSync !== messageData.type && requestAnimationFrame2 && // including check for jasmine because had trouble getting spy to work in unit test using requestAnimationFrame
          !window.jasmine) {
            log(messageData.id, "Requesting animation frame");
            requestAnimationFrame2(func);
          } else {
            func();
          }
        }
        function trigger(calleeMsg, msg, iframe, id, noResponseWarning) {
          function postMessageToIFrame() {
            var target = settings[id] && settings[id].targetOrigin;
            log(
              id,
              "[" + calleeMsg + "] Sending msg to iframe[" + id + "] (" + msg + ") targetOrigin: " + target
            );
            iframe.contentWindow.postMessage(msgId + msg, target);
          }
          function iFrameNotFound() {
            warn(id, "[" + calleeMsg + "] IFrame(" + id + ") not found");
          }
          function chkAndSend() {
            if (iframe && "contentWindow" in iframe && null !== iframe.contentWindow) {
              postMessageToIFrame();
            } else {
              iFrameNotFound();
            }
          }
          function warnOnNoResponse() {
            function warning() {
              if (settings[id] && !settings[id].loaded && !errorShown) {
                errorShown = true;
                warn(
                  id,
                  "IFrame has not responded within " + settings[id].warningTimeout / 1e3 + " seconds. Check iFrameResizer.contentWindow.js has been loaded in iFrame. This message can be ignored if everything is working, or you can set the warningTimeout option to a higher value or zero to suppress this warning."
                );
              }
            }
            if (!!noResponseWarning && settings[id] && !!settings[id].warningTimeout) {
              settings[id].msgTimeout = setTimeout(
                warning,
                settings[id].warningTimeout
              );
            }
          }
          var errorShown = false;
          id = id || iframe.id;
          if (settings[id]) {
            chkAndSend();
            warnOnNoResponse();
          }
        }
        function createOutgoingMsg(iframeId) {
          return iframeId + ":" + settings[iframeId].bodyMarginV1 + ":" + settings[iframeId].sizeWidth + ":" + settings[iframeId].log + ":" + settings[iframeId].interval + ":" + settings[iframeId].enablePublicMethods + ":" + settings[iframeId].autoResize + ":" + settings[iframeId].bodyMargin + ":" + settings[iframeId].heightCalculationMethod + ":" + settings[iframeId].bodyBackground + ":" + settings[iframeId].bodyPadding + ":" + settings[iframeId].tolerance + ":" + settings[iframeId].inPageLinks + ":" + settings[iframeId].resizeFrom + ":" + settings[iframeId].widthCalculationMethod + ":" + settings[iframeId].mouseEvents;
        }
        function isNumber(value) {
          return typeof value === "number";
        }
        function setupIFrame(iframe, options) {
          function setLimits() {
            function addStyle(style) {
              var styleValue = settings[iframeId][style];
              if (Infinity !== styleValue && 0 !== styleValue) {
                iframe.style[style] = isNumber(styleValue) ? styleValue + "px" : styleValue;
                log(iframeId, "Set " + style + " = " + iframe.style[style]);
              }
            }
            function chkMinMax(dimension) {
              if (settings[iframeId]["min" + dimension] > settings[iframeId]["max" + dimension]) {
                throw new Error(
                  "Value for min" + dimension + " can not be greater than max" + dimension
                );
              }
            }
            chkMinMax("Height");
            chkMinMax("Width");
            addStyle("maxHeight");
            addStyle("minHeight");
            addStyle("maxWidth");
            addStyle("minWidth");
          }
          function newId() {
            var id = options && options.id || defaults.id + count++;
            if (null !== document.getElementById(id)) {
              id += count++;
            }
            return id;
          }
          function ensureHasId(iframeId2) {
            if (typeof iframeId2 !== "string") {
              throw new TypeError("Invaild id for iFrame. Expected String");
            }
            if ("" === iframeId2) {
              iframe.id = iframeId2 = newId();
              logEnabled = (options || {}).log;
              log(
                iframeId2,
                "Added missing iframe ID: " + iframeId2 + " (" + iframe.src + ")"
              );
            }
            return iframeId2;
          }
          function setScrolling() {
            log(
              iframeId,
              "IFrame scrolling " + (settings[iframeId] && settings[iframeId].scrolling ? "enabled" : "disabled") + " for " + iframeId
            );
            iframe.style.overflow = false === (settings[iframeId] && settings[iframeId].scrolling) ? "hidden" : "auto";
            switch (settings[iframeId] && settings[iframeId].scrolling) {
              case "omit": {
                break;
              }
              case true: {
                iframe.scrolling = "yes";
                break;
              }
              case false: {
                iframe.scrolling = "no";
                break;
              }
              default: {
                iframe.scrolling = settings[iframeId] ? settings[iframeId].scrolling : "no";
              }
            }
          }
          function setupBodyMarginValues() {
            if ("number" === typeof (settings[iframeId] && settings[iframeId].bodyMargin) || "0" === (settings[iframeId] && settings[iframeId].bodyMargin)) {
              settings[iframeId].bodyMarginV1 = settings[iframeId].bodyMargin;
              settings[iframeId].bodyMargin = "" + settings[iframeId].bodyMargin + "px";
            }
          }
          function checkReset() {
            var firstRun = settings[iframeId] && settings[iframeId].firstRun, resetRequertMethod = settings[iframeId] && settings[iframeId].heightCalculationMethod in resetRequiredMethods;
            if (!firstRun && resetRequertMethod) {
              resetIFrame({ iframe, height: 0, width: 0, type: "init" });
            }
          }
          function setupIFrameObject() {
            if (settings[iframeId]) {
              settings[iframeId].iframe.iFrameResizer = {
                close: closeIFrame.bind(null, settings[iframeId].iframe),
                removeListeners: removeIframeListeners.bind(
                  null,
                  settings[iframeId].iframe
                ),
                resize: trigger.bind(
                  null,
                  "Window resize",
                  "resize",
                  settings[iframeId].iframe
                ),
                moveToAnchor: function(anchor) {
                  trigger(
                    "Move to anchor",
                    "moveToAnchor:" + anchor,
                    settings[iframeId].iframe,
                    iframeId
                  );
                },
                sendMessage: function(message) {
                  message = JSON.stringify(message);
                  trigger(
                    "Send Message",
                    "message:" + message,
                    settings[iframeId].iframe,
                    iframeId
                  );
                }
              };
            }
          }
          function init(msg) {
            function iFrameLoaded() {
              trigger("iFrame.onload", msg, iframe, undefined2, true);
              checkReset();
            }
            function createDestroyObserver(MutationObserver3) {
              if (!iframe.parentNode) {
                return null;
              }
              var destroyObserver2 = new MutationObserver3(function(mutations) {
                mutations.forEach(function(mutation) {
                  var removedNodes = Array.prototype.slice.call(mutation.removedNodes);
                  removedNodes.forEach(function(removedNode) {
                    if (removedNode === iframe) {
                      closeIFrame(iframe);
                    }
                  });
                });
              });
              destroyObserver2.observe(iframe.parentNode, {
                childList: true
              });
              return destroyObserver2;
            }
            var MutationObserver2 = getMutationObserver();
            if (MutationObserver2) {
              destroyObserver = createDestroyObserver(MutationObserver2);
            }
            addEventListener(iframe, "load", iFrameLoaded);
            trigger("init", msg, iframe, undefined2, true);
          }
          function checkOptions(options2) {
            if ("object" !== typeof options2) {
              throw new TypeError("Options is not an object");
            }
          }
          function copyOptions(options2) {
            for (var option in defaults) {
              if (Object.prototype.hasOwnProperty.call(defaults, option)) {
                settings[iframeId][option] = Object.prototype.hasOwnProperty.call(
                  options2,
                  option
                ) ? options2[option] : defaults[option];
              }
            }
          }
          function getTargetOrigin(remoteHost) {
            return "" === remoteHost || null !== remoteHost.match(/^(about:blank|javascript:|file:\/\/)/) ? "*" : remoteHost;
          }
          function depricate(key) {
            var splitName = key.split("Callback");
            if (splitName.length === 2) {
              var name = "on" + splitName[0].charAt(0).toUpperCase() + splitName[0].slice(1);
              this[name] = this[key];
              delete this[key];
              warn(
                iframeId,
                "Deprecated: '" + key + "' has been renamed '" + name + "'. The old method will be removed in the next major version."
              );
            }
          }
          function processOptions(options2) {
            options2 = options2 || {};
            settings[iframeId] = /* @__PURE__ */ Object.create(null);
            settings[iframeId].iframe = iframe;
            settings[iframeId].firstRun = true;
            settings[iframeId].remoteHost = iframe.src && iframe.src.split("/").slice(0, 3).join("/");
            checkOptions(options2);
            Object.keys(options2).forEach(depricate, options2);
            copyOptions(options2);
            if (settings[iframeId]) {
              settings[iframeId].targetOrigin = true === settings[iframeId].checkOrigin ? getTargetOrigin(settings[iframeId].remoteHost) : "*";
            }
          }
          function beenHere() {
            return iframeId in settings && "iFrameResizer" in iframe;
          }
          var iframeId = ensureHasId(iframe.id);
          if (beenHere()) {
            warn(iframeId, "Ignored iFrame, already setup.");
          } else {
            processOptions(options);
            setScrolling();
            setLimits();
            setupBodyMarginValues();
            init(createOutgoingMsg(iframeId));
            setupIFrameObject();
          }
        }
        function debouce(fn, time) {
          if (null === timer) {
            timer = setTimeout(function() {
              timer = null;
              fn();
            }, time);
          }
        }
        var frameTimer = {};
        function debounceFrameEvents(fn, time, frameId) {
          if (!frameTimer[frameId]) {
            frameTimer[frameId] = setTimeout(function() {
              frameTimer[frameId] = null;
              fn();
            }, time);
          }
        }
        function fixHiddenIFrames() {
          function checkIFrames() {
            function checkIFrame(settingId) {
              function chkDimension(dimension) {
                return "0px" === (settings[settingId] && settings[settingId].iframe.style[dimension]);
              }
              function isVisible(el3) {
                return null !== el3.offsetParent;
              }
              if (settings[settingId] && isVisible(settings[settingId].iframe) && (chkDimension("height") || chkDimension("width"))) {
                trigger(
                  "Visibility change",
                  "resize",
                  settings[settingId].iframe,
                  settingId
                );
              }
            }
            Object.keys(settings).forEach(function(key) {
              checkIFrame(key);
            });
          }
          function mutationObserved(mutations) {
            log(
              "window",
              "Mutation observed: " + mutations[0].target + " " + mutations[0].type
            );
            debouce(checkIFrames, 16);
          }
          function createMutationObserver() {
            var target = document.querySelector("body"), config = {
              attributes: true,
              attributeOldValue: false,
              characterData: true,
              characterDataOldValue: false,
              childList: true,
              subtree: true
            }, observer = new MutationObserver2(mutationObserved);
            observer.observe(target, config);
          }
          var MutationObserver2 = getMutationObserver();
          if (MutationObserver2) {
            createMutationObserver();
          }
        }
        function resizeIFrames(event) {
          function resize() {
            sendTriggerMsg("Window " + event, "resize");
          }
          log("window", "Trigger event: " + event);
          debouce(resize, 16);
        }
        function tabVisible() {
          function resize() {
            sendTriggerMsg("Tab Visible", "resize");
          }
          if ("hidden" !== document.visibilityState) {
            log("document", "Trigger event: Visibility change");
            debouce(resize, 16);
          }
        }
        function sendTriggerMsg(eventName, event) {
          function isIFrameResizeEnabled(iframeId) {
            return settings[iframeId] && "parent" === settings[iframeId].resizeFrom && settings[iframeId].autoResize && !settings[iframeId].firstRun;
          }
          Object.keys(settings).forEach(function(iframeId) {
            if (isIFrameResizeEnabled(iframeId)) {
              trigger(eventName, event, settings[iframeId].iframe, iframeId);
            }
          });
        }
        function setupEventListeners2() {
          addEventListener(window, "message", iFrameListener);
          addEventListener(window, "resize", function() {
            resizeIFrames("resize");
          });
          addEventListener(document, "visibilitychange", tabVisible);
          addEventListener(document, "-webkit-visibilitychange", tabVisible);
        }
        function factory() {
          function init(options, element) {
            function chkType() {
              if (!element.tagName) {
                throw new TypeError("Object is not a valid DOM element");
              } else if ("IFRAME" !== element.tagName.toUpperCase()) {
                throw new TypeError(
                  "Expected <IFRAME> tag, found <" + element.tagName + ">"
                );
              }
            }
            if (element) {
              chkType();
              setupIFrame(element, options);
              iFrames.push(element);
            }
          }
          function warnDeprecatedOptions(options) {
            if (options && options.enablePublicMethods) {
              warn(
                "enablePublicMethods option has been removed, public methods are now always available in the iFrame"
              );
            }
          }
          var iFrames;
          setupRequestAnimationFrame();
          setupEventListeners2();
          return function iFrameResizeF(options, target) {
            iFrames = [];
            warnDeprecatedOptions(options);
            switch (typeof target) {
              case "undefined":
              case "string": {
                Array.prototype.forEach.call(
                  document.querySelectorAll(target || "iframe"),
                  init.bind(undefined2, options)
                );
                break;
              }
              case "object": {
                init(options, target);
                break;
              }
              default: {
                throw new TypeError("Unexpected data type (" + typeof target + ")");
              }
            }
            return iFrames;
          };
        }
        function createJQueryPublicMethod($) {
          if (!$.fn) {
            info("", "Unable to bind to jQuery, it is not fully loaded.");
          } else if (!$.fn.iFrameResize) {
            $.fn.iFrameResize = function $iFrameResizeF(options) {
              function init(index, element) {
                setupIFrame(element, options);
              }
              return this.filter("iframe").each(init).end();
            };
          }
        }
        if (window.jQuery !== undefined2) {
          createJQueryPublicMethod(window.jQuery);
        }
        if (typeof define === "function" && define.amd) {
          define([], factory);
        } else if (typeof module === "object" && typeof module.exports === "object") {
          module.exports = factory();
        }
        window.iFrameResize = window.iFrameResize || factory();
      })();
    }
  });

  // node_modules/iframe-resizer/js/iframeResizer.contentWindow.js
  var require_iframeResizer_contentWindow = __commonJS({
    "node_modules/iframe-resizer/js/iframeResizer.contentWindow.js"(exports, module) {
      (function(undefined2) {
        if (typeof window === "undefined") return;
        var autoResize = true, base = 10, bodyBackground = "", bodyMargin = 0, bodyMarginStr = "", bodyObserver = null, bodyPadding = "", calculateWidth = false, doubleEventList = { resize: 1, click: 1 }, eventCancelTimer = 128, firstRun = true, height = 1, heightCalcModeDefault = "bodyOffset", heightCalcMode = heightCalcModeDefault, initLock = true, initMsg = "", inPageLinks = {}, interval = 32, intervalTimer = null, logging = false, mouseEvents = false, msgID = "[iFrameSizer]", msgIdLen = msgID.length, myID = "", resetRequiredMethods = {
          max: 1,
          min: 1,
          bodyScroll: 1,
          documentElementScroll: 1
        }, resizeFrom = "child", sendPermit = true, target = window.parent, targetOriginDefault = "*", tolerance = 0, triggerLocked = false, triggerLockedTimer = null, throttledTimer = 16, width = 1, widthCalcModeDefault = "scroll", widthCalcMode = widthCalcModeDefault, win = window, onMessage = function() {
          warn("onMessage function not defined");
        }, onReady = function() {
        }, onPageInfo = function() {
        }, customCalcMethods = {
          height: function() {
            warn("Custom height calculation function not defined");
            return document.documentElement.offsetHeight;
          },
          width: function() {
            warn("Custom width calculation function not defined");
            return document.body.scrollWidth;
          }
        }, eventHandlersByName = {}, passiveSupported = false;
        function noop() {
        }
        try {
          var options = Object.create(
            {},
            {
              passive: {
                // eslint-disable-next-line getter-return
                get: function() {
                  passiveSupported = true;
                }
              }
            }
          );
          window.addEventListener("test", noop, options);
          window.removeEventListener("test", noop, options);
        } catch (error) {
        }
        function addEventListener(el3, evt, func, options2) {
          el3.addEventListener(evt, func, passiveSupported ? options2 || {} : false);
        }
        function removeEventListener(el3, evt, func) {
          el3.removeEventListener(evt, func, false);
        }
        function capitalizeFirstLetter(string) {
          return string.charAt(0).toUpperCase() + string.slice(1);
        }
        function throttle(func) {
          var context, args, result, timeout = null, previous = 0, later = function() {
            previous = Date.now();
            timeout = null;
            result = func.apply(context, args);
            if (!timeout) {
              context = args = null;
            }
          };
          return function() {
            var now = Date.now();
            if (!previous) {
              previous = now;
            }
            var remaining = throttledTimer - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0 || remaining > throttledTimer) {
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }
              previous = now;
              result = func.apply(context, args);
              if (!timeout) {
                context = args = null;
              }
            } else if (!timeout) {
              timeout = setTimeout(later, remaining);
            }
            return result;
          };
        }
        function formatLogMsg(msg) {
          return msgID + "[" + myID + "] " + msg;
        }
        function log(msg) {
          if (logging && "object" === typeof window.console) {
            console.log(formatLogMsg(msg));
          }
        }
        function warn(msg) {
          if ("object" === typeof window.console) {
            console.warn(formatLogMsg(msg));
          }
        }
        function init() {
          readDataFromParent();
          log("Initialising iFrame (" + window.location.href + ")");
          readDataFromPage();
          setMargin();
          setBodyStyle("background", bodyBackground);
          setBodyStyle("padding", bodyPadding);
          injectClearFixIntoBodyElement();
          checkHeightMode();
          checkWidthMode();
          stopInfiniteResizingOfIFrame();
          setupPublicMethods();
          setupMouseEvents();
          startEventListeners();
          inPageLinks = setupInPageLinks();
          sendSize("init", "Init message from host page");
          onReady();
        }
        function readDataFromParent() {
          function strBool(str) {
            return "true" === str;
          }
          var data = initMsg.slice(msgIdLen).split(":");
          myID = data[0];
          bodyMargin = undefined2 === data[1] ? bodyMargin : Number(data[1]);
          calculateWidth = undefined2 === data[2] ? calculateWidth : strBool(data[2]);
          logging = undefined2 === data[3] ? logging : strBool(data[3]);
          interval = undefined2 === data[4] ? interval : Number(data[4]);
          autoResize = undefined2 === data[6] ? autoResize : strBool(data[6]);
          bodyMarginStr = data[7];
          heightCalcMode = undefined2 === data[8] ? heightCalcMode : data[8];
          bodyBackground = data[9];
          bodyPadding = data[10];
          tolerance = undefined2 === data[11] ? tolerance : Number(data[11]);
          inPageLinks.enable = undefined2 === data[12] ? false : strBool(data[12]);
          resizeFrom = undefined2 === data[13] ? resizeFrom : data[13];
          widthCalcMode = undefined2 === data[14] ? widthCalcMode : data[14];
          mouseEvents = undefined2 === data[15] ? mouseEvents : strBool(data[15]);
        }
        function depricate(key) {
          var splitName = key.split("Callback");
          if (splitName.length === 2) {
            var name = "on" + splitName[0].charAt(0).toUpperCase() + splitName[0].slice(1);
            this[name] = this[key];
            delete this[key];
            warn(
              "Deprecated: '" + key + "' has been renamed '" + name + "'. The old method will be removed in the next major version."
            );
          }
        }
        function readDataFromPage() {
          function readData() {
            var data = window.iFrameResizer;
            log("Reading data from page: " + JSON.stringify(data));
            Object.keys(data).forEach(depricate, data);
            onMessage = "onMessage" in data ? data.onMessage : onMessage;
            onReady = "onReady" in data ? data.onReady : onReady;
            targetOriginDefault = "targetOrigin" in data ? data.targetOrigin : targetOriginDefault;
            heightCalcMode = "heightCalculationMethod" in data ? data.heightCalculationMethod : heightCalcMode;
            widthCalcMode = "widthCalculationMethod" in data ? data.widthCalculationMethod : widthCalcMode;
          }
          function setupCustomCalcMethods(calcMode, calcFunc) {
            if ("function" === typeof calcMode) {
              log("Setup custom " + calcFunc + "CalcMethod");
              customCalcMethods[calcFunc] = calcMode;
              calcMode = "custom";
            }
            return calcMode;
          }
          if ("iFrameResizer" in window && Object === window.iFrameResizer.constructor) {
            readData();
            heightCalcMode = setupCustomCalcMethods(heightCalcMode, "height");
            widthCalcMode = setupCustomCalcMethods(widthCalcMode, "width");
          }
          log("TargetOrigin for parent set to: " + targetOriginDefault);
        }
        function chkCSS(attr, value) {
          if (-1 !== value.indexOf("-")) {
            warn("Negative CSS value ignored for " + attr);
            value = "";
          }
          return value;
        }
        function setBodyStyle(attr, value) {
          if (undefined2 !== value && "" !== value && "null" !== value) {
            document.body.style[attr] = value;
            log("Body " + attr + ' set to "' + value + '"');
          }
        }
        function setMargin() {
          if (undefined2 === bodyMarginStr) {
            bodyMarginStr = bodyMargin + "px";
          }
          setBodyStyle("margin", chkCSS("margin", bodyMarginStr));
        }
        function stopInfiniteResizingOfIFrame() {
          document.documentElement.style.height = "";
          document.body.style.height = "";
          log('HTML & body height set to "auto"');
        }
        function manageTriggerEvent(options2) {
          var listener = {
            add: function(eventName) {
              function handleEvent() {
                sendSize(options2.eventName, options2.eventType);
              }
              eventHandlersByName[eventName] = handleEvent;
              addEventListener(window, eventName, handleEvent, { passive: true });
            },
            remove: function(eventName) {
              var handleEvent = eventHandlersByName[eventName];
              delete eventHandlersByName[eventName];
              removeEventListener(window, eventName, handleEvent);
            }
          };
          if (options2.eventNames && Array.prototype.map) {
            options2.eventName = options2.eventNames[0];
            options2.eventNames.map(listener[options2.method]);
          } else {
            listener[options2.method](options2.eventName);
          }
          log(
            capitalizeFirstLetter(options2.method) + " event listener: " + options2.eventType
          );
        }
        function manageEventListeners(method) {
          manageTriggerEvent({
            method,
            eventType: "Animation Start",
            eventNames: ["animationstart", "webkitAnimationStart"]
          });
          manageTriggerEvent({
            method,
            eventType: "Animation Iteration",
            eventNames: ["animationiteration", "webkitAnimationIteration"]
          });
          manageTriggerEvent({
            method,
            eventType: "Animation End",
            eventNames: ["animationend", "webkitAnimationEnd"]
          });
          manageTriggerEvent({
            method,
            eventType: "Input",
            eventName: "input"
          });
          manageTriggerEvent({
            method,
            eventType: "Mouse Up",
            eventName: "mouseup"
          });
          manageTriggerEvent({
            method,
            eventType: "Mouse Down",
            eventName: "mousedown"
          });
          manageTriggerEvent({
            method,
            eventType: "Orientation Change",
            eventName: "orientationchange"
          });
          manageTriggerEvent({
            method,
            eventType: "Print",
            eventNames: ["afterprint", "beforeprint"]
          });
          manageTriggerEvent({
            method,
            eventType: "Ready State Change",
            eventName: "readystatechange"
          });
          manageTriggerEvent({
            method,
            eventType: "Touch Start",
            eventName: "touchstart"
          });
          manageTriggerEvent({
            method,
            eventType: "Touch End",
            eventName: "touchend"
          });
          manageTriggerEvent({
            method,
            eventType: "Touch Cancel",
            eventName: "touchcancel"
          });
          manageTriggerEvent({
            method,
            eventType: "Transition Start",
            eventNames: [
              "transitionstart",
              "webkitTransitionStart",
              "MSTransitionStart",
              "oTransitionStart",
              "otransitionstart"
            ]
          });
          manageTriggerEvent({
            method,
            eventType: "Transition Iteration",
            eventNames: [
              "transitioniteration",
              "webkitTransitionIteration",
              "MSTransitionIteration",
              "oTransitionIteration",
              "otransitioniteration"
            ]
          });
          manageTriggerEvent({
            method,
            eventType: "Transition End",
            eventNames: [
              "transitionend",
              "webkitTransitionEnd",
              "MSTransitionEnd",
              "oTransitionEnd",
              "otransitionend"
            ]
          });
          if ("child" === resizeFrom) {
            manageTriggerEvent({
              method,
              eventType: "IFrame Resized",
              eventName: "resize"
            });
          }
        }
        function checkCalcMode(calcMode, calcModeDefault, modes, type) {
          if (calcModeDefault !== calcMode) {
            if (!(calcMode in modes)) {
              warn(
                calcMode + " is not a valid option for " + type + "CalculationMethod."
              );
              calcMode = calcModeDefault;
            }
            log(type + ' calculation method set to "' + calcMode + '"');
          }
          return calcMode;
        }
        function checkHeightMode() {
          heightCalcMode = checkCalcMode(
            heightCalcMode,
            heightCalcModeDefault,
            getHeight,
            "height"
          );
        }
        function checkWidthMode() {
          widthCalcMode = checkCalcMode(
            widthCalcMode,
            widthCalcModeDefault,
            getWidth,
            "width"
          );
        }
        function startEventListeners() {
          if (true === autoResize) {
            manageEventListeners("add");
            setupMutationObserver();
          } else {
            log("Auto Resize disabled");
          }
        }
        function disconnectMutationObserver() {
          if (null !== bodyObserver) {
            bodyObserver.disconnect();
          }
        }
        function stopEventListeners() {
          manageEventListeners("remove");
          disconnectMutationObserver();
          clearInterval(intervalTimer);
        }
        function injectClearFixIntoBodyElement() {
          var clearFix = document.createElement("div");
          clearFix.style.clear = "both";
          clearFix.style.display = "block";
          clearFix.style.height = "0";
          document.body.appendChild(clearFix);
        }
        function setupInPageLinks() {
          function getPagePosition() {
            return {
              x: window.pageXOffset === undefined2 ? document.documentElement.scrollLeft : window.pageXOffset,
              y: window.pageYOffset === undefined2 ? document.documentElement.scrollTop : window.pageYOffset
            };
          }
          function getElementPosition(el3) {
            var elPosition = el3.getBoundingClientRect(), pagePosition = getPagePosition();
            return {
              x: parseInt(elPosition.left, 10) + parseInt(pagePosition.x, 10),
              y: parseInt(elPosition.top, 10) + parseInt(pagePosition.y, 10)
            };
          }
          function findTarget(location) {
            function jumpToTarget(target3) {
              var jumpPosition = getElementPosition(target3);
              log(
                "Moving to in page link (#" + hash + ") at x: " + jumpPosition.x + " y: " + jumpPosition.y
              );
              sendMsg(jumpPosition.y, jumpPosition.x, "scrollToOffset");
            }
            var hash = location.split("#")[1] || location, hashData = decodeURIComponent(hash), target2 = document.getElementById(hashData) || document.getElementsByName(hashData)[0];
            if (undefined2 === target2) {
              log(
                "In page link (#" + hash + ") not found in iFrame, so sending to parent"
              );
              sendMsg(0, 0, "inPageLink", "#" + hash);
            } else {
              jumpToTarget(target2);
            }
          }
          function checkLocationHash() {
            var hash = window.location.hash;
            var href = window.location.href;
            if ("" !== hash && "#" !== hash) {
              findTarget(href);
            }
          }
          function bindAnchors() {
            function setupLink(el3) {
              function linkClicked(e) {
                e.preventDefault();
                findTarget(this.getAttribute("href"));
              }
              if ("#" !== el3.getAttribute("href")) {
                addEventListener(el3, "click", linkClicked);
              }
            }
            Array.prototype.forEach.call(
              document.querySelectorAll('a[href^="#"]'),
              setupLink
            );
          }
          function bindLocationHash() {
            addEventListener(window, "hashchange", checkLocationHash);
          }
          function initCheck() {
            setTimeout(checkLocationHash, eventCancelTimer);
          }
          function enableInPageLinks() {
            if (Array.prototype.forEach && document.querySelectorAll) {
              log("Setting up location.hash handlers");
              bindAnchors();
              bindLocationHash();
              initCheck();
            } else {
              warn(
                "In page linking not fully supported in this browser! (See README.md for IE8 workaround)"
              );
            }
          }
          if (inPageLinks.enable) {
            enableInPageLinks();
          } else {
            log("In page linking not enabled");
          }
          return {
            findTarget
          };
        }
        function setupMouseEvents() {
          if (mouseEvents !== true) return;
          function sendMouse(e) {
            sendMsg(0, 0, e.type, e.screenY + ":" + e.screenX);
          }
          function addMouseListener(evt, name) {
            log("Add event listener: " + name);
            addEventListener(window.document, evt, sendMouse);
          }
          addMouseListener("mouseenter", "Mouse Enter");
          addMouseListener("mouseleave", "Mouse Leave");
        }
        function setupPublicMethods() {
          log("Enable public methods");
          win.parentIFrame = {
            autoResize: function autoResizeF(resize) {
              if (true === resize && false === autoResize) {
                autoResize = true;
                startEventListeners();
              } else if (false === resize && true === autoResize) {
                autoResize = false;
                stopEventListeners();
              }
              sendMsg(0, 0, "autoResize", JSON.stringify(autoResize));
              return autoResize;
            },
            close: function closeF() {
              sendMsg(0, 0, "close");
            },
            getId: function getIdF() {
              return myID;
            },
            getPageInfo: function getPageInfoF(callback) {
              if ("function" === typeof callback) {
                onPageInfo = callback;
                sendMsg(0, 0, "pageInfo");
              } else {
                onPageInfo = function() {
                };
                sendMsg(0, 0, "pageInfoStop");
              }
            },
            moveToAnchor: function moveToAnchorF(hash) {
              inPageLinks.findTarget(hash);
            },
            reset: function resetF() {
              resetIFrame("parentIFrame.reset");
            },
            scrollTo: function scrollToF(x, y) {
              sendMsg(y, x, "scrollTo");
            },
            scrollToOffset: function scrollToF(x, y) {
              sendMsg(y, x, "scrollToOffset");
            },
            sendMessage: function sendMessageF(msg, targetOrigin) {
              sendMsg(0, 0, "message", JSON.stringify(msg), targetOrigin);
            },
            setHeightCalculationMethod: function setHeightCalculationMethodF(heightCalculationMethod) {
              heightCalcMode = heightCalculationMethod;
              checkHeightMode();
            },
            setWidthCalculationMethod: function setWidthCalculationMethodF(widthCalculationMethod) {
              widthCalcMode = widthCalculationMethod;
              checkWidthMode();
            },
            setTargetOrigin: function setTargetOriginF(targetOrigin) {
              log("Set targetOrigin: " + targetOrigin);
              targetOriginDefault = targetOrigin;
            },
            size: function sizeF(customHeight, customWidth) {
              var valString = "" + (customHeight || "") + (customWidth ? "," + customWidth : "");
              sendSize(
                "size",
                "parentIFrame.size(" + valString + ")",
                customHeight,
                customWidth
              );
            }
          };
        }
        function initInterval() {
          if (0 !== interval) {
            log("setInterval: " + interval + "ms");
            intervalTimer = setInterval(function() {
              sendSize("interval", "setInterval: " + interval);
            }, Math.abs(interval));
          }
        }
        function setupBodyMutationObserver() {
          function addImageLoadListners(mutation) {
            function addImageLoadListener(element) {
              if (false === element.complete) {
                log("Attach listeners to " + element.src);
                element.addEventListener("load", imageLoaded, false);
                element.addEventListener("error", imageError, false);
                elements.push(element);
              }
            }
            if (mutation.type === "attributes" && mutation.attributeName === "src") {
              addImageLoadListener(mutation.target);
            } else if (mutation.type === "childList") {
              Array.prototype.forEach.call(
                mutation.target.querySelectorAll("img"),
                addImageLoadListener
              );
            }
          }
          function removeFromArray(element) {
            elements.splice(elements.indexOf(element), 1);
          }
          function removeImageLoadListener(element) {
            log("Remove listeners from " + element.src);
            element.removeEventListener("load", imageLoaded, false);
            element.removeEventListener("error", imageError, false);
            removeFromArray(element);
          }
          function imageEventTriggered(event, type, typeDesc) {
            removeImageLoadListener(event.target);
            sendSize(type, typeDesc + ": " + event.target.src);
          }
          function imageLoaded(event) {
            imageEventTriggered(event, "imageLoad", "Image loaded");
          }
          function imageError(event) {
            imageEventTriggered(event, "imageLoadFailed", "Image load failed");
          }
          function mutationObserved(mutations) {
            sendSize(
              "mutationObserver",
              "mutationObserver: " + mutations[0].target + " " + mutations[0].type
            );
            mutations.forEach(addImageLoadListners);
          }
          function createMutationObserver() {
            var target2 = document.querySelector("body"), config = {
              attributes: true,
              attributeOldValue: false,
              characterData: true,
              characterDataOldValue: false,
              childList: true,
              subtree: true
            };
            observer = new MutationObserver2(mutationObserved);
            log("Create body MutationObserver");
            observer.observe(target2, config);
            return observer;
          }
          var elements = [], MutationObserver2 = window.MutationObserver || window.WebKitMutationObserver, observer = createMutationObserver();
          return {
            disconnect: function() {
              if ("disconnect" in observer) {
                log("Disconnect body MutationObserver");
                observer.disconnect();
                elements.forEach(removeImageLoadListener);
              }
            }
          };
        }
        function setupMutationObserver() {
          var forceIntervalTimer = 0 > interval;
          if (window.MutationObserver || window.WebKitMutationObserver) {
            if (forceIntervalTimer) {
              initInterval();
            } else {
              bodyObserver = setupBodyMutationObserver();
            }
          } else {
            log("MutationObserver not supported in this browser!");
            initInterval();
          }
        }
        function getComputedStyle2(prop, el3) {
          var retVal = 0;
          el3 = el3 || document.body;
          retVal = document.defaultView.getComputedStyle(el3, null);
          retVal = null === retVal ? 0 : retVal[prop];
          return parseInt(retVal, base);
        }
        function chkEventThottle(timer) {
          if (timer > throttledTimer / 2) {
            throttledTimer = 2 * timer;
            log("Event throttle increased to " + throttledTimer + "ms");
          }
        }
        function getMaxElement(side, elements) {
          var elementsLength = elements.length, elVal = 0, maxVal = 0, Side = capitalizeFirstLetter(side), timer = Date.now();
          for (var i = 0; i < elementsLength; i++) {
            elVal = elements[i].getBoundingClientRect()[side] + getComputedStyle2("margin" + Side, elements[i]);
            if (elVal > maxVal) {
              maxVal = elVal;
            }
          }
          timer = Date.now() - timer;
          log("Parsed " + elementsLength + " HTML elements");
          log("Element position calculated in " + timer + "ms");
          chkEventThottle(timer);
          return maxVal;
        }
        function getAllMeasurements(dimensions) {
          return [
            dimensions.bodyOffset(),
            dimensions.bodyScroll(),
            dimensions.documentElementOffset(),
            dimensions.documentElementScroll()
          ];
        }
        function getTaggedElements(side, tag) {
          function noTaggedElementsFound() {
            warn("No tagged elements (" + tag + ") found on page");
            return document.querySelectorAll("body *");
          }
          var elements = document.querySelectorAll("[" + tag + "]");
          if (elements.length === 0) noTaggedElementsFound();
          return getMaxElement(side, elements);
        }
        function getAllElements() {
          return document.querySelectorAll("body *");
        }
        var getHeight = {
          bodyOffset: function getBodyOffsetHeight() {
            return document.body.offsetHeight + getComputedStyle2("marginTop") + getComputedStyle2("marginBottom");
          },
          offset: function() {
            return getHeight.bodyOffset();
          },
          bodyScroll: function getBodyScrollHeight() {
            return document.body.scrollHeight;
          },
          custom: function getCustomWidth() {
            return customCalcMethods.height();
          },
          documentElementOffset: function getDEOffsetHeight() {
            return document.documentElement.offsetHeight;
          },
          documentElementScroll: function getDEScrollHeight() {
            return document.documentElement.scrollHeight;
          },
          max: function getMaxHeight() {
            return Math.max.apply(null, getAllMeasurements(getHeight));
          },
          min: function getMinHeight() {
            return Math.min.apply(null, getAllMeasurements(getHeight));
          },
          grow: function growHeight() {
            return getHeight.max();
          },
          lowestElement: function getBestHeight() {
            return Math.max(
              getHeight.bodyOffset() || getHeight.documentElementOffset(),
              getMaxElement("bottom", getAllElements())
            );
          },
          taggedElement: function getTaggedElementsHeight() {
            return getTaggedElements("bottom", "data-iframe-height");
          }
        }, getWidth = {
          bodyScroll: function getBodyScrollWidth() {
            return document.body.scrollWidth;
          },
          bodyOffset: function getBodyOffsetWidth() {
            return document.body.offsetWidth;
          },
          custom: function getCustomWidth() {
            return customCalcMethods.width();
          },
          documentElementScroll: function getDEScrollWidth() {
            return document.documentElement.scrollWidth;
          },
          documentElementOffset: function getDEOffsetWidth() {
            return document.documentElement.offsetWidth;
          },
          scroll: function getMaxWidth() {
            return Math.max(getWidth.bodyScroll(), getWidth.documentElementScroll());
          },
          max: function getMaxWidth() {
            return Math.max.apply(null, getAllMeasurements(getWidth));
          },
          min: function getMinWidth() {
            return Math.min.apply(null, getAllMeasurements(getWidth));
          },
          rightMostElement: function rightMostElement() {
            return getMaxElement("right", getAllElements());
          },
          taggedElement: function getTaggedElementsWidth() {
            return getTaggedElements("right", "data-iframe-width");
          }
        };
        function sizeIFrame(triggerEvent, triggerEventDesc, customHeight, customWidth) {
          function resizeIFrame() {
            height = currentHeight;
            width = currentWidth;
            sendMsg(height, width, triggerEvent);
          }
          function isSizeChangeDetected() {
            function checkTolarance(a, b) {
              var retVal = Math.abs(a - b) <= tolerance;
              return !retVal;
            }
            currentHeight = undefined2 === customHeight ? getHeight[heightCalcMode]() : customHeight;
            currentWidth = undefined2 === customWidth ? getWidth[widthCalcMode]() : customWidth;
            return checkTolarance(height, currentHeight) || calculateWidth && checkTolarance(width, currentWidth);
          }
          function isForceResizableEvent() {
            return !(triggerEvent in { init: 1, interval: 1, size: 1 });
          }
          function isForceResizableCalcMode() {
            return heightCalcMode in resetRequiredMethods || calculateWidth && widthCalcMode in resetRequiredMethods;
          }
          function logIgnored() {
            log("No change in size detected");
          }
          function checkDownSizing() {
            if (isForceResizableEvent() && isForceResizableCalcMode()) {
              resetIFrame(triggerEventDesc);
            } else if (!(triggerEvent in { interval: 1 })) {
              logIgnored();
            }
          }
          var currentHeight, currentWidth;
          if (isSizeChangeDetected() || "init" === triggerEvent) {
            lockTrigger();
            resizeIFrame();
          } else {
            checkDownSizing();
          }
        }
        var sizeIFrameThrottled = throttle(sizeIFrame);
        function sendSize(triggerEvent, triggerEventDesc, customHeight, customWidth) {
          function recordTrigger() {
            if (!(triggerEvent in { reset: 1, resetPage: 1, init: 1 })) {
              log("Trigger event: " + triggerEventDesc);
            }
          }
          function isDoubleFiredEvent() {
            return triggerLocked && triggerEvent in doubleEventList;
          }
          if (isDoubleFiredEvent()) {
            log("Trigger event cancelled: " + triggerEvent);
          } else {
            recordTrigger();
            if (triggerEvent === "init") {
              sizeIFrame(triggerEvent, triggerEventDesc, customHeight, customWidth);
            } else {
              sizeIFrameThrottled(
                triggerEvent,
                triggerEventDesc,
                customHeight,
                customWidth
              );
            }
          }
        }
        function lockTrigger() {
          if (!triggerLocked) {
            triggerLocked = true;
            log("Trigger event lock on");
          }
          clearTimeout(triggerLockedTimer);
          triggerLockedTimer = setTimeout(function() {
            triggerLocked = false;
            log("Trigger event lock off");
            log("--");
          }, eventCancelTimer);
        }
        function triggerReset(triggerEvent) {
          height = getHeight[heightCalcMode]();
          width = getWidth[widthCalcMode]();
          sendMsg(height, width, triggerEvent);
        }
        function resetIFrame(triggerEventDesc) {
          var hcm = heightCalcMode;
          heightCalcMode = heightCalcModeDefault;
          log("Reset trigger event: " + triggerEventDesc);
          lockTrigger();
          triggerReset("reset");
          heightCalcMode = hcm;
        }
        function sendMsg(height2, width2, triggerEvent, msg, targetOrigin) {
          function setTargetOrigin() {
            if (undefined2 === targetOrigin) {
              targetOrigin = targetOriginDefault;
            } else {
              log("Message targetOrigin: " + targetOrigin);
            }
          }
          function sendToParent() {
            var size = height2 + ":" + width2, message = myID + ":" + size + ":" + triggerEvent + (undefined2 === msg ? "" : ":" + msg);
            log("Sending message to host page (" + message + ")");
            target.postMessage(msgID + message, targetOrigin);
          }
          if (true === sendPermit) {
            setTargetOrigin();
            sendToParent();
          }
        }
        function receiver(event) {
          var processRequestFromParent = {
            init: function initFromParent() {
              initMsg = event.data;
              target = event.source;
              init();
              firstRun = false;
              setTimeout(function() {
                initLock = false;
              }, eventCancelTimer);
            },
            reset: function resetFromParent() {
              if (initLock) {
                log("Page reset ignored by init");
              } else {
                log("Page size reset by host page");
                triggerReset("resetPage");
              }
            },
            resize: function resizeFromParent() {
              sendSize("resizeParent", "Parent window requested size check");
            },
            moveToAnchor: function moveToAnchorF() {
              inPageLinks.findTarget(getData());
            },
            inPageLink: function inPageLinkF() {
              this.moveToAnchor();
            },
            // Backward compatibility
            pageInfo: function pageInfoFromParent() {
              var msgBody = getData();
              log("PageInfoFromParent called from parent: " + msgBody);
              onPageInfo(JSON.parse(msgBody));
              log(" --");
            },
            message: function messageFromParent() {
              var msgBody = getData();
              log("onMessage called from parent: " + msgBody);
              onMessage(JSON.parse(msgBody));
              log(" --");
            }
          };
          function isMessageForUs() {
            return msgID === ("" + event.data).slice(0, msgIdLen);
          }
          function getMessageType() {
            return event.data.split("]")[1].split(":")[0];
          }
          function getData() {
            return event.data.slice(event.data.indexOf(":") + 1);
          }
          function isMiddleTier() {
            return !(typeof module !== "undefined" && module.exports) && "iFrameResize" in window || window.jQuery !== undefined2 && "iFrameResize" in window.jQuery.prototype;
          }
          function isInitMsg() {
            return event.data.split(":")[2] in { true: 1, false: 1 };
          }
          function callFromParent() {
            var messageType = getMessageType();
            if (messageType in processRequestFromParent) {
              processRequestFromParent[messageType]();
            } else if (!isMiddleTier() && !isInitMsg()) {
              warn("Unexpected message (" + event.data + ")");
            }
          }
          function processMessage() {
            if (false === firstRun) {
              callFromParent();
            } else if (isInitMsg()) {
              processRequestFromParent.init();
            } else {
              log(
                'Ignored message of type "' + getMessageType() + '". Received before initialization.'
              );
            }
          }
          if (isMessageForUs()) {
            processMessage();
          }
        }
        function chkLateLoaded() {
          if ("loading" !== document.readyState) {
            window.parent.postMessage("[iFrameResizerChild]Ready", "*");
          }
        }
        if (!("iframeResizer" in window)) {
          window.iframeChildListener = function(data) {
            receiver({ data, sameDomian: true });
          };
          addEventListener(window, "message", receiver);
          addEventListener(window, "readystatechange", chkLateLoaded);
          chkLateLoaded();
        }
      })();
    }
  });

  // node_modules/iframe-resizer/index.js
  var require_iframe_resizer = __commonJS({
    "node_modules/iframe-resizer/index.js"(exports, module) {
      var iframeResize = require_iframeResizer();
      module.exports = {
        iframeResize,
        iframeResizer: iframeResize,
        // Backwards compatibility
        contentWindow: require_iframeResizer_contentWindow()
      };
    }
  });

  // node_modules/@forge/bridge/out/view/adf-renderer.js
  var require_adf_renderer = __commonJS({
    "node_modules/@forge/bridge/out/view/adf-renderer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createAdfRendererIframeProps = exports.sendMessageWhenReady = void 0;
      var READY_SIGNAL_FALLBACK_DELAY_MS = 1e4;
      var sendMessageWhenReady = (iframe, message, origin) => {
        const sendMessage = () => {
          var _a;
          return (_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.postMessage(message, origin);
        };
        const timeoutId = setTimeout(() => {
          window.removeEventListener("message", handleReady);
          sendMessage();
        }, READY_SIGNAL_FALLBACK_DELAY_MS);
        const handleReady = (event) => {
          var _a;
          if (event.source === (iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.source) === "forge-adf-renderer-ready") {
            clearTimeout(timeoutId);
            window.removeEventListener("message", handleReady);
            sendMessage();
          }
        };
        window.addEventListener("message", handleReady);
      };
      exports.sendMessageWhenReady = sendMessageWhenReady;
      var createAdfRendererIframeProps = async (context, iframeId) => {
        const IframeResizer = await Promise.resolve().then(() => __toESM(require_iframe_resizer()));
        const IframeResizerModule = IframeResizer.default || IframeResizer;
        const origin = new URL(document.referrer).origin;
        const src = `${origin}/forge-apps/adf-renderer`;
        const id = iframeId || `forge-adf-renderer-iframe-${crypto.randomUUID()}`;
        const onLoad = () => {
          var _a, _b, _c, _d, _e;
          const iframe = document.getElementById(id);
          const message = {
            type: "adf-document",
            document: (_a = context.extension.macro) === null || _a === void 0 ? void 0 : _a.body,
            timestamp: Date.now(),
            source: "forge-adf-renderer",
            localId: context.localId,
            isEditing: (_c = (_b = context.extension) === null || _b === void 0 ? void 0 : _b.isEditing) !== null && _c !== void 0 ? _c : false,
            contentId: (_e = (_d = context.extension) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.id
          };
          IframeResizerModule.iframeResizer({
            heightCalculationMethod: "taggedElement",
            widthCalculationMethod: "bodyScroll",
            initCallback: (iframe2) => {
              var _a2;
              (_a2 = iframe2 === null || iframe2 === void 0 ? void 0 : iframe2.iFrameResizer) === null || _a2 === void 0 ? void 0 : _a2.resize();
            }
          }, iframe || "");
          (0, exports.sendMessageWhenReady)(iframe, message, origin);
        };
        setTimeout(() => {
          document.documentElement.style.height = "auto";
          document.body.style.height = "auto";
        }, 200);
        return {
          id,
          src,
          onLoad
        };
      };
      exports.createAdfRendererIframeProps = createAdfRendererIframeProps;
    }
  });

  // node_modules/@forge/bridge/out/view/onClose.js
  var require_onClose = __commonJS({
    "node_modules/@forge/bridge/out/view/onClose.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.onClose = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var onClose = async (payload) => {
        try {
          const success = await callBridge("onClose", payload);
          if (success === false) {
            throw new errors_1.BridgeAPIError("`onClose` call has failed.");
          }
        } catch (e) {
          throw new errors_1.BridgeAPIError("`onClose` failed because this resource's view is not closable.");
        }
      };
      exports.onClose = onClose;
    }
  });

  // node_modules/@forge/bridge/out/view/getFrameDispatch.js
  var require_getFrameDispatch = __commonJS({
    "node_modules/@forge/bridge/out/view/getFrameDispatch.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getFrameDispatch = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var getFrameDispatch = async () => {
        return await callBridge("getFrameDispatch");
      };
      exports.getFrameDispatch = getFrameDispatch;
    }
  });

  // node_modules/@forge/bridge/out/view/view.js
  var require_view = __commonJS({
    "node_modules/@forge/bridge/out/view/view.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.view = void 0;
      var submit_1 = require_submit();
      var close_1 = require_close();
      var open_1 = require_open();
      var refresh_1 = require_refresh();
      var createHistory_1 = require_createHistory();
      var getContext_1 = require_getContext();
      var changeWindowTitle_1 = require_changeWindowTitle();
      var theme_1 = require_theme();
      var emitReadyEvent_1 = require_emitReadyEvent();
      var adf_renderer_1 = require_adf_renderer();
      var onClose_1 = require_onClose();
      var getFrameDispatch_1 = require_getFrameDispatch();
      exports.view = {
        submit: submit_1.submit,
        close: close_1.close,
        onClose: onClose_1.onClose,
        open: open_1.open,
        refresh: refresh_1.refresh,
        createHistory: createHistory_1.createHistory,
        getContext: getContext_1.getContext,
        getFrameDispatch: getFrameDispatch_1.getFrameDispatch,
        theme: theme_1.theme,
        changeWindowTitle: changeWindowTitle_1.changeWindowTitle,
        emitReadyEvent: emitReadyEvent_1.emitReadyEvent,
        createAdfRendererIframeProps: adf_renderer_1.createAdfRendererIframeProps
      };
    }
  });

  // node_modules/@forge/bridge/out/view/index.js
  var require_view2 = __commonJS({
    "node_modules/@forge/bridge/out/view/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_view(), exports);
    }
  });

  // node_modules/@forge/bridge/out/router/router.js
  var require_router = __commonJS({
    "node_modules/@forge/bridge/out/router/router.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.router = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var getUrl = async (location) => {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
          throw new Error("target is required for getUrl");
        }
        const url = await callBridge("getUrl", location);
        if (!url) {
          throw new Error("Failed to get URL");
        }
        try {
          return new URL(url);
        } catch (error) {
          throw new Error(`Failed to parse URL: ${url} (${error})`);
        }
      };
      var navigate2 = (location) => {
        if (typeof location === "string") {
          return callBridge("navigate", { url: location, type: "same-tab" });
        } else {
          if (!(location === null || location === void 0 ? void 0 : location.target)) {
            throw new Error("target is required for navigation");
          }
          return callBridge("navigate", { ...location, type: "same-tab" });
        }
      };
      var open = (location) => {
        if (typeof location === "string") {
          return callBridge("navigate", { url: location, type: "new-tab" });
        } else {
          if (!(location === null || location === void 0 ? void 0 : location.target)) {
            throw new Error("target is required for navigation");
          }
          return callBridge("navigate", { ...location, type: "new-tab" });
        }
      };
      var reload = async () => callBridge("reload");
      exports.router = {
        getUrl,
        navigate: navigate2,
        open,
        reload
      };
    }
  });

  // node_modules/@forge/bridge/out/router/index.js
  var require_router2 = __commonJS({
    "node_modules/@forge/bridge/out/router/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_router(), exports);
    }
  });

  // node_modules/@forge/bridge/out/modal/modal.js
  var require_modal = __commonJS({
    "node_modules/@forge/bridge/out/modal/modal.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Modal = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var NAMED_MODAL_SIZES = ["small", "medium", "large", "xlarge", "max", "fullscreen", "resizable"];
      var noop = () => {
      };
      function isNamedModalSize(size) {
        return typeof size === "string" && NAMED_MODAL_SIZES.includes(size);
      }
      function isCustomModalSize(size) {
        if (typeof size !== "object" || size === null)
          return false;
        const s = size;
        return typeof s.width === "string" && (s.height === void 0 || typeof s.height === "string");
      }
      function isValidModalSize(size) {
        return isNamedModalSize(size) || isCustomModalSize(size);
      }
      var Modal = class {
        constructor(opts) {
          var _a, _b;
          this.resource = (opts === null || opts === void 0 ? void 0 : opts.resource) || null;
          this.onClose = (opts === null || opts === void 0 ? void 0 : opts.onClose) || noop;
          this.size = (opts === null || opts === void 0 ? void 0 : opts.size) || "medium";
          this.context = (opts === null || opts === void 0 ? void 0 : opts.context) || {};
          this.closeOnEscape = (_a = opts === null || opts === void 0 ? void 0 : opts.closeOnEscape) !== null && _a !== void 0 ? _a : true;
          this.closeOnOverlayClick = (_b = opts === null || opts === void 0 ? void 0 : opts.closeOnOverlayClick) !== null && _b !== void 0 ? _b : true;
          this.title = (opts === null || opts === void 0 ? void 0 : opts.title) || "";
          this.icon = (opts === null || opts === void 0 ? void 0 : opts.icon) || "";
        }
        async open() {
          if (!isValidModalSize(this.size)) {
            throw new errors_1.BridgeAPIError(`Invalid modal size: ${JSON.stringify(this.size)}. Must be one of the named sizes (${NAMED_MODAL_SIZES.join(", ")}) or a custom dimensions object with a "width" string property and an optional "height" string property.`);
          }
          try {
            const success = await callBridge("openModal", {
              resource: this.resource,
              onClose: this.onClose,
              size: this.size,
              context: this.context,
              closeOnEscape: this.closeOnEscape,
              closeOnOverlayClick: this.closeOnOverlayClick,
              title: this.title,
              icon: this.icon
            });
            if (success === false) {
              throw new errors_1.BridgeAPIError("Unable to open modal.");
            }
          } catch (err) {
            throw new errors_1.BridgeAPIError("Unable to open modal.");
          }
        }
      };
      exports.Modal = Modal;
    }
  });

  // node_modules/@forge/bridge/out/modal/index.js
  var require_modal2 = __commonJS({
    "node_modules/@forge/bridge/out/modal/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_modal(), exports);
    }
  });

  // node_modules/@forge/bridge/out/fetch/fetch.js
  var require_fetch = __commonJS({
    "node_modules/@forge/bridge/out/fetch/fetch.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.productFetchApi = exports.remoteFetchApi = void 0;
      var blobParser_1 = require_blobParser();
      var parseFormData = async (form, matchFilePrefix = false) => {
        const parsed = {};
        for (const [key, value] of form.entries()) {
          const isFileKey = matchFilePrefix ? key.startsWith("file") : key === "file";
          if (isFileKey) {
            const fileName = value.name;
            const fileType = value.type;
            parsed[key] = await (0, blobParser_1.blobToBase64)(value);
            parsed[`__${key}Name`] = fileName;
            parsed[`__${key}Type`] = fileType;
          } else {
            parsed[key] = value;
          }
        }
        return JSON.stringify(parsed);
      };
      var validateFetchOptions = (init) => {
        if (!init) {
          return init;
        }
        if ("signal" in init) {
          const { signal: _signal, ...rest } = init;
          console.error("Signal is not supported in @forge/bridge and was removed from fetch options. Please use the fetch method from @forge/api for signal support.");
          return rest;
        }
        return init;
      };
      var parseRequest = async (fetchType, init) => {
        const isFormData = (init === null || init === void 0 ? void 0 : init.body) instanceof FormData ? true : false;
        const requestBody = isFormData ? await parseFormData(init === null || init === void 0 ? void 0 : init.body, fetchType === "remote") : init === null || init === void 0 ? void 0 : init.body;
        const req = new Request("", { body: requestBody, method: init === null || init === void 0 ? void 0 : init.method, headers: init === null || init === void 0 ? void 0 : init.headers });
        const headers = Object.fromEntries(req.headers.entries());
        const body = req.method !== "GET" ? await req.text() : null;
        return {
          body,
          headers: new Headers(headers),
          isMultipartFormData: isFormData
        };
      };
      var remoteFetchApi = (callBridge) => {
        const fetch2 = async (remoteKey, init) => {
          const validatedInit = validateFetchOptions(init);
          const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("remote", validatedInit);
          const fetchPayload = {
            remoteKey,
            fetchRequestInit: { ...validatedInit, body: requestBody, headers: [...requestHeaders.entries()] },
            isMultipartFormData
          };
          const { body, headers, statusText: statusText2, status, isAttachment } = await callBridge("fetchRemote", fetchPayload);
          const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
          return new Response(responseBody || null, { headers, status, statusText: statusText2 });
        };
        return {
          requestRemote: (remoteKey, fetchOptions) => fetch2(remoteKey, fetchOptions)
        };
      };
      exports.remoteFetchApi = remoteFetchApi;
      var productFetchApi = (callBridge) => {
        const fetch2 = async (product, restPath, init) => {
          const validatedInit = validateFetchOptions(init);
          const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("product", validatedInit);
          if (!requestHeaders.has("X-Atlassian-Token")) {
            requestHeaders.set("X-Atlassian-Token", "no-check");
          }
          const fetchPayload = {
            product,
            restPath,
            fetchRequestInit: {
              ...validatedInit,
              body: requestBody,
              headers: [...requestHeaders.entries()]
            },
            isMultipartFormData
          };
          const { body, headers, statusText: statusText2, status, isAttachment } = await callBridge("fetchProduct", fetchPayload);
          const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
          return new Response(responseBody || null, { headers, status, statusText: statusText2 });
        };
        return {
          requestConfluence: (restPath, fetchOptions) => fetch2("confluence", restPath, fetchOptions),
          requestJira: (restPath, fetchOptions) => fetch2("jira", restPath, fetchOptions),
          requestBitbucket: (restPath, fetchOptions) => fetch2("bitbucket", restPath, fetchOptions)
        };
      };
      exports.productFetchApi = productFetchApi;
    }
  });

  // node_modules/@forge/bridge/out/fetch/index.js
  var require_fetch2 = __commonJS({
    "node_modules/@forge/bridge/out/fetch/index.js"(exports) {
      "use strict";
      var _a;
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fetchUserRecommendations = exports.requestRemote = exports.requestBitbucket = exports.requestJira = exports.requestConfluence = void 0;
      var bridge_1 = require_bridge();
      var fetch_1 = require_fetch();
      _a = (0, fetch_1.productFetchApi)((0, bridge_1.getCallBridge)()), exports.requestConfluence = _a.requestConfluence, exports.requestJira = _a.requestJira, exports.requestBitbucket = _a.requestBitbucket;
      exports.requestRemote = (0, fetch_1.remoteFetchApi)((0, bridge_1.getCallBridge)()).requestRemote;
      var fetchUserRecommendations = async (input) => {
        const callBridge = (0, bridge_1.getCallBridge)();
        return await callBridge("fetchUserRecommendations", input);
      };
      exports.fetchUserRecommendations = fetchUserRecommendations;
    }
  });

  // node_modules/@forge/bridge/out/requestTeamworkGraph/index.js
  var require_requestTeamworkGraph = __commonJS({
    "node_modules/@forge/bridge/out/requestTeamworkGraph/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.requestTeamworkGraph = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var requestTeamworkGraph = async (query, variables) => {
        const response = await callBridge("requestTeamworkGraph", { query, variables });
        return response;
      };
      exports.requestTeamworkGraph = requestTeamworkGraph;
    }
  });

  // node_modules/@forge/bridge/out/flag/flag.js
  var require_flag = __commonJS({
    "node_modules/@forge/bridge/out/flag/flag.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.showFlag = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var showFlag2 = (options) => {
        var _a;
        if (!options.id) {
          throw new errors_1.BridgeAPIError('"id" must be defined in flag options');
        }
        const result = callBridge("showFlag", {
          ...options,
          type: (_a = options.type) !== null && _a !== void 0 ? _a : "info"
        });
        return {
          close: async () => {
            await result;
            return callBridge("closeFlag", { id: options.id });
          }
        };
      };
      exports.showFlag = showFlag2;
    }
  });

  // node_modules/@forge/bridge/out/flag/index.js
  var require_flag2 = __commonJS({
    "node_modules/@forge/bridge/out/flag/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.showFlag = void 0;
      var flag_1 = require_flag();
      Object.defineProperty(exports, "showFlag", { enumerable: true, get: function() {
        return flag_1.showFlag;
      } });
    }
  });

  // node_modules/@forge/bridge/out/events/index.js
  var require_events2 = __commonJS({
    "node_modules/@forge/bridge/out/events/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_events(), exports);
    }
  });

  // node_modules/@forge/bridge/out/realtime/realtime.js
  var require_realtime = __commonJS({
    "node_modules/@forge/bridge/out/realtime/realtime.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.realtime = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var publish = (channel, payload, options) => {
        return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options });
      };
      var subscribe = (channel, callback, options) => {
        return callBridge("subscribeRealtimeChannel", {
          channelName: channel,
          onEvent: callback,
          options
        });
      };
      var publishGlobal = (channel, payload, options) => {
        return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options, isGlobal: true });
      };
      var subscribeGlobal = (channel, callback, options) => {
        return callBridge("subscribeRealtimeChannel", {
          channelName: channel,
          onEvent: callback,
          options,
          isGlobal: true
        });
      };
      exports.realtime = {
        publish,
        subscribe,
        publishGlobal,
        subscribeGlobal
      };
    }
  });

  // node_modules/@forge/bridge/out/realtime/productContext.js
  var require_productContext = __commonJS({
    "node_modules/@forge/bridge/out/realtime/productContext.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Bitbucket = exports.Confluence = exports.Jira = void 0;
      var Jira;
      (function(Jira2) {
        Jira2["Board"] = "board";
        Jira2["Issue"] = "issue";
        Jira2["Project"] = "project";
      })(Jira || (exports.Jira = Jira = {}));
      var Confluence;
      (function(Confluence2) {
        Confluence2["Content"] = "content";
        Confluence2["Space"] = "space";
      })(Confluence || (exports.Confluence = Confluence = {}));
      var Bitbucket;
      (function(Bitbucket2) {
        Bitbucket2["Repository"] = "repository";
        Bitbucket2["PullRequest"] = "pullRequest";
      })(Bitbucket || (exports.Bitbucket = Bitbucket = {}));
    }
  });

  // node_modules/@forge/bridge/out/realtime/index.js
  var require_realtime2 = __commonJS({
    "node_modules/@forge/bridge/out/realtime/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Bitbucket = exports.Confluence = exports.Jira = exports.realtime = void 0;
      var realtime_1 = require_realtime();
      Object.defineProperty(exports, "realtime", { enumerable: true, get: function() {
        return realtime_1.realtime;
      } });
      var productContext_1 = require_productContext();
      Object.defineProperty(exports, "Jira", { enumerable: true, get: function() {
        return productContext_1.Jira;
      } });
      Object.defineProperty(exports, "Confluence", { enumerable: true, get: function() {
        return productContext_1.Confluence;
      } });
      Object.defineProperty(exports, "Bitbucket", { enumerable: true, get: function() {
        return productContext_1.Bitbucket;
      } });
    }
  });

  // node_modules/@forge/bridge/out/rovo/open.js
  var require_open2 = __commonJS({
    "node_modules/@forge/bridge/out/rovo/open.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.open = exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var MAX_AGENT_LENGTH = 30;
      var callBridge = (0, bridge_1.getCallBridge)();
      exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = "Unable to open Rovo Chat due to usage in an unsupported product. Only Confluence, Jira and some Jira Service Management modules are supported at this point. See https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/";
      var transformRovoPayload = (openRovoPayload) => {
        switch (openRovoPayload.type) {
          case "forge":
            return {
              agentName: openRovoPayload.agentName,
              agentKey: openRovoPayload.agentKey,
              prompt: openRovoPayload.prompt
            };
          case "atlassian":
            return {
              agentName: openRovoPayload.agentName,
              prompt: openRovoPayload.prompt
            };
          default:
            return { prompt: openRovoPayload.prompt };
        }
      };
      var open = async (openRovoPayload) => {
        if (openRovoPayload.type === "forge") {
          if (openRovoPayload.agentName.length > MAX_AGENT_LENGTH) {
            throw new Error("rovo agent name too long");
          }
          if (openRovoPayload.agentKey.length > MAX_AGENT_LENGTH) {
            throw new Error("rovo agent key too long");
          }
        }
        const rovoArgs = transformRovoPayload(openRovoPayload);
        const success = await callBridge("openRovo", rovoArgs);
        if (success === false) {
          throw new errors_1.BridgeAPIError(exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE);
        }
      };
      exports.open = open;
    }
  });

  // node_modules/@forge/bridge/out/rovo/isEnabled.js
  var require_isEnabled = __commonJS({
    "node_modules/@forge/bridge/out/rovo/isEnabled.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.isEnabled = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var isEnabled = () => {
        return callBridge("isRovoEnabled");
      };
      exports.isEnabled = isEnabled;
    }
  });

  // node_modules/@forge/bridge/out/rovo/rovo.js
  var require_rovo = __commonJS({
    "node_modules/@forge/bridge/out/rovo/rovo.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.rovo = void 0;
      var open_1 = require_open2();
      var isEnabled_1 = require_isEnabled();
      exports.rovo = {
        open: open_1.open,
        isEnabled: isEnabled_1.isEnabled
      };
    }
  });

  // node_modules/@forge/bridge/out/rovo/index.js
  var require_rovo2 = __commonJS({
    "node_modules/@forge/bridge/out/rovo/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_rovo(), exports);
    }
  });

  // node_modules/@forge/bridge/out/cookieConsent/getCookieConsentPreferences.js
  var require_getCookieConsentPreferences = __commonJS({
    "node_modules/@forge/bridge/out/cookieConsent/getCookieConsentPreferences.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getCookieConsentPreferences = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var getCookieConsentPreferences = async () => {
        var _a;
        try {
          return (_a = await callBridge("getCookieConsentPreferences")) !== null && _a !== void 0 ? _a : null;
        } catch {
          return null;
        }
      };
      exports.getCookieConsentPreferences = getCookieConsentPreferences;
    }
  });

  // node_modules/@forge/bridge/out/cookieConsent/index.js
  var require_cookieConsent = __commonJS({
    "node_modules/@forge/bridge/out/cookieConsent/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_getCookieConsentPreferences(), exports);
    }
  });

  // node_modules/@forge/bridge/out/i18n/index.js
  var require_i18n = __commonJS({
    "node_modules/@forge/bridge/out/i18n/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createTranslationFunction = exports.getTranslations = exports.resetTranslationsCache = void 0;
      var i18n_1 = require_out();
      var view_1 = require_view2();
      var frontendResourcesAccessor = {
        getI18nInfoConfig: async () => {
          const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${i18n_1.I18N_INFO_FILE_NAME}`);
          if (!resp.ok) {
            throw new Error("Failed to get i18n info config: " + resp.statusText);
          }
          const info = await resp.json();
          return info.config;
        },
        getTranslationResource: async (locale) => {
          const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${locale}.json`);
          if (!resp.ok) {
            throw new Error(`Failed to get translation resource for locale: ${locale}`);
          }
          return resp.json();
        }
      };
      var translationsGetter = new i18n_1.TranslationsGetter(frontendResourcesAccessor);
      var resetTranslationsCache = () => {
        translationsGetter.reset();
      };
      exports.resetTranslationsCache = resetTranslationsCache;
      var getTranslations = async (locale = null, options = {
        fallback: true
      }) => {
        let targetLocale = locale;
        if (!targetLocale) {
          const context = await view_1.view.getContext();
          targetLocale = context.locale;
        }
        return await translationsGetter.getTranslations(targetLocale, options);
      };
      exports.getTranslations = getTranslations;
      var createTranslationFunction = async (locale = null) => {
        let targetLocale = locale;
        if (!targetLocale) {
          const context = await view_1.view.getContext();
          targetLocale = context.locale;
        }
        const translator = new i18n_1.Translator(targetLocale, translationsGetter);
        await translator.init();
        return (i18nKey, defaultValue) => {
          var _a, _b;
          return (_b = (_a = translator.translate(i18nKey)) !== null && _a !== void 0 ? _a : defaultValue) !== null && _b !== void 0 ? _b : i18nKey;
        };
      };
      exports.createTranslationFunction = createTranslationFunction;
    }
  });

  // node_modules/@forge/bridge/out/permissions/permissions.js
  var require_permissions = __commonJS({
    "node_modules/@forge/bridge/out/permissions/permissions.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.permissions = void 0;
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var egressGet = async (payload) => {
        return callBridge("__permission__egressGet", payload);
      };
      var egressSet = async (payload) => {
        return callBridge("__permission__egressSet", payload);
      };
      var egressDeleteDomain = async (payload) => {
        return callBridge("__permission__egressDeleteDomain", payload);
      };
      var egressDeleteGroup = async (payload) => {
        return callBridge("__permission__egressDeleteGroup", payload);
      };
      var remoteGet = async (payload) => {
        return callBridge("__permission__remoteGet", payload);
      };
      var remoteSet = async (payload) => {
        return callBridge("__permission__remoteSet", payload);
      };
      exports.permissions = {
        egress: {
          get: egressGet,
          set: egressSet,
          deleteDomain: egressDeleteDomain,
          deleteGroup: egressDeleteGroup
        },
        remote: {
          get: remoteGet,
          set: remoteSet
        }
      };
    }
  });

  // node_modules/@forge/egress/out/egress/url-parser.js
  var require_url_parser = __commonJS({
    "node_modules/@forge/egress/out/egress/url-parser.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.parseUrl = parseUrl;
      function parseUrl(url) {
        var _a, _b;
        const protocol = (_b = (_a = url.match(/^(.*?:)/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : "https:";
        const hostAndPath = url.replace(protocol, "").replace(/^\/*/, "").replace(/^\\*/, "").split("?")[0].split("#")[0];
        const hostname = hostAndPath.split("/")[0];
        const pathname = hostAndPath.slice(hostname.length) || "/";
        return { protocol, hostname, pathname };
      }
    }
  });

  // node_modules/@forge/egress/out/egress/utils.js
  var require_utils2 = __commonJS({
    "node_modules/@forge/egress/out/egress/utils.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getEgressesBasedOnToggles = exports.sortAndGroupEgressPermissionsByDomain = exports.EgressCategory = exports.EgressType = void 0;
      exports.globToRegex = globToRegex;
      var url_parser_1 = require_url_parser();
      function globToRegex(pattern) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        const regexPattern = escaped.replace(/\*/g, ".*");
        return new RegExp(`^${regexPattern}$`);
      }
      var sortAndGroupEgressPermissionsByDomain = (egressAddresses) => {
        if ((egressAddresses === null || egressAddresses === void 0 ? void 0 : egressAddresses.length) === 0) {
          return [];
        }
        const protocolRegex = /^(.*?:\/\/)/;
        const domains = /* @__PURE__ */ new Set();
        const wildcardDomains = [];
        egressAddresses.forEach((item) => {
          const itemWithProtocol = protocolRegex.test(item) ? item : `https://${item}`;
          const url = (0, url_parser_1.parseUrl)(itemWithProtocol);
          if (url.hostname.startsWith("*")) {
            domains.add(url.hostname.substring(2));
            wildcardDomains.push(globToRegex(url.hostname));
          } else {
            domains.add(url.hostname);
          }
        });
        return [...domains].sort().reduce((grouped, domain) => {
          if (!wildcardDomains.some((pattern) => pattern.test(domain))) {
            grouped.push(domain);
          }
          return grouped;
        }, []);
      };
      exports.sortAndGroupEgressPermissionsByDomain = sortAndGroupEgressPermissionsByDomain;
      var EgressType;
      (function(EgressType2) {
        EgressType2["FetchBackendSide"] = "FETCH_BACKEND_SIDE";
        EgressType2["FetchClientSide"] = "FETCH_CLIENT_SIDE";
        EgressType2["Fonts"] = "FONTS";
        EgressType2["Frames"] = "FRAMES";
        EgressType2["Images"] = "IMAGES";
        EgressType2["Media"] = "MEDIA";
        EgressType2["Scripts"] = "SCRIPTS";
        EgressType2["Styles"] = "STYLES";
      })(EgressType || (exports.EgressType = EgressType = {}));
      var EgressCategory;
      (function(EgressCategory2) {
        EgressCategory2["ANALYTICS"] = "ANALYTICS";
      })(EgressCategory || (exports.EgressCategory = EgressCategory = {}));
      var getEgressesBasedOnToggles = (input) => {
        const filteredEgresses = input.egress.filter((egress) => {
          var _a;
          if (((_a = egress.category) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === EgressCategory.ANALYTICS) {
            if (input.installationConfig) {
              const analyticsConfig = input.installationConfig.find((config) => config.key.toUpperCase() === "ALLOW_EGRESS_ANALYTICS");
              return (analyticsConfig === null || analyticsConfig === void 0 ? void 0 : analyticsConfig.value) !== false;
            } else {
              return input.overrides.ALLOW_EGRESS_ANALYTICS !== false;
            }
          }
          return true;
        });
        const egressByType = /* @__PURE__ */ new Map();
        for (const egress of filteredEgresses) {
          if (!egressByType.has(egress.type)) {
            egressByType.set(egress.type, egress.addresses);
          }
          egressByType.set(egress.type, [...egressByType.get(egress.type), ...egress.addresses]);
        }
        return [...egressByType.entries()].map(([type, egresses]) => ({
          type,
          addresses: [...new Set(egresses)]
        }));
      };
      exports.getEgressesBasedOnToggles = getEgressesBasedOnToggles;
    }
  });

  // node_modules/@forge/egress/out/egress/egress-filtering-service.js
  var require_egress_filtering_service = __commonJS({
    "node_modules/@forge/egress/out/egress/egress-filtering-service.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.EgressFilteringService = void 0;
      var url_parser_1 = require_url_parser();
      var utils_1 = require_utils2();
      var EgressFilteringService = class {
        constructor(allowList) {
          this.URLs = allowList.filter((domainOrURL) => !domainOrURL.startsWith("*")).map((url) => this.parseUrl(url));
          this.wildcardDomains = allowList.filter((domainOrURL) => domainOrURL !== "*").map((url) => this.parseUrl(url)).filter((url) => decodeURIComponent(url.hostname).startsWith("*")).map((url) => ({
            ...url,
            regex: (0, utils_1.globToRegex)(decodeURIComponent(url.hostname))
          }));
          this.allowsEverything = allowList.includes("*");
        }
        parseUrl(url) {
          return (0, url_parser_1.parseUrl)(url);
        }
        containsWildCardEgress() {
          return this.allowsEverything;
        }
        isValidUrl(url) {
          if (this.allowsEverything) {
            return true;
          }
          const parsedUrl = this.parseUrl(url);
          return this.allowedDomainExact(parsedUrl, this.URLs) || this.allowedDomainPattern(parsedUrl, this.wildcardDomains);
        }
        isValidUrlCSP(url) {
          if (this.allowsEverything) {
            return true;
          }
          const parsedUrl = this.parseUrl(url);
          return this.allowedDomainExactAndPath(parsedUrl, this.URLs) || this.allowedDomainPatternAndPath(parsedUrl, this.wildcardDomains);
        }
        allowedDomainExact(domain, allowList) {
          return allowList.filter((allowed) => allowed.protocol === domain.protocol).some((url) => url.hostname === domain.hostname);
        }
        allowedDomainExactAndPath(domain, allowList) {
          return allowList.filter((allowed) => this.protocolMatchesCSP(allowed.protocol, domain.protocol)).filter((allowed) => allowed.hostname === domain.hostname).some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
        }
        allowedDomainPattern(domain, allowList) {
          return allowList.filter((allowed) => allowed.protocol === domain.protocol).some((pattern) => pattern.regex.test(domain.hostname));
        }
        allowedDomainPatternAndPath(domain, allowList) {
          return allowList.filter((pattern) => this.protocolMatchesCSP(pattern.protocol, domain.protocol)).filter((pattern) => pattern.regex.test(domain.hostname)).some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
        }
        protocolMatchesCSP(allowedProtocol, requestProtocol) {
          if (allowedProtocol === requestProtocol) {
            return true;
          }
          if (allowedProtocol === "http:" && requestProtocol === "https:") {
            return true;
          }
          if (allowedProtocol === "ws:" && requestProtocol === "wss:") {
            return true;
          }
          return false;
        }
        pathMatches(allowedPath, requestPath) {
          if (allowedPath === "/") {
            return true;
          }
          if (allowedPath.endsWith("/")) {
            return requestPath.startsWith(allowedPath);
          }
          return requestPath === allowedPath;
        }
      };
      exports.EgressFilteringService = EgressFilteringService;
    }
  });

  // node_modules/@forge/egress/out/egress/index.js
  var require_egress = __commonJS({
    "node_modules/@forge/egress/out/egress/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_egress_filtering_service(), exports);
      tslib_1.__exportStar(require_url_parser(), exports);
      tslib_1.__exportStar(require_utils2(), exports);
    }
  });

  // node_modules/@forge/egress/out/index.js
  var require_out2 = __commonJS({
    "node_modules/@forge/egress/out/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_egress(), exports);
    }
  });

  // node_modules/@forge/bridge/out/permissions/permissionsUtil.js
  var require_permissionsUtil = __commonJS({
    "node_modules/@forge/bridge/out/permissions/permissionsUtil.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createPermissionUtils = createPermissionUtils;
      exports.checkPermissions = checkPermissions;
      var egress_1 = require_out2();
      var view_1 = require_view2();
      function extractUrlString(url) {
        if (typeof url === "string") {
          return url;
        }
        if ("address" in url && url.address) {
          return url.address;
        }
        return url.remote || "";
      }
      var RESOURCE_TYPES = ["fonts", "styles", "frames", "images", "media", "scripts"];
      var FETCH_TYPES = ["backend", "client"];
      function createPermissionUtils(runtimePermissions) {
        if (!runtimePermissions) {
          return null;
        }
        const { scopes, external = {} } = runtimePermissions;
        const scopeArray = Array.isArray(scopes) ? scopes : Object.keys(scopes || {});
        return {
          hasScope: (scope) => scopeArray.includes(scope),
          canFetchFrom: (type, url) => {
            var _a;
            const fetchUrls = (_a = external.fetch) === null || _a === void 0 ? void 0 : _a[type];
            if (!(fetchUrls === null || fetchUrls === void 0 ? void 0 : fetchUrls.length))
              return false;
            const allowList = fetchUrls.map(extractUrlString).filter((u) => u.length > 0);
            if (allowList.length === 0)
              return false;
            const egressFilter = new egress_1.EgressFilteringService(allowList);
            const egressFilterWithCSP = egressFilter;
            return type === "client" ? egressFilterWithCSP.isValidUrlCSP(url) : egressFilter.isValidUrl(url);
          },
          canLoadResource: (type, url) => {
            const resourceUrls = external[type];
            if (!(resourceUrls === null || resourceUrls === void 0 ? void 0 : resourceUrls.length))
              return false;
            const allowList = resourceUrls.map(extractUrlString).filter((u) => u.length > 0);
            if (allowList.length === 0)
              return false;
            const egressFilter = new egress_1.EgressFilteringService(allowList);
            const egressFilterWithCSP = egressFilter;
            return egressFilterWithCSP.isValidUrlCSP(url);
          },
          getScopes: () => scopeArray,
          getExternalPermissions: () => external,
          hasAnyPermissions: () => scopeArray.length > 0 || Object.keys(external).length > 0
        };
      }
      function checkScopes(requiredScopes, permissionUtils) {
        if (!(requiredScopes === null || requiredScopes === void 0 ? void 0 : requiredScopes.length)) {
          return void 0;
        }
        const missingScopes = requiredScopes.filter((scope) => !permissionUtils.hasScope(scope));
        return missingScopes.length > 0 ? missingScopes : void 0;
      }
      function checkFetchPermissions(requiredFetch, permissionUtils) {
        if (!(requiredFetch === null || requiredFetch === void 0 ? void 0 : requiredFetch.fetch)) {
          return void 0;
        }
        const missingFetch = {};
        FETCH_TYPES.forEach((type) => {
          var _a;
          const requiredUrls = (_a = requiredFetch.fetch) === null || _a === void 0 ? void 0 : _a[type];
          if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
            const missingUrls = requiredUrls.filter((url) => !permissionUtils.canFetchFrom(type, url));
            if (missingUrls.length > 0) {
              missingFetch[type] = missingUrls;
            }
          }
        });
        return Object.keys(missingFetch).length > 0 ? missingFetch : void 0;
      }
      function checkResourcePermissions(requiredExternal, permissionUtils) {
        const missingResources = {};
        RESOURCE_TYPES.forEach((type) => {
          const requiredUrls = requiredExternal === null || requiredExternal === void 0 ? void 0 : requiredExternal[type];
          if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
            const missingUrls = requiredUrls.filter((url) => !permissionUtils.canLoadResource(type, url));
            if (missingUrls.length > 0) {
              missingResources[type] = missingUrls;
            }
          }
        });
        return Object.keys(missingResources).length > 0 ? missingResources : void 0;
      }
      function checkExternalPermissions(requiredExternal, permissionUtils) {
        if (!requiredExternal) {
          return void 0;
        }
        const missingFetch = checkFetchPermissions(requiredExternal, permissionUtils);
        const missingResources = checkResourcePermissions(requiredExternal, permissionUtils);
        if (!missingFetch && !missingResources) {
          return void 0;
        }
        const missingExternal = {};
        if (missingFetch) {
          missingExternal.fetch = missingFetch;
        }
        if (missingResources) {
          Object.assign(missingExternal, missingResources);
        }
        return missingExternal;
      }
      function validateObjectField(value, fieldPath) {
        if (value !== void 0) {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? "an array" : `a ${typeof value}`}`);
          }
        }
      }
      function validateArrayField(value, fieldPath) {
        if (value !== void 0 && !Array.isArray(value)) {
          throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
        }
      }
      function validatePermissionShape(requiredPermissions) {
        validateArrayField(requiredPermissions.scopes, "scopes");
        const external = requiredPermissions.external;
        if (external === void 0)
          return;
        validateObjectField(external, "external");
        if (external.fetch !== void 0) {
          validateObjectField(external.fetch, "external.fetch");
          for (const type of FETCH_TYPES) {
            validateArrayField(external.fetch[type], `external.fetch.${type}`);
          }
        }
        for (const type of RESOURCE_TYPES) {
          validateArrayField(external[type], `external.${type}`);
        }
      }
      async function checkPermissions(requiredPermissions, runtimePermissions) {
        var _a;
        if (!requiredPermissions) {
          return { granted: false, missing: null };
        }
        validatePermissionShape(requiredPermissions);
        if (!((_a = requiredPermissions.scopes) === null || _a === void 0 ? void 0 : _a.length) && !requiredPermissions.external) {
          return { granted: true, missing: null };
        }
        let permissionsToCheck = runtimePermissions;
        if (!permissionsToCheck) {
          const context = await view_1.view.getContext();
          permissionsToCheck = context.permissions;
        }
        const permissionUtils = createPermissionUtils(permissionsToCheck);
        if (!permissionUtils) {
          return { granted: false, missing: null };
        }
        const missing = {};
        let hasAllRequiredPermissions = true;
        const missingScopes = checkScopes(requiredPermissions.scopes, permissionUtils);
        if (missingScopes) {
          missing.scopes = missingScopes;
          hasAllRequiredPermissions = false;
        }
        const missingExternal = checkExternalPermissions(requiredPermissions.external, permissionUtils);
        if (missingExternal) {
          missing.external = missingExternal;
          hasAllRequiredPermissions = false;
        }
        return {
          granted: hasAllRequiredPermissions,
          missing: hasAllRequiredPermissions ? null : missing
        };
      }
    }
  });

  // node_modules/@forge/bridge/out/permissions/index.js
  var require_permissions2 = __commonJS({
    "node_modules/@forge/bridge/out/permissions/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_permissions(), exports);
      tslib_1.__exportStar(require_permissionsUtil(), exports);
    }
  });

  // node_modules/@forge/bridge/out/object-store/upload.js
  var require_upload = __commonJS({
    "node_modules/@forge/bridge/out/object-store/upload.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.upload = exports.createUploadPromises = void 0;
      var invoke_1 = require_invoke2();
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var base64ToBlob = (base64, mimeType) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType || "application/octet-stream" });
      };
      var getObjectMetadata = async (blob) => {
        const length = blob.size;
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = new Uint8Array(hashBuffer);
        const checksum = btoa(String.fromCharCode(...hashArray));
        const checksumType = "SHA256";
        return {
          length,
          checksum,
          checksumType
        };
      };
      var createUploadPromises = async ({ functionKey, objects }) => {
        if (!functionKey || functionKey.length === 0) {
          throw new errors_1.BridgeAPIError("functionKey is required to filter and generate presigned URLs");
        }
        if (!Array.isArray(objects) || objects.length === 0) {
          throw new errors_1.BridgeAPIError("objects array is required and must not be empty");
        }
        const blobs = objects.map((obj, index) => {
          if (obj instanceof Blob) {
            return obj;
          }
          const isBase64Object = obj && typeof obj === "object" && "data" in obj && typeof obj.data === "string";
          if (!isBase64Object) {
            throw new errors_1.BridgeAPIError(`Invalid object type at index ${index}. Only Blob or Base64Object (with data string and optional mimeType) are accepted.`);
          }
          try {
            return base64ToBlob(obj.data, obj.mimeType);
          } catch (e) {
            throw new errors_1.BridgeAPIError(`Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`);
          }
        });
        const allObjectMetadata = await Promise.all(blobs.map((blob) => getObjectMetadata(blob)));
        const presignedURLsToObjectMetadata = await (0, invoke_1.invoke)(functionKey, {
          allObjectMetadata
        });
        if (!presignedURLsToObjectMetadata || typeof presignedURLsToObjectMetadata !== "object") {
          throw new errors_1.BridgeAPIError("Invalid response from functionKey");
        }
        const checksumToBlobMap = /* @__PURE__ */ new Map();
        const checksumToIndexMap = /* @__PURE__ */ new Map();
        blobs.forEach((blob, index) => {
          const metadata = allObjectMetadata[index];
          checksumToBlobMap.set(metadata.checksum, blob);
          checksumToIndexMap.set(metadata.checksum, index);
        });
        const uploadPromises = Object.entries(presignedURLsToObjectMetadata).map(([presignedUrl, metadata]) => {
          const { key, checksum } = metadata;
          const object = checksumToBlobMap.get(checksum);
          const index = checksumToIndexMap.get(checksum);
          if (index === void 0) {
            return {
              promise: Promise.resolve({
                success: false,
                key,
                error: `Index not found for checksum ${checksum}`
              }),
              index: -1
            };
          }
          if (!object) {
            return {
              promise: Promise.resolve({
                success: false,
                key,
                error: `Blob not found for checksum ${checksum}`
              }),
              index
            };
          }
          const uploadPromise = (async () => {
            try {
              const response = await fetch(presignedUrl, {
                method: "PUT",
                body: object,
                headers: {
                  "Content-Type": object.type || "application/octet-stream",
                  "Content-Length": object.size.toString()
                }
              });
              return {
                success: response.ok,
                key,
                status: response.status,
                error: response.ok ? void 0 : `Upload failed with status ${response.status}`
              };
            } catch (error) {
              return {
                success: false,
                key,
                status: 503,
                error: error instanceof Error ? error.message : "Upload failed"
              };
            }
          })();
          return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
        });
        return uploadPromises;
      };
      exports.createUploadPromises = createUploadPromises;
      var upload = async ({ functionKey, objects }) => {
        void callBridge("trackObjectStoreAction", { action: "upload" });
        const uploadPromises = await (0, exports.createUploadPromises)({ functionKey, objects });
        const results = await Promise.all(uploadPromises.map((item) => item.promise));
        return results;
      };
      exports.upload = upload;
    }
  });

  // node_modules/@forge/bridge/out/object-store/deleteObjects.js
  var require_deleteObjects = __commonJS({
    "node_modules/@forge/bridge/out/object-store/deleteObjects.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.deleteObjects = void 0;
      var invoke_1 = require_invoke2();
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var deleteObjects = async ({ functionKey, keys }) => {
        void callBridge("trackObjectStoreAction", { action: "delete" });
        if (!functionKey || functionKey.length === 0) {
          throw new errors_1.BridgeAPIError("functionKey is required to delete objects");
        }
        if (!Array.isArray(keys) || keys.length === 0) {
          throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
        }
        await Promise.all(keys.map(async (key) => {
          await (0, invoke_1.invoke)(functionKey, { key });
        }));
      };
      exports.deleteObjects = deleteObjects;
    }
  });

  // node_modules/@forge/bridge/out/object-store/download.js
  var require_download = __commonJS({
    "node_modules/@forge/bridge/out/object-store/download.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.download = void 0;
      var invoke_1 = require_invoke2();
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var download2 = async ({ functionKey, keys }) => {
        void callBridge("trackObjectStoreAction", { action: "download" });
        if (!functionKey || functionKey.length === 0) {
          throw new errors_1.BridgeAPIError("functionKey is required to filter and generate download URLs");
        }
        if (!Array.isArray(keys) || keys.length === 0) {
          throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
        }
        const downloadUrlsTokeys = await (0, invoke_1.invoke)(functionKey, {
          keys
        });
        if (!downloadUrlsTokeys || typeof downloadUrlsTokeys !== "object") {
          throw new errors_1.BridgeAPIError("Invalid response from functionKey");
        }
        const downloadPromises = Object.entries(downloadUrlsTokeys).map(async ([downloadUrl, key]) => {
          try {
            const response = await fetch(downloadUrl, {
              method: "GET"
            });
            if (!response.ok) {
              return {
                success: false,
                key,
                status: response.status,
                error: `Download failed with status ${response.status}`
              };
            }
            const blob = await response.blob();
            return {
              success: true,
              key,
              blob,
              status: response.status
            };
          } catch (error) {
            return {
              success: false,
              key,
              status: 503,
              error: error instanceof Error ? error.message : "Download failed"
            };
          }
        });
        const results = await Promise.all(downloadPromises);
        return results;
      };
      exports.download = download2;
    }
  });

  // node_modules/@forge/bridge/out/object-store/getMetadata.js
  var require_getMetadata = __commonJS({
    "node_modules/@forge/bridge/out/object-store/getMetadata.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getMetadata = void 0;
      var index_1 = require_invoke2();
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var getMetadata = async ({ functionKey, keys }) => {
        void callBridge("trackObjectStoreAction", { action: "getMetadata" });
        if (!functionKey || functionKey.length === 0) {
          throw new errors_1.BridgeAPIError("functionKey is required to filter and generate object metadata");
        }
        if (!Array.isArray(keys) || keys.length === 0) {
          throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
        }
        const results = await Promise.all(keys.map(async (key) => {
          const result = await (0, index_1.invoke)(functionKey, { key });
          if (!result || typeof result !== "object") {
            return {
              key,
              error: "Invalid response from functionKey"
            };
          }
          return result;
        }));
        return results;
      };
      exports.getMetadata = getMetadata;
    }
  });

  // node_modules/@forge/bridge/out/object-store/objectStore.js
  var require_objectStore = __commonJS({
    "node_modules/@forge/bridge/out/object-store/objectStore.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.createUploadPromises = exports.objectStore = void 0;
      var upload_1 = require_upload();
      Object.defineProperty(exports, "createUploadPromises", { enumerable: true, get: function() {
        return upload_1.createUploadPromises;
      } });
      var deleteObjects_1 = require_deleteObjects();
      var download_1 = require_download();
      var getMetadata_1 = require_getMetadata();
      exports.objectStore = {
        upload: upload_1.upload,
        download: download_1.download,
        getMetadata: getMetadata_1.getMetadata,
        delete: deleteObjects_1.deleteObjects
      };
    }
  });

  // node_modules/@forge/bridge/out/object-store/types.js
  var require_types2 = __commonJS({
    "node_modules/@forge/bridge/out/object-store/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/@forge/bridge/out/object-store/index.js
  var require_object_store = __commonJS({
    "node_modules/@forge/bridge/out/object-store/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_objectStore(), exports);
      tslib_1.__exportStar(require_types2(), exports);
    }
  });

  // node_modules/@forge/bridge/out/featureFlags/evaluator.js
  var require_evaluator = __commonJS({
    "node_modules/@forge/bridge/out/featureFlags/evaluator.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Evaluator = void 0;
      var Evaluator = class {
        constructor(results) {
          this.results = results;
        }
        checkFlag(flagName, defaultValue) {
          if (!this.results || !this.results.feature_flags) {
            return defaultValue;
          }
          const featureFlags = this.results.feature_flags;
          let hashedValue = "";
          try {
            hashedValue = this.getHashedValue(flagName);
          } catch (err) {
            console.error("Unexpected error occurred while evaluating flag ", err);
            return defaultValue;
          }
          if (!hashedValue) {
            return defaultValue;
          }
          const evaluatedFlag = featureFlags[hashedValue];
          if (evaluatedFlag) {
            if (evaluatedFlag.disabled) {
              return false;
            }
            return evaluatedFlag.value;
          }
          return defaultValue;
        }
        shutDown() {
          this.results = void 0;
        }
        // To be Updated with proper hashing function
        getHashedValue(flagName) {
          if (typeof flagName !== "string") {
            return "";
          }
          const input = flagName.trim();
          if (input.length === 0) {
            return "";
          }
          let hash = 5381;
          for (let i = 0; i < input.length; i += 1) {
            const charCode = input.charCodeAt(i);
            hash = (hash << 5) + hash + charCode;
            hash |= 0;
          }
          return (hash >>> 0).toString();
        }
      };
      exports.Evaluator = Evaluator;
    }
  });

  // node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js
  var require_initFeatureFlags = __commonJS({
    "node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.initFeatureFlags = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var utils_1 = require_utils();
      var maxOps = 500;
      var intervalInMs = 1e3 * 25;
      var callBridge = (0, bridge_1.getCallBridge)();
      var validatePayload = (payload) => {
        if (!payload || !payload.user || !payload.config) {
          throw new errors_1.BridgeAPIError("Missing required parameters. Parameter user is required in the payload.");
        }
        if (!payload.config.environment || !["development", "staging", "production"].includes(payload.config.environment)) {
          throw new errors_1.BridgeAPIError("Invalid environment. Valid environments are: development, staging, production");
        }
        if (Object.values(payload).some((val) => typeof val === "function")) {
          throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
        }
      };
      var _initFeatureFlags = (payload) => {
        validatePayload(payload);
        return callBridge("initFeatureFlags", { user: payload.user, config: payload.config });
      };
      exports.initFeatureFlags = (0, utils_1.withRateLimiter)(_initFeatureFlags, maxOps, intervalInMs, `Feature flags initialisation calls are rate limited at ${maxOps}req/${intervalInMs / 1e3}s`);
    }
  });

  // node_modules/@forge/bridge/out/featureFlags/featureFlags.js
  var require_featureFlags = __commonJS({
    "node_modules/@forge/bridge/out/featureFlags/featureFlags.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FeatureFlags = void 0;
      var evaluator_1 = require_evaluator();
      var initFeatureFlags_1 = require_initFeatureFlags();
      var FeatureFlags = class {
        constructor() {
          this.initialized = false;
        }
        /**
         * Initialize the feature flags client
         */
        async initialize(user, config = { environment: "development" }) {
          if (this.isInitialized()) {
            return;
          }
          if (!(config === null || config === void 0 ? void 0 : config.environment)) {
            config.environment = "development";
          }
          const result = await (0, initFeatureFlags_1.initFeatureFlags)({ user, config });
          this.initialized = true;
          this.evaluator = new evaluator_1.Evaluator(result);
        }
        /**
         * Check if a feature flag is enabled for the user
         */
        checkFlag(flagName, defaultValue = false) {
          if (!this.isInitialized() || !this.evaluator) {
            throw new Error("FeatureFlags not initialized. Call initialize() first.");
          }
          return this.evaluator.checkFlag(flagName, defaultValue);
        }
        /**
         * Shutdown the feature flags client
         */
        shutdown() {
          if (!this.isInitialized()) {
            return;
          }
          this.initialized = false;
          this.evaluator.shutDown();
        }
        isInitialized() {
          return this.initialized;
        }
      };
      exports.FeatureFlags = FeatureFlags;
    }
  });

  // node_modules/@forge/bridge/out/featureFlags/index.js
  var require_featureFlags2 = __commonJS({
    "node_modules/@forge/bridge/out/featureFlags/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FeatureFlags = void 0;
      var featureFlags_1 = require_featureFlags();
      Object.defineProperty(exports, "FeatureFlags", { enumerable: true, get: function() {
        return featureFlags_1.FeatureFlags;
      } });
    }
  });

  // node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js
  var require_frontendCustomMetrics = __commonJS({
    "node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.frontendCustomMetrics = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var emit = async (customMetricName, value) => {
        await callBridge("emitFrontendCustomMetric", {
          customMetricName,
          value
        });
      };
      var MAX_METRIC_NAME_LENGTH = 50;
      var METRIC_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
      var validateMetricName = (name) => {
        if (name.trim().length === 0) {
          throw new errors_1.BridgeAPIError("Custom metric name cannot be empty");
        }
        if (name.length > MAX_METRIC_NAME_LENGTH) {
          throw new errors_1.BridgeAPIError(`Custom metric name cannot exceed ${MAX_METRIC_NAME_LENGTH} characters`);
        }
        if (!METRIC_NAME_REGEX.test(name)) {
          throw new errors_1.BridgeAPIError("Custom metric name must start and end with alphanumeric characters and can only contain letters, numbers, dots (.), and hyphens (-)");
        }
        if (name.includes("..") || name.includes("--")) {
          throw new errors_1.BridgeAPIError("Custom metric name cannot contain consecutive dots or hyphens");
        }
      };
      var counter = (name) => {
        validateMetricName(name);
        return {
          incr: () => emit(name, 1),
          incrBy: (value) => {
            if (value <= 0) {
              throw new errors_1.BridgeAPIError("Counter value must be a positive number");
            }
            return emit(name, value);
          }
        };
      };
      exports.frontendCustomMetrics = { counter };
    }
  });

  // node_modules/@forge/bridge/out/frontendCustomMetrics/index.js
  var require_frontendCustomMetrics2 = __commonJS({
    "node_modules/@forge/bridge/out/frontendCustomMetrics/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_frontendCustomMetrics(), exports);
    }
  });

  // node_modules/@forge/bridge/out/index.js
  var require_out3 = __commonJS({
    "node_modules/@forge/bridge/out/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.i18n = exports.NavigationTarget = void 0;
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      var targets_1 = require_targets();
      Object.defineProperty(exports, "NavigationTarget", { enumerable: true, get: function() {
        return targets_1.NavigationTarget;
      } });
      tslib_1.__exportStar(require_invoke2(), exports);
      tslib_1.__exportStar(require_invoke_endpoint2(), exports);
      tslib_1.__exportStar(require_view2(), exports);
      tslib_1.__exportStar(require_router2(), exports);
      tslib_1.__exportStar(require_modal2(), exports);
      tslib_1.__exportStar(require_fetch2(), exports);
      tslib_1.__exportStar(require_requestTeamworkGraph(), exports);
      tslib_1.__exportStar(require_flag2(), exports);
      tslib_1.__exportStar(require_events2(), exports);
      tslib_1.__exportStar(require_realtime2(), exports);
      tslib_1.__exportStar(require_rovo2(), exports);
      tslib_1.__exportStar(require_cookieConsent(), exports);
      exports.i18n = tslib_1.__importStar(require_i18n());
      tslib_1.__exportStar(require_permissions2(), exports);
      tslib_1.__exportStar(require_object_store(), exports);
      tslib_1.__exportStar(require_featureFlags2(), exports);
      tslib_1.__exportStar(require_frontendCustomMetrics2(), exports);
    }
  });

  // src/frontend/bridge.ts
  var import_bridge = __toESM(require_out3());

  // src/ui/result.ts
  function classifyResult(res) {
    if (res === null || res === void 0) {
      return { failed: true, message: "The planner could not reach Jira. Nothing was changed." };
    }
    if (res.ok === false || res.success === false) {
      const text = res.message || (res.error && res.error !== "validation" ? res.error : void 0);
      return { failed: true, message: text || "The change failed." };
    }
    if (res.jiraSync && res.jiraSync.ok === false) {
      return {
        failed: true,
        message: res.jiraSync.error ? `Saved in CascadePlan, but Jira rejected part of it: ${res.jiraSync.error}` : "Saved in CascadePlan, but Jira rejected part of it."
      };
    }
    return { failed: false };
  }

  // src/frontend/banner.ts
  function showErrorBanner(message) {
    const banner = document.getElementById("syncBanner");
    const text = document.getElementById("syncBannerText");
    if (!banner || !text) return;
    text.textContent = message;
    banner.hidden = false;
  }
  function hideErrorBanner() {
    const banner = document.getElementById("syncBanner");
    if (banner) banner.hidden = true;
  }
  function initErrorBanner() {
    const btn = document.getElementById("btnDismissSync");
    if (btn) btn.addEventListener("click", hideErrorBanner);
  }

  // src/ui/change-log.ts
  function toChangeEntries(sync) {
    const out = [];
    for (const w of sync && sync.writes || []) {
      const result = w.ok ? "Written" : w.error ? `Not written: ${w.error}` : "Not written";
      const changes = w.changes && w.changes.length ? w.changes : [{ field: w.fields.join(", "), from: null, to: null }];
      for (const c of changes) out.push({ key: w.key, field: c.field, from: c.from, to: c.to, result });
    }
    return out;
  }
  function describePendingWrites(tasks, moves, key, extra = {}) {
    void key;
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const jira = [];
    const starts = [];
    const dueOf = (t) => t.jiraDueDate ? String(t.jiraDueDate).slice(0, 10) : null;
    for (const [k, m] of moves) {
      const t = byKey.get(k);
      if (!t) continue;
      if (m.end !== dueOf(t)) jira.push(`${k} due ${m.end}`);
      if (m.start !== t.startDate) starts.push(`${k} ${m.start}`);
    }
    for (const [k, end] of extra.parentDue || []) {
      const t = byKey.get(k);
      if (t && end !== dueOf(t) && !moves.has(k)) jira.push(`${k} due ${end}`);
    }
    const epics = extra.epics || [];
    const text = `Jira: ${jira.length ? jira.join(", ") : "no due date change"}.` + (starts.length ? ` Start dates (every plan): ${starts.join(", ")}.` : "") + (epics.length ? ` Not moved: ${epics.join(", ")} (epic; move its work items).` : "");
    return { jira, starts, text };
  }

  // src/frontend/changes-panel.ts
  var entries = [];
  function cell(tag, text) {
    const c = document.createElement(tag);
    c.textContent = text;
    return c;
  }
  function render() {
    const count = document.getElementById("changesCount");
    if (count) count.textContent = String(entries.length);
    const body = document.getElementById("changesBody");
    if (!body) return;
    body.replaceChildren();
    if (entries.length === 0) {
      const tr = document.createElement("tr");
      const td = cell("td", "No Jira writes in this session.");
      td.colSpan = 5;
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    for (const e of [...entries].reverse()) {
      const tr = document.createElement("tr");
      tr.append(cell("td", e.key), cell("td", e.field), cell("td", e.from ?? "empty"), cell("td", e.to ?? "empty"), cell("td", e.result));
      if (!e.result.startsWith("Written")) tr.className = "change-failed";
      body.appendChild(tr);
    }
  }
  function recordChanges(result) {
    const rows = toChangeEntries(result && result.jiraSync);
    if (rows.length === 0) return;
    entries.push(...rows);
    render();
  }
  function isChangesPanelOpen() {
    const panel = document.getElementById("changesPanel");
    return !!panel && !panel.hidden;
  }
  function closeChangesPanel() {
    const panel = document.getElementById("changesPanel");
    if (panel) panel.hidden = true;
  }
  function initChangesPanel() {
    const btn = document.getElementById("btnChanges");
    const panel = document.getElementById("changesPanel");
    const close = document.getElementById("btnCloseChanges");
    if (!btn || !panel) return;
    btn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden && close) close.focus();
    });
    if (close) close.addEventListener("click", () => {
      closeChangesPanel();
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    });
    render();
  }

  // src/frontend/bridge.ts
  var recentWrites = /* @__PURE__ */ new Map();
  var RECENT_MS = 6e4;
  function recentWriteIds(now = Date.now()) {
    for (const [id, at] of recentWrites) if (now - at > RECENT_MS) recentWrites.delete(id);
    return [...recentWrites.keys()].slice(-50);
  }
  function rememberWrites(res, now = Date.now()) {
    for (const id of res && Array.isArray(res.writtenIssueIds) ? res.writtenIssueIds : []) recentWrites.set(String(id), now);
  }
  var CREATE_RESOLVERS = /* @__PURE__ */ new Set(["createInlineTask", "createJiraEpic", "createSubtaskForResource", "addSubtaskToTask", "resolveLocalSubtasks", "updateWbsTask"]);
  var unansweredCreates = /* @__PURE__ */ new Map();
  function newCreateId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  function withCreateId(fnName, payload) {
    if (!CREATE_RESOLVERS.has(fnName)) return { payload };
    const signature = `${fnName}:${JSON.stringify(payload)}`;
    return { payload: { ...payload, createId: unansweredCreates.get(signature) || newCreateId() }, signature };
  }
  function noteCreateOutcome(signature, createId, answered) {
    if (!signature) return;
    if (answered) unansweredCreates.delete(signature);
    else unansweredCreates.set(signature, String(createId));
  }
  async function callOnce(fnName, rawPayload) {
    let res;
    const { payload, signature } = withCreateId(fnName, rawPayload);
    const ids = recentWriteIds();
    try {
      const d = /* @__PURE__ */ new Date();
      const clientToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      res = await (0, import_bridge.invoke)(fnName, { ...ids.length ? { ...payload, reconcileIds: ids } : payload, clientToday });
      rememberWrites(res);
      noteCreateOutcome(signature, payload.createId, true);
    } catch (err) {
      console.error("Forge resolver error:", fnName, err);
      noteCreateOutcome(signature, payload.createId, false);
      const message = fnName.startsWith("get") || fnName.startsWith("check") ? err?.message || "The planner could not reach Jira." : signature ? "The result is unknown. Check the plan, or make the same request again: CascadePlan will not create the work item twice." : "The result is unknown. Check the plan before you try again.";
      res = { ok: false, success: false, error: fnName.startsWith("get") || fnName.startsWith("check") ? "unavailable" : "unknown", message };
    }
    if (!fnName.startsWith("get")) {
      const verdict = classifyResult(res);
      if (verdict.failed && verdict.message) showErrorBanner(verdict.message);
      recordChanges(res);
    }
    return res;
  }
  async function callResolver(fnName, payload = {}) {
    let res = await callOnce(fnName, payload);
    const pending = (r) => !!r && Array.isArray(r.cascadeRemaining) && r.cascadeRemaining.length > 0;
    const roots = Array.isArray(res?.cascadeRoots) && res.cascadeRoots.length ? res.cascadeRoots.map(String) : pending(res) && payload.taskId ? [String(payload.taskId)] : [];
    let rounds = 0;
    let unfinished = false;
    for (const root of roots) {
      let more = true;
      while (more) {
        if (rounds >= MAX_CASCADE_ROUNDS) {
          unfinished = true;
          break;
        }
        rounds++;
        const next = await callOnce("continueCascade", { taskId: root, planId: payload.planId });
        if (next && Array.isArray(next.tasks)) res = next;
        more = pending(next) && next.ok !== false;
      }
      if (unfinished) break;
    }
    if (unfinished) showErrorBanner("The cascade did not finish. Move the task again to continue.");
    return res;
  }
  var MAX_CASCADE_ROUNDS = 40;
  async function getProjectScope() {
    try {
      const ctx = await import_bridge.view.getContext();
      const key = ctx?.extension?.project?.key;
      if (!key) return void 0;
      return ctx?.cloudId ? `${ctx.cloudId}:${key}` : String(key);
    } catch {
      return void 0;
    }
  }
  function openIssueInNewTab(issueKey) {
    void import_bridge.router.open(`/browse/${encodeURIComponent(issueKey)}`);
  }

  // src/ui/plan-view-state.ts
  var MAIN_PLAN_ID = "default";
  var ACTIVE_PLAN_PREFIX = "cp_active_plan_";
  function activePlanStorageKey(scope) {
    return ACTIVE_PLAN_PREFIX + scope;
  }
  function getSavedPlanId(store, scope) {
    if (!store || !scope) return MAIN_PLAN_ID;
    try {
      return store.getItem(activePlanStorageKey(scope)) || MAIN_PLAN_ID;
    } catch {
      return MAIN_PLAN_ID;
    }
  }
  function setSavedPlanId(store, scope, planId) {
    if (!store || !scope) return;
    try {
      store.setItem(activePlanStorageKey(scope), planId || MAIN_PLAN_ID);
    } catch {
    }
  }
  function chooseActivePlan(requested, availablePlans) {
    if (!requested || requested === MAIN_PLAN_ID) return MAIN_PLAN_ID;
    return (availablePlans || []).some((p) => p.id === requested) ? requested : MAIN_PLAN_ID;
  }
  function isEpicRow(t) {
    return Boolean(t.isEpic || t.hierarchyLevel === 1);
  }
  function parentRowKey(task, rowKeys) {
    if (task.parentKey && task.parentKey !== task.key && rowKeys.has(task.parentKey)) return task.parentKey;
    if (!isEpicRow(task) && task.epicKey && task.epicKey !== task.key && rowKeys.has(task.epicKey)) return task.epicKey;
    return void 0;
  }
  function parentKeysOf(rows) {
    const keys = new Set(rows.map((r) => r.key));
    const out = /* @__PURE__ */ new Set();
    for (const r of rows) {
      const up = parentRowKey(r, keys);
      if (up) out.add(up);
    }
    return out;
  }
  function isHiddenByCollapse(task, byKey, collapsed) {
    const keys = new Set(byKey.keys());
    const seen = /* @__PURE__ */ new Set([task.key]);
    let up = parentRowKey(task, keys);
    while (up && !seen.has(up)) {
      if (collapsed.has(up)) return true;
      seen.add(up);
      const parent = byKey.get(up);
      up = parent ? parentRowKey(parent, keys) : void 0;
    }
    return false;
  }
  function visibleRows(rows, collapsed) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const out = [];
    rows.forEach((task, rowIdx) => {
      if (!isHiddenByCollapse(task, byKey, collapsed)) out.push({ task, rowIdx });
    });
    return out;
  }

  // src/frontend/flag.ts
  var import_bridge2 = __toESM(require_out3());
  var FLAG_MS = 1e4;
  var hostFlagSeq = 0;
  var MAX_FLAGS = 3;
  function showFlag(opts) {
    if (typeof import_bridge2.showFlag === "function") {
      try {
        let handle;
        handle = (0, import_bridge2.showFlag)({
          id: `cascadeplan-${Date.now()}-${hostFlagSeq++}`,
          title: opts.error ? "CascadePlan: not saved" : "CascadePlan",
          description: opts.text,
          type: opts.error ? "error" : "info",
          isAutoDismiss: !opts.error && !opts.action,
          ...opts.action ? { actions: [{ text: opts.action.label, onClick: () => {
            if (handle) handle.close();
            opts.action.run();
          } }] } : {}
        });
        return null;
      } catch {
      }
    }
    const group = document.getElementById("flagGroup");
    if (!group) return null;
    const flag = document.createElement("div");
    flag.className = "flag" + (opts.error ? " flag-error" : "");
    flag.setAttribute("role", opts.error ? "alert" : "status");
    const text = document.createElement("span");
    text.className = "flag-text";
    text.textContent = opts.text;
    flag.appendChild(text);
    if (opts.action) {
      const act = document.createElement("button");
      act.type = "button";
      act.className = "btn btn-outline btn-sm flag-action";
      act.textContent = opts.action.label;
      const run = opts.action.run;
      act.addEventListener("click", () => {
        flag.remove();
        run();
      });
      flag.appendChild(act);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-subtle btn-sm flag-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "\u2715";
    close.addEventListener("click", () => flag.remove());
    flag.appendChild(close);
    if (!opts.error) {
      let timer = 0;
      const start = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => flag.remove(), FLAG_MS);
      };
      const hold = () => window.clearTimeout(timer);
      flag.addEventListener("mouseenter", hold);
      flag.addEventListener("focusin", hold);
      flag.addEventListener("mouseleave", () => {
        if (!flag.contains(document.activeElement)) start();
      });
      flag.addEventListener("focusout", (e) => {
        if (!flag.contains(e.relatedTarget)) start();
      });
      start();
    }
    group.appendChild(flag);
    while (group.children.length > MAX_FLAGS) group.firstElementChild.remove();
    return flag;
  }

  // src/ui/undo-stack.ts
  var UndoStack = class {
    constructor(limit) {
      this.limit = limit;
      __publicField(this, "done", []);
      __publicField(this, "undone", []);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("UndoStack limit must be a positive integer");
      }
    }
    /** Records a new action. A new action clears the redo branch. */
    push(entry) {
      this.done.push(entry);
      if (this.done.length > this.limit) this.done.shift();
      this.undone.length = 0;
    }
    /** Returns the latest action to revert, or undefined when there is none. */
    undo() {
      const entry = this.done.pop();
      if (entry !== void 0) this.undone.push(entry);
      return entry;
    }
    /** Returns the latest reverted action to apply again, or undefined. */
    redo() {
      const entry = this.undone.pop();
      if (entry !== void 0) this.done.push(entry);
      return entry;
    }
    /** Forgets every action, for example when another plan opens: its records are not this plan's. */
    clear() {
      this.done.length = 0;
      this.undone.length = 0;
    }
    canUndo() {
      return this.done.length > 0;
    }
    canRedo() {
      return this.undone.length > 0;
    }
    size() {
      return this.done.length;
    }
  };

  // src/ui/undo-plan.ts
  var PLAIN = ["targetProgress", "status", "summary", "effortHours", "epicKey"];
  function snap(t, scheduled) {
    const all = t.dependencies || (t.dependency ? [t.dependency] : []);
    const links = all.filter((d) => d && d.predecessorKey).map((d) => ({ predecessorKey: d.predecessorKey, triggerPercent: d.triggerPercent })).sort((a, b) => a.predecessorKey < b.predecessorKey ? -1 : a.predecessorKey > b.predecessorKey ? 1 : 0);
    return {
      key: t.key,
      scheduled,
      startDate: t.startDate,
      endDate: t.endDate,
      startWeek: t.startWeek,
      spanWeeks: t.spanWeeks,
      progress: t.progress,
      manualProgress: t.manualProgress,
      targetProgress: t.targetProgress,
      links,
      summary: t.summary,
      effortHours: t.effortHours,
      status: t.status,
      epicKey: t.epicKey,
      resourceAccountId: t.resourceAccountId,
      parentKey: t.parentKey
    };
  }
  function snapshotPlan(plan) {
    const out = /* @__PURE__ */ new Map();
    for (const t of plan && plan.backlogTasks || []) out.set(t.key, snap(t, false));
    for (const t of plan && plan.tasks || []) out.set(t.key, snap(t, true));
    return out;
  }
  function updatesTo(from, to, rollUpOnly) {
    const u = {};
    if (!rollUpOnly && (from.startDate !== to.startDate || from.endDate !== to.endDate)) {
      u.startDate = to.startDate;
      u.endDate = to.endDate;
    }
    if (from.progress !== to.progress && (to.manualProgress || !rollUpOnly)) {
      if (to.manualProgress) u.progress = to.progress;
      else u.manualProgress = false;
    }
    for (const f of PLAIN) if (from[f] !== to[f]) u[f] = to[f];
    if (from.resourceAccountId !== to.resourceAccountId) u.resourceAccountId = to.resourceAccountId || "unassigned";
    return u;
  }
  function linkOps(key, from, to) {
    const ops = [];
    const target = new Map(to.links.map((l) => [l.predecessorKey, l.triggerPercent]));
    const source = new Map(from.links.map((l) => [l.predecessorKey, l.triggerPercent]));
    for (const [pred, pct] of target) {
      if (source.get(pred) !== pct) ops.push({ kind: "update", key, updates: { dependency: { predecessorKey: pred, predecessorId: pred, triggerPercent: pct, isTriggerSatisfied: false } } });
    }
    for (const pred of source.keys()) {
      if (!target.has(pred)) ops.push({ kind: "update", key, updates: { removeDependency: { predecessorKey: pred } } });
    }
    return ops;
  }
  function scheduleOp(s) {
    return { kind: "schedule", key: s.key, updates: { startWeek: s.startWeek, spanWeeks: s.spanWeeks, startDate: s.startDate, endDate: s.endDate } };
  }
  function withWrittenStatuses(after, payload, jiraSync) {
    const sent = /* @__PURE__ */ new Map();
    if (payload && payload.taskId && payload.updates && payload.updates.status) sent.set(payload.taskId, payload.updates.status);
    for (const i of payload && payload.items || []) if (i && i.taskId && i.updates && i.updates.status) sent.set(i.taskId, i.updates.status);
    if (!sent.size) return after;
    const applied = new Set((jiraSync && jiraSync.writes || []).filter((w) => (w.fields || []).includes("status")).map((w) => w.key));
    const out = new Map(after);
    for (const [key, status] of sent) {
      const snapNow = out.get(key);
      if (snapNow && applied.has(key)) out.set(key, { ...snapNow, status });
    }
    return out;
  }
  function buildUndoEntry(before, after, targetKey) {
    const changed = [...after.keys()].filter((k) => before.has(k) && JSON.stringify(before.get(k)) !== JSON.stringify(after.get(k)));
    const parents = new Set(changed.map((k) => after.get(k).parentKey).filter(Boolean));
    const keys = [];
    const restore = [];
    const reapply = [];
    const ordered = changed.includes(targetKey) ? [targetKey, ...changed.filter((k) => k !== targetKey)] : changed;
    for (const k of ordered) {
      const b = before.get(k);
      const a = after.get(k);
      if (b.scheduled !== a.scheduled) {
        keys.push(k);
        restore.push(b.scheduled ? scheduleOp(b) : { kind: "unschedule", key: k });
        reapply.push(a.scheduled ? scheduleOp(a) : { kind: "unschedule", key: k });
        continue;
      }
      const rollUpOnly = parents.has(k);
      const back = updatesTo(a, b, rollUpOnly);
      const backLinks = linkOps(k, a, b);
      if (Object.keys(back).length === 0 && backLinks.length === 0) continue;
      keys.push(k);
      if (Object.keys(back).length) restore.push({ kind: "update", key: k, updates: back });
      restore.push(...backLinks);
      const fwd = updatesTo(b, a, rollUpOnly);
      if (Object.keys(fwd).length) reapply.push({ kind: "update", key: k, updates: fwd });
      reapply.push(...linkOps(k, b, a));
    }
    return keys.length ? { keys, restore, reapply } : null;
  }
  function actionLabel(fn, payload, entry) {
    if (fn === "batchUpdateTasks") {
      const items = payload.items || [];
      const n = items.length;
      const issues = `${n} issue${n === 1 ? "" : "s"}`;
      const others2 = entry.keys.filter((k) => !items.some((i) => i.taskId === k)).length;
      const first = items[0] && items[0].updates || {};
      if (first.startDate || first.endDate) return `Moved ${issues}` + (others2 ? ` and ${others2} dependent${others2 > 1 ? "s" : ""}` : "");
      if (first.progress !== void 0) return `Set progress on ${issues}`;
      if (first.resourceAccountId !== void 0) return `Assigned ${issues}`;
      return `Changed ${issues}`;
    }
    const key = payload.taskId || entry.keys[0];
    const u = payload.updates || {};
    const others = entry.keys.filter((k) => k !== key).length;
    const dependents = others ? ` and ${others} dependent${others > 1 ? "s" : ""}` : "";
    if (fn === "unscheduleTask") return `Moved ${key} to the backlog. Its Jira due date is kept`;
    if (fn === "scheduleBacklogTask") return `Scheduled ${key}`;
    if (fn === "moveTaskGroup") return `Moved ${key} with its sub-tasks` + (others ? ` (${others} issue${others > 1 ? "s" : ""} changed)` : "");
    if (fn !== "updateWbsTask") return `Changed ${key}`;
    if ("dependency" in u) return u.dependency ? `Linked ${key} to ${u.dependency.predecessorKey} at ${u.dependency.triggerPercent}%` : `Removed the links of ${key}`;
    if (u.removeDependency) return `Removed the link from ${u.removeDependency.predecessorKey} to ${key}`;
    if (u.startDate || u.endDate || u.startWeek) return `Moved ${key}${dependents}`;
    if (u.progress !== void 0) return `Set ${key} to ${u.progress}%`;
    return `Changed ${key}`;
  }

  // src/frontend/theme.ts
  var import_bridge3 = __toESM(require_out3());
  async function enableTheme() {
    try {
      await import_bridge3.view.theme.enable();
    } catch (err) {
      console.warn("Theming not available; using light fallbacks", err);
    }
  }
  function cssToken(name, fallback = "") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function onThemeChange(callback) {
    const observer = new MutationObserver(() => callback());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode", "data-theme"] });
    return observer;
  }

  // src/ui/why.ts
  function buildWhyModel(tasks, key) {
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const task = byKey.get(key);
    if (!task) return null;
    const title = `Why ${key} starts on ${task.startDate}`;
    const dep = task.dependency;
    if (!dep || !dep.predecessorKey) {
      return { title, reason: `${key} has no dependency. Its start date is the one set on the plan.`, chain: [], fixes: [], driverKeys: [] };
    }
    const chain = [];
    const visited = /* @__PURE__ */ new Set([key]);
    let next = dep.driverKey;
    while (next && !visited.has(next)) {
      visited.add(next);
      const t = byKey.get(next);
      if (!t) break;
      const d = t.dependency;
      if (d && d.predecessorKey) {
        chain.push({ key: next, text: `${next}: starts when ${d.predecessorKey} reaches ${d.triggerPercent}% (${d.triggerDate})` });
        next = d.driverKey;
      } else {
        chain.push({ key: next, text: `${next}: no dependency; starts ${t.startDate}` });
        next = void 0;
      }
    }
    const fixes = (dep.fixOptions || []).map((f) => f.kind === "move" ? { label: `Move ${key} to ${f.startDate}`, updates: { startDate: f.startDate, endDate: f.endDate } } : { label: `Lower the trigger to ${f.triggerPercent}%`, updates: { dependency: { predecessorId: dep.predecessorKey, predecessorKey: dep.predecessorKey, triggerPercent: f.triggerPercent, isTriggerSatisfied: false } } });
    const model = {
      title,
      reason: dep.earliestStartReason || dep.violationReason || `${key} waits for ${dep.predecessorKey}.`,
      chain,
      fixes,
      driverKeys: chain.map((c) => c.key)
    };
    if (dep.isViolated) model.violation = dep.fixSuggestion || dep.violationReason;
    return model;
  }

  // src/frontend/why-popup.ts
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== void 0) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function announceDrivers(keys) {
    document.dispatchEvent(new CustomEvent("cp:drivers", { detail: keys }));
  }
  function clearDriverMarks() {
    document.querySelectorAll(".bar-hit.is-driver").forEach((bar) => {
      bar.classList.remove("is-driver");
      bar.querySelectorAll(".driver-label").forEach((l) => l.remove());
    });
    announceDrivers([]);
  }
  function markDrivers(model) {
    for (const k of model.driverKeys) {
      const bar = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(k)}"]`);
      if (!bar) continue;
      bar.classList.add("is-driver");
      bar.appendChild(el("span", "Driver", "driver-label"));
    }
    announceDrivers(model.driverKeys);
  }
  function closeWhyPopup() {
    const pop = document.getElementById("whyPopup");
    if (pop) pop.hidden = true;
    clearDriverMarks();
  }
  function isWhyPopupOpen() {
    const pop = document.getElementById("whyPopup");
    return !!pop && !pop.hidden;
  }
  function openWhyPopup(tasks, taskKey, anchor, handlers) {
    const model = buildWhyModel(tasks, taskKey);
    const pop = document.getElementById("whyPopup");
    if (!model || !pop) return false;
    closeWhyPopup();
    document.getElementById("whyTitle").textContent = model.title;
    document.getElementById("whyReason").textContent = model.reason;
    const chain = document.getElementById("whyChain");
    chain.replaceChildren();
    for (const step of model.chain) {
      const li = el("li");
      const link = el("button", step.text, "why-chain-link");
      link.type = "button";
      link.addEventListener("click", () => handlers.focusTask(step.key));
      li.appendChild(link);
      chain.appendChild(li);
    }
    const violation = document.getElementById("whyViolation");
    violation.hidden = !model.violation;
    violation.textContent = model.violation || "";
    const fixes = document.getElementById("whyFixes");
    fixes.replaceChildren();
    for (const fix of model.fixes) {
      const btn = el("button", fix.label, "btn btn-outline btn-sm why-fix");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        closeWhyPopup();
        await handlers.apply(taskKey, fix.updates);
      });
      fixes.appendChild(btn);
    }
    pop.hidden = false;
    if (anchor) {
      pop.style.top = `${Math.min(window.innerHeight - pop.offsetHeight - 8, anchor.bottom + 6)}px`;
      pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, anchor.left))}px`;
    }
    markDrivers(model);
    document.getElementById("btnCloseWhy").focus();
    return true;
  }
  function initWhyPopup() {
    const close = document.getElementById("btnCloseWhy");
    if (close) close.addEventListener("click", closeWhyPopup);
  }

  // src/frontend/baseline-panel.ts
  var deps;
  function el2(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== void 0) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function button(text, onClick, primary = false) {
    const b = el2("button", text, `btn ${primary ? "btn-primary" : "btn-outline"} btn-xs`);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  var signed = (n) => n > 0 ? `+${n}` : String(n);
  var day = (iso2) => (iso2 || "").slice(0, 10);
  function statusText(report) {
    if (!report || report.ok === false) return "Baseline: none";
    const c = report.comparison;
    const parts2 = [`${signed(c.deltaHours)} h (${signed(c.deltaPercent)}%)`];
    if (c.added.length) parts2.push(`${c.added.length} added`);
    if (c.removed.length) parts2.push(`${c.removed.length} removed`);
    if (c.slipped) parts2.push(`${c.slipped} later`);
    return `Baseline: ${report.baseline.name}${report.intact ? "" : " (changed since frozen!)"} \xB7 ${c.grew || c.removed.length || c.changed.length ? parts2.join(", ") : "on scope"}`;
  }
  function comparisonTable(c, summaries) {
    const wrap = el2("div");
    wrap.appendChild(el2("p", `Hours ${c.fromHours} -> ${c.toHours} (${signed(c.deltaHours)} h, ${signed(c.deltaPercent)}%). Items ${c.fromCount} -> ${c.toCount}.`));
    const table = el2("table", void 0, "changes-table");
    const head = el2("tr");
    for (const h of ["Change", "Issue", "Summary (now)", "Estimate", "Start", "End"]) head.appendChild(el2("th", h));
    table.appendChild(el2("thead")).appendChild(head);
    const body = table.appendChild(el2("tbody"));
    const row = (kind, key, est, start, end) => {
      const tr = el2("tr");
      for (const v of [kind, key, summaries[key] || "", est, start, end]) tr.appendChild(el2("td", v));
      body.appendChild(tr);
    };
    for (const i of c.added) row("added", i.key, i.hours !== void 0 ? `${i.hours} h` : "none", day(i.start), day(i.end));
    for (const i of c.removed) row("removed", i.key, i.hours !== void 0 ? `${i.hours} h` : "none", day(i.start), day(i.end));
    for (const x of c.changed) {
      const pair = (a, b, unit = "") => a === void 0 && b === void 0 ? "" : `${a ?? "none"}${unit} -> ${b ?? "none"}${unit}`;
      row(
        "changed",
        x.key,
        "fromHours" in x || "toHours" in x ? pair(x.fromHours, x.toHours, " h") : "",
        "fromStart" in x ? pair(x.fromStart, x.toStart) : "",
        "fromEnd" in x ? pair(x.fromEnd, x.toEnd) : ""
      );
    }
    if (!c.added.length && !c.removed.length && !c.changed.length) wrap.appendChild(el2("p", "No change."));
    else wrap.appendChild(table);
    return wrap;
  }
  function download(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = el2("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
      return true;
    } catch {
      return false;
    }
  }
  async function refreshStatus() {
    const btn = document.getElementById("btnBaseline");
    const report = await deps.call("getScopeCreepReport", {});
    if (btn) {
      btn.textContent = statusText(report);
      btn.classList.toggle("is-warning", !!(report && report.ok !== false && (report.comparison.grew || !report.intact)));
    }
    return report;
  }
  async function render2() {
    const body = document.getElementById("baselineBody");
    if (!body) return;
    body.replaceChildren(el2("p", "Loading..."));
    const [list, report] = await Promise.all([deps.call("getPlanBaselines", {}), refreshStatus()]);
    body.replaceChildren();
    const approver = deps.isApprover() === true;
    const freeze = el2("div", void 0, "baseline-freeze");
    const name = el2("input");
    name.type = "text";
    name.className = "form-input";
    name.placeholder = "Baseline name, for example Sprint 7 commitment";
    name.setAttribute("aria-label", "Baseline name");
    name.maxLength = 80;
    const freezeBtn = button("Freeze the plan as a baseline", async () => {
      const res = await deps.call("freezePlanBaseline", { name: name.value });
      if (res && res.ok) {
        deps.flag({ text: `Froze "${res.baseline.name}": ${res.baseline.itemCount} items, ${res.baseline.totalHours} h.` });
        await deps.reloadPlan();
        await render2();
      } else deps.flag({ text: res && (res.message || res.error) || "The baseline was not frozen.", error: true });
    }, true);
    name.disabled = freezeBtn.disabled = !approver;
    if (!approver) freezeBtn.title = "Only plan approvers freeze baselines.";
    freeze.append(name, freezeBtn);
    body.appendChild(freeze);
    const delta = el2("section");
    delta.appendChild(el2("h3", "Scope since the active baseline"));
    if (report && report.ok !== false) {
      if (!report.intact) delta.appendChild(el2("p", "Warning: this baseline no longer matches what was frozen (its SHA-256 digest differs).", "baseline-warning"));
      delta.appendChild(comparisonTable(report.comparison, report.summaries || {}));
      const reason = el2("textarea");
      reason.className = "form-input";
      reason.placeholder = "Why the scope changed (sent to plan approvers)";
      reason.setAttribute("aria-label", "Reason for the scope change");
      reason.maxLength = 1e3;
      delta.append(reason, button("Request approval of this scope", async () => {
        const res = await deps.call("requestScopeShift", { reason: reason.value });
        if (res && res.ok) {
          deps.flag({ text: "Scope change requested. A plan approver can accept or reject it." });
          await render2();
        } else deps.flag({ text: res && (res.message || res.error) || "The request was not saved.", error: true });
      }));
    } else {
      delta.appendChild(el2("p", report && report.message || "No baseline yet."));
    }
    body.appendChild(delta);
    const shifts = list && list.shifts || [];
    if (shifts.length) {
      const sec = el2("section");
      sec.appendChild(el2("h3", "Scope-change requests"));
      for (const s of shifts) {
        const line = el2("div", void 0, "baseline-shift");
        const sum = s.summary || {};
        line.appendChild(el2("span", `${day(s.requestedAt)} ${s.requestedByName}: "${s.reason}" (${sum.added} added, ${sum.removed} removed, ${sum.changed} changed, ${signed(sum.deltaHours)} h). ${s.status === "PENDING" ? "Waiting." : `${s.status === "APPROVED" ? "Accepted" : "Rejected"} by ${s.reviewedByName}${s.comment ? `: ${s.comment}` : ""}.`}`));
        if (s.status === "PENDING" && approver) {
          for (const [status, label2] of [["APPROVED", "Accept"], ["REJECTED", "Reject"]]) {
            line.appendChild(button(label2, async () => {
              const res = await deps.call("reviewScopeShift", { shiftId: s.id, status });
              if (res && res.ok) {
                deps.flag({ text: status === "APPROVED" ? "Accepted: a new baseline version is active." : "Rejected: the baseline stays." });
                await deps.reloadPlan();
                await render2();
              } else deps.flag({ text: res && (res.message || res.error) || "The review was not saved.", error: true });
            }, status === "APPROVED"));
          }
        }
        sec.appendChild(line);
      }
      body.appendChild(sec);
    }
    const versions = list && list.baselines || [];
    if (versions.length) {
      const sec = el2("section");
      sec.appendChild(el2("h3", "Baseline versions"));
      const out = el2("div");
      for (const b of versions) {
        const line = el2("div", void 0, "baseline-version");
        const active = b.id === list.active;
        line.appendChild(el2("span", `${active ? "\u25CF " : ""}${b.name}, ${day(b.frozenAt)} by ${b.frozenByName}: ${b.itemCount} items, ${b.totalHours} h${b.unestimated ? `, ${b.unestimated} unestimated` : ""}.`));
        line.appendChild(button("Compare with now", async () => {
          const r = await deps.call("getScopeCreepReport", { baselineId: b.id });
          out.replaceChildren(el2("h4", `${b.name} against the current plan`), r && r.ok ? comparisonTable(r.comparison, r.summaries || {}) : el2("p", r && r.message || "Not available."));
        }));
        if (!active && list.active) {
          line.appendChild(button("Compare with active", async () => {
            const r = await deps.call("compareBaselines", { fromId: b.id, toId: list.active });
            out.replaceChildren(el2("h4", `${b.name} against the active version`), r && r.ok ? comparisonTable(r.comparison, r.summaries || {}) : el2("p", r && r.message || "Not available."));
          }));
        }
        line.appendChild(button("Export CSV", async () => {
          const r = await deps.call("exportBaseline", { baselineId: b.id });
          if (!r || !r.ok) {
            deps.flag({ text: r && r.message || "Export failed.", error: true });
            return;
          }
          if (!download(`${b.name.replace(/[^\w.-]+/g, "_")}.csv`, r.csv, "text/csv")) {
            const ta = el2("textarea");
            ta.className = "form-input";
            ta.value = r.csv;
            ta.readOnly = true;
            out.replaceChildren(el2("p", "Copy the CSV below:"), ta);
          }
          if (!r.intact) deps.flag({ text: `"${b.name}" no longer matches what was frozen (SHA-256 differs).`, error: true });
        }));
        if (!active && approver) {
          line.appendChild(button("Make active", async () => {
            const res = await deps.call("setActiveBaseline", { baselineId: b.id });
            if (res && res.ok) {
              await deps.reloadPlan();
              await render2();
            } else deps.flag({ text: res && res.message || "Not changed.", error: true });
          }));
        }
        sec.appendChild(line);
      }
      sec.appendChild(out);
      body.appendChild(sec);
    }
  }
  function closeBaselinePanel() {
    const panel = document.getElementById("baselinePanel");
    if (panel) panel.hidden = true;
    document.getElementById("btnBaseline")?.setAttribute("aria-expanded", "false");
  }
  function isBaselinePanelOpen() {
    const panel = document.getElementById("baselinePanel");
    return !!panel && !panel.hidden;
  }
  function initBaselinePanel(d) {
    deps = d;
    const btn = document.getElementById("btnBaseline");
    const panel = document.getElementById("baselinePanel");
    const close = document.getElementById("btnCloseBaseline");
    if (!btn || !panel) return;
    btn.addEventListener("click", async () => {
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) {
        await render2();
        close?.focus();
      }
    });
    close?.addEventListener("click", () => {
      closeBaselinePanel();
      btn.focus();
    });
  }

  // src/ui/safe-html.ts
  var SafeHtml = class {
    constructor(markup) {
      this.markup = markup;
    }
    toString() {
      return this.markup;
    }
  };
  function escapeHtml(value) {
    if (value === null || value === void 0) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function render3(value) {
    if (value instanceof SafeHtml) return value.toString();
    if (Array.isArray(value)) return value.map(render3).join("");
    return escapeHtml(value);
  }
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) {
      out += render3(values[i]) + strings[i + 1];
    }
    return new SafeHtml(out);
  }

  // src/domain/schedule-engine.ts
  var DAY_MS = 864e5;
  function dayNumber(iso2) {
    return Math.round(Date.parse(`${iso2}T00:00:00Z`) / DAY_MS);
  }
  function isoOf(day2) {
    return new Date(day2 * DAY_MS).toISOString().slice(0, 10);
  }
  function addDays(iso2, days) {
    return isoOf(dayNumber(iso2) + days);
  }
  function durationDays(e) {
    const s = dayNumber(e.estimatedStartDate);
    const end = dayNumber(e.estimatedCompletionDate || e.estimatedStartDate);
    return Math.max(1, end - s + 1);
  }
  function earliestStart(pred, triggerPercent, today) {
    const p = pred.percentComplete || 0;
    const x = triggerPercent;
    if (p >= x && (x > 0 || pred.started === true)) {
      return { basis: "satisfied", date: null, triggerDate: null, reason: `${pred.workEffortId} is at ${p}%, past the ${x}% trigger` };
    }
    const s = dayNumber(pred.estimatedStartDate);
    const t = dayNumber(today);
    if (p > 0 && t > s) {
      const elapsed = Math.max(1, t - s);
      const rate = p / elapsed;
      const e2 = t + Math.ceil((x - p) / rate);
      return {
        basis: "observed",
        date: isoOf(e2),
        triggerDate: isoOf(e2 - 1),
        reason: `${pred.workEffortId} reaches ${x}% on ${isoOf(e2 - 1)} (observed: ${p}% in ${elapsed} days)`
      };
    }
    const d = durationDays(pred);
    const e = s + Math.ceil(d * x / 100);
    const trigger = x === 0 ? s : e - 1;
    return {
      basis: "planned",
      date: isoOf(e),
      triggerDate: isoOf(trigger),
      reason: `${pred.workEffortId} reaches ${x}% on ${isoOf(trigger)} (planned: ${d} days)`
    };
  }
  function evaluateEffort(key, efforts, links, today) {
    const own = efforts.get(key);
    const incoming = links.filter((l) => l.workEffortIdTo === key);
    if (!own || incoming.length === 0) return { earliestStartDate: null, driver: null, violated: false, reason: null };
    let best = null;
    let satisfiedReason = null;
    for (const l of incoming) {
      const pred = efforts.get(l.workEffortIdFrom);
      if (!pred) return { earliestStartDate: null, driver: null, violated: true, reason: `Predecessor ${l.workEffortIdFrom} is not on the plan.` };
      const res = earliestStart(pred, l.triggerPercent, today);
      if (res.date === null) {
        satisfiedReason = satisfiedReason || res.reason;
        continue;
      }
      if (!best || res.date > best.res.date) best = { link: l, pred, res };
    }
    if (!best) return { earliestStartDate: null, driver: null, violated: false, reason: `No wait: ${satisfiedReason}.` };
    const e = best.res.date;
    const reason = `Starts ${e} because ${best.res.reason}.`;
    const detail = { triggerDate: best.res.triggerDate, triggerPercent: best.link.triggerPercent, basis: best.res.basis };
    const started = own.started === true;
    if (started) {
      return {
        earliestStartDate: e,
        driver: best.pred.workEffortId,
        violated: true,
        reason,
        ...detail,
        suggestion: `${key} has started, but ${best.pred.workEffortId} is at ${best.pred.percentComplete || 0}% of the ${best.link.triggerPercent}% trigger.`
      };
    }
    const ownStart = own.estimatedStartDate;
    if (ownStart >= e) return { earliestStartDate: e, driver: best.pred.workEffortId, violated: false, reason, ...detail };
    let suggestion = `Move ${key} to ${e}`;
    const fixes = [{ kind: "move", startDate: e, endDate: addDays(e, durationDays(own) - 1) }];
    if (best.res.basis === "planned") {
      const lower = Math.floor((dayNumber(ownStart) - dayNumber(best.pred.estimatedStartDate)) / durationDays(best.pred) * 100);
      if (lower >= 0) {
        suggestion += ` or lower the trigger to ${lower}%`;
        fixes.push({ kind: "trigger", triggerPercent: lower });
      }
    }
    return { earliestStartDate: e, driver: best.pred.workEffortId, violated: true, reason, ...detail, suggestion: `${suggestion}.`, fixes };
  }
  function cascade(efforts, links, changedKey, today) {
    const work = new Map([...efforts].map(([k, v]) => [k, { ...v }]));
    const succ = /* @__PURE__ */ new Map();
    for (const l of links) succ.set(l.workEffortIdFrom, [...succ.get(l.workEffortIdFrom) || [], l.workEffortIdTo]);
    const reach = /* @__PURE__ */ new Set();
    const stack = [changedKey];
    while (stack.length) {
      const k = stack.pop();
      for (const s of succ.get(k) || []) if (!reach.has(s)) {
        reach.add(s);
        stack.push(s);
      }
    }
    if (reach.has(changedKey)) return { changes: [], efforts: work, cycle: [changedKey] };
    const nodes = /* @__PURE__ */ new Set([changedKey, ...reach]);
    const indeg = new Map([...nodes].map((n) => [n, 0]));
    for (const l of links) if (nodes.has(l.workEffortIdFrom) && nodes.has(l.workEffortIdTo)) indeg.set(l.workEffortIdTo, indeg.get(l.workEffortIdTo) + 1);
    const queue = [...nodes].filter((n) => indeg.get(n) === 0);
    const order = [];
    while (queue.length) {
      const n = queue.shift();
      order.push(n);
      for (const s of succ.get(n) || []) {
        if (!nodes.has(s)) continue;
        indeg.set(s, indeg.get(s) - 1);
        if (indeg.get(s) === 0) queue.push(s);
      }
    }
    const cycle = [...nodes].filter((n) => !order.includes(n));
    const changes = [];
    for (const key of order) {
      if (key === changedKey) continue;
      const cur = work.get(key);
      if (!cur) continue;
      const ev = evaluateEffort(key, work, links, today);
      if (!ev.earliestStartDate || cur.estimatedStartDate >= ev.earliestStartDate) continue;
      const dur = durationDays(cur);
      const toStart = ev.earliestStartDate;
      const toEnd = addDays(toStart, dur - 1);
      changes.push({
        key,
        fromStart: cur.estimatedStartDate,
        fromEnd: cur.estimatedCompletionDate || cur.estimatedStartDate,
        toStart,
        toEnd,
        reason: ev.reason
      });
      cur.estimatedStartDate = toStart;
      cur.estimatedCompletionDate = toEnd;
    }
    return cycle.length ? { changes, efforts: work, cycle } : { changes, efforts: work };
  }

  // src/domain/block-move.ts
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function addDays2(iso2, days) {
    return new Date(Date.parse(`${iso2}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
  }
  function blockState(m) {
    if (!m.startDate || !ISO.test(m.startDate)) return "undated";
    if (m.status === "COMPLETED") return "done";
    if (m.status === "IN_PROGRESS") return "in-progress";
    return "not-started";
  }
  function planBlockMove(members, days, today) {
    const changes = [];
    const fixed = [];
    for (const m of members) {
      const state = blockState(m);
      if (state === "undated") {
        fixed.push({ key: m.key, state, reason: "undated: stays in the backlog" });
        continue;
      }
      if (state === "done") {
        fixed.push({ key: m.key, state, reason: "done: its dates record finished work" });
        continue;
      }
      const fromStart = m.startDate;
      const fromEnd = m.endDate && ISO.test(m.endDate) ? m.endDate : fromStart;
      if (state === "not-started") {
        changes.push({ key: m.key, state, fromStart, fromEnd, toStart: addDays2(fromStart, days), toEnd: addDays2(fromEnd, days) });
        continue;
      }
      let toEnd = addDays2(fromEnd, days);
      if (toEnd < today) toEnd = today;
      if (toEnd < fromStart) toEnd = fromStart;
      if (toEnd === fromEnd) fixed.push({ key: m.key, state, reason: "in progress: start kept, end not before today" });
      else changes.push({ key: m.key, state, fromStart, fromEnd, toStart: fromStart, toEnd });
    }
    return { changes, fixed };
  }

  // src/domain/work-effort-links.ts
  function rollUpParentDates(tasks) {
    const out = /* @__PURE__ */ new Map();
    for (const t of tasks) {
      if (!t.parentKey || !t.startDate) continue;
      const end = t.endDate && t.endDate >= t.startDate ? t.endDate : t.startDate;
      const cur = out.get(t.parentKey);
      out.set(t.parentKey, cur ? { startDate: t.startDate < cur.startDate ? t.startDate : cur.startDate, endDate: end > cur.endDate ? end : cur.endDate } : { startDate: t.startDate, endDate: end });
    }
    return out;
  }

  // src/domain/drop-plan.ts
  var ISO2 = /^\d{4}-\d{2}-\d{2}$/;
  var isIso = (v) => typeof v === "string" && ISO2.test(v);
  var dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
  function engineInputs(tasks) {
    const efforts = /* @__PURE__ */ new Map();
    const links = [];
    for (const t of tasks) {
      if (!t.key || !isIso(t.startDate)) continue;
      efforts.set(t.key, {
        workEffortId: t.key,
        estimatedStartDate: t.startDate,
        estimatedCompletionDate: isIso(t.endDate) ? t.endDate : t.startDate,
        percentComplete: t.progress || 0,
        started: t.status === "IN_PROGRESS" || t.status === "COMPLETED"
      });
      for (const d of t.dependencies || (t.dependency ? [t.dependency] : [])) {
        if (d.predecessorKey && typeof d.triggerPercent === "number") {
          links.push({ workEffortIdFrom: d.predecessorKey, workEffortIdTo: t.key, workEffortAssocTypeId: "WORK_EFF_PRECEDENCY", triggerPercent: d.triggerPercent });
        }
      }
    }
    return { efforts, links };
  }
  function ancestorKeys(key, tasks) {
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const out = [];
    let cur = byKey.get(key)?.parentKey;
    while (cur && !out.includes(cur)) {
      out.push(cur);
      cur = byKey.get(cur)?.parentKey;
    }
    return out;
  }
  function withRollUps(tasks) {
    let out = tasks.map((t) => ({ ...t }));
    for (let pass = 0; pass < 4; pass++) {
      const spans = rollUpParentDates(out);
      let changed = false;
      out = out.map((t) => {
        const span = spans.get(t.key);
        if (!span || t.startDate === span.startDate && t.endDate === span.endDate) return t;
        changed = true;
        return { ...t, ...span, datesFromChildren: true };
      });
      if (!changed) break;
    }
    return out;
  }
  function expandParentCascades(changes, tasks, today, exclude = /* @__PURE__ */ new Set()) {
    const out = [];
    const epics = [];
    const seen = new Set(exclude);
    for (const c of changes) {
      const t = tasks.find((x) => x.key === c.key);
      if (!t || !t.datesFromChildren) {
        if (!seen.has(c.key)) {
          out.push(c);
          seen.add(c.key);
        }
        continue;
      }
      if (t.isEpic || (t.hierarchyLevel ?? 0) >= 1) {
        epics.push(c.key);
        continue;
      }
      if (!isIso(t.startDate)) continue;
      const days = dayDiff(t.startDate, c.toStart);
      if (days === 0) continue;
      for (const b of planBlockMove(tasks.filter((x) => x.parentKey === t.key), days, today).changes) {
        if (!seen.has(b.key)) {
          out.push({ key: b.key, toStart: b.toStart, toEnd: b.toEnd });
          seen.add(b.key);
        }
      }
    }
    return { changes: out, epics };
  }
  function singleMoveCascade(timeline2, all, key, patch, today) {
    const candidate = withRollUps(timeline2.map((t) => t.key === key ? { ...t, ...patch } : t));
    const inputs = engineInputs(candidate);
    const first = cascade(inputs.efforts, inputs.links, key, today);
    const cycles = [...first.cycle || []];
    const changes = first.changes.map((c) => ({ key: c.key, toStart: c.toStart, toEnd: c.toEnd }));
    let efforts = first.efforts;
    for (const anc of ancestorKeys(key, timeline2)) {
      const was = timeline2.find((t) => t.key === anc);
      const now = candidate.find((t) => t.key === anc);
      if (!was || !now || !now.datesFromChildren || was.startDate === now.startDate && was.endDate === now.endDate) continue;
      const more = cascade(efforts, inputs.links, anc, today);
      cycles.push(...more.cycle || []);
      for (const c of more.changes) if (!changes.some((x) => x.key === c.key)) changes.push({ key: c.key, toStart: c.toStart, toEnd: c.toEnd });
      efforts = more.efforts;
    }
    const expanded = expandParentCascades(changes, all, today, /* @__PURE__ */ new Set([key]));
    return { changes: expanded.changes, epics: expanded.epics, cycles };
  }
  function cascadeFromRoots(candidate, all, roots, exclude, today) {
    const inputs = engineInputs(candidate);
    let efforts = inputs.efforts;
    const out = [];
    const epics = [];
    const cycles = [];
    for (const root of roots) {
      const r = cascade(efforts, inputs.links, root, today);
      cycles.push(...r.cycle || []);
      efforts = r.efforts;
      const expanded = expandParentCascades(r.changes, all, today, exclude);
      epics.push(...expanded.epics);
      for (const c of expanded.changes) if (!out.some((x) => x.key === c.key)) out.push(c);
    }
    return { changes: out, epics, cycles };
  }
  function parentDueDateTargets(before, moved, reparent) {
    const shifted = before.map((t) => {
      let n = moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t;
      if (reparent && t.key === reparent.key) n = { ...n, parentKey: reparent.parentKey };
      return n;
    });
    const after = withRollUps(shifted);
    const parents = /* @__PURE__ */ new Set();
    for (const key of moved.keys()) for (const a of ancestorKeys(key, before)) if (!moved.has(a)) parents.add(a);
    if (reparent) for (const list of [before, shifted]) for (const a of ancestorKeys(reparent.key, list)) parents.add(a);
    const out = [];
    for (const key of parents) {
      const was = before.find((t) => t.key === key);
      const now = after.find((t) => t.key === key);
      if (!was || !now || !now.datesFromChildren || !isIso(now.endDate) || was.endDate === now.endDate) continue;
      if (String(was.jiraDueDate || "").slice(0, 10) === now.endDate) continue;
      out.push({ key, id: was.id, endDate: now.endDate, was });
    }
    return out;
  }
  function finish(all, moves, epics) {
    const moved = new Map([...moves].map(([k, m]) => [k, { startDate: m.start, endDate: m.end }]));
    const parentDue = new Map(parentDueDateTargets(all, moved).map((t) => [t.key, t.endDate]));
    return { moves, parentDue, epics: [...new Set(epics)] };
  }
  function previewSingleMove(plan, key, start, end, today) {
    const all = [...plan.tasks, ...plan.backlogTasks || []];
    const moves = /* @__PURE__ */ new Map();
    if (!all.some((t) => t.key === key)) return { moves, parentDue: /* @__PURE__ */ new Map(), epics: [] };
    moves.set(key, { start, end });
    const r = singleMoveCascade(plan.tasks, all, key, { startDate: start, endDate: end }, today);
    for (const c of r.changes) moves.set(c.key, { start: c.toStart, end: c.toEnd });
    return finish(all, moves, r.epics);
  }
  function previewBlockMove(plan, parentKey, days, today) {
    const all = [...plan.tasks, ...plan.backlogTasks || []];
    const members = all.filter((t) => t.parentKey === parentKey);
    const moves = /* @__PURE__ */ new Map();
    const block = planBlockMove(members, days, today).changes;
    if (block.length === 0) return { moves, parentDue: /* @__PURE__ */ new Map(), epics: [] };
    for (const c of block) moves.set(c.key, { start: c.toStart, end: c.toEnd });
    const moved = new Map(block.map((c) => [c.key, { startDate: c.toStart, endDate: c.toEnd }]));
    const candidate = withRollUps(all.map((t) => moved.has(t.key) ? { ...t, ...moved.get(t.key) } : t));
    const roots = [parentKey, ...block.map((c) => c.key), ...ancestorKeys(parentKey, all)];
    const r = cascadeFromRoots(candidate, all, roots, /* @__PURE__ */ new Set([parentKey, ...members.map((m) => m.key)]), today);
    for (const c of r.changes) moves.set(c.key, { start: c.toStart, end: c.toEnd });
    return finish(all, moves, r.epics);
  }

  // src/ui/timeline-geometry.ts
  var HANDLE_PX = 24;
  var DAY_MS2 = 864e5;
  function daysBetween(fromIso, toIso) {
    return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS2);
  }
  function xForDate(iso2, originIso2, dayPx2) {
    return daysBetween(originIso2, iso2) * dayPx2;
  }
  function barRect(task, originIso2, dayPx2, rowTop2, rowH, barH) {
    if (!task.startDate) return null;
    const x = xForDate(task.startDate, originIso2, dayPx2);
    const end = task.endDate && task.endDate >= task.startDate ? task.endDate : task.startDate;
    const w = Math.max(dayPx2, (daysBetween(task.startDate, end) + 1) * dayPx2);
    return { x, y: rowTop2 + (rowH - barH) / 2, w, h: barH };
  }
  function visibleRange(scrollTop, viewportH, rowH, count, buffer) {
    if (count === 0) return { first: 0, last: -1 };
    const first = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
    const last = Math.min(count - 1, Math.ceil((scrollTop + viewportH) / rowH) + buffer);
    return { first, last };
  }
  function handleOffsets(barW) {
    if (barW >= HANDLE_PX * 2) return { left: -HANDLE_PX / 2, right: barW - HANDLE_PX / 2 };
    return { left: -HANDLE_PX, right: barW };
  }
  var PORT_PX = 20;
  function portOffsets(barW) {
    const h = handleOffsets(barW);
    return { left: h.left - PORT_PX, right: h.right + HANDLE_PX };
  }
  function bezierPoints(p0, p1, p2, p3, n = 16) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return out;
  }
  function distanceToPath(path, x, y) {
    let best = Infinity;
    for (let i = 0; i < path.length; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[Math.min(i + 1, path.length - 1)];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
    return best;
  }
  function nearestArrow(links, x, y, tolerance = 6) {
    let best = null;
    let bestD = tolerance;
    for (const link of links) {
      if (!link.path || link.path.length === 0) continue;
      const d = distanceToPath(link.path, x, y);
      if (d <= bestD) {
        best = link;
        bestD = d;
      }
    }
    return best;
  }
  function snapDays(deltaPx, dayPx2, mode) {
    const days = mode === "week" ? Math.round(deltaPx / (dayPx2 * 7)) * 7 : Math.round(deltaPx / dayPx2);
    return days === 0 ? 0 : days;
  }
  function shiftDates(task, startShift, endShift) {
    if (!task.startDate) return null;
    const start = addDays(task.startDate, startShift);
    let end = addDays(task.endDate || task.startDate, endShift);
    if (end < start) end = start;
    return { start, end };
  }

  // src/ui/canvas-palette.ts
  var CANVAS_TOKENS = {
    grid: "--cp-border",
    todayLine: "--cp-bg-brand",
    todayFlagBg: "--cp-bg-brand",
    todayFlagText: "--cp-text-inverse",
    labelChip: "--cp-surface-raised",
    labelText: "--cp-text",
    arrowOk: "--cp-border-bold",
    arrowViolated: "--cp-border-danger",
    arrowActive: "--cp-border-brand",
    badgeOkText: "--cp-text-success",
    badgeViolatedText: "--cp-text-danger",
    preview: "--cp-border-bold",
    focus: "--cp-border-focused",
    driverText: "--cp-text-brand"
  };
  function barStyle(task) {
    const epic = Boolean(task.isEpic || task.hierarchyLevel === 1);
    const track = epic ? "--cp-bar-epic" : "--cp-bar-planned";
    if (task.status === "COMPLETED") return { fill: "--cp-bar-done", track };
    if ((task.progress || 0) < (task.targetProgress || 0)) return { fill: "--cp-bar-late", track };
    return { fill: epic ? "--cp-bar-epic-fill" : "--cp-bar-fill", track };
  }
  function isInProgressZero(task) {
    const norm = (task.status || "").toUpperCase().replace(/[\s_-]+/g, "");
    const inProgress = norm === "INPROGRESS";
    const hasProgress = typeof task.progress === "number" && task.progress > 0;
    return inProgress && !hasProgress;
  }
  var ROW_BACKGROUNDS = ["--cp-surface", "--cp-surface-sunken"];
  var CANVAS_PAIRS = [
    ...[
      "--cp-bar-fill",
      "--cp-bar-epic-fill",
      "--cp-bar-done",
      "--cp-bar-late",
      CANVAS_TOKENS.todayLine,
      CANVAS_TOKENS.arrowOk,
      CANVAS_TOKENS.arrowViolated,
      CANVAS_TOKENS.arrowActive,
      CANVAS_TOKENS.preview,
      CANVAS_TOKENS.focus
    ].flatMap((fg) => ROW_BACKGROUNDS.map((bg) => ({ name: `graphic ${fg}`, fg, bg, min: 3 }))),
    { name: "label", fg: CANVAS_TOKENS.labelText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
    { name: "today flag", fg: CANVAS_TOKENS.todayFlagText, bg: CANVAS_TOKENS.todayFlagBg, min: 4.5 },
    { name: "badge ok", fg: CANVAS_TOKENS.badgeOkText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
    { name: "badge violated", fg: CANVAS_TOKENS.badgeViolatedText, bg: CANVAS_TOKENS.labelChip, min: 4.5 },
    { name: "driver", fg: CANVAS_TOKENS.driverText, bg: CANVAS_TOKENS.labelChip, min: 4.5 }
  ];
  var LABEL_PAD = 4;
  function labelPlacement(barX, barW, chipW, doneRatio = 0) {
    if (doneRatio > 0 && doneRatio < 1) {
      const fillW = Math.round(barW * doneRatio);
      if (fillW + chipW + LABEL_PAD * 2 <= barW) {
        return { x: barX + fillW + LABEL_PAD, inside: true };
      }
      if (fillW >= chipW + LABEL_PAD * 2 + 16 && chipW + LABEL_PAD * 2 <= barW) {
        return { x: barX + LABEL_PAD, inside: true };
      }
      return { x: barX + barW + LABEL_PAD, inside: false };
    }
    if (chipW + LABEL_PAD * 2 <= barW) return { x: barX + LABEL_PAD, inside: true };
    return { x: barX + barW + LABEL_PAD, inside: false };
  }
  var FORCED_COLOURS = {
    [CANVAS_TOKENS.grid]: "GrayText",
    [CANVAS_TOKENS.todayLine]: "Highlight",
    [CANVAS_TOKENS.todayFlagText]: "HighlightText",
    [CANVAS_TOKENS.labelChip]: "Canvas",
    [CANVAS_TOKENS.labelText]: "CanvasText",
    [CANVAS_TOKENS.arrowOk]: "CanvasText",
    [CANVAS_TOKENS.arrowViolated]: "LinkText",
    [CANVAS_TOKENS.arrowActive]: "Highlight",
    [CANVAS_TOKENS.badgeOkText]: "CanvasText",
    [CANVAS_TOKENS.badgeViolatedText]: "LinkText",
    [CANVAS_TOKENS.focus]: "Highlight",
    [CANVAS_TOKENS.driverText]: "CanvasText",
    "--cp-bar-fill": "Highlight",
    "--cp-bar-epic-fill": "Highlight",
    "--cp-bar-done": "Highlight",
    "--cp-bar-late": "Highlight",
    "--cp-bar-planned": "Canvas",
    "--cp-bar-epic": "Canvas"
  };

  // src/frontend/canvas-timeline.ts
  var ROW_H = 44;
  var BAR_H = 24;
  var CHIP_H = 18;
  var RADIUS = 5;
  var CanvasTimeline = class {
    constructor(wrapper) {
      this.wrapper = wrapper;
      __publicField(this, "canvas");
      __publicField(this, "ctx");
      __publicField(this, "model", null);
      __publicField(this, "index", /* @__PURE__ */ new Map());
      __publicField(this, "successors", /* @__PURE__ */ new Map());
      __publicField(this, "colours", /* @__PURE__ */ new Map());
      __publicField(this, "pending", 0);
      __publicField(this, "activeKey", null);
      __publicField(this, "hoveredRowKey", null);
      __publicField(this, "focusKey", null);
      __publicField(this, "driverKeys", []);
      __publicField(this, "drag", null);
      __publicField(this, "activeLinking", null);
      /** Focused element of the treegrid in the canvas fallback content, for drawFocusIfNeeded (B-15). */
      __publicField(this, "focusElement", null);
      /** The last input type: the system focus ring is drawn only after keyboard input (N-09). */
      __publicField(this, "lastInput", "pointer");
      __publicField(this, "forced", false);
      __publicField(this, "arrowLinks", []);
      __publicField(this, "onDraw");
      this.canvas = document.createElement("canvas");
      this.canvas.className = "timeline-canvas";
      const host = wrapper.parentElement;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      document.addEventListener("pointerdown", () => {
        this.lastInput = "pointer";
      }, true);
      document.addEventListener("keydown", () => {
        this.lastInput = "keyboard";
      }, true);
      const mq = window.matchMedia ? window.matchMedia("(forced-colors: active)") : null;
      const apply = () => {
        this.forced = !!(mq && mq.matches);
        this.canvas.dataset.forced = this.forced ? "1" : "0";
        this.invalidateColours();
      };
      apply();
      if (mq && mq.addEventListener) mq.addEventListener("change", () => {
        apply();
        this.requestDraw();
      });
    }
    /** The canvas element; its fallback content holds the accessible treegrid (B-15). */
    get root() {
      return this.canvas;
    }
    getArrowLinks() {
      return this.arrowLinks;
    }
    setModel(model) {
      if (!this.model || this.model.tasks !== model.tasks) {
        this.index = new Map(model.tasks.map((t, i) => [t.key, i]));
        this.successors = /* @__PURE__ */ new Map();
        model.tasks.forEach((t, i) => {
          const p = t.dependency && t.dependency.predecessorKey;
          if (p) this.successors.set(p, [...this.successors.get(p) || [], i]);
        });
      }
      this.model = model;
    }
    /** Forget resolved colours; the next draw reads the tokens again (theme change). */
    invalidateColours() {
      this.colours.clear();
    }
    /** Draw on the next animation frame; several requests in one frame draw once. */
    requestDraw() {
      if (this.pending) return;
      this.pending = requestAnimationFrame(() => {
        this.pending = 0;
        this.draw();
      });
    }
    c(token) {
      let v = this.colours.get(token);
      if (!v) {
        v = this.forced ? FORCED_COLOURS[token] || "CanvasText" : cssToken(token, "GrayText");
        this.colours.set(token, v);
      }
      return v;
    }
    draw() {
      const m = this.model;
      this.arrowLinks = [];
      const perf = globalThis.__cpPerf;
      if (perf) {
        performance.mark("cp:draw:start");
        globalThis.__cpLabels = [];
      }
      const w = this.wrapper;
      const left = w.scrollLeft + (m ? m.trackLeft : 0);
      const top = w.scrollTop + (m ? m.headerH : 0);
      const cssW = Math.max(0, w.clientWidth - (m ? m.trackLeft : 0));
      const cssH = Math.max(0, w.clientHeight - (m ? m.headerH : 0));
      if (!m || cssW === 0 || cssH === 0) {
        this.canvas.style.display = "none";
        this.onDraw?.([]);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const cv = this.canvas;
      cv.style.display = "block";
      cv.style.left = `${w.offsetLeft + left - w.scrollLeft}px`;
      cv.style.top = `${w.offsetTop + m.headerH}px`;
      cv.style.width = `${cssW}px`;
      cv.style.height = `${cssH}px`;
      const bw = Math.round(cssW * dpr);
      const bh = Math.round(cssH * dpr);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
      ctx.clearRect(left, top, cssW, cssH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, cssW, cssH);
      ctx.clip();
      this.drawHoveredRow(m, left, cssW);
      this.drawGrid(m, left, top, cssW, cssH);
      const todayX = this.drawTodayLine(m, top, cssH);
      const rects = this.barRects(m);
      this.drawArrows(m, rects, top, cssH);
      for (let i = m.first; i <= m.last; i++) this.drawBar(m, i, rects);
      if (this.activeLinking) this.drawActiveLinking(this.activeLinking, rects, left, cssW);
      if (todayX !== null) this.drawTodayFlag(m, todayX, top);
      ctx.restore();
      this.onDraw?.(this.arrowLinks);
      if (perf) {
        performance.measure("cp:draw", "cp:draw:start");
        globalThis.__cpArrows = this.arrowLinks;
      }
    }
    drawHoveredRow(m, left, cssW) {
      const hoverKey = this.hoveredRowKey || this.activeKey;
      if (!hoverKey) return;
      const hi = this.index.get(hoverKey);
      if (hi === void 0 || hi < m.first || hi > m.last) return;
      const ctx = this.ctx;
      const ry = m.rowTop(hi);
      ctx.save();
      ctx.fillStyle = this.c("--cp-surface-sunken");
      ctx.fillRect(left, ry, cssW, ROW_H);
      ctx.strokeStyle = this.c(CANVAS_TOKENS.focus);
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, ry + 0.5);
      ctx.lineTo(left + cssW, ry + 0.5);
      ctx.moveTo(left, ry + ROW_H - 0.5);
      ctx.lineTo(left + cssW, ry + ROW_H - 0.5);
      ctx.stroke();
      ctx.restore();
    }
    dates(task) {
      const moved = this.drag && this.drag.moves.get(task.key);
      return moved ? { startDate: moved.start, endDate: moved.end } : task;
    }
    rectFor(m, i, task, original = false) {
      const r = barRect(original ? task : this.dates(task), m.originIso, m.dayPx, m.rowTop(i), ROW_H, BAR_H);
      return r && { ...r, x: r.x + m.trackLeft };
    }
    /**
     * Bar rectangles by key for the rows in the DOM range and the rows at the other end of their
     * arrows. Only these are computed, so a draw costs the same at 1,000 and 5,000 tasks.
     */
    barRects(m) {
      const out = /* @__PURE__ */ new Map();
      const add = (i) => {
        if (i === void 0 || out.has(m.tasks[i].key)) return;
        const r = this.rectFor(m, i, m.tasks[i]);
        if (r) out.set(m.tasks[i].key, { i, r });
      };
      for (let i = m.first; i <= m.last; i++) {
        const t = m.tasks[i];
        add(i);
        if (t.dependency && t.dependency.predecessorKey) add(this.index.get(t.dependency.predecessorKey));
        for (const s of this.successors.get(t.key) || []) add(s);
      }
      return out;
    }
    drawGrid(m, left, top, w, h) {
      const ctx = this.ctx;
      ctx.strokeStyle = this.c(CANVAS_TOKENS.grid);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const gx of m.gridX(left - m.trackLeft, left - m.trackLeft + w)) {
        const x = Math.round(m.trackLeft + gx) + 0.5;
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + h);
      }
      ctx.stroke();
    }
    path(r, radius = RADIUS) {
      const ctx = this.ctx;
      const rad = Math.min(radius, r.h / 2, r.w / 2);
      ctx.beginPath();
      ctx.moveTo(r.x + rad, r.y);
      ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
      ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
      ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
      ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
      ctx.closePath();
    }
    chip(text, x, cy, fg, border) {
      const ctx = this.ctx;
      const tw = ctx.measureText(text).width;
      const r = { x, y: cy - CHIP_H / 2, w: tw + 10, h: CHIP_H };
      const labels = globalThis.__cpLabels;
      if (labels) labels.push(text);
      this.path(r, 4);
      ctx.fillStyle = this.c(CANVAS_TOKENS.labelChip);
      ctx.fill();
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = fg;
      ctx.fillText(text, x + 5, cy);
      return r.w;
    }
    drawBar(m, i, rects) {
      const task = m.tasks[i];
      const entry = task && rects.get(task.key);
      if (!entry) return;
      const ctx = this.ctx;
      const r = entry.r;
      const style = barStyle(task);
      const fill = this.c(style.fill);
      const isConflict = Boolean(this.drag && this.drag.key === task.key && this.drag.isConflict);
      if (this.drag && this.drag.moves.has(task.key)) {
        const old = this.rectFor(m, i, task, true);
        if (old) {
          this.path(old);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = this.c(isConflict ? CANVAS_TOKENS.arrowViolated : CANVAS_TOKENS.preview);
          ctx.lineWidth = isConflict ? 2 : 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      this.path(r);
      ctx.fillStyle = this.c(style.track);
      ctx.fill();
      const done = Math.max(0, Math.min(100, task.progress || 0)) / 100;
      if (done > 0) {
        ctx.save();
        this.path(r);
        ctx.clip();
        ctx.fillStyle = fill;
        ctx.fillRect(r.x, r.y, r.w * done, r.h);
        ctx.restore();
      } else if (isInProgressZero(task)) {
        ctx.save();
        this.path(r);
        ctx.clip();
        ctx.strokeStyle = fill;
        ctx.lineWidth = 1.75;
        ctx.globalAlpha = 0.45;
        const step = 7;
        ctx.beginPath();
        for (let offset = -r.h; offset < r.w + r.h; offset += step) {
          ctx.moveTo(r.x + offset, r.y + r.h);
          ctx.lineTo(r.x + offset + r.h, r.y);
        }
        ctx.stroke();
        ctx.restore();
      }
      const isHovered = task.key === this.activeKey && task.key !== this.focusKey;
      const isFocused = task.key === this.focusKey;
      const isDriver = this.driverKeys.includes(task.key);
      const focus = this.c(CANVAS_TOKENS.focus);
      this.path(r);
      ctx.strokeStyle = isConflict ? this.c(CANVAS_TOKENS.arrowViolated) : isFocused || isHovered || isDriver ? focus : fill;
      ctx.lineWidth = isConflict ? 2.5 : isFocused ? 2.25 : isHovered ? 2 : 1.5;
      ctx.setLineDash(isConflict ? [4, 3] : isDriver ? [5, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      if (isFocused && !isConflict) {
        ctx.save();
        ctx.strokeStyle = focus;
        ctx.lineWidth = 2;
        ctx.shadowColor = focus;
        ctx.shadowBlur = this.forced ? 0 : 6;
        this.path({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, RADIUS + 2);
        ctx.stroke();
        ctx.restore();
      }
      if (isFocused && this.focusElement && (this.lastInput === "keyboard" || this.forced)) {
        this.path(r);
        ctx.drawFocusIfNeeded(this.focusElement);
      }
      ctx.font = `600 11px ${cssToken("--cp-font", "sans-serif")}`;
      ctx.textBaseline = "middle";
      const epic = task.isEpic || task.hierarchyLevel === 1;
      const rollup = epic && task.childrenCount ? ` [${task.childrenCount} stories]` : "";
      let text = this.drag && this.drag.key === task.key ? this.drag.label : `${task.key} (${task.progress || 0}%)${rollup}`;
      if (isDriver) text = `${text} \xB7 Driver`;
      const chipW = ctx.measureText(text).width + 10;
      const place = labelPlacement(r.x, r.w, chipW, done);
      this.chip(text, place.x, r.y + r.h / 2, this.c(isDriver ? CANVAS_TOKENS.driverText : CANVAS_TOKENS.labelText));
    }
    drawArrows(m, rects, top, h) {
      const ctx = this.ctx;
      const active = this.activeKey;
      ctx.font = `600 10px ${cssToken("--cp-font", "sans-serif")}`;
      ctx.textBaseline = "middle";
      for (const { i } of rects.values()) {
        const task = m.tasks[i];
        const deps2 = Array.isArray(task.dependencies) && task.dependencies.length ? task.dependencies : task.dependency ? [task.dependency] : [];
        for (const dep of deps2) {
          if (dep && dep.predecessorKey) this.drawArrow(task, dep, rects, top, h, active);
        }
      }
    }
    drawArrow(task, dep, rects, top, h, active) {
      const ctx = this.ctx;
      const pred = rects.get(dep.predecessorKey);
      const succ = rects.get(task.key);
      if (!pred || !succ) return;
      const y1 = pred.r.y + pred.r.h / 2;
      const y2 = succ.r.y + succ.r.h / 2;
      if (Math.max(y1, y2) < top - ROW_H || Math.min(y1, y2) > top + h + ROW_H) return;
      const trigger = (typeof dep.triggerPercent === "number" ? dep.triggerPercent : 100) / 100;
      const x1 = pred.r.x + pred.r.w * trigger;
      const x2 = succ.r.x;
      const connected = active === task.key || active === dep.predecessorKey;
      const violated = Boolean(dep.isViolated);
      const colour = this.c(violated ? CANVAS_TOKENS.arrowViolated : connected ? CANVAS_TOKENS.arrowActive : CANVAS_TOKENS.arrowOk);
      let path;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      if (x2 >= x1 + 16) {
        const dx = Math.max(24, (x2 - x1) * 0.45);
        ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2 - 6, y2);
        path = bezierPoints([x1, y1], [x1 + dx, y1], [x2 - dx, y2], [x2 - 6, y2]);
      } else {
        const loopOutX = x1 + 16;
        const loopInX = x2 - 16;
        const midY = y1 < y2 ? y1 + ROW_H * 0.5 : y1 - ROW_H * 0.5;
        const midX = (loopOutX + loopInX) / 2;
        ctx.bezierCurveTo(loopOutX, y1, loopOutX, midY, midX, midY);
        ctx.bezierCurveTo(loopInX, midY, loopInX, y2, x2 - 6, y2);
        path = [
          ...bezierPoints([x1, y1], [loopOutX, y1], [loopOutX, midY], [midX, midY]),
          ...bezierPoints([midX, midY], [loopInX, midY], [loopInX, y2], [x2 - 6, y2]).slice(1)
        ];
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = active && !connected ? 1 : connected ? 2.5 : 1.75;
      ctx.setLineDash(violated ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 8, y2 - 4.5);
      ctx.lineTo(x2 - 8, y2 + 4.5);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x1, y1, connected ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      const when = dep.triggerDate ? `, ${dep.triggerDate}` : "";
      const planOnlyNote = dep.planOnly ? " (not in Jira)" : "";
      const text = (violated ? `${dep.triggerPercent}%${when}: starts too early` : `${dep.triggerPercent}%${when}`) + planOnlyNote;
      const tw = ctx.measureText(text).width + 10;
      const mid = path[Math.floor(path.length / 2)];
      const badgeX = mid[0];
      const badgeY = mid[1];
      this.arrowLinks.push({
        predecessorKey: dep.predecessorKey,
        successorKey: task.key,
        triggerPercent: typeof dep.triggerPercent === "number" ? dep.triggerPercent : 100,
        triggerDate: dep.triggerDate,
        isViolated: violated,
        ...dep.planOnly ? { planOnly: true } : {},
        x: badgeX,
        y: badgeY,
        width: tw,
        height: CHIP_H,
        text,
        path
      });
      const dim = Boolean(active) && !connected;
      if (dim) ctx.globalAlpha = 0.45;
      this.chip(
        text,
        badgeX - tw / 2,
        badgeY,
        this.c(violated ? CANVAS_TOKENS.badgeViolatedText : CANVAS_TOKENS.badgeOkText),
        colour
      );
      if (dim) ctx.globalAlpha = 1;
    }
    drawTodayLine(m, top, h) {
      const x = Math.round(m.trackLeft + xForDate(m.todayIso, m.originIso, m.dayPx) + m.dayPx / 2);
      if (x < m.trackLeft || x > m.trackLeft + m.trackWidth) return null;
      this.ctx.fillStyle = this.c(CANVAS_TOKENS.todayLine);
      this.ctx.fillRect(x - 1, top, 2, h);
      return x;
    }
    drawTodayFlag(m, x, top) {
      const ctx = this.ctx;
      ctx.font = `700 9px ${cssToken("--cp-font", "sans-serif")}`;
      ctx.textBaseline = "middle";
      const text = `TODAY (${m.todayIso})`;
      const tw = ctx.measureText(text).width + 12;
      const r = { x: x - tw / 2, y: top + 2, w: tw, h: 15 };
      this.path(r, 3);
      ctx.fillStyle = this.c(CANVAS_TOKENS.todayFlagBg);
      ctx.fill();
      ctx.fillStyle = this.c(CANVAS_TOKENS.todayFlagText);
      ctx.fillText(text, r.x + 6, r.y + r.h / 2);
    }
    drawActiveLinking(linking, rects, left, cssW) {
      const ctx = this.ctx;
      const { sourceKey, x1, y1, curX, curY, targetKey } = linking;
      const colour = this.c(CANVAS_TOKENS.arrowActive);
      const angle = Math.atan2(curY - y1, curX - x1);
      const dist = Math.hypot(curX - x1, curY - y1);
      const curveOffset = Math.min(60, dist * 0.35);
      let endX = curX;
      let endY = curY;
      let enterAngle = angle;
      if (targetKey) {
        const target = rects.get(targetKey);
        if (target) {
          endX = target.r.x;
          endY = target.r.y + target.r.h / 2;
          enterAngle = 0;
        }
      }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      if (targetKey) {
        const dx = Math.max(24, Math.abs(endX - x1) * 0.45);
        ctx.bezierCurveTo(x1 + dx, y1, endX - dx, endY, endX - 6, endY);
      } else {
        ctx.bezierCurveTo(
          x1 + Math.cos(angle) * curveOffset,
          y1 + Math.sin(angle) * curveOffset,
          endX - Math.cos(angle) * curveOffset,
          endY - Math.sin(angle) * curveOffset,
          endX,
          endY
        );
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      const tipLen = 9;
      const tipHalf = 5;
      const cosA = Math.cos(enterAngle);
      const sinA = Math.sin(enterAngle);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - cosA * tipLen + sinA * tipHalf, endY - sinA * tipLen - cosA * tipHalf);
      ctx.lineTo(endX - cosA * tipLen - sinA * tipHalf, endY - sinA * tipLen + cosA * tipHalf);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x1, y1, 5, 0, Math.PI * 2);
      ctx.fill();
      if (targetKey) {
        const target = rects.get(targetKey);
        if (target) {
          this.path({ x: target.r.x - 3, y: target.r.y - 3, w: target.r.w + 6, h: target.r.h + 6 }, RADIUS + 2);
          ctx.strokeStyle = colour;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
      ctx.font = `600 11px ${cssToken("--cp-font", "sans-serif")}`;
      ctx.textBaseline = "middle";
      const effectivePred = linking.predKey || sourceKey;
      const effectiveSucc = linking.succKey || targetKey;
      const label2 = targetKey ? `${effectiveSucc} depends on ${effectivePred}` : `Drag arrow to connect dependency`;
      const tw = ctx.measureText(label2).width + 10;
      const chipX = Math.max(left + 6, Math.min(left + cssW - tw - 6, curX + 12));
      this.chip(label2, chipX, Math.max(y1 - 24, curY - 18), this.c(CANVAS_TOKENS.driverText), colour);
    }
  };

  // src/ui/dependency-edit.ts
  function clampTriggerPercent(value) {
    if (value === void 0 || value === null) return 100;
    const num = typeof value === "number" ? value : parseInt(String(value), 10);
    if (isNaN(num)) return 100;
    return Math.max(0, Math.min(100, num));
  }
  function dependencyPopoverTitle(predKey, succKey) {
    return `${predKey} \u2794 ${succKey}`;
  }
  function buildDraggedDependencyLink(sourceKey, targetKey, triggerPercent = 100, side = "right") {
    const isRight = side === "right";
    return {
      predecessorKey: isRight ? sourceKey : targetKey,
      successorKey: isRight ? targetKey : sourceKey,
      triggerPercent: clampTriggerPercent(triggerPercent),
      isViolated: false,
      isNew: true
    };
  }
  function swapDependencyDirection(link) {
    return {
      ...link,
      predecessorKey: link.successorKey,
      successorKey: link.predecessorKey
    };
  }
  function computeDependencyPreview(pred, triggerPercent, today) {
    if (!pred.startDate) {
      return {
        isSatisfied: false,
        earliestStartDate: null,
        triggerDate: null,
        summary: "Predecessor has no planned start date."
      };
    }
    const effort = {
      workEffortId: pred.key,
      estimatedStartDate: pred.startDate,
      estimatedCompletionDate: pred.endDate || pred.startDate,
      percentComplete: pred.progress || 0,
      started: pred.status === "IN_PROGRESS" || pred.status === "COMPLETED"
    };
    const res = earliestStart(effort, triggerPercent, today);
    return {
      isSatisfied: res.basis === "satisfied",
      earliestStartDate: res.date,
      triggerDate: res.triggerDate,
      summary: res.reason
    };
  }
  function checkDependencyConflict(task, tasks, today) {
    if (!task.startDate) return { hasConflict: false };
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const target = byKey.get(task.key);
    if (!target) return { hasConflict: false };
    const chain = [];
    for (let cur = target; cur && !chain.includes(cur); cur = cur.parentKey ? byKey.get(cur.parentKey) : void 0) chain.push(cur);
    const isSelfOrBelow = (key) => {
      const seen = /* @__PURE__ */ new Set();
      for (let cur = byKey.get(key); cur && !seen.has(cur.key); cur = cur.parentKey ? byKey.get(cur.parentKey) : void 0) {
        if (cur.key === task.key) return true;
        seen.add(cur.key);
      }
      return false;
    };
    let worst = { hasConflict: false };
    for (const holder of chain) {
      const deps2 = holder.dependencies || (holder.dependency ? [holder.dependency] : []);
      for (const dep of deps2) {
        if (!dep || !dep.predecessorKey || isSelfOrBelow(dep.predecessorKey)) continue;
        const pred = byKey.get(dep.predecessorKey);
        if (!pred || !pred.startDate) continue;
        const triggerPercent = typeof dep.triggerPercent === "number" ? dep.triggerPercent : 100;
        const preview = computeDependencyPreview(pred, triggerPercent, today);
        if (preview.earliestStartDate && task.startDate < preview.earliestStartDate && (!worst.hasConflict || preview.earliestStartDate > worst.earliestDate)) {
          worst = {
            hasConflict: true,
            predKey: pred.key,
            triggerPercent,
            earliestDate: preview.earliestStartDate,
            triggerDate: preview.triggerDate,
            reason: preview.summary,
            ...holder.key !== task.key ? { viaParent: holder.key } : {}
          };
        }
      }
    }
    return worst;
  }
  function clampToEarliestStart(candidateStart, candidateEnd, earliestDate) {
    if (!earliestDate || candidateStart >= earliestDate) {
      return { startDate: candidateStart, endDate: candidateEnd };
    }
    const diffDays = daysBetween(candidateStart, earliestDate);
    return {
      startDate: earliestDate,
      endDate: addDays(candidateEnd, diffDays)
    };
  }
  function suggestTriggerToFit(pred, succStartDate) {
    if (!pred.startDate || succStartDate <= pred.startDate) return 0;
    const predEnd = pred.endDate || pred.startDate;
    const totalDays = Math.max(1, daysBetween(pred.startDate, predEnd) + 1);
    const elapsedDays = Math.max(0, daysBetween(pred.startDate, succStartDate));
    const pct = Math.floor(elapsedDays / totalDays * 100);
    return Math.max(0, Math.min(100, pct));
  }
  function isEnforceDepsActive(checkbox, storageValue) {
    if (checkbox && typeof checkbox.checked === "boolean") {
      return checkbox.checked;
    }
    return storageValue === "on";
  }

  // src/ui/column-layout.ts
  var ALL_COLUMN_KEYS = [
    "epic",
    "story",
    "task",
    "resource",
    "effort",
    "progress",
    "target",
    "status"
  ];
  var DEFAULT_COLUMN_WIDTHS = {
    epic: 110,
    story: 100,
    task: 260,
    resource: 130,
    effort: 65,
    progress: 65,
    target: 65,
    status: 95
  };
  var MIN_COLUMN_WIDTHS = {
    epic: 68,
    story: 64,
    task: 160,
    resource: 80,
    effort: 48,
    progress: 50,
    target: 50,
    status: 70
  };
  var COMPACT_TASK_DEFAULT_WIDTH = 220;
  var MAX_COLUMN_WIDTH = 640;
  function sanitizeLoadedColumnWidths(saved) {
    const out = { ...DEFAULT_COLUMN_WIDTHS };
    if (!saved || typeof saved !== "object") return out;
    for (const key of ALL_COLUMN_KEYS) {
      const raw = Number(saved[key]);
      if (Number.isFinite(raw) && raw >= MIN_COLUMN_WIDTHS[key]) {
        out[key] = Math.min(MAX_COLUMN_WIDTH, Math.round(raw));
      }
    }
    return out;
  }
  function clampColumnResize(key, candidateWidth) {
    const k = key;
    const fallback = DEFAULT_COLUMN_WIDTHS[k] ?? 96;
    if (!Number.isFinite(candidateWidth)) return fallback;
    const minW = MIN_COLUMN_WIDTHS[k] ?? 64;
    return Math.max(minW, Math.min(MAX_COLUMN_WIDTH, Math.round(candidateWidth)));
  }
  function computeFrozenLayout(visibleKeys, columnWidths2, compactColumns, compactTaskWidth2 = COMPACT_TASK_DEFAULT_WIDTH) {
    const widths = {};
    const offsets = {};
    let x = 0;
    let lastKey = null;
    for (const k of visibleKeys) {
      const base = compactColumns && k === "task" ? compactTaskWidth2 : columnWidths2[k] ?? DEFAULT_COLUMN_WIDTHS[k] ?? 100;
      const w = Math.round(base);
      widths[k] = w;
      offsets[k] = x;
      x += w;
      lastKey = k;
    }
    return { visibleKeys, widths, offsets, totalWidth: x, lastKey };
  }

  // src/ui/progress-status.ts
  var LABEL = { NOT_STARTED: "To Do", IN_PROGRESS: "In Progress", COMPLETED: "Done" };
  function planStatus(status) {
    return status === "COMPLETED" || status === "IN_PROGRESS" ? status : "NOT_STARTED";
  }
  function isDone(status) {
    return status === "COMPLETED";
  }
  function statusOffers(edits) {
    const out = [];
    for (const e of edits) {
      if (e.chosenStatus !== void 0) continue;
      const from = planStatus(e.status);
      if (from === "COMPLETED") continue;
      const p = Number(e.progress);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (p >= 100) out.push({ key: e.key, from, to: "COMPLETED" });
      else if (from === "NOT_STARTED") out.push({ key: e.key, from, to: "IN_PROGRESS" });
    }
    return out;
  }
  function offerPrompt(offers) {
    if (!offers.length) return null;
    if (offers.length === 1) {
      const o = offers[0];
      return {
        question: `${o.key} is ${LABEL[o.from]} in Jira. Also move it to ${LABEL[o.to]}?`,
        lines: [],
        move: `Move to ${LABEL[o.to]}`,
        keep: `Keep ${LABEL[o.from]}`
      };
    }
    return {
      question: `The new progress does not match the Jira status of ${offers.length} work items. Also change their status in Jira?`,
      lines: offers.map((o) => `${o.key}: ${LABEL[o.from]} to ${LABEL[o.to]}`),
      move: "Change the statuses",
      keep: "Keep the statuses"
    };
  }
  function progressLockReason(t) {
    return isDone(t.status) ? `${t.key} is Done in Jira, so its progress is 100%. Change its status to reopen it.` : null;
  }
  function progressText(t) {
    const p = Math.max(0, Math.min(100, Math.round(Number(t.progress) || 0)));
    return p === 100 && !isDone(t.status) ? "100%, not Done in Jira" : `${p}%`;
  }

  // src/ui/keyboard-grid.ts
  var GRID_COLUMNS = ["Key", "Summary", "Start", "Due", "Progress", "Status", "Dependencies"];
  var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function navigate(pos, e, rows, cols, page) {
    const last = rows - 1;
    switch (e.key) {
      case "ArrowDown":
        return { row: clamp(pos.row + 1, 0, last), col: pos.col };
      case "ArrowUp":
        return { row: clamp(pos.row - 1, 0, last), col: pos.col };
      case "ArrowRight":
        return { row: pos.row, col: clamp(pos.col + 1, 0, cols - 1) };
      case "ArrowLeft":
        return { row: pos.row, col: clamp(pos.col - 1, 0, cols - 1) };
      case "Home":
        return e.ctrlKey ? { row: 0, col: pos.col } : { row: pos.row, col: 0 };
      case "End":
        return e.ctrlKey ? { row: last, col: pos.col } : { row: pos.row, col: cols - 1 };
      case "PageDown":
        return { row: clamp(pos.row + page, 0, last), col: pos.col };
      case "PageUp":
        return { row: clamp(pos.row - page, 0, last), col: pos.col };
      default:
        return null;
    }
  }
  var STATUS = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Done" };
  function dependencyText(dep) {
    if (!dep || !dep.predecessorKey) return "None";
    const when = dep.triggerDate ? ` (${dep.triggerDate})` : "";
    return `Starts when ${dep.predecessorKey} reaches ${dep.triggerPercent}%${when}` + (dep.isViolated ? ". Starts too early" : "");
  }
  function rowCells(t) {
    return [
      t.key,
      t.summary || "No summary",
      t.startDate || "Not scheduled",
      t.endDate || "Not scheduled",
      progressText(t),
      STATUS[t.status] || t.status,
      dependencyText(t.dependency)
    ];
  }
  function rowLevel(t, planKeys) {
    if (t.isEpic || t.hierarchyLevel === 1) return 1;
    if (t.isSubtask || t.hierarchyLevel === -1) return t.parentKey && planKeys.has(t.parentKey) ? 3 : 2;
    return t.epicKey && planKeys.has(t.epicKey) ? 2 : 1;
  }
  function moveKey(s, e) {
    const step = e.shiftKey ? 7 : 1;
    switch (e.key) {
      case "ArrowRight":
        return { state: { ...s, start: s.start + step, end: s.end + step }, action: "move" };
      case "ArrowLeft":
        return { state: { ...s, start: s.start - step, end: s.end - step }, action: "move" };
      case "]":
        return { state: { ...s, end: s.end + 1 }, action: "move" };
      case "[":
        return { state: { ...s, end: s.end - 1 }, action: "move" };
      case "Enter":
        return { state: s, action: "commit" };
      case "Escape":
        return { state: s, action: "cancel" };
      default:
        return { state: s, action: null };
    }
  }
  function moveAnnouncement(key, start, end, entering) {
    const dates = `${key}: ${start} to ${end}.`;
    return entering ? `Move mode for ${dates} Left and Right move 1 day, with Shift 1 week; [ and ] change the due date; Enter saves; Escape cancels.` : dates;
  }

  // src/ui/weekly-hours.ts
  function weeklyHours(tasks, weekStarts) {
    const byName = /* @__PURE__ */ new Map();
    for (const t of tasks) {
      if (t.isEpic || t.hierarchyLevel === 1 || !t.resource || t.resource === "Unassigned" || !(t.effortHours > 0) || !t.startDate || !t.endDate) continue;
      const days = daysBetween(t.startDate, t.endDate) + 1;
      const perDay = t.effortHours / days;
      const row = byName.get(t.resource) || weekStarts.map(() => 0);
      weekStarts.forEach((ws, i) => {
        const from = Math.max(0, daysBetween(t.startDate, ws));
        const to = Math.min(days - 1, daysBetween(t.startDate, ws) + 6);
        if (to >= from) row[i] += (to - from + 1) * perDay;
      });
      byName.set(t.resource, row);
    }
    return [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, hours]) => ({ name, hours: hours.map((h) => Math.round(h * 10) / 10) }));
  }

  // src/ui/first-run.ts
  function emptyState(plan) {
    if (!plan || plan.tasks && plan.tasks.length > 0) return null;
    const waiting = (plan.backlogTasks || []).length;
    if (waiting > 0) {
      return {
        title: "Nothing is scheduled yet",
        text: `${waiting === 1 ? "1 issue is" : `${waiting} issues are`} waiting in the backlog. Drag issues onto the timeline to plan them.`,
        action: { id: "schedule", label: "Schedule your first issues" }
      };
    }
    if (plan.jqlFilter) {
      return { title: "No work items match this plan's filter", text: `The filter is: ${plan.jqlFilter}. A plan approver can change or clear it in the plan list.`, action: { id: "create", label: "Create an issue" } };
    }
    return { title: "This project has no issues yet", text: "Create an issue to start the plan. It is created in Jira.", action: { id: "create", label: "Create an issue" } };
  }
  function showLinkHint(plan, stored) {
    if (!plan || stored === "done") return false;
    const scheduled = (plan.tasks || []).filter((t) => t.startDate);
    return scheduled.length >= 2 && !scheduled.some((t) => t.dependency && t.dependency.predecessorKey);
  }

  // src/frontend/dynamic-style.ts
  var PROPERTIES = [
    ["data-css-w", "width"],
    ["data-css-left", "left"],
    ["data-css-pl", "paddingLeft"]
  ];
  var SELECTOR = PROPERTIES.map(([a]) => `[${a}]`).join(",");
  var LENGTH = /^-?\d+(\.\d+)?(px|%)$/;
  function applyDynamicStyles(root) {
    const below = Array.from(root.querySelectorAll(SELECTOR));
    const elements = root.matches(SELECTOR) ? [root, ...below] : below;
    for (const el3 of elements) {
      for (const [attribute, property] of PROPERTIES) {
        const value = el3.getAttribute(attribute);
        if (value !== null && LENGTH.test(value)) el3.style[property] = value;
      }
    }
  }

  // src/ui/selection.ts
  function toggleKey(selected, key) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }
  function rangeKeys(order, anchor, key) {
    const a = anchor ? order.indexOf(anchor) : -1;
    const b = order.indexOf(key);
    if (a < 0 || b < 0) return [key];
    return order.slice(Math.min(a, b), Math.max(a, b) + 1);
  }
  function selectedBlockParents(tasks, selected) {
    return tasks.filter((t) => selected.has(t.key) && t.datesFromChildren && !t.isEpic && (t.hierarchyLevel ?? 0) === 0).map((t) => t.key);
  }
  function moveSelectionBy(tasks, selected, days) {
    if (!days) return [];
    const blocks = new Set(selectedBlockParents(tasks, selected));
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    const inSelectedBlock = (t) => {
      const seen = /* @__PURE__ */ new Set();
      for (let k = t.parentKey; k && !seen.has(k); k = byKey.get(k)?.parentKey) {
        if (blocks.has(k)) return true;
        seen.add(k);
      }
      return false;
    };
    return tasks.filter((t) => selected.has(t.key) && t.startDate && !t.isEpic && t.hierarchyLevel !== 1 && !t.datesFromChildren && !inSelectedBlock(t)).sort((a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0).map((t) => ({ taskId: t.key, updates: { startDate: addDays(t.startDate, days), endDate: addDays(t.endDate || t.startDate, days) }, expectedVersion: t.version || 0 }));
  }
  function progressFromDigit(key) {
    return /^[0-9]$/.test(key) ? Number(key) * 10 : null;
  }

  // src/domain/baseline.ts
  var round1 = (n) => Math.round(n * 10) / 10;
  function baselineItems(tasks) {
    return tasks.filter((t) => t && t.id && t.key && !t.isEpic && (t.hierarchyLevel ?? 0) < 1 && !t.datesFromChildren && !!t.startDate).map((t) => {
      const item = { id: String(t.id), key: t.key };
      if (typeof t.effortHours === "number" && t.effortHours > 0) item.hours = round1(t.effortHours);
      if (t.startDate) item.start = t.startDate.slice(0, 10);
      if (t.endDate) item.end = t.endDate.slice(0, 10);
      if (t.status === "COMPLETED") item.done = true;
      return item;
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  function totals(items) {
    return {
      itemCount: items.length,
      totalHours: round1(items.reduce((s, i) => s + (i.hours || 0), 0)),
      unestimated: items.filter((i) => i.hours === void 0).length
    };
  }
  function compareItems(from, to) {
    const a = new Map(from.map((i) => [i.id, i]));
    const b = new Map(to.map((i) => [i.id, i]));
    const added = to.filter((i) => !a.has(i.id));
    const removed = from.filter((i) => !b.has(i.id));
    const changed = [];
    for (const x of from) {
      const y = b.get(x.id);
      if (!y) continue;
      if (x.hours === y.hours && x.start === y.start && x.end === y.end) continue;
      const c = { id: x.id, key: y.key };
      if (x.hours !== y.hours) {
        c.fromHours = x.hours;
        c.toHours = y.hours;
      }
      if (x.start !== y.start) {
        c.fromStart = x.start;
        c.toStart = y.start;
      }
      if (x.end !== y.end) {
        c.fromEnd = x.end;
        c.toEnd = y.end;
      }
      changed.push(c);
    }
    const fromHours = totals(from).totalHours;
    const toHours = totals(to).totalHours;
    const deltaHours = round1(toHours - fromHours);
    const slipped = changed.filter((c) => c.fromEnd && c.toEnd && c.toEnd > c.fromEnd).length;
    const grew = added.length > 0 || deltaHours > 0 || slipped > 0 || changed.some((c) => (c.toHours || 0) > (c.fromHours || 0));
    return {
      added,
      removed,
      changed,
      fromHours,
      toHours,
      deltaHours,
      deltaPercent: fromHours > 0 ? round1(deltaHours / fromHours * 100) : 0,
      fromCount: from.length,
      toCount: to.length,
      slipped,
      grew
    };
  }

  // src/ui/time-scale.ts
  var ZOOMS = [
    { id: "day", label: "Day", dayPx: 40, snap: "day" },
    { id: "week", label: "Week", dayPx: 85 / 7, snap: "day" },
    { id: "month", label: "Month", dayPx: 4, snap: "week" },
    { id: "quarter", label: "Quarter", dayPx: 1.5, snap: "week" },
    { id: "year", label: "Year", dayPx: 0.5, snap: "week" }
  ];
  function zoomById(id) {
    return ZOOMS.find((z) => z.id === id) || ZOOMS[1];
  }
  function zoomStep(id, dir) {
    const i = ZOOMS.findIndex((z) => z.id === id);
    return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i - dir))].id;
  }
  function mondayOf(iso2) {
    const dow = (/* @__PURE__ */ new Date(`${iso2}T00:00:00Z`)).getUTCDay();
    return addDays(iso2, -((dow + 6) % 7));
  }
  function rangeDays(r) {
    return daysBetween(r.start, r.end) + 1;
  }
  function extendRange(r, side, weeks) {
    return side === "before" ? { start: addDays(r.start, -weeks * 7), end: r.end } : { start: r.start, end: addDays(r.end, weeks * 7) };
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function parts(iso2) {
    const dt = /* @__PURE__ */ new Date(`${iso2}T00:00:00Z`);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), dow: dt.getUTCDay() };
  }
  var iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  function unitBounds(day2, zoom) {
    const p = parts(day2);
    switch (zoom.id) {
      case "day":
        return [day2, addDays(day2, 1)];
      case "week":
        return [mondayOf(day2), addDays(mondayOf(day2), 7)];
      case "month":
        return [iso(p.y, p.m, 1), iso(p.y, p.m + 1, 1)];
      case "quarter":
        return [iso(p.y, p.m - p.m % 3, 1), iso(p.y, p.m - p.m % 3 + 3, 1)];
      default:
        return [iso(p.y, 0, 1), iso(p.y + 1, 0, 1)];
    }
  }
  function label(start, zoom) {
    const p = parts(start);
    switch (zoom.id) {
      case "day":
        return `${DAYS[p.dow]} ${p.d}`;
      case "week":
        return `${String(p.d).padStart(2, "0")}-${MONTHS[p.m]}`;
      case "month":
        return `${MONTHS[p.m]} ${p.y}`;
      case "quarter":
        return `Q${Math.floor(p.m / 3) + 1} ${p.y}`;
      default:
        return String(p.y);
    }
  }
  function headerCells(r, zoom, today, fromX = -Infinity, toX = Infinity) {
    const out = [];
    const total = rangeDays(r);
    let day2 = r.start;
    while (daysBetween(r.start, day2) < total) {
      const [, next] = unitBounds(day2, zoom);
      const x = daysBetween(r.start, day2) * zoom.dayPx;
      const w = Math.min(daysBetween(day2, next), total - daysBetween(r.start, day2)) * zoom.dayPx;
      if (x + w > fromX && x < toX) {
        const [uStart] = unitBounds(day2, zoom);
        out.push({ key: uStart, label: label(uStart, zoom), x, w, current: today >= uStart && today < next });
      }
      day2 = next;
    }
    return out;
  }
  function gridLines(r, zoom, fromX, toX) {
    return headerCells(r, zoom, "", fromX, toX).map((c) => c.x).filter((x) => x >= fromX && x <= toX);
  }
  function anchorScroll(anchorIso, viewportX, originIso2, dayPx2) {
    return daysBetween(originIso2, anchorIso) * dayPx2 - viewportX;
  }
  function dateAt(x, originIso2, dayPx2) {
    return addDays(originIso2, Math.floor(x / dayPx2));
  }

  // src/ui/table-view.ts
  function formatTableDate(iso2) {
    if (!iso2) return "-";
    const trimmed = iso2.trim();
    return trimmed ? trimmed : "-";
  }
  function formatTableProgress(progress) {
    if (typeof progress !== "number" || !Number.isFinite(progress)) return "0%";
    const p = Math.max(0, Math.min(100, Math.round(progress)));
    return `${p}%`;
  }
  function formatTableDependencies(task) {
    const list = task.dependencies && task.dependencies.length > 0 ? task.dependencies : task.dependency ? [task.dependency] : [];
    if (list.length === 0) return "-";
    const valid = list.filter((d) => Boolean(d.predecessorKey && d.predecessorKey.trim()));
    if (valid.length === 0) return "-";
    return valid.map((d) => `${d.predecessorKey} (${d.triggerPercent !== void 0 ? d.triggerPercent : 100}%)`).join(", ");
  }
  function buildTableViewRows(tasks) {
    return tasks.map((t) => ({
      key: t.key,
      summary: t.summary || "",
      issueType: t.issueType || "Task",
      epic: t.epic || "-",
      assignee: t.resource || "Unassigned",
      startDate: formatTableDate(t.startDate),
      dueDate: formatTableDate(t.endDate),
      progress: formatTableProgress(t.progress),
      status: t.status || "To Do",
      dependencies: formatTableDependencies(t)
    }));
  }
  function toggleTableView(currentView2) {
    return currentView2 === "table" ? "timeline" : "table";
  }

  // src/ui/in-app-search.ts
  function matchTask(task, query) {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    const k = task.key ? task.key.toLowerCase() : "";
    const s = task.summary ? task.summary.toLowerCase() : "";
    return k.includes(q) || s.includes(q);
  }
  function findMatchingTasks(tasks, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    tasks.forEach((task, index) => {
      if (matchTask(task, q)) {
        results.push({ task, index });
      }
    });
    return results;
  }
  function findNextMatch(matchIndices, currentMatchPos, direction = 1) {
    const count = matchIndices.length;
    if (count === 0) return -1;
    if (currentMatchPos < 0) return direction === 1 ? 0 : count - 1;
    return (currentMatchPos + direction + count) % count;
  }
  function formatMatchCount(query, matchCount, currentMatchPos) {
    const q = query.trim();
    if (!q) return "";
    if (matchCount === 0) return "No matches";
    const pos = Math.max(0, currentMatchPos);
    return `${pos + 1} of ${matchCount}`;
  }
  function isSearchShortcut(e) {
    if (e.altKey) return false;
    const isCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);
    return isCtrlOrCmd && (e.key === "f" || e.key === "F");
  }

  // src/ui/second-person.ts
  function formatRemovalPrompt(contributorName, subtaskKey) {
    return `Remove ${contributorName}? Do you want to delete or unassign Jira subtask ${subtaskKey}?`;
  }

  // src/ui/plan-manager.ts
  function categorizePlan(plan) {
    return plan.isDefault || plan.id === "default" ? "main" : "scenario";
  }
  function validateNewPlanName(name) {
    if (typeof name !== "string") {
      return { valid: false, error: "Plan name must be text", cleanName: "" };
    }
    const clean = name.trim();
    if (clean.length === 0) {
      return { valid: false, error: "Plan name cannot be empty", cleanName: "" };
    }
    if (clean.length > 80) {
      return { valid: false, error: "Plan name must be at most 80 characters", cleanName: clean };
    }
    return { valid: true, cleanName: clean };
  }
  function suggestCloneName(originalName, existingNames = []) {
    const base = originalName.replace(/\s*\(Copy(\s+\d+)?\)$/i, "").trim();
    let candidate = `${base} (Copy)`;
    let counter = 2;
    const lowerSet = new Set(existingNames.map((n) => n.toLowerCase().trim()));
    while (lowerSet.has(candidate.toLowerCase())) {
      candidate = `${base} (Copy ${counter})`;
      counter++;
    }
    return candidate;
  }
  function buildPlanListViewModel(plans, activePlanId2) {
    if (!plans || plans.length === 0) {
      return [{ id: "default", name: "Main Plan", isDefault: true, isActive: true, canDelete: false, category: "main" }];
    }
    return plans.filter((p) => p.state !== "deleting").map((p) => {
      const isDefault = p.id === "default" || p.isDefault === true;
      return {
        id: p.id,
        name: p.name,
        isDefault,
        isActive: p.id === activePlanId2,
        canDelete: !isDefault,
        category: categorizePlan(p),
        ...p.state === "copying" ? { copying: true } : {}
      };
    });
  }
  function filterPlans(plans, query = "", category = "all") {
    const q = (query || "").trim().toLowerCase();
    return plans.filter((p) => {
      if (category === "scenarios" && p.category !== "scenario") return false;
      if (q.length > 0 && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // src/frontend/legacy-planner.js
  var optimisticTasks = /* @__PURE__ */ new Map();
  function registerOptimisticTask(task) {
    if (!task || !task.key) return;
    optimisticTasks.set(task.key, { task, timestamp: Date.now() });
  }
  function mergeOptimisticTasks(plan) {
    if (!plan || !Array.isArray(plan.tasks)) return;
    const now = Date.now();
    for (const [key, entry] of optimisticTasks.entries()) {
      if (now - entry.timestamp > 6e4) {
        optimisticTasks.delete(key);
        continue;
      }
      const exists = plan.tasks.some((t) => t.key === key);
      if (!exists) {
        plan.tasks.push(entry.task);
      } else {
        optimisticTasks.delete(key);
      }
    }
  }
  function getJiraBaseUrl() {
    if (currentPlan && currentPlan.siteUrl) {
      return currentPlan.siteUrl.replace(/\/+$/, "");
    }
    try {
      if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
        const orig = window.location.ancestorOrigins[0];
        if (orig && orig.includes("atlassian.net")) return orig.replace(/\/+$/, "");
      }
      if (document.referrer) {
        const refOrig = new URL(document.referrer).origin;
        if (refOrig && refOrig.includes("atlassian.net")) return refOrig.replace(/\/+$/, "");
      }
    } catch (e) {
    }
    return "https://asymmsystems.atlassian.net";
  }
  function openJiraIssueInNewTab(issueKey, event) {
    if (event) {
      event.stopPropagation();
    }
    if (!issueKey) return;
    try {
      openIssueInNewTab(issueKey);
      if (event) event.preventDefault();
      return;
    } catch (err) {
      console.warn("Forge router.open failed, using window.open fallback:", err);
    }
    const baseUrl = getJiraBaseUrl();
    const fullUrl = `${baseUrl}/browse/${issueKey}`;
    if (!event || !event.target || event.target.tagName !== "A" && !event.target.closest("a")) {
      window.open(fullUrl, "_blank", "noopener,noreferrer");
    }
  }
  var UNDOABLE = /* @__PURE__ */ new Set(["updateWbsTask", "unscheduleTask", "scheduleBacklogTask", "batchUpdateTasks", "moveTaskGroup"]);
  var undoStack = new UndoStack(20);
  var pendingUndo = null;
  var replayingUndo = false;
  var activePlanId = MAIN_PLAN_ID;
  var planScope;
  function browserStore() {
    try {
      return window.localStorage;
    } catch (e) {
      return void 0;
    }
  }
  function setActivePlan(planId) {
    const next = planId || MAIN_PLAN_ID;
    if (next !== activePlanId) {
      undoStack.clear();
      pendingUndo = null;
    }
    activePlanId = next;
    setSavedPlanId(browserStore(), planScope, activePlanId);
  }
  async function callResolver2(fn, payload = {}, opts = {}) {
    const mergedPayload = { planId: activePlanId, ...payload };
    if (!UNDOABLE.has(fn) || replayingUndo) return callResolver(fn, mergedPayload);
    if (!pendingUndo) pendingUndo = { before: opts.before || snapshotPlan(currentPlan), fn, payload: mergedPayload };
    const res = await callResolver(fn, mergedPayload);
    const verdict = classifyResult(res);
    if (verdict.failed) {
      pendingUndo = null;
      showFlag({ text: verdict.message || "The change was not saved.", error: true });
    } else {
      pendingUndo.done = true;
      pendingUndo.jiraSync = res && res.jiraSync;
    }
    return res;
  }
  function settleUndo() {
    const p = pendingUndo;
    if (!p || !p.done || !currentPlan) return;
    pendingUndo = null;
    const after = withWrittenStatuses(snapshotPlan(currentPlan), p.payload, p.jiraSync);
    const entry = buildUndoEntry(p.before, after, p.payload.taskId || p.payload.items && p.payload.items[0] && p.payload.items[0].taskId);
    if (!entry) return;
    entry.label = actionLabel(p.fn, p.payload, entry);
    undoStack.push(entry);
    showFlag({ text: `${entry.label}.`, action: { label: "Undo", run: undoLast } });
  }
  function findAnyTask(key) {
    return findTask(key) || (currentPlan?.backlogTasks || []).find((t) => t.key === key);
  }
  var planOnlyNoted = /* @__PURE__ */ new Set();
  function notePlanOnlyLinks(plan) {
    const all = (plan.tasks || []).concat(plan.backlogTasks || []);
    const found = [];
    for (const t of all) for (const d of t.dependencies || []) if (d && d.planOnly) found.push(`${d.predecessorKey} \u2794 ${t.key}`);
    const scope = `${activePlanId}:${found.join(",")}`;
    if (!found.length || planOnlyNoted.has(scope)) return;
    planOnlyNoted.add(scope);
    showFlag({ text: `${found.length} link${found.length === 1 ? "" : "s"} exist only in this plan, not in Jira (${found.slice(0, 5).join(", ")}${found.length > 5 ? ", ..." : ""}). They still schedule. Open a link marked "not in Jira" to create it in Jira or remove it.` });
  }
  function levelOf(t) {
    return t.isEpic ? 1 : t.isSubtask ? -1 : t.hierarchyLevel ?? 0;
  }
  function hierarchyActionFor(dragged, target) {
    if (!dragged || !target || dragged.key === target.key) return null;
    const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
    const byKey = new Map(all.map((t) => [t.key, t]));
    for (let k = target.parentKey; k; k = byKey.get(k)?.parentKey) if (k === dragged.key) return { refuse: `${target.key} is below ${dragged.key}.` };
    const dl = levelOf(dragged), tl = levelOf(target);
    if (dl >= 1) return { refuse: `${dragged.key} is an epic. An epic cannot move under another work item.` };
    if (tl === -1) return { refuse: `${target.key} is a sub-task. A sub-task cannot have children in Jira.` };
    if (dragged.parentKey === target.key) return { refuse: `${dragged.key} is already under ${target.key}.` };
    if (dl === -1 && tl === 0) return { kind: "parent", parentKey: target.key, label: `Move under ${target.key}` };
    if (dl === -1) return { refuse: `${dragged.key} is a sub-task: its parent must be a task or story.` };
    if (tl >= 1) return { kind: "parent", parentKey: target.key, label: `Move under epic ${target.key}` };
    if (all.some((t) => t.parentKey === dragged.key)) return { refuse: `${dragged.key} has sub-tasks, so Jira cannot make it a sub-task.` };
    return { kind: "subtask", parentKey: target.key, label: `Make ${dragged.key} a sub-task of ${target.key}` };
  }
  function requestHierarchyChange(key, action, undoOf) {
    if (!action || action.refuse) {
      if (action) showFlag({ text: action.refuse, error: true });
      return;
    }
    const question = action.kind === "parent" ? `Move ${key} under ${action.parentKey || "no parent"}? This changes the parent in Jira, so every plan shows it.` : action.kind === "subtask" ? `Make ${key} a sub-task of ${action.parentKey}? Jira changes its work type. If the types use different workflows, Jira may change its status.` : `Make ${key} a task? Jira changes its work type. If the types use different workflows, Jira may change its status.`;
    const run = async () => {
      const before = findAnyTask(key);
      const oldParent = before ? before.parentKey || null : null;
      const wasSub = before ? levelOf(before) === -1 : false;
      let res;
      if (action.kind === "parent") {
        res = await callResolver2("changeParent", { taskId: key, newParentKey: action.parentKey || null });
      } else {
        const started = await callResolver2("convertIssueType", action.kind === "subtask" ? { taskId: key, toSubtaskOf: action.parentKey } : { taskId: key, toTypeName: "Task" });
        if (!started || started.ok !== true || !started.jobId) return;
        res = null;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1500));
          const c = await callResolver2("checkConversion", { jobId: started.jobId, taskId: key, oldParentKey: started.oldParentKey, newParentKey: started.newParentKey });
          if (!c || c.done || c.ok === false) {
            res = c;
            break;
          }
          showFlag({ text: `Jira is converting ${key}: ${c.progress || 0}%.` });
        }
        if (!res) {
          showFlag({ text: `Jira has not finished converting ${key}. Reload in a minute to see it.`, error: true });
          return;
        }
      }
      if (res && Array.isArray(res.tasks)) applyPlanInPlace(res);
      else await loadProjectPlan();
      if (res && res.ok !== false && !undoOf) {
        const back = action.kind === "parent" ? { kind: "parent", parentKey: oldParent } : action.kind === "subtask" ? { kind: "task" } : wasSub && oldParent ? { kind: "subtask", parentKey: oldParent } : null;
        showFlag({ text: `${action.label || "Changed"}: done in Jira.`, ...back ? { action: { label: "Undo", run: () => requestHierarchyChange(key, back, true) } } : {} });
      }
    };
    if (undoOf) {
      run();
      return;
    }
    showFlag({ text: question, action: { label: action.kind === "parent" ? "Move" : "Convert", run } });
  }
  function renderParentControl(task) {
    const sel = document.getElementById("parentSelect");
    const btn = document.getElementById("btnApplyParent");
    if (!sel || !btn) return;
    const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
    const lvl = levelOf(task);
    const opts = [];
    if (lvl === -1) {
      opts.push({ value: "task:", text: "No parent: make it a task" });
      for (const t of all) if (levelOf(t) === 0 && t.key !== task.parentKey) opts.push({ value: `parent:${t.key}`, text: `Under ${t.key}: ${t.summary}` });
    } else if (lvl === 0) {
      if (task.parentKey) opts.push({ value: "parent:", text: "No epic" });
      for (const t of all) {
        if (t.key === task.key || t.key === task.parentKey) continue;
        const a = hierarchyActionFor(task, t);
        if (a && !a.refuse) opts.push({ value: `${a.kind}:${t.key}`, text: a.kind === "parent" ? `Under epic ${t.key}: ${t.summary}` : `Sub-task of ${t.key}: ${t.summary}` });
      }
    }
    sel.replaceChildren(...[{ value: "", text: task.parentKey ? `Now: under ${task.parentKey}` : "Now: no parent" }, ...opts].map((o) => {
      const el3 = document.createElement("option");
      el3.value = o.value;
      el3.textContent = o.text;
      return el3;
    }));
    sel.disabled = btn.disabled = lvl >= 1 || opts.length === 0;
    btn.onclick = () => {
      const [kind, parentKey] = String(sel.value).split(":");
      if (!kind) return;
      const label2 = kind === "task" ? `Make ${task.key} a task` : kind === "subtask" ? `Make ${task.key} a sub-task of ${parentKey}` : `Move under ${parentKey || "no parent"}`;
      requestHierarchyChange(task.key, { kind, parentKey: parentKey || null, label: label2 });
    };
  }
  function isBlockParent(task) {
    return !!task && task.datesFromChildren === true && !task.isEpic && (task.hierarchyLevel ?? 0) === 0;
  }
  function blockPlan(key, days) {
    const members = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []).filter((t) => t.parentKey === key);
    return planBlockMove(members, days, todayIso());
  }
  function blockConflict(plan) {
    const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
    let worst = null;
    for (const c of plan.changes) {
      if (c.state !== "not-started") continue;
      const r = checkDependencyConflict({ key: c.key, startDate: c.toStart }, all, todayIso());
      if (!r.hasConflict) continue;
      const need = daysBetween(c.toStart, r.earliestDate);
      if (!worst || need > worst.need) worst = { ...r, need, key: c.key };
    }
    return worst;
  }
  function effectiveBlockDays(key, days) {
    if (!days || !isEnforceDepsEnabled()) return days;
    const conflict = blockConflict(blockPlan(key, days));
    return conflict ? days + conflict.need : days;
  }
  function dropPreview(key, start, end, blockDays) {
    const plan = { tasks: currentPlan.tasks || [], backlogTasks: currentPlan.backlogTasks || [] };
    const all = plan.tasks.concat(plan.backlogTasks);
    const p = blockDays !== void 0 ? previewBlockMove(plan, key, blockDays, todayIso()) : previewSingleMove(plan, key, start, end, todayIso());
    const text = describePendingWrites(all, p.moves, key, { parentDue: p.parentDue, epics: p.epics }).text;
    const moves = new Map(p.moves);
    moves.set(key, { start, end });
    return { moves, text };
  }
  async function moveBlock(key, days) {
    if (!days) return;
    let plan = blockPlan(key, days);
    const conflict = blockConflict(plan);
    const enforce = isEnforceDepsEnabled();
    if (conflict && enforce) {
      days += conflict.need;
      if (!days) {
        announce(`Enforce dependencies: ${key} cannot move earlier; ${conflict.key} cannot start before ${conflict.earliestDate} (dependency on ${conflict.predKey}).`);
        drawTimeline(true);
        return;
      }
      plan = blockPlan(key, days);
    }
    if (plan.changes.length === 0) {
      showFlag({ text: `Nothing in ${key} can move: ${plan.fixed.map((f) => `${f.key} ${f.reason}`).join("; ")}.` });
      drawTimeline(true);
      return;
    }
    const expectedVersions = {};
    for (const c of plan.changes) expectedVersions[c.key] = findAnyTask(c.key) && findAnyTask(c.key).version || 0;
    let res = await callResolver2("moveTaskGroup", { taskId: key, days, expectedVersions });
    const rest = res && Array.isArray(res.blockRemaining) ? res.blockRemaining : [];
    for (let i = 0; i < rest.length; i += 25) {
      const items = rest.slice(i, i + 25);
      const last = i + 25 >= rest.length;
      showFlag({ text: `Moving the sub-tasks of ${key}: ${Math.min(i + 25, rest.length) + 25} of ${rest.length + 25}.` });
      const next = await callResolver("continueBlockMove", { planId: activePlanId, taskId: key, items, last });
      if (next && Array.isArray(next.tasks)) res = next;
      if (!next || next.ok === false) break;
    }
    if (res && Array.isArray(res.tasks)) applyPlanInPlace(res);
    else await loadProjectPlan();
    if (res && res.ok && plan.fixed.length) {
      announce(`Moved ${key} by ${days} days. Kept: ${plan.fixed.map((f) => `${f.key} (${f.reason})`).join(", ")}.`);
    }
    if (res && res.ok && conflict) {
      const via = conflict.viaParent ? ` (a link of ${conflict.viaParent})` : "";
      if (enforce) announce(`Enforce dependencies: moved ${key} so ${conflict.key} starts on ${conflict.earliestDate}, after ${conflict.predKey}${via}.`);
      else showFlag({ text: `${conflict.key} now starts before ${conflict.earliestDate}, the earliest day its dependency on ${conflict.predKey}${via} allows.` });
    }
  }
  async function replayUndo(ops) {
    replayingUndo = true;
    let ok = true;
    const planId = activePlanId;
    try {
      for (const op of ops) {
        let res;
        if (op.kind === "unschedule") {
          res = await callResolver("unscheduleTask", { planId, taskId: op.key });
        } else if (op.kind === "schedule") {
          res = await callResolver("scheduleBacklogTask", { planId, taskId: op.key, startWeek: op.updates.startWeek, spanWeeks: op.updates.spanWeeks || 1 });
          if (!classifyResult(res).failed && op.updates.startDate) {
            res = await callResolver("updateWbsTask", { planId, taskId: op.key, updates: { startDate: op.updates.startDate, endDate: op.updates.endDate } });
          }
        } else {
          const t = findAnyTask(op.key);
          res = await callResolver("updateWbsTask", { planId, taskId: op.key, updates: op.updates, expectedVersion: t && t.version || 0, restore: true });
        }
        const verdict = classifyResult(res);
        if (verdict.failed) {
          showFlag({ text: verdict.message || "The undo was not saved.", error: true });
          ok = false;
          break;
        }
        if (res && Array.isArray(res.tasks)) currentPlan = res;
        else if (res && res.plan && Array.isArray(res.plan.tasks)) currentPlan = res.plan;
      }
    } finally {
      replayingUndo = false;
    }
    await loadProjectPlan();
    return ok;
  }
  async function undoLast() {
    const entry = undoStack.undo();
    if (!entry) return;
    if (await replayUndo(entry.restore)) showFlag({ text: `Undone: ${entry.label}.`, action: { label: "Redo", run: redoLast } });
  }
  async function redoLast() {
    const entry = undoStack.redo();
    if (!entry) return;
    if (await replayUndo(entry.reapply)) showFlag({ text: `Redone: ${entry.label}.`, action: { label: "Undo", run: undoLast } });
  }
  function formatEffort(hours) {
    return hours > 0 ? `${hours}h` : "Unestimated";
  }
  function syncPinnedBarHit() {
    document.querySelectorAll(".bar-hit.is-pinned").forEach((el3) => {
      if (el3.dataset.taskId !== pinnedDependencyTaskId) el3.classList.remove("is-pinned");
    });
    if (pinnedDependencyTaskId) {
      const el3 = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(pinnedDependencyTaskId)}"]`);
      if (el3) el3.classList.add("is-pinned");
    }
  }
  function showWhy(taskKey, anchorRect) {
    openWhyPopup(currentPlan?.tasks || [], taskKey, anchorRect, {
      apply: async (key, updates) => {
        const t = (currentPlan?.tasks || []).find((x) => x.key === key);
        await callResolver2("updateWbsTask", { taskId: key, updates, expectedVersion: t && t.version || 0 });
        await loadProjectPlan();
      },
      focusTask: (key) => {
        const row = scrollRowIntoView(key);
        if (row) {
          row.setAttribute("tabindex", "-1");
          row.scrollIntoView({ block: "center" });
          row.focus();
        }
        pinnedDependencyTaskId = key;
        syncPinnedBarHit();
        drawTimeline(true);
      }
    });
  }
  var currentPlan = null;
  var activeTaskId = null;
  var hoveredTaskId = null;
  var pinnedDependencyTaskId = null;
  var isDraggingBar = false;
  var modalUseRollupProgressFlag = false;
  var popoverOpenedAt = 0;
  var columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
  var compactTaskWidth = COMPACT_TASK_DEFAULT_WIDTH;
  var hiddenColumns = /* @__PURE__ */ new Set();
  var ALL_COLUMNS = [
    { key: "epic", label: "Epic", icon: "\u{1F7EA}", defaultWidth: DEFAULT_COLUMN_WIDTHS.epic, description: "Parent Epic roadmap category" },
    { key: "story", label: "Story", icon: "\u{1F537}", defaultWidth: DEFAULT_COLUMN_WIDTHS.story, description: "Issue type (Story, Task, Subtask)" },
    { key: "task", label: "Task", icon: "\u{1F4DD}", defaultWidth: DEFAULT_COLUMN_WIDTHS.task, locked: true, description: "Issue key and summary (Required)" },
    { key: "resource", label: "Resource", icon: "\u{1F465}", defaultWidth: DEFAULT_COLUMN_WIDTHS.resource, description: "Assigned team member" },
    { key: "effort", label: "Hrs", icon: "\u23F1\uFE0F", defaultWidth: DEFAULT_COLUMN_WIDTHS.effort, description: "Estimated effort in hours" },
    { key: "progress", label: "Progress", icon: "\u{1F4C8}", defaultWidth: DEFAULT_COLUMN_WIDTHS.progress, description: "Actual completion %" },
    { key: "target", label: "Target", icon: "\u{1F3AF}", defaultWidth: DEFAULT_COLUMN_WIDTHS.target, description: "Planned target completion %" },
    { key: "status", label: "Status", icon: "\u{1F3F7}\uFE0F", defaultWidth: DEFAULT_COLUMN_WIDTHS.status, description: "Workflow status" }
  ];
  function getVisibleColKeys() {
    return ALL_COLUMNS.map((c) => c.key).filter((k) => !hiddenColumns.has(k));
  }
  function isCompactMode() {
    const visible = getVisibleColKeys();
    return visible.length === 1 && visible[0] === "task";
  }
  var COL_KEYS = ALL_COLUMNS.map((c) => c.key);
  var ZOOM_KEY = "cascadeplan_zoom";
  var EXTEND_WEEKS = 4;
  function readPref(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writePref(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
    }
  }
  var zoomId = readPref(ZOOM_KEY, "week");
  var compactDecided = false;
  var timeRange = null;
  function dayPx() {
    return zoomById(zoomId).dayPx;
  }
  function trackWidth() {
    return timeRange ? rangeDays(timeRange) * dayPx() : 0;
  }
  function getFrozenLayout() {
    return computeFrozenLayout(getVisibleColKeys(), columnWidths, isCompactMode(), compactTaskWidth);
  }
  function colWidth(k) {
    const fl = getFrozenLayout();
    return fl.widths[k] !== void 0 ? fl.widths[k] : isCompactMode() && k === "task" ? compactTaskWidth : columnWidths[k];
  }
  var collapsedTasks = /* @__PURE__ */ new Set();
  function expandAncestors(task) {
    let changed = false;
    const seen = /* @__PURE__ */ new Set();
    let cur = task;
    while (cur && !seen.has(cur.key)) {
      seen.add(cur.key);
      for (const k of [cur.parentKey, cur.epicKey]) {
        if (k && k !== cur.key && collapsedTasks.delete(k)) changed = true;
      }
      const upKey = cur.parentKey && cur.parentKey !== cur.key ? cur.parentKey : cur.epicKey;
      cur = upKey && upKey !== cur.key ? findTask(upKey) : null;
    }
    return changed;
  }
  var currentHierarchyView = "all";
  async function initApp() {
    initErrorBanner();
    initWhyPopup();
    initChangesPanel();
    initBaselinePanel({
      call: (fn, payload = {}) => callResolver(fn, { planId: activePlanId, ...payload }),
      flag: showFlag,
      isApprover: () => planApprover,
      reloadPlan: () => loadProjectPlan()
    });
    await enableTheme();
    onThemeChange(() => {
      if (timeline) timeline.invalidateColours();
      drawTimeline(true);
    });
    const wrapper = document.getElementById("ganttWrapper");
    if (wrapper) {
      timeline = new CanvasTimeline(wrapper);
      timeline.onDraw = (links) => renderDependencyBadges(links);
      initArrowLineClicks(wrapper);
      wrapper.addEventListener("scroll", scheduleVirtualRows, { passive: true });
    }
    const tbody = document.getElementById("ganttBody");
    if (tbody) {
      tbody.addEventListener("mouseover", (e) => {
        if (!timeline) return;
        const tr = e.target.closest("tr.task-row");
        const nextKey = tr ? tr.dataset.taskId || null : null;
        if (timeline.hoveredRowKey !== nextKey) {
          timeline.hoveredRowKey = nextKey;
          timeline.requestDraw();
        }
      });
      tbody.addEventListener("mouseleave", () => {
        if (timeline && timeline.hoveredRowKey !== null) {
          timeline.hoveredRowKey = null;
          timeline.requestDraw();
        }
      });
    }
    document.addEventListener("cp:drivers", (e) => {
      if (timeline) timeline.driverKeys = e.detail || [];
      drawTimeline(true);
    });
    setupEventListeners();
    initKeyboard();
    planScope = await getProjectScope();
    activePlanId = getSavedPlanId(browserStore(), planScope);
    loadProjectPlan();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
  function setupEventListeners() {
    document.getElementById("viewSwitcher").addEventListener("change", (e) => {
      switchView(e.target.value);
    });
    const toggleTableBtn = document.getElementById("toggleTableViewBtn");
    if (toggleTableBtn) {
      toggleTableBtn.addEventListener("click", () => {
        switchView(toggleTableView(currentView));
      });
    }
    initInAppSearch();
    const hierSwitcher = document.getElementById("hierarchySwitcher");
    if (hierSwitcher) {
      hierSwitcher.addEventListener("change", (e) => {
        currentHierarchyView = e.target.value;
        if (currentView === "table") {
          renderTableView();
        } else {
          renderTimelineRows();
        }
      });
    }
    document.getElementById("toggleBacklogBtn").addEventListener("click", toggleBacklogTray);
    document.getElementById("closeTrayBtn").addEventListener("click", () => {
      document.getElementById("backlogTray").classList.add("collapsed");
    });
    document.getElementById("refreshBtn").addEventListener("click", loadProjectPlan);
    document.getElementById("newTaskBtn").addEventListener("click", openCreateTaskModal);
    document.getElementById("newEpicBtn").addEventListener("click", openCreateEpicModal);
    document.getElementById("btnCloseTaskDetail").addEventListener("click", () => closeModal("taskDetailModal"));
    document.getElementById("btnCancelTaskDetail").addEventListener("click", () => closeModal("taskDetailModal"));
    document.getElementById("btnSaveTaskModal").addEventListener("click", saveTaskModalChanges);
    const unschedBtn = document.getElementById("btnUnscheduleTaskModal");
    if (unschedBtn) unschedBtn.addEventListener("click", handleUnscheduleFromModal);
    document.getElementById("btnAddSubtaskBtn").addEventListener("click", handleAddSubtask);
    const addResBtn = document.getElementById("btnAddResourceSubtaskBtn");
    if (addResBtn) addResBtn.addEventListener("click", handleAddResourceSubtask);
    document.getElementById("editEstimateUnitSelect").addEventListener("change", handleEstimateUnitChange);
    const estValInput = document.getElementById("editEstimateValueInput");
    if (estValInput) estValInput.addEventListener("input", updateReconciledHoursBadge);
    const tshirtSel = document.getElementById("editTshirtSelect");
    if (tshirtSel) tshirtSel.addEventListener("change", updateReconciledHoursBadge);
    document.getElementById("btnCloseCreateTask").addEventListener("click", () => closeModal("createTaskModal"));
    document.getElementById("btnCancelCreateTask").addEventListener("click", () => closeModal("createTaskModal"));
    document.getElementById("btnSubmitCreateTask").addEventListener("click", executeCreateTask);
    document.getElementById("btnCloseCreateEpic").addEventListener("click", () => closeModal("createEpicModal"));
    document.getElementById("btnCancelCreateEpic").addEventListener("click", () => closeModal("createEpicModal"));
    document.getElementById("btnSubmitCreateEpic").addEventListener("click", executeCreateEpic);
    const backlogTray = document.getElementById("backlogTray");
    backlogTray.addEventListener("dragover", (e) => {
      e.preventDefault();
      backlogTray.classList.add("drag-over");
    });
    backlogTray.addEventListener("dragleave", () => {
      backlogTray.classList.remove("drag-over");
    });
    backlogTray.addEventListener("drop", async (e) => {
      e.preventDefault();
      backlogTray.classList.remove("drag-over");
      const dataStr = e.dataTransfer.getData("text/plain");
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          if (data.fromTimeline && data.taskId) {
            await callResolver2("unscheduleTask", { taskId: data.taskId });
            await loadProjectPlan();
          }
        } catch {
        }
      }
    });
    const btnManageCols = document.getElementById("btnManageColumns");
    const colPopover = document.getElementById("columnManagerPopover");
    if (btnManageCols && colPopover) {
      btnManageCols.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = colPopover.style.display === "flex";
        colPopover.style.display = isVisible ? "none" : "flex";
      });
    }
    const btnCloseCol = document.getElementById("btnCloseColPopover");
    if (btnCloseCol && colPopover) {
      btnCloseCol.addEventListener("click", (e) => {
        e.stopPropagation();
        colPopover.style.display = "none";
      });
    }
    const btnShowAll = document.getElementById("btnShowAllColumns");
    if (btnShowAll) {
      btnShowAll.addEventListener("click", () => {
        showAllColumns();
      });
    }
    const btnResetCols = document.getElementById("btnResetColumns");
    if (btnResetCols) {
      btnResetCols.addEventListener("click", () => {
        resetColumnDefaults();
      });
    }
    const btnUnhideBanner = document.getElementById("btnUnhideAllBanner");
    if (btnUnhideBanner) {
      btnUnhideBanner.addEventListener("click", () => {
        showAllColumns();
      });
    }
    const btnOpenManagerBanner = document.getElementById("btnOpenManagerFromBanner");
    if (btnOpenManagerBanner && colPopover) {
      btnOpenManagerBanner.addEventListener("click", (e) => {
        e.stopPropagation();
        colPopover.style.display = "flex";
      });
    }
    const retryBtn = document.getElementById("btnRetryLoad");
    if (retryBtn) retryBtn.addEventListener("click", loadProjectPlan);
    document.querySelectorAll(".modal-backdrop").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModalAsking(modal);
      });
      modal.addEventListener("input", (e) => {
        if (e.isTrusted) modal.dataset.dirty = "1";
      });
      modal.addEventListener("change", (e) => {
        if (e.isTrusted) modal.dataset.dirty = "1";
      });
    });
    window.addEventListener("keydown", (e) => {
      const inField = Boolean(
        e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.isContentEditable) || document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT" || document.activeElement.isContentEditable)
      );
      if ((e.ctrlKey || e.metaKey) && !e.altKey && ["=", "+", "-", "_"].includes(e.key) && !inField && !openModal()) {
        e.preventDefault();
        setZoom(zoomStep(zoomId, e.key === "-" || e.key === "_" ? -1 : 1));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "z" || e.key === "Z") && !inField && !openModal()) {
        e.preventDefault();
        if (e.shiftKey) redoLast();
        else undoLast();
        return;
      }
      if (isSearchShortcut(e) && !openModal()) {
        e.preventDefault();
        focusInAppSearch();
        return;
      }
      if (e.key.length === 1 && e.key !== "?" && onShortcut(e, inField)) {
        e.preventDefault();
        return;
      }
      if (e.key === "?" && !inField) {
        const key = (gridRoot && gridRoot.contains(document.activeElement) ? rowTasks[gridFocus.row]?.task.key : null) || pinnedDependencyTaskId || hoveredTaskId;
        const bar = key && document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
        if (key) {
          e.preventDefault();
          showWhy(key, bar ? bar.getBoundingClientRect() : null);
        }
        return;
      }
      if (e.key === "Escape" && isWhyPopupOpen()) {
        closeWhyPopup();
        return;
      }
      if (e.key === "Escape" && !openModal() && !document.getElementById("barToolbar")?.hidden) {
        closeBarToolbar();
        return;
      }
      if (e.key === "Escape" && !document.getElementById("helpPopup")?.hidden) {
        closeHelp();
        return;
      }
      if (e.key === "Escape" && isChangesPanelOpen()) {
        closeChangesPanel();
        return;
      }
      if (e.key === "Escape" && isBaselinePanelOpen()) {
        closeBaselinePanel();
        return;
      }
      if (e.key === "Escape") {
        const modal = openModal();
        if (modal) {
          closeModalAsking(modal);
          return;
        }
        closeAllPopovers();
        if (colPopover) colPopover.style.display = "none";
        if (pinnedDependencyTaskId) {
          pinnedDependencyTaskId = null;
          drawTimeline(true);
        }
        if (selectedKeys.size && !pendingProgress.size) clearSelection();
        const inlineRow = document.querySelector(".inline-creation-row");
        if (inlineRow) {
          inlineRow.remove();
          updateVirtualRows();
        }
      }
    });
    document.addEventListener("click", (e) => {
      const resPopover = document.getElementById("resourcePickerPopover");
      const statPopover = document.getElementById("statusPickerPopover");
      const epicPopover = document.getElementById("epicPickerPopover");
      if (resPopover && resPopover.style.display === "flex" && !resPopover.contains(e.target) && !e.target.closest(".resource-chip-btn")) {
        resPopover.style.display = "none";
      }
      if (statPopover && statPopover.style.display === "flex" && !statPopover.contains(e.target) && !e.target.closest(".editable-badge-chip")) {
        statPopover.style.display = "none";
      }
      if (epicPopover && epicPopover.style.display === "flex" && !epicPopover.contains(e.target) && !e.target.closest(".epic-link-chip")) {
        epicPopover.style.display = "none";
      }
      const progPopover2 = document.getElementById("progressPickerPopover");
      if (progPopover2 && progPopover2.style.display === "flex" && !progPopover2.contains(e.target) && !e.target.closest(".td-progress-cell") && !e.target.closest(".quick-progress-btn") && !e.target.closest("#barToolbar")) {
        progPopover2.style.display = "none";
      }
      const targetPopover2 = document.getElementById("targetPickerPopover");
      if (targetPopover2 && targetPopover2.style.display === "flex" && !targetPopover2.contains(e.target) && !e.target.closest(".td-target-cell")) {
        targetPopover2.style.display = "none";
      }
      const colPopover2 = document.getElementById("columnManagerPopover");
      if (colPopover2 && colPopover2.style.display === "flex" && !colPopover2.contains(e.target) && !e.target.closest("#btnManageColumns") && !e.target.closest("#btnOpenManagerFromBanner")) {
        colPopover2.style.display = "none";
      }
      if (pinnedDependencyTaskId && !e.target.closest(".bar-hit") && !e.target.closest("#barToolbar")) {
        pinnedDependencyTaskId = null;
        syncPinnedBarHit();
        drawTimeline(true);
      }
    });
    const btnEarlier = document.getElementById("btnScrollEarlier");
    if (btnEarlier) {
      btnEarlier.addEventListener("click", () => {
        const wrapper = document.getElementById("ganttWrapper");
        if (wrapper) setTimelineScrollLeft(wrapper.scrollLeft - (wrapper.clientWidth - layout.trackLeft) / 2);
      });
    }
    const btnLater = document.getElementById("btnScrollLater");
    if (btnLater) {
      btnLater.addEventListener("click", () => {
        const wrapper = document.getElementById("ganttWrapper");
        if (wrapper) setTimelineScrollLeft(wrapper.scrollLeft + (wrapper.clientWidth - layout.trackLeft) / 2);
      });
    }
    const btnToday = document.getElementById("btnScrollToday");
    if (btnToday) {
      btnToday.addEventListener("click", () => {
        scrollToToday();
      });
    }
    const progSlider = document.getElementById("progressPickerSlider");
    const progNumInput = document.getElementById("progressPickerNumberInput");
    const progValLabel = document.getElementById("progressPickerValLabel");
    const progPopover = document.getElementById("progressPickerPopover");
    if (progSlider && progNumInput && progValLabel) {
      progSlider.addEventListener("input", (e) => {
        progNumInput.value = e.target.value;
        progValLabel.textContent = `${e.target.value}%`;
      });
      progNumInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100, val));
        progSlider.value = val;
        progValLabel.textContent = `${val}%`;
      });
    }
    document.querySelectorAll(".progress-preset-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pct = parseInt(btn.dataset.pct, 10);
        if (progPopover) progPopover.style.display = "none";
        const key = activeProgressTaskKey;
        if (!key) return;
        const updates = { progress: pct, manualProgress: true };
        if (!await withStatusChoice([{ key, progress: pct, updates }])) return;
        await callResolver2("updateWbsTask", { taskId: key, updates });
        await loadProjectPlan();
      });
    });
    const btnApplyRollup = document.getElementById("btnApplyRollupProgress");
    if (btnApplyRollup) {
      btnApplyRollup.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (progPopover) progPopover.style.display = "none";
        if (!activeProgressTaskKey) return;
        const task = (currentPlan?.tasks || []).find((t) => t.key === activeProgressTaskKey);
        const rollupPct = task?.rollupStats ? task.rollupStats.progressPct : 0;
        await callResolver2("updateWbsTask", {
          taskId: activeProgressTaskKey,
          updates: { progress: rollupPct, manualProgress: false }
        });
        await loadProjectPlan();
      });
    }
    const btnSaveProg = document.getElementById("btnSaveProgressPicker");
    if (btnSaveProg) {
      btnSaveProg.addEventListener("click", async (e) => {
        e.stopPropagation();
        const val = parseInt(progNumInput?.value || progSlider?.value || "0", 10);
        if (progPopover) progPopover.style.display = "none";
        const key = activeProgressTaskKey;
        if (!key) return;
        const pct = Math.max(0, Math.min(100, val));
        const updates = { progress: pct, manualProgress: true };
        if (!await withStatusChoice([{ key, progress: pct, updates }])) return;
        await callResolver2("updateWbsTask", { taskId: key, updates });
        await loadProjectPlan();
      });
    }
    const btnCancelProg = document.getElementById("btnCancelProgressPicker");
    if (btnCancelProg) {
      btnCancelProg.addEventListener("click", (e) => {
        e.stopPropagation();
        if (progPopover) progPopover.style.display = "none";
      });
    }
    const targetSlider = document.getElementById("targetPickerSlider");
    const targetNumInput = document.getElementById("targetPickerNumberInput");
    const targetValLabel = document.getElementById("targetPickerValLabel");
    const targetPopover = document.getElementById("targetPickerPopover");
    if (targetSlider && targetNumInput && targetValLabel) {
      targetSlider.addEventListener("input", (e) => {
        targetNumInput.value = e.target.value;
        targetValLabel.textContent = `${e.target.value}%`;
      });
      targetNumInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100, val));
        targetSlider.value = val;
        targetValLabel.textContent = `${val}%`;
      });
    }
    document.querySelectorAll(".target-preset-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pct = parseInt(btn.dataset.pct, 10);
        if (targetPopover) targetPopover.style.display = "none";
        if (!activeTargetTaskKey) return;
        await callResolver2("updateWbsTask", {
          taskId: activeTargetTaskKey,
          updates: { targetProgress: pct }
        });
        await loadProjectPlan();
      });
    });
    const btnSaveTarget = document.getElementById("btnSaveTargetPicker");
    if (btnSaveTarget) {
      btnSaveTarget.addEventListener("click", async (e) => {
        e.stopPropagation();
        const val = parseInt(targetNumInput?.value || targetSlider?.value || "0", 10);
        if (targetPopover) targetPopover.style.display = "none";
        if (!activeTargetTaskKey) return;
        await callResolver2("updateWbsTask", {
          taskId: activeTargetTaskKey,
          updates: { targetProgress: Math.max(0, Math.min(100, val)) }
        });
        await loadProjectPlan();
      });
    }
    const btnCancelTarget = document.getElementById("btnCancelTargetPicker");
    if (btnCancelTarget) {
      btnCancelTarget.addEventListener("click", (e) => {
        e.stopPropagation();
        if (targetPopover) targetPopover.style.display = "none";
      });
    }
    const btnAutoTarget = document.getElementById("btnAutoTargetPicker");
    if (btnAutoTarget) {
      btnAutoTarget.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (targetPopover) targetPopover.style.display = "none";
        if (!activeTargetTaskKey) return;
        await callResolver2("updateWbsTask", {
          taskId: activeTargetTaskKey,
          updates: { manualTargetProgress: false }
        });
        await loadProjectPlan();
      });
    }
    const editProgInput = document.getElementById("editProgressInput");
    const editProgSlider = document.getElementById("editProgressSlider");
    const editProgValLabel = document.getElementById("modalProgressValLabel");
    if (editProgInput && editProgSlider && editProgValLabel) {
      editProgSlider.addEventListener("input", (e) => {
        editProgInput.value = e.target.value;
        editProgValLabel.textContent = `${e.target.value}%`;
      });
      editProgInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100, val));
        editProgSlider.value = val;
        editProgValLabel.textContent = `${val}%`;
      });
    }
    document.querySelectorAll(".modal-prog-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pct = btn.dataset.pct;
        if (editProgInput) editProgInput.value = pct;
        if (editProgSlider) editProgSlider.value = pct;
        if (editProgValLabel) editProgValLabel.textContent = `${pct}%`;
      });
    });
    const editTargetInput = document.getElementById("editTargetProgressInput");
    const editTargetSlider = document.getElementById("editTargetProgressSlider");
    const editTargetValLabel = document.getElementById("modalTargetValLabel");
    if (editTargetInput && editTargetSlider && editTargetValLabel) {
      editTargetSlider.addEventListener("input", (e) => {
        editTargetInput.value = e.target.value;
        editTargetValLabel.textContent = `${e.target.value}%`;
      });
      editTargetInput.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100, val));
        editTargetSlider.value = val;
        editTargetValLabel.textContent = `${val}%`;
      });
    }
    document.querySelectorAll(".modal-target-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pct = btn.dataset.pct;
        if (editTargetInput) editTargetInput.value = pct;
        if (editTargetSlider) editTargetSlider.value = pct;
        if (editTargetValLabel) editTargetValLabel.textContent = `${pct}%`;
      });
    });
    document.getElementById("editStatusSelect")?.addEventListener("change", (e) => setDialogProgressLock(activeTaskId, e.target.value));
    document.getElementById("btnStatusOfferMove")?.addEventListener("click", () => {
      if (statusOfferResolve) statusOfferResolve("move");
    });
    document.getElementById("btnStatusOfferKeep")?.addEventListener("click", () => {
      if (statusOfferResolve) statusOfferResolve("keep");
    });
    const btnModalRollup = document.getElementById("btnModalUseRollup");
    if (btnModalRollup) {
      btnModalRollup.addEventListener("click", () => {
        const curTask = (currentPlan?.tasks || []).find((t) => t.key === activeTaskId);
        const rollupPct = curTask?.rollupStats ? curTask.rollupStats.progressPct : 0;
        if (editProgInput) editProgInput.value = rollupPct;
        if (editProgSlider) editProgSlider.value = rollupPct;
        if (editProgValLabel) editProgValLabel.textContent = `${rollupPct}%`;
        modalUseRollupProgressFlag = true;
      });
    }
    initGanttScrollSync();
    initGanttPan();
    window.addEventListener("resize", () => {
      syncGanttScrollWidth();
      scheduleVirtualRows();
    });
  }
  var hasInitialScrolledToToday = false;
  function syncGanttScrollWidth() {
  }
  function initGanttScrollSync() {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper) return;
    wrapper.addEventListener("scroll", () => {
      closeAllPopovers();
    });
    wrapper.addEventListener("wheel", (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        wrapper.scrollLeft += e.deltaY || e.deltaX;
      }
    }, { passive: false });
  }
  function scrollToToday() {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper || !timeRange) return;
    const vw = wrapper.clientWidth - layout.trackLeft;
    setTimelineScrollLeft(Math.max(0, anchorScroll(todayIso(), vw / 2, timeRange.start, dayPx())));
  }
  function initGanttPan() {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper) return;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let hasMoved = false;
    wrapper.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      if (e.button === 0 && e.clientX - wrapper.getBoundingClientRect().left < (layout.trackLeft || 0)) {
        return;
      }
      if (e.target.closest(".bar-hit, .bar-handle, .bar-link-port, .dep-link-badge, .btn, button, input, select, a, .resizer, .row-drag-handle, .inline-edit-input, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .th-col-menu-btn, .row-action-btn, .tree-toggle-btn")) {
        return;
      }
      isPanning = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = wrapper.scrollLeft;
      startScrollTop = wrapper.scrollTop;
      function onMouseMove(moveEvent) {
        if (!isPanning) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          hasMoved = true;
          wrapper.classList.add("is-panning");
        }
        if (hasMoved) {
          wrapper.scrollLeft = startScrollLeft - dx;
          wrapper.scrollTop = startScrollTop - dy;
        }
      }
      function onMouseUp() {
        if (isPanning) {
          isPanning = false;
          wrapper.classList.remove("is-panning");
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  var currentView = "timeline";
  function switchView(viewName) {
    currentView = viewName;
    const isTimeline = viewName === "timeline";
    const isTable = viewName === "table";
    const isUtil = viewName === "utilization";
    const timelineSec = document.getElementById("timelineViewSection");
    const utilSec = document.getElementById("utilizationViewSection");
    const tableSec = document.getElementById("tableViewSection");
    const toggleBtn = document.getElementById("toggleTableViewBtn");
    const switcher = document.getElementById("viewSwitcher");
    if (timelineSec) timelineSec.style.display = isTimeline ? "flex" : "none";
    if (utilSec) utilSec.style.display = isUtil ? "block" : "none";
    if (tableSec) tableSec.style.display = isTable ? "flex" : "none";
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-pressed", isTable ? "true" : "false");
    }
    if (switcher && switcher.value !== viewName) {
      switcher.value = viewName;
    }
    if (isTimeline) {
      setTimeout(updateVirtualRows, 100);
    } else if (isUtil) {
      renderUtilizationView();
    } else if (isTable) {
      renderTableView();
    }
  }
  function renderTableView() {
    const tbody = document.getElementById("plainDataTableBody");
    const countEl = document.getElementById("tableRowCount");
    if (!tbody) return;
    const tasks = rowTasks && rowTasks.length > 0 ? rowTasks.map((r) => r.task) : currentPlan?.tasks || [];
    const rows = buildTableViewRows(tasks);
    if (countEl) {
      countEl.textContent = `${rows.length} ${rows.length === 1 ? "issue" : "issues"}`;
    }
    const trs = rows.map((r) => {
      const tr = document.createElement("tr");
      tr.dataset.taskKey = r.key;
      tr.tabIndex = -1;
      const cells = [
        r.key,
        r.summary,
        r.issueType,
        r.epic,
        r.assignee,
        r.startDate,
        r.dueDate,
        r.progress,
        r.status,
        r.dependencies
      ];
      cells.forEach((val, idx) => {
        const td = document.createElement("td");
        if (idx === 0) {
          const link = document.createElement("a");
          link.href = "#";
          link.textContent = val;
          link.style.color = "var(--cp-link)";
          link.style.textDecoration = "none";
          link.style.fontWeight = "600";
          link.addEventListener("click", (e) => openJiraIssueInNewTab(val, e));
          td.appendChild(link);
        } else {
          td.textContent = val;
        }
        tr.appendChild(td);
      });
      return tr;
    });
    tbody.replaceChildren(...trs);
  }
  var searchMatches = [];
  var currentSearchMatchPos = -1;
  function updateSearchHighlights() {
    const matchKeys = new Set(searchMatches.map((m) => m.task.key));
    const activeKey = currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length ? searchMatches[currentSearchMatchPos].task.key : null;
    if (rowCache) {
      for (const [key, tr] of rowCache.entries()) {
        if (matchKeys.has(key)) {
          tr.classList.add("is-search-match");
          if (key === activeKey) {
            tr.classList.add("is-search-active");
          } else {
            tr.classList.remove("is-search-active");
          }
        } else {
          tr.classList.remove("is-search-match", "is-search-active");
        }
      }
    }
    const plannerTbody = document.querySelector("#plannerTable tbody");
    if (plannerTbody) {
      plannerTbody.querySelectorAll(".task-row").forEach((tr) => {
        const key = tr.dataset.taskId;
        if (key && matchKeys.has(key)) {
          tr.classList.add("is-search-match");
          if (key === activeKey) {
            tr.classList.add("is-search-active");
          } else {
            tr.classList.remove("is-search-active");
          }
        } else {
          tr.classList.remove("is-search-match", "is-search-active");
        }
      });
    }
    const tableTbody = document.getElementById("plainDataTableBody");
    if (tableTbody) {
      tableTbody.querySelectorAll("tr").forEach((tr) => {
        const key = tr.dataset.taskKey;
        if (key && matchKeys.has(key)) {
          tr.classList.add("is-search-match");
          if (key === activeKey) {
            tr.classList.add("is-search-active");
          } else {
            tr.classList.remove("is-search-active");
          }
        } else {
          tr.classList.remove("is-search-match", "is-search-active");
        }
      });
    }
    drawTimeline(true);
  }
  function scrollToSearchMatch(pos, takeFocus = false) {
    if (pos < 0 || pos >= searchMatches.length) return;
    const match = searchMatches[pos];
    const key = match.task.key;
    if (!key) return;
    if (expandAncestors(match.task)) {
      const computed = computeRowTasks();
      rowTasks = computed.rows;
      rowTaskList = rowTasks.map((r) => r.task);
      updateVirtualRows();
    }
    if (currentView === "table") {
      const tbody = document.getElementById("plainDataTableBody");
      if (tbody) {
        const tr = tbody.querySelector(`tr[data-task-key="${CSS.escape(key)}"]`);
        if (tr) {
          tr.scrollIntoView({ block: "center", behavior: "smooth" });
          if (takeFocus) tr.focus();
        }
      }
    } else {
      scrollRowIntoView(key);
      const rIdx = rowTasks.findIndex((r) => r.task.key === key);
      if (rIdx >= 0) {
        gridFocus = { row: rIdx, col: 0 };
        if (takeFocus) {
          setGridFocus(rIdx, 0);
        }
      }
    }
  }
  function initInAppSearch() {
    const input = document.getElementById("inAppSearchInput");
    const count = document.getElementById("searchMatchCount");
    if (!input) return;
    input.addEventListener("input", () => {
      const query = input.value;
      const tasks = currentPlan?.tasks && currentPlan.tasks.length > 0 ? currentPlan.tasks : (rowTasks || []).map((r) => r.task);
      searchMatches = findMatchingTasks(tasks, query);
      currentSearchMatchPos = searchMatches.length > 0 ? 0 : -1;
      if (count) {
        count.textContent = formatMatchCount(query, searchMatches.length, currentSearchMatchPos);
      }
      updateSearchHighlights();
      if (searchMatches.length > 0) {
        scrollToSearchMatch(currentSearchMatchPos, false);
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (searchMatches.length > 0) {
          const dir = e.shiftKey ? -1 : 1;
          currentSearchMatchPos = findNextMatch(searchMatches.map((m) => m.index), currentSearchMatchPos, dir);
          if (count) {
            count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
          }
          updateSearchHighlights();
          scrollToSearchMatch(currentSearchMatchPos, false);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (searchMatches.length > 0) {
          currentSearchMatchPos = findNextMatch(searchMatches.map((m) => m.index), currentSearchMatchPos, 1);
          if (count) {
            count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
          }
          updateSearchHighlights();
          scrollToSearchMatch(currentSearchMatchPos, false);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (searchMatches.length > 0) {
          currentSearchMatchPos = findNextMatch(searchMatches.map((m) => m.index), currentSearchMatchPos, -1);
          if (count) {
            count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
          }
          updateSearchHighlights();
          scrollToSearchMatch(currentSearchMatchPos, false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.value = "";
        searchMatches = [];
        currentSearchMatchPos = -1;
        if (count) count.textContent = "";
        updateSearchHighlights();
        input.blur();
        if (currentView === "table") {
          const table = document.getElementById("plainDataTable");
          if (table) table.focus();
        } else {
          focusGridCell();
        }
      }
    });
  }
  function focusInAppSearch() {
    const input = document.getElementById("inAppSearchInput");
    if (input) {
      input.focus();
      input.select();
    }
  }
  function toggleBacklogTray() {
    const tray = document.getElementById("backlogTray");
    tray.classList.toggle("collapsed");
    setTimeout(syncGanttScrollWidth, 250);
    setTimeout(updateVirtualRows, 250);
  }
  function toggleColumnVisibility(colKey) {
    if (colKey === "task") return;
    if (hiddenColumns.has(colKey)) {
      hiddenColumns.delete(colKey);
    } else {
      hiddenColumns.add(colKey);
    }
    onColumnsChanged();
  }
  function showAllColumns() {
    hiddenColumns.clear();
    onColumnsChanged();
  }
  function resetColumnDefaults() {
    hiddenColumns.clear();
    columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
    compactTaskWidth = COMPACT_TASK_DEFAULT_WIDTH;
    onColumnsChanged();
    callResolver2("saveColumnWidths", { columnWidths });
  }
  function onColumnsChanged() {
    try {
      if (currentPlan && currentPlan.projectKey) {
        localStorage.setItem("cascadeplan_hidden_cols_" + currentPlan.projectKey, JSON.stringify(Array.from(hiddenColumns)));
      }
    } catch (e) {
    }
    callResolver2("saveHiddenColumns", { hiddenColumns: Array.from(hiddenColumns) });
    updateColumnManagerUI();
    renderTimelineHeader();
    renderTimelineRows();
    applyTimeAxis();
    setTimeout(syncGanttScrollWidth, 50);
  }
  function updateColumnManagerUI() {
    const visibleKeys = getVisibleColKeys();
    const badge = document.getElementById("colCountBadge");
    if (badge) {
      badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length}`;
      if (hiddenColumns.size > 0) {
        badge.classList.add("has-hidden");
      } else {
        badge.classList.remove("has-hidden");
      }
    }
    const alertBar = document.getElementById("hiddenColsAlertBar");
    const alertText = document.getElementById("hiddenColsText");
    if (alertBar && alertText) {
      if (hiddenColumns.size > 0 && !isCompactMode()) {
        alertBar.style.display = "flex";
        const hiddenNames = ALL_COLUMNS.filter((c) => hiddenColumns.has(c.key)).map((c) => c.label).join(", ");
        alertText.textContent = `${hiddenColumns.size} column${hiddenColumns.size > 1 ? "s" : ""} hidden (${hiddenNames}). Click Unhide All to restore them.`;
      } else {
        alertBar.style.display = "none";
      }
    }
    const listContainer = document.getElementById("columnOptionsList");
    if (listContainer) {
      listContainer.innerHTML = "";
      ALL_COLUMNS.forEach((col) => {
        const row = document.createElement("div");
        row.className = "col-option-row" + (col.locked ? " locked" : "");
        const isChecked = !hiddenColumns.has(col.key);
        row.innerHTML = html`
        <input type="checkbox" id="col_chk_${col.key}" ${isChecked ? "checked" : ""} ${col.locked ? "disabled" : ""} />
        <label for="col_chk_${col.key}" class="col-option-label ${col.locked ? "is-locked" : ""}">
          <span>${col.icon}</span>
          <span>${col.label}</span>
          ${col.locked ? html`<span class="badge badge-neutral jx-badge-tiny">Required</span>` : ""}
        </label>
      `;
        if (!col.locked) {
          row.addEventListener("click", (e) => {
            if (e.target.tagName !== "INPUT") {
              const chk = row.querySelector("input");
              if (chk) chk.checked = !chk.checked;
            }
            toggleColumnVisibility(col.key);
          });
        }
        listContainer.appendChild(row);
      });
    }
  }
  function openColumnHeaderMenu(e, colKey, colLabel) {
    const old = document.getElementById("columnHeaderContextMenu");
    if (old) old.remove();
    document.querySelectorAll(".th-col.is-menu-open").forEach((th) => th.classList.remove("is-menu-open"));
    const activeTh = document.querySelector(`.th-col[data-col-key="${CSS.escape(colKey)}"]`);
    if (activeTh) activeTh.classList.add("is-menu-open");
    const menu = document.createElement("div");
    menu.id = "columnHeaderContextMenu";
    menu.className = "column-manager-popover";
    menu.style.width = "190px";
    menu.style.position = "fixed";
    menu.style.left = Math.min(window.innerWidth - 210, e.clientX) + "px";
    menu.style.top = e.clientY + 12 + "px";
    menu.style.zIndex = "1200";
    menu.innerHTML = html`
    <div class="jx-menu-caption">Column: ${colLabel}</div>
    <button class="btn btn-outline btn-sm jx-menu-btn-mb4" id="btnHideThisCol">
      🚫 Hide "${colLabel}"
    </button>
    <button class="btn btn-subtle btn-sm jx-menu-btn" id="btnManageAllFromHeader">
      ⚙ Manage All Columns...
    </button>
  `;
    document.body.appendChild(menu);
    const hideBtn = menu.querySelector("#btnHideThisCol");
    if (hideBtn) {
      hideBtn.addEventListener("click", () => {
        menu.remove();
        if (activeTh) activeTh.classList.remove("is-menu-open");
        toggleColumnVisibility(colKey);
      });
    }
    const manageBtn = menu.querySelector("#btnManageAllFromHeader");
    if (manageBtn) {
      manageBtn.addEventListener("click", () => {
        menu.remove();
        if (activeTh) activeTh.classList.remove("is-menu-open");
        const pop = document.getElementById("columnManagerPopover");
        if (pop) pop.style.display = "flex";
      });
    }
    function onDocClick(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        if (activeTh) activeTh.classList.remove("is-menu-open");
        document.removeEventListener("click", onDocClick);
      }
    }
    setTimeout(() => document.addEventListener("click", onDocClick), 10);
  }
  async function finishPlanWork(resolverName, planId, label2) {
    let res = null;
    for (let i = 0; i < 200; i++) {
      res = await callResolver2(resolverName, { planId });
      if (!res || res.ok !== true || res.done === true) break;
      showFlag({ text: `${label2}: ${res.remaining} records left.` });
    }
    return res;
  }
  var finishingDeletes = /* @__PURE__ */ new Set();
  function finishStoppedDeletes(plans) {
    if (planApprover !== true || !Array.isArray(plans)) return;
    for (const p of plans) {
      if (p.state !== "deleting" || finishingDeletes.has(p.id)) continue;
      finishingDeletes.add(p.id);
      finishPlanWork("continuePlanDelete", p.id, `Deleting plan ${p.name}`).finally(() => finishingDeletes.delete(p.id));
    }
  }
  var currentPlanCategoryFilter = "all";
  var currentPlanSearchQuery = "";
  function updatePlansUI(availablePlans = [], currentId = "default") {
    const switcher = document.getElementById("planSwitcher");
    const listed = Array.isArray(availablePlans) ? availablePlans.filter((p) => p.state !== "deleting") : [];
    const plans = listed.length > 0 ? listed : [{ id: "default", name: "Main Plan", isDefault: true }];
    finishStoppedDeletes(availablePlans);
    if (switcher) {
      switcher.innerHTML = "";
      for (const p of plans) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentId) opt.selected = true;
        switcher.appendChild(opt);
      }
    }
    const activePlan = plans.find((p) => p.id === currentId) || plans[0];
    const labelEl = document.getElementById("planSelectorLabel");
    if (labelEl) {
      labelEl.textContent = activePlan ? activePlan.name : "Main Plan";
    }
    const allCount = plans.length;
    const scenarioCount = plans.filter((p) => categorizePlan(p) === "scenario").length;
    const countAllEl = document.getElementById("planTabCountAll");
    if (countAllEl) countAllEl.textContent = String(allCount);
    const countScenariosEl = document.getElementById("planTabCountScenarios");
    if (countScenariosEl) countScenariosEl.textContent = String(scenarioCount);
    renderFilteredPlansList(plans, currentId);
  }
  var planApprover = null;
  async function loadPlanApprover() {
    if (planApprover !== null) return planApprover;
    const res = await callResolver("checkPlanApprover", { planId: activePlanId });
    planApprover = !!(res && res.ok === true && res.isApprover === true);
    applyPlanApproverToCreateForm();
    if (currentPlan && Array.isArray(currentPlan.availablePlans)) renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
    return planApprover;
  }
  function applyPlanApproverToCreateForm() {
    const nameInp = document.getElementById("newPlanNameInput");
    const btn = document.getElementById("btnCreatePlan");
    const allowed = planApprover === true;
    for (const el3 of [nameInp, btn]) {
      if (!el3) continue;
      el3.disabled = !allowed;
      el3.title = allowed ? "" : "Only plan approvers (project or Jira administrators, or an approver group) create plans.";
    }
    renderPlanFilter();
  }
  function renderPlanFilter() {
    const inp = document.getElementById("planJqlInput");
    const btn = document.getElementById("btnSavePlanJql");
    if (!inp || !btn) return;
    if (document.activeElement !== inp) inp.value = currentPlan && currentPlan.jqlFilter || "";
    const allowed = planApprover === true;
    inp.readOnly = !allowed;
    btn.hidden = !allowed;
    inp.title = allowed ? "" : "Only plan approvers change the filter of a plan.";
  }
  async function savePlanFilter() {
    const inp = document.getElementById("planJqlInput");
    const btn = document.getElementById("btnSavePlanJql");
    if (!inp || !btn || planApprover !== true) return;
    btn.disabled = true;
    const res = await callResolver2("setPlanFilter", { filter: inp.value });
    btn.disabled = false;
    if (res && res.ok) {
      const text = res.filter ? `Filter saved. About ${res.count ?? "an unknown number of"} work items match it.` : "Filter removed. The plan reads the whole project.";
      showFlag({ text });
      await loadProjectPlan();
    } else {
      showFlag({ text: res?.message || "The filter was not saved.", error: true });
    }
  }
  function renderFilteredPlansList(plans, currentId) {
    const container = document.getElementById("plansListContainer");
    if (!container) return;
    container.innerHTML = "";
    const viewModels = buildPlanListViewModel(plans, currentId);
    const filtered = filterPlans(viewModels, currentPlanSearchQuery, currentPlanCategoryFilter);
    if (filtered.length === 0) {
      const emptyRow = document.createElement("div");
      emptyRow.style.padding = "16px";
      emptyRow.style.textAlign = "center";
      emptyRow.style.color = "var(--cp-text-subtle)";
      emptyRow.style.fontSize = "12px";
      emptyRow.textContent = currentPlanSearchQuery ? `No plans matching "${currentPlanSearchQuery}"` : "No plans in this category";
      container.appendChild(emptyRow);
      return;
    }
    const allNames = plans.map((p) => p.name);
    for (const p of filtered) {
      const row = document.createElement("div");
      row.className = "plan-item-row" + (p.isActive ? " is-active" : "");
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.title = p.isActive ? `${p.name} (Active plan)` : `Switch to ${p.name}`;
      const mainDiv = document.createElement("div");
      mainDiv.className = "plan-item-main";
      const catBadge = document.createElement("span");
      catBadge.className = "plan-category-badge " + (p.category === "main" ? "is-baseline" : "is-scenario");
      catBadge.textContent = p.category === "main" ? "Main" : "Scenario";
      mainDiv.appendChild(catBadge);
      const nameSpan = document.createElement("span");
      nameSpan.className = "plan-item-name";
      nameSpan.textContent = p.name;
      mainDiv.appendChild(nameSpan);
      if (p.copying) {
        const note = document.createElement("span");
        note.className = "plan-item-note";
        note.textContent = "copy not finished";
        mainDiv.appendChild(note);
      }
      if (p.isActive) {
        const activeCheck = document.createElement("span");
        activeCheck.style.fontSize = "12px";
        activeCheck.style.color = "var(--cp-text-brand)";
        activeCheck.textContent = "\u2713";
        mainDiv.appendChild(activeCheck);
      }
      row.appendChild(mainDiv);
      const actions = document.createElement("div");
      actions.className = "plan-item-actions";
      const btnClone = document.createElement("button");
      btnClone.className = "btn btn-subtle btn-xs";
      btnClone.textContent = "\u{1F4D1}";
      btnClone.title = "Duplicate / Clone this plan";
      btnClone.type = "button";
      btnClone.addEventListener("click", async (e) => {
        e.stopPropagation();
        const cloneName = suggestCloneName(p.name, allNames);
        btnClone.disabled = true;
        const res = await callResolver2("createProjectPlan", {
          name: cloneName,
          cloneFromPlanId: p.id
        });
        const copied = res && res.ok && res.plan && res.done === false ? await finishPlanWork("continuePlanCopy", res.plan.id, `Copying to ${res.plan.name}`) : res;
        if (res && res.ok && res.plan && !(copied && copied.ok && copied.done !== false)) {
          showFlag({ text: `The copy to ${res.plan.name} stopped. Pick it in the plan list to finish it.`, error: true });
          btnClone.disabled = false;
          await loadProjectPlan();
        } else if (res && res.ok && res.plan) {
          setActivePlan(res.plan.id);
          showFlag({ text: `Cloned plan to ${res.plan.name}.` });
          closePlansPopover();
          await loadProjectPlan();
        } else {
          showFlag({ text: res?.message || "Failed to clone plan.", error: true });
          btnClone.disabled = false;
        }
      });
      if (planApprover === true) actions.appendChild(btnClone);
      if (p.canDelete && planApprover === true) {
        const btnRename = document.createElement("button");
        btnRename.className = "btn btn-subtle btn-xs";
        btnRename.textContent = "\u270F\uFE0F";
        btnRename.title = "Rename plan";
        btnRename.type = "button";
        btnRename.addEventListener("click", (e) => {
          e.stopPropagation();
          if (row.querySelector(".plan-rename-input")) return;
          const origName = p.name;
          const renameInp = document.createElement("input");
          renameInp.type = "text";
          renameInp.className = "in-app-search-input plan-rename-input";
          renameInp.value = origName;
          renameInp.style.flex = "1";
          renameInp.style.fontSize = "12px";
          nameSpan.replaceWith(renameInp);
          renameInp.focus();
          renameInp.select();
          const finish2 = async (save) => {
            const newName = renameInp.value.trim();
            if (save && newName && newName !== origName) {
              const res = await callResolver2("renameProjectPlan", { planId: p.id, name: newName });
              if (res && res.ok) {
                showFlag({ text: `Renamed plan to ${newName}.` });
                await loadProjectPlan();
              } else {
                showFlag({ text: res?.message || "Failed to rename plan.", error: true });
                renameInp.replaceWith(nameSpan);
              }
            } else {
              renameInp.replaceWith(nameSpan);
            }
          };
          renameInp.addEventListener("keydown", (ke) => {
            if (ke.key === "Enter") finish2(true);
            if (ke.key === "Escape") finish2(false);
          });
          renameInp.addEventListener("blur", () => finish2(true));
        });
        actions.appendChild(btnRename);
        const btnDel = document.createElement("button");
        btnDel.className = "btn btn-subtle btn-xs";
        btnDel.textContent = "\u{1F5D1}\uFE0F";
        btnDel.title = "Delete plan";
        btnDel.type = "button";
        btnDel.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (btnDel.dataset.confirming === "true") {
            const first = await callResolver2("deleteProjectPlan", { planId: p.id });
            const res = first && first.ok && first.done === false ? await finishPlanWork("continuePlanDelete", p.id, `Deleting plan ${p.name}`) : first;
            if (res && res.ok) {
              showFlag({ text: `Deleted plan ${p.name}.` });
              if (activePlanId === p.id) {
                setActivePlan(MAIN_PLAN_ID);
              }
              await loadProjectPlan();
            } else {
              showFlag({ text: res?.message || "Failed to delete plan.", error: true });
            }
          } else {
            btnDel.dataset.confirming = "true";
            btnDel.textContent = "Confirm?";
            btnDel.className = "btn btn-danger btn-xs";
            setTimeout(() => {
              btnDel.dataset.confirming = "false";
              btnDel.textContent = "\u{1F5D1}\uFE0F";
              btnDel.className = "btn btn-subtle btn-xs";
            }, 4e3);
          }
        });
        actions.appendChild(btnDel);
      }
      row.appendChild(actions);
      row.addEventListener("click", async (e) => {
        if (e.target.closest("button") || e.target.closest("input")) return;
        if (p.copying) {
          if (planApprover !== true) {
            showFlag({ text: `${p.name} is still being copied. A plan approver can finish the copy.` });
            return;
          }
          const done = await finishPlanWork("continuePlanCopy", p.id, `Copying to ${p.name}`);
          if (!(done && done.ok && done.done !== false)) {
            showFlag({ text: done?.message || `The copy to ${p.name} stopped. Try again.`, error: true });
            return;
          }
        }
        if (p.id !== currentId) {
          setActivePlan(p.id);
          closePlansPopover();
          await loadProjectPlan();
          showFlag({ text: `Switched to plan ${p.name}.` });
        }
      });
      row.addEventListener("keydown", (ke) => {
        if (ke.target !== row) return;
        if (ke.key === "Enter" || ke.key === " ") {
          ke.preventDefault();
          row.click();
        }
      });
      container.appendChild(row);
    }
  }
  function closePlansPopover() {
    const pop = document.getElementById("plansManagerPopover");
    if (pop) pop.style.display = "none";
    const trigger = document.getElementById("planSelectorBtn");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }
  async function loadProjectPlan() {
    const loader = document.getElementById("plannerLoadingIndicator");
    const errBanner = document.getElementById("plannerErrorBanner");
    if (loader) loader.style.display = "flex";
    if (errBanner) errBanner.style.display = "none";
    const plan = await callResolver2("getProjectPlan", { planId: activePlanId });
    if (loader) loader.style.display = "none";
    if (plan && Array.isArray(plan.tasks) && plan.isLiveSynced === false) {
      if (errBanner) {
        errBanner.style.display = "flex";
        const msg = document.getElementById("plannerErrorMsg");
        if (msg) msg.textContent = plan.jiraStatus === 401 || plan.jiraStatus === 403 ? "You cannot browse this project in Jira, so CascadePlan cannot show its plan." : "Jira is not reachable right now, so the plan cannot be shown. Click Retry in a moment.";
      }
      return;
    }
    if (plan && Array.isArray(plan.tasks)) {
      if (!planScope && plan.projectKey) {
        planScope = String(plan.projectKey);
        const saved = chooseActivePlan(getSavedPlanId(browserStore(), planScope), plan.availablePlans);
        if (saved !== (plan.planId || MAIN_PLAN_ID)) {
          activePlanId = saved;
          return loadProjectPlan();
        }
      }
      const requested = activePlanId;
      const served = chooseActivePlan(plan.planId || MAIN_PLAN_ID, plan.availablePlans);
      if (requested !== MAIN_PLAN_ID && served !== requested) {
        showFlag({ text: "The plan you had open no longer exists. Showing the Main Plan." });
      }
      mergeOptimisticTasks(plan);
      currentPlan = plan;
      setActivePlan(served);
      updatePlansUI(plan.availablePlans, activePlanId);
      notePlanOnlyLinks(plan);
      if (plan.baselineStatus !== void 0) baselineState = plan.baselineStatus;
      updateBaselineButton();
      columnWidths = sanitizeLoadedColumnWidths(plan.columnWidths);
      if (Array.isArray(plan.hiddenColumns)) {
        hiddenColumns = new Set(plan.hiddenColumns);
      } else {
        try {
          const cached = localStorage.getItem("cascadeplan_hidden_cols_" + plan.projectKey);
          if (cached) hiddenColumns = new Set(JSON.parse(cached));
        } catch (e) {
        }
      }
      updateColumnManagerUI();
      renderPlan();
      settleUndo();
      void loadPlanApprover();
    } else {
      if (errBanner) {
        errBanner.style.display = "flex";
        const msg = document.getElementById("plannerErrorMsg");
        if (msg) msg.textContent = plan && plan.error === "license_required" ? "A CascadePlan licence is required on this site. Ask your Jira administrator." : plan && plan.message || "Unable to synchronize with Jira. Please verify your connection or click Retry.";
      }
    }
  }
  function renderPlan() {
    if (!currentPlan) return;
    renderPlanSummary();
    const newEpicBtn = document.getElementById("newEpicBtn");
    if (newEpicBtn) {
      if (currentPlan.hasEpic === false) {
        newEpicBtn.style.display = "none";
        newEpicBtn.title = "Epics are not enabled in this project type";
      } else {
        newEpicBtn.style.display = "";
        newEpicBtn.title = "";
      }
    }
    if (currentPlan.tasks && collapsedTasks.size) {
      const keys = new Set(currentPlan.tasks.map((t) => t.key));
      for (const k of [...collapsedTasks]) if (!keys.has(k)) collapsedTasks.delete(k);
    }
    renderMilestones();
    renderBacklogTray();
    coverPlanDates();
    renderTimelineHeader();
    renderTimelineRows();
    applyTimeAxis();
    if (decideCompactColumns()) {
      renderTimelineHeader();
      renderTimelineRows();
      applyTimeAxis();
    }
    setTimeout(syncGanttScrollWidth, 50);
    if (!hasInitialScrolledToToday) {
      hasInitialScrolledToToday = true;
      setTimeout(scrollToToday, 250);
    }
    if (currentView === "table") {
      renderTableView();
    }
  }
  var HINT_KEY = "cascadeplan_hint_link";
  function updateLinkHint() {
    const hint = document.getElementById("linkHint");
    if (!hint || !currentPlan) return;
    if ((currentPlan.tasks || []).some((t) => t.dependency && t.dependency.predecessorKey)) writePref(HINT_KEY, "done");
    hint.hidden = !showLinkHint(currentPlan, readPref(HINT_KEY, null));
  }
  function openHelp() {
    const pop = document.getElementById("helpPopup");
    if (!pop) return;
    pop.hidden = false;
    document.getElementById("btnCloseHelp")?.focus();
  }
  function closeHelp() {
    const pop = document.getElementById("helpPopup");
    if (pop) pop.hidden = true;
  }
  function renderPlanSummary() {
    updateLinkHint();
    fillAssigneeOptions();
    const projectBadge = document.getElementById("projectBadge");
    projectBadge.textContent = currentPlan.projectKey;
    projectBadge.hidden = false;
    const completionBadge = document.getElementById("completionBadge");
    completionBadge.textContent = `${currentPlan.overallProjectCompletion}% (${currentPlan.overallTargetCompletion}%)`;
    completionBadge.hidden = false;
    document.getElementById("backlogCount").textContent = currentPlan.backlogTasks ? currentPlan.backlogTasks.length : 0;
    const truncatedNote = document.getElementById("truncatedNote");
    if (truncatedNote) {
      truncatedNote.hidden = !currentPlan.truncated;
      truncatedNote.textContent = currentPlan.truncated ? `Showing the newest ${currentPlan.truncated.shown} of about ${currentPlan.truncated.total} issues${currentPlan.jqlFilter ? " that match this plan's filter" : ". A plan approver can narrow the plan with a JQL filter in the plan list"}` : "";
    }
    renderPlanFilter();
    const curWk = (currentPlan.weeks || []).find((w) => w.isCurrentWeek);
    if (curWk) {
      const el3 = document.getElementById("legendCurrentWeek");
      if (el3) el3.textContent = `Current Week (${curWk.weekKey})`;
    }
  }
  function renderMilestones() {
    const strip = document.getElementById("milestonesStrip");
    strip.innerHTML = "";
    (currentPlan.milestones || []).forEach((m) => {
      const el3 = document.createElement("div");
      el3.className = "milestone-pill";
      el3.innerHTML = html`<span class="milestone-icon">🔷</span><span>${m.title}</span><span class="jx-subtle">(${m.weekKey})</span>`;
      strip.appendChild(el3);
    });
  }
  function renderBacklogTray() {
    const container = document.getElementById("backlogCardsList");
    container.innerHTML = "";
    const backlog = currentPlan.backlogTasks || [];
    if (backlog.length === 0) {
      container.innerHTML = '<div class="jx-empty-tray">No unmapped backlog issues. Drag from timeline to unmap.</div>';
      return;
    }
    backlog.forEach((item) => {
      const card = document.createElement("div");
      card.className = "backlog-card";
      card.draggable = true;
      const isEpicCard = item.isEpic || item.hierarchyLevel === 1;
      const isSubCard = item.isSubtask || item.hierarchyLevel === -1;
      const badgeLabel = isEpicCard ? "\u{1F7EA} EPIC" : isSubCard ? "\u21B3 Subtask" : item.story || "Task";
      const badgeClass = isEpicCard ? "badge-primary" : "badge-neutral";
      const effortDisplay = formatEffort(item.effortHours);
      const siteUrl = getJiraBaseUrl();
      card.innerHTML = html`
      <div class="backlog-card-header">
        <a href="${siteUrl}/browse/${item.key}" target="_blank" rel="noopener noreferrer" class="backlog-key-link" title="Open ${item.key} in native Jira (new tab)">${item.key} ↗</a>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="backlog-summary" title="${item.summary}">${item.summary}</div>
      <div class="backlog-footer">
        <span>⏱️ ${effortDisplay}</span>
        <span>👤 ${item.resource || "Unassigned"}</span>
        <button type="button" class="btn btn-outline btn-sm btn-schedule-backlog jx-schedule-btn" title="Schedule onto timeline">+ Schedule</button>
      </div>
    `;
      const bKeyLink = card.querySelector(".backlog-key-link");
      if (bKeyLink) {
        bKeyLink.addEventListener("click", (e) => {
          openJiraIssueInNewTab(item.key, e);
        });
      }
      const btnSched = card.querySelector(".btn-schedule-backlog");
      if (btnSched) {
        btnSched.addEventListener("click", async (e) => {
          e.stopPropagation();
          btnSched.disabled = true;
          btnSched.textContent = "Scheduling...";
          try {
            const res = await callResolver2("scheduleBacklogTask", {
              taskId: item.key,
              startWeek: "",
              startDate: todayIso(),
              spanWeeks: 3
            });
            if (res && Array.isArray(res.tasks)) {
              currentPlan = res;
              renderPlan();
            } else {
              await loadProjectPlan();
            }
            if (res && res.ok === true) showFlag({ text: "Scheduled " + item.key + " to timeline." });
          } catch (err) {
            showFlag({ text: "Failed to schedule " + item.key, error: true });
          }
        });
      }
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: item.key, effortHours: item.effortHours }));
        document.body.classList.add("is-dragging-backlog");
        updateVirtualRows();
      });
      card.addEventListener("dragend", () => {
        document.body.classList.remove("is-dragging-backlog");
        updateVirtualRows();
      });
      container.appendChild(card);
    });
  }
  function renderTimelineHeader() {
    const tr = document.getElementById("ganttHeaderRow");
    tr.innerHTML = "";
    const frozen = getFrozenLayout();
    try {
      document.documentElement.style.setProperty("--cp-frozen-w", frozen.totalWidth + "px");
    } catch (e) {
    }
    frozen.visibleKeys.forEach((k) => {
      const colDef = ALL_COLUMNS.find((c) => c.key === k) || { label: k, locked: false };
      const th2 = document.createElement("th");
      th2.className = "th-col th-frozen" + (k === frozen.lastKey ? " is-last-frozen" : "");
      th2.setAttribute("data-col-key", k);
      const w = frozen.widths[k];
      th2.style.width = w + "px";
      th2.style.minWidth = w + "px";
      th2.style.maxWidth = w + "px";
      th2.style.left = frozen.offsets[k] + "px";
      th2.innerHTML = html`
      <div class="th-content-wrap">
        <span class="th-label-text">${colDef.label}</span>
        ${!colDef.locked ? html`<button class="th-col-menu-btn" data-col-key="${k}" title="Column options (Hide ${colDef.label})" aria-label="Column options for ${colDef.label}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` : ""}
      </div>
    `;
      const menuBtn = th2.querySelector(".th-col-menu-btn");
      if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openColumnHeaderMenu(e, k, colDef.label);
        });
      }
      const resizer = document.createElement("div");
      resizer.className = "resizer col-resizer";
      setupColumnResizer(resizer, k);
      th2.appendChild(resizer);
      tr.appendChild(th2);
    });
    const th = document.createElement("th");
    th.className = "timeline-header-cell";
    const strip = document.createElement("div");
    strip.className = "time-strip";
    th.appendChild(strip);
    tr.appendChild(th);
    renderTimeStrip();
  }
  function renderTimeStrip() {
    const strip = document.querySelector("#ganttHeaderRow .time-strip");
    if (!strip || !timeRange) return;
    const cells = headerCells(timeRange, zoomById(zoomId), todayIso()).map((c) => {
      const el3 = document.createElement("div");
      el3.className = "time-cell" + (c.current ? " current" : "");
      el3.style.left = c.x + "px";
      el3.style.width = c.w + "px";
      el3.textContent = c.label;
      el3.title = c.key;
      return el3;
    });
    strip.replaceChildren(...cells);
  }
  function decideCompactColumns() {
    compactDecided = true;
    return false;
  }
  function computeBoundedTimeRange() {
    const today = todayIso();
    const dates = (currentPlan?.tasks || []).flatMap((t) => [t.startDate, t.endDate]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""));
    dates.push(today);
    const minDate = dates.reduce((m, d) => d < m ? d : m);
    const maxDate = dates.reduce((m, d) => d > m ? d : m);
    const start = mondayOf(addDays(minDate, -28));
    let end = addDays(mondayOf(addDays(maxDate, 28)), 6);
    const wrapper = document.getElementById("ganttWrapper");
    const trackLeft = layout && layout.trackLeft || 300;
    const viewportTrackWidth = wrapper && wrapper.clientWidth ? Math.max(400, wrapper.clientWidth - trackLeft) : 800;
    const currentPx = rangeDays({ start, end }) * dayPx();
    if (currentPx < viewportTrackWidth) {
      const missingPx = viewportTrackWidth - currentPx;
      const missingDays = Math.ceil(missingPx / dayPx());
      const missingWeeks = Math.ceil(missingDays / 7);
      end = addDays(end, missingWeeks * 7);
    }
    return { start, end };
  }
  function coverPlanDates() {
    timeRange = computeBoundedTimeRange();
  }
  function applyTimeAxis() {
    const table = document.getElementById("ganttTable");
    const wrapper = document.getElementById("ganttWrapper");
    if (!table || !timeRange) return;
    table.style.setProperty("--cp-track-w", trackWidth() + "px");
    if (wrapper) {
      wrapper.dataset.origin = timeRange.start;
      wrapper.dataset.dayPx = String(dayPx());
    }
    renderTimeStrip();
    for (const [key, tr] of rowCache) {
      const hit = tr.querySelector(".bar-hit");
      const t = findTask(key);
      if (hit && t) positionBarHit(hit, t);
    }
    measureLayout();
    drawTimeline(true);
  }
  function setTimelineScrollLeft(x) {
    const w = document.getElementById("ganttWrapper");
    if (w) w.scrollLeft = x;
  }
  function maybeExtendRange() {
    return;
  }
  function setZoom(id) {
    const w = document.getElementById("ganttWrapper");
    if (!w || !timeRange || id === zoomId) return;
    const vw = w.clientWidth - layout.trackLeft;
    const key = lastGridKey || pinnedDependencyTaskId;
    const t = key && findTask(key);
    const vx = t && t.startDate ? vw / 3 : vw / 2;
    const anchor = t && t.startDate ? t.startDate : dateAt(w.scrollLeft + vx, timeRange.start, dayPx());
    zoomId = id;
    writePref(ZOOM_KEY, id);
    const need = Math.ceil(vw / dayPx()) + 7;
    while (daysBetween(timeRange.start, anchor) < need) timeRange = extendRange(timeRange, "before", EXTEND_WEEKS);
    while (daysBetween(anchor, timeRange.end) < need) timeRange = extendRange(timeRange, "after", EXTEND_WEEKS);
    applyTimeAxis();
    setTimelineScrollLeft(Math.max(0, anchorScroll(anchor, vx, timeRange.start, dayPx())));
    updateZoomButtons();
    drawTimeline(true);
  }
  function updateZoomButtons() {
    document.querySelectorAll("#zoomGroup [data-zoom]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zoom === zoomId)));
    const compact = document.getElementById("btnCompactColumns");
    if (compact) compact.setAttribute("aria-pressed", String(isCompactMode()));
  }
  function setCompactColumns(on) {
    if (on) {
      hiddenColumns = new Set(ALL_COLUMNS.filter((c) => c.key !== "task").map((c) => c.key));
    } else {
      hiddenColumns.clear();
    }
    onColumnsChanged();
  }
  function applyColumnWidthsToDom() {
    const frozen = getFrozenLayout();
    try {
      document.documentElement.style.setProperty("--cp-frozen-w", frozen.totalWidth + "px");
    } catch (e) {
    }
    const thList = document.querySelectorAll("#ganttHeaderRow .th-col");
    thList.forEach((th, i) => {
      const k = frozen.visibleKeys[i];
      if (!k) return;
      const w = frozen.widths[k];
      th.classList.toggle("is-last-frozen", k === frozen.lastKey);
      th.style.width = w + "px";
      th.style.minWidth = w + "px";
      th.style.maxWidth = w + "px";
      th.style.left = frozen.offsets[k] + "px";
    });
    const visited = /* @__PURE__ */ new Set();
    for (const tr of rowCache.values()) {
      visited.add(tr);
      applyFrozen(tr);
    }
    document.querySelectorAll("#ganttBody tr.task-row, #ganttBody tr.inline-creation-row").forEach((tr) => {
      if (!visited.has(tr)) applyFrozen(tr);
    });
  }
  function setupColumnResizer(resizer, colKey) {
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = colWidth(colKey);
      resizer.classList.add("is-resizing");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      function onMouseMove(moveEvent) {
        const nextWidth = clampColumnResize(colKey, startWidth + (moveEvent.clientX - startX));
        if (isCompactMode() && colKey === "task") {
          compactTaskWidth = nextWidth;
        } else {
          columnWidths[colKey] = nextWidth;
        }
        applyColumnWidthsToDom();
        measureLayout();
        drawTimeline(true);
        syncGanttScrollWidth();
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        resizer.classList.remove("is-resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        applyColumnWidthsToDom();
        measureLayout();
        drawTimeline(true);
        syncGanttScrollWidth();
        if (!(isCompactMode() && colKey === "task")) {
          callResolver2("saveColumnWidths", { columnWidths });
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  var activePickerTaskKey = null;
  function getInitials(name) {
    if (!name || name === "Unassigned") return "U";
    const parts2 = name.trim().split(/\s+/);
    if (parts2.length === 1) return parts2[0].slice(0, 2).toUpperCase();
    return (parts2[0][0] + parts2[parts2.length - 1][0]).toUpperCase();
  }
  function getTaskContributingResources(task) {
    if (!task) return [];
    const resMap = /* @__PURE__ */ new Map();
    if (task.resource && task.resource !== "Unassigned" && task.resource !== "Unallocated") {
      resMap.set(task.resource, { name: task.resource, isParent: true, subtasks: [] });
    }
    if (currentPlan && Array.isArray(currentPlan.tasks)) {
      currentPlan.tasks.forEach((t) => {
        if (t.parentKey === task.key && t.isSubtask && t.resource && t.resource !== "Unassigned" && t.resource !== "Unallocated") {
          if (!resMap.has(t.resource)) {
            resMap.set(t.resource, { name: t.resource, isParent: false, subtasks: [t.key] });
          } else {
            const entry = resMap.get(t.resource);
            if (!entry.subtasks.includes(t.key)) entry.subtasks.push(t.key);
          }
        }
      });
    }
    if (Array.isArray(task.subtasks)) {
      task.subtasks.forEach((s) => {
        if (s.assignee && s.assignee !== "Unassigned" && s.assignee !== "Unallocated") {
          const subIdent = s.key || s.summary || "Subtask";
          if (!resMap.has(s.assignee)) {
            resMap.set(s.assignee, { name: s.assignee, isParent: false, subtasks: [subIdent] });
          } else {
            const entry = resMap.get(s.assignee);
            if (!entry.subtasks.includes(subIdent)) entry.subtasks.push(subIdent);
          }
        }
      });
    }
    if (Array.isArray(task.contributingResources)) {
      task.contributingResources.forEach((name) => {
        if (name && name !== "Unassigned" && name !== "Unallocated" && !resMap.has(name)) {
          resMap.set(name, { name, isParent: false, subtasks: [] });
        }
      });
    }
    return Array.from(resMap.values());
  }
  function closeAllPopovers() {
    const resPopover = document.getElementById("resourcePickerPopover");
    if (resPopover) resPopover.style.display = "none";
    const statPopover = document.getElementById("statusPickerPopover");
    if (statPopover) statPopover.style.display = "none";
    const epicPopover = document.getElementById("epicPickerPopover");
    if (epicPopover) epicPopover.style.display = "none";
    const progPopover = document.getElementById("progressPickerPopover");
    if (progPopover) progPopover.style.display = "none";
    const targetPopover = document.getElementById("targetPickerPopover");
    if (targetPopover) targetPopover.style.display = "none";
    const colMenu = document.getElementById("columnHeaderContextMenu");
    if (colMenu) colMenu.remove();
    document.querySelectorAll(".th-col.is-menu-open").forEach((th) => th.classList.remove("is-menu-open"));
    if (typeof closeDependencyEditPopover === "function") closeDependencyEditPopover();
    if (typeof closeDependencyConflictDialog === "function") closeDependencyConflictDialog();
    const plansPop = document.getElementById("plansManagerPopover");
    if (plansPop) plansPop.style.display = "none";
    const rowMore = document.getElementById("rowMoreMenu");
    if (rowMore) rowMore.style.display = "none";
  }
  function openResourcePicker(targetEl, taskKey) {
    closeAllPopovers();
    activePickerTaskKey = taskKey;
    const popover = document.getElementById("resourcePickerPopover");
    const searchInput = document.getElementById("resourcePickerSearch");
    const listEl = document.getElementById("resourcePickerList");
    const currentContainer = document.getElementById("resourcePickerCurrent");
    const titleText = document.getElementById("resourcePickerTitleText");
    const badge = document.getElementById("resourcePickerBadge");
    const btnDone = document.getElementById("btnResourceDone");
    const btnClearAll = document.getElementById("btnResourceClearAll");
    const isInlineDraft = activePickerTaskKey === "NEW_INLINE_TASK";
    const curTask = !isInlineDraft ? (currentPlan?.tasks || []).find((t) => t.key === activePickerTaskKey) : null;
    const rect = targetEl.getBoundingClientRect();
    popover.style.display = "flex";
    const popoverHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
      popover.style.top = Math.max(10, rect.top - popoverHeight) + "px";
    } else {
      popover.style.top = rect.bottom + 4 + "px";
    }
    popover.style.left = Math.min(window.innerWidth - 340, Math.max(10, rect.left)) + "px";
    if (titleText) {
      titleText.textContent = isInlineDraft ? "Assign Resource" : `Assign Team (${taskKey})`;
    }
    let assignedResources = [];
    if (curTask) {
      const contributing = getTaskContributingResources(curTask);
      assignedResources = contributing.map((c) => ({
        name: c.name,
        isParent: Boolean(c.isParent),
        accountId: (currentPlan?.availableUsers || []).find((u) => u.displayName === c.name)?.accountId
      }));
    }
    function updateHeaderBadge() {
      if (!badge) return;
      if (isInlineDraft) {
        badge.style.display = "none";
      } else {
        badge.style.display = "inline-flex";
        const count = assignedResources.length;
        badge.textContent = `${count} assigned`;
        if (count === 0) {
          badge.className = "badge badge-neutral";
        } else if (count === 1) {
          badge.className = "badge badge-primary";
        } else {
          badge.className = "badge badge-success";
        }
      }
    }
    function renderCurrentChips() {
      if (!currentContainer) return;
      if (isInlineDraft || assignedResources.length === 0) {
        currentContainer.style.display = "none";
        currentContainer.innerHTML = "";
        return;
      }
      currentContainer.style.display = "flex";
      currentContainer.innerHTML = '<div class="jx-picker-caption">Assigned Team:</div>';
      assignedResources.forEach((res) => {
        const chip = document.createElement("div");
        chip.className = "resource-current-chip" + (res.isParent ? " is-lead" : "");
        const initials = getInitials(res.name);
        chip.innerHTML = html`
        <span class="resource-option-avatar jx-avatar-small">${initials}</span>
        <span>${res.name}</span>
        <span class="jx-lead-note">${res.isParent ? "(Lead)" : ""}</span>
        ${!res.isParent ? html`<button class="resource-btn-make-lead" title="Make primary Jira assignee">★ Lead</button>` : ""}
        <span class="resource-current-chip-remove" title="Remove ${res.name}">✕</span>
      `;
        const removeBtn = chip.querySelector(".resource-current-chip-remove");
        if (removeBtn) {
          removeBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await removeResource(res.name);
          });
        }
        const makeLeadBtn = chip.querySelector(".resource-btn-make-lead");
        if (makeLeadBtn) {
          makeLeadBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await makeLeadResource(res.name);
          });
        }
        currentContainer.appendChild(chip);
      });
    }
    async function syncTaskResources(extraUpdates) {
      if (isInlineDraft || !curTask) return;
      const lead = assignedResources.find((r) => r.isParent) || assignedResources[0];
      const primaryName = lead ? lead.name : "Unassigned";
      const primaryAccountId = lead ? lead.accountId || (currentPlan?.availableUsers || []).find((u) => u.displayName === lead.name)?.accountId : "unassigned";
      const contributingList = assignedResources.map((r) => r.name);
      const ids = assignedResources.map((r) => r.accountId || (currentPlan?.availableUsers || []).find((u) => u.displayName === r.name)?.accountId);
      curTask.resource = primaryName;
      curTask.resourceAccountId = primaryAccountId;
      curTask.contributingResources = contributingList;
      const updates = { resource: primaryName, resourceAccountId: primaryAccountId, ...extraUpdates };
      if (ids.every(Boolean)) updates.contributors = ids.map((accountId) => {
        const existing = curTask.contributors?.find((c) => c.accountId === accountId);
        return existing?.subtaskKey ? { accountId, subtaskKey: existing.subtaskKey } : { accountId };
      });
      else updates.contributingResources = contributingList;
      const res = await callResolver2("updateWbsTask", { taskId: curTask.key, updates });
      if (res && res.ok && res.tasks) {
        const refreshed = res.tasks.find((t) => t.key === curTask.key);
        if (refreshed && refreshed.contributors) {
          curTask.contributors = refreshed.contributors;
        }
      }
      renderTimelineRows();
    }
    function showRemovalPrompt(removing, subtaskKey, idx) {
      if (!currentContainer) return;
      const existingPrompt = currentContainer.querySelector(".resource-removal-prompt");
      if (existingPrompt) existingPrompt.remove();
      const promptContainer = document.createElement("div");
      promptContainer.className = "resource-removal-prompt";
      promptContainer.style.cssText = "width: 100%; padding: 8px; border: 1px solid var(--cp-border); border-radius: 4px; background: var(--cp-surface); margin-top: 4px; box-sizing: border-box;";
      promptContainer.innerHTML = html`
      <div class="jx-remove-prompt">${formatRemovalPrompt(removing.name, subtaskKey)}</div>
      <div class="jx-row-6">
        <button type="button" class="btn btn-danger btn-sm btn-delete-subtask jx-btn-tiny">Delete sub-task</button>
        <button type="button" class="btn btn-secondary btn-sm btn-unassign-subtask jx-btn-tiny">Unassign sub-task</button>
        <button type="button" class="btn btn-subtle btn-sm btn-cancel-remove jx-btn-tiny">Cancel</button>
      </div>
    `;
      promptContainer.querySelector(".btn-delete-subtask").addEventListener("click", async (e) => {
        e.stopPropagation();
        assignedResources.splice(idx, 1);
        if (assignedResources.length > 0 && !assignedResources.some((r) => r.isParent)) {
          assignedResources[0].isParent = true;
        }
        updateHeaderBadge();
        renderCurrentChips();
        renderUserList(searchInput.value);
        await syncTaskResources({ removeSubtaskAction: { subtaskKey, action: "delete" } });
      });
      promptContainer.querySelector(".btn-unassign-subtask").addEventListener("click", async (e) => {
        e.stopPropagation();
        assignedResources.splice(idx, 1);
        if (assignedResources.length > 0 && !assignedResources.some((r) => r.isParent)) {
          assignedResources[0].isParent = true;
        }
        updateHeaderBadge();
        renderCurrentChips();
        renderUserList(searchInput.value);
        await syncTaskResources({ removeSubtaskAction: { subtaskKey, action: "unassign" } });
      });
      promptContainer.querySelector(".btn-cancel-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        renderCurrentChips();
      });
      currentContainer.appendChild(promptContainer);
    }
    async function toggleResource(user) {
      if (isInlineDraft) {
        popover.style.display = "none";
        if (typeof window.__onResourceSelectedForDraft === "function") {
          window.__onResourceSelectedForDraft(user.displayName, user.accountId || void 0);
        }
        return;
      }
      const existingIdx = assignedResources.findIndex((r) => r.name === user.displayName);
      if (existingIdx >= 0) {
        const removing = assignedResources[existingIdx];
        const contributorRec = curTask?.contributors?.find((c) => c.accountId === removing.accountId) || curTask?.contributors?.find((c) => (currentPlan?.availableUsers || []).find((u) => u.displayName === removing.name)?.accountId === c.accountId);
        const subtaskKey = contributorRec?.subtaskKey;
        if (subtaskKey) {
          showRemovalPrompt(removing, subtaskKey, existingIdx);
          return;
        }
        assignedResources.splice(existingIdx, 1);
        if (assignedResources.length > 0 && !assignedResources.some((r) => r.isParent)) {
          assignedResources[0].isParent = true;
        }
      } else {
        const isFirst = assignedResources.length === 0;
        assignedResources.push({
          name: user.displayName,
          isParent: isFirst,
          accountId: user.accountId || void 0
        });
      }
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources();
    }
    async function removeResource(userName) {
      const idx = assignedResources.findIndex((r) => r.name === userName);
      if (idx >= 0) {
        const removing = assignedResources[idx];
        const contributorRec = curTask?.contributors?.find((c) => c.accountId === removing.accountId) || curTask?.contributors?.find((c) => (currentPlan?.availableUsers || []).find((u) => u.displayName === removing.name)?.accountId === c.accountId);
        const subtaskKey = contributorRec?.subtaskKey;
        if (subtaskKey) {
          showRemovalPrompt(removing, subtaskKey, idx);
          return;
        }
        assignedResources.splice(idx, 1);
        if (assignedResources.length > 0 && !assignedResources.some((r) => r.isParent)) {
          assignedResources[0].isParent = true;
        }
        updateHeaderBadge();
        renderCurrentChips();
        renderUserList(searchInput.value);
        await syncTaskResources();
      }
    }
    async function makeLeadResource(userName) {
      assignedResources.forEach((r) => {
        r.isParent = r.name === userName;
      });
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources();
    }
    async function clearAllResources() {
      if (isInlineDraft) {
        popover.style.display = "none";
        if (typeof window.__onResourceSelectedForDraft === "function") {
          window.__onResourceSelectedForDraft("Unassigned", void 0);
        }
        return;
      }
      assignedResources = [];
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources();
    }
    if (btnClearAll) {
      btnClearAll.onclick = (e) => {
        e.stopPropagation();
        clearAllResources();
      };
    }
    if (btnDone) {
      btnDone.onclick = (e) => {
        e.stopPropagation();
        popover.style.display = "none";
      };
    }
    updateHeaderBadge();
    renderCurrentChips();
    searchInput.value = "";
    renderUserList("");
    setTimeout(() => searchInput.focus(), 50);
    function renderUserList(query) {
      listEl.innerHTML = "";
      const q = (query || "").toLowerCase().trim();
      if (!q || "unassigned".includes(q)) {
        const isUnassignedSelected = assignedResources.length === 0;
        const opt = document.createElement("div");
        opt.className = "resource-option" + (isUnassignedSelected ? " is-selected" : "");
        opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isUnassignedSelected ? "checked" : ""} />
        <span class="resource-option-avatar">U</span>
        <span class="jx-fill">Unassigned</span>
      `;
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          clearAllResources();
        });
        listEl.appendChild(opt);
      }
      const users = (currentPlan?.availableUsers || []).filter(
        (u) => u.accountId !== "unassigned" && u.displayName && u.displayName.toLowerCase().includes(q)
      );
      if (users.length === 0 && q && !"unassigned".includes(q)) {
        listEl.innerHTML = '<div class="jx-empty-list">No matching team members</div>';
        return;
      }
      users.forEach((u) => {
        const assignedEntry = assignedResources.find((r) => r.name === u.displayName);
        const isAssigned = Boolean(assignedEntry);
        const isLead = assignedEntry?.isParent;
        const opt = document.createElement("div");
        opt.className = "resource-option" + (isAssigned ? " is-selected" : "");
        const initials = getInitials(u.displayName);
        const isPlaceholder = u.isPlaceholder ? html` <span class="jx-placeholder-note">(Placeholder)</span>` : "";
        let badgeHtml = html``;
        if (isAssigned) {
          badgeHtml = isLead ? html`<span class="resource-badge-lead">Lead</span>` : html`<span class="resource-badge-contrib">Contributor</span>`;
        }
        opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isAssigned ? "checked" : ""} />
        <span class="resource-option-avatar">${initials}</span>
        <span class="jx-ellipsis-fill">${u.displayName}${isPlaceholder}</span>
        ${badgeHtml}
      `;
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleResource(u);
        });
        listEl.appendChild(opt);
      });
    }
    searchInput.oninput = (e) => renderUserList(e.target.value);
    searchInput.onkeydown = (e) => {
      if (e.key === "Escape") {
        popover.style.display = "none";
      }
    };
  }
  function openStatusPicker(targetEl, taskKey) {
    closeAllPopovers();
    activePickerTaskKey = taskKey;
    const popover = document.getElementById("statusPickerPopover");
    const rect = targetEl.getBoundingClientRect();
    popover.style.display = "flex";
    popover.style.top = rect.bottom + 4 + "px";
    popover.style.left = Math.min(window.innerWidth - 180, Math.max(10, rect.left)) + "px";
    popover.querySelectorAll(".quick-menu-item").forEach((item) => {
      item.onclick = async (e) => {
        e.stopPropagation();
        popover.style.display = "none";
        const status = item.dataset.status;
        await callResolver2("updateWbsTask", {
          taskId: activePickerTaskKey,
          updates: { status }
        });
        await loadProjectPlan();
      };
    });
  }
  function openEpicPicker(targetEl, taskKey) {
    closeAllPopovers();
    activePickerTaskKey = taskKey;
    const popover = document.getElementById("epicPickerPopover");
    const searchInput = document.getElementById("epicPickerSearch");
    const listEl = document.getElementById("epicPickerList");
    const rect = targetEl.getBoundingClientRect();
    popover.style.display = "flex";
    const popoverHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
      popover.style.top = Math.max(10, rect.top - popoverHeight) + "px";
    } else {
      popover.style.top = rect.bottom + 4 + "px";
    }
    popover.style.left = Math.min(window.innerWidth - 240, Math.max(10, rect.left)) + "px";
    searchInput.value = "";
    renderEpicList("");
    setTimeout(() => searchInput.focus(), 50);
    function renderEpicList(query) {
      listEl.innerHTML = "";
      const q = (query || "").toLowerCase().trim();
      if (!q || "none standalone".includes(q)) {
        const opt = document.createElement("div");
        opt.className = "resource-option";
        opt.innerHTML = html`<span class="jx-subtle-11">✕ (None / Standalone Task)</span>`;
        opt.addEventListener("click", async () => {
          popover.style.display = "none";
          if (activePickerTaskKey === "NEW_INLINE_TASK") {
            if (typeof window.__onEpicSelectedForDraft === "function") {
              window.__onEpicSelectedForDraft("", "");
            }
            return;
          }
          await callResolver2("updateWbsTask", {
            taskId: activePickerTaskKey,
            updates: { epic: "", epicKey: "" }
          });
          await loadProjectPlan();
        });
        listEl.appendChild(opt);
      }
      const epics = (currentPlan?.availableEpics || []).filter(
        (e) => e.summary && e.summary.toLowerCase().includes(q) || e.key && e.key.toLowerCase().includes(q)
      );
      if (epics.length === 0 && q) {
        listEl.innerHTML = '<div class="jx-empty-list">No matching epics</div>';
        return;
      }
      epics.forEach((ep) => {
        const opt = document.createElement("div");
        opt.className = "resource-option";
        opt.innerHTML = html`<span>🟪 <strong>${ep.key}</strong>: ${ep.summary}</span>`;
        opt.addEventListener("click", async () => {
          popover.style.display = "none";
          if (activePickerTaskKey === "NEW_INLINE_TASK") {
            if (typeof window.__onEpicSelectedForDraft === "function") {
              window.__onEpicSelectedForDraft(ep.summary, ep.key);
            }
            return;
          }
          await callResolver2("updateWbsTask", {
            taskId: activePickerTaskKey,
            updates: { epic: ep.summary, epicKey: ep.key }
          });
          await loadProjectPlan();
        });
        listEl.appendChild(opt);
      });
    }
    searchInput.oninput = (e) => renderEpicList(e.target.value);
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        const firstOpt = listEl.querySelector(".resource-option");
        if (firstOpt) firstOpt.click();
      } else if (e.key === "Escape") {
        popover.style.display = "none";
      }
    };
  }
  var activeProgressTaskKey = null;
  var activeTargetTaskKey = null;
  function openProgressPicker(targetEl, taskKey) {
    closeAllPopovers();
    activeProgressTaskKey = taskKey;
    const task = (currentPlan?.tasks || []).find((t) => t.key === taskKey);
    if (!task) return;
    const locked = progressLockReason(task);
    if (locked) {
      showFlag({ text: locked });
      announce(locked);
      return;
    }
    const popover = document.getElementById("progressPickerPopover");
    const titleEl = document.getElementById("progressPickerTitle");
    const valLabel = document.getElementById("progressPickerValLabel");
    const slider = document.getElementById("progressPickerSlider");
    const numInput = document.getElementById("progressPickerNumberInput");
    const rollupSection = document.getElementById("progressPickerRollupSection");
    const rollupLabel = document.getElementById("progressPickerRollupLabel");
    titleEl.textContent = `Progress: ${task.key}`;
    const curProg = task.progress !== void 0 ? task.progress : 0;
    slider.value = curProg;
    numInput.value = curProg;
    valLabel.textContent = `${curProg}%`;
    const isRollupTask = task.isEpic || task.childrenCount && task.childrenCount > 0;
    const rollupPct = task.rollupStats ? task.rollupStats.progressPct : task.progress || 0;
    if (isRollupTask) {
      rollupSection.style.display = "block";
      rollupLabel.textContent = `Child Rollup: ${rollupPct}%`;
    } else {
      rollupSection.style.display = "none";
    }
    const rect = targetEl.getBoundingClientRect();
    popover.style.display = "flex";
    const popoverHeight = isRollupTask ? 210 : 170;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
      popover.style.top = Math.max(10, rect.top - popoverHeight) + "px";
    } else {
      popover.style.top = rect.bottom + 4 + "px";
    }
    popover.style.left = Math.min(window.innerWidth - 260, Math.max(10, rect.left)) + "px";
  }
  function openTargetPicker(targetEl, taskKey) {
    closeAllPopovers();
    activeTargetTaskKey = taskKey;
    const task = (currentPlan?.tasks || []).find((t) => t.key === taskKey);
    if (!task) return;
    const popover = document.getElementById("targetPickerPopover");
    const titleEl = document.getElementById("targetPickerTitle");
    const valLabel = document.getElementById("targetPickerValLabel");
    const slider = document.getElementById("targetPickerSlider");
    const numInput = document.getElementById("targetPickerNumberInput");
    titleEl.textContent = `Target: ${task.key}${task.manualTargetProgress ? " (Manual)" : " (Auto)"}`;
    const curTarget = task.targetProgress !== void 0 ? task.targetProgress : 0;
    slider.value = curTarget;
    numInput.value = curTarget;
    valLabel.textContent = `${curTarget}%`;
    const rect = targetEl.getBoundingClientRect();
    popover.style.display = "flex";
    const popoverHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
      popover.style.top = Math.max(10, rect.top - popoverHeight) + "px";
    } else {
      popover.style.top = rect.bottom + 4 + "px";
    }
    popover.style.left = Math.min(window.innerWidth - 250, Math.max(10, rect.left)) + "px";
  }
  function openInlineCreationRow(rowElement, anchorTask, rowIdx) {
    const existing = document.querySelector(".inline-creation-row");
    if (existing) existing.remove();
    const insertIndex = rowIdx + 1;
    const isAnchorEpic = anchorTask.isEpic || anchorTask.hierarchyLevel === 1;
    let inheritedEpic = isAnchorEpic ? anchorTask.summary : anchorTask.epic || "";
    let inheritedEpicKey = isAnchorEpic ? anchorTask.key : anchorTask.epicKey || "";
    const defaultStartWk = anchorTask.startWeek || (currentPlan.weeks.find((w) => w.isCurrentWeek)?.weekKey || currentPlan.weeks[0]?.weekKey);
    const barLeft = xForDate(anchorTask.startDate || todayIso(), originIso(), dayPx());
    const barWidth = 21 * dayPx();
    const creationTr = document.createElement("tr");
    creationTr.className = "inline-creation-row";
    let epicDisplay = inheritedEpic ? `\u{1F7EA} ${inheritedEpic}` : "+ Link Epic";
    const visibleKeys = getVisibleColKeys();
    let cellsHtml = html``;
    if (visibleKeys.includes("epic")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-epic-cell" data-css-w="${columnWidths.epic}px">
        <span class="epic-link-chip new-task-epic-chip ${inheritedEpic ? "has-epic" : "no-epic"}" title="Choose Epic">${epicDisplay} ▾</span>
      </td>
    `;
    }
    if (visibleKeys.includes("story")) {
      cellsHtml = html`${cellsHtml}<td class="td-data jx-brand-bold" data-css-w="${columnWidths.story}px">🔷 Task</td>`;
    }
    cellsHtml = html`${cellsHtml}
    <td class="td-data td-task-summary" data-css-w="${colWidth("task")}px">
      <div class="jx-create-row">
        <input type="text" class="inline-create-input" placeholder="Type new task summary & press Enter to save..." autocomplete="off" />
        <button class="btn-inline-save">Add</button>
        <button class="btn-inline-cancel" title="Cancel (Esc)">✕</button>
      </div>
    </td>
  `;
    if (visibleKeys.includes("resource")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-resource-cell" data-css-w="${columnWidths.resource}px">
        <div class="resource-chip-btn new-task-resource-btn" title="Assign team member">
          <span class="resource-option-avatar">U</span>
          <span class="new-task-resource-name jx-ellipsis">Unassigned</span>
          <span class="jx-caret">▾</span>
        </div>
      </td>
    `;
    }
    if (visibleKeys.includes("effort")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-effort-cell jx-center" data-css-w="${columnWidths.effort}px">
        <input type="number" class="inline-edit-input new-task-hours jx-hours-input" placeholder="h" min="0" />
      </td>
    `;
    }
    if (visibleKeys.includes("progress")) {
      cellsHtml = html`${cellsHtml}<td class="td-data jx-center-subtle" data-css-w="${columnWidths.progress}px">0%</td>`;
    }
    if (visibleKeys.includes("target")) {
      cellsHtml = html`${cellsHtml}<td class="td-data jx-center-subtle" data-css-w="${columnWidths.target}px">0%</td>`;
    }
    if (visibleKeys.includes("status")) {
      cellsHtml = html`${cellsHtml}<td class="td-data jx-center" data-css-w="${columnWidths.status}px"><span class="badge badge-neutral">NOT_STARTED</span></td>`;
    }
    cellsHtml = html`${cellsHtml}
    <td class="timeline-track-cell">
      <div class="ghost-timeline-bar" data-css-left="${barLeft}px" data-css-w="${barWidth}px">
        <span>➕ New Task Preview (3 wks)</span>
      </div>
    </td>
  `;
    creationTr.innerHTML = html`${cellsHtml}`;
    applyFrozen(creationTr);
    rowElement.after(creationTr);
    updateVirtualRows();
    let selectedResource = "Unassigned";
    let selectedAccountId = void 0;
    let selectedEpic = inheritedEpic;
    let selectedEpicKey = inheritedEpicKey;
    const input = creationTr.querySelector(".inline-create-input");
    const saveBtn = creationTr.querySelector(".btn-inline-save");
    const cancelBtn = creationTr.querySelector(".btn-inline-cancel");
    const resBtn = creationTr.querySelector(".new-task-resource-btn");
    const epicBtn = creationTr.querySelector(".new-task-epic-chip");
    const hoursInput = creationTr.querySelector(".new-task-hours");
    setTimeout(() => input.focus(), 50);
    function cancelCreation() {
      creationTr.remove();
      updateVirtualRows();
    }
    cancelBtn.addEventListener("click", cancelCreation);
    if (epicBtn) {
      epicBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEpicPicker(epicBtn, "NEW_INLINE_TASK");
        window.__onEpicSelectedForDraft = (epSummary, epKey) => {
          selectedEpic = epSummary;
          selectedEpicKey = epKey;
          epicBtn.textContent = epSummary ? `\u{1F7EA} ${epSummary} \u25BE` : "+ Link Epic";
          epicBtn.className = `epic-link-chip new-task-epic-chip ${epSummary ? "has-epic" : "no-epic"}`;
        };
      });
    }
    if (resBtn) {
      resBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openResourcePicker(resBtn, "NEW_INLINE_TASK");
        window.__onResourceSelectedForDraft = (displayName, accountId) => {
          selectedResource = displayName;
          selectedAccountId = accountId;
          const avatar = resBtn.querySelector(".resource-option-avatar");
          const nameEl = resBtn.querySelector(".new-task-resource-name");
          if (avatar) avatar.textContent = getInitials(displayName);
          if (nameEl) nameEl.textContent = displayName;
        };
      });
    }
    let isSubmitting = false;
    async function submitNewTask() {
      if (isSubmitting) return;
      const summary = input.value.trim();
      if (!summary) {
        input.style.borderColor = "var(--cp-border-danger)";
        input.focus();
        return;
      }
      isSubmitting = true;
      input.disabled = true;
      saveBtn.disabled = true;
      saveBtn.textContent = "Adding...";
      const parsedHours = parseInt(hoursInput.value, 10);
      const hours = isNaN(parsedHours) ? void 0 : parsedHours;
      try {
        const res = await callResolver2("createInlineTask", {
          summary,
          epic: selectedEpic || void 0,
          epicKey: selectedEpicKey || void 0,
          parentKey: selectedEpicKey || void 0,
          resource: selectedResource,
          resourceAccountId: selectedAccountId,
          assigneeAccountId: selectedAccountId || void 0,
          effortHours: hours,
          startWeek: defaultStartWk,
          spanWeeks: 3,
          targetIndex: insertIndex
        });
        if (!res || res.ok !== true) {
          showFlag({ text: res && (res.message || res.error) || "Failed to create task in Jira.", error: true });
          input.disabled = false;
          saveBtn.disabled = false;
          saveBtn.textContent = "Add";
          isSubmitting = false;
          return;
        }
        if (res && res.task) {
          expandAncestors(res.task);
          registerOptimisticTask(res.task);
        }
        if (currentHierarchyView === "epics") {
          currentHierarchyView = "all";
          const hierSwitcher = document.getElementById("hierarchySwitcher");
          if (hierSwitcher) hierSwitcher.value = "all";
        }
        if (res && res.plan && Array.isArray(res.plan.tasks)) {
          mergeOptimisticTasks(res.plan);
          currentPlan = res.plan;
          renderPlan();
        } else if (res && res.task && currentPlan && Array.isArray(currentPlan.tasks)) {
          if (!currentPlan.tasks.some((t) => t.key === res.task.key)) {
            currentPlan.tasks.splice(insertIndex, 0, res.task);
          }
          renderPlan();
        } else {
          await loadProjectPlan();
        }
        if (res?.task?.key) {
          setTimeout(() => {
            scrollRowIntoView(res.task.key);
          }, 120);
        }
        showFlag({ text: "Task " + (res?.task?.key || "") + " created and scheduled." });
      } catch (err) {
        showFlag({ text: err?.message || "Error creating task.", error: true });
        input.disabled = false;
        saveBtn.disabled = false;
        saveBtn.textContent = "Add";
        isSubmitting = false;
      }
    }
    saveBtn.addEventListener("click", submitNewTask);
    input.addEventListener("keydown", (ke) => {
      if (ke.key === "Enter") {
        ke.preventDefault();
        submitNewTask();
      } else if (ke.key === "Escape") {
        cancelCreation();
      }
    });
  }
  var ROW_BUFFER = 10;
  var timeline = null;
  var rowTasks = [];
  var rowTaskList = [];
  var rowCache = /* @__PURE__ */ new Map();
  var renderedRange = { first: 0, last: -1 };
  var layout = { trackLeft: 0, headerH: 0, bodyStart: 0, inlineAfter: -1, inlineH: 0 };
  var topDropRowEl = null;
  var topSpacer = null;
  var bottomSpacer = null;
  function todayIso() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function findTask(key) {
    return (currentPlan?.tasks || []).find((t) => t.key === key);
  }
  function originIso() {
    return timeRange ? timeRange.start : todayIso();
  }
  function rowTop(i) {
    return layout.bodyStart + i * ROW_H + (layout.inlineAfter >= 0 && i > layout.inlineAfter ? layout.inlineH : 0);
  }
  function measureLayout() {
    const table = document.getElementById("ganttTable");
    layout.headerH = table && table.tHead ? table.tHead.offsetHeight : 0;
    const visibleKeys = getVisibleColKeys();
    const frozenWidth = visibleKeys.reduce((sum, k) => sum + colWidth(k), 0);
    layout.trackLeft = frozenWidth;
    layout.bodyStart = topDropRowEl ? table.offsetTop + topDropRowEl.offsetTop + topDropRowEl.offsetHeight : 0;
    const inline = document.querySelector(".inline-creation-row");
    layout.inlineAfter = -1;
    layout.inlineH = 0;
    if (inline && inline.previousElementSibling) {
      const k = inline.previousElementSibling.dataset.taskId;
      layout.inlineAfter = rowTasks.findIndex((r) => r.task.key === k);
      layout.inlineH = inline.offsetHeight;
    }
  }
  var gridCache = { key: "", xs: [] };
  function gridXBetween(fromX, toX) {
    const key = `${timeRange.start}|${timeRange.end}|${zoomId}`;
    if (gridCache.key !== key) gridCache = { key, xs: gridLines(timeRange, zoomById(zoomId), -Infinity, Infinity) };
    return gridCache.xs.filter((x) => x >= fromX && x <= toX);
  }
  function drawTimeline(sync) {
    if (!timeline || !currentPlan) return;
    const activeSearchKey = currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length ? searchMatches[currentSearchMatchPos].task.key : null;
    timeline.activeKey = hoveredTaskId || pinnedDependencyTaskId || activeSearchKey;
    timeline.setModel({
      tasks: rowTaskList,
      first: renderedRange.first,
      last: renderedRange.last,
      rowTop,
      originIso: originIso(),
      dayPx: dayPx(),
      trackLeft: layout.trackLeft,
      trackWidth: trackWidth(),
      headerH: layout.headerH,
      todayIso: todayIso(),
      gridX: gridXBetween
    });
    if (sync) timeline.draw();
    else timeline.requestDraw();
  }
  function computeRowTasks() {
    let tasksToRender = currentPlan.tasks;
    if (currentHierarchyView === "epics") {
      tasksToRender = currentPlan.tasks.filter((t) => t.isEpic || t.hierarchyLevel === 1);
    } else if (currentHierarchyView === "stories") {
      tasksToRender = currentPlan.tasks.filter((t) => !t.isEpic && t.hierarchyLevel !== 1);
    }
    rowParentKeys = parentKeysOf(tasksToRender);
    return { rows: visibleRows(tasksToRender, collapsedTasks), total: tasksToRender.length };
  }
  var rowParentKeys = /* @__PURE__ */ new Set();
  function makeSpacer(cols) {
    const tr = document.createElement("tr");
    tr.className = "spacer-row";
    tr.setAttribute("aria-hidden", "true");
    const td = document.createElement("td");
    td.colSpan = cols;
    tr.appendChild(td);
    return tr;
  }
  function renderTimelineRows() {
    if (globalThis.__cpPerf) performance.mark("cp:rows:start");
    const tbody = document.getElementById("ganttBody");
    tbody.innerHTML = "";
    rowCache = /* @__PURE__ */ new Map();
    rowTasks = [];
    rowTaskList = [];
    renderedRange = { first: 0, last: -1 };
    topDropRowEl = topSpacer = bottomSpacer = null;
    if (gridRoot) gridRoot.replaceChildren();
    const cols = getVisibleColKeys().length + 1;
    if (!currentPlan.tasks || currentPlan.tasks.length === 0) {
      const es = emptyState(currentPlan);
      tbody.innerHTML = html`<tr><td colspan="${cols}" class="empty-state-cell">
      <div class="empty-state" id="emptyStateDropZone" role="region" aria-labelledby="emptyStateTitle">
        <h2 id="emptyStateTitle">${es.title}</h2>
        <p>${es.text}</p>
        <div class="empty-state-drop-hint jx-drop-hint">
          📥 Drop backlog issues here to schedule, or click below
        </div>
        <div class="empty-state-actions">
          <button class="btn btn-primary" id="emptyStateAction" type="button" data-action="${es.action.id}">${es.action.label}</button>
          <button class="btn btn-link help-link" id="emptyStateHelp" type="button">How CascadePlan works</button>
        </div>
      </div></td></tr>`;
      tbody.querySelector("#emptyStateAction").addEventListener("click", (e) => {
        if (e.currentTarget.dataset.action === "schedule") {
          document.getElementById("backlogTray").classList.remove("collapsed");
          document.querySelector(".backlog-card")?.focus();
        } else {
          openCreateTaskModal();
        }
      });
      tbody.querySelector("#emptyStateHelp").addEventListener("click", openHelp);
      const dropZone = tbody.querySelector("#emptyStateDropZone");
      if (dropZone) {
        dropZone.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          dropZone.classList.add("drop-active");
        });
        dropZone.addEventListener("dragleave", (e) => {
          if (!dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove("drop-active");
          }
        });
        dropZone.addEventListener("drop", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("drop-active");
          document.body.classList.remove("is-dragging-backlog");
          const dataStr = e.dataTransfer.getData("text/plain");
          if (!dataStr) return;
          try {
            const data = JSON.parse(dataStr);
            if (data && data.taskId) {
              const res = await callResolver2("scheduleBacklogTask", {
                taskId: data.taskId,
                startWeek: "",
                startDate: todayIso(),
                spanWeeks: 3,
                targetIndex: 0
              });
              if (res && Array.isArray(res.tasks)) {
                currentPlan = res;
                renderPlan();
              } else {
                await loadProjectPlan();
              }
              if (res && res.ok === true) showFlag({ text: "Scheduled " + data.taskId + " to timeline." });
            }
          } catch (err) {
            console.error("Error handling empty state drop:", err);
          }
        });
      }
      drawTimeline();
      return;
    }
    topDropRowEl = document.createElement("tr");
    topDropRowEl.className = "drop-target-row";
    topDropRowEl.innerHTML = html`<td colspan="${cols}"><span class="drop-target-label">+ Drop here to place task at top of schedule</span></td>`;
    setupDropTargetRow(topDropRowEl, 0);
    tbody.appendChild(topDropRowEl);
    const computed = computeRowTasks();
    rowTasks = computed.rows;
    rowTaskList = rowTasks.map((r) => r.task);
    topSpacer = makeSpacer(cols);
    bottomSpacer = makeSpacer(cols);
    tbody.appendChild(topSpacer);
    tbody.appendChild(bottomSpacer);
    const btmDropRow = document.createElement("tr");
    btmDropRow.className = "drop-target-row";
    btmDropRow.innerHTML = html`<td colspan="${cols}"><span class="drop-target-label">+ Drop here to place task at bottom of schedule</span></td>`;
    setupDropTargetRow(btmDropRow, computed.total);
    tbody.appendChild(btmDropRow);
    updateVirtualRows();
    if (globalThis.__cpPerf) performance.measure("cp:rows", "cp:rows:start");
  }
  function removeRow(tr) {
    if (!tr) return;
    const next = tr.nextElementSibling;
    if (next && next.classList.contains("inline-creation-row")) next.remove();
    tr.remove();
  }
  function updateVirtualRows() {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper || !topSpacer) {
      drawTimeline(true);
      return;
    }
    measureLayout();
    const offset = Math.max(0, wrapper.scrollTop + layout.headerH - layout.bodyStart);
    const next = visibleRange(offset, Math.max(ROW_H, wrapper.clientHeight - layout.headerH), ROW_H, rowTasks.length, ROW_BUFFER);
    const prev = renderedRange;
    if (next.first !== prev.first || next.last !== prev.last) {
      for (let i = prev.first; i <= prev.last; i++) {
        if (i < next.first || i > next.last) removeRow(rowCache.get(rowTasks[i].task.key));
      }
      let cursor = topSpacer;
      for (let i = next.first; i <= next.last; i++) {
        const { task, rowIdx } = rowTasks[i];
        let tr = rowCache.get(task.key);
        if (!tr) {
          tr = buildTaskRow(task, rowIdx);
          rowCache.set(task.key, tr);
        }
        if (!tr.isConnected) cursor.after(tr);
        cursor = tr;
        const after = tr.nextElementSibling;
        if (after && after.classList.contains("inline-creation-row")) cursor = after;
      }
      topSpacer.firstChild.style.height = next.first * ROW_H + "px";
      bottomSpacer.firstChild.style.height = Math.max(0, rowTasks.length - 1 - next.last) * ROW_H + "px";
      renderedRange = next;
      measureLayout();
      renderGrid();
    }
    drawTimeline(true);
  }
  var virtualFrame = 0;
  function scheduleVirtualRows() {
    if (virtualFrame) return;
    virtualFrame = requestAnimationFrame(() => {
      virtualFrame = 0;
      maybeExtendRange();
      updateVirtualRows();
    });
  }
  function scrollRowIntoView(key) {
    const wrapper = document.getElementById("ganttWrapper");
    const i = rowTasks.findIndex((r) => r.task.key === key);
    if (!wrapper || i < 0) return null;
    wrapper.scrollTop = Math.max(0, rowTop(i) - layout.headerH - (wrapper.clientHeight - layout.headerH) / 2);
    updateVirtualRows();
    return rowCache.get(key) || null;
  }
  var baselineState = null;
  function updateBaselineButton() {
    const btn = document.getElementById("btnBaseline");
    if (!btn || !baselineState || !currentPlan) return;
    const report = baselineState.ok ? { ok: true, baseline: baselineState.baseline, intact: baselineState.intact, comparison: compareItems(baselineState.items || [], baselineItems(currentPlan.tasks || [])) } : { ok: false };
    btn.textContent = statusText(report);
    btn.classList.toggle("is-warning", !!(report.ok && (report.comparison.grew || !report.intact)));
  }
  function applyPlanInPlace(plan) {
    const before = rowTaskList.map((t) => t.key).join("\n");
    currentPlan = plan;
    updateBaselineButton();
    const computed = computeRowTasks();
    if (computed.rows.map((r) => r.task.key).join("\n") !== before) {
      renderPlan();
      settleUndo();
      return;
    }
    rowTasks = computed.rows;
    rowTaskList = rowTasks.map((r) => r.task);
    renderPlanSummary();
    renderGrid();
    const byKey = new Map(rowTaskList.map((t) => [t.key, t]));
    for (const [key, tr] of rowCache) {
      const hit = tr.querySelector(".bar-hit");
      if (hit && byKey.has(key)) positionBarHit(hit, byKey.get(key));
    }
    drawTimeline(true);
    if (currentView === "table") {
      renderTableView();
    }
    settleUndo();
  }
  function applyFrozen(tr) {
    applyDynamicStyles(tr);
    const frozen = getFrozenLayout();
    const keys = frozen.visibleKeys;
    const cells = [...tr.children].filter((td) => !td.classList.contains("timeline-track-cell"));
    if (cells.length !== keys.length) return;
    cells.forEach((td, i) => {
      const k = keys[i];
      const w = frozen.widths[k];
      td.classList.add("td-frozen");
      td.classList.toggle("is-last-frozen", k === frozen.lastKey);
      td.style.width = w + "px";
      td.style.minWidth = w + "px";
      td.style.maxWidth = w + "px";
      td.style.left = frozen.offsets[k] + "px";
    });
  }
  function openRowMoreMenu(anchorBtn, task, rowIdx, tr) {
    let menu = document.getElementById("rowMoreMenu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "rowMoreMenu";
      menu.className = "quick-menu-popover row-more-menu-popover";
      document.body.appendChild(menu);
    }
    menu.innerHTML = html`
    <div class="menu-item-header jx-menu-header">
      ${task.key}: ${task.summary}
    </div>
    <button class="quick-menu-item" data-action="insert"><span>➕</span><span>Insert task below</span></button>
    <button class="quick-menu-item" data-action="subtask"><span>↳</span><span>Add subtask</span></button>
    <button class="quick-menu-item" data-action="progress"><span>📈</span><span>Set actual progress (${task.progress}%)</span></button>
    <button class="quick-menu-item" data-action="why"><span>❓</span><span>Why this date?</span></button>
    <button class="quick-menu-item" data-action="team"><span>👥</span><span>Assign team member</span></button>
    <button class="quick-menu-item" data-action="edit"><span>✏️</span><span>Edit task details</span></button>
    <button class="quick-menu-item" data-action="jira"><span>↗</span><span>Open in native Jira</span></button>
    <div class="jx-menu-divider"></div>
    <button class="quick-menu-item item-danger" data-action="backlog"><span>📤</span><span>Move to backlog</span></button>
  `;
    const rect = anchorBtn.getBoundingClientRect();
    menu.style.display = "flex";
    menu.style.position = "fixed";
    menu.style.background = "var(--cp-surface-overlay)";
    menu.style.zIndex = "2500";
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.min(window.innerWidth - 225, Math.max(10, rect.left - 80))}px`;
    menu.onclick = async (e) => {
      const item = e.target.closest(".quick-menu-item");
      if (!item) return;
      const action = item.dataset.action;
      menu.style.display = "none";
      if (action === "insert") openInlineCreationRow(tr, task, rowIdx);
      else if (action === "subtask") {
        openTaskDetailModal(task.key);
        setTimeout(() => {
          document.getElementById("newSubtaskSummaryInput")?.focus();
        }, 100);
      } else if (action === "progress") openProgressPicker(anchorBtn, task.key);
      else if (action === "why") showWhy(task.key, anchorBtn.getBoundingClientRect());
      else if (action === "team") {
        openTaskDetailModal(task.key);
        setTimeout(() => {
          document.getElementById("multiResourceSelect")?.focus();
        }, 100);
      } else if (action === "edit") openTaskDetailModal(task.key);
      else if (action === "jira") openJiraIssueInNewTab(task.key, e);
      else if (action === "backlog") {
        await callResolver2("unscheduleTask", { taskId: task.key });
        await loadProjectPlan();
      }
    };
    const closeListener = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== anchorBtn) {
        menu.style.display = "none";
        window.removeEventListener("click", closeListener, true);
      }
    };
    setTimeout(() => window.addEventListener("click", closeListener, true), 20);
  }
  function buildTaskRow(task, rowIdx) {
    const isEpic = Boolean(task.isEpic || task.hierarchyLevel === 1);
    const isSub = Boolean(task.isSubtask || task.hierarchyLevel === -1);
    const tr = document.createElement("tr");
    tr.className = "task-row" + (isEpic ? " is-epic-row" : isSub ? " is-subtask" : " is-story-row");
    tr.dataset.taskId = task.key;
    tr.addEventListener("mouseenter", () => {
      tr.classList.add("is-hovered");
    });
    tr.addEventListener("mouseleave", () => {
      tr.classList.remove("is-hovered");
    });
    if (searchMatches && searchMatches.length > 0) {
      const isMatch = searchMatches.some((m) => m.task.key === task.key);
      if (isMatch) {
        tr.classList.add("is-search-match");
        const activeKey = currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length ? searchMatches[currentSearchMatchPos].task.key : null;
        if (activeKey === task.key) tr.classList.add("is-search-active");
      }
    }
    const hasChildren = rowParentKeys.has(task.key);
    let expandToggleHtml = html``;
    if (hasChildren) {
      const isExp = !collapsedTasks.has(task.key);
      expandToggleHtml = html`<button class="tree-toggle-btn" type="button" data-parent-key="${task.key}" aria-expanded="${isExp ? "true" : "false"}" aria-label="${isExp ? "Collapse" : "Expand"} children of ${task.key}" title="${isExp ? "Collapse children" : "Expand children"}">${isExp ? "\u25BC" : "\u25B6"}</button>`;
    }
    let badgeHtml = html``;
    let indentPx = 0;
    if (isEpic) {
      badgeHtml = html`<span class="epic-badge" title="Epic Roadmap Level">🟪 EPIC</span>`;
      indentPx = 0;
    } else if (isSub) {
      badgeHtml = html`<span class="subtask-tree-icon" title="Subtask Execution Level">↳</span>`;
      indentPx = 28;
    } else {
      badgeHtml = html`<span class="story-badge" title="Story / Task Plan Level">🔷</span>`;
      if (task.epicKey && currentPlan.tasks.some((t) => t.key === task.epicKey && t.key !== task.key)) {
        indentPx = 16;
      }
    }
    const siteUrl = getJiraBaseUrl();
    const summaryHtml = html`
    <div class="jx-summary-row" data-css-pl="${indentPx}px">
      <div class="row-insert-affordance" title="Insert task below (Row ${rowIdx + 2})">
        <button class="row-insert-plus-btn" title="Insert new task below">＋</button>
      </div>
      <span class="row-drag-handle" title="Drag handle or press and hold row to reorder">⠿</span>
      ${expandToggleHtml}
      ${badgeHtml}
      <a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" class="task-key-link" title="Open ${task.key} in native Jira (new tab)">${task.key} ↗</a>
      <span class="task-summary-text jx-summary-text" title="Click to edit summary, or press and hold row to reorder">
        : ${task.summary}
      </span>
      <div class="row-action-toolbar" role="toolbar" aria-label="Row actions for ${task.key}">
        <button class="row-action-btn quick-insert-below-btn" title="Insert task below (Row ${rowIdx + 2})" aria-label="Insert task below">➕</button>
        <button class="row-action-btn edit-modal-btn" title="Open full detail modal" aria-label="Open task details">✏️</button>
        <button class="row-action-btn why-date-btn" title="Why this date?" aria-label="Why this date?">❓</button>
        <button class="row-action-btn row-more-actions-btn" title="More task actions (Subtask, Progress, Team, Jira, Backlog)" aria-label="More actions">•••</button>
      </div>
    </div>
  `;
    let epicHtml = html``;
    if (isEpic) {
      epicHtml = html`<span class="epic-badge" title="Epic Roadmap Level">🟪 EPIC</span>`;
    } else {
      let epicLabel = task.epic || "";
      if (!epicLabel && task.epicKey) {
        const epObj = (currentPlan.availableEpics || []).find((e) => e.key === task.epicKey);
        epicLabel = epObj ? epObj.summary : task.epicKey;
      }
      if (task.isSubtask || task.hierarchyLevel === -1) {
        epicHtml = epicLabel ? html`<span class="epic-inherited" title="Epic of the parent work item">🟪 ${epicLabel}</span>` : html``;
      } else if (epicLabel) {
        epicHtml = html`<span class="epic-link-chip has-epic" title="Click to change epic">🟪 ${epicLabel} ▾</span>`;
      } else {
        epicHtml = html`<span class="epic-link-chip no-epic" title="Click to link epic">+ Link Epic</span>`;
      }
    }
    const visibleKeys = getVisibleColKeys();
    let rowColsHtml = html``;
    if (visibleKeys.includes("epic")) {
      rowColsHtml = html`${rowColsHtml}<td class="td-data td-epic-cell" data-css-w="${columnWidths.epic}px">${epicHtml}</td>`;
    }
    if (visibleKeys.includes("story")) {
      rowColsHtml = html`${rowColsHtml}<td class="td-data td-story-cell" data-css-w="${columnWidths.story}px" title="${task.story || ""}">${task.story || (isEpic ? "Epic" : isSub ? "Subtask" : "Task")}</td>`;
    }
    if (visibleKeys.includes("task")) {
      rowColsHtml = html`${rowColsHtml}<td class="td-data td-task-summary" data-css-w="${colWidth("task")}px">${summaryHtml}</td>`;
    }
    if (visibleKeys.includes("resource")) {
      rowColsHtml = html`${rowColsHtml}<td class="td-data td-resource-cell" data-css-w="${columnWidths.resource}px"></td>`;
    }
    if (visibleKeys.includes("effort")) {
      rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-effort-cell jx-center-pointer" data-css-w="${columnWidths.effort}px" title="Click to edit effort hours">
        <span class="effort-text jx-bold">${formatEffort(task.effortHours)}</span>
      </td>
    `;
    }
    if (visibleKeys.includes("progress")) {
      const isProgRollup = isEpic || task.childrenCount && task.childrenCount > 0;
      const lockText = progressLockReason(task);
      const progTitle = lockText || (isProgRollup ? `Actual progress: ${progressText(task)} (Rollup from children: click to edit or override)` : `Click to set actual progress (${progressText(task)})`);
      rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-progress-cell jx-center-pointer" data-css-w="${columnWidths.progress}px" title="${progTitle}">
        <div class="progress-chip-cell ${isDone(task.status) ? "is-complete" : task.progress > 0 ? "is-active" : "is-zero"}">
          <span class="progress-chip-fill" data-css-w="${task.progress}%"></span>
          <span class="progress-chip-text">${task.progress}% ▾</span>
        </div>
      </td>
    `;
    }
    if (visibleKeys.includes("target")) {
      rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-target-cell jx-center-pointer" data-css-w="${columnWidths.target}px" title="Click to set target progress (${task.targetProgress}%)">
        <div class="target-chip-cell">
          <span class="target-chip-text">🎯 ${task.targetProgress}% ▾</span>
        </div>
      </td>
    `;
    }
    if (visibleKeys.includes("status")) {
      rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-status-cell jx-center" data-css-w="${columnWidths.status}px">
        <span class="badge editable-badge-chip ${task.status === "COMPLETED" ? "badge-success" : task.status === "IN_PROGRESS" ? "badge-primary" : "badge-neutral"}" title="Click to change status">
          ${task.status} ▾
        </span>
      </td>
    `;
    }
    tr.innerHTML = html`${rowColsHtml}`;
    applyFrozen(tr);
    if (selectedKeys.has(task.key)) tr.classList.add("is-selected");
    tr.addEventListener("click", (e) => {
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
      e.preventDefault();
      e.stopPropagation();
      selectRow(task.key, e);
    }, true);
    if (visibleKeys.includes("resource")) {
      const resourceTd = tr.querySelector(".td-resource-cell");
      if (resourceTd) {
        const contributing = getTaskContributingResources(task);
        let avatarHtml = html``;
        let labelText = "";
        let titleText = "";
        let isMultiple = false;
        if (contributing.length === 0) {
          avatarHtml = html`<span class="resource-option-avatar">U</span>`;
          labelText = "Unassigned";
          titleText = "Unassigned. Click to assign team member.";
        } else if (contributing.length === 1) {
          const res = contributing[0];
          const initials = getInitials(res.name);
          avatarHtml = html`<span class="resource-option-avatar">${initials}</span>`;
          labelText = res.name;
          if (res.isParent) {
            titleText = `${res.name} (Task Assignee)`;
          } else {
            titleText = `${res.name} (Assigned via subtask: ${res.subtasks.join(", ") || "subtask"})`;
            labelText = html`${labelText} <span class="resource-via-subtask-label">(subtask)</span>`;
          }
        } else {
          isMultiple = true;
          const maxAvatars = 3;
          avatarHtml = html`<div class="avatar-stack">`;
          contributing.slice(0, maxAvatars).forEach((res, aIdx) => {
            const initials = getInitials(res.name);
            const bg = aIdx === 0 ? "var(--cp-bg-neutral)" : aIdx === 1 ? "var(--cp-bg-selected)" : "var(--cp-bg-discovery)";
            const color = aIdx === 0 ? "var(--cp-text)" : aIdx === 1 ? "var(--cp-text-brand)" : "var(--cp-text-discovery)";
            avatarHtml = html`${avatarHtml}<span class="resource-option-avatar jx-avatar-${aIdx + 1}" title="${res.name}">${initials}</span>`;
          });
          avatarHtml = html`${avatarHtml}</div>`;
          const names = contributing.map((c) => c.name);
          if (contributing.length === 2) {
            labelText = `${names[0]}, ${names[1]}`;
          } else {
            labelText = `${names[0]}, ${names[1]} +${contributing.length - 2}`;
          }
          const breakdownLines = contributing.map((c) => {
            if (c.isParent && c.subtasks.length > 0) {
              return `\u2022 ${c.name} (Lead & subtasks: ${c.subtasks.join(", ")})`;
            } else if (c.isParent) {
              return `\u2022 ${c.name} (Lead / Parent Assignee)`;
            } else {
              return `\u2022 ${c.name} (Subtask: ${c.subtasks.join(", ") || "subtask"})`;
            }
          });
          titleText = `Assigned Resources (${contributing.length}):
` + breakdownLines.join("\n") + `
Click to manage or assign.`;
        }
        resourceTd.innerHTML = html`
        <div class="resource-chip-btn ${isMultiple ? "has-multiple-resources" : ""}" title="${titleText}">
          ${avatarHtml}
          <span class="resource-names-wrap jx-ellipsis-fill">${labelText}</span>
          ${isMultiple ? html`<span class="res-count-badge">${contributing.length}</span>` : ""}
          <span class="jx-caret">▾</span>
        </div>
      `;
        const resChip = resourceTd.querySelector(".resource-chip-btn");
        if (resChip) {
          resChip.addEventListener("click", (e) => {
            e.stopPropagation();
            openResourcePicker(resChip, task.key);
          });
        }
      }
    }
    const sumText = tr.querySelector(".task-summary-text");
    if (sumText) {
      sumText.addEventListener("click", (e) => {
        e.stopPropagation();
        if (tr.querySelector(".inline-edit-input")) return;
        const origSummary = task.summary;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "inline-edit-input";
        input.value = origSummary;
        sumText.replaceWith(input);
        input.focus();
        input.select();
        let saved = false;
        async function saveInlineSummary() {
          if (saved) return;
          saved = true;
          const newSummary = input.value.trim();
          if (newSummary && newSummary !== origSummary) {
            task.summary = newSummary;
            await callResolver2("updateWbsTask", {
              taskId: task.key,
              updates: { summary: newSummary }
            });
            await loadProjectPlan();
          } else {
            input.replaceWith(sumText);
          }
        }
        input.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") {
            ke.preventDefault();
            saveInlineSummary();
          } else if (ke.key === "Escape") {
            saved = true;
            input.replaceWith(sumText);
          }
        });
        input.addEventListener("blur", saveInlineSummary);
      });
    }
    const effortTd = tr.querySelector(".td-effort-cell");
    if (effortTd) {
      effortTd.addEventListener("click", (e) => {
        e.stopPropagation();
        if (effortTd.querySelector(".inline-edit-input")) return;
        const origHours = task.effortHours || 0;
        const input = document.createElement("input");
        input.type = "number";
        input.className = "inline-edit-input";
        input.style.width = "55px";
        input.style.textAlign = "center";
        input.min = "0";
        input.value = origHours;
        effortTd.innerHTML = "";
        effortTd.appendChild(input);
        input.focus();
        input.select();
        let saved = false;
        async function saveInlineEffort() {
          if (saved) return;
          saved = true;
          const val = parseInt(input.value, 10);
          if (!isNaN(val) && val >= 0 && val !== origHours) {
            task.effortHours = val;
            await callResolver2("updateWbsTask", {
              taskId: task.key,
              updates: { effortHours: val }
            });
            await loadProjectPlan();
          } else {
            effortTd.innerHTML = html`<span class="effort-text jx-bold">${formatEffort(origHours)}</span>`;
          }
        }
        input.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") {
            ke.preventDefault();
            saveInlineEffort();
          } else if (ke.key === "Escape") {
            saved = true;
            effortTd.innerHTML = html`<span class="effort-text jx-bold">${formatEffort(origHours)}</span>`;
          }
        });
        input.addEventListener("blur", saveInlineEffort);
      });
    }
    const progTd = tr.querySelector(".td-progress-cell");
    if (progTd) {
      progTd.addEventListener("click", (e) => {
        e.stopPropagation();
        openProgressPicker(progTd, task.key);
      });
    }
    const targetTd = tr.querySelector(".td-target-cell");
    if (targetTd) {
      targetTd.addEventListener("click", (e) => {
        e.stopPropagation();
        openTargetPicker(targetTd, task.key);
      });
    }
    const statusChip = tr.querySelector(".editable-badge-chip");
    if (statusChip) {
      statusChip.addEventListener("click", (e) => {
        e.stopPropagation();
        openStatusPicker(statusChip, task.key);
      });
    }
    const epicChip = tr.querySelector(".epic-link-chip");
    if (epicChip) {
      epicChip.addEventListener("click", (e) => {
        e.stopPropagation();
        openEpicPicker(epicChip, task.key);
      });
    }
    const quickInsertBtn = tr.querySelector(".quick-insert-below-btn");
    if (quickInsertBtn) {
      quickInsertBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openInlineCreationRow(tr, task, rowIdx);
      });
    }
    const rowPlusBtn = tr.querySelector(".row-insert-plus-btn");
    if (rowPlusBtn) {
      rowPlusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openInlineCreationRow(tr, task, rowIdx);
      });
    }
    const quickProgBtn = tr.querySelector(".quick-progress-btn");
    if (quickProgBtn) {
      quickProgBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openProgressPicker(quickProgBtn, task.key);
      });
    }
    const editModalBtn = tr.querySelector(".edit-modal-btn");
    if (editModalBtn) {
      editModalBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTaskDetailModal(task.key);
      });
    }
    const whyBtn = tr.querySelector(".why-date-btn");
    if (whyBtn) {
      whyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showWhy(task.key, whyBtn.getBoundingClientRect());
      });
    }
    const rowMoreBtn = tr.querySelector(".row-more-actions-btn");
    if (rowMoreBtn) {
      rowMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRowMoreMenu(rowMoreBtn, task, rowIdx, tr);
      });
    }
    const quickSubBtn = tr.querySelector(".quick-subtask-btn");
    if (quickSubBtn) {
      quickSubBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTaskDetailModal(task.key);
        setTimeout(() => {
          const inp = document.getElementById("newSubtaskSummaryInput");
          if (inp) {
            inp.focus();
            inp.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      });
    }
    const quickResBtn = tr.querySelector(".quick-resource-btn");
    if (quickResBtn) {
      quickResBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTaskDetailModal(task.key);
        setTimeout(() => {
          const sel = document.getElementById("multiResourceSelect");
          if (sel) {
            sel.focus();
            sel.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      });
    }
    const unschedBtn = tr.querySelector(".unschedule-row-btn");
    if (unschedBtn) {
      unschedBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await callResolver2("unscheduleTask", { taskId: task.key });
        await loadProjectPlan();
      });
    }
    const openJiraBtn = tr.querySelector(".open-jira-row-btn");
    if (openJiraBtn) {
      openJiraBtn.addEventListener("click", (e) => {
        openJiraIssueInNewTab(task.key, e);
      });
    }
    const taskKeyLink = tr.querySelector(".task-key-link");
    if (taskKeyLink) {
      taskKeyLink.addEventListener("click", (e) => {
        openJiraIssueInNewTab(task.key, e);
      });
    }
    const treeToggle = tr.querySelector(".tree-toggle-btn");
    if (treeToggle) {
      treeToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (collapsedTasks.has(task.key)) {
          collapsedTasks.delete(task.key);
        } else {
          collapsedTasks.add(task.key);
        }
        renderTimelineRows();
        document.querySelector(`.tree-toggle-btn[data-parent-key="${CSS.escape(task.key)}"]`)?.focus();
      });
    }
    setupRowPointerReorder(tr, task);
    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      const rect = tr.getBoundingClientRect();
      const isTop = e.clientY - rect.top < rect.height / 2;
      if (isTop) {
        tr.classList.add("drop-insert-top");
        tr.classList.remove("drop-insert-bottom");
      } else {
        tr.classList.add("drop-insert-bottom");
        tr.classList.remove("drop-insert-top");
      }
    });
    tr.addEventListener("dragleave", (e) => {
      if (!tr.contains(e.relatedTarget)) {
        tr.classList.remove("drop-insert-top");
        tr.classList.remove("drop-insert-bottom");
      }
    });
    tr.addEventListener("drop", async (e) => {
      e.preventDefault();
      document.body.classList.remove("is-dragging-backlog");
      const rect = tr.getBoundingClientRect();
      const isTop = e.clientY - rect.top < rect.height / 2;
      tr.classList.remove("drop-insert-top");
      tr.classList.remove("drop-insert-bottom");
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      try {
        const data = JSON.parse(dataStr);
        const entry = rowTasks.find((r) => r.task.key === task.key);
        const baseIdx = entry ? entry.rowIdx : rowIdx;
        const targetIndex = isTop ? baseIdx : baseIdx + 1;
        if (data.fromReorder) {
          await callResolver2("reorderWbsTasks", { taskId: data.taskId, targetIndex });
        } else if (data.taskId) {
          const curWk = (currentPlan?.weeks || []).find((w) => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
          await callResolver2("scheduleBacklogTask", {
            taskId: data.taskId,
            startWeek: curWk,
            spanWeeks: 3,
            targetIndex
          });
        }
        await loadProjectPlan();
      } catch (err) {
        console.error("Error handling row drop:", err);
      }
    });
    const trackTd = document.createElement("td");
    trackTd.className = "timeline-track-cell";
    setupTrackDrop(trackTd, rowIdx);
    const hit = createBarHit(task, isEpic);
    if (hit) trackTd.appendChild(hit);
    tr.appendChild(trackTd);
    return tr;
  }
  function setupRowPointerReorder(tr, task) {
    tr.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const td = e.target.closest("td.td-data");
      if (!td) return;
      const onHandle = Boolean(e.target.closest(".row-drag-handle"));
      if (!onHandle && e.target.closest("button, a, input, select, textarea, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .progress-chip-cell, .target-chip-cell, .tree-toggle-btn, .row-action-btn, .row-insert-plus-btn")) {
        return;
      }
      if (onHandle) {
        e.preventDefault();
      }
      const startX = e.clientX;
      const startY = e.clientY;
      let lastX = startX;
      let lastY = startY;
      let active = false;
      let ghost = null;
      let grabOffsetY = ROW_H / 2;
      let hoveredTr = null;
      let dropTargetIndex = null;
      let hierarchyDrop = null;
      function clearHoveredIndicator() {
        if (hoveredTr) {
          hoveredTr.classList.remove("drop-insert-top", "drop-insert-bottom", "drop-into", "drop-into-refused");
          hoveredTr = null;
        }
      }
      function activateDrag(curX, curY) {
        if (active) return;
        active = true;
        clearTimeout(holdTimer);
        try {
          window.getSelection()?.removeAllRanges?.();
        } catch {
        }
        hideTooltip();
        const trRect = tr.getBoundingClientRect();
        grabOffsetY = Math.max(8, Math.min(ROW_H - 8, startY - trRect.top));
        const frozen = getFrozenLayout();
        ghost = document.createElement("div");
        ghost.className = "row-drag-ghost";
        ghost.style.left = `${Math.max(4, trRect.left)}px`;
        ghost.style.top = `${curY - grabOffsetY}px`;
        ghost.style.width = `${Math.min(frozen.totalWidth, window.innerWidth - 16)}px`;
        const dataCells = [...tr.children].filter((c) => !c.classList.contains("timeline-track-cell"));
        dataCells.forEach((cell2, idx) => {
          const k = frozen.visibleKeys[idx];
          if (!k) return;
          const clone = document.createElement("div");
          clone.className = "row-drag-ghost-cell";
          const w = frozen.widths[k];
          clone.style.width = `${w}px`;
          clone.style.minWidth = `${w}px`;
          clone.style.maxWidth = `${w}px`;
          for (const child of cell2.childNodes) {
            clone.appendChild(child.cloneNode(true));
          }
          clone.querySelectorAll(".row-action-toolbar, .row-insert-affordance").forEach((n) => n.remove());
          ghost.appendChild(clone);
        });
        document.body.appendChild(ghost);
        tr.classList.add("is-row-dragging");
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        updateDropTarget(curX, curY);
      }
      function updateDropTarget(curX, curY) {
        if (!active || !ghost) return;
        ghost.style.top = `${curY - grabOffsetY}px`;
        const wrapper = document.getElementById("ganttWrapper");
        if (wrapper) {
          const wRect = wrapper.getBoundingClientRect();
          const topEdge = wRect.top + (layout.headerH || 40) + 28;
          const bottomEdge = wRect.bottom - 28;
          if (curY < topEdge && wrapper.scrollTop > 0) {
            wrapper.scrollTop = Math.max(0, wrapper.scrollTop - 14);
          } else if (curY > bottomEdge) {
            wrapper.scrollTop += 14;
          }
        }
        clearHoveredIndicator();
        dropTargetIndex = null;
        const under = document.elementFromPoint(curX, curY);
        const overTr = under ? under.closest("tr.task-row") : null;
        if (overTr && overTr !== tr) {
          const r = overTr.getBoundingClientRect();
          const rel = (curY - r.top) / r.height;
          if (rel > 1 / 3 && rel < 2 / 3) {
            hierarchyDrop = { target: overTr.dataset.taskId, action: hierarchyActionFor(task, findAnyTask(overTr.dataset.taskId)) };
            overTr.classList.add("drop-into");
            overTr.classList.toggle("drop-into-refused", !!(hierarchyDrop.action && hierarchyDrop.action.refuse));
            if (ghost) ghost.dataset.hint = hierarchyDrop.action ? hierarchyDrop.action.refuse || hierarchyDrop.action.label : "";
            hoveredTr = overTr;
            return;
          }
          hierarchyDrop = null;
          if (ghost) ghost.dataset.hint = "";
          const isTop = rel < 0.5;
          overTr.classList.toggle("drop-insert-top", isTop);
          overTr.classList.toggle("drop-insert-bottom", !isTop);
          hoveredTr = overTr;
          const overEntry = rowTasks.find((x) => x.task.key === overTr.dataset.taskId);
          if (overEntry) {
            dropTargetIndex = isTop ? overEntry.rowIdx : overEntry.rowIdx + 1;
          }
        }
      }
      const holdTimer = !onHandle ? setTimeout(() => activateDrag(lastX, lastY), 180) : null;
      function onMove(ev) {
        lastX = ev.clientX;
        lastY = ev.clientY;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!active) {
          if (onHandle) {
            if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
              activateDrag(ev.clientX, ev.clientY);
            }
            return;
          }
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            cleanup();
            return;
          }
          if (Math.abs(dy) >= 6) {
            activateDrag(ev.clientX, ev.clientY);
          }
          return;
        }
        ev.preventDefault();
        updateDropTarget(ev.clientX, ev.clientY);
      }
      function cleanup() {
        if (holdTimer) clearTimeout(holdTimer);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        clearHoveredIndicator();
        if (ghost) {
          ghost.remove();
          ghost = null;
        }
        tr.classList.remove("is-row-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      async function onUp() {
        const wasActive = active;
        const targetIdx = dropTargetIndex;
        const into = hierarchyDrop;
        cleanup();
        if (!wasActive) return;
        if (into) {
          requestHierarchyChange(task.key, into.action);
          return;
        }
        const suppressClick = (ce) => {
          ce.stopPropagation();
          ce.preventDefault();
          window.removeEventListener("click", suppressClick, true);
        };
        window.addEventListener("click", suppressClick, true);
        setTimeout(() => window.removeEventListener("click", suppressClick, true), 80);
        if (targetIdx === null) return;
        const ownEntry = rowTasks.find((x) => x.task.key === task.key);
        if (ownEntry && (targetIdx === ownEntry.rowIdx || targetIdx === ownEntry.rowIdx + 1)) {
          return;
        }
        await callResolver2("reorderWbsTasks", { taskId: task.key, targetIndex: targetIdx });
        await loadProjectPlan();
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }
  function setupDropTargetRow(rowEl, targetIndex) {
    rowEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      rowEl.classList.add("drag-over");
    });
    rowEl.addEventListener("dragleave", () => {
      rowEl.classList.remove("drag-over");
    });
    rowEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      document.body.classList.remove("is-dragging-backlog");
      rowEl.classList.remove("drag-over");
      const dataStr = e.dataTransfer.getData("text/plain");
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.fromReorder) {
          await callResolver2("reorderWbsTasks", { taskId: data.taskId, targetIndex });
        } else {
          const curWk = (currentPlan?.weeks || []).find((w) => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
          await callResolver2("scheduleBacklogTask", {
            taskId: data.taskId,
            startWeek: curWk,
            spanWeeks: 3,
            targetIndex
          });
        }
        await loadProjectPlan();
      }
    });
  }
  function setupTrackDrop(trackTd, rowIdx) {
    let badge = null;
    const dayAt = (e) => {
      const d = dateAt(e.clientX - trackTd.getBoundingClientRect().left, originIso(), dayPx());
      return zoomById(zoomId).snap === "week" ? mondayOf(d) : d;
    };
    const clear = () => {
      trackTd.classList.remove("drag-over-cell");
      if (badge) badge.remove();
      badge = null;
    };
    trackTd.addEventListener("dragover", (e) => {
      e.preventDefault();
      const d = dayAt(e);
      trackTd.classList.add("drag-over-cell");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "drop-slot-badge";
        trackTd.appendChild(badge);
      }
      badge.style.left = xForDate(d, originIso(), dayPx()) + 4 + "px";
      badge.textContent = `\u{1F4C5} ${d}`;
    });
    trackTd.addEventListener("dragleave", (e) => {
      if (!trackTd.contains(e.relatedTarget)) clear();
    });
    trackTd.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove("is-dragging-backlog");
      const d = dayAt(e);
      clear();
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.fromReorder) {
        await callResolver2("reorderWbsTasks", { taskId: data.taskId, targetIndex: rowIdx });
      } else {
        await callResolver2("scheduleBacklogTask", { taskId: data.taskId, startWeek: "", startDate: d, spanWeeks: 3, targetIndex: rowIdx });
      }
      await loadProjectPlan();
    });
  }
  function positionBarHit(hit, task) {
    const r = barRect(task, originIso(), dayPx(), 0, ROW_H, BAR_H);
    if (!r) {
      hit.hidden = true;
      return;
    }
    hit.hidden = false;
    hit.style.left = r.x + "px";
    hit.style.top = r.y + "px";
    hit.style.width = r.w + "px";
    hit.style.height = r.h + "px";
    const h = handleOffsets(r.w);
    const left = hit.querySelector(".bar-handle-left");
    const right = hit.querySelector(".bar-handle-right");
    if (left) left.style.left = h.left + "px";
    if (right) right.style.left = h.right + "px";
    const p = portOffsets(r.w);
    const portL = hit.querySelector(".bar-link-port-left");
    const portR = hit.querySelector(".bar-link-port-right");
    if (portL) portL.style.left = p.left + "px";
    if (portR) portR.style.left = p.right + "px";
    hit.setAttribute("aria-label", `${task.key}: ${task.summary || ""}, ${task.startDate} to ${task.endDate || task.startDate}, ${task.progress || 0}% done`);
  }
  function createBarHit(task, isEpic) {
    if (!task.startDate) return null;
    const key = task.key;
    const hit = document.createElement("div");
    hit.className = "bar-hit" + (isEpic || task.datesFromChildren ? " is-epic" : "") + (pinnedDependencyTaskId === key ? " is-pinned" : "");
    hit.dataset.taskId = key;
    hit.setAttribute("aria-hidden", "true");
    if (!isEpic && !task.datesFromChildren) {
      for (const edge of ["left", "right"]) {
        const handle = document.createElement("div");
        handle.className = `bar-handle bar-handle-${edge}`;
        handle.setAttribute("aria-hidden", "true");
        handle.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          startBarPointerEdit(e, key, edge, hit);
        });
        hit.appendChild(handle);
      }
      hit.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.classList.contains("bar-handle") || e.target.closest(".bar-link-port")) return;
        e.preventDefault();
        startBarPointerEdit(e, key, "move", hit);
      });
    } else if (!isEpic && isBlockParent(task)) {
      hit.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.closest(".bar-link-port")) return;
        e.preventDefault();
        startBarPointerEdit(e, key, "move", hit);
      });
    }
    if (!isEpic) {
      for (const side of ["right", "left"]) {
        const port = document.createElement("div");
        port.className = `bar-link-port bar-link-port-${side}`;
        port.textContent = "\u2794";
        port.title = side === "right" ? `Drag arrow to successor task (which will depend on ${task.key})` : `Drag arrow to predecessor task (which ${task.key} will depend on)`;
        port.setAttribute("aria-hidden", "true");
        port.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          startVisualLinkDrag(e, key, hit, side);
        });
        hit.appendChild(port);
      }
    }
    positionBarHit(hit, task);
    hit.addEventListener("mouseenter", (e) => {
      const t = findTask(key);
      if (t) showTaskTooltip(e, t);
      hoveredTaskId = key;
      drawTimeline(true);
    });
    hit.addEventListener("mouseleave", () => {
      hideTooltip();
      hoveredTaskId = null;
      drawTimeline(true);
    });
    hit.addEventListener("click", (e) => {
      if (!e.defaultPrevented && !isDraggingBar && !e.target.closest(".bar-link-port")) {
        pinnedDependencyTaskId = pinnedDependencyTaskId === key ? null : key;
        syncPinnedBarHit();
        const i = rowTasks.findIndex((r) => r.task.key === key);
        if (i >= 0 && gridRoot) {
          gridFocus = { row: i, col: 2 };
          renderGrid();
          focusGridCell();
        }
        drawTimeline(true);
        clearTimeout(toolbarTimer);
        toolbarTimer = setTimeout(() => openBarToolbar(key, hit), DOUBLE_CLICK_MS);
      }
    });
    hit.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      clearTimeout(toolbarTimer);
      closeBarToolbar();
      openTaskDetailModal(key);
    });
    hit.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProgressPicker(hit, key);
    });
    return hit;
  }
  function startVisualLinkDrag(e, sourceKey, hit, side = "right") {
    const sourceTask = findTask(sourceKey);
    if (!sourceTask || !sourceTask.startDate || !timeline) return;
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper) return;
    closeBarToolbar();
    hideTooltip();
    const hitRect = hit.getBoundingClientRect();
    const initWRect = wrapper.getBoundingClientRect();
    const x1 = (side === "left" ? hitRect.left : hitRect.right) - initWRect.left + wrapper.scrollLeft;
    const y1 = hitRect.top + hitRect.height / 2 - initWRect.top + wrapper.scrollTop;
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";
    function onMove(ev) {
      const wRect = wrapper.getBoundingClientRect();
      const curX = ev.clientX - wRect.left + wrapper.scrollLeft;
      const curY = ev.clientY - wRect.top + wrapper.scrollTop;
      const el3 = document.elementFromPoint(ev.clientX, ev.clientY);
      let targetHit = el3 ? el3.closest(".bar-hit") : null;
      let targetKey = targetHit && targetHit.dataset.taskId !== sourceKey ? targetHit.dataset.taskId : null;
      if (!targetKey && el3) {
        const row = el3.closest("tr[data-task-id]");
        if (row && row.getAttribute("data-task-id") !== sourceKey) {
          targetKey = row.getAttribute("data-task-id");
          targetHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(targetKey)}"]`);
        }
      }
      const predKey = side === "right" ? sourceKey : targetKey;
      const succKey = side === "right" ? targetKey : sourceKey;
      timeline.activeLinking = { sourceKey, x1, y1, curX, curY, targetKey, predKey, succKey };
      timeline.requestDraw();
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const active = timeline.activeLinking;
      const targetKey = active ? active.targetKey : null;
      timeline.activeLinking = null;
      timeline.requestDraw();
      if (targetKey) {
        const targetHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(targetKey)}"]`);
        const anchorEl = targetHit || hit;
        const rect = anchorEl.getBoundingClientRect();
        openDependencyEditPopover(
          buildDraggedDependencyLink(sourceKey, targetKey, 100, side),
          { getBoundingClientRect: () => rect }
        );
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function isEnforceDepsEnabled() {
    const enforceBox = document.getElementById("enforceDependenciesCheckbox");
    let storageVal = null;
    try {
      storageVal = localStorage.getItem("cascadeplan_enforce_deps");
    } catch (e) {
    }
    return isEnforceDepsActive(enforceBox, storageVal);
  }
  function startBarPointerEdit(e, key, mode, hit) {
    const task = findTask(key);
    if (!task || !task.startDate || !timeline) return;
    const wrapper = document.getElementById("ganttWrapper");
    const startX = e.clientX;
    const today = todayIso();
    let shift = 0;
    let moved = false;
    document.body.style.cursor = mode === "move" ? "grabbing" : "col-resize";
    document.body.style.userSelect = "none";
    hideTooltip();
    function onMove(ev) {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        isDraggingBar = true;
      }
      if (!moved) return;
      const s = snapDays(dx, dayPx(), ev.altKey ? "day" : zoomById(zoomId).snap);
      if (s === shift && timeline.drag) return;
      shift = s;
      const mine = shiftDates(task, mode === "right" ? 0 : s, mode === "left" ? 0 : s);
      if (!mine) return;
      const moves = /* @__PURE__ */ new Map([[key, mine]]);
      const conflict = checkDependencyConflict({ key, startDate: mine.start }, currentPlan.tasks, today);
      const isConflict = conflict.hasConflict;
      const enforceDeps = isEnforceDepsEnabled();
      const sign = s > 0 ? `+${s}` : `${s}`;
      let label2 = mode === "move" ? `${key} \u2794 ${mine.start} (${sign}d)` : `${key} ${mine.start} to ${mine.end}`;
      let wasSnapped = false;
      if (isConflict) {
        if (enforceDeps) {
          const clampedDates = clampToEarliestStart(mine.start, mine.end, conflict.earliestDate);
          wasSnapped = true;
          label2 = mode === "move" ? `${key} \u2794 ${clampedDates.startDate} (Enforced: ${conflict.predKey})` : `${key} ${clampedDates.startDate} to ${clampedDates.endDate} (Enforced: ${conflict.predKey})`;
          moves.set(key, { start: clampedDates.startDate, end: clampedDates.endDate });
        } else {
          label2 += ` \xB7 \u26A0\uFE0F Conflict: ${conflict.predKey} (${conflict.triggerPercent}%)`;
        }
      }
      let currentMine = moves.get(key) || mine;
      let preview;
      if (isBlockParent(task)) {
        const days = s !== 0 ? effectiveBlockDays(key, s) : 0;
        currentMine = { start: addDays(task.startDate, days), end: addDays(task.endDate || task.startDate, days) };
        preview = dropPreview(key, currentMine.start, currentMine.end, days);
      } else {
        preview = dropPreview(key, currentMine.start, currentMine.end);
      }
      timeline.drag = {
        key,
        moves: preview.moves,
        label: label2,
        isConflict: enforceDeps ? false : isConflict,
        wasSnapped,
        earliestDate: conflict.earliestDate,
        predKey: conflict.predKey
      };
      positionBarHit(hit, { ...task, startDate: currentMine.start, endDate: currentMine.end });
      wrapper.dataset.preview = JSON.stringify(Object.fromEntries(preview.moves));
      if (timeRange && mine) {
        if (mine.start < timeRange.start) {
          const diffDays = daysBetween(mine.start, timeRange.start);
          const addWeeks = Math.max(2, Math.ceil(diffDays / 7) + 2);
          const oldStart = timeRange.start;
          timeRange = { start: addDays(timeRange.start, -addWeeks * 7), end: timeRange.end };
          const shiftPx = daysBetween(timeRange.start, oldStart) * dayPx();
          applyTimeAxis();
          wrapper.scrollLeft += shiftPx;
        } else if (mine.end > timeRange.end) {
          const diffDays = daysBetween(timeRange.end, mine.end);
          const addWeeks = Math.max(2, Math.ceil(diffDays / 7) + 2);
          timeRange = { start: timeRange.start, end: addDays(timeRange.end, addWeeks * 7) };
          applyTimeAxis();
        }
        const wrapRect = wrapper.getBoundingClientRect();
        const edgeBuffer = 50;
        const trackLeftPx = layout && layout.trackLeft || 300;
        if (ev.clientX > wrapRect.right - edgeBuffer) {
          wrapper.scrollLeft += 15;
        } else if (ev.clientX < wrapRect.left + trackLeftPx + edgeBuffer) {
          wrapper.scrollLeft = Math.max(0, wrapper.scrollLeft - 15);
        }
      }
      const strip = document.getElementById("writePreview");
      if (strip) {
        let desc = preview.text;
        if (isConflict) {
          if (enforceDeps) {
            desc = `\u{1F512} Enforce dependencies: will snap ${key} to ${conflict.earliestDate} to satisfy dependency on ${conflict.predKey}. ${desc}`;
          } else {
            desc = `\u26A0\uFE0F Conflict: ${key} scheduled before ${conflict.predKey} reaches ${conflict.triggerPercent}% on ${conflict.triggerDate || conflict.earliestDate}. ${desc}`;
          }
        }
        strip.textContent = desc;
        strip.hidden = false;
        placeStripNear(strip, key);
      }
      timeline.requestDraw();
    }
    async function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (moved) {
        const swallowTimer = setTimeout(() => {
          window.removeEventListener("click", swallowClick, true);
          isDraggingBar = false;
        }, 150);
        const swallowClick = (ev) => {
          clearTimeout(swallowTimer);
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", swallowClick, true);
          setTimeout(() => {
            isDraggingBar = false;
          }, 40);
        };
        window.addEventListener("click", swallowClick, true);
      } else {
        isDraggingBar = false;
      }
      delete wrapper.dataset.preview;
      const strip = document.getElementById("writePreview");
      if (strip) strip.hidden = true;
      const dragInfo = timeline.drag;
      const mine = dragInfo && dragInfo.moves && dragInfo.moves.get(key);
      if (!moved || shift === 0 || !mine) {
        timeline.drag = null;
        positionBarHit(hit, task);
        drawTimeline();
        return;
      }
      if (isBlockParent(task)) {
        timeline.drag = null;
        await moveBlock(key, shift);
        return;
      }
      const enforceDeps = isEnforceDepsEnabled();
      let finalStart = mine.start;
      let finalEnd = mine.end;
      let conflict = checkDependencyConflict({ key, startDate: finalStart }, currentPlan.tasks, today);
      const wasSnapped = Boolean(dragInfo && dragInfo.wasSnapped);
      const earliestDate = dragInfo && dragInfo.earliestDate || conflict.earliestDate;
      const predKey = dragInfo && dragInfo.predKey || conflict.predKey;
      if (conflict.hasConflict && enforceDeps) {
        const clamped = clampToEarliestStart(finalStart, finalEnd, conflict.earliestDate);
        finalStart = clamped.startDate;
        finalEnd = clamped.endDate;
      }
      if (finalStart === task.startDate && finalEnd === (task.endDate || task.startDate)) {
        timeline.drag = null;
        positionBarHit(hit, task);
        drawTimeline(true);
        if (wasSnapped || conflict.hasConflict && enforceDeps) {
          announce(`Enforce dependencies: ${key} cannot start before ${earliestDate} (dependency on ${predKey}).`);
        }
        return;
      }
      const updates = { startDate: finalStart, endDate: finalEnd };
      const autoScale = mode !== "move" && document.getElementById("autoScaleEffortCheckbox")?.checked === true;
      if (autoScale && task.effortHours > 0) {
        const oldDays = daysBetween(task.startDate, task.endDate || task.startDate) + 1;
        const newDays = daysBetween(finalStart, finalEnd) + 1;
        updates.effortHours = Math.max(1, Math.round(task.effortHours * newDays / oldDays));
      }
      const undoBefore = snapshotPlan(currentPlan);
      const prevStart = task.startDate;
      const prevEnd = task.endDate;
      task.startDate = finalStart;
      task.endDate = finalEnd;
      timeline.drag = null;
      positionBarHit(hit, task);
      drawTimeline(true);
      try {
        const res = await callResolver2("updateWbsTask", {
          taskId: key,
          updates,
          expectedVersion: task.version || 0,
          expectedDueDate: task.jiraDueDate ? String(task.jiraDueDate).slice(0, 10) : null
        }, { before: undoBefore });
        if (res && Array.isArray(res.tasks)) {
          applyPlanInPlace(res);
        } else {
          await loadProjectPlan();
        }
      } catch (err) {
        task.startDate = prevStart;
        task.endDate = prevEnd;
        positionBarHit(hit, task);
        drawTimeline(true);
        showFlag({ text: "Failed to update dates: " + String(err), error: true });
      }
      if (conflict.hasConflict && !enforceDeps) {
        const updatedHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || hit;
        showDependencyConflictDialog({
          key,
          candidateStart: finalStart,
          candidateEnd: finalEnd,
          conflict,
          task,
          prevStart,
          prevEnd,
          hit: updatedHit,
          mode
        });
      } else if (wasSnapped || conflict.hasConflict && enforceDeps) {
        announce(`Enforce dependencies: snapped ${key} start to ${earliestDate} to satisfy dependency on ${predKey}.`);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  var conflictState = null;
  function showDependencyConflictDialog(state) {
    const banner = document.getElementById("depConflictBanner");
    if (!banner) return;
    popoverOpenedAt = performance.now();
    conflictState = state;
    const { key, candidateStart, conflict } = state;
    const pred = findTask(conflict.predKey);
    const msgEl = document.getElementById("depConflictMessage");
    if (msgEl) {
      msgEl.textContent = `${key} is scheduled to start on ${candidateStart}, but depends on ${conflict.predKey} reaching ${conflict.triggerPercent}% on ${conflict.triggerDate || conflict.earliestDate}.`;
    }
    const snapBtn = document.getElementById("btnConflictSnap");
    if (snapBtn) snapBtn.textContent = `Snap to Earliest Start (${conflict.earliestDate})`;
    const suggestedPct = pred ? suggestTriggerToFit(pred, candidateStart) : 0;
    const adjustBtn = document.getElementById("btnConflictAdjust");
    if (adjustBtn) adjustBtn.textContent = `Adjust Trigger to ${suggestedPct}%`;
    banner.hidden = false;
    const r = state.hit && state.hit.getBoundingClientRect ? state.hit.getBoundingClientRect() : { bottom: 200, left: 200 };
    banner.style.top = `${Math.max(8, Math.min(window.innerHeight - banner.offsetHeight - 8, r.bottom + 6))}px`;
    banner.style.left = `${Math.max(8, Math.min(window.innerWidth - banner.offsetWidth - 8, r.left))}px`;
  }
  function closeDependencyConflictDialog() {
    const banner = document.getElementById("depConflictBanner");
    if (banner) banner.hidden = true;
    conflictState = null;
  }
  async function applyConflictSnap() {
    if (!conflictState) return;
    const { key, candidateStart, candidateEnd, conflict } = conflictState;
    const clamped = clampToEarliestStart(candidateStart, candidateEnd, conflict.earliestDate);
    closeDependencyConflictDialog();
    await commitDates(key, clamped.startDate, clamped.endDate);
  }
  async function applyConflictAdjust() {
    if (!conflictState) return;
    const { key, candidateStart, candidateEnd, conflict } = conflictState;
    const pred = findTask(conflict.predKey);
    const suggestedPct = pred ? suggestTriggerToFit(pred, candidateStart) : 0;
    closeDependencyConflictDialog();
    const task = findTask(key);
    await callResolver2("updateWbsTask", {
      taskId: key,
      updates: {
        startDate: candidateStart,
        endDate: candidateEnd,
        dependency: {
          predecessorKey: conflict.predKey,
          predecessorId: conflict.predKey,
          triggerPercent: suggestedPct,
          isTriggerSatisfied: false
        }
      },
      expectedVersion: task && task.version || 0
    });
    await loadProjectPlan();
    announce(`Adjusted trigger on ${conflict.predKey} to ${suggestedPct}% and moved ${key} to ${candidateStart}.`);
  }
  function applyConflictKeep() {
    closeDependencyConflictDialog();
    announce("Kept schedule with dependency violation.");
  }
  async function applyConflictCancel() {
    if (!conflictState) return;
    const { key, prevStart, prevEnd } = conflictState;
    closeDependencyConflictDialog();
    if (!prevStart) {
      announce(`${key} had no dates before the move, so there is nothing to revert to.`);
      return;
    }
    const res = await commitDates(key, prevStart, prevEnd || prevStart);
    announce(classifyResult(res).failed ? `${key} could not be reverted.` : `Reverted ${key} to ${prevStart}.`);
  }
  var gridRoot = null;
  var lastGridKey = null;
  var toolbarTimer = 0;
  var DOUBLE_CLICK_MS = 250;
  var gridFocus = { row: 0, col: 0 };
  var moveState = null;
  var SHORTCUT_KEY = "cascadeplan_shortcuts";
  function shortcutsOn() {
    const box = document.getElementById("shortcutsToggle");
    return !box || box.checked;
  }
  function announce(text) {
    const live = document.getElementById("cpLive");
    if (live) live.textContent = text;
  }
  function initGrid() {
    if (!timeline || gridRoot) return;
    gridRoot = document.createElement("div");
    gridRoot.setAttribute("role", "treegrid");
    gridRoot.setAttribute("aria-label", "Schedule");
    gridRoot.setAttribute("aria-colcount", String(GRID_COLUMNS.length));
    timeline.root.appendChild(gridRoot);
    gridRoot.addEventListener("keydown", onGridKey);
    gridRoot.addEventListener("focusin", (e) => {
      const cell2 = e.target.closest('[role="gridcell"]');
      if (!cell2) return;
      gridFocus = { row: Number(cell2.parentElement.dataset.row), col: Number(cell2.dataset.col) };
      const key = rowTasks[gridFocus.row]?.task.key || null;
      lastGridKey = key;
      timeline.focusKey = key;
      timeline.focusElement = cell2;
      document.querySelectorAll("#ganttBody tr.is-grid-focused").forEach((r) => r.classList.remove("is-grid-focused"));
      const tr = key && rowCache.get(key);
      if (tr) tr.classList.add("is-grid-focused");
      drawTimeline(true);
    });
    gridRoot.addEventListener("focusout", (e) => {
      if (gridRoot.contains(e.relatedTarget)) return;
      timeline.focusKey = null;
      timeline.focusElement = null;
      document.querySelectorAll("#ganttBody tr.is-grid-focused").forEach((r) => r.classList.remove("is-grid-focused"));
      drawTimeline(true);
    });
  }
  function renderGrid() {
    if (!gridRoot) return;
    const hadFocus = gridRoot.contains(document.activeElement);
    const planKeys = new Set((currentPlan?.tasks || []).map((t) => t.key));
    gridRoot.setAttribute("aria-rowcount", String(rowTasks.length + 1));
    const header = document.createElement("div");
    header.setAttribute("role", "row");
    header.setAttribute("aria-rowindex", "1");
    GRID_COLUMNS.forEach((name, c) => {
      const h = document.createElement("span");
      h.setAttribute("role", "columnheader");
      h.setAttribute("aria-colindex", String(c + 1));
      h.textContent = name;
      header.appendChild(h);
    });
    const rows = [header];
    const { first, last } = renderedRange;
    if (gridFocus.row < first || gridFocus.row > last) gridFocus = { row: Math.max(first, viewportFirstRow()), col: gridFocus.col };
    for (let i = first; i <= last; i++) {
      const t = rowTasks[i].task;
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.setAttribute("aria-rowindex", String(i + 2));
      row.setAttribute("aria-level", String(rowLevel(t, planKeys)));
      if (rowParentKeys.has(t.key)) row.setAttribute("aria-expanded", collapsedTasks.has(t.key) ? "false" : "true");
      row.dataset.row = String(i);
      rowCells(t).forEach((text, c) => {
        const cell2 = document.createElement("span");
        cell2.setAttribute("role", "gridcell");
        cell2.setAttribute("aria-colindex", String(c + 1));
        cell2.dataset.col = String(c);
        cell2.tabIndex = i === gridFocus.row && c === gridFocus.col ? 0 : -1;
        cell2.textContent = text;
        row.appendChild(cell2);
      });
      rows.push(row);
    }
    gridRoot.replaceChildren(...rows);
    applySelection();
    if (hadFocus) focusGridCell();
  }
  function viewportFirstRow() {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper) return 0;
    return Math.max(0, Math.min(rowTasks.length - 1, Math.ceil((wrapper.scrollTop + layout.headerH - layout.bodyStart) / ROW_H)));
  }
  function focusGridCell() {
    const inField = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT" || document.activeElement.isContentEditable);
    if (inField) return;
    const cell2 = gridRoot && gridRoot.querySelector(`[role="row"][data-row="${gridFocus.row}"] [data-col="${gridFocus.col}"]`);
    if (cell2) {
      gridRoot.querySelectorAll('[role="gridcell"][tabindex="0"]').forEach((c) => {
        c.tabIndex = -1;
      });
      cell2.tabIndex = 0;
      cell2.focus({ preventScroll: true });
    }
  }
  function ensureRowVisible(i) {
    const wrapper = document.getElementById("ganttWrapper");
    if (!wrapper) return;
    const top = rowTop(i);
    const flags = document.getElementById("flagGroup");
    const flagH = flags && flags.children.length ? flags.getBoundingClientRect().height + 16 : 8;
    const viewTop = wrapper.scrollTop + layout.headerH;
    const viewBottom = wrapper.scrollTop + wrapper.clientHeight - flagH;
    if (top < viewTop) wrapper.scrollTop = top - layout.headerH - 8;
    else if (top + ROW_H > viewBottom) wrapper.scrollTop = top + ROW_H - wrapper.clientHeight + flagH;
    const t = rowTasks[i] && rowTasks[i].task;
    if (t && t.startDate) {
      const x = layout.trackLeft + xForDate(t.startDate, originIso(), dayPx());
      if (x < wrapper.scrollLeft + layout.trackLeft + 40 || x > wrapper.scrollLeft + wrapper.clientWidth - 80) wrapper.scrollLeft = Math.max(0, x - layout.trackLeft - 120);
    }
  }
  function setGridFocus(row, col) {
    gridFocus = { row, col };
    ensureRowVisible(row);
    updateVirtualRows();
    focusGridCell();
  }
  function onGridKey(e) {
    if (moveState) {
      onMoveKey(e);
      return;
    }
    const task = rowTasks[gridFocus.row]?.task;
    const page = Math.max(1, Math.floor((document.getElementById("ganttWrapper").clientHeight - layout.headerH) / ROW_H) - 1);
    const next = navigate(gridFocus, e, rowTasks.length, GRID_COLUMNS.length, page);
    if (next) {
      e.preventDefault();
      setGridFocus(next.row, next.col);
      return;
    }
    if (!task) return;
    const digit = progressFromDigit(e.key);
    if (digit !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setPendingProgress(task.key, digit);
      return;
    }
    if (e.key === "Enter" && pendingProgress.size) {
      e.preventDefault();
      commitPendingProgress();
      return;
    }
    if (e.key === "Escape" && pendingProgress.size) {
      pendingProgress.clear();
      renderTimelineRows();
      announce("Progress changes discarded.");
      return;
    }
    if (e.key === " " && gridFocus.col !== 2 && gridFocus.col !== 3) {
      e.preventDefault();
      selectRow(task.key, { shiftKey: false });
      announce(`${task.key} ${selectedKeys.has(task.key) ? "selected" : "not selected"}. ${selectedKeys.size} selected.`);
      return;
    }
    if (e.key === " " && task.startDate && !(task.isEpic || task.hierarchyLevel === 1)) {
      if (task.datesFromChildren && !isBlockParent(task)) {
        e.preventDefault();
        announce(`${task.key} follows the dates of its children. Move a child instead.`);
        return;
      }
      e.preventDefault();
      startMoveMode(task);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openTaskDetailModal(task.key);
    }
  }
  function placeStripNear(strip, key) {
    const row = document.querySelector(`#ganttBody tr.task-row[data-task-id="${CSS.escape(key)}"]`);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const h = strip.offsetHeight || 32;
    strip.style.top = `${Math.max(8, r.top - h - 6)}px`;
    strip.style.bottom = "auto";
  }
  function showShiftPreview(key, startShift, endShift, label2) {
    const task = findTask(key);
    const block = isBlockParent(task) && startShift === endShift && startShift !== 0;
    const days = block ? effectiveBlockDays(key, startShift) : void 0;
    const shifted = task && shiftDates(task, block ? days : startShift, block ? days : endShift);
    if (!shifted) return void 0;
    const preview = dropPreview(key, shifted.start, shifted.end, days);
    const mine = preview.moves.get(key);
    timeline.drag = { key, moves: preview.moves, label: label2(mine) };
    const strip = document.getElementById("writePreview");
    if (strip) {
      strip.textContent = preview.text;
      strip.hidden = false;
      placeStripNear(strip, key);
    }
    timeline.requestDraw();
    return mine;
  }
  function clearShiftPreview() {
    timeline.drag = null;
    const strip = document.getElementById("writePreview");
    if (strip) strip.hidden = true;
    drawTimeline();
  }
  async function commitDates(key, start, end) {
    const task = findTask(key);
    const res = await callResolver2("updateWbsTask", {
      taskId: key,
      updates: { startDate: start, endDate: end },
      expectedVersion: task && task.version || 0,
      expectedDueDate: task && task.jiraDueDate ? String(task.jiraDueDate).slice(0, 10) : null
    });
    timeline.drag = null;
    if (res && Array.isArray(res.tasks)) applyPlanInPlace(res);
    else await loadProjectPlan();
    return res;
  }
  function startMoveMode(task) {
    moveState = { key: task.key, start: 0, end: 0 };
    const mine = showShiftPreview(task.key, 0, 0, () => `${task.key} (move mode)`);
    announce(moveAnnouncement(task.key, mine.start, mine.end, true));
  }
  async function onMoveKey(e) {
    const { state, action } = moveKey(moveState, e);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    const key = state.key;
    if (action === "cancel") {
      moveState = null;
      clearShiftPreview();
      announce(`Move cancelled. ${key} keeps its dates.`);
      return;
    }
    if (action === "move") {
      moveState = state;
      const mine2 = showShiftPreview(key, state.start, state.end, (m) => `${key} \u2794 ${m.start}`);
      announce(moveAnnouncement(key, mine2.start, mine2.end, false));
      return;
    }
    const mine = timeline.drag && timeline.drag.moves.get(key);
    moveState = null;
    if (!mine || state.start === 0 && state.end === 0) {
      clearShiftPreview();
      announce(`No change to ${key}.`);
      return;
    }
    const strip = document.getElementById("writePreview");
    if (strip) strip.hidden = true;
    const task = findTask(key);
    if (isBlockParent(task)) {
      clearShiftPreview();
      if (state.start !== state.end) announce(`${key} takes its dates from its sub-tasks, so it cannot be resized. Move it instead.`);
      else await moveBlock(key, state.start);
      focusGridCell();
      return;
    }
    const enforceDeps = isEnforceDepsEnabled();
    let finalStart = mine.start;
    let finalEnd = mine.end;
    const conflict = checkDependencyConflict({ key, startDate: finalStart }, currentPlan.tasks, todayIso());
    if (conflict.hasConflict) {
      if (enforceDeps) {
        const clamped = clampToEarliestStart(finalStart, finalEnd, conflict.earliestDate);
        finalStart = clamped.startDate;
        finalEnd = clamped.endDate;
        if (task && finalStart === task.startDate && finalEnd === (task.endDate || task.startDate)) {
          clearShiftPreview();
          announce(`Enforce dependencies: ${key} cannot start before ${conflict.earliestDate} (dependency on ${conflict.predKey}).`);
          focusGridCell();
          return;
        }
        await commitDates(key, finalStart, finalEnd);
        announce(`Enforce dependencies: snapped ${key} start to ${conflict.earliestDate} to satisfy dependency on ${conflict.predKey}.`);
        focusGridCell();
        return;
      } else {
        clearShiftPreview();
        const updatedHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
        showDependencyConflictDialog({
          key,
          candidateStart: finalStart,
          candidateEnd: finalEnd,
          conflict,
          task,
          hit: updatedHit,
          mode: "move"
        });
        focusGridCell();
        return;
      }
    }
    await commitDates(key, finalStart, finalEnd);
    announce(`Saved. ${key}: ${finalStart} to ${finalEnd}.`);
    focusGridCell();
  }
  function openBarToolbar(key, anchor) {
    const bar = document.getElementById("barToolbar");
    if (!bar) return;
    const currentHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || anchor;
    if (!currentHit) return;
    bar.dataset.key = key;
    bar.setAttribute("aria-label", `Actions for ${key}`);
    const r = currentHit.getBoundingClientRect();
    popoverOpenedAt = performance.now();
    bar.hidden = false;
    const barH = bar.offsetHeight || 38;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= barH + 10 ? r.bottom + 6 : Math.max(8, r.top - barH - 6);
    bar.style.top = `${top}px`;
    bar.style.left = `${Math.max(8, Math.min(window.innerWidth - (bar.offsetWidth || 340) - 8, r.left))}px`;
  }
  function followBarToolbar() {
    const bar = document.getElementById("barToolbar");
    if (!bar || bar.hidden) return;
    const hit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(bar.dataset.key || "")}"]`);
    const wrapper = document.getElementById("ganttWrapper");
    if (!hit || !wrapper) return closeBarToolbar();
    const r = hit.getBoundingClientRect();
    const w = wrapper.getBoundingClientRect();
    if (r.bottom < w.top || r.top > w.bottom || r.right < w.left || r.left > w.right) return closeBarToolbar();
    openBarToolbar(bar.dataset.key, hit);
  }
  function closeBarToolbar() {
    const bar = document.getElementById("barToolbar");
    if (bar) bar.hidden = true;
  }
  var dateEditKey = null;
  function openDateEditPopover(key, anchor) {
    const task = findTask(key);
    if (!task) return;
    dateEditKey = key;
    const pop = document.getElementById("dateEditPopover");
    if (!pop) return;
    popoverOpenedAt = performance.now();
    pop.hidden = false;
    document.getElementById("dateEditTitle").textContent = `Edit Dates: ${key}`;
    const startInp = document.getElementById("dateEditStart");
    const endInp = document.getElementById("dateEditEnd");
    startInp.value = task.startDate || "";
    endInp.value = task.endDate || task.startDate || "";
    const updateDuration = () => {
      const s = startInp.value;
      const e = endInp.value;
      const durEl = document.getElementById("dateEditDuration");
      if (s && e && s <= e) {
        const days = daysBetween(s, e) + 1;
        const wks = (days / 7).toFixed(1).replace(/\.0$/, "");
        durEl.textContent = `${days}d (${wks} wks)`;
      } else {
        durEl.textContent = "";
      }
    };
    startInp.oninput = updateDuration;
    endInp.oninput = updateDuration;
    updateDuration();
    const currentHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || anchor;
    const r = currentHit && currentHit.getBoundingClientRect ? currentHit.getBoundingClientRect() : { top: 120, bottom: 160, left: 140 };
    const popH = pop.offsetHeight || 190;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= popH + 10 ? r.bottom + 6 : Math.max(8, r.top - popH - 6);
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - (pop.offsetWidth || 340) - 8, r.left))}px`;
    startInp.focus();
  }
  function closeDateEditPopover() {
    const pop = document.getElementById("dateEditPopover");
    if (pop) pop.hidden = true;
    dateEditKey = null;
    focusGridCell();
  }
  async function toolbarAction(action, key, btn) {
    const task = findTask(key);
    if (!task) return;
    const barHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
    const anchorRect = (barHit || btn).getBoundingClientRect();
    const barAnchor = { getBoundingClientRect: () => anchorRect };
    closeBarToolbar();
    if ((action === "earlier" || action === "later") && isBlockParent(task)) {
      await moveBlock(key, action === "later" ? 7 : -7);
      return;
    }
    if ((action === "earlier" || action === "later") && task.datesFromChildren) {
      showFlag({ text: `${key} follows the dates of its children. Move a child instead.` });
      return;
    }
    if (action === "earlier" || action === "later") {
      const days = action === "later" ? 7 : -7;
      const mine = showShiftPreview(key, days, days, (m) => `${key} \u2794 ${m.start}`);
      await commitDates(key, mine.start, mine.end);
    } else if (action === "dates") {
      openDateEditPopover(key, barAnchor);
    } else if (action === "dependency") {
      openDependencyPopup(key, barAnchor);
    } else if (action === "progress") {
      openProgressPicker(barAnchor, key);
    }
  }
  var depState = null;
  function dependencyCandidates(key) {
    const idx = rowTasks.findIndex((r) => r.task.key === key);
    const others = rowTasks.map((r, i) => ({ t: r.task, d: i < idx ? idx - i : 1e3 + i - idx })).filter((x) => x.t.key !== key);
    return others.sort((a, b) => a.d - b.d).map((x) => x.t);
  }
  function renderDependencyOptions() {
    const list = document.getElementById("depList");
    const search = document.getElementById("depSearch");
    const q = search.value.trim().toLowerCase();
    depState.options = dependencyCandidates(depState.key).filter((t) => !q || t.key.toLowerCase().includes(q) || (t.summary || "").toLowerCase().includes(q)).slice(0, 50);
    depState.active = Math.min(depState.active, depState.options.length - 1);
    list.replaceChildren(...depState.options.map((t, i) => {
      const li = document.createElement("li");
      li.id = `dep-opt-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === depState.active));
      li.textContent = `${t.key}: ${t.summary || ""}`;
      li.addEventListener("click", () => chooseDependency(i));
      return li;
    }));
    if (depState.active >= 0) search.setAttribute("aria-activedescendant", `dep-opt-${depState.active}`);
    else search.removeAttribute("aria-activedescendant");
  }
  function openDependencyPopup(key, anchor) {
    const pop = document.getElementById("depPopup");
    if (!pop) return;
    popoverOpenedAt = performance.now();
    depState = { key, active: -1, options: [], chosen: null, anchor };
    document.getElementById("depTitle").textContent = `${key} starts when`;
    document.getElementById("depSearch").value = "";
    document.getElementById("depTrigger").value = "100";
    renderDependencyOptions();
    pop.hidden = false;
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { top: 120, bottom: 120, left: 120 };
    const popH = pop.offsetHeight || 260;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= popH + 10 ? r.bottom + 6 : Math.max(8, r.top - popH - 6);
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - (pop.offsetWidth || 340) - 8, r.left))}px`;
    const trig = document.getElementById("depTrigger");
    trig.focus();
    trig.select();
  }
  function closeDependencyPopup() {
    const pop = document.getElementById("depPopup");
    if (pop) pop.hidden = true;
    depState = null;
    focusGridCell();
  }
  function chooseDependency(i) {
    const t = depState && depState.options[i];
    if (!t) return;
    depState.chosen = t.key;
    saveDependency();
  }
  async function saveDependency() {
    if (!depState || !depState.chosen) return;
    const pct = Math.max(0, Math.min(100, parseInt(document.getElementById("depTrigger").value, 10) || 0));
    const { key, chosen } = depState;
    const task = findTask(key);
    closeDependencyPopup();
    await callResolver2("updateWbsTask", {
      taskId: key,
      updates: { dependency: { predecessorKey: chosen, predecessorId: chosen, triggerPercent: pct, isTriggerSatisfied: false } },
      expectedVersion: task && task.version || 0
    });
    await loadProjectPlan();
    announce(`${key} now starts when ${chosen} reaches ${pct}%.`);
  }
  var depEditState = null;
  var lastDepBadgeSignature = "";
  function renderDependencyBadges(links) {
    const layer = document.getElementById("depLinksLayer");
    const wrapper = document.getElementById("ganttWrapper");
    if (!layer || !wrapper) return;
    const viewLeft = wrapper.scrollLeft + (layout.trackLeft || 0);
    const viewRight = wrapper.scrollLeft + wrapper.clientWidth;
    const viewTop = wrapper.scrollTop + (layout.headerH || 0);
    const viewBottom = wrapper.scrollTop + wrapper.clientHeight;
    const visibleLinks = (links || []).filter((link) => link.x >= viewLeft && link.x <= viewRight && link.y >= viewTop && link.y <= viewBottom);
    const sig = visibleLinks.map((l) => `${l.predecessorKey}>${l.successorKey}@${Math.round(l.x)},${Math.round(l.y)}:${l.triggerPercent}:${l.isViolated ? 1 : 0}`).join("|");
    if (sig === lastDepBadgeSignature) return;
    lastDepBadgeSignature = sig;
    layer.replaceChildren(...visibleLinks.map((link) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dep-link-badge" + (link.isViolated ? " is-violated" : "");
      btn.dataset.pred = link.predecessorKey;
      btn.dataset.succ = link.successorKey;
      btn.style.left = `${link.x}px`;
      btn.style.top = `${link.y}px`;
      btn.style.width = `${Math.max(26, Math.round((link.width || 28) + 6))}px`;
      btn.style.height = `${Math.max(20, Math.round((link.height || 18) + 6))}px`;
      btn.title = `Click to edit dependency: ${link.successorKey} depends on ${link.predecessorKey} (${link.text})`;
      btn.setAttribute("aria-label", `Dependency link: ${link.successorKey} depends on ${link.predecessorKey}, ${link.text}`);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openDependencyEditPopover(link, btn);
      });
      return btn;
    }));
  }
  function arrowAt(wrapper, e) {
    if (!timeline) return null;
    if (e.target.closest(".bar-hit, .dep-link-badge, .btn, button, input, select, a, .resizer, .row-drag-handle, .th-col-menu-btn")) return null;
    const rect = wrapper.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    if (vx < (layout.trackLeft || 0)) return null;
    const x = vx + wrapper.scrollLeft;
    const y = e.clientY - rect.top + wrapper.scrollTop;
    return nearestArrow(timeline.getArrowLinks(), x, y, 6);
  }
  function initArrowLineClicks(wrapper) {
    let raf = 0;
    wrapper.addEventListener("mousemove", (e) => {
      if (raf || isDraggingBar) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        wrapper.classList.toggle("is-over-arrow", Boolean(arrowAt(wrapper, e)));
      });
    });
    wrapper.addEventListener("mouseleave", () => wrapper.classList.remove("is-over-arrow"));
    wrapper.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const link = arrowAt(wrapper, e);
      if (!link) return;
      e.stopPropagation();
      e.preventDefault();
      const badge = [...document.querySelectorAll("#depLinksLayer .dep-link-badge")].find((b) => b.dataset.pred === link.predecessorKey && b.dataset.succ === link.successorKey);
      openDependencyEditPopover(link, badge || wrapper);
    }, true);
  }
  function refreshDepEditPopoverFields() {
    if (!depEditState) return;
    const { link } = depEditState;
    const predTask = findTask(link.predecessorKey);
    const succTask = findTask(link.successorKey);
    const titleEl = document.getElementById("depEditTitle");
    if (titleEl) titleEl.textContent = dependencyPopoverTitle(link.predecessorKey, link.successorKey);
    const partiesEl = document.getElementById("depEditParties");
    if (partiesEl) {
      partiesEl.innerHTML = html`
      <div><strong>${link.successorKey} depends on ${link.predecessorKey}</strong></div>
      <div>Predecessor: ${link.predecessorKey} (${predTask ? predTask.summary || "" : ""})</div>
      <div>Successor: ${link.successorKey} (${succTask ? succTask.summary || "" : ""})</div>
    `;
    }
    const labelEl = document.getElementById("depEditTriggerLabel");
    if (labelEl) {
      labelEl.textContent = `${link.successorKey} starts when ${link.predecessorKey} reaches (percent)`;
    }
    const removeBtn = document.getElementById("btnRemoveDepLink");
    if (removeBtn) {
      removeBtn.hidden = Boolean(link.isNew);
    }
    const saveBtn = document.getElementById("btnSaveDepEdit");
    if (saveBtn) {
      saveBtn.textContent = link.isNew ? "Add Dependency" : "Save";
    }
    updateDepEditPreview();
  }
  function openDependencyEditPopover(link, anchor) {
    const pop = document.getElementById("depEditPopover");
    if (!pop) return;
    popoverOpenedAt = performance.now();
    depEditState = { link: { ...link }, anchor };
    const triggerInput = document.getElementById("depEditTrigger");
    if (triggerInput) {
      triggerInput.value = String(link.triggerPercent);
    }
    const planOnlyNote = document.getElementById("depEditPlanOnly");
    if (planOnlyNote) planOnlyNote.hidden = !link.planOnly;
    refreshDepEditPopoverFields();
    pop.hidden = false;
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { bottom: 120, left: 120 };
    pop.style.top = `${Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6))}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left))}px`;
    if (triggerInput) {
      triggerInput.focus();
      triggerInput.select();
    }
  }
  function updateDepEditPreview() {
    if (!depEditState) return;
    const triggerInput = document.getElementById("depEditTrigger");
    const previewEl = document.getElementById("depEditPreview");
    if (!triggerInput || !previewEl) return;
    const pct = clampTriggerPercent(triggerInput.value);
    const predTask = findTask(depEditState.link.predecessorKey);
    const succTask = findTask(depEditState.link.successorKey);
    if (!predTask) {
      previewEl.textContent = "Predecessor details unavailable.";
      previewEl.classList.remove("is-violated");
      return;
    }
    const preview = computeDependencyPreview(predTask, pct, todayIso());
    let violated = false;
    let text = preview.summary;
    if (preview.earliestStartDate && succTask && succTask.startDate && succTask.startDate < preview.earliestStartDate) {
      violated = true;
      text += ` | Warning: ${succTask.key} is scheduled on ${succTask.startDate}, before earliest start ${preview.earliestStartDate}.`;
    }
    previewEl.textContent = text;
    if (violated) previewEl.classList.add("is-violated");
    else previewEl.classList.remove("is-violated");
  }
  function closeDependencyEditPopover() {
    const pop = document.getElementById("depEditPopover");
    if (pop) pop.hidden = true;
    if (depEditState && depEditState.anchor && typeof depEditState.anchor.focus === "function") {
      depEditState.anchor.focus();
    }
    depEditState = null;
  }
  async function saveDependencyEdit() {
    if (!depEditState) return;
    const { link } = depEditState;
    const triggerInput = document.getElementById("depEditTrigger");
    const pct = clampTriggerPercent(triggerInput ? triggerInput.value : link.triggerPercent);
    const succKey = link.successorKey;
    const predKey = link.predecessorKey;
    const succTask = findTask(succKey);
    closeDependencyEditPopover();
    await callResolver2("updateWbsTask", {
      taskId: succKey,
      updates: {
        dependency: {
          predecessorKey: predKey,
          predecessorId: predKey,
          triggerPercent: pct,
          isTriggerSatisfied: false
        }
      },
      expectedVersion: succTask && succTask.version || 0
    });
    await loadProjectPlan();
    announce(`Updated link: ${succKey} now starts when ${predKey} reaches ${pct}%.`);
  }
  async function removeDependencyLink() {
    if (!depEditState) return;
    const { link } = depEditState;
    const succKey = link.successorKey;
    const predKey = link.predecessorKey;
    const succTask = findTask(succKey);
    closeDependencyEditPopover();
    await callResolver2("updateWbsTask", {
      taskId: succKey,
      updates: { removeDependency: { predecessorKey: predKey } },
      expectedVersion: succTask && succTask.version || 0
    });
    await loadProjectPlan();
    announce(`Removed dependency link between ${predKey} and ${succKey}.`);
  }
  function initKeyboard() {
    initGrid();
    initSelectionBar();
    document.querySelectorAll("#zoomGroup [data-zoom]").forEach((b) => b.addEventListener("click", () => setZoom(b.dataset.zoom)));
    document.getElementById("btnCompactColumns")?.addEventListener("click", () => setCompactColumns(!isCompactMode()));
    updateZoomButtons();
    const box = document.getElementById("shortcutsToggle");
    if (box) {
      try {
        box.checked = localStorage.getItem(SHORTCUT_KEY) !== "off";
      } catch (e) {
      }
      box.addEventListener("change", () => {
        try {
          localStorage.setItem(SHORTCUT_KEY, box.checked ? "on" : "off");
        } catch (e) {
        }
      });
    }
    const bar = document.getElementById("barToolbar");
    if (bar) {
      bar.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (btn) {
          e.stopPropagation();
          toolbarAction(btn.dataset.action, bar.dataset.key, btn);
        }
      });
      bar.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeBarToolbar();
          focusGridCell();
        }
      });
    }
    const search = document.getElementById("depSearch");
    if (search) {
      search.addEventListener("input", () => {
        depState.active = -1;
        renderDependencyOptions();
      });
      search.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = depState.options.length;
          if (n) depState.active = (depState.active + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
          renderDependencyOptions();
        } else if (e.key === "Enter") {
          e.preventDefault();
          chooseDependency(Math.max(0, depState.active));
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeDependencyPopup();
        }
      });
    }
    const trig = document.getElementById("depTrigger");
    if (trig) trig.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("depSearch").focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDependencyPopup();
      }
    });
    document.getElementById("btnDepSave")?.addEventListener("click", () => chooseDependency(Math.max(0, depState ? depState.active : 0)));
    document.getElementById("btnCloseHelp")?.addEventListener("click", closeHelp);
    document.getElementById("btnHintHelp")?.addEventListener("click", openHelp);
    document.getElementById("btnHintDismiss")?.addEventListener("click", () => {
      writePref(HINT_KEY, "done");
      document.getElementById("linkHint").hidden = true;
    });
    document.getElementById("btnDepCancel")?.addEventListener("click", closeDependencyPopup);
    document.getElementById("btnCloseDateEdit")?.addEventListener("click", closeDateEditPopover);
    document.getElementById("btnDateEditMinusWk")?.addEventListener("click", () => {
      const sInp = document.getElementById("dateEditStart");
      const eInp = document.getElementById("dateEditEnd");
      if (!sInp || !eInp) return;
      if (sInp.value) sInp.value = addDays(sInp.value, -7);
      if (eInp.value) eInp.value = addDays(eInp.value, -7);
      sInp.dispatchEvent(new Event("input"));
    });
    document.getElementById("btnDateEditPlusWk")?.addEventListener("click", () => {
      const sInp = document.getElementById("dateEditStart");
      const eInp = document.getElementById("dateEditEnd");
      if (!sInp || !eInp) return;
      if (sInp.value) sInp.value = addDays(sInp.value, 7);
      if (eInp.value) eInp.value = addDays(eInp.value, 7);
      sInp.dispatchEvent(new Event("input"));
    });
    document.getElementById("btnOpenFullTaskDetail")?.addEventListener("click", () => {
      const k = dateEditKey;
      closeDateEditPopover();
      if (k) openTaskDetailModal(k);
    });
    document.getElementById("btnSaveDateEdit")?.addEventListener("click", async () => {
      const k = dateEditKey;
      const s = document.getElementById("dateEditStart")?.value;
      const e = document.getElementById("dateEditEnd")?.value;
      closeDateEditPopover();
      if (k && s) {
        await commitDates(k, s, e || s);
      }
    });
    document.getElementById("dateEditPopover")?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDateEditPopover();
      }
    });
    document.getElementById("btnSwapDepDirection")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!depEditState) return;
      depEditState.link = swapDependencyDirection(depEditState.link);
      refreshDepEditPopoverFields();
    });
    document.getElementById("btnCloseDepEdit")?.addEventListener("click", closeDependencyEditPopover);
    document.getElementById("btnCancelDepEdit")?.addEventListener("click", closeDependencyEditPopover);
    document.getElementById("btnSaveDepEdit")?.addEventListener("click", saveDependencyEdit);
    document.getElementById("btnRemoveDepLink")?.addEventListener("click", removeDependencyLink);
    document.querySelectorAll("#depEditPopover .dep-preset-group button[data-pct]").forEach((b) => {
      b.addEventListener("click", () => {
        const inp = document.getElementById("depEditTrigger");
        if (inp) {
          inp.value = b.dataset.pct;
          updateDepEditPreview();
        }
      });
    });
    const depEditTrig = document.getElementById("depEditTrigger");
    if (depEditTrig) {
      depEditTrig.addEventListener("input", updateDepEditPreview);
      depEditTrig.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveDependencyEdit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeDependencyEditPopover();
        }
      });
    }
    const enforceBox = document.getElementById("enforceDependenciesCheckbox");
    if (enforceBox) {
      try {
        enforceBox.checked = localStorage.getItem("cascadeplan_enforce_deps") === "on";
      } catch (e) {
      }
      enforceBox.addEventListener("change", () => {
        try {
          localStorage.setItem("cascadeplan_enforce_deps", enforceBox.checked ? "on" : "off");
        } catch (e) {
        }
        announce(enforceBox.checked ? "Enforce dependencies enabled. Moving tasks will automatically snap to respect predecessor milestones." : "Enforce dependencies disabled.");
      });
    }
    document.getElementById("btnCloseDepConflict")?.addEventListener("click", closeDependencyConflictDialog);
    document.getElementById("btnConflictCancel")?.addEventListener("click", applyConflictCancel);
    document.getElementById("btnConflictSnap")?.addEventListener("click", applyConflictSnap);
    document.getElementById("btnConflictAdjust")?.addEventListener("click", applyConflictAdjust);
    document.getElementById("btnConflictKeep")?.addEventListener("click", applyConflictKeep);
    document.getElementById("planSwitcher")?.addEventListener("change", async (e) => {
      setActivePlan(e.target.value);
      await loadProjectPlan();
      announce(`Switched to plan ${e.target.selectedOptions[0]?.textContent || activePlanId}.`);
    });
    const trigger = document.getElementById("planSelectorBtn");
    const pop = document.getElementById("plansManagerPopover");
    if (trigger && pop) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isClosed = getComputedStyle(pop).display === "none";
        pop.style.display = isClosed ? "flex" : "none";
        trigger.setAttribute("aria-expanded", isClosed ? "true" : "false");
        if (isClosed) {
          const searchInp2 = document.getElementById("planSearchInput");
          if (searchInp2) {
            searchInp2.value = currentPlanSearchQuery;
            setTimeout(() => searchInp2.focus(), 50);
          }
        }
      });
    }
    document.getElementById("btnManagePlans")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pop) {
        pop.style.display = getComputedStyle(pop).display === "none" ? "flex" : "none";
      }
    });
    document.getElementById("btnClosePlansPopover")?.addEventListener("click", () => {
      closePlansPopover();
    });
    const searchInp = document.getElementById("planSearchInput");
    if (searchInp) {
      searchInp.addEventListener("input", (e) => {
        currentPlanSearchQuery = e.target.value;
        if (currentPlan && currentPlan.availablePlans) {
          renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
        }
      });
    }
    const tabs = document.querySelectorAll(".plan-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        tabs.forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        currentPlanCategoryFilter = tab.dataset.category || "all";
        if (currentPlan && currentPlan.availablePlans) {
          renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
        }
      });
    });
    const submitCreatePlan = async () => {
      const nameInp = document.getElementById("newPlanNameInput");
      const valResult = validateNewPlanName(nameInp ? nameInp.value : "");
      if (!valResult.valid) {
        showFlag({ text: valResult.error || "Please enter a valid plan name.", error: true });
        nameInp?.focus();
        return;
      }
      const name = valResult.cleanName;
      const clone = document.getElementById("cloneCurrentPlanCheckbox")?.checked === true;
      const res = await callResolver2("createProjectPlan", {
        name,
        cloneFromPlanId: clone ? activePlanId : void 0
      });
      const copied = res && res.ok && res.plan && res.done === false ? await finishPlanWork("continuePlanCopy", res.plan.id, `Copying to ${res.plan.name}`) : res;
      if (res && res.ok && res.plan && !(copied && copied.ok && copied.done !== false)) {
        showFlag({ text: `The copy to ${res.plan.name} stopped. Pick it in the plan list to finish it.`, error: true });
        await loadProjectPlan();
      } else if (res && res.ok && res.plan) {
        if (nameInp) nameInp.value = "";
        closePlansPopover();
        setActivePlan(res.plan.id);
        showFlag({ text: `Created and switched to plan ${res.plan.name}.` });
        await loadProjectPlan();
      } else {
        showFlag({ text: res?.message || "Failed to create plan.", error: true });
      }
    };
    document.getElementById("btnCreatePlan")?.addEventListener("click", submitCreatePlan);
    document.getElementById("btnSavePlanJql")?.addEventListener("click", savePlanFilter);
    document.getElementById("planJqlInput")?.addEventListener("keydown", (ke) => {
      if (ke.key === "Enter") {
        ke.preventDefault();
        savePlanFilter();
      }
    });
    document.getElementById("newPlanNameInput")?.addEventListener("keydown", (ke) => {
      if (ke.key === "Enter") {
        ke.preventDefault();
        submitCreatePlan();
      }
    });
    const wrapper = document.getElementById("ganttWrapper");
    if (wrapper) {
      wrapper.addEventListener("dragover", (e) => {
        if (document.body.classList.contains("is-dragging-backlog")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      });
      wrapper.addEventListener("drop", async (e) => {
        if (!document.body.classList.contains("is-dragging-backlog")) return;
        document.body.classList.remove("is-dragging-backlog");
        const dataStr = e.dataTransfer.getData("text/plain");
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr);
          if (data && data.taskId && !data.fromReorder) {
            e.preventDefault();
            const rect = wrapper.getBoundingClientRect();
            const relX = e.clientX - rect.left + wrapper.scrollLeft;
            const d = dateAt(relX, originIso(), dayPx());
            const snapped = zoomById(zoomId).snap === "week" ? mondayOf(d) : d;
            const res = await callResolver2("scheduleBacklogTask", {
              taskId: data.taskId,
              startWeek: "",
              startDate: snapped,
              spanWeeks: 3,
              targetIndex: currentPlan?.tasks ? currentPlan.tasks.length : 0
            });
            if (res && Array.isArray(res.tasks)) {
              currentPlan = res;
              renderPlan();
            } else {
              await loadProjectPlan();
            }
            if (res && res.ok === true) showFlag({ text: "Scheduled " + data.taskId + " to timeline." });
          }
        } catch (err) {
          console.error("Error on wrapper drop:", err);
        }
      });
    }
    document.addEventListener("click", (e) => {
      const recentlyOpened = performance.now() - popoverOpenedAt < 180;
      const tb = document.getElementById("barToolbar");
      if (tb && !tb.hidden && !tb.contains(e.target) && !e.target.closest(".bar-hit")) closeBarToolbar();
      const depPop = document.getElementById("depPopup");
      if (!recentlyOpened && depPop && !depPop.hidden && !depPop.contains(e.target) && !e.target.closest("#barToolbar")) closeDependencyPopup();
      const datePop = document.getElementById("dateEditPopover");
      if (!recentlyOpened && datePop && !datePop.hidden && !datePop.contains(e.target) && !e.target.closest("#barToolbar")) closeDateEditPopover();
      const depEditPop = document.getElementById("depEditPopover");
      if (!recentlyOpened && depEditPop && !depEditPop.hidden && !depEditPop.contains(e.target) && !e.target.closest(".dep-link-badge")) closeDependencyEditPopover();
      const conflictBanner = document.getElementById("depConflictBanner");
      if (!recentlyOpened && conflictBanner && !conflictBanner.hidden && !conflictBanner.contains(e.target)) closeDependencyConflictDialog();
      const plansPop = document.getElementById("plansManagerPopover");
      if (plansPop && getComputedStyle(plansPop).display !== "none" && !plansPop.contains(e.target) && !e.target.closest("#planSelectorBtn") && !e.target.closest("#btnManagePlans")) {
        closePlansPopover();
      }
    });
    document.getElementById("ganttWrapper")?.addEventListener("scroll", () => {
      followBarToolbar();
      closeDateEditPopover();
      if (depEditState) closeDependencyEditPopover();
      if (conflictState) closeDependencyConflictDialog();
    }, { passive: true });
  }
  function onShortcut(e, inField) {
    const activeInput = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT" || document.activeElement.isContentEditable);
    if (inField || activeInput || e.ctrlKey || e.metaKey || e.altKey || !shortcutsOn() || openModal()) return false;
    const key = gridRoot && gridRoot.contains(document.activeElement) ? rowTasks[gridFocus.row]?.task.key : pinnedDependencyTaskId || hoveredTaskId;
    if (e.key === "t") {
      scrollToToday();
      return true;
    }
    if (!key) return false;
    if (e.key === "d") {
      openDependencyPopup(key, document.activeElement);
      return true;
    }
    if (e.key === "e") {
      openTaskDetailModal(key);
      return true;
    }
    return false;
  }
  var selectedKeys = /* @__PURE__ */ new Set();
  var selectionAnchor = null;
  var pendingProgress = /* @__PURE__ */ new Map();
  function applySelection() {
    for (const [key, tr] of rowCache) tr.classList.toggle("is-selected", selectedKeys.has(key));
    if (gridRoot) {
      gridRoot.setAttribute("aria-multiselectable", "true");
      gridRoot.querySelectorAll('[role="row"][data-row]').forEach((r) => {
        const t = rowTasks[Number(r.dataset.row)];
        r.setAttribute("aria-selected", String(!!t && selectedKeys.has(t.task.key)));
      });
    }
    const bar = document.getElementById("selectionBar");
    if (bar) {
      bar.hidden = selectedKeys.size === 0;
      document.getElementById("selectionCount").textContent = `${selectedKeys.size} selected`;
    }
  }
  function selectRow(key, e) {
    if (e.shiftKey) {
      const order = rowTasks.map((r) => r.task.key);
      selectedKeys = /* @__PURE__ */ new Set([...selectedKeys, ...rangeKeys(order, selectionAnchor, key)]);
    } else {
      selectedKeys = toggleKey(selectedKeys, key);
      selectionAnchor = key;
    }
    applySelection();
  }
  function clearSelection() {
    selectedKeys = /* @__PURE__ */ new Set();
    selectionAnchor = null;
    applySelection();
  }
  async function runBatch(items, kind) {
    if (!items.length) return;
    const res = await callResolver2("batchUpdateTasks", { items });
    const skipped = res && Array.isArray(res.results) ? res.results.filter((r) => r && r.ok === false).map((r) => r.taskId) : [];
    if (skipped.length) {
      showFlag({ text: `Not saved, because someone else changed ${skipped.length === 1 ? "it" : "them"} a moment ago: ${skipped.join(", ")}. The other ${items.length - skipped.length} saved. Reload and try those again.`, error: true });
    }
    if (res && Array.isArray(res.tasks)) {
      if (kind === "move") applyPlanInPlace(res);
      else {
        currentPlan = res;
        renderPlan();
        settleUndo();
      }
    } else {
      await loadProjectPlan();
    }
  }
  function versionOf(key) {
    return findTask(key)?.version || 0;
  }
  function initSelectionBar() {
    document.getElementById("btnSelProgress")?.addEventListener("click", async () => {
      const p = Math.max(0, Math.min(100, parseInt(document.getElementById("selProgress").value, 10) || 0));
      const done = [...selectedKeys].filter((k) => isDone(findTask(k)?.status));
      if (done.length) showFlag({ text: `Not changed: ${done.join(", ")} ${done.length === 1 ? "is" : "are"} Done in Jira, so the progress stays 100%.` });
      const items = [...selectedKeys].filter((k) => !done.includes(k)).map((k) => ({ taskId: k, updates: { progress: p }, expectedVersion: versionOf(k) }));
      if (!items.length) return;
      if (!await withStatusChoice(items.map((i) => ({ key: i.taskId, progress: p, updates: i.updates })))) return;
      runBatch(items, "progress");
    });
    document.getElementById("btnSelMove")?.addEventListener("click", async () => {
      const days = parseInt(document.getElementById("selDays").value, 10) || 0;
      const blocks = selectedBlockParents(currentPlan.tasks, selectedKeys);
      await runBatch(moveSelectionBy(currentPlan.tasks, selectedKeys, days), "move");
      for (const key of blocks) await moveBlock(key, days);
    });
    document.getElementById("btnSelAssign")?.addEventListener("click", () => {
      const sel = document.getElementById("selAssignee");
      const name = sel.options[sel.selectedIndex]?.textContent || "";
      runBatch([...selectedKeys].map((k) => ({ taskId: k, updates: { resourceAccountId: sel.value, resource: name }, expectedVersion: versionOf(k) })), "assign");
    });
    document.getElementById("btnSelClear")?.addEventListener("click", clearSelection);
  }
  function fillAssigneeOptions() {
    const sel = document.getElementById("selAssignee");
    if (!sel || !currentPlan) return;
    sel.replaceChildren(...(currentPlan.availableUsers || []).map((u) => {
      const o = document.createElement("option");
      o.value = u.accountId;
      o.textContent = u.displayName;
      return o;
    }));
  }
  function setPendingProgress(key, pct) {
    const locked = progressLockReason(findTask(key) || { key });
    if (locked) {
      announce(locked);
      return;
    }
    pendingProgress.set(key, pct);
    const chip = rowCache.get(key)?.querySelector(".progress-chip-text");
    if (chip) chip.textContent = `${pct}% (not saved)`;
    announce(`${key} progress ${pct}%, not saved. Down for the next row, Enter saves all ${pendingProgress.size}.`);
  }
  async function commitPendingProgress() {
    const items = [...pendingProgress].map(([k, p]) => ({ taskId: k, updates: { progress: p }, expectedVersion: versionOf(k) }));
    if (!await withStatusChoice(items.map((i) => ({ key: i.taskId, progress: i.updates.progress, updates: i.updates })))) {
      announce(`Progress not saved yet. Enter saves the ${pendingProgress.size} changes, Escape drops them.`);
      focusGridCell();
      return;
    }
    pendingProgress.clear();
    await runBatch(items, "progress");
    announce(`Saved progress on ${items.length} issue${items.length === 1 ? "" : "s"}.`);
    focusGridCell();
  }
  function showTaskTooltip(e, task) {
    const tip = document.getElementById("globalTooltip");
    const isEpic = task.isEpic || task.hierarchyLevel === 1;
    const isSub = task.isSubtask || task.hierarchyLevel === -1;
    const levelTitle = isEpic ? "\u{1F7EA} Epic Roadmap Level" : isSub ? "\u21B3 Subtask Execution Level" : "\u{1F537} Story / Task Plan Level";
    const dep = task.dependency;
    const depInfo = dep && dep.predecessorKey ? html`<div class="jx-mt-4">🔗 ${dep.earliestStartReason || `Waits for ${dep.predecessorKey} at ${dep.triggerPercent}%`}</div>${dep.isViolated ? html`<div class="jx-bold">⚠ ${dep.fixSuggestion || dep.violationReason || "Starts too early"}</div>` : ""}` : "";
    const rollupInfo = isEpic && task.rollupStats ? html`<div class="jx-semibold">Rollup: ${task.childrenCount || 0} child items | Total ${task.effortHours}h</div>` : "";
    const subInfo = !isEpic && task.subtasks && task.subtasks.length > 0 ? html`<div>Subtasks: ${task.subtasks.length} items (${task.effortHours}h total)</div>` : "";
    const contributing = getTaskContributingResources(task);
    let assigneeHtml = html`<div>${isEpic ? "Epic Lead" : "Assignee"}: ${task.resource || "Unassigned"}</div>`;
    if (contributing.length > 1) {
      assigneeHtml = html`<div>${isEpic ? "Epic Team" : "Team"}: <strong>${contributing.map((c) => c.name).join(", ")}</strong> (${contributing.length} resources)</div>`;
    } else if (contributing.length === 1 && !contributing[0].isParent) {
      assigneeHtml = html`<div>Assignee: <strong>${contributing[0].name}</strong> (via subtask)</div>`;
    }
    const siteUrl = getJiraBaseUrl();
    tip.innerHTML = html`
    <div class="jx-tip-level">${levelTitle}</div>
    <div><strong><a class="jx-tip-link" href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer">${task.key} ↗</a>: ${task.summary}</strong></div>
    ${assigneeHtml}
    <div>Effort: ${formatEffort(task.effortHours)} | Progress: ${task.progress}% (Target: ${task.targetProgress}%)</div>
    <div>Dates: ${task.startDate} to ${task.endDate}</div>
    ${rollupInfo}
    ${subInfo}
    ${depInfo}
  `;
    tip.style.display = "block";
    tip.style.left = e.clientX + 14 + "px";
    tip.style.top = e.clientY + 14 + "px";
  }
  function hideTooltip() {
    document.getElementById("globalTooltip").style.display = "none";
  }
  function openTaskDetailModal(taskKey) {
    const task = (currentPlan.tasks || []).find((t) => t.key === taskKey);
    if (!task) return;
    activeTaskId = task.key;
    document.getElementById("modalTaskKey").textContent = `Edit Task: ${task.key}`;
    const jiraBtn = document.getElementById("btnOpenModalInJiraNative");
    if (jiraBtn) {
      const siteUrl = getJiraBaseUrl();
      jiraBtn.href = `${siteUrl}/browse/${task.key}`;
      jiraBtn.textContent = `Open ${task.key} in Jira \u2197`;
      jiraBtn.onclick = (e) => {
        openJiraIssueInNewTab(task.key, e);
      };
    }
    document.getElementById("editSummaryInput").value = task.summary;
    document.getElementById("editStatusSelect").value = task.status;
    modalUseRollupProgressFlag = false;
    const isProgRollup = task.isEpic || task.childrenCount && task.childrenCount > 0;
    const progInput = document.getElementById("editProgressInput");
    const progSlider = document.getElementById("editProgressSlider");
    const progValLabel = document.getElementById("modalProgressValLabel");
    const progNote = document.getElementById("editProgressRollupNote");
    const rollupPctText = document.getElementById("modalRollupPctText");
    const curProg = task.progress !== void 0 ? task.progress : 0;
    if (progInput) {
      progInput.value = curProg;
      progInput.disabled = false;
    }
    if (progSlider) progSlider.value = curProg;
    if (progValLabel) progValLabel.textContent = `${curProg}%`;
    setDialogProgressLock(task.key, task.status);
    if (progNote) {
      progNote.style.display = isProgRollup ? "block" : "none";
      if (rollupPctText) {
        const rollPct = task.rollupStats ? task.rollupStats.progressPct : 0;
        rollupPctText.textContent = `${rollPct}%`;
      }
    }
    const targetInput = document.getElementById("editTargetProgressInput");
    const targetSlider = document.getElementById("editTargetProgressSlider");
    const targetValLabel = document.getElementById("modalTargetValLabel");
    const curTarget = task.targetProgress !== void 0 ? task.targetProgress : 0;
    if (targetInput) targetInput.value = curTarget;
    if (targetSlider) targetSlider.value = curTarget;
    if (targetValLabel) targetValLabel.textContent = `${curTarget}%`;
    const errEl = document.getElementById("taskDetailError");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
    const assSelect = document.getElementById("editAssigneeSelect");
    assSelect.innerHTML = "";
    (currentPlan.availableUsers || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.displayName;
      opt.dataset.accountId = u.accountId || "";
      opt.textContent = u.displayName + (u.isPlaceholder ? " [Placeholder]" : "");
      assSelect.appendChild(opt);
    });
    const curAccountId = task.resourceAccountId && task.resourceAccountId !== "unassigned" ? task.resourceAccountId : "";
    let curOption = [...assSelect.options].find((o) => curAccountId ? o.dataset.accountId === curAccountId : o.value === (task.resource || "Unassigned"));
    if (!curOption && curAccountId) {
      curOption = document.createElement("option");
      curOption.value = task.resource || curAccountId;
      curOption.dataset.accountId = curAccountId;
      curOption.textContent = task.resource || curAccountId;
      assSelect.insertBefore(curOption, assSelect.firstChild);
    }
    if (curOption) curOption.selected = true;
    assSelect.dataset.touched = "";
    assSelect.dataset.originalAccountId = curAccountId || "unassigned";
    assSelect.onchange = () => {
      assSelect.dataset.touched = "1";
    };
    const startInput = document.getElementById("editStartDateInput");
    const endInput = document.getElementById("editEndDateInput");
    if (startInput) {
      if (task.startDate) {
        startInput.value = task.startDate.split("T")[0];
      } else {
        const wk = (currentPlan.weeks || []).find((w) => w.weekKey === task.startWeek);
        startInput.value = wk?.startDate ? wk.startDate.split("T")[0] : "";
      }
    }
    if (endInput) {
      if (task.endDate) {
        endInput.value = task.endDate.split("T")[0];
      } else {
        const wk = (currentPlan.weeks || []).find((w) => w.weekKey === task.endWeek);
        endInput.value = wk?.endDate ? wk.endDate.split("T")[0] : "";
      }
    }
    const multiResSelect = document.getElementById("multiResourceSelect");
    if (multiResSelect) {
      multiResSelect.innerHTML = "";
      (currentPlan.availableUsers || []).forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.displayName;
        opt.dataset.accountId = u.accountId || "";
        opt.textContent = u.displayName + (u.isPlaceholder ? " [Placeholder]" : "");
        multiResSelect.appendChild(opt);
      });
    }
    const multiResStatus = document.getElementById("multiResourceStatus");
    if (multiResStatus) {
      multiResStatus.textContent = "";
      multiResStatus.style.display = "none";
    }
    const predSelect = document.getElementById("editPredecessorSelect");
    predSelect.innerHTML = '<option value="">None (No Dependency)</option>';
    (currentPlan.tasks || []).forEach((t) => {
      if (t.key !== task.key) {
        const opt = document.createElement("option");
        opt.value = t.key;
        opt.textContent = `${t.key}: ${t.summary}`;
        if (task.dependency && task.dependency.predecessorKey === t.key) opt.selected = true;
        predSelect.appendChild(opt);
      }
    });
    document.getElementById("editTriggerPercentInput").value = task.dependency?.triggerPercent !== void 0 ? task.dependency.triggerPercent : 30;
    const effortCfg = task.effortConfig;
    const savedUnit = effortCfg && effortCfg.unit || "HOURS";
    document.getElementById("editEstimateUnitSelect").value = savedUnit;
    if (savedUnit === "TSHIRT") {
      document.getElementById("editTshirtSelect").value = effortCfg && effortCfg.tshirtSize || "M";
    } else {
      document.getElementById("editEstimateValueInput").value = effortCfg && effortCfg.rawEstimate !== void 0 ? effortCfg.rawEstimate : task.effortHours || 0;
    }
    handleEstimateUnitChange();
    renderModalSubtasks(task);
    renderParentControl(task);
    document.getElementById("taskDetailModal").style.display = "flex";
  }
  function renderModalSubtasks(task) {
    const list = document.getElementById("subtasksList");
    list.innerHTML = "";
    const subs = task.subtasks || [];
    if (subs.length === 0) {
      list.innerHTML = '<div class="jx-subtle-11">No sub-tasks in Jira yet.</div>';
    } else {
      subs.forEach((s) => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.fontSize = "12px";
        item.innerHTML = html`<span>• ${s.key ? s.key + ": " : ""}${s.summary}</span><span class="jx-bold">${s.normalizedHours ? s.normalizedHours + "h" : ""}</span>`;
        list.appendChild(item);
      });
    }
    const local = task.localSubtasks || [];
    if (local.length) {
      const box = document.createElement("div");
      box.className = "local-subtasks";
      const note = document.createElement("p");
      note.textContent = `${local.length} sub-task${local.length === 1 ? "" : "s"} exist only in the planner, not in Jira: ${local.map((s) => s.summary).join(", ")}.`;
      box.appendChild(note);
      for (const [action, label2] of [["create", "Create in Jira"], ["drop", "Remove"]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = action === "create" ? "btn btn-primary btn-xs" : "btn btn-outline btn-xs";
        b.textContent = label2;
        b.addEventListener("click", async () => {
          b.disabled = true;
          const res = await callResolver2("resolveLocalSubtasks", { parentTaskId: task.key, action });
          if (res && res.ok !== false) showFlag({ text: action === "create" ? `Created the sub-tasks of ${task.key} in Jira.` : `Removed the planner-only sub-tasks of ${task.key}.` });
          await loadProjectPlan();
          const updated = findAnyTask(task.key);
          if (updated) renderModalSubtasks(updated);
        });
        box.appendChild(b);
      }
      list.appendChild(box);
    }
  }
  async function handleAddSubtask() {
    const summary = document.getElementById("newSubtaskSummary").value.trim();
    const hours = parseFloat(document.getElementById("newSubtaskHours").value);
    if (!summary || !activeTaskId) return;
    const res = await callResolver2("addSubtaskToTask", {
      parentTaskId: activeTaskId,
      subtask: { summary, ...hours > 0 ? { estimateValue: hours, estimateUnit: "HOURS" } : {} }
    });
    if (res && res.ok && res.createdKey) showFlag({ text: `Created sub-task ${res.createdKey} in Jira.` });
    document.getElementById("newSubtaskSummary").value = "";
    await loadProjectPlan();
    const updated = currentPlan.tasks.find((t) => t.key === activeTaskId);
    if (updated) renderModalSubtasks(updated);
  }
  async function handleAddResourceSubtask() {
    if (!activeTaskId) return;
    const resSelect = document.getElementById("multiResourceSelect");
    const selected = resSelect.options[resSelect.selectedIndex];
    const assigneeName = selected ? selected.value : "Unassigned";
    const assigneeAccountId = selected?.dataset?.accountId || void 0;
    const enteredHours = parseInt(document.getElementById("multiResourceHours").value, 10);
    const hours = Number.isFinite(enteredHours) && enteredHours > 0 ? enteredHours : void 0;
    const statusEl = document.getElementById("multiResourceStatus");
    const addBtn = document.getElementById("btnAddResourceSubtaskBtn");
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Allocating...";
    }
    try {
      const res = await callResolver2("createSubtaskForResource", {
        parentTaskId: activeTaskId,
        assigneeAccountId,
        assigneeName,
        ...hours !== void 0 ? { effortHours: hours } : {}
      });
      if (!res || res.ok !== true) {
        if (statusEl) {
          statusEl.textContent = res && (res.message || res.error) || "Jira did not create the subtask.";
          statusEl.style.color = "var(--cp-text-danger)";
          statusEl.style.display = "block";
        }
      } else {
        if (statusEl) {
          statusEl.textContent = `\u2713 Created Jira subtask for ${assigneeName} (${hours}h)`;
          statusEl.style.color = "var(--cp-text-success)";
          statusEl.style.display = "block";
        }
        await loadProjectPlan();
        const updated = currentPlan.tasks.find((t) => t.key === activeTaskId);
        if (updated) renderModalSubtasks(updated);
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err?.message || "Failed to allocate resource subtask.";
        statusEl.style.color = "var(--cp-text-danger)";
        statusEl.style.display = "block";
      }
    } finally {
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = "+ Allocate Resource";
      }
    }
  }
  async function handleUnscheduleFromModal() {
    if (!activeTaskId) return;
    const btn = document.getElementById("btnUnscheduleTaskModal");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Moving to Backlog...";
    }
    try {
      await callResolver2("unscheduleTask", { taskId: activeTaskId });
      closeModal("taskDetailModal");
      await loadProjectPlan();
    } catch (err) {
      console.error("Failed to unschedule task:", err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "\u{1F4E4} Move to Backlog";
      }
    }
  }
  function updateReconciledHoursBadge() {
    const unit = document.getElementById("editEstimateUnitSelect").value;
    let hrs = 0;
    if (unit === "HOURS") {
      const val = parseFloat(document.getElementById("editEstimateValueInput").value);
      hrs = isNaN(val) ? 0 : Math.max(0, Math.round(val));
    } else if (unit === "STORY_POINTS") {
      const pts = parseFloat(document.getElementById("editEstimateValueInput").value);
      hrs = isNaN(pts) ? 0 : Math.max(0, Math.round(pts * 8));
    } else if (unit === "TSHIRT") {
      const sz = document.getElementById("editTshirtSelect").value;
      const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
      hrs = tshirtMap[sz] || 16;
    }
    const badge = document.getElementById("reconciledHoursBadge");
    if (badge) badge.textContent = `Total: ${hrs} hrs`;
    return hrs;
  }
  function handleEstimateUnitChange() {
    const unit = document.getElementById("editEstimateUnitSelect").value;
    document.getElementById("rawEstimateGroup").style.display = unit === "TSHIRT" ? "none" : "block";
    document.getElementById("tshirtSizeGroup").style.display = unit === "TSHIRT" ? "block" : "none";
    updateReconciledHoursBadge();
  }
  async function saveTaskModalChanges() {
    if (!activeTaskId) return;
    const errEl = document.getElementById("taskDetailError");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
    const summary = document.getElementById("editSummaryInput").value.trim();
    const assSelect = document.getElementById("editAssigneeSelect");
    const selectedAss = assSelect.options[assSelect.selectedIndex];
    const resource = selectedAss ? selectedAss.value : "Unassigned";
    const resourceAccountId = selectedAss?.dataset?.accountId || (resource === "Unassigned" ? "unassigned" : void 0);
    const status = document.getElementById("editStatusSelect").value;
    const predKey = document.getElementById("editPredecessorSelect").value;
    const rawTrigger = parseInt(document.getElementById("editTriggerPercentInput").value, 10);
    const triggerPercent = isNaN(rawTrigger) ? 30 : Math.max(0, Math.min(100, rawTrigger));
    const unit = document.getElementById("editEstimateUnitSelect").value;
    let effortHours = void 0;
    let rawEstimate = void 0;
    let tshirtSize = void 0;
    if (unit === "HOURS") {
      const val = parseFloat(document.getElementById("editEstimateValueInput").value);
      if (!isNaN(val)) {
        rawEstimate = Math.max(0, Math.round(val));
        effortHours = rawEstimate;
      }
    } else if (unit === "STORY_POINTS") {
      const pts = parseFloat(document.getElementById("editEstimateValueInput").value);
      if (!isNaN(pts)) {
        rawEstimate = pts;
        effortHours = Math.max(0, Math.round(pts * 8));
      }
    } else if (unit === "TSHIRT") {
      const sz = document.getElementById("editTshirtSelect").value;
      const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
      tshirtSize = sz;
      effortHours = tshirtMap[sz] || 16;
      rawEstimate = effortHours;
    }
    const curTask = (currentPlan?.tasks || []).find((t) => t.key === activeTaskId) || {};
    const updates = {};
    if (summary && summary !== curTask.summary) updates.summary = summary;
    if (assSelect.dataset.touched === "1" && (resourceAccountId || "unassigned") !== assSelect.dataset.originalAccountId) {
      updates.resource = resource;
      if (resourceAccountId) updates.resourceAccountId = resourceAccountId;
    }
    if (status !== curTask.status) updates.status = status;
    const curCfg = curTask.effortConfig;
    const curUnit = curCfg?.unit || "HOURS";
    const curRaw = curCfg?.rawEstimate !== void 0 ? curCfg.rawEstimate : curTask.effortHours || 0;
    const curTshirt = curCfg?.tshirtSize || "M";
    const estimateChanged = unit !== curUnit || (unit === "TSHIRT" ? tshirtSize !== curTshirt : rawEstimate !== curRaw);
    if (estimateChanged && effortHours !== void 0) {
      updates.effortConfig = {
        unit,
        rawEstimate: unit === "TSHIRT" ? void 0 : rawEstimate,
        tshirtSize: unit === "TSHIRT" ? tshirtSize : void 0,
        totalCalculatedHours: effortHours
      };
      if (effortHours !== (curTask.effortHours || 0)) {
        updates.effortHours = effortHours;
      }
    }
    const progInput = document.getElementById("editProgressInput");
    if (progInput && progInput.value !== "") {
      const prog = Math.max(0, Math.min(100, parseInt(progInput.value, 10)));
      if (!isNaN(prog) && (prog !== (curTask.progress || 0) || modalUseRollupProgressFlag)) {
        updates.progress = prog;
        updates.manualProgress = !modalUseRollupProgressFlag;
      }
    }
    const targetInput = document.getElementById("editTargetProgressInput");
    if (targetInput && targetInput.value !== "") {
      const target = Math.max(0, Math.min(100, parseInt(targetInput.value, 10)));
      if (!isNaN(target) && target !== (curTask.targetProgress || 0)) updates.targetProgress = target;
    }
    const startVal = document.getElementById("editStartDateInput")?.value || "";
    const endVal = document.getElementById("editEndDateInput")?.value || "";
    const origStart = (curTask.startDate || "").slice(0, 10);
    const origEnd = (curTask.endDate || "").slice(0, 10);
    if (startVal && startVal !== origStart || endVal && endVal !== origEnd) {
      if (startVal) updates.startDate = startVal;
      if (endVal) updates.endDate = endVal;
    }
    const origPred = curTask.dependency?.predecessorKey || "";
    const origTrigger = curTask.dependency?.triggerPercent;
    if (predKey !== origPred || predKey && triggerPercent !== origTrigger) {
      updates.dependency = predKey ? { predecessorId: predKey, predecessorKey: predKey, triggerPercent, isTriggerSatisfied: false } : null;
    }
    if (Object.keys(updates).length === 0) {
      closeModal("taskDetailModal");
      return;
    }
    if (updates.progress !== void 0 && !await withStatusChoice([{ key: activeTaskId, progress: updates.progress, updates }])) return;
    const btn = document.getElementById("btnSaveTaskModal");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }
    try {
      const res = await callResolver2("updateWbsTask", { taskId: activeTaskId, updates, expectedVersion: curTask.version || 0 });
      if (res && res.error) {
        if (errEl) {
          errEl.textContent = res.error;
          errEl.style.display = "block";
        }
        return;
      }
      closeModal("taskDetailModal");
      await loadProjectPlan();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Failed to save task updates.";
        errEl.style.display = "block";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save Changes";
      }
    }
  }
  function openCreateTaskModal() {
    const summaryInput = document.getElementById("createSummaryInput");
    summaryInput.value = "";
    summaryInput.style.borderColor = "";
    const errEl = document.getElementById("createTaskError");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
    const epicSelect = document.getElementById("createEpicSelect");
    epicSelect.innerHTML = '<option value="">(None / Standalone Task)</option>';
    (currentPlan?.availableEpics || []).forEach((ep) => {
      const opt = document.createElement("option");
      opt.value = ep.summary;
      opt.dataset.key = ep.key;
      opt.textContent = `${ep.key}: ${ep.summary}`;
      epicSelect.appendChild(opt);
    });
    const assSelect = document.getElementById("createAssigneeSelect");
    assSelect.innerHTML = "";
    (currentPlan?.availableUsers || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.displayName;
      opt.dataset.accountId = u.accountId && u.accountId !== "unassigned" ? u.accountId : "";
      opt.textContent = u.displayName + (u.isPlaceholder ? " [Placeholder]" : "");
      assSelect.appendChild(opt);
    });
    const startWeekSelect = document.getElementById("createStartWeekSelect");
    startWeekSelect.innerHTML = "";
    const curWk = (currentPlan?.weeks || []).find((w) => w.isCurrentWeek);
    (currentPlan?.weeks || []).forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.weekKey;
      opt.textContent = `${w.weekKey} (${w.sprintName})`;
      if (curWk && w.weekKey === curWk.weekKey) opt.selected = true;
      startWeekSelect.appendChild(opt);
    });
    document.getElementById("createTaskModal").style.display = "flex";
    setTimeout(() => summaryInput.focus(), 50);
  }
  var isCreatingTask = false;
  async function executeCreateTask() {
    if (isCreatingTask) return;
    const btn = document.getElementById("btnSubmitCreateTask");
    const summaryInput = document.getElementById("createSummaryInput");
    const summary = summaryInput.value.trim();
    const epicSelect = document.getElementById("createEpicSelect");
    const selectedEpicOpt = epicSelect ? epicSelect.options[epicSelect.selectedIndex] : null;
    const epic = epicSelect?.value || void 0;
    const parentKey = selectedEpicOpt?.dataset?.key || void 0;
    const assSelect = document.getElementById("createAssigneeSelect");
    const selectedAssOpt = assSelect ? assSelect.options[assSelect.selectedIndex] : null;
    const resource = assSelect?.value || "Unassigned";
    const assigneeAccountId = selectedAssOpt?.dataset?.accountId || void 0;
    const parsedEffort = parseInt(document.getElementById("createEffortInput").value, 10);
    const effortHours = isNaN(parsedEffort) ? void 0 : parsedEffort;
    const startWeek = document.getElementById("createStartWeekSelect").value;
    const errEl = document.getElementById("createTaskError");
    if (!summary) {
      summaryInput.style.borderColor = "var(--cp-border-danger)";
      summaryInput.focus();
      if (errEl) {
        errEl.textContent = "Please enter a task summary.";
        errEl.style.display = "block";
      }
      return;
    }
    summaryInput.style.borderColor = "";
    if (errEl) errEl.style.display = "none";
    isCreatingTask = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating in Jira...";
    }
    try {
      const res = await callResolver2("createInlineTask", {
        summary,
        epic,
        epicKey: parentKey,
        parentKey,
        resource,
        resourceAccountId: assigneeAccountId,
        assigneeAccountId,
        effortHours,
        startWeek,
        spanWeeks: 3
      });
      if (!res || res.ok !== true) {
        if (errEl) {
          errEl.textContent = res && (res.message || res.error) || "Failed to create task in Jira.";
          errEl.style.display = "block";
        }
        return;
      }
      summaryInput.value = "";
      closeModal("createTaskModal");
      if (res && res.task) {
        expandAncestors(res.task);
        registerOptimisticTask(res.task);
      }
      if (currentHierarchyView === "epics") {
        currentHierarchyView = "all";
        const hierSwitcher = document.getElementById("hierarchySwitcher");
        if (hierSwitcher) hierSwitcher.value = "all";
      }
      if (res && res.plan && Array.isArray(res.plan.tasks)) {
        mergeOptimisticTasks(res.plan);
        currentPlan = res.plan;
        renderPlan();
      } else if (res && res.task && currentPlan && Array.isArray(currentPlan.tasks)) {
        if (!currentPlan.tasks.some((t) => t.key === res.task.key)) {
          currentPlan.tasks.push(res.task);
        }
        renderPlan();
      } else {
        await loadProjectPlan();
      }
      if (res?.task?.key) {
        setTimeout(() => {
          scrollRowIntoView(res.task.key);
        }, 120);
      }
      showFlag({ text: "Task " + (res?.task?.key || "") + " created and scheduled." });
    } catch (err) {
      if (errEl) {
        errEl.textContent = "An unexpected network error occurred.";
        errEl.style.display = "block";
      }
    } finally {
      isCreatingTask = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create & Schedule";
      }
    }
  }
  function openCreateEpicModal() {
    if (currentPlan && currentPlan.hasEpic === false) {
      showErrorBanner("Epics are not enabled in this project type.");
      return;
    }
    const summaryInput = document.getElementById("newEpicSummaryInput");
    summaryInput.value = "";
    summaryInput.style.borderColor = "";
    const errEl = document.getElementById("createEpicError");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
    document.getElementById("createEpicModal").style.display = "flex";
    setTimeout(() => summaryInput.focus(), 50);
  }
  var isCreatingEpic = false;
  async function executeCreateEpic() {
    if (isCreatingEpic) return;
    const btn = document.getElementById("btnSubmitCreateEpic");
    const summaryInput = document.getElementById("newEpicSummaryInput");
    const summary = summaryInput.value.trim();
    const errEl = document.getElementById("createEpicError");
    if (!summary) {
      summaryInput.style.borderColor = "var(--cp-border-danger)";
      summaryInput.focus();
      if (errEl) {
        errEl.textContent = "Please enter an epic summary.";
        errEl.style.display = "block";
      }
      return;
    }
    summaryInput.style.borderColor = "";
    if (errEl) errEl.style.display = "none";
    isCreatingEpic = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating Epic...";
    }
    try {
      const res = await callResolver2("createJiraEpic", { summary });
      if (!res || res.ok !== true) {
        if (errEl) {
          errEl.textContent = res && (res.message || res.error) || "Failed to create epic in Jira.";
          errEl.style.display = "block";
        }
        return;
      }
      summaryInput.value = "";
      closeModal("createEpicModal");
      if (res && res.epic && currentPlan) {
        if (!Array.isArray(currentPlan.availableEpics)) currentPlan.availableEpics = [];
        if (!currentPlan.availableEpics.some((e) => e.key === res.epic.key)) {
          currentPlan.availableEpics.push(res.epic);
        }
      }
      showFlag({ text: "Epic " + (res?.epic?.key || "") + " created." });
    } catch (err) {
      if (errEl) {
        errEl.textContent = "An unexpected network error occurred.";
        errEl.style.display = "block";
      }
    } finally {
      isCreatingEpic = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create Epic";
      }
    }
  }
  function closeModal(id) {
    hideModal(document.getElementById(id));
  }
  function hideModal(modal) {
    modal.style.display = "none";
    modal.dataset.dirty = "";
    const prompt = modal.querySelector(".discard-prompt");
    if (prompt) prompt.remove();
    if (modal.id === "statusOfferModal" && statusOfferResolve) statusOfferResolve("cancel");
  }
  var statusOfferResolve = null;
  function askStatusOffers(offers) {
    const prompt = offerPrompt(offers);
    const modal = document.getElementById("statusOfferModal");
    if (!prompt || !modal) return Promise.resolve("keep");
    document.getElementById("statusOfferQuestion").textContent = prompt.question;
    const list = document.getElementById("statusOfferList");
    list.replaceChildren(...prompt.lines.map((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      return li;
    }));
    list.hidden = prompt.lines.length === 0;
    const move = document.getElementById("btnStatusOfferMove");
    const keep = document.getElementById("btnStatusOfferKeep");
    move.textContent = prompt.move;
    keep.textContent = prompt.keep;
    const opener = document.activeElement;
    modal.style.display = "flex";
    move.focus();
    announce(prompt.question);
    return new Promise((resolve) => {
      statusOfferResolve = (choice) => {
        statusOfferResolve = null;
        hideModal(modal);
        if (opener && typeof opener.focus === "function") opener.focus();
        resolve(choice);
      };
    });
  }
  async function withStatusChoice(edits) {
    const offers = statusOffers(edits.map((e) => ({ key: e.key, status: findTask(e.key)?.status, progress: e.progress, chosenStatus: e.updates.status })));
    if (!offers.length) return true;
    const choice = await askStatusOffers(offers);
    if (choice === "cancel") return false;
    if (choice === "move") {
      for (const o of offers) {
        const edit = edits.find((e) => e.key === o.key);
        if (edit) edit.updates.status = o.to;
      }
    }
    return true;
  }
  function setDialogProgressLock(key, status) {
    const reason = progressLockReason({ key, status });
    for (const id of ["editProgressInput", "editProgressSlider", "btnModalUseRollup"]) {
      const el3 = document.getElementById(id);
      if (el3) el3.disabled = !!reason;
    }
    document.querySelectorAll(".modal-prog-preset").forEach((b) => {
      b.disabled = !!reason;
    });
    const note = document.getElementById("editProgressLockNote");
    if (note) {
      note.textContent = reason || "";
      note.hidden = !reason;
    }
  }
  function openModal() {
    return [...document.querySelectorAll(".modal-backdrop")].find((m) => m.style.display === "flex" || m.style.display === "block") || null;
  }
  function closeModalAsking(modal) {
    if (!modal.dataset.dirty) {
      hideModal(modal);
      return;
    }
    const card = modal.querySelector(".modal-card") || modal;
    let prompt = card.querySelector(".discard-prompt");
    if (!prompt) {
      prompt = document.createElement("div");
      prompt.className = "discard-prompt";
      prompt.setAttribute("role", "alertdialog");
      prompt.setAttribute("aria-label", "Unsaved changes");
      const text = document.createElement("span");
      text.textContent = "Discard unsaved changes?";
      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "btn btn-outline btn-sm";
      discard.textContent = "Discard";
      discard.addEventListener("click", () => hideModal(modal));
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "btn btn-primary btn-sm";
      keep.textContent = "Keep editing";
      keep.addEventListener("click", () => prompt.remove());
      prompt.append(text, discard, keep);
      card.prepend(prompt);
    }
    prompt.querySelector(".btn-primary").focus();
  }
  function renderUtilizationView() {
    const cont = document.getElementById("utilizationProfilesContent");
    const weekStarts = Array.from({ length: 8 }, (_, i) => addDays(mondayOf(todayIso()), i * 7));
    const rows = weeklyHours(currentPlan?.tasks || [], weekStarts);
    if (rows.length === 0) {
      cont.innerHTML = "<div>No assigned, estimated tasks with dates on the plan.</div>";
      return;
    }
    cont.innerHTML = html`<table class="hours-table">
    <thead><tr><th scope="col">Person</th>${weekStarts.map((w) => html`<th scope="col">${w}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr><th scope="row">${r.name}</th>${r.hours.map((h) => html`<td>${h} h</td>`)}</tr>`)}</tbody>
  </table>`;
  }
})();
